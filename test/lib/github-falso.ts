/*
 * El `fetch` de mentira para probar el cliente de GitHub sin salir a la red.
 * Lo usan `test/github.test.ts` (Tarea 3), `test/publicar.test.ts` (Tarea 5),
 * `test/acciones.test.ts` y `test/revertir.test.ts` (Tarea 8): una sola
 * copia, porque dos copias de este ayudante son la forma en que dos tests
 * terminan creyendo cosas distintas sobre el mismo cliente.
 *
 * Vive en test/lib/ y no en src/ por la misma regla que campos-en-html.ts:
 * hoy lo usa solo la suite.
 */
import { readFileSync } from 'node:fs'
import { serializa } from '../../src/contenido/carga'
import { esquemaSabores } from '../../src/contenido/esquema/sabores'
/**
 * [M-11] Antes, un pedido de más repetía la ÚLTIMA respuesta programada
 * para siempre — así que un test que scriptea de menos (por ejemplo,
 * porque el código bajo prueba empezó a llamar a `fetch` una vez más de lo
 * que el test esperaba) podía pasar por casualidad, con la última
 * respuesta sirviendo para un pedido que nadie planeó. Ahora tira: un test
 * que pide más respuestas de las que programó falla ruidoso, en vez de
 * pasar en silencio por la razón equivocada.
 */
export function fetchFalso(respuestas: Array<{ status?: number; cuerpo: unknown }>) {
  const pedidos: Array<{ url: string; metodo: string; cuerpo: unknown; cabeceras: Record<string, string> }> = []
  let i = 0
  const f = async (url: string | URL, init?: RequestInit) => {
    // El intento se registra ANTES de mirar si hay respuesta programada: si se
    // registrara después, un pedido que cae en el error de «scripteó de menos»
    // quedaría sin rastro, y todos los `expect(pedidos).toHaveLength(0)` de la
    // suite darían cero tanto si el código frenó antes de la red como si la
    // intentó. Parecerían candados y serían decoración. [RULING T7-5]
    pedidos.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      cabeceras: (init?.headers ?? {}) as Record<string, string>,
    })

    if (i >= respuestas.length) {
      throw new Error(
        `fetchFalso(): se pidió una respuesta más de las ${respuestas.length} programadas ` +
          `(pedido #${i + 1}, ${init?.method ?? 'GET'} ${String(url)}) — el test scripteó de menos.`,
      )
    }
    const r = respuestas[i++]
    return new Response(JSON.stringify(r.cuerpo), { status: r.status ?? 200 })
  }
  return { f: f as unknown as typeof globalThis.fetch, pedidos }
}

/**
 * El texto EXACTO que `serializa()` escribiría para el `sabores.json` real
 * del repo, hoy. Es el valor por defecto de `vivo` en
 * `respuestasDeUnaPublicacionCompleta()` — una función y no una constante
 * módulo, porque cada test que la usa necesita su propia lectura (mutarla no
 * tiene sentido acá, pero leerla una sola vez para todo el proceso sí
 * arriesgaría un archivo cacheado si `sabores.json` cambiara entre tests).
 */
const textoSaboresVivoDeDisco = (): string =>
  serializa(esquemaSabores, JSON.parse(readFileSync('src/contenido/datos/sabores.json', 'utf8')))

/**
 * Las siete respuestas que hacen falta para que la Fase 2 del router
 * TERMINE de publicar un solo documento, una vez que el chequeo de la base
 * ya pasó: leer lo vivo de ese documento, y las seis de siempre de
 * `publica()` (ref, commit padre, blob, árbol, commit, mover el ref). `vivo`
 * por defecto es el `sabores.json` real del repo, serializado, así que un
 * lote que mande `sabores` con algo cambiado sí encuentra una diferencia y
 * escribe.
 *
 * Ojo: esto es para el flujo del ROUTER (`publicarAccion`), que hace su
 * propia lectura de «lo vivo» ANTES de llamar a `publica()`. Un llamado
 * directo a `publica()` (o a `revierte()`, que también llama a `publica()`
 * directo) no hace esa lectura extra — ahí hacen falta solo las últimas
 * seis, sin la primera.
 */
export const respuestasDeUnaPublicacionCompleta = (vivo = textoSaboresVivoDeDisco()) => [
  { cuerpo: { content: Buffer.from(vivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef: lo vivo del documento
  { cuerpo: { object: { sha: 'main-2' } } },                            // gh.ref (dentro de publica())
  { cuerpo: { sha: 'commit-viejo2', tree: { sha: 'arbol-viejo2' } } },  // gh.commit
  { cuerpo: { sha: 'blob-nuevo2' } },                                    // creaBlob
  { cuerpo: { sha: 'arbol-nuevo2' } },                                   // creaArbol
  { cuerpo: { sha: 'commit-nuevo2' } },                                  // creaCommit
  { cuerpo: {} },                                                        // mueveRef
]

/**
 * Las últimas SEIS de `respuestasDeUnaPublicacionCompleta()`: lo que hace
 * falta para que `publica()` TERMINE, sin la lectura de «lo vivo» que solo
 * necesita el router antes de llamarla. La usan los llamados DIRECTOS a
 * `publica()` —`test/publicar.test.ts` y `revertir()`—, donde no hay ningún
 * chequeo previo de «¿cambió?» que gaste ese primer pedido.
 */
export const respuestasDeUnaPublicacionDirecta = () => respuestasDeUnaPublicacionCompleta().slice(1)

/**
 * [Tarea 11] Las tres respuestas del bootstrap de `borrador.ts` (`guarda()`,
 * la primera vez que alguien guarda en la vida del panel): crear el blob,
 * crear el árbol y crear el commit RAÍZ. Sin el `PATCH`/`POST /git/refs`
 * final —ese varía según el caso (`creaRef`)— y sin el `GET` del ref de
 * arranque —ese 404 se scriptea aparte, porque es la señal de "no existe
 * todavía" que dispara este camino—.
 */
export const respuestasDeUnBlobArbolYCommit = () => [
  { cuerpo: { sha: 'blob-borrador' } }, // creaBlob
  { cuerpo: { sha: 'arbol-borrador' } }, // creaArbol
  { cuerpo: { sha: 'commit-borrador' } }, // creaCommit (raíz, sin padre)
]
