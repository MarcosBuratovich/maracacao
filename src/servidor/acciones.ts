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
import { claveCorrecta, firmaSesion, verificaSesion, cookieDeSesion, intentoPermitido } from './sesion'
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
 * Dos capas separadas, con dos respuestas distintas (RULING T6-a):
 *
 * 1. El freno de intentos por IP (E4) corre PRIMERO y aparte. Si ya se
 *    gastaron los cinco intentos de la ventana, 429 — y ni siquiera se
 *    mira si el correo está en la lista o si la contraseña de ESTE
 *    pedido era la correcta: así un atacante frenado no le hace correr
 *    el `scrypt` caro de `claveCorrecta` al servidor en cada intento.
 * 2. Recién con el freno pasado, un Y de dos condiciones —el correo está
 *    en la lista, y la contraseña es correcta— que corta apenas falla
 *    una (si el correo no está, `claveCorrecta` ni se llama). Cualquiera
 *    de las dos que falle da el MISMO 401 con el MISMO texto: quien
 *    pregunta no se entera cuál de las dos fue.
 */
function entrar(pedido: Pedido, contexto: Contexto): Respuesta {
  const cuerpo = (pedido.cuerpo ?? {}) as CuerpoEntrar
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : ''
  const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : ''

  if (!intentoPermitido(contexto.ip, contexto.ahora())) {
    return error(429, PROBLEMA_DEMASIADOS_INTENTOS)
  }

  const correoOk = correoEnLista(correo, contexto.env.PANEL_CORREOS)
  const claveOk = correoOk && claveCorrecta(clave, contexto.env.PANEL_CLAVE_HASH ?? '')

  if (!claveOk) return error(401, PROBLEMA_ENTRAR)

  const dias = cuerpo.recuerdame === true ? DIAS_SESION_LARGA : DIAS_SESION_CORTA
  const dispositivo = typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo : 'sin identificar'
  const vence = contexto.ahora() + dias * 86_400_000

  const token = firmaSesion({ correo, vence, dispositivo }, contexto.env.PANEL_SECRETO ?? '')
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
 */
async function publicarAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const sesion = verificaSesion(pedido.cookie, contexto.env.PANEL_SECRETO ?? '', contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

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

/**
 * `salud`: ¿están las variables?, ¿responde GitHub? (E8).
 *
 * Sin sesión a propósito: es la acción que hay que poder llamar el día
 * que `PANEL_SECRETO` falta o vino mal —justo el día en que `verificaSesion`
 * no le firma una cookie válida a nadie—, así que no puede depender de
 * tener una. Lo único que expone son NOMBRES de variables ausentes y un
 * booleano de si GitHub contestó: nada que un atacante no aprenda ya con
 * un `curl` a la página pública (que el panel existe, en qué dominio).
 */
async function salud(_pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const faltan = VARIABLES_REQUERIDAS.filter((v) => !contexto.env[v])

  if (faltan.length > 0) {
    return { status: 503, cuerpo: { ok: false, faltan, github: null } }
  }

  // Las seis están: falta ver si GitHub de verdad contesta con ellas.
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
const PROBLEMA_INESPERADO = 'Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.'

/**
 * El punto de entrada único del panel. Atrapa cualquier excepción que se
 * escape de las tres acciones —un `throw` de `conteosDe()` por un dato mal
 * formado, por ejemplo— y la convierte en un 500 sin jerga para la
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
