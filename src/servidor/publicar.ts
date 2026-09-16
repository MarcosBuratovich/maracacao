/*
 * Una publicación es UN commit, o no es nada. Encadena los pasos sueltos de
 * `github.ts` —leer el ref, leer su commit, crear los blobs, armar el árbol,
 * crear el commit, mover el ref— en el único orden que hace que un choque a
 * mitad de camino deje el repo intacto: el ref se mueve AL FINAL, con
 * `force: false`, después de que todo lo demás ya existe en GitHub. Si algo
 * revienta antes del `PATCH`, lo que quedó escrito son objetos sueltos que
 * ningún ref señala — basura inerte para git, no un sitio a medio publicar.
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe el cliente ya
 * armado y el documento a publicar por parámetro. No lee `process.env`, no
 * toca `globalThis.fetch`.
 */
import { cliente, type EntradaArbol } from './github'
import { revisaLote } from './rutas-permitidas'
import { frase, type Cambio } from '../contenido/diff'

export interface Archivo {
  ruta: string
  /** Ya serializado: los bytes canónicos que van a un blob, tal cual. */
  contenido: string
}

export interface Publicacion {
  archivos: Archivo[]
  /** El correo de quien publica: va al trailer `Panel-Autor:` (E5). */
  autor: string
  /** Reservado para un chequeo temprano de concurrencia (tareas futuras); esta tarea no lo usa. */
  ramaSha?: string
  /**
   * Los `Cambio[]` que la clienta ya vio antes de apretar publicar (E5): el
   * asunto del commit sale de `frase(cambios)`. Si se omite —por ejemplo,
   * quien llama a `publica()` todavía no calculó el diff—, el asunto es un
   * texto genérico. Si se pasa y `frase()` da vacío (no hay nada que
   * contar), no se crea un commit vacío: ver la última rama de `publica()`.
   */
  cambios?: Cambio[]
}

export type Resultado =
  | { ok: true; sha: string | null; resumen: string }
  | { ok: false; codigo: 409 | 422 | 502; problema: string }

/** Quien firma cada commit del panel: nunca la clienta ni Marcos, siempre esta identidad (E5). */
const AUTOR_PANEL = { name: 'Panel Maracacao', email: 'panel@maracacao.mx' }

/** La única rama que este código toca. */
const REF = 'heads/main'

/** Se usa cuando `publica()` no recibió `cambios`: no hay diff para nombrar, pero sí algo que publicar. */
const ASUNTO_GENERICO = 'Actualiza contenido del panel'

/** Cuántos blobs se crean en simultáneo. Ni uno por uno (lento) ni todos juntos (le pega a la API de golpe). */
const CONCURRENCIA_BLOBS = 4

/**
 * Corre `tarea` sobre cada elemento de `items`, como máximo `limite` a la
 * vez. Se escribe a mano en vez de sumar una dependencia: son diez líneas y
 * el requisito es angosto (un límite fijo, sin cancelación, sin reintentos
 * propios). Un puñado de «trabajadores» —nunca más de `limite`— comparten un
 * cursor y cada uno pide el siguiente índice apenas termina el anterior, así
 * que en ningún instante hay más de `limite` tareas en vuelo. El resultado
 * vuelve en el orden de `items`, no en el orden en que van terminando.
 */
async function mapaConcurrencia<T, R>(
  items: readonly T[],
  limite: number,
  tarea: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(items.length)
  let siguiente = 0

  async function trabajador(): Promise<void> {
    for (;;) {
      const indice = siguiente++
      if (indice >= items.length) return
      resultados[indice] = await tarea(items[indice])
    }
  }

  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, trabajador)
  await Promise.all(trabajadores)
  return resultados
}

/**
 * Cuánto pesa, en bytes, el cuerpo que `creaBlob` va a mandar por cada
 * archivo (la API de blobs exige base64 — ver `rutas-permitidas.ts`). Es la
 * misma cuenta que hace `github.ts` al codificar, hecha acá para poder
 * revisar el tope ANTES de gastar un solo pedido.
 */
function bytesDelCuerpo(archivos: readonly Archivo[]): number {
  return archivos.reduce((total, a) => total + Buffer.from(a.contenido, 'utf8').toString('base64').length, 0)
}

/**
 * El `PATCH` de `mueveRef` que falla DESPUÉS de que el commit ya existe en
 * GitHub: lo que queda es un commit huérfano, sin ningún ref que apunte a
 * él. Se envuelve el error original con ese sha adentro —en vez de perderlo
 * al burbujear— para que el log de Marcos (E7: «todo, incluido el sha»)
 * pueda nombrar exactamente qué objeto quedó colgado.
 */
class FalloAlMoverRef extends Error {
  constructor(
    readonly original: unknown,
    readonly shaDelCommit: string,
  ) {
    super(original instanceof Error ? original.message : String(original))
  }
}

/** Separa el status HTTP (si lo hay), el mensaje de GitHub y —si lo hay— el sha del commit huérfano. */
function analizaError(e: unknown): { status?: number; mensaje: string; sha?: string } {
  if (e instanceof FalloAlMoverRef) {
    const { status, mensaje } = analizaError(e.original)
    return { status, mensaje, sha: e.shaDelCommit }
  }
  if (e instanceof Error) {
    const m = /^GitHub respondió (\d+): ([\s\S]*)$/.exec(e.message)
    if (m) return { status: Number(m[1]), mensaje: m[2] }
    return { mensaje: e.message }
  }
  return { mensaje: String(e) }
}

/**
 * Si este error es el que dispara el reintento: el `PATCH` del ref
 * rechazado porque alguien más publicó primero. GitHub lo devuelve como un
 * 422 con este mensaje puntual — un 422 de OTRO paso (un blob o un árbol
 * mal formado, algo que `validar()` debería haber atajado antes) no es esto
 * y no se reintenta como si lo fuera.
 */
function esConflictoDeRef(e: unknown): boolean {
  const { status, mensaje } = analizaError(e)
  return status === 422 && /fast forward/i.test(mensaje)
}

/**
 * Un intento completo, de punta a punta: leer el ref, leer su commit, crear
 * los blobs que hagan falta, armar el árbol SOBRE ESE commit, crear el
 * commit y —recién al final— mover el ref sin forzar. Cada llamada a esta
 * función parte de leer el ref de nuevo: el reintento (E7 par de errores,
 * regla del controlador) arma el árbol sobre el commit NUEVO, nunca sobre
 * el viejo — repetir contra la base vieja sería pisar en silencio lo que
 * Marcos acaba de publicar.
 */
async function intento(gh: ReturnType<typeof cliente>, archivos: readonly Archivo[], mensaje: string): Promise<string> {
  const { sha: shaDelRef } = await gh.ref(REF)
  const padre = await gh.commit(shaDelRef)

  const shasDeBlobs = await mapaConcurrencia(archivos, CONCURRENCIA_BLOBS, (a) => gh.creaBlob(a.contenido))

  const entradas: EntradaArbol[] = archivos.map((a, i) => ({ path: a.ruta, sha: shasDeBlobs[i] }))
  const arbol = await gh.creaArbol(padre.tree, entradas)

  const shaDelCommit = await gh.creaCommit({ mensaje, arbol, padre: padre.sha, autor: AUTOR_PANEL })
  try {
    await gh.mueveRef(REF, shaDelCommit, false)
  } catch (e) {
    // El commit ya quedó escrito en GitHub cuando esto revienta: se
    // envuelve el error con su sha para que el log (más abajo, en
    // `publica()`) pueda nombrar el objeto huérfano.
    throw new FalloAlMoverRef(e, shaDelCommit)
  }

  return shaDelCommit
}

/**
 * Publica un documento como un solo commit en `main`, o no publica nada.
 *
 * Orden, y por qué es ESE orden (regla del controlador): la lista blanca
 * primero —una ruta prohibida no gasta ni un pedido—, después leer el ref y
 * su commit, después los blobs en paralelo, después el árbol, después el
 * commit, y el `PATCH` del ref AL FINAL. Si cualquier paso anterior al
 * `PATCH` tira, el repo queda exactamente como estaba: nada apunta a los
 * objetos que se llegaron a crear.
 *
 * Si el `PATCH` choca porque el ref avanzó mientras tanto (alguien más
 * publicó), se reintenta UNA vez desde el principio —el árbol nuevo se arma
 * sobre el commit nuevo—. Si choca otra vez, es un 409 en español mexicano
 * que nombra a Marcos y no habla de refs ni de fast-forward (E7): el detalle
 * técnico va al log del servidor, no a la clienta.
 */
export async function publica(gh: ReturnType<typeof cliente>, p: Publicacion): Promise<Resultado> {
  const rutas = p.archivos.map((a) => a.ruta)
  const chequeo = revisaLote(rutas, bytesDelCuerpo(p.archivos))
  if (!chequeo.ok) return { ok: false, codigo: 422, problema: chequeo.problema }

  const asunto = p.cambios !== undefined ? frase(p.cambios) : ASUNTO_GENERICO
  if (asunto === '') {
    // p.cambios vino y no describe nada: no hay commit que valga la pena.
    // Ni un pedido a GitHub, igual que con la lista blanca.
    return { ok: true, sha: null, resumen: 'No había nada que publicar: no cambiaste ningún dato del sitio.' }
  }

  const mensaje = `${asunto}\n\nPanel: sí\nPanel-Autor: ${p.autor}`

  try {
    const sha = await intento(gh, p.archivos, mensaje)
    return { ok: true, sha, resumen: asunto }
  } catch (primerError) {
    if (!esConflictoDeRef(primerError)) return traduceError(primerError, p)

    try {
      const sha = await intento(gh, p.archivos, mensaje)
      return { ok: true, sha, resumen: asunto }
    } catch (segundoError) {
      if (!esConflictoDeRef(segundoError)) return traduceError(segundoError, p)

      // Log para Marcos (E7): acá sí van el status, el mensaje de GitHub,
      // el sha del commit que quedó huérfano y qué se estaba publicando.
      // Lo que sigue, en cambio, no lleva nada de eso — la clienta no sabe
      // qué es un ref, un fast-forward, ni qué commit quedó colgado.
      const { status, mensaje: mensajeDeGitHub, sha } = analizaError(segundoError)
      console.error(
        `publicar: el PATCH del ref chocó dos veces seguidas (autor: ${p.autor}, archivos: ${rutas.join(', ')}` +
          `${sha ? `, commit huérfano: ${sha}` : ''}) — status ${status ?? '(sin status)'}: ${mensajeDeGitHub}`,
      )
      return {
        ok: false,
        codigo: 409,
        problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
      }
    }
  }
}

/** La otra cara de un error de GitHub (E7): al log, todo —status, mensaje y sha si lo hay—; a la clienta, nada técnico. */
function traduceError(e: unknown, p: Publicacion): Resultado {
  const { status, mensaje, sha } = analizaError(e)
  console.error(
    `publicar: GitHub respondió con un error al publicar (autor: ${p.autor}, archivos: ${p.archivos.map((a) => a.ruta).join(', ')}` +
      `${sha ? `, commit huérfano: ${sha}` : ''}) — status ${status ?? '(sin status)'}: ${mensaje}`,
  )
  return {
    ok: false,
    codigo: 502,
    problema: 'No pudimos publicar: hubo un problema para conectarnos con el sitio. Prueba de nuevo en unos minutos.',
  }
}
