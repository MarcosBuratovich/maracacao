/*
 * El cliente de la Git Data API de GitHub: los pasos de bajo nivel que hacen
 * falta para armar un commit a mano (leer un ref, leer un commit, leer un
 * blob, crear un blob, crear un árbol, crear un commit, mover un ref, y
 * —desde la Tarea 11— crear un ref que todavía no existe). `publicar.ts`
 * (Tarea 5) encadena la mayoría para publicar un documento entero;
 * `borrador.ts` (Tarea 11) usa `creaRef` una sola vez, para el primer
 * commit del ref del borrador.
 *
 * Puro e inyectable (regla de `src/servidor/**`): el token, el dueño, el
 * repo y el propio `fetch` llegan por `Credenciales`. Nada acá lee
 * `process.env` ni toca `globalThis.fetch` — así la suite prueba QUÉ pedido
 * arma, sin salir a la red y sin ningún token real.
 *
 * Los errores de este módulo llevan el status HTTP y el `message` que
 * mandó GitHub: es lo que va al log del servidor para Marcos (E7). La
 * traducción a español mexicano para la clienta pasa en `publicar.ts` y en
 * el router — acá no hay prosa para ella, porque este archivo no sabe
 * distinguir un 404 de "el token venció" de un 404 de "el archivo no
 * existe": esa lectura la hace quien llama, con el contexto de qué pidió.
 *
 * [Tarea 13] También guarda la fecha de vencimiento del PAT, leída de una
 * cabecera que GitHub manda arriba de cualquier respuesta autenticada
 * (`vencimientoDelToken()`, más abajo) — así `salud` puede avisar treinta
 * días antes de que el panel se caiga con un 401 que no dice nada, sin que
 * esa vigilancia le cueste un pedido propio al PAT.
 */

export interface Credenciales {
  token: string
  duenio: string
  repo: string
  fetch: typeof globalThis.fetch
  /**
   * [Revisión final de la rama, I5] Se llama después de CADA respuesta de
   * GitHub —le haya ido bien o mal a ese pedido— con el vencimiento del
   * token que esa respuesta trajo (o `null` si no lo trajo).
   *
   * Existe porque la vigilancia del vencimiento estaba colgada de `salud`,
   * que es la única acción que ningún flujo automático llama: el aviso de
   * los treinta días no salía nunca, y el día D ella recibía un 502
   * incomprensible — literalmente el modo de falla que esa vigilancia
   * existía para evitar. El enganche va ACÁ, donde la cabecera se lee, y no
   * en cada llamador: una invariante que depende de que todos se acuerden
   * no es una invariante.
   *
   * Si tira, se loguea y se sigue: este cliente no puede hacer fallar un
   * pedido de la clienta por culpa de una vigilancia que ella ni pidió.
   */
  alResponder?: (vencimiento: string | null) => Promise<void>
}

export interface EntradaArbol {
  path: string
  /** `null` = borrar esta ruta del árbol. */
  sha: string | null
}

export interface DatosCommit {
  mensaje: string
  arbol: string
  /**
   * [Tarea 11, Ronda 1 hallazgo E2] `null` es el commit RAÍZ, sin padre: el
   * ÚNICO caso que lo pide es el primer commit del ref del borrador, que no
   * desciende de nada —ni de `main`, ni de un commit anterior propio, porque
   * no existe— y por eso `creaCommit` manda `parents: []` en vez de
   * `[padre]` cuando esto es `null`. Todo lo demás del repo (`main`, cada
   * reversión) siempre pasa un sha real acá, así que ese camino queda
   * exactamente como estaba.
   *
   * Es `string | null`, no `string` con `''` de centinela: `''` es
   * justamente el valor que una variable `string` cualquiera toma por
   * accidente (`padre: sha ?? ''`, un `padre` que se perdió en el camino), y
   * con eso «no tengo padre» (a propósito) y «perdí el padre» (un bug) serían
   * el mismo valor — un commit raíz armado por error, en silencio. `null`
   * exige que quien llama lo haya pensado.
   */
  padre: string | null
  autor: { name: string; email: string }
}

const VERSION_API = '2022-11-28'

/**
 * [M-7] Encodea CADA segmento de una ruta con `/` adentro, sin tocar las
 * barras que separan los segmentos: a diferencia de `encodeURIComponent` a
 * secas —que codificaría la barra también, rompiendo la ruta en pedazos
 * que la URL ya no entiende como una sola ruta con niveles—, esto deja
 * intacta la estructura de segmentos y solo escapa lo que hay ADENTRO de
 * cada uno.
 *
 * Hoy todo lo que llega acá es una constante o una ruta ya validada por
 * `rutas-permitidas.ts` (`heads/main`, `src/contenido/datos/<id>.json`),
 * así que esto no cambia ni un byte de lo que se manda en producción. La
 * razón para escribirlo ahora, sin esperar a que haga falta, es la Parte B:
 * las rutas de imagen van a llegar armadas con lo que la clienta haya
 * escrito, y un segmento con `?`, `#` o un espacio sin codificar rompe la
 * URL —o peor, apunta a otro recurso— antes de que la lista blanca llegue
 * a rechazarlo.
 */
const codificaRuta = (ruta: string): string => ruta.split('/').map(encodeURIComponent).join('/')

export function cliente(c: Credenciales) {
  const base = `https://api.github.com/repos/${c.duenio}/${c.repo}`

  /**
   * [Tarea 13] Lo que trajo la cabecera `github-authentication-token-expiration`
   * del ÚLTIMO pedido hecho con este cliente, o `null` si ese pedido no la
   * trajo. Se actualiza en CADA pedido —tanto si GitHub contestó 2xx como si
   * no— porque la cabecera viaja arriba de la respuesta, antes de que
   * `pedir()` mire el status: el día que el token ya venció y GitHub
   * contesta 401, esa MISMA respuesta puede seguir trayendo la fecha, que es
   * justo el día en que más hace falta poder leerla.
   */
  let vencimientoToken: string | null = null

  /**
   * El pedido interno: arma la URL contra la API, pone las cabeceras que
   * toda esta API exige y, si GitHub no contesta 2xx, tira un `Error` con
   * el status y el `message` del cuerpo — ese mensaje es de GitHub, no
   * inventado acá, así que puede venir en inglés y con jerga: es para el
   * log del servidor, no para la clienta (E7).
   */
  async function pedir(ruta: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const respuesta = await c.fetch(`${base}${ruta}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${c.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': VERSION_API,
        'User-Agent': 'panel-maracacao',
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })

    // [Tarea 13] Se lee ACÁ, antes del `if (!respuesta.ok)` de abajo: es una
    // cabecera de la respuesta, no del cuerpo, así que está disponible tanto
    // en el camino feliz como en el de error, y capturarla antes de decidir
    // si tirar deja que la vigilancia vea el vencimiento aunque este pedido
    // en particular haya fallado.
    vencimientoToken = respuesta.headers.get('github-authentication-token-expiration')

    // [Revisión final, I5] Y se AVISA, antes del `throw` de abajo por la
    // misma razón por la que se lee antes: el día que el token ya venció y
    // GitHub contesta 401, esa misma respuesta puede seguir trayendo la
    // fecha, y es el día en que más hace falta que el aviso salga.
    if (c.alResponder) {
      try {
        await c.alResponder(vencimientoToken)
      } catch (e) {
        console.error('github: la vigilancia del vencimiento del token reventó (no afecta a este pedido) —', e)
      }
    }

    const cuerpo: unknown = await respuesta.json().catch(() => undefined)

    if (!respuesta.ok) {
      const mensaje = (cuerpo as { message?: unknown } | undefined)?.message
      throw new Error(`GitHub respondió ${respuesta.status}: ${typeof mensaje === 'string' ? mensaje : 'sin mensaje'}`)
    }

    return cuerpo
  }

  return {
    /**
     * [Tarea 13] La fecha de vencimiento del PAT, tal cual la mandó GitHub en
     * la cabecera `github-authentication-token-expiration` del ÚLTIMO pedido
     * que hizo este cliente — o `null` si esa cabecera no vino (un token
     * clásico, por ejemplo, no la manda).
     *
     * SINCRÓNICA y sin pedido propio, a propósito: la cabecera llega arriba
     * de CUALQUIER respuesta autenticada, así que no hace falta —ni se
     * permite acá— salir a pedirle nada a GitHub solo para mirar esto. Si
     * esta función disparara su propio pedido, la vigilancia le costaría al
     * PAT una llamada cada vez que alguien llama a `salud`, que es
     * exactamente lo que el freno por IP de la Parte A (I-6) existe para
     * evitar.
     *
     * Nunca inventa una fecha: si la cabecera no vino, `null` — decir «vence
     * en un año» sería peor que no saber, porque callaría la vigilancia
     * justo el día en que no puede ver.
     */
    vencimientoDelToken(): string | null {
      return vencimientoToken
    },

    /** El sha que apunta un ref (`heads/main`, por ejemplo). */
    async ref(nombre: string): Promise<{ sha: string }> {
      const cuerpo = await pedir(`/git/ref/${codificaRuta(nombre)}`) as { object: { sha: string } }
      return { sha: cuerpo.object.sha }
    },

    /**
     * Los datos de un commit: su árbol, su mensaje, cuándo lo hizo su autor y
     * de quién viene. Los PADRES los necesita la reversión (`revertir.ts`):
     * volver atrás un commit es publicar lo que decían sus archivos en el
     * padre, así que sin el padre no hay a qué volver.
     */
    async commit(sha: string): Promise<{
      sha: string
      tree: string
      message: string
      author: { date: string }
      padres: string[]
    }> {
      const cuerpo = await pedir(`/git/commits/${sha}`) as {
        sha: string
        tree: { sha: string }
        message: string
        author: { date: string }
        parents?: Array<{ sha: string }>
      }
      return {
        sha: cuerpo.sha,
        tree: cuerpo.tree.sha,
        message: cuerpo.message,
        author: cuerpo.author,
        padres: (cuerpo.parents ?? []).map((p) => p.sha),
      }
    },

    /** El contenido de un blob, decodificado de base64 a texto. Necesita el SHA del blob, no la ruta. */
    async contenido(sha: string): Promise<string> {
      const cuerpo = await pedir(`/git/blobs/${sha}`) as { content: string; encoding: string }
      return Buffer.from(cuerpo.content, 'base64').toString('utf8')
    },

    /**
     * El contenido de un ARCHIVO por su ruta, en un ref dado (rama, tag o
     * sha) — la API de Contents, no la de blobs: esta resuelve ruta+ref
     * directo, sin que quien llama tenga que ir a buscar el sha del blob
     * primero. La usa el router (`acciones.ts`) para leer el contenido VIVO
     * de un documento antes de compararlo contra lo que la clienta mandó.
     *
     * [M-8] Arriba de 1 MB, la API de Contents contesta 200 con
     * `content: ""` y `encoding: "none"` — o sea, te miente por omisión: no
     * es un error, es un cuerpo vacío que parece un archivo vacío. Ahí se
     * pide el blob por el sha que la MISMA respuesta trae, que sí viene en
     * base64 hasta 100 MB. Con los JSON de hoy (el más grande son 24 KB)
     * esta rama no corre nunca; con las fotos de producto de la fase 7 corre
     * siempre, y el modo de falla sin esto es publicar creyendo que el
     * archivo vivo estaba vacío.
     */
    async archivoEnRef(ruta: string, ref: string): Promise<string> {
      const cuerpo = await pedir(`/contents/${codificaRuta(ruta)}?ref=${encodeURIComponent(ref)}`) as {
        content: string
        encoding: string
        sha: string
      }
      if (cuerpo.encoding !== 'base64') {
        const blob = await pedir(`/git/blobs/${cuerpo.sha}`) as { content: string; encoding: string }
        return Buffer.from(blob.content, 'base64').toString('utf8')
      }
      return Buffer.from(cuerpo.content, 'base64').toString('utf8')
    },

    /**
     * Qué RUTAS cambiaron entre dos shas. Es la pregunta que el router
     * necesita para distinguir las dos formas de «alguien publicó mientras
     * ella editaba»: si lo que cambió en el medio son documentos de
     * contenido, la publicación de ella los pisaría y hay que frenarla; si
     * es código del sitio (Marcos arreglando una plantilla), no se tocan y
     * puede seguir.
     *
     * Devuelve solo los nombres, no el diff: el router no tiene nada que
     * hacer con el contenido del cambio ajeno, y traerlo sería traer texto
     * arbitrario a una función que después lo podría loguear.
     *
     * `files` no viene cuando los dos shas son el mismo, así que se lee con
     * un default en vez de asumir que está.
     */
    async comparaRefs(base: string, cabeza: string): Promise<{ archivos: string[] }> {
      const cuerpo = await pedir(
        `/compare/${encodeURIComponent(base)}...${encodeURIComponent(cabeza)}`,
      ) as { files?: Array<{ filename: string }> }
      return { archivos: (cuerpo.files ?? []).map((f) => f.filename) }
    },

    /** Crea un blob con este contenido (codificado a base64) y devuelve su sha. */
    async creaBlob(contenido: string): Promise<string> {
      const cuerpo = await pedir('/git/blobs', {
        method: 'POST',
        body: { content: Buffer.from(contenido).toString('base64'), encoding: 'base64' },
      }) as { sha: string }
      return cuerpo.sha
    },

    /**
     * Crea un árbol sobre `base`, con las entradas dadas. `sha: null` en una
     * entrada es cómo la Git Data API borra esa ruta del árbol nuevo.
     *
     * [Tarea 11, Ronda 1 hallazgo E1] `base: null` OMITE `base_tree` del
     * cuerpo del pedido en vez de mandar un sha inventado para «un árbol de
     * cero»: es la forma documentada de la Git Data API para un árbol sin
     * base, y evita que ese camino dependa de que un sha mágico —el árbol
     * vacío universal de git— esté bien escrito. Con eso, el único paso del
     * bootstrap del borrador que ningún mock de test podía verificar por sí
     * mismo deja de existir, en vez de quedar diferido a que alguien lo
     * revise a mano contra la API real.
     */
    async creaArbol(base: string | null, entradas: EntradaArbol[]): Promise<string> {
      const cuerpo = await pedir('/git/trees', {
        method: 'POST',
        body: {
          ...(base !== null ? { base_tree: base } : {}),
          tree: entradas.map((e) => ({ path: e.path, sha: e.sha, mode: '100644', type: 'blob' })),
        },
      }) as { sha: string }
      return cuerpo.sha
    },

    /**
     * Crea un commit y devuelve su sha. Con un padre —el caso de siempre—
     * manda `parents: [padre]`; con `padre: null` manda `parents: []`, un
     * commit RAÍZ (ver el comentario de `DatosCommit.padre`).
     */
    async creaCommit(datos: DatosCommit): Promise<string> {
      const cuerpo = await pedir('/git/commits', {
        method: 'POST',
        body: {
          message: datos.mensaje,
          tree: datos.arbol,
          parents: datos.padre !== null ? [datos.padre] : [],
          author: datos.autor,
        },
      }) as { sha: string }
      return cuerpo.sha
    },

    /**
     * Mueve un ref al sha dado. `forzar` por defecto es `false`: mover un
     * ref sin forzar es lo que hace que GitHub rechace el pedido si el
     * ref se movió mientras tanto (alguien más publicó primero), en vez
     * de pisar ese commit sin avisar — un solo commit por publicación,
     * nunca `force: true` salvo que quien llama lo pida explícitamente.
     */
    async mueveRef(nombre: string, sha: string, forzar = false): Promise<void> {
      // [Revisión final de la rama] `codificaRuta`, igual que sus vecinas
      // (`ref`, `archivoEnRef`). Hoy todo lo que llega acá es una constante,
      // así que no cambia un byte de lo que se manda; la inconsistencia era
      // el problema, porque es lo que hace que la próxima ruta variable se
      // cuele por el lado equivocado.
      await pedir(`/git/refs/${codificaRuta(nombre)}`, {
        method: 'PATCH',
        body: { sha, force: forzar },
      })
    },

    /**
     * [Tarea 11] Crea un ref NUEVO apuntando a `sha`. `mueveRef` mueve un ref
     * que YA existe —GitHub lo rechaza si no—, así que este es el único
     * camino para el PRIMER commit de un ref que la plataforma todavía no
     * conoce: sin esto, el primer borrador de la vida del panel moriría con
     * un 404 que no le dice nada a nadie.
     */
    async creaRef(nombre: string, sha: string): Promise<void> {
      await pedir('/git/refs', {
        method: 'POST',
        body: { ref: `refs/${nombre}`, sha },
      })
    },

    /**
     * Los últimos `cuantos` commits de `ref`, del más nuevo al más viejo —tal
     * cual los da GitHub, sin reordenar—. Es la fuente del historial
     * (`historial.ts`, Tarea 10): el asunto de cada commit ES el resumen que
     * la clienta vio antes de publicar, así que esto es lo único que hace
     * falta leer para reconstruirlo.
     *
     * [Inconsistencia de la API] Este endpoint —la API de "Commits" (REST),
     * no la Git Data API que usa el resto de este cliente— quiere el nombre
     * de la rama PELADO: `?sha=main`, nunca `?sha=heads/main`. Con
     * `heads/main` contesta 404, no un error obvio, y un 404 tratado como
     * "no hay commits" daría una lista vacía indistinguible de "no hay
     * historial" — un bug silencioso. Por eso quien llama sigue pasando
     * `ref` con la MISMA forma que el resto de este cliente (`heads/main`,
     * como `ref()` y `mueveRef()`) y el pelado pasa ACÁ ADENTRO: la
     * excepción de esta API queda en un solo lugar, no en la cabeza de cada
     * llamador.
     */
    async listaCommits(ref: string, cuantos: number): Promise<Array<{ sha: string; mensaje: string; fecha: string }>> {
      const rama = ref.startsWith('heads/') ? ref.slice('heads/'.length) : ref
      const cuerpo = await pedir(`/commits?sha=${encodeURIComponent(rama)}&per_page=${cuantos}`) as Array<{
        sha: string
        commit: { message: string; author: { date: string } }
      }>
      return cuerpo.map((c) => ({ sha: c.sha, mensaje: c.commit.message, fecha: c.commit.author.date }))
    },
  }
}
