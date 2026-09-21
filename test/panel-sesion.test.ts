/*
 * `src/panel/Sesion.tsx` (Tareas 3 y 4, fase 6): la pantalla que comparte el
 * borrador y publicar/saber/deshacer.
 *
 * Toda la lógica de VERDAD —las transiciones de estado, el sondeo, el
 * auto-guardado— vive en `./borrador.ts` y `./publicacion.ts`, y ya se
 * prueba ahí, directo, sin React (`test/panel-borrador.test.ts`,
 * `test/panel-publicacion.test.ts`). Acá, sin DOM en el harness (misma
 * razón que documentan `test/panel-app.test.ts`/`test/panel-editor.test.ts`:
 * este proyecto no tiene jsdom/happy-dom), lo que se puede probar es que el
 * primer render —antes de que corra ningún efecto, que en SSR nunca
 * corren— no revienta, y que ninguno de los textos PROPIOS de este
 * componente (los que no vienen de `src/contenido/**` ni del servidor) trae
 * jerga.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Sesion, { PantallaPublicacion, BotonesDeSalida, ListaAvisos } from '@/panel/Sesion'
import { jergaEn } from '@/servidor/estado'
import { VENTANA_DESHACER_MS, type DatosSondeo } from '@/panel/publicacion'

/** Los ocho manejadores de `PantallaPublicacion`/`BotonesDeSalida`: en estas pruebas no importa QUÉ hacen (eso se prueba aparte, en `./panel-publicacion.test.ts` y `./panel-borrador.test.ts`), solo que el componente los reciba y renderice sin ellos tirar. */
function manejadoresDeMentira() {
  return {
    onConfirmar: () => {},
    onCancelar: () => {},
    onReintentarPublicar: () => {},
    onReintentarSondeo: () => {},
    onDeshacer: () => {},
    onSeguirEditando: () => {},
    onVolverTrasDeshacer: () => {},
  }
}

/*
 * Los textos propios de `Sesion.tsx` — ni etiqueta de campo, ni mensaje de
 * esquema (eso ya lo cubre `panel-campos.test.ts`), ni frase del servidor
 * (esas se muestran tal cual, regla de la tarea): sacados a mano del
 * código, mismo criterio que `panel-app.test.ts`/`panel-editor.test.ts`.
 */
const TEXTOS_VISIBLES = [
  'Buscando si tienes cambios guardados en otro aparato…',
  'Encontramos un borrador tuyo en otro aparato.',
  'Abrir ese borrador',
  'Seguir con lo publicado',
  'Reintentar',
  'Guardando tu borrador…',
  'Tu borrador está guardado.',
  'Guardar mis cambios de todos modos',
  'Ver ese borrador',
  'No pudimos preparar la publicación: recarga el panel.',
  'Todavía no cambiaste nada que publicar.',
  'Publicar',
  'Para revisar cuando puedas (esto no bloquea nada):',
  'Ver mi sitio',
  'Deshacer esta publicación',
  'Seguir editando',
  'Revisa lo que vas a publicar',
  'Confirmar y publicar',
  'Cancelar',
  'Volver a editar',
  'Deshaciendo…',
]

describe('Sesion — textos propios', () => {
  it('ninguno usa jerga técnica', () => {
    for (const texto of TEXTOS_VISIBLES) {
      expect(jergaEn(texto), texto).toBeNull()
    }
  })

  it('todos están de verdad en el código fuente (si se reescriben acá sin tocar Sesion.tsx, esto lo nota)', () => {
    const fuente = readFileSync('src/panel/Sesion.tsx', 'utf8')
    for (const texto of TEXTOS_VISIBLES) {
      expect(fuente, `no se encontró «${texto}» en Sesion.tsx`).toContain(texto)
    }
  })
})

describe('Sesion — el primer render no revienta (sin DOM: `renderToStaticMarkup`)', () => {
  it('antes de que corra ningún efecto (SSR nunca los corre), muestra que está buscando un borrador — nunca el editor ni el resultado de una publicación', () => {
    const html = renderToStaticMarkup(createElement(Sesion, { base: 'a'.repeat(40) }))
    expect(html).toContain('Buscando si tienes cambios guardados en otro aparato…')
    expect(html).not.toContain('Publicar')
    expect(html).not.toContain('Revisa lo que vas a publicar')
  })

  it('con `base: null` renderiza igual, sin tirar', () => {
    const html = renderToStaticMarkup(createElement(Sesion, { base: null }))
    expect(html).toContain('Buscando si tienes cambios guardados en otro aparato…')
  })
})

/*
 * ---------------------------------------------------------------------
 * `PantallaPublicacion`/`BotonesDeSalida`/`ListaAvisos`: puramente
 * presentacionales (el `estado` entra por prop, sin `useEffect` ni
 * `fetch`), así que acá SÍ se puede montar de verdad con
 * `renderToStaticMarkup` y afirmar sobre el HTML real — mismo patrón
 * aprobado que usa la Tarea 5 para `Historial`/`PantallaEditando`
 * (`test/panel-historial.test.ts`), no el texto del archivo fuente.
 * ---------------------------------------------------------------------
 */

const datosDeEjemplo: DatosSondeo = { sha: 'a'.repeat(40), publicadoEn: 1_000_000, avisos: [] }

describe('BotonesDeSalida — «Ver mi sitio» (H2, ronda de arreglo)', () => {
  it('el enlace abre en una pestaña NUEVA, con `rel="noopener noreferrer"` — antes navegaba en la misma pestaña y se llevaba puesto el botón «Deshacer» al volver (bfcache roto por `Cache-Control: no-store`)', () => {
    const html = renderToStaticMarkup(
      createElement(BotonesDeSalida, {
        datos: datosDeEjemplo,
        ahora: datosDeEjemplo.publicadoEn,
        onDeshacer: () => {},
        onSeguirEditando: () => {},
      }),
    )
    expect(html).toMatch(/<a[^>]*href="\/\?t=1000000"[^>]*target="_blank"/)
    expect(html).toMatch(/<a[^>]*rel="noopener noreferrer"/)
  })

  it('el botón «Deshacer esta publicación» está a los 30:00.000 exactos', () => {
    const html = renderToStaticMarkup(
      createElement(BotonesDeSalida, {
        datos: datosDeEjemplo,
        ahora: datosDeEjemplo.publicadoEn + VENTANA_DESHACER_MS,
        onDeshacer: () => {},
        onSeguirEditando: () => {},
      }),
    )
    expect(html).toContain('Deshacer esta publicación')
  })

  it('un milisegundo después de los 30 minutos, el botón «Deshacer» YA NO está — desaparece de verdad, no solo en la lógica pura', () => {
    const html = renderToStaticMarkup(
      createElement(BotonesDeSalida, {
        datos: datosDeEjemplo,
        ahora: datosDeEjemplo.publicadoEn + VENTANA_DESHACER_MS + 1,
        onDeshacer: () => {},
        onSeguirEditando: () => {},
      }),
    )
    expect(html).not.toContain('Deshacer esta publicación')
    // El resto de la pantalla sigue con salida: «Ver mi sitio» y «Seguir editando».
    expect(html).toContain('Ver mi sitio')
    expect(html).toContain('Seguir editando')
  })
})

describe('ListaAvisos — no bloquean', () => {
  it('sin avisos: no pinta nada', () => {
    const html = renderToStaticMarkup(createElement(ListaAvisos, { avisos: [] }))
    expect(html).toBe('')
  })

  it('con avisos: título y detalle se ven, nunca con `role="alert"` (no son un error)', () => {
    const html = renderToStaticMarkup(
      createElement(ListaAvisos, {
        avisos: [{ campo: 'sitio.anaquel.titulo', titulo: 'Dice «15 sabores»', detalle: 'Hoy hay 14.' }],
      }),
    )
    expect(html).toContain('Dice «15 sabores»')
    expect(html).toContain('Hoy hay 14.')
    expect(html).not.toContain('role="alert"')
  })
})

describe('PantallaPublicacion — cada fase renderiza con salida', () => {
  it('"revisando": lista los cambios con etiqueta, y los dos botones', () => {
    const html = renderToStaticMarkup(
      createElement(PantallaPublicacion, {
        estado: {
          fase: 'revisando',
          cambios: [{ campo: 'anaquel.titulo', etiqueta: 'Título del anaquel', antes: 'a', despues: 'b', tipo: 'cambio' }],
          fraseCorta: 'cambia 1 texto',
        },
        ahora: 0,
        ...manejadoresDeMentira(),
      }),
    )
    expect(html).toContain('Título del anaquel')
    expect(html).toContain('cambia 1 texto')
    expect(html).toContain('Confirmar y publicar')
    expect(html).toContain('Cancelar')
  })

  it('"error-publicar": el botón dice «Reintentar» — el hallazgo H1 era que, al tocarlo, `alConfirmarPublicar()` salía sin hacer nada; ESE cableado (`puedeConfirmarPublicar`) se prueba en `panel-publicacion.test.ts`, acá solo se confirma que el botón sigue ahí', () => {
    const html = renderToStaticMarkup(
      createElement(PantallaPublicacion, {
        estado: {
          fase: 'error-publicar',
          problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
          cambios: [],
          fraseCorta: 'cambia 1 texto',
        },
        ahora: 0,
        ...manejadoresDeMentira(),
      }),
    )
    expect(html).toContain('Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.')
    expect(html).toContain('Reintentar')
  })

  it('"sondeando"/"terminado": los avisos y los botones de salida están, sea o no `estado: listo` — nunca una pantalla colgada', () => {
    for (const fase of ['sondeando', 'terminado'] as const) {
      const html = renderToStaticMarkup(
        createElement(PantallaPublicacion, {
          estado: {
            fase,
            frase: 'Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.',
            datos: { ...datosDeEjemplo, avisos: [{ campo: 'x', titulo: 'Un aviso' }] },
          },
          ahora: datosDeEjemplo.publicadoEn,
          ...manejadoresDeMentira(),
        }),
      )
      expect(html, fase).toContain('Un aviso')
      expect(html, fase).toContain('Ver mi sitio')
      expect(html, fase).toContain('Deshacer esta publicación')
    }
  })

  it('"deshecho": el resumen del servidor y «Volver a editar»', () => {
    const html = renderToStaticMarkup(
      createElement(PantallaPublicacion, {
        estado: { fase: 'deshecho', resumen: 'Listo, lo dejé como estaba antes.' },
        ahora: 0,
        ...manejadoresDeMentira(),
      }),
    )
    expect(html).toContain('Listo, lo dejé como estaba antes.')
    expect(html).toContain('Volver a editar')
  })
})
