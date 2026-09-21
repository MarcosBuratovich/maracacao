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
import Sesion from '@/panel/Sesion'
import { jergaEn } from '@/servidor/estado'

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
