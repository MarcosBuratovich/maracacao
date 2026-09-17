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
import { revierte, TRAILER_REVIERTE } from '../src/servidor/revertir'

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

  it('un commit del panel que no tocó contenido no tiene nada que revertir', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'algo\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: true, sha: null, revirtio: SHA })
  })
})
