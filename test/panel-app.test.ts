/*
 * `src/panel/App.tsx`: decide entre «pedir la contraseña» y «editar».
 *
 * La decisión en sí (`cargaInicial`) y las dos acciones de la pantalla de
 * entrada (`intentaEntrar`, `pideEnlace`) son funciones puras/inyectables
 * — se prueban DIRECTO, sin montar nada, con un `historial`/`entrar`/
 * `enlace` de mentira. Cada rama puede fallar sola: invertir la
 * comparación `status === 401`, olvidar recortar el correo, o perder el
 * `problema` del servidor hace caer un test puntual, no todos a la vez.
 *
 * Lo que SÍ hace falta un componente real para probar (¿el formulario
 * llama a la acción correcta al escribir?, ¿el 401 de verdad muestra el
 * campo de contraseña?) queda fuera de esta tarea por la misma razón que
 * documenta `test/rive.test.ts` para `MascotaRive` (léelo): este proyecto
 * no tiene un DOM de navegador en el harness de test (ni jsdom ni
 * happy-dom instalados), y `client:only="react"` además significa que la
 * isla NUNCA se renderiza en el servidor — no hay HTML que inspeccionar
 * ahí. Lo que sí se prueba acá, con `renderToStaticMarkup` (sin necesitar
 * ningún DOM): que el componente renderiza sin tirar en su estado inicial,
 * y que ningún texto que la clienta pueda leer —ni el de acá, ni el de la
 * cáscara— usa jerga técnica.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App, { cargaInicial, intentaEntrar, pideEnlace } from '@/panel/App'
import type { ResultadoEntrar, ResultadoEnlace } from '@/panel/api'
import { jergaEn } from '@/servidor/estado'

describe('cargaInicial', () => {
  it('historial ok: modo "editar", con `base` y `publicaciones` tal cual vinieron', async () => {
    const r = await cargaInicial(async () => ({
      ok: true,
      base: 'a'.repeat(40),
      publicaciones: [{ sha: 'c1', resumen: 'cambia precios', autor: 'a@b.mx', cuando: 'x', revierteA: null }],
    }))
    expect(r).toEqual({
      modo: 'editar',
      base: 'a'.repeat(40),
      publicaciones: [{ sha: 'c1', resumen: 'cambia precios', autor: 'a@b.mx', cuando: 'x', revierteA: null }],
    })
  })

  it('historial 401: modo "entrar" — la única regla de esta tarea', async () => {
    const r = await cargaInicial(async () => ({ ok: false, status: 401, problema: 'Tu sesión no es válida: vuelve a entrar.' }))
    expect(r).toEqual({ modo: 'entrar' })
  })

  it('historial 502 (no es 401): modo "error", con el `problema` del servidor tal cual — no se confunde con "sin sesión"', async () => {
    const r = await cargaInicial(async () => ({ ok: false, status: 502, problema: 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.' }))
    expect(r).toEqual({ modo: 'error', problema: 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.' })
  })

  it('red caída (status 0): también es "error", nunca "entrar" — no hay forma de saber si hay sesión', async () => {
    const r = await cargaInicial(async () => ({ ok: false, status: 0, problema: 'No se pudo conectar. Intenta de nuevo.' }))
    expect(r).toEqual({ modo: 'error', problema: 'No se pudo conectar. Intenta de nuevo.' })
  })
})

describe('intentaEntrar', () => {
  it('recorta el correo y manda clave/recuerdame/dispositivo tal cual', async () => {
    const pedidos: unknown[] = []
    const r = await intentaEntrar(
      { correo: '  a@b.mx  ', clave: 'x', recuerdame: true },
      {
        dispositivo: 'aparato-fijo',
        entrarFn: async (cuerpo) => {
          pedidos.push(cuerpo)
          return { ok: true }
        },
      },
    )
    expect(r).toEqual({ ok: true })
    expect(pedidos).toEqual([{ correo: 'a@b.mx', clave: 'x', recuerdame: true, dispositivo: 'aparato-fijo' }])
  })

  it('propaga la falla del servidor tal cual, sin envolverla', async () => {
    const fallo: ResultadoEntrar = { ok: false, status: 401, problema: 'No se pudo entrar: revisa tus datos y vuelve a intentar.' }
    const r = await intentaEntrar({ correo: 'a@b.mx', clave: 'mala', recuerdame: false }, { entrarFn: async () => fallo, dispositivo: 'd' })
    expect(r).toEqual(fallo)
  })
})

describe('pideEnlace', () => {
  it('recorta el correo antes de pedirlo', async () => {
    const pedidos: unknown[] = []
    await pideEnlace('  a@b.mx  ', async (cuerpo) => {
      pedidos.push(cuerpo)
      return { ok: true, mensaje: 'x' }
    })
    expect(pedidos).toEqual([{ correo: 'a@b.mx' }])
  })

  it('el `mensaje`/`problema` del servidor llega tal cual', async () => {
    const resultado: ResultadoEnlace = { ok: true, mensaje: 'Si esa dirección tiene acceso, te llegó un correo con el enlace.' }
    const r = await pideEnlace('a@b.mx', async () => resultado)
    expect(r).toEqual(resultado)
  })
})

/*
 * Los textos que la clienta puede llegar a leer en este componente, para
 * el guardián de jerga — sacados a mano del código (como ya hace
 * `test/entrar-astro.test.ts`), porque este componente no pasa por el
 * sistema de copy de contenido (`src/contenido/**`, esa es la Tarea 2).
 */
const TEXTOS_VISIBLES = [
  'Cargando…',
  'Entrar al panel',
  'Correo',
  'Contraseña',
  'Recordar este aparato',
  'Entrando…',
  'Entrar',
  'No me acuerdo de mi contraseña',
  'Reintentar',
  'Tu panel',
  'Ya entraste. Aquí vas a poder editar el contenido de tu sitio.',
  'Todavía no hay ninguna publicación tuya.',
]

describe('App — textos visibles', () => {
  it('ninguno usa jerga técnica (nombres de tecnologías, "commit", "deploy"...)', () => {
    for (const texto of TEXTOS_VISIBLES) {
      expect(jergaEn(texto), texto).toBeNull()
    }
  })

  it('todos están de verdad en el código fuente del componente (si un texto se reescribe acá sin tocar App.tsx, esto lo nota)', () => {
    const fuente = readFileSync('src/panel/App.tsx', 'utf8')
    for (const texto of TEXTOS_VISIBLES) {
      expect(fuente, `no se encontró «${texto}» en App.tsx`).toContain(texto)
    }
  })
})

describe('App — el estado inicial renderiza sin tirar (sin DOM: `renderToStaticMarkup`)', () => {
  it('client:only nunca corre efectos en SSR: el primer render es siempre "Cargando…", nunca el formulario ni el editor', () => {
    // Ninguna de las dos ramas de historial() puede haber corrido todavía
    // (el efecto no dispara en un render de servidor) — si App alguna vez
    // dejara de arrancar en "cargando" (por ejemplo, leyendo un estado por
    // fuera de React), esto lo vería.
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('Cargando…')
    expect(html).not.toContain('Entrar al panel')
    expect(html).not.toContain('Tu panel')
  })
})
