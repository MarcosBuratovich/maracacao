/*
 * El borrador del servidor (spec §4.3, capa 2; decisión B5). La capa 1
 * —IndexedDB, cada tecla— es de la fase 6; esta es la que hace que lo que
 * ella escribió a medias sobreviva a cambiar de aparato, y la que permite
 * el aviso de «tu hermana está editando desde hace diez minutos».
 *
 * Vive en `refs/panel/borrador`, FUERA de `refs/heads/`: la plataforma solo
 * mira ramas para decidir si dispara un deploy, así que este ref no
 * despliega nada, no ensucia la lista de ramas, y no hay nada que
 * configurar en ningún tablero (decisión B5 — borró una pregunta abierta
 * entera del spec).
 *
 * No tiene historia que preservar —es «lo último que ella escribió», no una
 * serie de commits que alguien vaya a revisar— así que cada guardado
 * reemplaza al anterior con `force: true`. Es la ÚNICA excepción de todo el
 * proyecto a la regla de `force: false`, y por eso está encerrada acá
 * adentro y en un solo lugar de `publicar.ts` (el mapa `REFS_CONOCIDOS`, que
 * es la única entrada con `permiteForzar: true`): nada de este archivo, ni
 * de ningún otro, puede mover `main` con force.
 *
 * [Ronda 1 de revisión] El primer diseño de este archivo hacía que el ref
 * apuntara, la primera vez, directo a un ÁRBOL —sin commit—. Se descartó: no
 * es que sea inválido para git en general (un tag anotado puede apuntar a
 * cualquier objeto), es que ESTE código no lo soporta —`gh.commit()` y
 * `archivoEnRef()` piden un sha de COMMIT y dan 404 con uno de árbol—, así
 * que el primer guardado andaba pero la primera LECTURA volvía 404 → el
 * borrador desaparecía en silencio, y desde ahí cada guardado reintentaba el
 * arranque y moría con «Reference already exists», para siempre. Por eso el
 * bootstrap arma un commit real, con un padre `null` (raíz, sin ancestro) en
 * vez de construir sobre `main`. La razón para que sea RAÍZ y no un commit
 * colgado de la cabeza actual de `main` no es solo prolijidad: **un commit
 * raíz no tiene ancestro común con `main`, así que `git merge` se niega en
 * seco** («refusing to merge unrelated histories»). Si en cambio el borrador
 * colgara de la historia de `main`, sería un candidato de merge válido
 * —fast-forward incluso— y `panel/borrador.json` podría terminar en el sitio
 * publicado con un comando de dedos gordos. Las dos listas blancas
 * (`rutas-permitidas.ts`) son un candado de SOFTWARE —código que puede tener
 * un bug—; el commit huérfano es un candado de MATEMÁTICA —no hay bug de
 * software que lo esquive, porque la operación que haría falta para
 * mergearlo no existe—.
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe el cliente de
 * GitHub ya armado y el reloj (`ahora`) por parámetro. No lee `process.env`
 * ni toca `globalThis.fetch`.
 */
import { cliente } from './github'
import { publica, AUTOR_PANEL, ASUNTO_GENERICO, mensajeDeCommit } from './publicar'
import { revisaLote, rutaDeBorradorPermitida, REF_BORRADOR } from './rutas-permitidas'

export { REF_BORRADOR }

/** La única ruta que este ref conoce. */
export const RUTA_BORRADOR = 'panel/borrador.json'

export interface Borrador {
  /** Los documentos a medio editar, con la misma forma que `publicar`. */
  documentos: Record<string, unknown>
  /** El sha del sitio contra el que se escribió. */
  base: string
  /** Qué aparato lo escribió, para el aviso de conflicto (spec §4.3). */
  dispositivo: string
  /** Quién, para «tu hermana está editando desde hace diez minutos». */
  autor: string
  /** Epoch ms. */
  hora: number
}

export type ResultadoGuardado =
  | { ok: true }
  | {
      ok: false
      motivo: 'hay-uno-mas-nuevo'
      /** El borrador que YA estaba ahí, y que este guardado no pisó. */
      otro: { dispositivo: string; hora: number }
    }
  | { ok: false; motivo: 'no-se-pudo-guardar'; problema: string }

/** ¿Este error de `github.ts` es un 404? La forma es la que arma `cliente()` (`GitHub respondió 404: ...`). */
function es404(e: unknown): boolean {
  return e instanceof Error && /^GitHub respondió 404:/.test(e.message)
}

/**
 * El resultado de intentar leer el ref del borrador, en sus TRES estados
 * posibles — no dos. [Ronda 1, hallazgo B] Antes solo había «existe, con un
 * borrador legible» o «no existe» (cualquier 404, de donde fuera, caía acá),
 * y un borrador con el JSON roto —o un ref que existe pero perdió su
 * archivo, el mismo bug que dejaba el diseño original— se leía IGUAL que
 * «no existe», así que `guarda()` intentaba CREAR un ref que ya estaba
 * ahí, GitHub contestaba «Reference already exists», y el panel quedaba en
 * un 502 permanente: para escribir un borrador nuevo hacía falta leer el
 * viejo primero, y leerlo era exactamente lo que fallaba.
 *
 * `'ilegible'` es el estado que le faltaba: el ref EXISTE (así que hay que
 * MOVERLO, nunca crearlo de nuevo) pero su contenido no se puede leer como
 * un `Borrador` de confianza. El diseño ya había decidido que «no puedo leer
 * el borrador» no le rompe la pantalla a ella —el 404 franco da `null`—; un
 * JSON corrupto es el mismo estado desde su lado, así que se trata igual
 * (mejor escribir encima y arreglarlo que bloquearla), pero SIN perder de
 * vista que el ref ya existe.
 */
type LecturaBorrador =
  | { estado: 'no-existe' }
  | { estado: 'ilegible'; sha: string }
  | { estado: 'ok'; sha: string; borrador: Borrador }

/**
 * Lee el ref y, si existe, el borrador que tiene adentro. Un solo lugar
 * para las dos cosas que hacen falta juntas: `leeBorrador()` (la acción
 * `borrador.leer`) solo necesita el borrador, pero `guarda()` necesita
 * TAMBIÉN saber si el ref existe —para decidir crear-vs-mover— sin volver a
 * pedirlo.
 */
async function intentaLeer(gh: ReturnType<typeof cliente>): Promise<LecturaBorrador> {
  let sha: string
  try {
    ;({ sha } = await gh.ref(REF_BORRADOR))
  } catch (e) {
    if (!es404(e)) throw e
    // [Ronda 1, hallazgo E3] Es el estado normal de un panel recién
    // estrenado, o de cualquier sesión antes del primer guardado — pero
    // GitHub también contesta 404 (nunca 403) cuando el TOKEN no tiene
    // permiso o el repo está mal escrito, por seguridad: no distingue «no
    // existe» de «no podés verlo». No se puede diferenciar desde acá, así
    // que esto queda como el estado normal para ELLA (ver `null` en
    // `leeBorrador`), pero el log es la única pista que le queda a Marcos
    // si en realidad es lo segundo.
    console.error(`borrador: ${REF_BORRADOR} no existe (404) — se trata como "no hay borrador todavía".`)
    return { estado: 'no-existe' }
  }

  let texto: string
  try {
    texto = await gh.archivoEnRef(RUTA_BORRADOR, sha)
  } catch (e) {
    if (!es404(e)) throw e
    // El ref existe pero perdió su archivo (nunca debería pasar con el
    // camino de escritura de este módulo, pero un ref es editable a mano).
    // Es "ilegible", no "no existe": el próximo guardado tiene que MOVER
    // este ref, no intentar crearlo de nuevo.
    console.error(`borrador: ${REF_BORRADOR} (${sha}) existe pero no tiene ${RUTA_BORRADOR} — se trata como ilegible.`)
    return { estado: 'ilegible', sha }
  }

  try {
    return { estado: 'ok', sha, borrador: JSON.parse(texto) as Borrador }
  } catch (e) {
    console.error(`borrador: el JSON de ${RUTA_BORRADOR} en ${sha} no parsea — se trata como ilegible.`, e)
    return { estado: 'ilegible', sha }
  }
}

/** Lee el borrador guardado, o `null` si no hay ninguno LEGIBLE. Nunca compara ni decide: eso es de la fase 6 (ver el docstring de `guarda`). */
export async function leeBorrador(gh: ReturnType<typeof cliente>): Promise<Borrador | null> {
  const actual = await intentaLeer(gh)
  return actual.estado === 'ok' ? actual.borrador : null
}

export interface DatosParaGuardar {
  documentos: Record<string, unknown>
  base: string
  dispositivo: string
  autor: string
  ahora: number
  /** Si hay que pisar el borrador de OTRO aparato aunque sea más nuevo. Default `false`. */
  pisar?: boolean
  /**
   * [Ronda 1, hallazgo D] Cuánto pesó el CUERPO del pedido HTTP, para
   * `revisaLote()` — misma razón que `Publicacion.bytesDelCuerpo`
   * (`publicar.ts`): es una cota REAL del cuerpo, y solo el borde la sabe.
   * Sin esto, el guardado de un borrador nunca podía chocar con el tope de
   * 3.5 MB, aunque el pedido HTTP que lo trajera sí lo hubiera pasado.
   */
  bytesDelCuerpo?: number
}

/** Cuánto pesaría, en bytes, el cuerpo que `creaBlob` mandaría por este contenido — misma cuenta que `publicar.ts`, para un solo archivo. */
function bytesDeContenido(contenido: string): number {
  return Buffer.from(contenido, 'utf8').toString('base64').length
}

/**
 * Guarda el borrador del servidor. NO resuelve ningún conflicto: escribe lo
 * que le llega, y lo único que decide por su cuenta es si hay que CREAR el
 * ref (primera vez) o MOVERLO (ya existía, legible o no) — nunca qué
 * preguntarle a ella sobre el contenido. Esa pantalla («celular, ayer 11:04,
 * 3 cambios» / «esta compu, hace 6 días, 1 cambio», spec §4.3) es de la fase
 * 6; `borrador.leer` (acciones.ts) le da el borrador del servidor tal cual
 * para que la arme.
 *
 * Lo único que SÍ hace acá, porque perder trabajo en silencio es el único
 * resultado inaceptable (mismo criterio que la Tarea 2 aplicó a publicar):
 * si YA hay un borrador LEGIBLE de OTRO dispositivo y es tan nuevo o más
 * nuevo que `ahora` (`>=`, no `>` — [Ronda 1, hallazgo E4] dos guardados del
 * mismo milisegundo desde aparatos distintos también cuentan como pisada, no
 * solo el estrictamente posterior), este guardado se rechaza —sin escribir
 * nada— salvo que venga `pisar: true`. Un borrador del MISMO dispositivo
 * nunca se rechaza a sí mismo (es la autoguardada normal de la fase 6, tecla
 * tras tecla).
 *
 * [Ronda 1, hallazgo E5] Un borrador SIN `hora` (o directamente ILEGIBLE)
 * nunca bloquea: se trata como más viejo que cualquier `ahora` real, así que
 * este guardado sigue adelante y lo pisa. Es la decisión correcta —mejor
 * escribir encima de un estado que no se puede leer que dejarla sin poder
 * guardar nunca más— pero tiene que estar declarada acá, con su test, no ser
 * un accidente de que `undefined >= numero` dé `false` en JavaScript.
 */
export async function guarda(gh: ReturnType<typeof cliente>, args: DatosParaGuardar): Promise<ResultadoGuardado> {
  const actual = await intentaLeer(gh)

  if (
    actual.estado === 'ok' &&
    !args.pisar &&
    actual.borrador.dispositivo !== args.dispositivo &&
    actual.borrador.hora >= args.ahora
  ) {
    return { ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: actual.borrador.dispositivo, hora: actual.borrador.hora } }
  }

  const contenido = JSON.stringify({
    documentos: args.documentos,
    base: args.base,
    dispositivo: args.dispositivo,
    autor: args.autor,
    hora: args.ahora,
  } satisfies Borrador)

  const bytes = args.bytesDelCuerpo ?? bytesDeContenido(contenido)

  if (actual.estado === 'no-existe') {
    // [Ronda 1, hallazgo D] El camino de arranque escribe a mano —no pasa
    // por `publica()`, ver más abajo— así que necesita SU PROPIO chequeo de
    // lista blanca y tope de cuerpo: los dos caminos (crear y mover) tienen
    // que pasar por la misma barrera antes de tocar GitHub para escribir.
    const chequeo = revisaLote([RUTA_BORRADOR], bytes, rutaDeBorradorPermitida)
    if (!chequeo.ok) return { ok: false, motivo: 'no-se-pudo-guardar', problema: chequeo.problema }

    // [Tarea 11] El ref no existe hasta que alguien guarda por primera vez
    // en la vida del panel. `publica()` no sirve para ESTE paso —su
    // `intento()` arranca leyendo el ref, y leer un ref que no existe
    // todavía es 404—, así que el bootstrap se arma a mano: un blob, un
    // árbol de un solo archivo SIN base (`creaArbol(null, ...)`: nunca
    // sobre el árbol de `main` — el árbol del borrador lleva SOLO
    // `panel/borrador.json`), un commit RAÍZ —`padre: null`, sin ancestro
    // común con `main` (ver el docstring del módulo, más arriba, sobre por
    // qué eso es EL candado, no un detalle)— y recién ahí el ref se CREA.
    // Sin este camino, el primer borrador de la vida del panel moriría con
    // un 404 que no le dice nada a nadie — y es el primer borrador, o sea
    // el peor momento para eso.
    const shaDelBlob = await gh.creaBlob(contenido)
    const shaDelArbol = await gh.creaArbol(null, [{ path: RUTA_BORRADOR, sha: shaDelBlob }])
    const shaDelCommit = await gh.creaCommit({
      mensaje: mensajeDeCommit(ASUNTO_GENERICO, args.autor),
      arbol: shaDelArbol,
      padre: null,
      autor: AUTOR_PANEL,
    })
    await gh.creaRef(REF_BORRADOR, shaDelCommit)
    return { ok: true }
  }

  // Ya existe —legible o no—: de acá en más es una publicación cualquiera,
  // nomás que al ref del borrador y con `forzar: true` — reusa TODA la
  // mecánica de `publica()` (un commit, o ninguno; nunca a medio escribir,
  // y SU PROPIA lista blanca vía `REFS_CONOCIDOS`) en vez de repetirla a
  // mano. `bytesDelCuerpo` viaja para que el tope de `publica()` sea el
  // real, no el que `publica()` calcularía solo (que también sería
  // correcto, pero con menos margen — ver `Publicacion.bytesDelCuerpo`).
  const r = await publica(gh, {
    archivos: [{ ruta: RUTA_BORRADOR, contenido }],
    autor: args.autor,
    ref: REF_BORRADOR,
    forzar: true,
    bytesDelCuerpo: bytes,
  })
  return r.ok ? { ok: true } : { ok: false, motivo: 'no-se-pudo-guardar', problema: r.problema }
}
