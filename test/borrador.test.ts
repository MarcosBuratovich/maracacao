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
import { ASUNTO_GENERICO } from '../src/servidor/publicar'
import { TOPE_CUERPO } from '../src/servidor/rutas-permitidas'

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
    // [Ronda 1, hallazgo E1] SIN `base_tree`: es la forma documentada de la
    // Git Data API para «un árbol de cero», nunca sobre el de `main` —el
    // árbol del borrador lleva SOLO su propio archivo—, y nunca un sha
    // mágico que ningún mock podría verificar contra la API real.
    expect(Object.keys(arbol.cuerpo as object)).not.toContain('base_tree')
    expect((arbol.cuerpo as { tree: Array<{ path: string }> }).tree.map((e) => e.path)).toEqual([RUTA_BORRADOR])

    const commit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
    // Raíz: sin padre, porque no hay ningún commit propio del que descender
    // —y, sobre todo, ningún ancestro común con `main`: es lo que hace que
    // `git merge` se niegue en seco a mezclar este ref con `main`.
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

  // [Ronda 1, hallazgo E4] Antes era `>`: dos guardados del mismo
  // milisegundo desde aparatos DISTINTOS pasaban el chequeo igual, y el
  // segundo pisaba al primero sin avisar. Con `>=`, empatar también cuenta
  // como pisada.
  it('E4: un empate exacto de milisegundo entre DOS aparatos también bloquea, no solo lo estrictamente más nuevo', async () => {
    const yaGuardado = JSON.stringify({ ...UN_BORRADOR, dispositivo: 'la-compu', hora: 1_000 })
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000 })
    expect(r).toEqual({ ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'la-compu', hora: 1_000 } })
  })

  describe('E5: un borrador que no se puede leer nunca bloquea — mejor escribir que dejarla sin poder guardar más', () => {
    it('un borrador guardado SIN `hora` no bloquea (el trato es el correcto, y queda declarado con test)', async () => {
      // JSON válido, pero de otro aparato y sin `hora`: `undefined >= ahora`
      // es `false` en JavaScript, así que este guardado tiene que pasar. Sin
      // este test, ese comportamiento es un accidente del operador, no una
      // decisión.
      const sinHora = JSON.stringify({ documentos: {}, base: 'x', dispositivo: 'la-compu', autor: 'otra@x.mx' })
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from(sinHora).toString('base64'), encoding: 'base64', sha: 'b' } },
        ...respuestasDeUnaPublicacionDirecta(),
      ])
      const r = await guarda(gh(f), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000 })
      expect(r.ok).toBe(true)
    })

    it('B: un borrador con el JSON roto no bloquea, y el ref se MUEVE, no se intenta crear de nuevo', async () => {
      // Antes de este arreglo, un 404 y un JSON roto se leían igual —«no hay
      // borrador»— así que guarda() intentaba CREAR un ref que YA existe, y
      // GitHub contestaba «Reference already exists»: el panel quedaba en un
      // 502 permanente, porque para escribir un borrador nuevo hacía falta
      // leer el roto primero, y leerlo era justo lo que fallaba.
      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from('esto no es JSON{{{').toString('base64'), encoding: 'base64', sha: 'b' } },
        ...respuestasDeUnaPublicacionDirecta(), // MOVER, no crear: sin este camino, tiraría "Reference already exists"
      ])
      const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1_000 })
      expect(r.ok).toBe(true)
      // Ningún POST /git/refs (crear): todo pasa por publica(), que MUEVE con PATCH.
      expect(pedidos.some((p) => p.url.endsWith('/git/refs') && p.metodo === 'POST')).toBe(false)
      expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(true)
    })

    it('B: leeBorrador() con el JSON roto devuelve null, no tira', async () => {
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from('{ roto').toString('base64'), encoding: 'base64', sha: 'b' } },
      ])
      expect(await leeBorrador(gh(f))).toBeNull()
    })

    it('B: el ref existe pero perdió su archivo (404 en archivoEnRef) — se trata igual, MUEVE en vez de crear', async () => {
      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { status: 404, cuerpo: { message: 'Not Found' } }, // el ref existe, pero panel/borrador.json no está
        ...respuestasDeUnaPublicacionDirecta(),
      ])
      const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1_000 })
      expect(r.ok).toBe(true)
      expect(pedidos.some((p) => p.url.endsWith('/git/refs') && p.metodo === 'POST')).toBe(false)
    })
  })

  // [Ronda 2, hallazgo 1] `JSON.parse` no falla con `null`, `[]`, `42` ni
  // `"hola"` —los cuatro son JSON válido— así que un `try/catch` alrededor
  // de `JSON.parse` (lo que había hasta la Ronda 1) NO alcanza para B: hacía
  // falta además mirar la FORMA de lo que salió. El caso grave era `null`:
  // sin este chequeo, `guarda()` reventaba leyendo `null.dispositivo` (un
  // TypeError, no un 502 franco) y `leeBorrador()` le mentía a la fase 6
  // diciendo «no hay borrador» — sin salida por la interfaz, que es
  // exactamente lo que el tipo de tres estados de B vino a evitar.
  describe('Ronda 2, hallazgo 1: JSON.parse no valida FORMA — null, [], 42, "hola" y true son JSON válido pero no un Borrador', () => {
    const CASOS_SIN_FORMA = ['null', '[]', '42', '"hola"', 'true']

    it('leeBorrador() da null para los cinco casos, nunca un borrador de forma rara que la fase 6 crea de confianza', async () => {
      for (const contenido of CASOS_SIN_FORMA) {
        const { f } = fetchFalso([
          { cuerpo: { object: { sha: 'refViejo' } } },
          { cuerpo: { content: Buffer.from(contenido).toString('base64'), encoding: 'base64', sha: 'b' } },
        ])
        expect(await leeBorrador(gh(f)), contenido).toBeNull()
      }
    })

    it('guarda() con cualquiera de los cinco MUEVE el ref — nunca intenta crear uno que ya existe', async () => {
      for (const contenido of CASOS_SIN_FORMA) {
        const { f, pedidos } = fetchFalso([
          { cuerpo: { object: { sha: 'refViejo' } } },
          { cuerpo: { content: Buffer.from(contenido).toString('base64'), encoding: 'base64', sha: 'b' } },
          ...respuestasDeUnaPublicacionDirecta(),
        ])
        const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1_000 })
        expect(r.ok, contenido).toBe(true)
        expect(pedidos.some((p) => p.url.endsWith('/git/refs') && p.metodo === 'POST'), contenido).toBe(false)
      }
    })

    it('el caso grave: `null` ya no deja "sin salida" — guarda() no revienta leyendo `null.dispositivo`', async () => {
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from('null').toString('base64'), encoding: 'base64', sha: 'b' } },
        ...respuestasDeUnaPublicacionDirecta(),
      ])
      await expect(guarda(gh(f), { ...UN_BORRADOR, ahora: 1_000 })).resolves.toEqual({ ok: true })
    })
  })

  // [Ronda 1, hallazgo D] Los dos caminos —crear y mover— pasan por la MISMA
  // barrera antes de tocar GitHub para escribir.
  describe('D: el arranque también pasa por los topes, no solo el guardado que mueve', () => {
    it('un `bytesDelCuerpo` que pasa el tope frena el ARRANQUE antes de crear nada', async () => {
      const { f, pedidos } = fetchFalso([{ status: 404, cuerpo: { message: 'Not Found' } }])
      const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1, bytesDelCuerpo: TOPE_CUERPO + 1 })
      expect(r).toEqual({
        ok: false,
        motivo: 'no-se-pudo-guardar',
        problema: 'Es demasiado contenido para una sola publicación: manda menos fotos, o de menor tamaño.',
      })
      // Ni un creaBlob: el chequeo del tope frena ANTES de escribir nada.
      expect(pedidos.some((p) => p.url.endsWith('/git/blobs'))).toBe(false)
    })

    it('un `bytesDelCuerpo` que pasa el tope también frena el guardado que MUEVE el ref', async () => {
      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64', sha: 'b' } },
      ])
      const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1, bytesDelCuerpo: TOPE_CUERPO + 1 })
      expect(r.ok).toBe(false)
      expect(pedidos.some((p) => p.url.endsWith('/git/blobs'))).toBe(false)
    })
  })

  // [Ronda 1, hallazgo E6] El commit raíz del bootstrap tiene que verse
  // IGUAL que cualquier guardado posterior (que pasa por publica(), con el
  // asunto genérico y los trailers del panel) — no una frase distinta que,
  // si Marcos mira el ref a mano, parezca otra cosa.
  it('E6: el commit raíz del bootstrap usa el MISMO asunto y los mismos trailers que un guardado que mueve', async () => {
    const { f, pedidos } = fetchFalso([
      { status: 404, cuerpo: { message: 'Not Found' } },
      ...respuestasDeUnBlobArbolYCommit(),
      { cuerpo: { ref: `refs/${REF_BORRADOR}` } },
    ])
    await guarda(gh(f), { ...UN_BORRADOR, autor: 'ella@ejemplo.mx', ahora: 1 })
    const commit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
    const mensaje = (commit.cuerpo as { message: string }).message
    expect(mensaje).toBe(`${ASUNTO_GENERICO}\n\nPanel: sí\nPanel-Autor: ella@ejemplo.mx`)
  })
})
