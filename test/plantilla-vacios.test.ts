/*
 * Los dos arreglos de index.astro:448 y :538 (fase 2 del panel)
 * son sobre un caso que HOY no puede ocurrir —`texto()` rechaza el string
 * vacío tras trim, y `precioONada()` da `null`, nunca `undefined`— pero que
 * el panel de la fase 6 puede llegar a provocar: guardar '' al vaciar un
 * campo opcional, o dejar un precio en `undefined` en vez de `null`.
 *
 * La versión anterior de este test re-tipeaba las expresiones de la
 * plantilla adentro del test (`Boolean(r.chipPolvo)`, `t.precio == null`
 * sueltos): eso prueba una COPIA, no la plantilla — si alguien revierte
 * `index.astro`, ese test seguía verde. Acá se renderiza la página real
 * (`experimental_AstroContainer`, igual que `sitio.test.ts`) con un
 * `marca` mockeado que fuerza los dos casos, así que un revert de
 * `index.astro:448` o `:538` sí se ve.
 */
import { describe, it, expect, vi } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'

vi.mock('@/copy/sitio-marca', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/copy/sitio-marca')>()
  // Clon profundo: jamás se muta el módulo real, que otros tests (import
  // no mockeado en otros archivos) siguen leyendo tal cual.
  const marca = structuredClone(actual.marca)

  // Caso 1: una receta que HOY no tiene la clave `chipPolvo` pasa a
  // tenerla con string vacío. La de índice 0 no trae chip (solo la de
  // cardamomo lo trae) — así queda una receta con chip real Y una con
  // chip vacío en los mismos datos, que es lo que hace falta para el
  // conteo del primer `it`.
  const idxSinChip = marca.recetas.lista.findIndex((r) => !r.chipPolvo)
  if (idxSinChip === -1) throw new Error('mock: no hay receta sin chipPolvo para vaciar')
  marca.recetas.lista[idxSinChip] = { ...marca.recetas.lista[idxSinChip], chipPolvo: '' }

  // Caso 2: una pestaña de negocios con precio numérico pasa a
  // `undefined` (no `null`) — el camino que `t.precio === null` no cubre.
  const idxConPrecio = marca.negocios.tabs.findIndex((t) => typeof t.precio === 'number')
  if (idxConPrecio === -1) throw new Error('mock: no hay pestaña con precio numérico')
  // `precio` es `number | null` en el esquema —nunca `undefined`— así que
  // acá hace falta el `as unknown as`: el mock simula justo el estado que
  // el tipo de hoy prohíbe pero que el panel de la fase 6 podría escribir.
  marca.negocios.tabs[idxConPrecio] = {
    ...marca.negocios.tabs[idxConPrecio],
    precio: undefined as unknown as number | null,
  }

  return { ...actual, marca }
})

import Borrador from '@/pages/index.astro'
import { marca } from '@/copy/sitio-marca'

const container = await AstroContainer.create()

describe('la plantilla ante vacíos que el panel puede provocar', () => {
  it('el chip vacío no renderiza la cajita, y las recetas con chip siguen mostrando el suyo', async () => {
    const html = await container.renderToString(Borrador)
    // index.astro:448 — con la vieja `'chipPolvo' in r`, la receta que en
    // este mock tiene `chipPolvo: ''` renderizaría una cajita amarilla
    // vacía de 6×10 px con 12 px de margen, y como las cuatro tarjetas de
    // receta se estiran a la más alta, crecerían las cuatro. Con
    // `r.chipPolvo &&` (el arreglo), un '' es falsy y no imprime el <p>.
    expect(html).not.toMatch(/<p class="mono receta-chip"(?:\s[^>]*)?><\/p>/)

    // Las recetas que sí tienen contenido en `chipPolvo` (calculado del
    // propio mock, no un número hardcodeado) siguen mostrando su cajita.
    const conChip = marca.recetas.lista.filter((r) => r.chipPolvo)
    const cajitas = html.match(/<p class="mono receta-chip"(?:\s[^>]*)?>[^<]+<\/p>/g) ?? []
    expect(cajitas).toHaveLength(conChip.length)
  })

  it('un precio ausente (undefined) no renderiza $NaN, y la nota del precio sigue ahí', async () => {
    const html = await container.renderToString(Borrador)
    // index.astro:538 — con la vieja `t.precio === null`, un `undefined`
    // no matchea el `null` estricto, cae al `else` y arma
    // `${t.precioNota} ${precioMXN(t.precio)}`: `precioMXN(undefined)`
    // imprime «$NaN». Con `t.precio == null` (el arreglo), `undefined`
    // también cubre y muestra solo `precioNota`.
    expect(html).not.toContain('NaN')

    const tab = marca.negocios.tabs.find((t) => typeof t.precio === 'undefined')
    expect(tab).toBeDefined()
    expect(html).toContain(tab!.precioNota)
  })
})
