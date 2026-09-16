/*
 * Una publicación es UN commit. Los tests recorren el camino entero con un
 * GitHub de mentira y verifican la secuencia, porque el modo de falla que
 * importa no es «no publicó» sino «publicó a medias»: dos JSON escritos y el
 * tercero no, con el sitio en un estado que nadie escribió nunca.
 */
import { describe, it, expect } from 'vitest'
import { cliente } from '../src/servidor/github'
import { publica } from '../src/servidor/publicar'
import { fetchFalso } from './lib/github-falso'

describe('publicar', () => {
  it('hace blobs, árbol, commit y mueve el ref, en ese orden', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main-viejo' } } },   // ref
      { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // commit padre
      { cuerpo: { sha: 'blob-nuevo' } },               // blob
      { cuerpo: { sha: 'arbol-nuevo' } },              // tree
      { cuerpo: { sha: 'commit-nuevo' } },             // commit
      { cuerpo: {} },                                  // patch ref
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'clienta@ejemplo.mx',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sha).toBe('commit-nuevo')
    expect(pedidos.map((p) => p.metodo)).toEqual(['GET', 'GET', 'POST', 'POST', 'POST', 'PATCH'])
  })

  it('el commit lleva el autor del panel y el trailer con quién publicó', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } }, { cuerpo: {} },
    ])
    await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'clienta@ejemplo.mx',
    })
    const commit = pedidos[4].cuerpo as { message: string; author: { name: string; email: string } }
    expect(commit.author).toEqual({ name: 'Panel Maracacao', email: 'panel@maracacao.mx' })
    expect(commit.message).toContain('Panel: sí')
    expect(commit.message).toContain('Panel-Autor: clienta@ejemplo.mx')
  })

  it('si el ref se movió mientras tanto, reintenta UNA vez', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main-1' } } }, { cuerpo: { sha: 'c1', tree: { sha: 'a1' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } },
      { status: 422, cuerpo: { message: 'Update is not a fast forward' } },  // el PATCH falla
      { cuerpo: { object: { sha: 'main-2' } } }, { cuerpo: { sha: 'c3', tree: { sha: 'a3' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a4' } }, { cuerpo: { sha: 'c4' } }, { cuerpo: {} },
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'x@y.mx',
    })
    expect(r.ok).toBe(true)
    expect(pedidos.filter((p) => p.metodo === 'PATCH')).toHaveLength(2)
  })

  it('si el segundo intento también choca, es 409 y se lo dice en castellano', async () => {
    const choque = { status: 422, cuerpo: { message: 'Update is not a fast forward' } }
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'm' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } }, choque,
      { cuerpo: { object: { sha: 'm2' } } }, { cuerpo: { sha: 'c3', tree: { sha: 'a3' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a4' } }, { cuerpo: { sha: 'c4' } }, choque,
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe(409)
      expect(r.problema).toMatch(/Marcos/)          // le dice quién tocó el sitio
      expect(r.problema).not.toMatch(/fast forward|422|ref/i)
    }
  })

  it('una ruta prohibida no llega ni al primer pedido', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: {} }])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: '.github/workflows/verifica.yml', contenido: 'malo' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('si GitHub se cae a mitad, no queda medio publicado: el ref no se movió', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'm' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { status: 502, cuerpo: { message: 'Bad gateway' } },
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe(502)
    expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(false)
  })

  // Ruling 6 (controller, más allá del brief): si el asunto que arma
  // frase() sobre los `cambios` que trae la publicación viene vacío —no
  // hubo ediciones—, no se crea un commit vacío. No gasta ni un pedido:
  // es una revisión local, igual que la lista blanca.
  it('sin cambios que contar, no publica un commit vacío ni toca GitHub', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: {} }])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'clienta@ejemplo.mx',
      cambios: [],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.sha).toBeNull()
      expect(r.resumen).not.toBe('')
    }
    expect(pedidos).toHaveLength(0)
  })
})
