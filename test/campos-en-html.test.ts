/*
 * Unidad de `test/lib/campos-en-html.ts`: acá viven las pruebas de
 * `coincideConPatron()` sola, sin `dist/` de por medio.
 *
 * `test/panel.test.ts` prueba el todo (esquema + HTML construido); este
 * archivo prueba la pieza que hace el emparejamiento, con los dos casos
 * mixtos que el colapso ciego de números no distinguía: una tupla adentro
 * de una lista (`fichas[].meta[].0`) y una lista adentro de una tupla
 * (`negocios.tabs.0.datos[]`).
 */
import { describe, it, expect } from 'vitest'
import { coincideConPatron } from './lib/campos-en-html'

describe('coincideConPatron()', () => {
  it('tupla adentro de lista: el índice de la tupla tiene que coincidir', () => {
    expect(coincideConPatron('fichas.2.meta.0.1', 'fichas[].meta[].1')).toBe(true)
    expect(coincideConPatron('fichas.2.meta.0.0', 'fichas[].meta[].1')).toBe(false)
  })

  it('lista adentro de tupla: el índice de la tupla tiene que coincidir', () => {
    expect(coincideConPatron('negocios.tabs.0.datos.2', 'negocios.tabs.0.datos[]')).toBe(true)
    expect(coincideConPatron('negocios.tabs.1.datos.2', 'negocios.tabs.0.datos[]')).toBe(false)
  })

  it('tabla (`[][]`, dos índices) adentro de dos listas', () => {
    expect(
      coincideConPatron(
        'fichas.0.secciones.1.bloques.2.filas.3.4',
        'fichas[].secciones[].bloques[].filas[][]',
      ),
    ).toBe(true)
  })

  it('sin índices: la ruta tiene que ser idéntica', () => {
    expect(coincideConPatron('hero.titular.1', 'hero.titular.1')).toBe(true)
    expect(coincideConPatron('hero.titular.2', 'hero.titular.1')).toBe(false)
  })

  it('un desajuste de longitud, en cualquier dirección, no coincide', () => {
    // La concreta trae un segmento de más: el patrón termina antes.
    expect(coincideConPatron('hero.titular.1.extra', 'hero.titular.1')).toBe(false)
    // La concreta trae un segmento de menos: al patrón le falta con qué seguir.
    expect(coincideConPatron('hero.titular', 'hero.titular.1')).toBe(false)
  })
})
