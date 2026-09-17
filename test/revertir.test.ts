/*
 * Volver atrás un commit del panel.
 *
 * Es un commit NUEVO con el contenido VIEJO (spec §4.6), nunca un `reset` ni
 * un `force`: la historia no se reescribe. Lo usan dos cosas con la misma
 * mecánica y distinto disparador — la reversión automática cuando el deploy
 * falla, y el botón «Deshacer» de los 30 minutos.
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { fetchFalso, respuestasDeUnaPublicacionDirecta } from './lib/github-falso'
import { cliente } from '../src/servidor/github'
import { revierte, TRAILER_REVIERTE, autorDelCommit } from '../src/servidor/revertir'

const gh = (f: typeof globalThis.fetch) => cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
const SHA = 'a'.repeat(40)

describe('revertir un commit del panel', () => {
  it('se niega si el commit NO es del panel', async () => {
    // Revertir un commit de Marcos desde acá sería que el panel deshaga
    // trabajo que no publicó. Nunca.
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'fix: algo a mano', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'p' }] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'no-es-del-panel', detalle: expect.any(String) })
    expect(pedidos.every((p) => p.metodo === 'GET')).toBe(true)
  })

  it('B8: se niega si el commit ya no es la cabeza', async () => {
    // La cabeza es otro commit cualquiera, sin trailer de reversión: ni
    // «ya-revertido» ni el sha pedido son la cabeza.
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'otraCabeza' } } },
      { cuerpo: { sha: 'otraCabeza', tree: { sha: 't' }, message: 'fix: otra cosa a mano', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'p' }] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect((r as { motivo: string }).motivo).toBe('no-es-la-cabeza')
  })

  it('es idempotente: si la cabeza ya revierte ese sha, no hace nada', async () => {
    // Dos invocaciones de `estado` en paralelo pueden ver el mismo fracaso.
    // Sin esto, las dos revierten y la segunda deshace la reversión de la
    // primera — o sea, vuelve a dejar el commit malo.
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'cabezaQueYaRevirtio' } } },
      {
        cuerpo: {
          sha: 'cabezaQueYaRevirtio',
          tree: { sha: 't' },
          message: `Deshace un cambio\n\nPanel: sí\nPanel-Autor: x\n${TRAILER_REVIERTE}: ${SHA}`,
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: SHA }],
        },
      },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect((r as { motivo: string }).motivo).toBe('ya-revertido')
    expect(pedidos.every((p) => p.metodo === 'GET')).toBe(true)
  })

  it('publica el contenido del padre y marca el commit con el trailer', async () => {
    // «viejo» tiene que ser un `sitio.json` REAL, no un stub chico: ese
    // documento exige sus cinco derivados injertados antes de validar (ver
    // el «Ojo» del paso 5 del brief) y un objeto de dos claves no pasa el
    // esquema aunque esté bien formado — con o sin injertar. Se parte del
    // archivo de disco, con un campo editado, igual que hace el humo de
    // producción.
    const sitioReal = JSON.parse(readFileSync('src/contenido/datos/sitio.json', 'utf8'))
    sitioReal.footer.derechos = 'lo de antes'
    const viejo = JSON.stringify(sitioReal)
    const saboresRealTexto = readFileSync('src/contenido/datos/sabores.json', 'utf8')

    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },                                                         // ref
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'cambia Línea de cierre\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [{ filename: 'src/contenido/datos/sitio.json' }] } },                      // comparaRefs padre..sha
      { cuerpo: { content: Buffer.from(viejo).toString('base64'), encoding: 'base64', sha: 'b' } }, // archivoEnRef en el padre: sitio
      { cuerpo: { content: Buffer.from(saboresRealTexto).toString('base64'), encoding: 'base64', sha: 'c' } }, // archivoEnRef en el padre: sabores, fuente de los derivados de sitio
      ...respuestasDeUnaPublicacionDirecta(),
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r.ok).toBe(true)
    const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
    expect(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8')).toBe(viejo)
    const commit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
    expect((commit.cuerpo as { message: string }).message).toContain(`${TRAILER_REVIERTE}: ${SHA}`)
  })

  // Ronda 2, Grupo D: un commit que no tocó contenido no es un «revertido»
  // silencioso — `main` sigue con el commit roto, y decir `ok: true` le
  // mentía a Marcos («Reversión automática: revertido») sobre un sitio que
  // seguía sirviendo lo malo.
  it('D: un commit del panel que no tocó contenido no tiene nada que revertir — no es un éxito', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'algo\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'nada-que-revertir', detalle: expect.any(String) })
  })

  // Ronda 2, Grupo A: la guardia de «no revertir una reversión» vive ADENTRO
  // de `revierte()`, no solo en quien llama. Medido en la revisión: sin esto,
  // revertir la cabeza de una reversión republica el contenido MALO en un
  // commit nuevo que además lleva su propio `Panel-Revierte:` — y como ya
  // «es una reversión», la red de seguridad nunca lo vuelve a tocar.
  it('A: no revierte una reversión, aunque sea del panel y sea la cabeza', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      {
        cuerpo: {
          sha: SHA,
          tree: { sha: 't' },
          message: `Deshace un cambio\n\nPanel: sí\nPanel-Autor: x\n${TRAILER_REVIERTE}: otroShaCualquiera`,
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'padre' }],
        },
      },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'ya-revertido', detalle: expect.any(String) })
    expect(pedidos.every((p) => p.metodo === 'GET')).toBe(true)
  })

  // Ronda 2, Grupo E: si el PATCH choca (alguien más publicó justo en el
  // medio), `revierte()` no reintenta — el reintento de `publica()` rearma el
  // árbol SOBRE el commit que ganó la carrera, pero con los bytes VIEJOS de
  // esta reversión: si ese commit es de Marcos, desaparece sin 409 y sin log.
  it('E: si el PATCH choca, no reintenta — se rinde para no comerse un commit ajeno', async () => {
    const fichasReales = readFileSync('src/contenido/datos/fichas.json', 'utf8')
    const choque = { status: 422, cuerpo: { message: 'Update is not a fast forward' } }
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } }, // ref
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'cambia algo\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } }, // commit
      { cuerpo: { files: [{ filename: 'src/contenido/datos/fichas.json' }] } }, // comparaRefs
      { cuerpo: { content: Buffer.from(fichasReales).toString('base64'), encoding: 'base64' } }, // archivoEnRef del padre
      // adentro de publica(), UN solo intento — sin reintento:
      { cuerpo: { object: { sha: 'main-x' } } }, // gh.ref
      { cuerpo: { sha: 'c', tree: { sha: 'a' } } }, // gh.commit
      { cuerpo: { sha: 'blob-1' } }, // creaBlob
      { cuerpo: { sha: 'arbol-1' } }, // creaArbol
      { cuerpo: { sha: 'commit-1' } }, // creaCommit
      choque, // el PATCH choca — y se termina ACÁ, sin un segundo intento
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'no-es-la-cabeza', detalle: expect.any(String) })
    expect(pedidos.filter((p) => p.metodo === 'PATCH')).toHaveLength(1)
  })

  // Ronda 2, F-3: un contenido viejo que no es JSON válido no puede tirar —
  // el tipo de `revierte()` promete `{ ok: false }`, no una excepción.
  it('F3: un contenido viejo que no es JSON válido no revienta — devuelve falló', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'algo\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [{ filename: 'src/contenido/datos/fichas.json' }] } },
      { cuerpo: { content: Buffer.from('esto no es JSON {{{').toString('base64'), encoding: 'base64' } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'falló', detalle: expect.any(String) })
  })

  // Ronda 2, F-4: los trailers se anclan por LÍNEA, no como substring en
  // cualquier lado del mensaje. Un commit a mano que simplemente MENCIONE
  // «Panel: sí» —en un párrafo, citando lo que decía otro commit— no puede
  // colarse como si fuera del panel.
  it('F4: mencionar «Panel: sí» en el cuerpo del mensaje no alcanza — no es una línea de trailer', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      {
        cuerpo: {
          sha: SHA,
          tree: { sha: 't' },
          message: 'fix: revierto a mano lo que decía "Panel: sí" en el commit anterior',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'p' }],
        },
      },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'no-es-del-panel', detalle: expect.any(String) })
  })

  // Ronda 3, Grupo 5: el caso NO es «hoy inalcanzable» — desde que los
  // trailers se anclan por línea (F-4), un commit escrito a mano cuyo cuerpo
  // contenga la línea «Panel: sí» (copiar el mensaje de un commit del panel,
  // un cherry-pick) pasa la guardia de `revisaLaCabeza()` sin traer
  // `Panel-Autor:`. `autorDelCommit` es pura y exportada: el test sale gratis.
  it('autorDelCommit(): un mensaje con «Panel: sí» pero sin `Panel-Autor:` no tiene autor', () => {
    expect(autorDelCommit('cambia algo\n\nPanel: sí')).toBeUndefined()
  })
})
