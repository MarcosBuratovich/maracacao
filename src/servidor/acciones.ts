/*
 * El router de `/api/panel`: la compuerta que de verdad decide si algo
 * entra al sitio. Delgado a propósito —valida la sesión, revalida el
 * contenido completo con el MISMO `validar()` que corre en el navegador y
 * en la suite, y delega— porque la revalidación del servidor no es
 * redundante: es la única capa que no se puede saltear desde el otro
 * lado. El navegador puede mentir; esto no.
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe TODO por
 * `Contexto` —las variables, `fetch`, el reloj, la IP— así que la suite lo
 * ejercita entero sin red y sin secretos. El único archivo que lee
 * `process.env` y toma `fetch` del global es el borde
 * (`entradas/panel.ts`); acá adentro, si hace falta cualquiera de esas dos
 * cosas, llega por parámetro.
 *
 * Las tres acciones de esta parte son las de E8: `entrar` (contraseña →
 * cookie), `publicar` (documento → commit) y `salud` (¿están las
 * variables?, ¿responde GitHub?). Cualquier otra acción —la Parte B las va
 * a agregar— contesta 404, nunca 500: así el panel puede preguntar por una
 * acción que todavía no existe sin que se le caiga la página.
 */
import {
  claveCorrecta, hashDeClave, firmaSesion, verificaSesion, cookieDeSesion, intentoPermitido, LARGO_MIN_SECRETO,
  type Sesion,
} from './sesion'
import { cliente } from './github'
import { publica, type Archivo } from './publicar'
import { revierte, TRAILER_REVIERTE, tieneTrailer, valorDeTrailer, autorDelCommit } from './revertir'
import type { Cambio } from '../contenido/diff'
import { resume } from '../contenido/diff'
import { validarContra, type Problema } from '../contenido/validacion'
import { serializa } from '../contenido/carga'
import { injerta, type FuentesDeDerivados } from '../contenido/derivados'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'
import type { Carta, ResultadoCorreo } from './correo'
import { clienteVercel, type EstadoDeDespliegue } from './vercel'
import { decide, SITIO } from './estado'

/** Lo que le llega al router, ya despojado de HTTP: el borde lo arma. */
export interface Pedido {
  /** El cuerpo del pedido, crudo —sin parsear más de lo que ya hizo el borde. */
  cuerpo: unknown
  /** El valor de la cookie de sesión (`panel_sesion`), o `''` si no vino. */
  cookie: string
}

/**
 * Las variables de entorno que el router necesita, ya leídas por el borde.
 * Todas opcionales porque en producción PUEDEN faltar —de eso avisa
 * `salud`— y acá adentro se manejan como ausentes, nunca como un `throw`
 * a mitad de un pedido de la clienta.
 */
export interface Entorno {
  PANEL_CLAVE_HASH?: string
  PANEL_SECRETO?: string
  PANEL_CORREOS?: string
  PANEL_GITHUB_TOKEN?: string
  GITHUB_DUENIO?: string
  GITHUB_REPO?: string
  /**
   * ISO 8601. Toda sesión emitida ANTES de esta fecha deja de valer: es el
   * «cerrar sesión en todos lados» sin rotar `PANEL_SECRETO` —que además de
   * desloguear a todo el mundo invalidaría los enlaces mágicos en vuelo—.
   * Ausente = no hay revocación por fecha.
   */
  PANEL_SESIONES_DESDE?: string
  /**
   * Ids de dispositivo separados por comas. La revocación quirúrgica: el
   * celular perdido de alguien que sigue teniendo acceso.
   */
  PANEL_DISPOSITIVOS_REVOCADOS?: string
  /**
   * Token de la API de la plataforma. Es OBLIGATORIO (spec §4.5): sin él no
   * se puede saber si el deploy terminó ni revertir solo, y publicar a
   * ciegas es peor que no publicar — ella cree que publicó, vende al precio
   * nuevo, y el cliente le muestra el celular con el precio viejo.
   */
  PANEL_VERCEL_TOKEN?: string
  /** El nombre del proyecto en la plataforma. Por defecto, el del repo. */
  PANEL_VERCEL_PROYECTO?: string
  /** La clave del proveedor de correo. Ausente = los avisos no se mandan (B3). */
  RESEND_API_KEY?: string
  /** `Panel Maracacao <panel@maracacao.mx>`, verificado en el proveedor. */
  PANEL_REMITENTE?: string
  /**
   * A quién avisarle cuando algo sale MAL (el deploy falló, el token está por
   * vencer). Es la dirección de Marcos, no la de la clienta: a ella se le
   * avisa a su propio correo de sesión, que el panel ya conoce.
   */
  PANEL_AVISOS_A?: string
}

/** Todo lo que `maneja()` necesita del mundo exterior, inyectado. */
export interface Contexto {
  env: Entorno
  fetch: typeof globalThis.fetch
  /** El reloj. Nunca `Date.now()` llamado directo acá adentro: así un test lo puede fijar. */
  ahora: () => number
  /** La IP de quien pide, para el freno de intentos de `entrar` (E4). */
  ip: string
  /**
   * Cuántos bytes pesó el CUERPO del pedido HTTP, o `undefined` cuando el
   * borde no lo pudo medir (sin `Content-Length` legible). Vive en el
   * contexto y no en el `Pedido` porque no es un dato del pedido de la
   * clienta —ella no lo manda—: es una medición del transporte, del mismo
   * tipo que la IP.
   *
   * [RULING T1-1] `undefined` y NO un `0` centinela. Con `0`, «no lo sé» y
   * «midió cero» son el mismo valor, y `p.bytesDelCuerpo ?? suma(...)` en
   * `publica()` se queda con el `0` —`??` solo cae ante `null`/`undefined`—,
   * así que el tope de cuerpo queda desactivado justo en el caso que el
   * fallback existía para cubrir. Que el tipo diga la verdad mata la clase
   * entera de bug; un `||` o un spread condicional solo la tapan en este
   * llamador y dejan la trampa armada para el siguiente.
   */
  bytesDelCuerpo?: number
  /**
   * Mandar un aviso, ya atado a las credenciales por el borde. Las acciones
   * no conocen la clave ni el remitente: piden «mandá esto» y listo. Así, un
   * test le pasa una función que anota las cartas en una lista y verifica
   * QUÉ se avisa sin tocar la red ni ninguna clave.
   */
  correo: (carta: Carta) => Promise<ResultadoCorreo>
}

/** Lo que devuelve el router. El borde lo traduce a una respuesta HTTP real. */
export interface Respuesta {
  status: number
  cuerpo: unknown
  /** El `Set-Cookie` completo (con `HttpOnly` y compañía), solo cuando `entrar` tiene éxito. */
  cookie?: string
}

const ok = (cuerpo: unknown, cookie?: string): Respuesta => ({ status: 200, cuerpo, cookie })
const error = (status: number, problema: string, campo?: string): Respuesta => ({
  status,
  cuerpo: campo === undefined ? { ok: false, problema } : { ok: false, problema, campo },
})

// La misma frase para CUALQUIER falla de configuración que `entrar` o
// `publicar` detecten antes de hacer nada (C-1: `PANEL_SECRETO` ausente o
// corto) — nunca jerga, nunca el nombre de la variable (E7). Vive acá
// arriba, no solo en el router de más abajo, porque estas dos acciones
// también la usan y `maneja()` no es el único lugar que puede necesitar
// avisar «esto no es culpa tuya, es nuestra».
const PROBLEMA_INESPERADO = 'Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.'

/**
 * [C-1] ¿Hay un `PANEL_SECRETO` con el que de verdad se puede firmar o
 * verificar una cookie? La ausencia total (`undefined`) y un valor
 * cargado pero demasiado corto se tratan IGUAL —ninguno de los dos sirve—
 * así que `entrar` y `publicar` frenan ACÁ, antes de intentar nada, en vez
 * de dejar que `firmaSesion`/`verificaSesion` lo resuelvan más adentro:
 * esas dos ya tienen su propio candado (tira una, devuelve `null` la
 * otra), pero ese candado existe para el día en que ESTE chequeo se
 * rompa, no para reemplazarlo. Devolver acá un 503 franco, con el nombre
 * de la variable en el log, es lo que le dice a Marcos QUÉ falta en vez
 * de dejar que la clienta vea un 401 de «contraseña incorrecta» que no
 * tiene nada que ver con su contraseña.
 */
function secretoUtilizable(env: Entorno): env is Entorno & { PANEL_SECRETO: string } {
  return typeof env.PANEL_SECRETO === 'string' && env.PANEL_SECRETO.length >= LARGO_MIN_SECRETO
}

/*
 * ---------------------------------------------------------------------
 * entrar
 * ---------------------------------------------------------------------
 */

// Un solo texto para las DOS formas de fallar por CREDENCIALES (correo
// fuera de la lista, contraseña incorrecta): a quien intenta entrar sin
// permiso no se le dice CUÁL de las dos fue — así el login no sirve para
// averiguar qué direcciones tienen acceso. Nunca menciona «correo»,
// «usuario» ni «existe» — un test lo vigila letra por letra.
//
// [RULING T6-a, coordinador] el freno de intentos (E4) NO es una tercera
// forma de fallar por credenciales: es una cosa distinta, con su propia
// respuesta (429, más abajo). Antes las tres —freno, correo, clave— caían
// acá adentro con el mismo texto; separarlas es justo lo que le permite a
// la clienta ver «demasiados intentos» en vez de una sexta «contraseña
// incorrecta» inexplicable.
const PROBLEMA_ENTRAR = 'No se pudo entrar: revisa tus datos y vuelve a intentar.'

// El freno de intentos SÍ se anuncia (a diferencia de las credenciales):
// no delata si la dirección tiene acceso —el freno es por IP, no por
// correo— y un atacante que mide el tiempo entre intentos ya se daría
// cuenta de que existe, así que ocultarlo no protege nada y confunde a la
// clienta de verdad.
const PROBLEMA_DEMASIADOS_INTENTOS = 'Demasiados intentos. Espera 15 minutos y vuelve a probar.'

/** Treinta días por defecto; un año si el cuerpo marca el aparato como propio (E3). */
const DIAS_SESION_LARGA = 365
const DIAS_SESION_CORTA = 30

function correoEnLista(correo: string, lista: string | undefined): boolean {
  if (!lista) return false
  return lista
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .includes(correo.trim().toLowerCase())
}

/**
 * [I-3] Un hash señuelo, derivado UNA sola vez cuando el módulo carga, con
 * una contraseña que no es la de nadie y que nunca se usa para entrar a
 * ningún lado. `entrar()` lo usa cuando el correo del pedido NO está en
 * `PANEL_CORREOS`, para que `claveCorrecta()` —que corre scrypt de
 * verdad— se llame igual de despacio esté o no el correo en la lista.
 *
 * Por qué hace falta: `correoOk && claveCorrecta(...)` corta camino apenas
 * `correoOk` da falso, así que un correo que no está en la lista nunca
 * llega a correr scrypt. Medido en esta rama: ~107 ms con un correo
 * listado y contraseña mala (scrypt corrió) contra ~0.03 ms con un correo
 * no listado (scrypt NI SE LLAMÓ) — una diferencia de ~3800 veces que
 * cualquiera puede medir de afuera con un solo pedido, y que le contesta
 * la pregunta «¿esta dirección tiene acceso?» con el reloj, sin que la
 * respuesta HTTP diga una palabra.
 */
const HASH_SENUELO = hashDeClave('señuelo — nunca es la contraseña de nadie, existe solo para parejar el reloj')

/**
 * La forma del cuerpo que espera `entrar`. `correo`/`clave` son el
 * contrato real (E2); `recuerdame`/`dispositivo` NO están fijados por
 * ningún spec todavía —la Fase 5 Parte B, la pantalla de verdad, no
 * existe— así que son una invención de ESTA tarea, no un contrato ya
 * acordado con el front. Cuando se escriba la pantalla, confirmar o
 * cambiar esta forma ahí, no acá.
 */
interface CuerpoEntrar {
  correo?: unknown
  clave?: unknown
  /** Si la clienta marcó «recordar este aparato» en el formulario. */
  recuerdame?: unknown
  /** Un identificador de aparato que arma el navegador; solo para el registro de la sesión. */
  dispositivo?: unknown
}

/**
 * [RULING T3-1] El id de dispositivo llega del navegador y hoy es texto
 * libre: el panel manda lo que quiera. Eso choca de frente con
 * `PANEL_DISPOSITIVOS_REVOCADOS`, que es una lista separada por comas — un
 * id con una coma adentro («iPhone 15, de Marcos») se parte al leer la
 * lista, ninguno de los dos pedazos coincide con el id entero que viaja en
 * la cookie, y **la revocación falla en silencio justo cuando Marcos cree
 * haberla hecho bien**. Está medido: con ese id, `publicar` sigue pasando.
 *
 * Se arregla en el ORIGEN y no en el lector: acá, donde el id entra al
 * sistema por primera vez, se lo normaliza a un alfabeto que no puede
 * romper ninguna lista. Arreglarlo del lado de `listaTiene` —escapando, o
 * cambiando el separador— dejaría el id crudo dando vueltas por el resto
 * del sistema para que el próximo lugar que lo use se vuelva a tropezar.
 *
 * Que dos aparatos con nombres parecidos colapsen al mismo id es un costo
 * aceptable hoy: el id de hoy lo elige el navegador y no identifica nada
 * por sí solo. La fase 6, cuando dibuje la pantalla de «¿desde qué aparato
 * estás editando?», va a querer separar las dos cosas —un id opaco que
 * genera el servidor para revocar, y una etiqueta legible para mostrar— y
 * ese es el momento de hacerlo, con la pantalla delante.
 */
export const idDeDispositivo = (crudo: unknown): string => {
  const texto = typeof crudo === 'string' ? crudo : ''
  const limpio = texto.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
  return limpio === '' ? 'sin-nombre' : limpio
}

/**
 * `entrar`: contraseña → cookie (E2, E3, E4).
 *
 * Capas separadas, cada una con su propia respuesta (RULING T6-a, y C-1
 * más abajo):
 *
 * 1. El freno de intentos por IP (E4) corre PRIMERO y aparte. Si ya se
 *    gastaron los cinco intentos de la ventana, 429 — y ni siquiera se
 *    mira si el correo está en la lista o si la contraseña de ESTE
 *    pedido era la correcta.
 * 2. [C-1] `PANEL_SECRETO` tiene que servir para firmar de verdad. Si
 *    falta o es demasiado corto, 503 —nunca un 401 que confunda a la
 *    clienta haciéndole creer que el problema es SU contraseña— y el log
 *    nombra la variable para Marcos.
 * 3. Recién con las dos anteriores pasadas, un Y de dos condiciones —el
 *    correo está en la lista, y la contraseña es correcta— pero las DOS
 *    mitades siempre corren scrypt (I-3): si el correo no está en la
 *    lista, `claveCorrecta` igual se llama, contra `HASH_SENUELO` en vez
 *    de contra el hash real, para que el tiempo de respuesta no delate
 *    si esa dirección tiene acceso. Cualquiera de las dos que falle da
 *    el MISMO 401 con el MISMO texto: quien pregunta no se entera cuál
 *    de las dos fue.
 */
function entrar(pedido: Pedido, contexto: Contexto): Respuesta {
  const cuerpo = (pedido.cuerpo ?? {}) as CuerpoEntrar
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : ''
  const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : ''

  if (!intentoPermitido(contexto.ip, contexto.ahora())) {
    return error(429, PROBLEMA_DEMASIADOS_INTENTOS)
  }

  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('entrar: PANEL_SECRETO falta o mide menos de 32 caracteres — no se puede firmar ninguna sesión.')
    return error(503, PROBLEMA_INESPERADO)
  }

  // [I-3] `claveCorrecta` SIEMPRE se llama —como sentencia propia, no
  // adentro de un `&&` que la salte— contra el hash real si el correo
  // está en la lista, contra el señuelo si no. Recién DESPUÉS se combina
  // con `correoOk`: así el tiempo que tarda `entrar` no depende de si esa
  // dirección tiene acceso, solo de que scrypt corrió una vez.
  const correoOk = correoEnLista(correo, env.PANEL_CORREOS)
  const hashContraElQueComparar = correoOk ? (env.PANEL_CLAVE_HASH ?? '') : HASH_SENUELO
  const claveEsLaDelHash = claveCorrecta(clave, hashContraElQueComparar)
  const claveOk = correoOk && claveEsLaDelHash

  if (!claveOk) return error(401, PROBLEMA_ENTRAR)

  const dias = cuerpo.recuerdame === true ? DIAS_SESION_LARGA : DIAS_SESION_CORTA
  const dispositivo = idDeDispositivo(cuerpo.dispositivo)
  const vence = contexto.ahora() + dias * 86_400_000

  const token = firmaSesion({ correo, vence, dispositivo, emitida: contexto.ahora() }, env.PANEL_SECRETO)
  return ok({ ok: true }, cookieDeSesion(token, dias))
}

/*
 * ---------------------------------------------------------------------
 * publicar
 * ---------------------------------------------------------------------
 */

const PROBLEMA_SESION = 'Tu sesión no es válida: vuelve a entrar.'
const PROBLEMA_SIN_DOCUMENTOS = 'No mandaste ningún documento para publicar.'
const PROBLEMA_NO_SE_PUDO_LEER = 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.'
const SIN_CAMBIOS = 'No había nada que publicar: no cambiaste ningún dato del sitio.'

// Una publicación sin `base` no es un pedido viejo que se pueda atender con
// buena voluntad: es un pedido que no declara contra qué versión del sitio se
// escribió, y atenderlo es justamente cómo se pisa el trabajo de otro sin que
// nadie se entere. A la clienta no se le explica nada de esto —no es su
// problema ni su vocabulario—: se le dice que vuelva a abrir el panel, que es
// lo que de verdad lo arregla (el panel nuevo manda `base`).
const PROBLEMA_SIN_BASE = 'No pudimos publicar: vuelve a abrir el panel y hazlo de nuevo.'

// La MISMA frase que devuelve `publica()` cuando el `PATCH` del ref choca dos
// veces (publicar.ts). Es el mismo hecho contado dos veces —«alguien movió el
// sitio mientras editabas»— y tiene que sonar igual, se detecte antes (acá,
// comparando shas) o después (allá, al chocar el ref).
const PROBLEMA_PISARIA = 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.'

const RUTA_DEL_DOCUMENTO = (id: IdDocumento): string => `src/contenido/datos/${id}.json`

const esIdDocumento = (v: string): v is IdDocumento => Object.prototype.hasOwnProperty.call(DOCUMENTOS, v)

/** Un objeto llano, no `null` ni una lista — la forma mínima que `documentos` tiene que tener. */
function comoDocumentos(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

/**
 * Las fuentes de los cinco derivados de `sitio` (`DERIVADOS_DEL_SITIO` en
 * derivados.ts), sacadas de un documento de `sabores` crudo — sea el que
 * vino en el mismo lote o el que se acaba de leer vivo de GitHub. Misma
 * forma que `injerta()` exige (`FuentesDeDerivados`): la lista de barras,
 * para el «desde» y el «de N» del anaquel, y la de gotas, para su propio
 * «desde» y el precio del jengibre. Nunca tira: si el documento vino
 * incompleto, listas vacías hacen que `injerta()` sea quien tire —con un
 * mensaje que nombra el cálculo, no esta función— y esa excepción la
 * atrapa el catch-all de `maneja()` (E7).
 */
function fuentesDeSabores(v: unknown): FuentesDeDerivados {
  const doc = (v ?? {}) as { sabores?: unknown; gotas?: unknown }
  return {
    sabores: (Array.isArray(doc.sabores) ? doc.sabores : []) as FuentesDeDerivados['sabores'],
    gotas: (Array.isArray(doc.gotas) ? doc.gotas : []) as FuentesDeDerivados['gotas'],
  }
}

/**
 * La única puerta de las acciones autenticadas. Cuatro candados, en este
 * orden y por esta razón:
 *
 *   1. La FIRMA y el vencimiento (`verificaSesion`): sin eso, todo lo demás
 *      estaría decidiendo sobre datos que escribió quien sea.
 *   2. `PANEL_CORREOS` de HOY: revoca a una PERSONA. Ya estaba en la Parte A
 *      —una cookie firmada hace un año no puede seguir publicando solo
 *      porque la firma es válida—; acá se centraliza para que no haya que
 *      acordarse de copiarlo en cada acción nueva.
 *   3. `PANEL_SESIONES_DESDE`: revoca TODAS las sesiones anteriores a una
 *      fecha. Es el botón de pánico.
 *   4. `PANEL_DISPOSITIVOS_REVOCADOS`: revoca UN aparato.
 *
 * Una fecha que no parsea se trata como «revocá todo», no como «no hay
 * revocación»: un typo en una variable de entorno no puede ser la forma
 * accidental de desactivar el botón de pánico. Marcos lo ve enseguida
 * —nadie puede entrar— y lo arregla; al revés no lo vería nunca.
 */
function sesionVigente(cookie: string, env: Entorno & { PANEL_SECRETO: string }, ahora: number): Sesion | null {
  const sesion = verificaSesion(cookie, env.PANEL_SECRETO, ahora)
  if (!sesion) return null
  if (!correoEnLista(sesion.correo, env.PANEL_CORREOS)) return null

  if (env.PANEL_SESIONES_DESDE) {
    const desde = Date.parse(env.PANEL_SESIONES_DESDE)
    if (!Number.isFinite(desde)) {
      console.error(
        `sesión: PANEL_SESIONES_DESDE no es una fecha que se pueda leer («${env.PANEL_SESIONES_DESDE}») — ` +
          'se rechaza toda sesión hasta que se corrija.',
      )
      return null
    }
    if (sesion.emitida < desde) return null
  }

  if (listaTiene(env.PANEL_DISPOSITIVOS_REVOCADOS, sesion.dispositivo)) return null

  return sesion
}

/** ¿Está `valor` en una lista separada por comas, ignorando espacios alrededor? */
function listaTiene(lista: string | undefined, valor: string): boolean {
  if (!lista) return false
  return lista.split(',').some((x) => x.trim() === valor)
}

/*
 * ---------------------------------------------------------------------
 * la reversión automática (Tarea 8, spec §4.6)
 * ---------------------------------------------------------------------
 */

// El correo para ella, siempre el mismo texto: para que el correo y lo que
// ve en pantalla no cuenten dos historias distintas. Nada técnico (B10) —
// [F-5] `test/acciones.test.ts` lo pasa por `JERGA_PROHIBIDA`.
const ASUNTO_PARA_ELLA = 'Tu cambio no se pudo publicar'
const TEXTO_PARA_ELLA = 'No salió; lo dejé como estaba y ya le avisé a Marcos.\n\nPuedes volver a intentarlo cuando quieras.'

/**
 * [F-2] Manda una carta protegida por su propio `try`. `manda()` (correo.ts)
 * promete no tirar nunca, pero esa es una promesa de OTRO módulo: la de esta
 * función —y la de quien la llama, `revierteYAvisa*`— es no hacer fallar a
 * quien pidió la acción, y depender en silencio de que otro módulo cumpla su
 * contrato es exactamente la clase de acoplamiento que un `try` de una línea
 * evita gratis.
 */
async function mandaProtegido(contexto: Contexto, carta: Carta): Promise<void> {
  try {
    await contexto.correo(carta)
  } catch (e) {
    console.error('revertir: el envío de un correo de aviso reventó —', e)
  }
}

/**
 * Corre `revierte()` protegido por su propio `try`, y arma el resumen para
 * el log/correo de Marcos. Compartido por las dos rutas de aviso —la de
 * `estadoAccion` y la de `revisaLaCabeza()`—: las dos necesitan exactamente
 * esto, y solo cambia a quién más se le avisa después.
 *
 * [D] `nada-que-revertir` se cuenta con sus propias palabras: no es un
 * `revertido` (el commit roto se queda en `main`) ni entra en el genérico
 * «NO se pudo revertir», que suena a que algo salió mal cuando lo que pasó
 * es que no había NADA de contenido que revertir.
 */
async function intentaRevertir(gh: ReturnType<typeof cliente>, sha: string, autor: string): Promise<string> {
  try {
    const r = await revierte(gh, { sha, autor })
    if (r.ok) return `revertido (commit ${r.sha ?? 'sin cambios'})`
    if (r.motivo === 'nada-que-revertir') {
      console.error(`revertir: ${sha} no tenía nada que revertir — main sigue con el commit roto (${r.detalle}).`)
      return 'no había nada que revertir: el commit no tocó ningún documento de contenido'
    }
    console.error(`revertir: la reversión automática de ${sha} no se pudo hacer — ${r.motivo}: ${r.detalle}`)
    return `NO se pudo revertir: ${r.motivo} — ${r.detalle}`
  } catch (e) {
    console.error(`revertir: la reversión automática de ${sha} reventó —`, e)
    return `NO se pudo revertir: ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Solo el correo a ella — sin intentar (de nuevo) el revert. Ver el uso en `estadoAccion`, más abajo. */
async function avisaAElla(correoDeElla: string, contexto: Contexto): Promise<void> {
  await mandaProtegido(contexto, { a: [correoDeElla], asunto: ASUNTO_PARA_ELLA, texto: TEXTO_PARA_ELLA })
}

/**
 * Deshace un commit cuyo despliegue falló y avisa a las DOS personas: es el
 * camino de `estadoAccion`, el único momento en que ella está esperando el
 * resultado de SU publicación (Ronda 2, Grupo B).
 *
 * Es `void` a propósito: lo que sale por HTTP es el veredicto —«no salió; lo
 * dejé como estaba»—, que ya es verdad haya podido revertir o no (el sitio
 * sigue sirviendo el último despliegue bueno; esa es la capa 3 de la
 * compuerta). Si la reversión falla, eso es un problema de Marcos, no de
 * ella: va entero al log y al correo de él.
 *
 * [B3] El correo degrada: que no esté configurado no puede impedir que el
 * repo vuelva a estar sano.
 */
async function revierteYAvisa(sha: string, correoDeElla: string, contexto: Contexto): Promise<void> {
  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  const resumen = await intentaRevertir(gh, sha, correoDeElla)

  await avisaAElla(correoDeElla, contexto)

  // A Marcos: todo. El sha, qué pasó con la reversión, y a dónde mirar.
  const paraMarcos = contexto.env.PANEL_AVISOS_A
  if (paraMarcos) {
    await mandaProtegido(contexto, {
      a: [paraMarcos],
      asunto: `[panel] El deploy de ${sha.slice(0, 7)} falló`,
      texto: [
        `El commit ${sha} publicado por ${correoDeElla} no construyó.`,
        `Reversión automática: ${resumen}.`,
        '',
        'El sitio sigue sirviendo el último deploy bueno.',
      ].join('\n'),
    })
  }
}

/**
 * Deshace un commit cuyo despliegue falló y avisa SOLO a Marcos: es el
 * camino de `revisaLaCabeza()`, la red de seguridad (Ronda 2, Grupo B).
 *
 * [B] Nadie está mirando el panel cuando esto corre —si alguien estuviera
 * mirando, sería `estadoAccion` quien lo atendería—, así que no hay a quién
 * más avisarle del lado de la clienta en este mismo instante. Y el correo NO
 * le atribuye el commit a quien disparó la acción que trajo esta limpieza
 * (Marcos entrando al panel, por ejemplo): `autorReal` sale del trailer
 * `Panel-Autor:` del propio commit, que es quien de verdad lo publicó.
 */
async function revierteYAvisaAMarcos(sha: string, autorReal: string, contexto: Contexto): Promise<void> {
  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  const resumen = await intentaRevertir(gh, sha, autorReal)

  const paraMarcos = contexto.env.PANEL_AVISOS_A
  if (paraMarcos) {
    await mandaProtegido(contexto, {
      a: [paraMarcos],
      asunto: `[panel] El deploy de ${sha.slice(0, 7)} falló`,
      texto: [
        `El commit ${sha} publicado por ${autorReal} no construyó (nadie tenía el panel abierto).`,
        `Reversión automática: ${resumen}.`,
        '',
        'El sitio sigue sirviendo el último deploy bueno.',
      ].join('\n'),
    })
  }
}

/**
 * [B1] La red de seguridad del revert automático.
 *
 * `estadoAccion` revierte cuando VE el fracaso, pero eso exige que alguien
 * esté mirando. Si ella publicó y guardó el teléfono —que es lo que el spec
 * §4.5 dice que va a hacer, y tiene razón—, el fracaso ocurre con el panel
 * cerrado y nadie lo ve. Entonces lo primero que hace cualquier acción
 * autenticada (después de sus propias validaciones baratas, Grupo C) es
 * preguntar si la cabeza de `main` es un commit del panel cuyo despliegue
 * falló, y si lo es, arreglarlo ANTES de hacer lo suyo.
 *
 * El costo de estar equivocado es un pedido de más a la plataforma por acción.
 * El costo de no tenerlo es que el commit malo se quede en `main` y la próxima
 * publicación falle sin que ella haya tocado nada — el WhatsApp que el panel
 * viene a matar.
 *
 * Dónde se llama: como PRIMERA cosa (después de las validaciones baratas y
 * sincrónicas de cada acción) de `estadoAccion` y `publicarAccion` — en
 * `publicarAccion`, antes del chequeo de `base` (Tarea 2): si la cabeza está
 * rota y se revierte, la cabeza cambia, y comparar contra la vieja daría un
 * 409 por un commit que acaba de dejar de existir. `historialAccion` (Tarea
 * 10) todavía no existe; cuando se escriba, corre esto primero también.
 *
 * [B] Devuelve el sha que atendió —el que era la cabeza rota, no el de la
 * reversión nueva— o `null` si no había nada que hacer. `estadoAccion` lo usa
 * para no revertir NI avisar dos veces por el mismo sha: si esto ya lo
 * atendió (y ya le avisó a Marcos), lo único que falta es avisarle a ELLA.
 */
async function revisaLaCabeza(contexto: Contexto): Promise<string | null> {
  // Todo lo de acá adentro es "mejor esfuerzo": si algo falla, se loguea y se
  // sigue. Esta función NUNCA puede hacer fallar la acción que la llamó — sería
  // impedirle publicar por culpa de una limpieza que ni pidió.
  try {
    if (!contexto.env.PANEL_VERCEL_TOKEN) return null

    const gh = cliente({
      token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
      duenio: contexto.env.GITHUB_DUENIO ?? '',
      repo: contexto.env.GITHUB_REPO ?? '',
      fetch: contexto.fetch,
    })

    const cabeza = await gh.ref('heads/main')
    const commit = await gh.commit(cabeza.sha)

    // [F-4] Anclado por línea (`tieneTrailer`/`valorDeTrailer`, revertir.ts):
    // un commit a mano que solo MENCIONE «Panel: sí» en su cuerpo no puede
    // colarse como si fuera del panel.
    if (!tieneTrailer(commit.message, 'Panel: sí')) return null
    // Solo los commits del panel, y solo los que no son ya una reversión: sin
    // el segundo chequeo, un revert cuyo propio deploy falla se revertiría a
    // sí mismo, y así para siempre.
    if (valorDeTrailer(commit.message, TRAILER_REVIERTE) !== undefined) return null

    // [F-1] Misma expresión que la acción vecina (`estadoAccion`, más abajo):
    // si ninguna de las dos variables está cargada, esto no puede seguir en
    // silencio preguntándole a la plataforma por un proyecto sin nombre —eso
    // vuelve como «no hay despliegues», `estado !== 'falló'`, y la reversión
    // automática deja de existir sin una sola línea de log.
    const proyecto = contexto.env.PANEL_VERCEL_PROYECTO ?? contexto.env.GITHUB_REPO ?? ''
    if (proyecto === '') {
      console.error('revisaLaCabeza: ni PANEL_VERCEL_PROYECTO ni GITHUB_REPO están cargadas — no sé por qué proyecto preguntar.')
      return null
    }

    const vercel = clienteVercel({ token: contexto.env.PANEL_VERCEL_TOKEN, proyecto, fetch: contexto.fetch })
    const { estado } = await vercel.despliegueDe(cabeza.sha)
    if (estado !== 'falló') return null

    // El autor real —para el correo de Marcos— sale del propio trailer del
    // commit, nunca de quien disparó esta limpieza.
    const autorReal = autorDelCommit(commit.message) ?? 'alguien del panel'

    console.error(`revisaLaCabeza: ${cabeza.sha} es un commit del panel cuyo despliegue falló — revirtiendo.`)
    await revierteYAvisaAMarcos(cabeza.sha, autorReal, contexto)
    return cabeza.sha
  } catch (e) {
    console.error('revisaLaCabeza: no se pudo revisar la cabeza de main —', e)
    return null
  }
}

/**
 * `publicar`: documento → commit (E5, E6, E7).
 *
 * [RULING T6-d, coordinador] «lo actual» NO puede salir de un `import`
 * estático de los JSON bajo `src/contenido/datos/`: esbuild los congela
 * en `api/panel.js` en el momento de empaquetar (`pnpm bundle:api`), así
 * que son la foto de ESE momento, no lo que GitHub tiene ahora. Con esa
 * foto, publicar A→B y enseguida republicar A comparaba A contra la FOTO
 * —que también era A—, veía «sin cambios» y contestaba `ok: true` sin
 * escribir nada: la clienta creía haber deshecho el cambio y el sitio
 * seguía en B. Por eso este router lee el contenido VIVO de cada
 * documento que está por escribir con `gh.archivoEnRef()` (la API de
 * Contents), a un solo sha base (`gh.ref('heads/main')`, leído una vez
 * para que todo el lote se compare contra el MISMO instante).
 *
 * «No hay nada que publicar» lo deciden los BYTES —`serializa()` contra
 * lo que `archivoEnRef` trajo—, nunca el resumen: `frase(cambios)` puede
 * dar vacío por otra razón (por ejemplo, el único cambio real cae en un
 * campo que `resume()` no reporta, como uno marcado `quien: 'marcos'`) y
 * ahí igual hay que escribir —con un asunto genérico en vez de ninguno—,
 * no saltarse la escritura.
 *
 * Si GitHub no contesta mientras se lee lo vivo, es un error fuerte —502,
 * nunca un `ok: true`— y jamás se cae de vuelta a ninguna copia
 * empaquetada: una base vieja es EXACTAMENTE lo que produjo este bug.
 *
 * La validación de esquema (`validarContra`, no `validar`) no necesita
 * conteos: los avisos de conteo (`gravedad: 'avisa'`) nunca bloquean una
 * publicación —son la misma comodidad que el navegador ya le mostró antes
 * de que ella apretara publicar—, así que no hace falta leer un documento
 * que no se va a escribir solo para calcularlos. Si algún día un aviso
 * tiene que bloquear o mostrarse en la respuesta, ESE es el momento de
 * traer los conteos de vuelta, con el caso real delante.
 *
 * Esa validación corre ANTES de tocar GitHub para escribir, PERO no
 * siempre antes de tocar GitHub del todo: `sitio` tiene cinco campos
 * derivados (`DERIVADOS_DEL_SITIO`, derivados.ts) que `serializa()` nunca
 * escribe en el archivo (carga.ts:390-395) —así que el JSON del repo
 * nunca los trae— y que el esquema exige igual. Validar `documentos.sitio`
 * tal cual llega, sin injertarlos antes, rechaza CUALQUIER publicación
 * real con «el campo quedó vacío» sobre el primer derivado que el esquema
 * encuentre — el bug que encontró el humo de producción
 * (`scripts/humo-panel.sh`, paso 4a) en el primer ensayo contra
 * producción: nada se llegó a escribir, pero ninguna publicación de
 * verdad podía pasar nunca. La fachada del sitio (`src/copy/sitio-marca.ts`)
 * los injerta antes de validar; este router hace EXACTAMENTE lo mismo,
 * con las MISMAS fuentes (`injerta()`, con `sabores`/`gotas` de un
 * documento de `sabores`), o el sitio publicado y el panel que lo edita
 * terminan de acuerdo en cosas distintas.
 *
 * Esas fuentes salen del propio lote cuando lo trae —si se publican
 * `sitio` y `sabores` juntos (un sabor nuevo, más el texto que lo
 * menciona), el texto se valida contra los precios y la cantidad NUEVOS,
 * nunca contra los quince viejos— y si no, de lo vivo de GitHub, nunca de
 * la foto que `pnpm bundle:api` congeló en el paquete: es la misma razón
 * de RULING T6-d, aplicada a la fuente de un cálculo en vez de a la
 * comparación de bytes. Ese único caso —`sitio` sin `sabores` en el
 * lote— es la única vez que este router toca GitHub para algo que no va a
 * escribir, y por eso corre en su propia fase, después de validar todo lo
 * que SÍ se puede validar sin red (para no gastar ese pedido si el lote
 * ya iba a rechazarse por otra razón) y antes de la Fase 2 de escritura,
 * que reutiliza el MISMO sha base si esta fase ya lo pidió — «un solo sha
 * base para todo el lote» sigue valiendo, ahora para dos preguntas en vez
 * de una.
 *
 * Lo que se INJERTA es solo para validar: lo que se ESCRIBE —Fase 2, más
 * abajo— sigue siendo el documento tal cual llegó, nunca la copia
 * injertada. No hace falta que sea otra cosa: `serializa()` omite los
 * derivados sea cual sea el valor que traigan, así que los bytes finales
 * son los mismos exista o no ese campo en la entrada (`injerta()`
 * sobrescribe, así que un documento que YA trae sus derivados —lo que va
 * a tener en memoria el panel de la fase 6— también funciona, sin caso
 * especial).
 *
 * [C-1] Antes de mirar la cookie siquiera: si `PANEL_SECRETO` falta o es
 * demasiado corto, 503 —nunca el 401 de sesión inválida, que le haría
 * creer a la clienta que tiene que volver a entrar cuando el problema es
 * nuestro— y el log nombra la variable.
 *
 * [I-4] La cookie firmada solo prueba que ALGUNA VEZ el correo estuvo en
 * `PANEL_CORREOS` —dura hasta un año (E3)—, no que sigue estando HOY:
 * `PANEL_CORREOS` se vuelve a leer en `sesionVigente()` (más arriba en este
 * archivo), después de que `verificaSesion` confirma la firma, y si esa
 * dirección ya no está en la lista de hoy, el mismo 401 de sesión inválida.
 * Sin este chequeo, sacarle el acceso a alguien —la hermana, alguien que
 * dejó de trabajar con la marca— no revocaba nada hasta que su cookie
 * venciera sola, o hasta rotar `PANEL_SECRETO`, que de paso desloguea a todo
 * el mundo.
 */
async function publicarAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('publicar: PANEL_SECRETO falta o mide menos de 32 caracteres — no se puede verificar ninguna sesión.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  const cuerpo = (pedido.cuerpo ?? {}) as { documentos?: unknown; base?: unknown }
  if (typeof cuerpo.base !== 'string' || cuerpo.base === '') {
    console.error('publicar: el cuerpo llegó sin `base` — el panel que lo mandó es de antes del sha base.')
    return error(400, PROBLEMA_SIN_BASE)
  }

  const documentos = comoDocumentos(cuerpo.documentos)
  const ids = Object.keys(documentos)

  // Antes de mirar el contenido de ninguno: si un solo nombre no es un
  // documento que el panel conozca, se rechaza el lote entero ahí mismo.
  for (const id of ids) {
    if (!esIdDocumento(id)) {
      return error(422, `No se puede publicar «${id}»: no es un documento que el panel conozca.`, id)
    }
  }

  if (ids.length === 0) return error(400, PROBLEMA_SIN_DOCUMENTOS)

  const idsConocidos = ids as IdDocumento[]

  // [B1, Grupo C] Recién ACÁ, después de las validaciones baratas y
  // sincrónicas de arriba (lote vacío, documento desconocido, `base`
  // ausente): antes tocaba GitHub incluso cuando ninguna de esas iba a dejar
  // seguir — «400 sin tocar GitHub» dejaba de ser cierto. Y todavía antes de
  // la comparación de `base` de la Fase 2: si la cabeza está rota y se
  // revierte acá, esa fase tiene que ver la cabeza YA arreglada, o compara
  // contra un commit que acaba de dejar de existir.
  await revisaLaCabeza(contexto)

  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  // Fase 1a, sin tocar GitHub: el esquema COMPLETO de cada documento que
  // NO necesita nada inyectado —hoy, cualquiera menos `sitio`—, en el
  // orden en que llegó. `sabores` y `fichas` no declaran un solo campo
  // `derivado` (`grep -rn derivado src/contenido/esquema/sabores.ts
  // src/contenido/esquema/fichas.ts` no da nada — y `validarContra()`
  // contra los dos archivos crudos del repo, sin injertar nada, da cero
  // problemas: ver `test/contenido.test.ts`, «el documento de productos
  // vuelve a salir idéntico» y el describe «el documento de fichas»), así
  // que su esquema completo es justo lo que la clienta mandó: nada que
  // calcular antes de validar. `sitio` se deja para la Fase 1b, después de
  // esta, para no gastar un pedido de red por sus derivados si el lote ya
  // iba a rechazarse por CUALQUIER otro documento.
  for (const id of idsConocidos) {
    if (id === 'sitio') continue
    const problemas: Problema[] = validarContra(DOCUMENTOS[id], documentos[id])
    if (problemas.length > 0) {
      return error(422, problemas[0].titulo, `${id}.${problemas[0].campo}`)
    }
  }

  // El sha base del lote, pedido a lo sumo una vez y reusado: tanto la
  // Fase 1b (fuentes de los derivados de `sitio`, si hace falta leerlas
  // vivas) como la Fase 2 (lo vivo de cada documento a escribir) tienen
  // que comparar contra el MISMO instante.
  let base: { sha: string } | undefined

  // Fase 1b: `sitio`, si vino, con sus cinco derivados injertados antes
  // de validar (ver el docstring de esta función).
  if (idsConocidos.includes('sitio')) {
    let fuentes: FuentesDeDerivados
    try {
      if (idsConocidos.includes('sabores')) {
        // El lote trae `sabores`: sus valores son los que van a quedar
        // vivos después de este commit, así que son los que hay que usar
        // —nunca los de GitHub, que están a punto de quedar viejos.
        fuentes = fuentesDeSabores(documentos.sabores)
      } else {
        base = await gh.ref('heads/main')
        const vivoSaboresTexto = await gh.archivoEnRef(RUTA_DEL_DOCUMENTO('sabores'), base.sha)
        fuentes = fuentesDeSabores(JSON.parse(vivoSaboresTexto))
      }
    } catch (e) {
      // Mismo tratamiento que la Fase 2 cuando GitHub no contesta: un
      // error fuerte, nunca un `ok: true`, y jamás una foto vieja del
      // bundle en su lugar (RULING T6-d).
      console.error('publicar: no se pudo leer «sabores» en vivo para calcular los derivados de «sitio» —', e)
      return error(502, PROBLEMA_NO_SE_PUDO_LEER)
    }

    // `injerta()` tira si al documento le falta un CONTENEDOR intermedio
    // —`gotas` entero, no solo `gotas.precioDesde`— porque ahí ya no sabe
    // dónde escribir el derivado (derivados.ts). Eso es un documento con
    // una forma rota de verdad, no el caso que este fix existe para
    // arreglar: se valida el documento TAL CUAL llegó en su lugar, para
    // que sea Zod —no un 500 genérico— quien le diga a la clienta qué
    // parte falta, con el mismo criterio que cualquier otro campo
    // ausente.
    let paraValidar: unknown
    try {
      paraValidar = injerta(documentos.sitio, fuentes)
    } catch {
      paraValidar = documentos.sitio
    }

    const problemas: Problema[] = validarContra(DOCUMENTOS.sitio, paraValidar)
    if (problemas.length > 0) {
      return error(422, problemas[0].titulo, `sitio.${problemas[0].campo}`)
    }
  }

  // Fase 2: recién acá se toca GitHub para escribir. Reusa el sha base de
  // la Fase 1b si ya se pidió.
  const archivos: Archivo[] = []
  const cambios: Cambio[] = []

  try {
    base ??= await gh.ref('heads/main')

    // [B4] El sha contra el que ella editó vs. la cabeza de hoy. Si son el
    // mismo, no hay nada que mirar. Si no, la pregunta no es «¿avanzó main?»
    // —avanza todo el tiempo, Marcos publica código— sino «¿avanzó sobre
    // ALGO QUE ESTE LOTE ESCRIBE?». Solo eso se pisaría.
    if (cuerpo.base !== base.sha) {
      const { archivos: movidos } = await gh.comparaRefs(cuerpo.base, base.sha)
      const delLote = new Set(idsConocidos.map(RUTA_DEL_DOCUMENTO))
      const pisados = movidos.filter((ruta) => delLote.has(ruta))
      if (pisados.length > 0) {
        console.error(
          `publicar: rechazado por pisada (autor: ${sesion.correo}) — editó contra ${cuerpo.base}, ` +
            `la cabeza es ${base.sha}, y en el medio cambiaron: ${pisados.join(', ')}`,
        )
        return error(409, PROBLEMA_PISARIA)
      }
    }

    for (const id of idsConocidos) {
      const ruta = RUTA_DEL_DOCUMENTO(id)
      const vivoTexto = await gh.archivoEnRef(ruta, base.sha)
      const crudo = documentos[id]
      const esquema = DOCUMENTOS[id]
      const bytesNuevos = serializa(esquema, crudo)

      if (bytesNuevos === vivoTexto) continue // este documento no cambió: nada que escribir por acá.

      archivos.push({ ruta, contenido: bytesNuevos })
      cambios.push(...resume(JSON.parse(vivoTexto), crudo, esquema))
    }
  } catch (e) {
    // El detalle (status, mensaje de GitHub) es para Marcos; a la clienta
    // nunca se le dice «no pudimos leer» y se publica igual con lo viejo.
    console.error('publicar: no se pudo leer el contenido actual de un documento antes de compararlo —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  if (archivos.length === 0) {
    return ok({ ok: true, sha: null, resumen: SIN_CAMBIOS })
  }

  const resultado = await publica(gh, {
    archivos,
    autor: sesion.correo,
    bytesDelCuerpo: contexto.bytesDelCuerpo,
    // Si `cambios` quedó vacío pese a que los bytes SÍ cambiaron (`frase()`
    // no encuentra nada que contar), se omite el campo entero en vez de
    // mandar un array vacío: `publica()` lee `cambios: []` como «no hay
    // nada que contar» y se salta la escritura (ver su docstring) — que es
    // exactamente el atajo que este fix borra. Omitido, usa su asunto
    // genérico y escribe igual.
    ...(cambios.length > 0 ? { cambios } : {}),
  })
  if (!resultado.ok) return error(resultado.codigo, resultado.problema)

  return ok({ ok: true, sha: resultado.sha, resumen: resultado.resumen })
}

/*
 * ---------------------------------------------------------------------
 * salud
 * ---------------------------------------------------------------------
 */

// Las siete variables que el panel necesita para funcionar del todo. Por
// NOMBRE nunca por valor (E7): esta lista vive acá, no un valor leído de
// `contexto.env`, así que no hay forma de que un `console.log` apurado se
// escape y termine devolviendo un secreto.
//
// [RULING P-2 del preflight, Tarea 5] `PANEL_VERCEL_TOKEN` se suma acá desde
// que existe `src/servidor/vercel.ts` (spec §4.5): publicar a ciegas, sin
// poder saber si el deploy terminó ni revertir solo, es peor que no
// publicar. Consecuencia real, no hipotética: desde que esta lista mergea a
// producción, `salud` contesta 503 hasta que Marcos cargue esa variable —
// avisado en el reporte de esa tarea, no es un bug.
const VARIABLES_REQUERIDAS = [
  'PANEL_CLAVE_HASH',
  'PANEL_SECRETO',
  'PANEL_CORREOS',
  'PANEL_GITHUB_TOKEN',
  'GITHUB_DUENIO',
  'GITHUB_REPO',
  'PANEL_VERCEL_TOKEN',
] as const

// [I-6] Lo que dice la clienta (bueno, acá nadie la llama por sesión, así
// que en rigor es lo que le contesta el panel a quien sea) cuando el
// freno de intentos frenó el pedido a GitHub de `salud`. Las variables SÍ
// están —por eso `ok: true`—; lo único que falta es la parte que le
// cuesta cuota al PAT.
const PROBLEMA_SALUD_OMITIDA =
  'Las variables están, pero no revisamos la conexión con GitHub: hubo demasiados pedidos seguidos. Intenta de nuevo en unos minutos.'

/**
 * `salud`: ¿están las variables?, ¿responde GitHub? (E8).
 *
 * Sin sesión a propósito: es la acción que hay que poder llamar el día
 * que `PANEL_SECRETO` falta o vino mal —justo el día en que `verificaSesion`
 * no le firma una cookie válida a nadie—, así que no puede depender de
 * tener una. Lo único que expone son NOMBRES de variables ausentes y un
 * booleano de si GitHub contestó: nada que un atacante no aprenda ya con
 * un `curl` a la página pública (que el panel existe, en qué dominio).
 *
 * [I-6] Esa misma falta de sesión es lo que convierte a `salud` en un
 * amplificador: sin freno, cualquiera sin login puede hacer que el panel
 * dispare un pedido AUTENTICADO de verdad a GitHub (con el PAT) en cada
 * `curl`, y GitHub cobra esos pedidos contra la misma cuota horaria que
 * necesita `publicar` para funcionar — alguien sin ninguna credencial
 * puede agotarla y romper la publicación de Marcos. La mitad de las
 * variables queda TAL CUAL —abierta, anónima, sin freno— porque es
 * justo la que hay que poder preguntar sin sesión el día que algo falta;
 * pero el pedido de verdad a GitHub corre detrás del MISMO freno por IP
 * que usa `entrar` (E4): si ya se gastaron los cinco pedidos de la
 * ventana, se contesta con las variables (que están bien) y se avisa que
 * la conexión no se revisó, en vez de gastar un pedido más del PAT.
 */
async function salud(_pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const faltan = VARIABLES_REQUERIDAS.filter((v) => !contexto.env[v])

  if (faltan.length > 0) {
    return { status: 503, cuerpo: { ok: false, faltan, github: null } }
  }

  // Las siete están: falta ver si GitHub de verdad contesta con ellas — y
  // ESE paso es el que va detrás del freno, no el chequeo de variables de
  // arriba.
  if (!intentoPermitido(contexto.ip, contexto.ahora())) {
    return { status: 200, cuerpo: { ok: true, faltan: [], github: null, problema: PROBLEMA_SALUD_OMITIDA } }
  }

  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN!,
    duenio: contexto.env.GITHUB_DUENIO!,
    repo: contexto.env.GITHUB_REPO!,
    fetch: contexto.fetch,
  })
  try {
    await gh.ref('heads/main')
    return { status: 200, cuerpo: { ok: true, faltan: [], github: true } }
  } catch (e) {
    // El detalle técnico es para Marcos, no para el JSON de salud.
    console.error('salud: GitHub no contestó', e)
    return { status: 503, cuerpo: { ok: false, faltan: [], github: false } }
  }
}

/*
 * ---------------------------------------------------------------------
 * estado
 * ---------------------------------------------------------------------
 */

/**
 * `estado`: ¿el cambio que publicó ya está en el sitio? (spec §4.5).
 *
 * [B1] El panel pregunta; el servidor dice cada cuánto volver a preguntar y
 * cuándo parar. El sondeo NO vive en la función: una función de la plataforma
 * muere a los 60 s y un despliegue tarda más, así que «la función sondea»
 * —como lo escribió el spec— no se puede implementar. Lo que sí se puede, y
 * es lo mismo desde donde ella lo mira, es que cada respuesta traiga su
 * `reintentarEn`.
 *
 * Las dos lecturas van en este orden porque la primera es la que puede
 * ahorrar la segunda: si el despliegue falló, no hace falta preguntarle nada
 * al CDN.
 *
 * Si `version.json` no contesta, NO se asume nada: se sigue con
 * `shaServido: null`, que nunca coincide, así que el veredicto es «en curso».
 * Una de las dos fuentes caída no puede volverse un «sí» por omisión.
 */
async function estadoAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('estado: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  // [B1] Misma red de seguridad que `publicarAccion`: si la cabeza de main
  // quedó rota por un despliegue que falló con el panel cerrado, arreglarla
  // antes de seguir. `estadoAccion` no tiene un chequeo sincrónico barato
  // ANTES de esto —a diferencia de `publicarAccion` (Grupo C)—, así que acá
  // corre apenas pasa la sesión, como siempre.
  const shaYaAtendido = await revisaLaCabeza(contexto)

  if (!env.PANEL_VERCEL_TOKEN) {
    console.error('estado: PANEL_VERCEL_TOKEN no está cargada — no hay forma de saber si el despliegue terminó.')
    return error(503, PROBLEMA_INESPERADO)
  }

  // Mismo candado que el token, justo al lado: sin `PANEL_VERCEL_PROYECTO`,
  // el del repo (ver el docstring de la variable en `Entorno`, arriba) — un
  // dato de negocio que no hay que inventar acá, es el mismo nombre que ya
  // usan `GITHUB_DUENIO`/`GITHUB_REPO` para todo lo demás. Pero si NINGUNA de
  // las dos está cargada, el código no puede seguir en silencio con
  // `proyecto: ''`: eso le pregunta a la plataforma por un proyecto sin
  // nombre y termina en un 502 mudo —Marcos ve «no pudimos conectarnos»
  // cuando lo que pasa es que falta una variable, un diagnóstico
  // completamente distinto—.
  const proyecto = env.PANEL_VERCEL_PROYECTO ?? env.GITHUB_REPO ?? ''
  if (proyecto === '') {
    console.error('estado: ni PANEL_VERCEL_PROYECTO ni GITHUB_REPO están cargadas — no sé por qué proyecto preguntar.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const cuerpo = (pedido.cuerpo ?? {}) as { sha?: unknown; publicadoEn?: unknown }
  if (typeof cuerpo.sha !== 'string' || !/^[0-9a-f]{40}$/.test(cuerpo.sha)) {
    return error(400, PROBLEMA_INESPERADO)
  }
  const publicadoEn = typeof cuerpo.publicadoEn === 'number' ? cuerpo.publicadoEn : contexto.ahora()

  const vercel = clienteVercel({
    token: env.PANEL_VERCEL_TOKEN,
    proyecto,
    fetch: contexto.fetch,
  })

  let despliegue: { estado: EstadoDeDespliegue; url: string | null }
  try {
    despliegue = await vercel.despliegueDe(cuerpo.sha)
  } catch (e) {
    console.error('estado: la plataforma no contestó por el despliegue —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  const shaServido = despliegue.estado === 'listo' ? await shaQueSirveElCdn(contexto) : null

  const veredicto = decide({
    despliegue: despliegue.estado,
    url: despliegue.url,
    shaServido,
    shaPublicado: cuerpo.sha,
    desdeHaceMs: contexto.ahora() - publicadoEn,
  })

  // [B1] La reversión automática la hace la invocación que VE el fracaso. No
  // hay ningún proceso sondeando: una función de la plataforma muere a los
  // 60 s y un despliegue tarda más. Si ella cerró el panel antes de que
  // fallara, esto no corre acá — corre en la próxima acción autenticada que
  // pase por `revisaLaCabeza()`.
  //
  // [Ronda 2, Grupo B] Si `revisaLaCabeza()` (arriba) YA atendió este mismo
  // sha —el caso normal: ella publica, su commit es la cabeza, y el panel
  // sondea por ese mismo sha—, no se vuelve a intentar el revert (sería un
  // pedido de más para un resultado que ya se sabe) ni se avisa a Marcos de
  // nuevo (ya le avisó `revisaLaCabeza()`, un instante antes, en esta misma
  // invocación). Lo único que falta es avisarle a ELLA, que es la única
  // persona a la que `revisaLaCabeza()` nunca le habla.
  if (veredicto.estado === 'falló') {
    if (shaYaAtendido === cuerpo.sha) {
      await avisaAElla(sesion.correo, contexto)
    } else {
      await revierteYAvisa(cuerpo.sha, sesion.correo, contexto)
    }
  }

  return ok({ ok: true, ...veredicto })
}

/**
 * Qué commit está sirviendo el CDN, según `version.json` (Tarea 4).
 *
 * El `?t=` es obligatorio y no es paranoia: aunque `vercel.json` le ponga
 * `no-store`, entre esta función y el archivo puede haber un caché que no
 * conocemos. Un `version.json` cacheado dice qué se servía CUANDO SE CACHEÓ,
 * que es justo la mentira que este archivo existe para no contar.
 *
 * Devuelve `null` ante cualquier problema: eso nunca coincide con el sha
 * publicado, así que el veredicto queda en «en curso». Una fuente caída no
 * puede convertirse en un «ya está» por omisión.
 */
async function shaQueSirveElCdn(contexto: Contexto): Promise<string | null> {
  try {
    const r = await contexto.fetch(`${SITIO}/version.json?t=${contexto.ahora()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json()) as { sha?: unknown }
    return typeof v.sha === 'string' ? v.sha : null
  } catch (e) {
    console.error('estado: no se pudo leer version.json del sitio —', e)
    return null
  }
}

/*
 * ---------------------------------------------------------------------
 * El router
 * ---------------------------------------------------------------------
 */

const PROBLEMA_ACCION_INEXISTENTE = 'Esta acción todavía no existe.'
// PROBLEMA_INESPERADO vive arriba de todo (antes de «entrar»): `entrar` y
// `publicarAccion` también la usan para su 503 de C-1.

/**
 * El punto de entrada único del panel. Atrapa cualquier excepción que se
 * escape de las tres acciones —un JSON del repo que no parsea, un error
 * raro del cliente de GitHub— y la convierte en un 500 sin jerga para la
 * clienta; el detalle completo va a `console.error`, para Marcos (E7).
 */
export async function maneja(accion: string, pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  try {
    switch (accion) {
      case 'entrar':
        return entrar(pedido, contexto)
      case 'publicar':
        return await publicarAccion(pedido, contexto)
      case 'salud':
        return await salud(pedido, contexto)
      case 'estado':
        return await estadoAccion(pedido, contexto)
      default:
        return error(404, PROBLEMA_ACCION_INEXISTENTE)
    }
  } catch (e) {
    console.error(`acciones: la acción «${accion}» reventó sin que nada la esperara —`, e)
    return error(500, PROBLEMA_INESPERADO)
  }
}
