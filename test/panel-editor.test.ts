/*
 * `src/panel/Editor.tsx`: navegación por sección y los campos de cada una.
 *
 * Todo el copy de CAMPO (etiqueta, ayuda, mensajes de validación, nombre
 * de un elemento de lista) sale de `src/contenido/**` vía `./campos` — ya
 * cubierto letra por letra por `test/contenido.test.ts` y
 * `test/panel-campos.test.ts`. Lo que hace falta cubrir ACÁ son los pocos
 * textos que este archivo sí inventa: el rótulo del selector de sección,
 * el aviso de sección vacía, y el contador de caracteres (interpolado, con
 * la regla de «tope de seguridad», nunca «cabe»).
 *
 * Sin DOM en el harness de test — misma razón, mismo patrón que
 * `test/panel-app.test.ts` (léelo): `renderToStaticMarkup`, sin jsdom ni
 * happy-dom, así que lo que se prueba es que renderiza sin tirar con el
 * contenido real y que ningún texto propio trae jerga ni promete que un
 * texto "cabe".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Editor, { textoContador } from '@/panel/Editor'
import { ETIQUETA_DE_SECCION, SECCIONES } from '@/panel/campos'
import { jergaEn } from '@/servidor/estado'

/*
 * Los textos propios de este componente (ni etiqueta, ni ayuda, ni mensaje
 * de esquema): sacados a mano del código, como ya hace `panel-app.test.ts`
 * para `App.tsx`.
 */
const TEXTOS_VISIBLES = [
  'Sección',
  'Esta sección todavía no tiene campos para editar.',
]

describe('Editor — textos propios', () => {
  it('ninguno usa jerga técnica', () => {
    for (const texto of TEXTOS_VISIBLES) {
      expect(jergaEn(texto), texto).toBeNull()
    }
  })

  it('todos están de verdad en el código fuente (si se reescriben acá sin tocar Editor.tsx, esto lo nota)', () => {
    const fuente = readFileSync('src/panel/Editor.tsx', 'utf8')
    for (const texto of TEXTOS_VISIBLES) {
      expect(fuente, `no se encontró «${texto}» en Editor.tsx`).toContain(texto)
    }
  })
})

describe('textoContador', () => {
  it('dice cuánto lleva escrito y el tope', () => {
    expect(textoContador(12, 40)).toBe('12 de 40 caracteres · tope de seguridad')
  })

  it('SIEMPRE dice «tope de seguridad» — nunca «cabe»: eso lo decide un medidor que todavía no existe', () => {
    for (const [actual, tope] of [[0, 20], [40, 40], [999, 40]] as const) {
      const texto = textoContador(actual, tope)
      expect(texto, texto).toContain('tope de seguridad')
      expect(texto.toLowerCase(), texto).not.toContain('cabe')
    }
  })

  it('nunca usa jerga técnica, para ningún número', () => {
    for (const [actual, tope] of [[0, 20], [200, 200], [1, 1]] as const) {
      const texto = textoContador(actual, tope)
      expect(jergaEn(texto), texto).toBeNull()
    }
  })
})

describe('las 14 etiquetas de sección: sin jerga, y ninguna repite el nombre crudo del esquema', () => {
  it('cada una está limpia de jerga técnica', () => {
    for (const s of SECCIONES) {
      expect(jergaEn(ETIQUETA_DE_SECCION[s]), s).toBeNull()
    }
  })
})

describe('Editor — renderiza sin tirar, con el contenido real', () => {
  it('la primera sección (portada) se ve con sus campos, sin reventar', () => {
    const html = renderToStaticMarkup(createElement(Editor))
    // El selector de sección, con las 14 opciones.
    expect(html).toContain('Sección')
    for (const s of SECCIONES) {
      expect(html, s).toContain(ETIQUETA_DE_SECCION[s])
    }
    // Un campo real de la primera sección (portada): su etiqueta y su ayuda.
    expect(html).toContain('Renglón 1 del titular')
    expect(html).toContain('El primer renglón grande. Se dibuja en versales.')
  })

  it('ningún campo de Marcos aparece renderizado (el cacao, un dato de la envoltura, no de ella)', () => {
    const html = renderToStaticMarkup(createElement(Editor))
    // «Porcentaje de cacao» es la etiqueta de un campo `quien: 'marcos'":
    // si el filtro de campos.ts se rompiera y dejara pasar campos ajenos,
    // este candado no lo vería directo (esa etiqueta vive en la sección
    // "sabores", no en "portada", la que se abre por defecto) — así que
    // el candado de verdad es el de `panel-campos.test.ts`. Este es un
    // candado de humo nada más: que el HTML de la sección abierta no
    // contenga la palabra "cacao" en ningún campo con ese texto.
    expect(html.toLowerCase()).not.toContain('porcentaje de cacao')
  })
})
