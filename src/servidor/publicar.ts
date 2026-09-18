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
import { revisaLote, rutaPermitida, rutaDeBorradorPermitida, REF_BORRADOR } from './rutas-permitidas'
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
  /**
   * Los `Cambio[]` que la clienta ya vio antes de apretar publicar (E5): el
   * asunto del commit sale de `frase(cambios)`. Si se omite —por ejemplo,
   * quien llama a `publica()` todavía no calculó el diff—, el asunto es un
   * texto genérico. Si se pasa y `frase()` da vacío (no hay nada que
   * contar), no se crea un commit vacío: ver la última rama de `publica()`.
   */
  cambios?: Cambio[]
  /**
   * Cuánto pesó el CUERPO del pedido HTTP que trajo esta publicación. Es lo
   * que `TOPE_CUERPO` quiere limitar de verdad —el tope de 4.5 MB de cuerpo
   * de request que impone la plataforma—, y solo el borde lo sabe. Cuando no
   * viene (el borde no pudo medirlo), se cae a la suma de los archivos en
   * base64: es una cota INFERIOR del cuerpo real, así que sigue sirviendo
   * para frenar un lote descomunal, nomás que con menos margen.
   */
  bytesDelCuerpo?: number
  /**
   * Líneas extra del cuerpo del commit, después de `Panel: sí` y
   * `Panel-Autor:`. Hoy la usa una sola cosa —`Panel-Revierte: <sha>`, que es
   * cómo la reversión automática se reconoce a sí misma para no revertir dos
   * veces el mismo commit— y por eso vive acá y no como un campo con nombre
   * propio: el próximo trailer no debería pedir tocar esta interfaz otra vez.
   */
  trailers?: Record<string, string>
  /**
   * Si el `PATCH` choca, ¿se reintenta? Default `true` (el de siempre): nada
   * cambia para quien ya usaba `publica()`. `revertir.ts` (Tarea 8) pasa
   * `false` — su reintento rearmaría el árbol sobre el commit que ganó la
   * carrera CON LOS BYTES VIEJOS de la reversión, y si ese commit es de
   * Marcos, su cambio desaparecería sin 409 y sin log. Para algo idempotente
   * como una reversión, rendirse y dejar que la próxima invocación reevalúe
   * desde cero es lo correcto — nunca insistir a ciegas sobre una carrera que
   * ya se perdió.
   */
  reintentar?: boolean
  /**
   * [Tarea 11, decisión B5] En qué ref escribir, en la MISMA forma que
   * `github.ts` usa en todos lados (`heads/main`, nunca `main` pelado).
   * Default `'heads/main'`: todo lo que ya llamaba a `publica()` antes de
   * esta tarea sigue escribiendo exactamente donde escribía, sin tocar este
   * campo.
   */
  ref?: string
  /**
   * [Tarea 11, decisión B5] Si el `PATCH` (o el `POST` de creación) del ref
   * va con `force: true`. Default `false` —el de siempre—: en `heads/main`
   * es la única forma de que un choque avise en vez de pisar en silencio, y
   * eso no puede cambiar por accidente. La ÚNICA razón legítima para pedir
   * `true` es el ref del borrador (`borrador.ts`), que no tiene historia que
   * preservar —es «lo último que ella escribió», no una serie de commits—.
   *
   * [Ronda 1, hallazgo C] `publica()` no acepta esto sobre CUALQUIER ref que
   * no sea `main`: lo valida contra un mapa explícito de refs conocidos (ver
   * `REFS_CONOCIDOS`, más abajo) y TIRA si `ref` no está en ese mapa, o si
   * `forzar: true` llega para un ref que el mapa no marca como forzable. Eso
   * significa dos cosas, no una: esta combinación no es una opción de
   * negocio, es un bug de quien llama, y por eso truena en vez de colarse
   * como un 409 cualquiera; y un ref DESCONOCIDO truena igual, aunque no
   * pida forzar — un ref que nadie declaró no es "probablemente el del
   * borrador", es un error.
   */
  forzar?: boolean
}

export type Resultado =
  | { ok: true; sha: string | null; resumen: string }
  | { ok: false; codigo: 409 | 422 | 502; problema: string }

/**
 * Quien firma cada commit del panel: nunca la clienta ni Marcos, siempre
 * esta identidad (E5). Exportada desde la Tarea 11: `borrador.ts` la
 * reusa para el commit raíz del primer borrador —el bootstrap no pasa
 * por `publica()` (ver su docstring), pero el AUTOR git tiene que ser el
 * mismo de siempre, no una copia que se pueda desincronizar.
 */
export const AUTOR_PANEL = { name: 'Panel Maracacao', email: 'panel@maracacao.mx' }

/**
 * [Tarea 11] El default de `p.ref`. Ya no es «la única rama que este código
 * toca» —desde esta tarea, `publica()` también escribe el ref del
 * borrador— pero sigue siendo la única que se mueve SIN forzar nunca (ver
 * `REFS_CONOCIDOS`).
 */
const REF_MAIN = 'heads/main'

/**
 * [Tarea 11, Ronda 1 hallazgo C] El mapa EXPLÍCITO de todo ref que
 * `publica()` sabe escribir, con qué lista blanca le corresponde y si
 * puede forzarse. Antes de este mapa, la regla era "`main` no forza, TODO
 * lo demás sí" —una prohibición sobre un único valor conocido, no una
 * lista de permitidos— y eso dejaba pasar cualquier ref DESCONOCIDO con
 * `forzar: true` (medido). El riesgo real: un typo como `'heads/borrador'`
 * —un nombre que cae DENTRO de `refs/heads/`, no el ref del borrador de
 * verdad— pasaba el chequeo viejo igual (no es `'heads/main'`, así que
 * "no main" alcanzaba), y el borrador a medio escribir aterrizaba en una
 * RAMA de verdad, que la plataforma sí mira y despliega: exactamente la
 * pregunta que el ref del borrador, fuera de `refs/heads/`, vino a cerrar
 * (decisión B5). Con esta lista, un ref que no está acá es un `throw`,
 * nunca un "probablemente el del borrador".
 */
const REFS_CONOCIDOS: Record<string, { permiteRuta: (ruta: string) => boolean; permiteForzar: boolean }> = {
  [REF_MAIN]: { permiteRuta: rutaPermitida, permiteForzar: false },
  [REF_BORRADOR]: { permiteRuta: rutaDeBorradorPermitida, permiteForzar: true },
}

/**
 * Se usa cuando `publica()` no recibió `cambios`: no hay diff para nombrar,
 * pero sí algo que publicar. Exportada desde la Ronda 1 de la Tarea 11:
 * `borrador.ts` la reusa para que el commit raíz del bootstrap del borrador
 * tenga el MISMO asunto que cualquier guardado posterior —que sí pasa por
 * `publica()` y cae en este mismo default, porque nunca manda `cambios`—.
 * Sin esto, el primer commit de ese ref decía algo distinto de todos los
 * que le siguen, y si Marcos mira el ref a mano vería dos formatos que no
 * deberían existir (hallazgo E6).
 */
export const ASUNTO_GENERICO = 'Actualiza contenido del panel'

/**
 * Arma el cuerpo de un commit del panel: el asunto, la línea en blanco y
 * los trailers —los dos de siempre (`Panel: sí`, `Panel-Autor:`) más los
 * que traiga `trailers`—. Exportada desde la Ronda 1 de la Tarea 11:
 * `borrador.ts` la reusa para el commit raíz del bootstrap, así los dos
 * caminos de escritura del ref del borrador (crear y mover) arman el
 * mensaje con la MISMA función, en vez de que uno lo escriba a mano y se
 * desincronice del otro en cuanto alguien toque solo uno de los dos.
 */
export function mensajeDeCommit(asunto: string, autor: string, trailers?: Record<string, string>): string {
  const extras = Object.entries(trailers ?? {}).map(([k, v]) => `${k}: ${v}`)
  return [asunto, '', 'Panel: sí', `Panel-Autor: ${autor}`, ...extras].join('\n')
}

/**
 * [Tarea 9, Ronda 1] La frase para cualquier error fuerte del lado de
 * GitHub —acá, en `traduceError()`, abajo—. Exportada porque `revierte()`
 * (revertir.ts) puede devolver este MISMO texto adentro de `detalle` cuando
 * `publica()` es quien falló, y `deshacerAccion` (acciones.ts) la reusa tal
 * cual para su propio error genérico: tenerla escrita en dos archivos era
 * la clase de duplicado que se desincroniza sola en cuanto alguien edite
 * uno de los dos sin acordarse del otro.
 */
export const PROBLEMA_NO_SE_PUDO_PUBLICAR =
  'No pudimos publicar: hubo un problema para conectarnos con el sitio. Prueba de nuevo en unos minutos.'

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
 * commit y —recién al final— mover el ref. Cada llamada a esta función
 * parte de leer el ref de nuevo: el reintento (E7 par de errores, regla del
 * controlador) arma el árbol sobre el commit NUEVO, nunca sobre el viejo —
 * repetir contra la base vieja sería pisar en silencio lo que Marcos acaba
 * de publicar.
 *
 * [Tarea 11] `ref` y `forzar` viajan por parámetro —nunca una constante
 * fija acá adentro— porque `publica()` los resuelve una sola vez (de
 * `p.ref`/`p.forzar`) y los pasa iguales al primer intento y al reintento:
 * ningún camino de este archivo vuelve a mirar `p` después de entrar acá.
 */
async function intento(
  gh: ReturnType<typeof cliente>,
  archivos: readonly Archivo[],
  mensaje: string,
  ref: string,
  forzar: boolean,
): Promise<string> {
  const { sha: shaDelRef } = await gh.ref(ref)
  const padre = await gh.commit(shaDelRef)

  const shasDeBlobs = await mapaConcurrencia(archivos, CONCURRENCIA_BLOBS, (a) => gh.creaBlob(a.contenido))

  const entradas: EntradaArbol[] = archivos.map((a, i) => ({ path: a.ruta, sha: shasDeBlobs[i] }))
  const arbol = await gh.creaArbol(padre.tree, entradas)

  const shaDelCommit = await gh.creaCommit({ mensaje, arbol, padre: padre.sha, autor: AUTOR_PANEL })
  try {
    await gh.mueveRef(ref, shaDelCommit, forzar)
  } catch (e) {
    // El commit ya quedó escrito en GitHub cuando esto revienta: se
    // envuelve el error con su sha para que el log (más abajo, en
    // `publica()`) pueda nombrar el objeto huérfano.
    throw new FalloAlMoverRef(e, shaDelCommit)
  }

  return shaDelCommit
}

/**
 * Publica un documento como un solo commit en el ref que pida `p.ref`
 * (`heads/main` si no lo pasa), o no publica nada.
 *
 * Orden, y por qué es ESE orden (regla del controlador): [Tarea 11] primero
 * la guardia del ref/`forzar` contra `REFS_CONOCIDOS` —un `throw`, no un
 * `Resultado`, porque es un bug de quien llama, no un dato malo—, después la
 * lista blanca —una ruta prohibida no gasta ni un pedido—, después leer el ref y
 * su commit, después los blobs en paralelo, después el árbol, después el
 * commit, y el `PATCH` del ref AL FINAL. Si cualquier paso anterior al
 * `PATCH` tira, el repo queda exactamente como estaba: nada apunta a los
 * objetos que se llegaron a crear.
 *
 * Si el `PATCH` choca porque el ref avanzó mientras tanto (alguien más
 * publicó), se reintenta UNA vez desde el principio —el árbol nuevo se arma
 * sobre el commit nuevo—. Si choca otra vez, es un 409 en español mexicano
 * que nombra a Marcos y no habla de refs ni de fast-forward (E7): el detalle
 * técnico va al log del servidor, no a la clienta. (Con `forzar: true` —el
 * ref del borrador— este choque no puede pasar: `force` le gana a la
 * protección de fast-forward, así que la rama de reintento queda para
 * `main`, que es la única que la necesita.)
 */
export async function publica(gh: ReturnType<typeof cliente>, p: Publicacion): Promise<Resultado> {
  const ref = p.ref ?? REF_MAIN
  const forzar = p.forzar ?? false

  // [Tarea 11, Ronda 1 hallazgo C] Regla POSITIVA: el ref tiene que estar en
  // el mapa, y no cualquier valor "distinto de main" alcanza. Un ref
  // desconocido truena ACÁ, ANTES de la lista blanca —ni siquiera importa
  // qué archivos traiga—, y es un `throw` (no un `Resultado`) por la misma
  // razón que el `forzar` mal puesto: es un bug de quien llama `publica()`,
  // nunca un dato malo que la clienta pueda haber mandado.
  //
  // [Ronda 2, hallazgo 2] `Object.hasOwn()`, no `REFS_CONOCIDOS[ref]` a
  // secas: `REFS_CONOCIDOS` es un objeto literal, y `ref` con un valor como
  // `'__proto__'`, `'constructor'` o `'toString'` indexa una propiedad
  // HEREDADA (de `Object.prototype`), no ausente — `!config` da `false`
  // porque esa propiedad heredada es truthy, así que la guardia de arriba no
  // dispara. Con eso, `config.permiteRuta` seguía adelante como `undefined`
  // y `revisaLote()` caía en SU propio default (`rutaPermitida`, la lista de
  // `main`) — publicando de verdad con la lista equivocada. Hoy `ref` nunca
  // sale de un dato que la clienta mande —así que no es explotable por
  // HTTP— pero contradecía por escrito la invariante que este mismo hallazgo
  // C fijó: un ref fuera del mapa truena, siempre. `Object.hasOwn()` cierra
  // la puerta trasera del prototipo sin importar qué tan disponible esté hoy.
  if (!Object.hasOwn(REFS_CONOCIDOS, ref)) {
    throw new Error(`publica(): "${ref}" no es un ref conocido — revisá REFS_CONOCIDOS en publicar.ts.`)
  }
  const config = REFS_CONOCIDOS[ref]
  if (forzar && !config.permiteForzar) {
    throw new Error(`publica(): forzar:true contra "${ref}" no es una opción — ese ref no lo permite.`)
  }

  const rutas = p.archivos.map((a) => a.ruta)
  const chequeo = revisaLote(rutas, p.bytesDelCuerpo ?? bytesDelCuerpo(p.archivos), config.permiteRuta)
  if (!chequeo.ok) return { ok: false, codigo: 422, problema: chequeo.problema }

  const asunto = p.cambios !== undefined ? frase(p.cambios) : ASUNTO_GENERICO
  if (asunto === '') {
    // p.cambios vino y no describe nada: no hay commit que valga la pena.
    // Ni un pedido a GitHub, igual que con la lista blanca.
    return { ok: true, sha: null, resumen: 'No había nada que publicar: no cambiaste ningún dato del sitio.' }
  }

  const mensaje = mensajeDeCommit(asunto, p.autor, p.trailers)

  try {
    const sha = await intento(gh, p.archivos, mensaje, ref, forzar)
    return { ok: true, sha, resumen: asunto }
  } catch (primerError) {
    if (!esConflictoDeRef(primerError)) return traduceError(primerError, p)

    if (p.reintentar === false) {
      // Perder la carrera acá no es un error fuerte: es el mismo 409 de
      // «alguien más publicó primero», pero SIN el segundo intento que
      // pisaría ese commit con los bytes viejos de esta reversión. Quien
      // llamó (`revierte()`) decide qué hacer con eso — típicamente, nada:
      // la próxima invocación relee la cabeza desde cero.
      const { status, mensaje: mensajeDeGitHub, sha } = analizaError(primerError)
      console.error(
        `publicar: el PATCH del ref chocó y no se reintenta —reintentar:false— (autor: ${p.autor}, archivos: ${rutas.join(', ')}` +
          `${sha ? `, commit huérfano: ${sha}` : ''}) — status ${status ?? '(sin status)'}: ${mensajeDeGitHub}`,
      )
      return {
        ok: false,
        codigo: 409,
        problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
      }
    }

    try {
      const sha = await intento(gh, p.archivos, mensaje, ref, forzar)
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
    problema: PROBLEMA_NO_SE_PUDO_PUBLICAR,
  }
}
