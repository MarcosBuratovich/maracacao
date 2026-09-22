/*
 * `src/panel/historial.ts` + `src/panel/Historial.tsx` (Tarea 5, fase 6):
 * la lista de publicaciones y la frase de arriba de todo con el resultado
 * de la última (spec §4.5).
 *
 * La lógica de verdad —fecha en palabras, quién, cómo se distingue un
 * deshacer— es pura e inyectable (mismo patrón que
 * `test/panel-borrador.test.ts`/`test/panel-publicacion.test.ts`): se
 * prueba DIRECTO, con un reloj fijo, sin montar nada. Los componentes se
 * prueban con `renderToStaticMarkup` —sin jsdom, mismo criterio que
 * `test/panel-app.test.ts`/`test/panel-editor.test.ts` (léelos): este
 * proyecto no tiene DOM en el harness de test— así que lo que se verifica
 * ahí es comportamiento real (lo que el HTML resultante contiene o no
 * contiene), nunca el texto del archivo fuente.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jergaEn } from '@/servidor/estado'
import type { Publicada } from '@/panel/api'
import { fechaEnPalabras, quienPublico, filaDeHistorial, resumenUltimaPublicacion } from '@/panel/historial'
import Historial from '@/panel/Historial'
import { PantallaEditando, textoPublicaciones } from '@/panel/App'

/*
 * ---------------------------------------------------------------------
 * fechaEnPalabras — nunca ISO 8601
 * ---------------------------------------------------------------------
 */

// Fijo a propósito, lejos de cualquier borde de huso horario real:
// 2026-09-21 a las 15:00, hora del aparato que corre el test.
const AHORA = new Date(2026, 8, 21, 15, 0, 0).getTime()

function enElDia(dia: number, mes: number, anio: number, hora = 10, minuto = 5): string {
  return new Date(anio, mes, dia, hora, minuto, 0).toISOString()
}

describe('fechaEnPalabras', () => {
  it('de HOY: la hora, en HH:MM', () => {
    const cuando = new Date(2026, 8, 21, 9, 3, 0).toISOString()
    expect(fechaEnPalabras(cuando, AHORA)).toBe('hoy a las 09:03')
  })

  it('de AYER: solo "ayer", sin hora', () => {
    expect(fechaEnPalabras(enElDia(20, 8, 2026), AHORA)).toBe('ayer')
  })

  it('más viejo, mismo año: día y mes, sin año', () => {
    expect(fechaEnPalabras(enElDia(12, 8, 2026), AHORA)).toBe('el 12 de septiembre')
  })

  it('más viejo, otro año: día, mes Y año', () => {
    expect(fechaEnPalabras(enElDia(12, 8, 2025), AHORA)).toBe('el 12 de septiembre de 2025')
  })

  it('nunca se parece a ISO 8601: ni guiones de fecha ni una T de hora', () => {
    for (const cuando of [
      new Date(2026, 8, 21, 9, 3, 0).toISOString(),
      enElDia(20, 8, 2026),
      enElDia(12, 8, 2026),
      enElDia(12, 8, 2025),
    ]) {
      const texto = fechaEnPalabras(cuando, AHORA)
      expect(texto, texto).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(texto, texto).not.toMatch(/T\d{2}:\d{2}/)
    }
  })

  it('una fecha ilegible no revienta: cae a un texto genérico, nunca "Invalid Date"', () => {
    const texto = fechaEnPalabras('esto no es una fecha', AHORA)
    expect(texto).not.toMatch(/invalid/i)
    expect(texto.length).toBeGreaterThan(0)
  })
})

/*
 * ---------------------------------------------------------------------
 * quienPublico — nunca un correo, nunca "null"
 * ---------------------------------------------------------------------
 */

describe('quienPublico', () => {
  it('con autor: primera persona, sin mostrar el correo', () => {
    const texto = quienPublico('clienta@maracacao.mx')
    expect(texto).toBe('Lo publicaste tú')
    expect(texto).not.toContain('@')
  })

  it('sin autor (null): no revienta la fila ni muestra "null"', () => {
    const texto = quienPublico(null)
    expect(texto.toLowerCase()).not.toContain('null')
    expect(texto).not.toContain('@')
    expect(texto.length).toBeGreaterThan(0)
  })
})

/*
 * ---------------------------------------------------------------------
 * filaDeHistorial — una reversión se ve como tal
 * ---------------------------------------------------------------------
 */

const publicacion = (extra: Partial<Publicada>): Publicada => ({
  sha: 'a'.repeat(40),
  resumen: 'cambia Línea de cierre',
  autor: 'clienta@maracacao.mx',
  cuando: enElDia(21, 8, 2026),
  revierteA: null,
  ...extra,
})

describe('filaDeHistorial', () => {
  it('un cambio suelto: esReversion false, título es el resumen tal cual', () => {
    const p = publicacion({ sha: 'c1', resumen: 'cambia Línea de cierre', revierteA: null })
    const fila = filaDeHistorial(p, [p], AHORA)
    expect(fila.esReversion).toBe(false)
    expect(fila.titulo).toBe('cambia Línea de cierre')
  })

  it('una reversión CON el original en la lista: se distingue, y nombra el resumen real del original — nunca lo inventa', () => {
    const original = publicacion({ sha: 'orig', resumen: 'cambia Línea de cierre' })
    const reversion = publicacion({ sha: 'rev', resumen: 'cambia Línea de cierre', revierteA: 'orig' })
    const fila = filaDeHistorial(reversion, [reversion, original], AHORA)
    expect(fila.esReversion).toBe(true)
    expect(fila.titulo).toContain('cambia Línea de cierre')
    expect(fila.titulo).toMatch(/deshace/)
  })

  it('una reversión CON el original en la lista: NO es indistinguible de un cambio nuevo al mismo campo (el bug que esta tarea existe para evitar)', () => {
    const original = publicacion({ sha: 'orig', resumen: 'cambia Línea de cierre' })
    const reversion = publicacion({ sha: 'rev', resumen: 'cambia Línea de cierre', revierteA: 'orig' })
    const cambioSuelto = publicacion({ sha: 'otro', resumen: 'cambia Línea de cierre', revierteA: null })

    const filaReversion = filaDeHistorial(reversion, [reversion, original], AHORA)
    const filaSuelta = filaDeHistorial(cambioSuelto, [cambioSuelto], AHORA)

    expect(filaReversion.esReversion).not.toBe(filaSuelta.esReversion)
    expect(filaReversion.titulo).not.toBe(filaSuelta.titulo)
  })

  it('una reversión SIN el original en las 20: se explica sola, sin inventar de qué cambio se trataba', () => {
    const reversion = publicacion({ sha: 'rev', resumen: 'cambia Línea de cierre', revierteA: 'algo-que-no-esta-en-la-lista' })
    const fila = filaDeHistorial(reversion, [reversion], AHORA)
    expect(fila.esReversion).toBe(true)
    expect(fila.titulo).toMatch(/deshace/)
    // No inventa un resumen que no tiene: nada entre comillas.
    expect(fila.titulo).not.toContain('«')
  })

  it('nunca muestra el sha — ni el propio ni el de lo que revirtió', () => {
    const p = publicacion({ sha: 'sha-secreto-1234', revierteA: 'sha-secreto-original' })
    const fila = filaDeHistorial(p, [p], AHORA)
    expect(fila.titulo).not.toContain('sha-secreto')
    expect(fila.cuando).not.toContain('sha-secreto')
    expect(fila.quien).not.toContain('sha-secreto')
  })
})

/*
 * ---------------------------------------------------------------------
 * resumenUltimaPublicacion — la primera pantalla (spec §4.5)
 * ---------------------------------------------------------------------
 */

describe('resumenUltimaPublicacion', () => {
  it('sin publicaciones: null — quien llama decide cómo se ve una primera vez legítima', () => {
    expect(resumenUltimaPublicacion([], AHORA)).toBeNull()
  })

  it('con publicaciones: una frase con qué se publicó y cuándo, sobre la MÁS RECIENTE (la primera de la lista)', () => {
    const masReciente = publicacion({ sha: 'nuevo', resumen: 'cambia el precio de las trufas', cuando: enElDia(21, 8, 2026, 9, 3) })
    const vieja = publicacion({ sha: 'viejo', resumen: 'agrega una pregunta frecuente', cuando: enElDia(1, 7, 2026) })
    const texto = resumenUltimaPublicacion([masReciente, vieja], AHORA)
    expect(texto).toContain('cambia el precio de las trufas')
    expect(texto).toContain('hoy a las 09:03')
    expect(texto).not.toContain('pregunta frecuente')
  })

  it('no dice quién — esa frase es sobre qué y cuándo, nunca sobre un correo', () => {
    const p = publicacion({ autor: 'clienta@maracacao.mx' })
    const texto = resumenUltimaPublicacion([p], AHORA) as string
    expect(texto).not.toContain('@')
  })
})

/*
 * ---------------------------------------------------------------------
 * Guardián de jerga sobre TODO texto armado (interpolado, no en el fuente)
 * ---------------------------------------------------------------------
 */

describe('nada de lo que arma este módulo usa jerga técnica', () => {
  it('quienPublico, las dos ramas', () => {
    for (const texto of [quienPublico(null), quienPublico('a@b.mx')]) {
      expect(jergaEn(texto), texto).toBeNull()
    }
  })

  it('fechaEnPalabras, las cuatro formas', () => {
    for (const cuando of [
      new Date(2026, 8, 21, 9, 3, 0).toISOString(),
      enElDia(20, 8, 2026),
      enElDia(12, 8, 2026),
      enElDia(12, 8, 2025),
    ]) {
      const texto = fechaEnPalabras(cuando, AHORA)
      expect(jergaEn(texto), texto).toBeNull()
    }
  })

  it('filaDeHistorial y resumenUltimaPublicacion, cambio suelto y reversión', () => {
    const original = publicacion({ sha: 'orig' })
    const reversion = publicacion({ sha: 'rev', revierteA: 'orig' })
    const lista = [reversion, original]
    for (const p of lista) {
      const fila = filaDeHistorial(p, lista, AHORA)
      expect(jergaEn(fila.titulo), fila.titulo).toBeNull()
      expect(jergaEn(fila.quien), fila.quien).toBeNull()
    }
    const resumen = resumenUltimaPublicacion(lista, AHORA) as string
    expect(jergaEn(resumen), resumen).toBeNull()
  })
})

/*
 * ---------------------------------------------------------------------
 * Los componentes: renderizan de verdad (sin DOM: `renderToStaticMarkup`)
 * ---------------------------------------------------------------------
 */

describe('Historial — renderiza sin tirar, con contenido real', () => {
  it('con cero publicaciones: no pinta nada (PantallaEditando ni lo llama en ese caso, pero no revienta si algún día se lo llama así)', () => {
    const html = renderToStaticMarkup(createElement(Historial, { publicaciones: [], ahora: AHORA }))
    expect(html).toBe('')
  })

  it('con publicaciones: la frase de arriba está, en palabras (no ISO), y el botón para ver todo también', () => {
    const p = publicacion({ sha: 'nuevo', resumen: 'cambia el precio de las trufas', cuando: enElDia(21, 8, 2026, 9, 3) })
    const html = renderToStaticMarkup(createElement(Historial, { publicaciones: [p], ahora: AHORA }))
    expect(html).toContain('cambia el precio de las trufas')
    expect(html).toContain('Ver tu historial completo (1)')
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('el reloj que se le pasa MANDA sobre el del sistema — el guardián de que esto no se vuelva a atar a la fecha de hoy', () => {
    // [2026-09-22] Este test existe por un build rojo en `main`. El primer
    // test de esta pantalla fijaba una fecha absoluta y esperaba «hoy a las
    // 09:03»: pasó el día que se escribió y se cayó a la mañana siguiente,
    // cuando esa misma fecha pasó a ser «ayer». Como `pnpm build` es el
    // `buildCommand` de Vercel, un test atado al reloj no es una molestia:
    // es la clienta sin poder publicar.
    //
    // La forma de que no vuelva a pasar no es recordar la regla, es que un
    // test falle si alguien saca la inyección: acá la MISMA publicación se
    // pinta con dos relojes lejanos entre sí y tiene que leerse distinto.
    const p = publicacion({ cuando: enElDia(21, 8, 2026, 9, 3) })
    const elMismoDia = renderToStaticMarkup(createElement(Historial, { publicaciones: [p], ahora: AHORA }))
    const mesesDespues = renderToStaticMarkup(
      createElement(Historial, { publicaciones: [p], ahora: new Date(2027, 2, 15, 4, 0, 0).getTime() }),
    )
    expect(elMismoDia).toContain('hoy a las 09:03')
    expect(mesesDespues).toContain('el 21 de septiembre de 2026')
    expect(mesesDespues).not.toContain('hoy a las 09:03')
  })

  it('una reversión se ve distinta de un cambio suelto en el HTML de verdad, y el sha nunca aparece', () => {
    const original = publicacion({ sha: 'orig-sha-1234567890', resumen: 'cambia Línea de cierre' })
    const reversion = publicacion({ sha: 'rev-sha-0987654321', resumen: 'cambia Línea de cierre', revierteA: 'orig-sha-1234567890' })
    const html = renderToStaticMarkup(createElement(Historial, { publicaciones: [reversion, original], ahora: AHORA }))
    expect(html).toMatch(/deshace/)
    expect(html).not.toContain('orig-sha-1234567890')
    expect(html).not.toContain('rev-sha-0987654321')
    expect(html.toLowerCase()).not.toContain('null')
  })

  it('el correo del autor nunca aparece crudo en el HTML', () => {
    const p = publicacion({ autor: 'clienta-secreta@maracacao.mx' })
    const html = renderToStaticMarkup(createElement(Historial, { publicaciones: [p], ahora: AHORA }))
    expect(html).not.toContain('clienta-secreta@maracacao.mx')
    expect(html).toContain('Lo publicaste tú')
  })
})

describe('PantallaEditando — la primera pantalla (spec §4.5)', () => {
  it('cero publicaciones: ni un hueco ni un error — el aviso de primera vez de siempre, y no revienta', () => {
    const html = renderToStaticMarkup(createElement(PantallaEditando, { base: 'a'.repeat(40), publicaciones: [], ahora: AHORA }))
    expect(html).toContain(textoPublicaciones(0))
    expect(html).not.toMatch(/error/i)
  })

  it('con publicaciones: lo primero que se pinta después del título es el resultado de la última — no un tablero limpio', () => {
    const p = publicacion({ sha: 'nuevo', resumen: 'cambia el precio de las trufas', cuando: enElDia(21, 8, 2026, 9, 3) })
    const html = renderToStaticMarkup(createElement(PantallaEditando, { base: 'a'.repeat(40), publicaciones: [p], ahora: AHORA }))
    expect(html).toContain('cambia el precio de las trufas')
    expect(html).toContain('hoy a las 09:03')
    // No hay una segunda pantalla de por medio: el título va antes del
    // resultado, y el resultado va antes de cualquier otra cosa del cuerpo.
    const posTitulo = html.indexOf('Tu panel')
    const posResultado = html.indexOf('cambia el precio de las trufas')
    expect(posTitulo).toBeGreaterThanOrEqual(0)
    expect(posResultado).toBeGreaterThan(posTitulo)
  })
})
