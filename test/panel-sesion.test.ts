/*
 * `src/panel/Sesion.tsx` (Tarea 3, fase 6): la pantalla del borrador —
 * autoguardado y el conflicto con otro aparato. La Tarea 4 (publicar,
 * saber, deshacer) se suma acá mismo en el próximo commit, porque comparte
 * esta pantalla.
 *
 * Toda la lógica de VERDAD —las transiciones de estado, el auto-guardado—
 * vive en `./borrador.ts` y ya se prueba ahí, directo, sin React
 * (`test/panel-borrador.test.ts`). Acá, sin DOM en el harness (misma razón
 * que documentan `test/panel-app.test.ts`/`test/panel-editor.test.ts`: este
 * proyecto no tiene jsdom/happy-dom), lo que se puede probar es que el
 * primer render —antes de que corra ningún efecto, que en SSR nunca
 * corren— no revienta, y que ninguno de los textos PROPIOS de este
 * componente (los que no vienen de `src/contenido/**` ni del servidor)
 * trae jerga.
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
  it('antes de que corra ningún efecto (SSR nunca los corre), muestra que está buscando un borrador — nunca el editor', () => {
    const html = renderToStaticMarkup(createElement(Sesion, { base: 'a'.repeat(40) }))
    expect(html).toBe('<p class="panel-aviso" role="status">Buscando si tienes cambios guardados en otro aparato…</p>')
  })

  it('con `base: null` renderiza igual, sin tirar', () => {
    const html = renderToStaticMarkup(createElement(Sesion, { base: null }))
    expect(html).toContain('Buscando si tienes cambios guardados en otro aparato…')
  })
})
