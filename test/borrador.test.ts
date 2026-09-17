/*
 * El borrador del servidor (Tarea 11, spec §4.3 capa 2): sobrevive a
 * cambiar de aparato, y avisa si otro aparato ya guardó algo más nuevo.
 *
 * [Nota de implementación] El brief de esta tarea ilustra el diseño con
 * `respuestasDeUnaPublicacionCompleta()`/`respuestasDeUnBlobYUnArbol()`
 * reusados tal cual; acá se arman las respuestas a mano —o con
 * `respuestasDeUnaPublicacionDirecta()`/`respuestasDeUnBlobArbolYCommit()`,
 * de `test/lib/github-falso.ts`— porque la implementación elegida hace un
 * COMMIT real (con padre vacío) para el primer borrador, no un árbol suelto
 * sin commit: así el ref del borrador SIEMPRE apunta a un commit, y los
 * guardados de ahí en más —incluido el primero, una vez creado— reusan
 * `publica()` entero (un commit, o ninguno) en vez de repetir esa mecánica
 * a mano. Ver el docstring de `guarda()` en `src/servidor/borrador.ts`.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso, respuestasDeUnaPublicacionDirecta, respuestasDeUnBlobArbolYCommit } from './lib/github-falso'
import { cliente } from '../src/servidor/github'
import { guarda, leeBorrador, RUTA_BORRADOR, REF_BORRADOR } from '../src/servidor/borrador'

const gh = (f: typeof globalThis.fetch) => cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
const UN_BORRADOR = {
  documentos: { sitio: { footer: { derechos: 'a medio escribir' } } },
  base: 'a'.repeat(40),
  dispositivo: 'celu',
  autor: 'ella@ejemplo.mx',
}

describe('el borrador del servidor', () => {
  it('guarda quién lo escribió, desde qué aparato, de qué versión partió y cuándo', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } }, // gh.ref: el ref del borrador ya existe
      { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64', sha: 'b' } }, // el borrador que hay ahí, para el chequeo de conflicto
      ...respuestasDeUnaPublicacionDirecta(), // ya existe: guarda() escribe vía publica()
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1_700_000_000_000 })
    expect(r.ok).toBe(true)

    const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
    const escrito = JSON.parse(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8'))
    expect(escrito).toEqual({
      documentos: UN_BORRADOR.documentos,
      base: UN_BORRADOR.base,
      dispositivo: 'celu',
      autor: 'ella@ejemplo.mx',
      hora: 1_700_000_000_000,
    })
  })

  it('la primera vez CREA el ref con un commit raíz, sin padre', async () => {
    // El ref no existe hasta que alguien guarda por primera vez. Sin este
    // camino, el primer borrador de la vida del panel muere con un 404 que
    // no le dice nada a nadie — y es el primer borrador, o sea el peor
    // momento para eso.
    const { f, pedidos } = fetchFalso([
      { status: 404, cuerpo: { message: 'Not Found' } }, // el ref todavía no existe
      ...respuestasDeUnBlobArbolYCommit(),
      { cuerpo: { ref: `refs/${REF_BORRADOR}` } }, // POST /git/refs: recién ahí se CREA
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1 })
    expect(r.ok).toBe(true)

    const creado = pedidos.find((p) => p.url.endsWith('/git/refs') && p.metodo === 'POST')!
    expect((creado.cuerpo as { ref: string; sha: string }).ref).toBe(`refs/${REF_BORRADOR}`)

    const arbol = pedidos.find((p) => p.url.endsWith('/git/trees') && p.metodo === 'POST')!
    // Sobre el árbol VACÍO, nunca sobre el de `main`: el árbol del borrador
    // lleva SOLO su propio archivo.
    expect((arbol.cuerpo as { base_tree: string }).base_tree).toBe('4b825dc642cb6eb9a060e54bf8d69288fbee4904')

    const commit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
    // Raíz: sin padre, porque no hay ningún commit propio del que descender.
    expect((commit.cuerpo as { parents: string[] }).parents).toEqual([])
  })

  it('leer sin ref devuelve «no hay borrador», no un error', async () => {
    // Es el estado normal de un panel recién estrenado. Si esto tirara, la
    // primera pantalla que ella ve en su vida sería un error.
    const { f } = fetchFalso([{ status: 404, cuerpo: { message: 'Not Found' } }])
    expect(await leeBorrador(gh(f))).toBeNull()
  })

  it('escribe en SU ruta y en SU ref, nunca en los del sitio', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64', sha: 'b' } },
      ...respuestasDeUnaPublicacionDirecta(),
    ])
    await guarda(gh(f), { ...UN_BORRADOR, ahora: 1 })
    const arbol = pedidos.find((p) => p.url.endsWith('/git/trees') && p.metodo === 'POST')!
    expect((arbol.cuerpo as { tree: Array<{ path: string }> }).tree.map((e) => e.path)).toEqual([RUTA_BORRADOR])
    const patch = pedidos.find((p) => p.metodo === 'PATCH')!
    expect(patch.url).toContain(`/git/refs/${REF_BORRADOR}`)
    expect((patch.cuerpo as { force: boolean }).force).toBe(true)
  })

  it('no pisa un borrador más nuevo de OTRO aparato salvo que se lo pidan', async () => {
    // Mismo bug que la Tarea 2 arregla para publicar, un nivel más abajo: dos
    // aparatos editando a la vez se borran el trabajo en silencio. Acá el
    // costo es menor (es un borrador) pero el silencio es el mismo.
    const yaGuardado = JSON.stringify({ ...UN_BORRADOR, dispositivo: 'la-compu', hora: 2_000 })
    const respuestas = [
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
    ]

    const { f } = fetchFalso([...respuestas])
    const r = await guarda(gh(f), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000 })
    expect(r).toEqual({ ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'la-compu', hora: 2_000 } })

    // Con `pisar` explícito, sí.
    const { f: f2 } = fetchFalso([...respuestas, ...respuestasDeUnaPublicacionDirecta()])
    expect((await guarda(gh(f2), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000, pisar: true })).ok).toBe(true)
  })

  it('un borrador del MISMO dispositivo nunca se rechaza a sí mismo', async () => {
    // La autoguardada tecla-tras-tecla de la fase 6 es del mismo aparato que
    // el borrador que ya está ahí: no es un conflicto entre dos personas,
    // es la misma persona un instante después.
    const yaGuardado = JSON.stringify({ ...UN_BORRADOR, dispositivo: 'celu', hora: 5_000 })
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
      ...respuestasDeUnaPublicacionDirecta(),
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000 })
    expect(r.ok).toBe(true)
  })
})
