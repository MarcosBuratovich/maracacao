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
import { claveCorrecta, hashDeClave, firmaSesion, verificaSesion, cookieDeSesion, intentoPermitido, LARGO_MIN_SECRETO } from './sesion'
import { cliente } from './github'
import { publica, type Archivo } from './publicar'
import type { Cambio } from '../contenido/diff'
import { resume } from '../contenido/diff'
import { validarContra, type Problema } from '../contenido/validacion'
import { serializa } from '../contenido/carga'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'

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
}

/** Todo lo que `maneja()` necesita del mundo exterior, inyectado. */
export interface Contexto {
  env: Entorno
  fetch: typeof globalThis.fetch
  /** El reloj. Nunca `Date.now()` llamado directo acá adentro: así un test lo puede fijar. */
  ahora: () => number
  /** La IP de quien pide, para el freno de intentos de `entrar` (E4). */
  ip: string
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
  const dispositivo = typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo : 'sin identificar'
  const vence = contexto.ahora() + dias * 86_400_000

  const token = firmaSesion({ correo, vence, dispositivo }, env.PANEL_SECRETO)
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

const RUTA_DEL_DOCUMENTO = (id: IdDocumento): string => `src/contenido/datos/${id}.json`

const esIdDocumento = (v: string): v is IdDocumento => Object.prototype.hasOwnProperty.call(DOCUMENTOS, v)

/** Un objeto llano, no `null` ni una lista — la forma mínima que `documentos` tiene que tener. */
function comoDocumentos(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
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
 * La validación de esquema (`validarContra`, no `validar`) corre ANTES de
 * tocar GitHub y no necesita conteos: los avisos de conteo
 * (`gravedad: 'avisa'`) nunca bloquean una publicación —son la misma
 * comodidad que el navegador ya le mostró antes de que ella apretara
 * publicar—, así que no hace falta leer un documento que no se va a
 * escribir solo para calcularlos. Si algún día un aviso tiene que
 * bloquear o mostrarse en la respuesta, ESE es el momento de traer los
 * conteos de vuelta, con el caso real delante.
 *
 * [C-1] Antes de mirar la cookie siquiera: si `PANEL_SECRETO` falta o es
 * demasiado corto, 503 —nunca el 401 de sesión inválida, que le haría
 * creer a la clienta que tiene que volver a entrar cuando el problema es
 * nuestro— y el log nombra la variable.
 *
 * [I-4] La cookie firmada solo prueba que ALGUNA VEZ el correo estuvo en
 * `PANEL_CORREOS` —dura hasta un año (E3)—, no que sigue estando HOY:
 * `PANEL_CORREOS` se vuelve a leer acá, después de que `verificaSesion`
 * confirma la firma, y si esa dirección ya no está en la lista de hoy, el
 * mismo 401 de sesión inválida. Sin este chequeo, sacarle el acceso a
 * alguien —la hermana, alguien que dejó de trabajar con la marca— no
 * revocaba nada hasta que su cookie venciera sola, o hasta rotar
 * `PANEL_SECRETO`, que de paso desloguea a todo el mundo.
 */
async function publicarAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('publicar: PANEL_SECRETO falta o mide menos de 32 caracteres — no se puede verificar ninguna sesión.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = verificaSesion(pedido.cookie, env.PANEL_SECRETO, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  // [I-4] Re-lee PANEL_CORREOS en cada publicación: una cookie firmada
  // hace un año, con un correo que YA NO está en la lista de hoy, no
  // puede seguir publicando solo porque la firma es válida.
  if (!correoEnLista(sesion.correo, env.PANEL_CORREOS)) return error(401, PROBLEMA_SESION)

  const cuerpo = (pedido.cuerpo ?? {}) as { documentos?: unknown }
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

  // Fase 1, sin tocar GitHub: el esquema COMPLETO de cada documento, no
  // solo los campos que cambiaron. Un solo documento inválido rechaza el
  // lote entero antes de gastar un solo pedido.
  for (const id of idsConocidos) {
    const problemas: Problema[] = validarContra(DOCUMENTOS[id], documentos[id])
    if (problemas.length > 0) {
      return error(422, problemas[0].titulo, `${id}.${problemas[0].campo}`)
    }
  }

  // Fase 2: recién acá se toca GitHub. Un solo sha base para todo el lote.
  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  const archivos: Archivo[] = []
  const cambios: Cambio[] = []

  try {
    const base = await gh.ref('heads/main')

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

// Las seis variables que el panel necesita para funcionar del todo. Por
// NOMBRE nunca por valor (E7): esta lista vive acá, no un valor leído de
// `contexto.env`, así que no hay forma de que un `console.log` apurado se
// escape y termine devolviendo un secreto.
const VARIABLES_REQUERIDAS = [
  'PANEL_CLAVE_HASH',
  'PANEL_SECRETO',
  'PANEL_CORREOS',
  'PANEL_GITHUB_TOKEN',
  'GITHUB_DUENIO',
  'GITHUB_REPO',
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

  // Las seis están: falta ver si GitHub de verdad contesta con ellas — y
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
      default:
        return error(404, PROBLEMA_ACCION_INEXISTENTE)
    }
  } catch (e) {
    console.error(`acciones: la acción «${accion}» reventó sin que nada la esperara —`, e)
    return error(500, PROBLEMA_INESPERADO)
  }
}
