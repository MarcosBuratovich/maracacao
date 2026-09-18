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
import { firmaEnlace, verificaEnlace, DURACION_ENLACE_MS } from './enlace'
import { cliente } from './github'
import { publica, PROBLEMA_NO_SE_PUDO_PUBLICAR, type Archivo } from './publicar'
import { guarda, leeBorrador } from './borrador'
import { revierte, TRAILER_REVIERTE, TRAILER_PANEL, tieneTrailer, valorDeTrailer, autorDelCommit } from './revertir'
import { lee } from './historial'
import type { Cambio } from '../contenido/diff'
import { resume } from '../contenido/diff'
import { validarContra, validar, type Problema } from '../contenido/validacion'
import { conteosDe } from '../contenido/conteos'
import { serializa } from '../contenido/carga'
import { injerta, type FuentesDeDerivados } from '../contenido/derivados'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'
import type { Carta, ResultadoCorreo } from './correo'
import { clienteVercel, type EstadoDeDespliegue } from './vercel'
import { decide, fraseDeFracaso, SITIO, type Fracaso } from './estado'

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
  /**
   * Reloj MONÓTONO, para medir cuánto pasó de verdad. Distinto de `ahora`,
   * que es el reloj de NEGOCIO —los tests lo congelan, y una publicación de
   * hace media hora se compara contra él—.
   *
   * [Revisión final de la rama, C2] Existe porque `enlaceAccion()` necesita
   * medir tiempo de PARED —lo que un atacante cronometra desde afuera, para
   * el piso de `PISO_ENLACE_MS`— y hasta acá lo tomaba con un `Date.now()`
   * suelto, o sea del global, en un archivo que no es el borde. La regla del
   * proyecto es que TODO `src/servidor/**` fuera de `entradas/**` recibe el
   * reloj por parámetro; que el reloj que hacía falta fuera otro no es una
   * excepción a la regla, es un segundo campo en el contexto.
   */
  monotono: () => number
  /**
   * Esperar. Inyectada por la misma razón que `monotono`, más una medida:
   * `test/acciones.test.ts` tardaba 28,5 s y 17,1 s de eso eran sueño REAL
   * —quince tests durmiendo los 400 ms de `PISO_ENLACE_MS` cada uno—, en el
   * camino crítico del deploy, que está en el camino crítico de la
   * publicación de ella. Con la espera inyectada, un test la simula y el
   * piso se sigue probando igual (mejor, de hecho: contra el número exacto
   * en vez de contra un cronómetro que la carga de la máquina mueve).
   */
  espera: (ms: number) => Promise<void>
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

/**
 * [Ronda 1, Tarea 12, hallazgo E] La clave que le da a `intentoPermitido`
 * su propio presupuesto POR ACCIÓN. Antes, `entrar`, `salud`, `enlace` y
 * `entrar-con-enlace` compartían un único contador por IP —así lo armaba
 * cada llamador, a mano, pasando `contexto.ip` sin más— y eso se volvía en
 * contra el día que más importaba: la clienta que pide el enlace cinco
 * veces porque no le llega se quedaba, de paso, sin poder usar su
 * contraseña por quince minutos. Con esto, cada acción tiene su propio
 * balde de cinco intentos cada quince minutos, y de paso desarma la
 * contradicción del hallazgo D (el freno de `enlace` ya no le puede comer
 * el presupuesto a `entrar`, ni viceversa).
 */
const claveFreno = (accion: string, ip: string): string => `${accion}:${ip}`

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
 *
 * [Revisión final de la rama] Es IDEMPOTENTE: `f(f(x)) === f(x)` para
 * cualquier `x`. No lo era, y el borde estaba en el corte de los 64
 * caracteres — que puede caer justo después de un guion y dejarlo colgando,
 * cosa que una segunda pasada sí sacaría. Importa porque el id viaja FIRMADO
 * en la cookie y Marcos lo copia de un log a `PANEL_DISPOSITIVOS_REVOCADOS`
 * a mano: dos formas del mismo id es exactamente cómo una revocación falla
 * en silencio, que es el bug que este normalizador existe para cerrar. Por
 * eso el recorte de guiones va DESPUÉS del corte, no antes, y hay un test
 * que lo corre dos veces.
 */
export const idDeDispositivo = (crudo: unknown): string => {
  const texto = typeof crudo === 'string' ? crudo : ''
  const limpio = texto
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    // Los guiones de los extremos se sacan ANTES de cortar —si no, un nombre
    // que empieza con setenta guiones se quedaría sin nada que lo
    // identifique y colapsaría a `'sin-nombre'`, que es el id compartido que
    // hay que evitar— y los del final, otra vez DESPUÉS, porque el corte
    // puede caer justo detrás de uno.
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
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

  if (!intentoPermitido(claveFreno('entrar', contexto.ip), contexto.ahora())) {
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
 * el enlace mágico de recuperación (Tarea 12, spec §4.1)
 * ---------------------------------------------------------------------
 *
 * No es la puerta principal — esa es `entrar`, arriba, contraseña contra
 * `PANEL_CLAVE_HASH`. Esta es la de emergencia: la que hay que poder usar
 * el día que el llavero del teléfono se perdió, antes de que exista
 * ningún panel (la fase siguiente) que la muestre. Dos acciones:
 * `enlace` (pedirlo) y `entrar-con-enlace` (cambiarlo por una sesión).
 */

// [B3, no negociable] La ÚNICA frase de un pedido de enlace, byte a byte,
// exista o no esa dirección en `PANEL_CORREOS`. Mismo criterio que
// `PROBLEMA_ENTRAR`, un poco más arriba: este endpoint es público, sin
// sesión, así que una respuesta distinta según exista o no la dirección
// sería una forma de probarlas una por una hasta encontrar cuáles tienen
// acceso al panel.
const FRASE_ENLACE = 'Si esa dirección tiene acceso, te llegó un correo con el enlace.'

// [B3, no negociable] La ÚNICA acción de todo el panel que NO puede
// degradar sin correo configurado. En el resto —los avisos de
// `revierteYAvisa*`, más abajo— el correo es un acompañante: si falla o no
// está configurado, se loguea y el flujo principal sigue igual. Acá el
// correo ES el producto: sin `RESEND_API_KEY` ni `PANEL_REMITENTE` no hay
// NINGUNA forma de que el enlace llegue, así que contestar `FRASE_ENLACE`
// igual sería decirle «te lo mandé» sobre el único canal de recuperación
// que tiene.
const PROBLEMA_ENLACE_SIN_CORREO = 'Ahora mismo no puedo mandarte el enlace. Escríbele a Marcos.'

// Para `entrar-con-enlace`: un token vencido, mal formado, con la firma
// cambiada, o de un correo que ya no está en `PANEL_CORREOS` (I-4, mismo
// criterio que la cookie de sesión) son, desde donde ella lo mira, la
// misma cosa — «este enlace ya no sirve» — y piden la misma acción: volver
// a pedir uno. Distinguirlas no la ayudaría, y sí le daría a quien prueba
// tokens al azar una forma de diferenciar «vencido» de «nunca existió».
const PROBLEMA_ENLACE_INVALIDO = 'Ese enlace ya no sirve: pide uno nuevo.'

// [F, Minor — Ronda 1; número subido en la Ronda 2 de revisión] El freno de
// arriba (`enlace`, por IP) no protege SU bandeja: veinte IPs distintas
// pueden mandarle a la MISMA dirección cien correos desde nuestro
// remitente (medido). Un tope por destinatario, además del de por IP,
// cierra eso sin infraestructura nueva — misma mecánica
// (`intentoPermitido`), otro número.
//
// [Ronda 2] Con 3 (el número de la Ronda 1) esto era, al revés, una
// negación de servicio CONTRA la puerta de recuperación: medido, un
// extraño pidiendo el enlace de ELLA tres veces desde tres IPs cualquiera
// la dejaba afuera de su propia puerta de emergencia — sin necesitar saber
// nada, porque este chequeo corre antes de mirar si la dirección está en
// la lista. Diez es bajo para proteger su bandeja (frente a los cien que
// había) y alto como para que dejarla afuera exija hostigarla a propósito.
// Sigue siendo un residuo real —está declarado en `docs/panel-operacion.md`—
// y no se puede bajar sin devolverle el problema a la bandeja.
const TOPE_ENLACES_POR_DESTINO = 10

/**
 * [B, Critical — Ronda 1; reemplazado en la Ronda 2 de revisión] El piso
 * de tiempo de `enlace`.
 *
 * Las dos ramas —dirección listada y no listada— tienen que tardar lo
 * mismo, o el endpoint se vuelve una forma de averiguar quién tiene acceso
 * al panel probando direcciones una por una. La primera versión de este
 * arreglo (Ronda 1) igualaba el reloj MANDANDO un correo señuelo, y eso
 * cerraba el oráculo pero abría algo peor: medido, veinte pedidos desde
 * veinte IPs con veinte direcciones inventadas eran veinte correos —todos
 * a una casilla que no existe (`maracacao.mx` no tiene registros MX)—,
 * cada uno con un token de enlace VÁLIDO adentro. Un generador ilimitado
 * de rebotes duros contra la reputación del remitente, y el tope por
 * destinatario no lo frenaba porque su clave es la dirección que mandó
 * quien pide, no el señuelo.
 *
 * Esperar es más barato y no le escribe a nadie. El número tiene que ser
 * cómodamente mayor que lo que tarda el proveedor de correo de verdad —si
 * queda corto, la rama que manda de verdad se pasa del piso y el oráculo
 * vuelve—, y el test de abajo lo vigila con el mismo criterio que el de la
 * puerta de contraseña (I-3, `entrar()`): las dos ramas medidas, con la
 * diferencia por debajo de un umbral chico.
 *
 * [Ronda 3 de revisión — residuo declarado] Este piso protege MIENTRAS el
 * proveedor sea más rápido que él: medido, con el proveedor a 800 ms contra
 * este piso de 400, las dos ramas vuelven a diferir 400 ms — el oráculo se
 * reabre cada vez que el proveedor tiene un mal día. No se corta el envío
 * con un timeout para evitarlo (ver el `console.error` de la rama
 * `transcurrido > PISO_ENLACE_MS`, en `enlaceAccion()`, y el ruling T12-K
 * ahí mismo): la alarma es cómo se sabe que el piso dejó de alcanzar, para
 * subirlo — no hay forma de eliminar el residuo sin arriesgar el correo
 * mismo, y arriesgar el correo en la puerta de recuperación es peor que una
 * ventana de oráculo intermitente y no reproducible a voluntad.
 */
const PISO_ENLACE_MS = 400

// [C, Important — Ronda 1 de revisión] Un día, no treinta: esta vía es
// una puerta de RECUPERACIÓN, sirve para volver a entrar, no para
// quedarse. La fase 6 va a poder ofrecer «recordar este aparato» desde
// adentro del panel, una vez que ya se entró.
const DIAS_SESION_ENLACE = 1

const ASUNTO_ENLACE = 'Tu enlace para entrar al panel'

/** El texto del correo. Función y no constante: la URL lleva el token de ESTE pedido. */
const textoEnlace = (url: string): string =>
  [
    'Este es tu enlace para entrar al panel, sin necesitar la contraseña:',
    '',
    url,
    '',
    'Vale por quince minutos. Si tú no lo pediste, ignora este correo: nadie puede entrar sin darle clic.',
  ].join('\n')

// [C, Important — Ronda 1 de revisión] Cada vez que se consume un enlace,
// esto le llega A ELLA: es la única señal que puede tener de que alguien
// más entró con su enlace, ya que el token no queda invalidado al usarse
// (ver el docstring de `entrarConEnlaceAccion`, más abajo).
const ASUNTO_AVISO_CONSUMO = 'Alguien entró al panel con tu enlace'
const TEXTO_AVISO_CONSUMO =
  'Alguien acaba de entrar al panel usando tu enlace de recuperación. Si fuiste tú, no hay nada que hacer. ' +
  'Si no fuiste tú, avísale a Marcos.'

interface CuerpoEnlace {
  correo?: unknown
}

/**
 * [H, Minor — Ronda 1 de revisión] La forma EXACTA en que `correo` aparece
 * en `PANEL_CORREOS` (comparando sin importar mayúsculas, igual que
 * `correoEnLista`), o el original si no está ahí. Sin esto, un enlace
 * pedido como «Clienta@Ejemplo.MX» firma la sesión con esas mayúsculas —y
 * esa forma cruda termina como autor de cada commit que se publique desde
 * ahí— en vez de la forma que Marcos escribió en la lista.
 */
function correoCanonico(correo: string, lista: string | undefined): string {
  if (!lista) return correo
  const normalizado = correo.trim().toLowerCase()
  const entrada = lista.split(',').map((c) => c.trim()).find((c) => c.toLowerCase() === normalizado)
  return entrada ?? correo
}

/**
 * `enlace`: pedir el enlace mágico de recuperación (spec §4.1).
 *
 * Sin sesión a propósito —es la puerta que hay que poder usar el día que no
 * queda ninguna sesión con la que entrar—, así que cualquiera puede
 * pedirlo. Eso es justo lo que hace no negociables las capas de abajo, en
 * este orden:
 *
 * 1. El freno de intentos por IP (E4, `intentoPermitido` con clave
 *    `claveFreno('enlace', ip)`) — [Ronda 1] su PROPIO presupuesto, no el
 *    de `entrar`/`salud` (hallazgo E): compartirlo hacía que pedir el
 *    enlace cinco veces gastara también el de `entrar`, dejándola sin
 *    poder usar la contraseña el día que más la necesita.
 * 2. [C-1] `PANEL_SECRETO` tiene que servir para firmar de verdad — mismo
 *    candado y mismo 503 franco que `entrar`.
 * 3. [B3] El correo tiene que estar configurado (ver `PROBLEMA_ENLACE_SIN_CORREO`
 *    arriba). Este chequeo puede ir ANTES de mirar si la dirección está en
 *    la lista porque es un estado del SERVIDOR, no un dato de la clienta:
 *    contestarlo igual para cualquiera no delata nada de nadie.
 * 4. [F] El tope por DESTINATARIO (`TOPE_ENLACES_POR_DESTINO`, diez cada
 *    quince minutos desde la Ronda 2), corrido SIEMPRE con la dirección tal
 *    cual llegó —exista o no en la lista— así que tampoco este freno
 *    distingue una dirección real de una inventada por su resultado. Con
 *    `console.error`: si se dispara diez veces contra la MISMA dirección en
 *    quince minutos, o es un ataque o es alguien que necesita ayuda de
 *    Marcos, y las dos cosas quedan en el log.
 * 5. [B, Critical — reemplazado en la Ronda 2] El PISO DE TIEMPO
 *    (`PISO_ENLACE_MS`): las dos ramas —listada o no— tardan lo mismo
 *    porque las dos esperan hasta el mismo piso antes de contestar, nunca
 *    porque las dos mandan algo. La Ronda 1 igualaba el reloj mandando un
 *    correo señuelo siempre; eso cerraba el oráculo de tiempo pero abría
 *    un generador de rebotes duros (ver el docstring de `PISO_ENLACE_MS`).
 *    Solo la rama LISTADA manda de verdad.
 * 6. 200, siempre, con `FRASE_ENLACE`.
 */
async function enlaceAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env

  if (!intentoPermitido(claveFreno('enlace', contexto.ip), contexto.ahora())) {
    return error(429, PROBLEMA_DEMASIADOS_INTENTOS)
  }

  if (!secretoUtilizable(env)) {
    console.error('enlace: PANEL_SECRETO falta o mide menos de 32 caracteres — no se puede firmar ningún enlace.')
    return error(503, PROBLEMA_INESPERADO)
  }

  if (!env.RESEND_API_KEY || !env.PANEL_REMITENTE) {
    console.error('enlace: RESEND_API_KEY o PANEL_REMITENTE no están cargadas — no hay forma de mandar el enlace.')
    return error(503, PROBLEMA_ENLACE_SIN_CORREO)
  }

  const cuerpo = (pedido.cuerpo ?? {}) as CuerpoEnlace
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : ''

  const claveDestino = `enlace-destino:${correo.toLowerCase()}`
  if (!intentoPermitido(claveDestino, contexto.ahora(), TOPE_ENLACES_POR_DESTINO)) {
    // [Ronda 2] Fuerte a propósito: diez pedidos contra la MISMA dirección
    // en quince minutos, sin importar desde cuántas IPs, es o un ataque o
    // alguien hostigándola — y las dos cosas ameritan que Marcos se entere.
    console.error(`enlace: tope por destinatario alcanzado para «${correo}» — diez pedidos en quince minutos.`)
    return error(429, PROBLEMA_DEMASIADOS_INTENTOS)
  }

  // [Ronda 2] Reloj de PARED, no `contexto.ahora()`: lo que hay que igualar
  // es cuánto tarda el pedido HTTP de verdad —lo que un atacante mide desde
  // afuera—, y `ahora()` es el reloj de NEGOCIO (inyectable, a veces
  // congelado en los tests), no el tiempo que de verdad pasa mientras se
  // espera el proveedor de correo o el piso de abajo.
  //
  // [Revisión final, C2] De pared SÍ, pero INYECTADO: `contexto.monotono()`,
  // no `Date.now()` del global. Este archivo no es el borde (ver el
  // docstring de `Contexto`), y de paso un test puede simular un proveedor
  // lento sin dormir de verdad.
  const inicio = contexto.monotono()

  const correoOk = correoEnLista(correo, env.PANEL_CORREOS)
  if (correoOk) {
    // [H] Firma la forma CANÓNICA de `PANEL_CORREOS`, no la que tipeó quien
    // pidió el enlace — ver `correoCanonico()`, arriba.
    const correoParaFirmar = correoCanonico(correo, env.PANEL_CORREOS)
    const vence = contexto.ahora() + DURACION_ENLACE_MS
    const token = firmaEnlace(correoParaFirmar, vence, env.PANEL_SECRETO)
    const url = `${SITIO}/panel/entrar?token=${encodeURIComponent(token)}`
    const r = await contexto.correo({ a: [correoParaFirmar], asunto: ASUNTO_ENLACE, texto: textoEnlace(url) })
    if (!r.ok) {
      console.error(`enlace: no se pudo mandar el enlace a ${correoParaFirmar} — ${r.motivo}`)
    }
  }
  // Si `correo` no está en la lista, no se firma ni se manda nada — nunca
  // hubo, ni hay ahora, ningún señuelo a quien escribirle.

  // [B, Ronda 2] El piso: ninguna de las dos ramas contesta antes de que
  // pase `PISO_ENLACE_MS` desde que arrancó este pedido. Si la rama que
  // manda de verdad ya tardó eso o más, no se espera nada de más.
  const transcurrido = contexto.monotono() - inicio
  if (transcurrido < PISO_ENLACE_MS) {
    await contexto.espera(PISO_ENLACE_MS - transcurrido)
  } else if (transcurrido > PISO_ENLACE_MS) {
    // [Ronda 3 de revisión] El proveedor tardó más que el piso, así que
    // esta rama —la que SÍ manda— acaba de tardar más que la que no manda
    // nada: por esta ventana, el tiempo de respuesta vuelve a decir si la
    // dirección tiene acceso. No se corta el envío para evitarlo (ruling
    // T12-K: abandonar el pedido en una función serverless puede matar el
    // correo —la plataforma congela el proceso después de responder— y
    // ésta es la puerta que tiene que funcionar el peor día; que el correo
    // no salga el día que ella perdió el teléfono es peor que una señal de
    // tiempo intermitente, que además solo aparece mientras el proveedor
    // está lento y no es reproducible a voluntad por quien ataca). Lo que
    // sí se hace es avisar, para que esto no sea invisible: si aparece
    // seguido, hay que subir el piso.
    console.error(
      `enlace: el envío tardó ${transcurrido} ms, más que el piso de ${PISO_ENLACE_MS} ms — ` +
        'mientras eso pase, el tiempo de respuesta distingue una dirección con acceso de una sin acceso.',
    )
  }

  return ok({ ok: true, mensaje: FRASE_ENLACE })
}

/**
 * `entrar-con-enlace`: cambia un enlace mágico válido por una cookie de
 * sesión (spec §4.1) — el mismo destino al que llega `entrar`, por una
 * puerta distinta.
 *
 * [D, Important — Ronda 1 de revisión] SÍ lleva freno de intentos, con su
 * propio presupuesto (`claveFreno('entrar-con-enlace', ip)`, hallazgo E).
 * La premisa de la Ronda 0 —que un HMAC de este largo no se adivina
 * probando— sigue siendo cierta, pero el freno acá no protegía contra
 * ESO: protegía contra REUSAR un token ya válido, que no tenía ningún
 * techo (medido: el mismo token, ocho veces en paralelo desde ocho IPs,
 * ocho sesiones).
 *
 * [I-4] Se vuelve a chequear `PANEL_CORREOS` de HOY, no del momento en que
 * se pidió el enlace — mismo criterio que ya aplican `publicarAccion` y
 * compañía a la cookie de sesión: un enlace firmado hace diez minutos no
 * puede seguir sirviendo si en el medio se sacó a esa persona de la lista.
 *
 * [C, Important] Sin almacén de tokens usados —los quince minutos siguen
 * siendo el único vencimiento del token en sí—, dos cosas acotan el riesgo
 * de reuso sin infraestructura nueva: la sesión que emite dura un día
 * (`DIAS_SESION_ENLACE`), no treinta, y cada consumo le manda un correo A
 * ELLA (`ASUNTO_AVISO_CONSUMO`) — la única señal que puede tener de que
 * alguien más entró. Ese aviso es mejor esfuerzo (`mandaProtegido`, más
 * abajo en este archivo): si el correo no está configurado o falla, se
 * loguea y el login sigue — avisar que alguien entró no puede ser motivo
 * para que la persona correcta se quede afuera.
 *
 * El cuerpo de este pedido es `{ token, dispositivo }` (ver `entrar.astro`),
 * así que no hay un «recuérdame» que leer: esta vía siempre emite una sesión
 * de un día.
 *
 * [Revisión final de la rama, I7] `dispositivo` es nuevo en el cuerpo. Antes
 * la página mandaba solo `{ token }` y `idDeDispositivo(undefined)` resolvía
 * eso como `'sin-nombre'`, FIRMADO en la cookie: revocar ese id mataba las
 * sesiones de recuperación de todo el mundo a la vez, y el candado
 * anti-pisada del borrador no tenía nada que comparar entre dos personas que
 * hubieran entrado las dos por enlace. El servidor no cambió —ya leía el
 * campo—; lo que faltaba era que alguien lo mandara.
 */
async function entrarConEnlaceAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env

  if (!intentoPermitido(claveFreno('entrar-con-enlace', contexto.ip), contexto.ahora())) {
    return error(429, PROBLEMA_DEMASIADOS_INTENTOS)
  }

  if (!secretoUtilizable(env)) {
    console.error('entrar-con-enlace: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const cuerpo = (pedido.cuerpo ?? {}) as { token?: unknown; dispositivo?: unknown }
  const token = typeof cuerpo.token === 'string' ? cuerpo.token : ''

  const verificado = token !== '' ? verificaEnlace(token, env.PANEL_SECRETO, contexto.ahora()) : null
  if (!verificado || !correoEnLista(verificado.correo, env.PANEL_CORREOS)) {
    return error(401, PROBLEMA_ENLACE_INVALIDO)
  }

  const dias = DIAS_SESION_ENLACE
  const dispositivo = idDeDispositivo(cuerpo.dispositivo)
  const vence = contexto.ahora() + dias * 86_400_000
  const sesionToken = firmaSesion(
    { correo: verificado.correo, vence, dispositivo, emitida: contexto.ahora() },
    env.PANEL_SECRETO,
  )

  // [C] Mejor esfuerzo, nunca bloquea el login — ver el docstring de
  // arriba. `mandaProtegido` está definida más abajo en este archivo (la
  // usan también `revierteYAvisa*`); la referencia hacia adelante es
  // segura porque es una `function` declarada, no una `const` — JS la
  // levanta (hoisting) antes de correr cualquier línea de este módulo.
  await mandaProtegido(contexto, { a: [verificado.correo], asunto: ASUNTO_AVISO_CONSUMO, texto: TEXTO_AVISO_CONSUMO })

  return ok({ ok: true }, cookieDeSesion(sesionToken, dias))
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

/**
 * Un aviso de conteo, tal cual sale por HTTP.
 *
 * [Revisión final de la rama] La respuesta de `publicar` devolvía el
 * `Problema` COMPLETO de `validacion.ts`, y eso es el contrato que la fase 6
 * va a cablear: achicarlo después es un cambio incompatible sobre código ya
 * escrito. Se achica ahora, y la decisión es explícita:
 *
 * - **`gravedad` se va.** Este array ya viene filtrado a `'avisa'` (los de
 *   `'impide'` bloquearon la publicación mucho antes de llegar acá), así que
 *   el campo es siempre el mismo valor. Una pantalla que lo lea estaría
 *   codificando un hecho redundante, y el día que alguien filtre por él y se
 *   equivoque, el bug es «los avisos dejaron de mostrarse» — silencioso.
 * - **`arreglo` se va.** Hoy `avisosDeConteo()` no lo produce nunca, y su
 *   `valor: unknown` es contenido de la clienta viajando sin forma. Si algún
 *   día hay un «arreglalo por mí», esa es una decisión de producto con la
 *   pantalla delante, no algo que se hereda por descuido.
 * - **`detalle` SE QUEDA**, en contra de lo que pedía el informe de la
 *   revisión (que decía «el par `{campo, titulo}`»). No es metadato: es la
 *   segunda oración que ella LEE —«Si agregaste o quitaste algo de la lista,
 *   este texto quedó viejo»— y el servidor es el único que la puede escribir,
 *   porque es quien sabe por qué cruzó el conteo. Sacarla no achica el
 *   contrato, le borra información a la pantalla y la obliga a inventar una
 *   explicación propia. Ya hay un test que le corre `jergaEn()` encima: está
 *   tratada como texto para ella desde el día uno.
 */
export interface AvisoPublicado {
  /** La ruta del campo, para que la pantalla lo pueda resaltar. */
  campo: string
  /** Lo que ella lee. Sin jerga. */
  titulo: string
  /** Por qué importa, cuando hace falta decirlo. Sin jerga. */
  detalle?: string
}

/** Del `Problema` de adentro al par mínimo que sale por HTTP — ver `AvisoPublicado`. */
const comoAviso = (p: Problema): AvisoPublicado => ({
  campo: p.campo,
  titulo: p.titulo,
  ...(p.detalle !== undefined ? { detalle: p.detalle } : {}),
})

/**
 * ¿Esto tiene forma de sha de commit? Cuarenta hexadecimales en minúscula,
 * que es lo que devuelve GitHub y lo único que el panel puede haber leído.
 *
 * [Revisión final de la rama] Existe porque el MISMO dato se validaba de tres
 * formas distintas: `estado` y `deshacer` exigían los cuarenta hexadecimales
 * para su `sha`, y `publicar` y `borrador.guardar` se conformaban con
 * «cadena no vacía» para su `base`. La consecuencia no era teórica: un `base`
 * basura en `publicar` pasaba el chequeo, llegaba hasta `gh.comparaRefs()`,
 * GitHub lo rechazaba, y la clienta recibía un 502 con «no pudimos revisar el
 * contenido actual del sitio: prueba de nuevo en unos minutos» — un
 * diagnóstico equivocado que la manda a reintentar algo que nunca va a
 * funcionar. Con la forma chequeada antes, es un 400 franco que le dice lo
 * único que de verdad lo arregla: volver a abrir el panel.
 */
const esShaDeCommit = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v)

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
 * el cliente de GitHub, uno solo
 * ---------------------------------------------------------------------
 */

/**
 * El cliente de GitHub de una acción autenticada, con la vigilancia del
 * vencimiento del token ya colgada.
 *
 * [Revisión final de la rama, I5] Antes este literal de cinco líneas estaba
 * escrito NUEVE veces en este archivo, y ocho de las nueve leían la cabecera
 * del vencimiento y la tiraban a la basura: la única que la consultaba era
 * `salud`, que ningún flujo automático llama. El modo de falla estaba
 * medido: el token vence en cuarenta días, ella publica todos los días,
 * Marcos no corre el `curl` del runbook porque nada se lo recuerda, el aviso
 * de los treinta días nunca sale, y el día D ella recibe un 502
 * incomprensible — que es literalmente el modo de falla que la Tarea 13
 * existía para evitar.
 *
 * Con `alResponder` (github.ts), CUALQUIER acción autenticada que hable con
 * GitHub dispara la vigilancia, sin un pedido de más: la cabecera viaja
 * arriba de respuestas que ya se estaban pidiendo. Y borrar ocho copias del
 * mismo literal no es cosmética: la copia que se olvide de algo es
 * exactamente cómo esta vigilancia se murió la primera vez.
 *
 * `salud` NO usa esta función, y es a propósito — ver su docstring.
 */
function clienteDeGitHub(contexto: Contexto): ReturnType<typeof cliente> {
  return cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
    // `vigilaVencimiento` está declarada más abajo, junto al resto de la
    // vigilancia (`DIAS_AVISO_VENCIMIENTO_TOKEN` y compañía): es una
    // `function` declarada, así que JS la levanta antes de correr una sola
    // línea de este módulo.
    alResponder: (vencimiento) => vigilaVencimiento(vencimiento, contexto),
  })
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
// [Revisión final de la rama, I4] El CUERPO ya no vive acá: sale de
// `fraseDeFracaso()` (estado.ts), que es la misma frase que ella ve en
// pantalla — la razón de siempre— pero ahora condicionada a lo que de verdad
// pasó con la reversión y con el aviso a Marcos. Ver `avisaAElla()`.

/**
 * [F-2] Manda una carta protegida por su propio `try`. `manda()` (correo.ts)
 * promete no tirar nunca, pero esa es una promesa de OTRO módulo: la de esta
 * función —y la de quien la llama, `revierteYAvisa*`— es no hacer fallar a
 * quien pidió la acción, y depender en silencio de que otro módulo cumpla su
 * contrato es exactamente la clase de acoplamiento que un `try` de una línea
 * evita gratis.
 *
 * [Ronda 3] El `try` atrapa lo IMPOSIBLE (que `manda()` tire, cosa que el
 * ruling T6-2 de `correo.ts` ya descarta); lo de verdad probable —que
 * `manda()` devuelva `{ ok: false }` porque no está configurado o el
 * proveedor lo rechazó— pasaba en silencio, sin loguear nada. `correo.ts`
 * documenta que el detalle es responsabilidad de QUIEN LLAMA, «que sí sabe en
 * qué contexto lo llamaron»: esto es ese log. Cuando el despliegue falla con
 * nadie mirando el panel, este correo es la ÚNICA señal que tiene Marcos —
 * que se pierda en silencio es peor que un log de más.
 */
async function mandaProtegido(contexto: Contexto, carta: Carta): Promise<boolean> {
  try {
    const r = await contexto.correo(carta)
    if (!r.ok) {
      console.error(`aviso: no se pudo mandar «${carta.asunto}» a ${carta.a.join(', ')} — ${r.motivo}`)
    }
    // [Revisión final de la rama, I4] Devuelve SI SE PUDO, y no `void`.
    // Quien avisa a Marcos necesita saberlo porque la frase que ella lee
    // —«...y ya le avisé a Marcos»— lo promete, y el correo degrada por
    // diseño: sin las variables de correo, esto loguea y sigue. Con `void`,
    // esa promesa se hacía a ciegas.
    return r.ok
  } catch (e) {
    console.error('revertir: el envío de un correo de aviso reventó —', e)
    return false
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
async function intentaRevertir(
  gh: ReturnType<typeof cliente>,
  sha: string,
  autor: string,
): Promise<{ revertido: boolean; resumen: string }> {
  try {
    const r = await revierte(gh, { sha, autor })
    if (r.ok) return { revertido: true, resumen: `revertido (commit ${r.sha ?? 'sin cambios'})` }
    // [Revisión final de la rama, I3] `ya-revertido` es ÉXITO, igual que en
    // `deshacerAccion` —el otro consumidor de `revierte()`, que siempre lo
    // trató así—. Acá caía en el `default` y salía como «NO se pudo
    // revertir», y eso no era un correo de más: era una FALSA ALARMA QUE
    // CONTRADICE AL ANTERIOR.
    //
    // Escenario medido: deploy fallido. Primer sondeo, la reversión corre
    // bien y a Marcos le llega «revertido (commit X)». Ella refresca la
    // pestaña. Segundo sondeo: la cabeza ya es la reversión —así que
    // `revisaLaCabeza()` se va sin hacer nada— pero `despliegueDe(shaViejo)`
    // sigue diciendo `falló`, se reintenta el revert, `revierte()` contesta
    // `ya-revertido`, y sale un segundo correo diciéndole a Marcos que la
    // reversión FALLÓ — cuando funcionó. Marcos sale a arreglar a mano un
    // repo sano, a las dos de la mañana.
    if (r.motivo === 'ya-revertido') {
      return { revertido: true, resumen: `ya estaba revertido (${r.detalle})` }
    }
    // [D] `nada-que-revertir` se cuenta con sus propias palabras: no es un
    // `revertido` (el commit roto se queda en `main`) ni entra en el
    // genérico «NO se pudo revertir», que suena a que algo salió mal cuando
    // lo que pasó es que no había NADA de contenido que revertir.
    if (r.motivo === 'nada-que-revertir') {
      console.error(`revertir: ${sha} no tenía nada que revertir — main sigue con el commit roto (${r.detalle}).`)
      return {
        // El commit roto se queda en la cabeza: el sitio NO quedó como
        // estaba, aunque no hubiera contenido que deshacer.
        revertido: false,
        resumen: 'no había nada que revertir: el commit no tocó ningún documento de contenido',
      }
    }
    console.error(`revertir: la reversión automática de ${sha} no se pudo hacer — ${r.motivo}: ${r.detalle}`)
    return { revertido: false, resumen: `NO se pudo revertir: ${r.motivo} — ${r.detalle}` }
  } catch (e) {
    console.error(`revertir: la reversión automática de ${sha} reventó —`, e)
    return { revertido: false, resumen: `NO se pudo revertir: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * Solo el correo a ella — sin intentar (de nuevo) el revert. Ver el uso en
 * `estadoAccion`, más abajo.
 *
 * [Revisión final de la rama, I4] El texto ya no es una constante: sale de
 * `fraseDeFracaso()` (estado.ts), la MISMA que va por HTTP, para que el
 * correo y la pantalla no cuenten dos historias distintas — que era la razón
 * de que fuera una constante en primer lugar—. Lo que cambió es que ahora
 * las dos dicen lo que de verdad pasó.
 */
async function avisaAElla(correoDeElla: string, contexto: Contexto, fracaso: Fracaso): Promise<void> {
  await mandaProtegido(contexto, {
    a: [correoDeElla],
    asunto: ASUNTO_PARA_ELLA,
    texto: `${fraseDeFracaso(fracaso)}\n\nPuedes volver a intentarlo cuando quieras.`,
  })
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
 *
 * [Ronda 3, Grupo 3] `correoDeElla` es SOLO el destinatario de SU correo —
 * quien está sondeando `estado`, que es a quien hay que avisarle—. Nunca el
 * autor que se le atribuye al commit: el trailer `Panel-Autor:` del commit
 * que se está por revertir, y el «publicado por X» del correo de Marcos,
 * salen de leer ESE commit, igual que hace `revisaLaCabeza()` en el camino de
 * al lado. Sondear `estado` no prueba que quien sondea sea quien publicó.
 */
async function revierteYAvisa(sha: string, correoDeElla: string, contexto: Contexto): Promise<Fracaso> {
  const gh = clienteDeGitHub(contexto)

  // El autor real, del trailer — nunca de quien está sondeando. Si esto
  // falla (GitHub no contesta, el commit no existe más), se cae a
  // `correoDeElla`: `intentaRevertir()` va a fallar de la misma manera un
  // instante después y loguear el motivo de verdad; acá no hace falta
  // duplicar ese log, alcanza con no dejar `autorReal` vacío.
  let autorReal = correoDeElla
  try {
    const commit = await gh.commit(sha)
    autorReal = autorDelCommit(commit.message) ?? correoDeElla
  } catch {
    // se sigue con `correoDeElla` — ver el comentario de arriba.
  }

  const { revertido, resumen } = await intentaRevertir(gh, sha, autorReal)

  // [Revisión final de la rama, I4] Marcos PRIMERO, ella después — al revés
  // que antes. No es capricho de orden: la frase que ella lee promete «ya le
  // avisé a Marcos», y eso no se puede prometer antes de haberlo intentado.
  // A Marcos: todo. El sha, qué pasó con la reversión, y a dónde mirar.
  const paraMarcos = contexto.env.PANEL_AVISOS_A
  const avisadoAMarcos =
    paraMarcos === undefined
      ? false
      : await mandaProtegido(contexto, {
          a: [paraMarcos],
          asunto: `[panel] El deploy de ${sha.slice(0, 7)} falló`,
          texto: [
            `El commit ${sha} publicado por ${autorReal} no construyó.`,
            `Reversión automática: ${resumen}.`,
            '',
            'El sitio sigue sirviendo el último deploy bueno.',
          ].join('\n'),
        })

  const fracaso: Fracaso = { revertido, avisadoAMarcos }
  await avisaAElla(correoDeElla, contexto, fracaso)
  return fracaso
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
async function revierteYAvisaAMarcos(sha: string, autorReal: string, contexto: Contexto): Promise<Fracaso> {
  const gh = clienteDeGitHub(contexto)

  const { revertido, resumen } = await intentaRevertir(gh, sha, autorReal)

  const paraMarcos = contexto.env.PANEL_AVISOS_A
  const avisadoAMarcos =
    paraMarcos === undefined
      ? false
      : await mandaProtegido(contexto, {
          a: [paraMarcos],
          asunto: `[panel] El deploy de ${sha.slice(0, 7)} falló`,
          texto: [
            `El commit ${sha} publicado por ${autorReal} no construyó (nadie tenía el panel abierto).`,
            `Reversión automática: ${resumen}.`,
            '',
            'El sitio sigue sirviendo el último deploy bueno.',
          ].join('\n'),
        })

  // [I4] Se devuelve para que `estadoAccion` —que puede estar corriendo en
  // la MISMA invocación, un instante después— pueda decirle a ella la verdad
  // sobre lo que pasó acá, en vez de repetir el intento para averiguarlo.
  return { revertido, avisadoAMarcos }
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
 * sincrónicas de cada acción) de `estadoAccion`, `publicarAccion`,
 * `deshacerAccion` e `historialAccion` — en `publicarAccion`, antes del
 * chequeo de `base` (Tarea 2): si la cabeza está rota y se revierte, la
 * cabeza cambia, y comparar contra la vieja daría un 409 por un commit que
 * acaba de dejar de existir.
 *
 * [B] Devuelve el sha que atendió —el que era la cabeza rota, no el de la
 * reversión nueva— o `null` si no había nada que hacer. `estadoAccion` lo usa
 * para no revertir NI avisar dos veces por el mismo sha: si esto ya lo
 * atendió (y ya le avisó a Marcos), lo único que falta es avisarle a ELLA.
 *
 * [Revisión final de la rama, I4] Y devuelve también QUÉ PASÓ —si revirtió,
 * si pudo avisarle a Marcos—, porque la frase que ella lee lo promete. Sin
 * esto, `estadoAccion` tenía que elegir entre repetir el intento para
 * averiguarlo o prometer a ciegas.
 *
 * [Ronda 3] Antes de revertir, consulta al CDN: si YA está sirviendo la
 * cabeza que la plataforma reporta como fallida, se abstiene. Esta es LA
 * red de seguridad —corre sin que nadie la pida, desde cuatro acciones—,
 * así que es también el camino más peligroso: si el reporte de la
 * plataforma está mal (que es justo lo que se midió en producción), acá es
 * donde el panel revertiría por su cuenta una publicación sana, sin que
 * nadie esté mirando para darse cuenta. `estadoAccion` ya tiene su propia
 * guardia contra esto (Ronda 2) para el camino en que alguien SÍ está
 * mirando, pero esa guardia vive en el llamador — y «una invariante que
 * depende de que todos los llamadores se acuerden no es una invariante»
 * (mismo argumento que ya usamos para la guardia de «no revertir una
 * reversión», más arriba en esta función). Acá va la misma regla, en el
 * lugar que de verdad decide: adentro de la función que revierte.
 */
async function revisaLaCabeza(contexto: Contexto): Promise<({ sha: string } & Fracaso) | null> {
  // Todo lo de acá adentro es "mejor esfuerzo": si algo falla, se loguea y se
  // sigue. Esta función NUNCA puede hacer fallar la acción que la llamó — sería
  // impedirle publicar por culpa de una limpieza que ni pidió.
  try {
    if (!contexto.env.PANEL_VERCEL_TOKEN) return null

    const gh = clienteDeGitHub(contexto)

    const cabeza = await gh.ref('heads/main')
    const commit = await gh.commit(cabeza.sha)

    // [F-4] Anclado por línea (`tieneTrailer`/`valorDeTrailer`, revertir.ts):
    // un commit a mano que solo MENCIONE «Panel: sí» en su cuerpo no puede
    // colarse como si fuera del panel.
    if (!tieneTrailer(commit.message, TRAILER_PANEL)) return null
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

    // [Ronda 3] Antes de revertir: ¿el CDN ya está sirviendo esta cabeza?
    // Si es así, el reporte de la plataforma está equivocado —el mismo
    // argumento que reordenó `decide()` (estado.ts) y que ya frena a
    // `estadoAccion` (Ronda 2), acá aplicado al camino sin nadie mirando.
    // Revertir en ese caso no es un error inocuo: es el panel destruyendo
    // por su cuenta una publicación sana. Es información que Marcos quiere
    // ver, así que queda en el log aunque no dispare ningún correo —no hay
    // «fracaso» que contar todavía, el sitio está bien.
    const shaServido = await shaQueSirveElCdn(contexto)
    if (shaServido === cabeza.sha) {
      console.error(
        `revisaLaCabeza: la plataforma dice que el despliegue de ${cabeza.sha} falló, ` +
          'pero el sitio YA lo está sirviendo — no se revierte.',
      )
      return null
    }

    // El autor real —para el correo de Marcos— sale del propio trailer del
    // commit, nunca de quien disparó esta limpieza.
    const autorReal = autorDelCommit(commit.message) ?? 'alguien del panel'

    console.error(`revisaLaCabeza: ${cabeza.sha} es un commit del panel cuyo despliegue falló — revirtiendo.`)
    const fracaso = await revierteYAvisaAMarcos(cabeza.sha, autorReal, contexto)
    return { sha: cabeza.sha, ...fracaso }
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
 * La validación de esquema de ARRIBA (`validarContra`, no `validar`) no
 * necesita conteos: los avisos de conteo (`gravedad: 'avisa'`) nunca
 * bloquean una publicación —son la misma comodidad que el navegador ya le
 * mostró antes de que ella apretara publicar—, así que no hace falta leer
 * un documento que no se va a escribir solo para decidir si esta
 * publicación PUEDE pasar. [Tarea 14] Para MOSTRARLOS en la respuesta —el
 * caso real llegó— sí hacen falta, pero recién DESPUÉS de escribir, nunca
 * acá: ver el bloque de avisos al final de esta función, que corre cuando
 * el commit ya es un hecho y por eso no puede fallar cerrado.
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
  if (!esShaDeCommit(cuerpo.base)) {
    console.error(
      `publicar: el cuerpo llegó sin un \`base\` con forma de sha (${JSON.stringify(cuerpo.base)}) — ` +
        'el panel que lo mandó es de antes del sha base, o lo armó mal.',
    )
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

  const gh = clienteDeGitHub(contexto)

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

  // Lo que la Fase 1b ya leyó o calculó, para que los AVISOS de conteo
  // (después de publicar, más abajo) lo reusen en vez de pedirlo de
  // nuevo: `sabores` vivo completo (solo se llena en la rama que lee
  // vivo, nunca en la que usa `documentos.sabores`) y `sitio` ya con sus
  // derivados injertados (solo se llena si `sitio` vino en el lote —es
  // el mismo documento que ya pasó `validarContra` dos líneas más abajo,
  // así que reusarlo para los avisos no repite ni el injerto ni la
  // lectura).
  let saboresVivoCrudo: unknown
  let sitioInjertado: unknown

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
        saboresVivoCrudo = JSON.parse(vivoSaboresTexto)
        fuentes = fuentesDeSabores(saboresVivoCrudo)
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

    sitioInjertado = paraValidar
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
    // Nada que escribir: ningún documento cambió, así que tampoco hay un
    // estado nuevo del sitio del que avisar. `avisos` viaja igual, vacío
    // —nunca ausente (ver el bloque de avisos, más abajo)— para que la
    // pantalla pueda leer `avisos.length` sin preguntarse primero si el
    // campo vino.
    return ok({ ok: true, sha: null, resumen: SIN_CAMBIOS, avisos: [] })
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

  // Los avisos de conteo (`gravedad: 'avisa'`, `avisosDeConteo()` en
  // validacion.ts): el sitio menciona una cantidad («LOS 15 SABORES») que
  // ya no coincide con la lista real. El commit YA se hizo —arriba— así
  // que esto corre DESPUÉS, nunca antes: un aviso, por definición, no
  // puede bloquear una publicación, y calcularlo antes de escribir habría
  // dejado abierta esa posibilidad el día que este bloque tuviera un bug.
  // Por la misma razón, cualquier falla ACÁ —de red, leyendo lo vivo que
  // haga falta; o de `conteosDe()`, si algún documento no tuviera la
  // lista que la tabla de conteos dice contar— se traduce en «sin
  // avisos», nunca en un error de respuesta sobre una publicación que ya
  // es un hecho.
  //
  // Reusa lo que esta misma llamada ya leyó o calculó —el sha base
  // (`base.sha`, el mismo de toda la Fase 2), el `sitio` ya injertado y
  // el `sabores` ya leído vivo que armó la Fase 1b, si los armó— y solo
  // pide de más lo que hace falta y todavía no está: pasa cuando el
  // documento en cuestión ni vino en el lote ni hizo falta leerlo para
  // los derivados de `sitio` (por ejemplo, publicar `sabores` solo, sin
  // `sitio` en el lote).
  let avisos: Problema[] = []
  try {
    const saboresParaConteos = idsConocidos.includes('sabores')
      ? documentos.sabores
      : saboresVivoCrudo !== undefined
        ? saboresVivoCrudo
        : JSON.parse(await gh.archivoEnRef(RUTA_DEL_DOCUMENTO('sabores'), base.sha))

    const sitioParaConteos =
      sitioInjertado !== undefined
        ? sitioInjertado
        : injerta(
            JSON.parse(await gh.archivoEnRef(RUTA_DEL_DOCUMENTO('sitio'), base.sha)),
            fuentesDeSabores(saboresParaConteos),
          )

    const conteos = conteosDe({ sitio: sitioParaConteos, sabores: saboresParaConteos })
    avisos = validar(DOCUMENTOS.sitio, sitioParaConteos, conteos).filter((p) => p.gravedad === 'avisa')
  } catch (e) {
    console.error(
      'publicar: no se pudieron calcular los avisos de conteo (no bloquea: la publicación ya está hecha) —',
      e,
    )
  }

  return ok({ ok: true, sha: resultado.sha, resumen: resultado.resumen, avisos: avisos.map(comoAviso) })
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

/*
 * ---------------------------------------------------------------------
 * [Tarea 13] la vigilancia del vencimiento del PAT — spec §4.1: el modo de
 * falla sin esto es «la clienta publica y recibe un 401 incomprensible», sin
 * que nada haya cambiado. `salud` ya pide `gh.ref('heads/main')` detrás del
 * freno por IP de I-6; esa MISMA respuesta trae la cabecera del vencimiento
 * (`gh.vencimientoDelToken()`, github.ts), así que avisar con treinta días
 * de anticipación no le cuesta a la vigilancia ni un pedido más al PAT.
 * ---------------------------------------------------------------------
 */

/** A cuántos días o menos de vencer se manda el aviso a Marcos. */
const DIAS_AVISO_VENCIMIENTO_TOKEN = 30

/**
 * Días completos que faltan para `tokenVence`, o `null` si no hay nada que
 * calcular: ni cuando la cabecera no vino (`tokenVence === null`, nunca una
 * fecha inventada — ver `vencimientoDelToken()` en github.ts) ni cuando lo
 * que vino no se puede leer como fecha (una cabecera con otra forma un día
 * que GitHub cambie algo no puede convertirse en un aviso con un número
 * inventado adentro).
 */
function diasHastaVencimiento(tokenVence: string | null, ahora: number): number | null {
  if (tokenVence === null) return null
  const vence = Date.parse(tokenVence)
  if (!Number.isFinite(vence)) return null
  return Math.floor((vence - ahora) / 86_400_000)
}

// [Tarea 13] Cuántas veces se avisó que el token está por vencer, en la
// ventana de las últimas 24 h — mismo TIPO de `Map` en memoria que
// `intentoPermitido` (`INTENTOS`, sesion.ts), pero con su propia ventana:
// acá no hay quince minutos que reusar, porque esto protege otra cosa. `I-6`
// (arriba) ya frena el PEDIDO a GitHub por IP; esto frena el CORREO —y
// `salud` se puede llamar SIN sesión, así que sin este freno cualquiera con
// una línea de comandos le manda a Marcos un correo por segundo. Una sola
// clave fija, no una por IP ni por lo que sea: lo que hay que limitar es
// CUÁNTOS avisos salen en total, no cuántos pide cada quien.
//
// [Honesto sobre lo que puede — mismo criterio, letra por letra, que el
// comentario de `INTENTOS` en sesion.ts] Esto vive en la memoria de ESTE
// proceso: las funciones serverless son efímeras y concurrentes, cada
// instancia tiene su propio `Map`, así que el tope real es «como mucho un
// aviso cada 24 h POR INSTANCIA VIVA», no «como mucho un aviso cada 24 h» a
// secas — dos instancias corriendo a la vez, o Vercel reciclando una,
// pueden mandar dos avisos el mismo día. Acá el costo de estar mal es un
// correo de más para Marcos, no una brecha de seguridad, así que alcanza.
const AVISOS_VENCIMIENTO_TOKEN = new Map<string, number[]>()
const VENTANA_AVISO_VENCIMIENTO_MS = 24 * 60 * 60_000
const CLAVE_AVISO_VENCIMIENTO_TOKEN = 'token-github'

/** ¿Se puede mandar otro aviso de vencimiento ahora, o ya se mandó uno en las últimas 24 h? */
function avisoDeVencimientoPermitido(ahora: number): boolean {
  const marcas = (AVISOS_VENCIMIENTO_TOKEN.get(CLAVE_AVISO_VENCIMIENTO_TOKEN) ?? [])
    .filter((t) => ahora - t < VENTANA_AVISO_VENCIMIENTO_MS)

  if (marcas.length >= 1) {
    AVISOS_VENCIMIENTO_TOKEN.set(CLAVE_AVISO_VENCIMIENTO_TOKEN, marcas)
    return false
  }

  marcas.push(ahora)
  AVISOS_VENCIMIENTO_TOKEN.set(CLAVE_AVISO_VENCIMIENTO_TOKEN, marcas)
  return true
}

/**
 * [Revisión final de la rama, I5] La vigilancia misma, colgada de
 * `alResponder` (github.ts) por `clienteDeGitHub()` — o sea de CADA
 * respuesta de GitHub de CUALQUIER acción autenticada, que es lo que le
 * faltaba: antes vivía suelta adentro de `salud`, la única acción que ningún
 * flujo automático llama.
 *
 * No pide nada: la cabecera ya vino arriba de una respuesta que se estaba
 * pidiendo igual, así que esto no le cuesta al PAT ni un pedido más. Y no
 * puede hacer fallar al pedido que la disparó: lo único que hace es
 * `mandaProtegido()`, que se traga todo.
 *
 * Los dos frenos siguen siendo los de la Tarea 13: una vez cada 24 h por
 * instancia (`avisoDeVencimientoPermitido`) y solo dentro de los últimos
 * treinta días. Con la vigilancia colgada de cada pedido —y una publicación
 * hace media docena— el freno de 24 h pasa de ser una comodidad a ser lo que
 * impide que una sola publicación le mande seis correos iguales a Marcos.
 */
async function vigilaVencimiento(tokenVence: string | null, contexto: Contexto): Promise<void> {
  if (tokenVence === null) return
  const ahora = contexto.ahora()
  const dias = diasHastaVencimiento(tokenVence, ahora)
  if (dias === null || dias > DIAS_AVISO_VENCIMIENTO_TOKEN) return

  const paraMarcos = contexto.env.PANEL_AVISOS_A
  if (!paraMarcos || !avisoDeVencimientoPermitido(ahora)) return

  await mandaProtegido(contexto, {
    a: [paraMarcos],
    asunto: ASUNTO_AVISO_VENCIMIENTO(dias),
    texto: textoAvisoVencimiento(tokenVence, dias),
  })
}

const ASUNTO_AVISO_VENCIMIENTO = (dias: number): string =>
  `[panel] El token de GitHub vence en ${dias} día${dias === 1 ? '' : 's'}`

// [E7 — para Marcos, no para la clienta] Este correo SÍ puede ser técnico:
// nombra la variable de entorno y el archivo del runbook, porque quien lo
// lee es Marcos, no ella. Contraste a propósito con `fraseDeFracaso()`
// (estado.ts), que es lo que lee ella y nunca nombra una variable ni un
// archivo.
function textoAvisoVencimiento(tokenVence: string, dias: number): string {
  const cuandoFalta = dias > 0 ? `faltan ${dias} día${dias === 1 ? '' : 's'}` : 'ya venció, o vence hoy'
  return [
    `El token de GitHub (\`PANEL_GITHUB_TOKEN\`) vence el ${tokenVence} — ${cuandoFalta}.`,
    '',
    'Generá uno nuevo con los mismos permisos (Contents: Read and write, sin Workflows), cargalo en Vercel y redesplegá — las variables se leen al arrancar la función, así que sin el redeploy el token nuevo no sirve de nada.',
    '',
    'Los pasos exactos: docs/panel-operacion.md, sección «Renovar el token de GitHub».',
  ].join('\n')
}

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
 *
 * [Revisión final de la rama, I5] Es la única acción que arma su cliente de
 * GitHub a mano en vez de con `clienteDeGitHub()`, y es a propósito: esa
 * función cuelga la vigilancia del vencimiento de CADA respuesta, y `salud`
 * es la única puerta sin sesión. Enchufarla acá sería dejar que cualquiera
 * con un `curl` haga que el panel le escriba a Marcos.
 *
 * [Tarea 13] El cuerpo también suma `tokenVence`/`diasParaVencer`, leídos
 * de la MISMA respuesta de `gh.ref('heads/main')` que ya se pedía para
 * `github` —nunca un pedido aparte—. Se calculan incluso si GitHub contestó
 * mal: `vencimientoDelToken()` guarda la cabecera de CUALQUIER respuesta.
 * Eso es lo que lee el `curl` del runbook, y se queda.
 *
 * [Revisión final de la rama, I6] Lo que NO hace más es MANDAR el correo del
 * vencimiento. Mandarlo desde acá convertía a la única puerta sin sesión en
 * un amplificador: el freno de una-vez-cada-24-h vive en la memoria de UNA
 * instancia, y las funciones de la plataforma son efímeras y concurrentes,
 * así que durante los últimos treinta días del token cualquiera con un bucle
 * de `curl` en paralelo provoca instancias frías y cada una manda su propio
 * correo a Marcos y gasta su propio pedido del PAT — la misma cuota que
 * `publicar` necesita. Poner el correo detrás del freno POR IP no lo
 * arreglaba: ese `Map` es igual de por-instancia (sesion.ts lo declara con
 * todas las letras), así que no frena nada entre instancias frías.
 *
 * No se pierde la vigilancia, se gana: desde el arreglo I5 cuelga de
 * `clienteDeGitHub()`, o sea de CUALQUIER acción autenticada que hable con
 * GitHub — cobertura estrictamente mayor que la de `salud`, a la que ningún
 * flujo automático llamaba. El amplificador anónimo, en cambio, desaparece.
 */
async function salud(_pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const faltan = VARIABLES_REQUERIDAS.filter((v) => !contexto.env[v])

  if (faltan.length > 0) {
    return { status: 503, cuerpo: { ok: false, faltan, github: null } }
  }

  // Las siete están: falta ver si GitHub de verdad contesta con ellas — y
  // ESE paso es el que va detrás del freno, no el chequeo de variables de
  // arriba. [Ronda 1, Tarea 12, hallazgo E] Presupuesto propio de `salud`
  // (`claveFreno`), no compartido con `entrar`/`enlace`.
  if (!intentoPermitido(claveFreno('salud', contexto.ip), contexto.ahora())) {
    return {
      status: 200,
      cuerpo: { ok: true, faltan: [], github: null, tokenVence: null, diasParaVencer: null, problema: PROBLEMA_SALUD_OMITIDA },
    }
  }

  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN!,
    duenio: contexto.env.GITHUB_DUENIO!,
    repo: contexto.env.GITHUB_REPO!,
    fetch: contexto.fetch,
  })

  let githubOk: boolean
  try {
    await gh.ref('heads/main')
    githubOk = true
  } catch (e) {
    // El detalle técnico es para Marcos, no para el JSON de salud.
    console.error('salud: GitHub no contestó', e)
    githubOk = false
  }

  // [Tarea 13] `vencimientoDelToken()` no pide nada: lee lo que la respuesta
  // de ARRIBA ya trajo, le haya ido bien o mal a `gh.ref`. [I6] Se INFORMA,
  // no se avisa por correo — ver el docstring de esta función.
  const tokenVence = gh.vencimientoDelToken()
  const diasParaVencer = diasHastaVencimiento(tokenVence, contexto.ahora())

  return githubOk
    ? { status: 200, cuerpo: { ok: true, faltan: [], github: true, tokenVence, diasParaVencer } }
    : { status: 503, cuerpo: { ok: false, faltan: [], github: false, tokenVence, diasParaVencer } }
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
 * [Inversión de precedencia] Las dos lecturas van SIEMPRE, ya no una
 * condicionada a la otra. Antes, `version.json` (el CDN, barato y confiable)
 * solo se consultaba si la plataforma YA había dicho `'listo'` — y medido en
 * producción, un despliegue que SÍ había terminado y SÍ se estaba sirviendo
 * contestó «en curso» 31 sondeos seguidos porque esa otra lectura, la que
 * puede fallar, no encontraba el despliegue. `decide()` (estado.ts) le da
 * ahora la última palabra al CDN: si ya sirve el sha publicado, alcanza
 * solo. La plataforma sigue haciendo falta para la otra pregunta —«falló» o
 * «todavía va»—, que `version.json` no puede contestar por sí sola.
 *
 * Si `version.json` no contesta, NO se asume nada: se sigue con
 * `shaServido: null`, que nunca coincide, así que el veredicto depende de lo
 * que diga la plataforma. Una de las dos fuentes caída no puede volverse un
 * «sí» por omisión.
 *
 * [Ronda 2] La misma idea, llevada a las dos puntas que le faltaban:
 *   - Si la PLATAFORMA no contesta (se cae, tira, lo que sea) pero el CDN
 *     YA confirma el sha publicado, no se corta con 502 — el CDN alcanza
 *     solo, la plataforma ahí no hacía falta. Recién si el CDN TAMPOCO lo
 *     confirma es que de verdad no sabemos nada, y ahí sí el 502 de siempre.
 *   - Si el CDN YA confirma el sha publicado, tampoco se dispara la
 *     reversión automática aunque la plataforma diga `'falló'`: sería
 *     destruir un cambio que está funcionando, servido de verdad, por un
 *     reporte equivocado.
 */
async function estadoAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('estado: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

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
  if (!esShaDeCommit(cuerpo.sha)) {
    return error(400, PROBLEMA_INESPERADO)
  }
  const publicadoEn = typeof cuerpo.publicadoEn === 'number' ? cuerpo.publicadoEn : contexto.ahora()

  // [B1, Grupo C — ronda 3] Recién ACÁ, después de las tres validaciones
  // baratas y sincrónicas de arriba (token ausente, proyecto sin nombre,
  // `sha` mal formado): antes tocaba GitHub —un pedido real, medido— incluso
  // cuando cualquiera de esas tres iba a rechazar el pedido igual. Mismo
  // criterio que `publicarAccion` (Grupo C, ronda 2); el comentario viejo acá
  // decía que esta acción «no tiene ningún chequeo sincrónico previo», y eso
  // era falso: tenía tres.
  const shaYaAtendido = await revisaLaCabeza(contexto)

  const vercel = clienteVercel({
    token: env.PANEL_VERCEL_TOKEN,
    proyecto,
    fetch: contexto.fetch,
  })

  // [Ronda 2] Ya no corta con 502 apenas la plataforma falla: `despliegue`
  // queda en `null` y el error se guarda para el log, pero seguimos —ver el
  // comentario grande de más abajo sobre por qué.
  let despliegue: { estado: EstadoDeDespliegue; url: string | null } | null = null
  let porQueNoContestoLaPlataforma: unknown
  try {
    despliegue = await vercel.despliegueDe(cuerpo.sha)
  } catch (e) {
    porQueNoContestoLaPlataforma = e
  }

  // [Inversión de precedencia] SIEMPRE, ya no solo cuando `despliegue.estado
  // === 'listo'` — ni siquiera condicionado a que la plataforma haya
  // contestado algo. Medido en producción: el despliegue había terminado
  // bien, el CDN ya servía el sha nuevo, y esta lectura ni se hacía porque
  // la de arriba decía otra cosa — 31 sondeos seguidos de «en curso» con el
  // cambio YA publicado. `decide()` (estado.ts) es quien ahora sabe que el
  // CDN alcanza solo; acá no hay que adivinarlo, solo preguntarle siempre.
  const shaServido = await shaQueSirveElCdn(contexto)

  // [Ronda 2, degradación] Antes, que la plataforma no contestara cortaba
  // ACÁ MISMO con 502, antes de mirar nada más. Con la inversión de
  // precedencia de arriba, eso deja muda a la fuente que manda —el CDN—
  // por culpa de la que puede fallar: el mismo defecto que motivó todo este
  // arreglo, ahora del lado del error de red y no del lado del estado. Si
  // el CDN YA confirma el sha publicado, la plataforma no hace falta para
  // saber que está listo. Recién si el CDN TAMPOCO lo confirma es que de
  // verdad no sabemos nada —ahí falta la única fuente que distingue
  // «falló» de «todavía va»— y corresponde el 502 de siempre.
  if (despliegue === null) {
    if (shaServido === cuerpo.sha) {
      // [Ronda 3] `null`, no `'desconocido'`: son dos hechos distintos.
      // `'desconocido'` es un reporte REAL de la plataforma («no tengo
      // ningún despliegue para este commit», vercel.ts); acá no hubo
      // reporte de ningún tipo, la plataforma no contestó nada. `decide()`
      // (estado.ts) ya distingue los dos en su tipo — ver el comentario ahí.
      return ok({
        ok: true,
        ...decide({
          despliegue: null,
          url: null,
          shaServido,
          shaPublicado: cuerpo.sha,
          desdeHaceMs: contexto.ahora() - publicadoEn,
        }),
      })
    }
    console.error('estado: la plataforma no contestó por el despliegue —', porQueNoContestoLaPlataforma)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

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
  //
  // [Revisión final de la rama, I4] Esto corre ANTES de `decide()`, no
  // después: la frase que sale por HTTP promete que el sitio quedó como
  // estaba y que Marcos ya sabe, y esas dos cosas no se saben hasta
  // haberlas intentado. Con el orden viejo, `decide()` las prometía y el
  // código que las pagaba corría después.
  //
  // [Ronda 2] Y el segundo `if` de acá abajo —el que de verdad dispara
  // `revierteYAvisa()`— no revierte cuando el CDN YA sirve el sha
  // publicado. Es la misma razón que reordenó `decide()`: el CDN es el
  // hecho observable, `despliegue.estado === 'falló'` es un reporte SOBRE
  // ese hecho, y acá el reporte puede estar mal. Revertir en ese caso no es
  // un error inocuo — es destruir un cambio que está funcionando, servido
  // de verdad, por un reporte equivocado. Si el sitio ya sirve lo que ella
  // publicó, no hay nada que revertir.
  let fracaso: Fracaso | undefined
  if (despliegue.estado === 'falló') {
    if (shaYaAtendido?.sha === cuerpo.sha) {
      fracaso = { revertido: shaYaAtendido.revertido, avisadoAMarcos: shaYaAtendido.avisadoAMarcos }
      await avisaAElla(sesion.correo, contexto, fracaso)
    } else if (shaServido !== cuerpo.sha) {
      fracaso = await revierteYAvisa(cuerpo.sha, sesion.correo, contexto)
    } else {
      // [Ronda 3] Mismo log que `revisaLaCabeza()` para el mismo caso: la
      // plataforma reportando mal es información que Marcos quiere ver,
      // aunque acá no haga falta ningún correo —el sitio está bien.
      console.error(
        `estado: la plataforma dice que el despliegue de ${cuerpo.sha} falló, ` +
          'pero el sitio YA lo está sirviendo — no se revierte.',
      )
    }
  }

  const veredicto = decide({
    despliegue: despliegue.estado,
    url: despliegue.url,
    shaServido,
    shaPublicado: cuerpo.sha,
    desdeHaceMs: contexto.ahora() - publicadoEn,
    ...(fracaso ? { fracaso } : {}),
  })

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
 * deshacer (Tarea 9, spec §4.6)
 * ---------------------------------------------------------------------
 */

/**
 * Cuánto dura el botón «Deshacer esta publicación» (spec §4.6).
 *
 * No es una limitación técnica: el commit sigue ahí para siempre y el
 * historial lo puede revertir cuando sea (Tarea 10). Es la línea entre dos
 * gestos distintos —«me equivoqué recién, sacalo» y «quiero volver a una
 * versión vieja»— que merecen dos pantallas distintas, porque el primero se
 * hace con una mano, parada en un mercado, y el segundo se hace sentada y
 * mirando.
 *
 * Exportada porque la fase 6 la necesita para saber cuándo dejar de dibujar
 * el botón: el servidor y la pantalla tienen que estar de acuerdo en cuándo
 * se apaga, o ella lo va a apretar y va a recibir un error.
 */
export const VENTANA_DESHACER_MS = 30 * 60_000

// Éxito: ya está como estaba. La misma frase la use `deshacerAccion` para
// terminar de deshacer o para contarle que YA estaba deshecho (motivo
// `ya-revertido`, más abajo) — desde donde ella lo mira, el sitio quedó
// igual en los dos casos, y no hay ninguna razón para que sean dos frases.
const RESUMEN_DESHECHO = 'Listo, lo dejé como estaba antes.'

// [B8] Desde donde ella lo mira, «ya publicaste otra cosa encima» (motivo
// `no-es-la-cabeza` de `revierte()`) y «pasó mucho tiempo» (la ventana, acá
// abajo) son el mismo hecho: no se puede deshacer desde ACÁ, hay que ir al
// historial. Dos frases para eso serían dos formas de decir lo mismo con
// más palabras — y el historial (Tarea 10) es justo la pantalla que sabe
// resolver las dos.
const PROBLEMA_TARDE = 'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.'

const PROBLEMA_NO_VALIDA = 'Ese contenido ya no cumple con las reglas de hoy. Puedo abrírtelo como borrador para que lo ajustes.'
const PROBLEMA_NO_ES_TUYO = 'Ese cambio no se publicó desde aquí, así que no lo puedo deshacer.'

// [Tarea 9, Ronda 1] `nada-que-revertir` es un hecho PERMANENTE de ese
// commit —no tocó ningún documento de contenido— no una falla de conexión:
// reintentar no lo va a arreglar nunca. Antes caía en la misma frase
// genérica de «no pudimos conectarnos» que `falló`, y eso es engañoso — la
// fase 7, cuando publique imágenes sueltas, va a hacer este camino
// alcanzable de verdad (revertir.ts, comentario [D]): ella aprieta
// «Deshacer», recibe «prueba de nuevo en unos minutos», reintenta tres
// veces con el mismo resultado, y termina convencida de que el sitio está
// caído. 409, no 502: no es un error nuestro, es que no hay nada que hacer
// desde acá.
const PROBLEMA_NADA_QUE_DESHACER = 'Esa publicación no cambió ningún dato del sitio, así que no hay nada que deshacer.'

/**
 * `deshacer`: volver atrás la última publicación, durante media hora (spec
 * §4.6, Tarea 9).
 *
 * Toda la mecánica —qué commit es válido revertir, cómo se arma el commit
 * nuevo con los blobs viejos, la idempotencia— vive en `revertir.ts` (Tarea
 * 8). Lo que agrega ESTA función es la VENTANA de tiempo y las frases para
 * ella. La ventana se chequea ACÁ y no en `revertir.ts` a propósito: media
 * hora es una regla de PRODUCTO —dónde termina «me equivoqué recién» y
 * empieza «quiero volver a una versión vieja»— y `revertir.ts` también sirve
 * a la reversión AUTOMÁTICA (más arriba en este archivo), que no tiene
 * ninguna ventana: un despliegue puede tardar más de media hora en fallar.
 *
 * [B1] Mismo orden que `publicarAccion`/`estadoAccion`: `revisaLaCabeza()`
 * corre DESPUÉS de las validaciones baratas y sincrónicas (secreto, sesión,
 * forma del `sha`) — así una sesión vencida o un `sha` mal formado no gastan
 * ni un pedido de red. Y antes de leer nada más: si la cabeza estaba rota
 * por un despliegue fallido y se autorrevierte acá mismo, lo que sigue ya ve
 * el sitio arreglado — y si el sha que ella quería deshacer era justo ESE,
 * `revierte()` lo va a encontrar como `ya-revertido` (éxito) en vez de
 * `no-es-la-cabeza` (que también sería correcto, pero más confuso: ella no
 * hizo nada raro, el sitio ya está como quería).
 */
async function deshacerAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('deshacer: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  const cuerpo = (pedido.cuerpo ?? {}) as { sha?: unknown }
  if (!esShaDeCommit(cuerpo.sha)) {
    return error(400, PROBLEMA_INESPERADO)
  }

  await revisaLaCabeza(contexto)

  const gh = clienteDeGitHub(contexto)

  // La ventana, antes de tocar nada más: si ya pasó, no hay razón para leer
  // el contenido viejo del padre ni para armar nada — un 409 franco y listo.
  let publicadoEn: number
  try {
    const commit = await gh.commit(cuerpo.sha)
    publicadoEn = Date.parse(commit.author.date)
  } catch (e) {
    console.error(`deshacer: no se pudo leer el commit ${cuerpo.sha} —`, e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  // [Tarea 9, Ronda 1] `!Number.isFinite(publicadoEn)` no es decorativo:
  // `NaN > VENTANA_DESHACER_MS` da `false` en JavaScript, así que SIN esta
  // guardia una fecha ilegible («GitHub contestó algo raro») caería del
  // lado PERMISIVO —se podría deshacer cualquier commit, de cualquier
  // fecha— en vez de rechazarse. Es el bug clásico de comparar con `NaN`, y
  // acá abre la ventana de media hora para siempre si alguien lo reintroduce.
  //
  // El `>` (y no `>=`) es una elección explícita: a los 30:00.000 exactos
  // TODAVÍA se puede deshacer. Ver los tests del borde en acciones.test.ts.
  if (!Number.isFinite(publicadoEn) || contexto.ahora() - publicadoEn > VENTANA_DESHACER_MS) {
    return error(409, PROBLEMA_TARDE)
  }

  // [Revisión final de la rama] Sin `bytesDelCuerpo`: el cuerpo de un
  // deshacer son unos cincuenta bytes, y lo que `revierte()` escribe son los
  // archivos viejos que restaura. Pasárselo desactivaba el tope de 3,5 MB
  // justo en ese camino — ver el comentario en `revierte()`.
  const r = await revierte(gh, { sha: cuerpo.sha, autor: sesion.correo })

  if (r.ok) return ok({ ok: true, sha: r.sha, resumen: RESUMEN_DESHECHO })

  switch (r.motivo) {
    case 'no-es-la-cabeza':
      return error(409, PROBLEMA_TARDE)
    // Ya está deshecho. Decirle que falló sería mentirle sobre el estado del
    // sitio, que es lo único que ella quería saber.
    case 'ya-revertido':
      return ok({ ok: true, sha: null, resumen: RESUMEN_DESHECHO })
    case 'no-es-del-panel':
      return error(403, PROBLEMA_NO_ES_TUYO)
    case 'no-valida':
      console.error(`deshacer: el contenido viejo de ${cuerpo.sha} no pasa las reglas de hoy — ${r.detalle}`)
      return error(422, PROBLEMA_NO_VALIDA)
    // Permanente, no una falla de red — ver el comentario de
    // `PROBLEMA_NADA_QUE_DESHACER` más arriba.
    case 'nada-que-revertir':
      console.error(`deshacer: ${cuerpo.sha} no tenía nada que revertir — ${r.detalle}`)
      return error(409, PROBLEMA_NADA_QUE_DESHACER)
    // Solo `falló` llega hasta acá: un error de verdad del lado de GitHub
    // (`revierte()`/`publica()`), la misma frase que usa `traduceError()`
    // en `publicar.ts` — compartida para que las dos no se desincronicen.
    default:
      console.error(`deshacer: no se pudo deshacer ${cuerpo.sha} — ${r.motivo}: ${r.detalle}`)
      return error(502, PROBLEMA_NO_SE_PUDO_PUBLICAR)
  }
}

/*
 * ---------------------------------------------------------------------
 * historial (Tarea 10, spec §4.6 y §4.5)
 * ---------------------------------------------------------------------
 */

// Alcanza y sobra para "qué pasó últimamente": el spec (§4.6) pide poder
// entender su última tanda de cambios, no un archivo completo del sitio —
// y una lista más larga es una pantalla más larga en un celular.
const CANTIDAD_HISTORIAL = 20

/**
 * `historial`: qué se publicó, cuándo y quién (spec §4.6). Es también la
 * respuesta a "¿qué pasó con lo que acabo de publicar?" cuando ella reabre
 * el panel (spec §4.5) — las dos preguntas salen del mismo lugar: la lista
 * de commits del panel en `main`, leída una sola vez.
 *
 * Sin ningún cuerpo que validar —esta acción no recibe más que la sesión—,
 * así que no hay ninguna validación barata y sincrónica propia entre la
 * sesión y `revisaLaCabeza()` (Tarea 8): corre apenas la sesión es válida,
 * como PRIMERA cosa, igual que en `estadoAccion`/`deshacerAccion`. Si la
 * cabeza de `main` es un commit del panel cuyo despliegue falló, se arregla
 * ANTES de armar la lista — si no, ella vería su propia publicación fallida
 * en el historial como si hubiera salido bien.
 *
 * Toda la traducción —qué cuenta como "del panel", cómo se separan asunto y
 * trailers, cómo se ve una reversión— vive en `lee()` (`historial.ts`); acá
 * solo se pide la lista y se delega.
 *
 * [Revisión final de la rama, I9] Y devuelve `base`: el sha de la cabeza de
 * `main` HOY. Es la fuente oficial del `base` que `publicar` exige —rechaza
 * con 400 cualquier cuerpo que no lo traiga— y hasta acá NINGUNA acción lo
 * entregaba: `salud` no lo traía, `historial` filtraba por commits del panel
 * (si el último es de Marcos, no está en la lista), `estado` lo pide como
 * ENTRADA, y `borrador.leer` devuelve el `base` VIEJO del borrador. La fase 6
 * se iba a encontrar con un 400 obligatorio y sin fuente.
 *
 * Sale de `commits[0]` —lo que GitHub ya contestó, ANTES de filtrar por
 * `Panel: sí`—, así que no cuesta ni un pedido más. Y sale de ACÁ y no de
 * `salud` (que es donde lo pedía el informe de la revisión) por dos razones:
 * `salud` corre detrás del freno de cinco pedidos cada quince minutos por IP,
 * así que como fuente del `base` se apagaría justo en una sesión de edición
 * intensa —y sin `base` no se puede publicar—, y además `salud` no pide
 * sesión: el estado de `main` no tiene por qué contestárselo a cualquiera con
 * un `curl`. `historial` ya es, según el cierre de esta parte, lo primero que
 * la pantalla tiene que llamar al abrir el panel.
 */
async function historialAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('historial: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  await revisaLaCabeza(contexto)

  const gh = clienteDeGitHub(contexto)

  let commits: Array<{ sha: string; mensaje: string; fecha: string }>
  try {
    commits = await gh.listaCommits('heads/main', CANTIDAD_HISTORIAL)
  } catch (e) {
    console.error('historial: no se pudo leer la lista de commits de GitHub —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  return ok({
    ok: true,
    // [I9] Antes de filtrar: la cabeza de `main` puede ser un commit de
    // Marcos, y ése es justo el caso en que el `base` de la lista filtrada
    // estaría viejo y la publicación siguiente se rechazaría por pisada.
    base: commits[0]?.sha ?? null,
    publicaciones: lee(commits, contexto.ahora()),
  })
}

/*
 * ---------------------------------------------------------------------
 * el borrador (Tarea 11, spec §4.3 capa 2)
 * ---------------------------------------------------------------------
 */

const PROBLEMA_BORRADOR_INCOMPLETO = 'Falta información para guardar tu borrador: vuelve a abrir el panel.'
const PROBLEMA_NO_SE_PUDO_GUARDAR_BORRADOR = 'No pudimos guardar tu borrador: prueba de nuevo en unos minutos.'
const PROBLEMA_NO_SE_PUDO_LEER_BORRADOR = 'No pudimos abrir tu borrador: prueba de nuevo en unos minutos.'
// [Producto] No es un error de nadie: es el aviso que existe para que
// NINGÚN aparato pise en silencio el trabajo de otro (mismo criterio que la
// Tarea 2 aplica a publicar, un nivel más abajo). El servidor no decide qué
// preguntarle a ella sobre esto —esa pantalla es de la fase 6 (spec
// §4.3)—; esta frase es solo un acompañante por si algo la muestra sin
// mirar `otro`.
const PROBLEMA_BORRADOR_MAS_NUEVO = 'Alguien más guardó un cambio más reciente desde otro aparato.'

interface CuerpoBorradorGuardar {
  documentos?: unknown
  base?: unknown
  /**
   * [Revisión final de la rama, I1] La `hora` del borrador que ESTE aparato
   * leyó (de `borrador.leer`), o ausente si no leyó ninguno. Es el token de
   * concurrencia que hace que el candado anti-pisada exista de verdad — ver
   * `DatosParaGuardar.horaLeida` en `borrador.ts` para el escenario medido
   * que tenía roto, y el cierre de la Parte B: es un campo que la pantalla
   * de la fase 6 ahora tiene que mandar.
   */
  horaLeida?: unknown
  /** Si hay que pisar el borrador de OTRO aparato aunque sea más nuevo (ver `guarda()`, `borrador.ts`). */
  pisar?: unknown
}

/**
 * `borrador.guardar`: la capa 2 del borrador (spec §4.3) — la capa 1,
 * IndexedDB tecla a tecla, es de la fase 6. Esta es la que hace que lo que
 * ella escribió a medias sobreviva a cambiar de aparato.
 *
 * [B1] Sin `revisaLaCabeza()`, a propósito, y es una decisión —no un
 * olvido—: esa limpieza es del pipeline de PUBLICACIÓN de `main` (¿el
 * último commit del panel desplegó bien?), y el ref del borrador no tiene
 * nada que ver con eso —la plataforma ni siquiera lo mira, decisión B5—.
 * Correrla acá sería un pedido de más a GitHub y a la plataforma por cada
 * guardado —y ella puede guardar cada pocos segundos, fase 6— sin que haya
 * ningún commit de `main` que este camino pueda dejar roto.
 *
 * `autor` sale de la SESIÓN, nunca del cuerpo —mismo criterio que
 * `publicarAccion`—: quien firma el borrador es quien está autenticada, no
 * lo que el navegador diga que es. `ahora` sale del reloj inyectado, nunca
 * de lo que mande el cliente: si el aparato tiene la hora mal, la `hora` que
 * se guarda tiene que seguir saliendo del reloj del SERVIDOR, que es el
 * único que los dos aparatos comparten.
 *
 * [Revisión final de la rama, I1] Lo que SÍ sale del cuerpo es `horaLeida`:
 * la `hora` del borrador que este aparato leyó, o sea el token de
 * concurrencia. No es un dato de confianza ni hace falta que lo sea —es un
 * valor que el servidor mismo escribió y devolvió, y lo único que puede
 * lograr mintiendo es pisar un borrador que igual podía pisar mandando
 * `pisar: true`—: lo que hace es distinguir «edité sobre lo que hay» de
 * «edité sobre otra cosa», que es la única pregunta que el candado
 * anti-pisada necesita contestar.
 *
 * [Ronda 1, hallazgo A] `dispositivo` sale de `sesion.dispositivo` —FIRMADO
 * al entrar (E3, `sesion.ts`)—, nunca del cuerpo del pedido. El cuerpo ya no
 * tiene ningún campo `dispositivo` que leer: antes lo tenía, y como
 * `idDeDispositivo(undefined)` devuelve `'sin-nombre'` sin fallar nunca, un
 * pedido que se olvidara de mandarlo (un bug de la fase 6, por ejemplo)
 * hacía que CUALQUIER aparato apareciera como `'sin-nombre'` — dos aparatos
 * distintos con el MISMO id, el candado anti-pisada de `guarda()` sin nada
 * que comparar, y la hermana pisando el borrador de la clienta en silencio:
 * exactamente el bug que esta tarea vino a arreglar, reintroducido por
 * confiar en un dato que el cliente puede omitir.
 */
async function borradorGuardarAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('borrador.guardar: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  const cuerpo = (pedido.cuerpo ?? {}) as CuerpoBorradorGuardar
  // La MISMA forma que exige `publicar` (ver `esShaDeCommit`): es el mismo
  // dato, y un borrador guardado contra un `base` que no es un sha no le
  // sirve a la publicación que viene después.
  if (!esShaDeCommit(cuerpo.base)) {
    return error(400, PROBLEMA_BORRADOR_INCOMPLETO)
  }
  const documentos = comoDocumentos(cuerpo.documentos)
  const pisar = cuerpo.pisar === true
  // Solo un número cuenta: cualquier otra cosa (ausente, `null`, una cadena)
  // es «no leí ningún borrador», que es la rama conservadora de `guarda()`.
  const horaLeida = typeof cuerpo.horaLeida === 'number' ? cuerpo.horaLeida : undefined

  const gh = clienteDeGitHub(contexto)

  try {
    const r = await guarda(gh, {
      documentos,
      base: cuerpo.base,
      dispositivo: sesion.dispositivo,
      autor: sesion.correo,
      ahora: contexto.ahora(),
      ...(horaLeida !== undefined ? { horaLeida } : {}),
      pisar,
      // [Ronda 1, hallazgo D] Antes esta acción nunca pasaba esto —a
      // diferencia de `publicarAccion`/`deshacerAccion`, que sí—, así que el
      // arranque y el guardado del borrador nunca podían chocar con el tope
      // de cuerpo real, aunque el pedido HTTP que los trajo sí lo hubiera
      // pasado.
      bytesDelCuerpo: contexto.bytesDelCuerpo,
    })

    if (r.ok) return ok({ ok: true })

    if (r.motivo === 'hay-uno-mas-nuevo') {
      return {
        status: 409,
        cuerpo: { ok: false, motivo: 'hay-uno-mas-nuevo', otro: r.otro, problema: PROBLEMA_BORRADOR_MAS_NUEVO },
      }
    }

    console.error(`borrador.guardar: no se pudo guardar (autor: ${sesion.correo}) — ${r.problema}`)
    return error(502, PROBLEMA_NO_SE_PUDO_GUARDAR_BORRADOR)
  } catch (e) {
    console.error('borrador.guardar: reventó al guardar —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_GUARDAR_BORRADOR)
  }
}

/**
 * `borrador.leer`: el borrador del servidor tal cual está, sin comparar
 * nada contra lo que el aparato que pregunta tenga guardado localmente.
 * `leeBorrador()` (`borrador.ts`) ya devuelve `null` cuando no hay
 * ninguno —el estado normal de un panel recién estrenado, o de cualquier
 * sesión antes del primer guardado—, así que esta acción tampoco distingue
 * «no hay borrador» de un error: lo único que puede fallar acá es que
 * GitHub no conteste, y eso sí es un 502.
 *
 * No resuelve ningún conflicto entre dos aparatos: la pantalla que decide
 * qué preguntarle a ella («celular, ayer 11:04, 3 cambios» / «esta compu,
 * hace 6 días, 1 cambio», spec §4.3) es de la fase 6 — acá solo se lee el
 * servidor y se le entrega tal cual.
 *
 * Sin `revisaLaCabeza()`, mismo motivo que `borradorGuardarAccion`: no hay
 * ningún commit de `main` que leer un borrador pueda dejar roto.
 */
async function borradorLeerAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('borrador.leer: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  const gh = clienteDeGitHub(contexto)

  try {
    const borrador = await leeBorrador(gh)
    return ok({ ok: true, borrador })
  } catch (e) {
    console.error('borrador.leer: no se pudo leer el borrador —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER_BORRADOR)
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
      case 'enlace':
        return await enlaceAccion(pedido, contexto)
      case 'entrar-con-enlace':
        return await entrarConEnlaceAccion(pedido, contexto)
      case 'publicar':
        return await publicarAccion(pedido, contexto)
      case 'salud':
        return await salud(pedido, contexto)
      case 'estado':
        return await estadoAccion(pedido, contexto)
      case 'deshacer':
        return await deshacerAccion(pedido, contexto)
      case 'historial':
        return await historialAccion(pedido, contexto)
      case 'borrador.guardar':
        return await borradorGuardarAccion(pedido, contexto)
      case 'borrador.leer':
        return await borradorLeerAccion(pedido, contexto)
      default:
        return error(404, PROBLEMA_ACCION_INEXISTENTE)
    }
  } catch (e) {
    console.error(`acciones: la acción «${accion}» reventó sin que nada la esperara —`, e)
    return error(500, PROBLEMA_INESPERADO)
  }
}
