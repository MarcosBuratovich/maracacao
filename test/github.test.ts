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

  it('M-8: un archivo grande viene con encoding "none" y se resuelve pidiendo el blob', async () => {
    // La API de Contents, para un archivo de entre 1 MB y 100 MB, contesta 200
    // con el contenido VACÍO y `encoding: "none"`. Sin este camino, el llamador
    // recibe '' —no un error— y cree que el archivo está vacío.
    const { f, pedidos } = fetchFalso([
      { cuerpo: { content: '', encoding: 'none', sha: 'blob123' } },
      { cuerpo: { content: Buffer.from('contenido grande').toString('base64'), encoding: 'base64' } },
    ])
    const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

    expect(await gh.archivoEnRef('public/sitio/marca/barra-canela.webp', 'abc')).toBe('contenido grande')
    expect(pedidos[1].url).toContain('/git/blobs/blob123')
  })

  it('M-8: un archivo chico sigue resolviéndose con UN solo pedido', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { content: Buffer.from('{"a":1}').toString('base64'), encoding: 'base64', sha: 'blobchico' } },
    ])
    const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

    expect(await gh.archivoEnRef('src/contenido/datos/sitio.json', 'abc')).toBe('{"a":1}')
    expect(pedidos).toHaveLength(1)
  })

  // M-7: hoy toda ruta que llega acá es una constante o ya pasó por la
  // lista blanca, así que esto no cambia nada en producción — existe para
  // la Parte B, donde las rutas de imagen van a llegar armadas con lo que
  // la clienta haya escrito. Un segmento con un espacio o un `#` sin
  // codificar rompería la URL (o, peor, la haría apuntar a otro recurso)
  // antes de que la lista blanca llegara a rechazarlo.
  it('M-7: codifica cada segmento de la ruta, sin tocar las barras que los separan', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64' } },
    ])
    await cliente(creds(f)).archivoEnRef('public/sitio/marca/barra con espacio #1.webp', 'abc123')
    // Cada segmento va codificado (el espacio y el «#» no viajan crudos),
    // pero las barras que separan `public`/`sitio`/`marca`/… siguen
    // siendo barras: la ruta sigue teniendo la misma forma de niveles.
    expect(pedidos[0].url).toContain(
      '/contents/public/sitio/marca/' + encodeURIComponent('barra con espacio #1.webp'),
    )
    expect(pedidos[0].url).not.toContain('barra con espacio #1.webp')
  })

  it('M-7: ref() también codifica su nombre por segmento', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { object: { sha: 'x' } } }])
    await cliente(creds(f)).ref('heads/una rama#rara')
    expect(pedidos[0].url).toContain('/git/ref/heads/' + encodeURIComponent('una rama#rara'))
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

  it('comparaRefs devuelve las rutas que cambiaron entre dos shas', async () => {
    const { f, pedidos } = fetchFalso([
      {
        cuerpo: {
          files: [
            { filename: 'src/contenido/datos/sitio.json', status: 'modified' },
            { filename: 'src/pages/index.astro', status: 'modified' },
          ],
        },
      },
    ])
    const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

    expect(await gh.comparaRefs('viejo', 'nuevo')).toEqual({
      archivos: ['src/contenido/datos/sitio.json', 'src/pages/index.astro'],
    })
    expect(pedidos[0].url).toContain('/compare/viejo...nuevo')
  })

  it('comparaRefs no explota si GitHub no manda `files`', async () => {
    // La comparación de dos shas idénticos viene sin la clave.
    const { f } = fetchFalso([{ cuerpo: { status: 'identical' } }])
    const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
    expect(await gh.comparaRefs('a', 'a')).toEqual({ archivos: [] })
  })
})
