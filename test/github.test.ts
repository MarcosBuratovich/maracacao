/*
 * El cliente de la Git Data API. Recibe `fetch` por parámetro: estos tests le
 * pasan uno de mentira y revisan el pedido que arma. Nunca sale a la red, y no
 * hace falta ningún token para correrlos.
 */
import { describe, it, expect } from 'vitest'
import { cliente } from '../src/servidor/github'
import { fetchFalso } from './lib/github-falso'

const creds = (f: typeof globalThis.fetch) => ({
  token: 'token-de-prueba', duenio: 'MarcosBuratovich', repo: 'maracacao', fetch: f,
})

describe('el cliente de GitHub', () => {
  it('manda el token y la versión de la API en cada pedido', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { object: { sha: 'abc' } } }])
    await cliente(creds(f)).ref('heads/main')
    expect(pedidos[0].cabeceras.Authorization).toBe('Bearer token-de-prueba')
    expect(pedidos[0].cabeceras['X-GitHub-Api-Version']).toBeTruthy()
    expect(pedidos[0].url).toContain('/repos/MarcosBuratovich/maracacao/git/ref/heads/main')
  })

  it('lee el archivo de un ref por su ruta, con la API de Contents', async () => {
    const contenido = '{"hola":"mundo"}'
    const { f, pedidos } = fetchFalso([
      { cuerpo: { content: Buffer.from(contenido).toString('base64'), encoding: 'base64' } },
    ])
    const texto = await cliente(creds(f)).archivoEnRef('src/contenido/datos/sitio.json', 'abc123')
    expect(texto).toBe(contenido)
    expect(pedidos[0].url).toContain('/repos/MarcosBuratovich/maracacao/contents/src/contenido/datos/sitio.json')
    expect(pedidos[0].url).toContain('ref=abc123')
  })

  it('crea un blob con el contenido en base64', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { sha: 'blob1' } }])
    const sha = await cliente(creds(f)).creaBlob('hola')
    expect(sha).toBe('blob1')
    expect(pedidos[0].metodo).toBe('POST')
    expect(pedidos[0].cuerpo).toEqual({ content: Buffer.from('hola').toString('base64'), encoding: 'base64' })
  })

  it('un borrado viaja como sha null, que es como la API borra', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { sha: 'arbol1' } }])
    await cliente(creds(f)).creaArbol('base', [{ path: 'a.json', sha: null }])
    const cuerpo = pedidos[0].cuerpo as { tree: Array<Record<string, unknown>> }
    expect(cuerpo.tree[0]).toMatchObject({ path: 'a.json', sha: null, mode: '100644', type: 'blob' })
  })

  it('mueve el ref sin forzar, salvo que se lo pidan', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: {} }, { cuerpo: {} }])
    const c = cliente(creds(f))
    await c.mueveRef('heads/main', 'nuevo')
    expect(pedidos[0].cuerpo).toEqual({ sha: 'nuevo', force: false })
    await c.mueveRef('heads/main', 'nuevo', true)
    expect(pedidos[1].cuerpo).toEqual({ sha: 'nuevo', force: true })
  })

  it('un error de GitHub llega como excepción con el status adentro', async () => {
    const { f } = fetchFalso([{ status: 422, cuerpo: { message: 'Update is not a fast forward' } }])
    await expect(cliente(creds(f)).mueveRef('heads/main', 'x')).rejects.toThrow(/422/)
  })

  it('el error trae el mensaje de GitHub, que es lo que Marcos necesita en el log', async () => {
    const { f } = fetchFalso([{ status: 409, cuerpo: { message: 'Conflicto raro' } }])
    await expect(cliente(creds(f)).ref('heads/main')).rejects.toThrow(/Conflicto raro/)
  })
})
