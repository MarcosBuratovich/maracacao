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
import { validar, type Problema } from '../contenido/validacion'
import { serializa } from '../contenido/carga'
import { conteosDe } from '../contenido/conteos'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'
import datosSitio from '../contenido/datos/sitio.json'
import datosSabores from '../contenido/datos/sabores.json'
import datosFichas from '../contenido/datos/fichas.json'

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

// Un solo texto para las tres formas de fallar (freno de intentos, correo
// fuera de la lista, contraseña incorrecta): a quien intenta entrar sin
// permiso no se le dice CUÁL de las tres fue. Nunca menciona «correo»,
// «usuario» ni «existe» — un test lo vigila letra por letra.
const PROBLEMA_ENTRAR = 'No se pudo entrar: revisa tus datos y vuelve a intentar.'

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

interface CuerpoEntrar {
  correo?: unknown
  clave?: unknown
  /** Si la clienta marcó «recordar este aparato» en el formulario. */
  recuerdame?: unknown
  /** Un identificador de aparato que arma el navegador; solo para el registro de la sesión. */
  dispositivo?: unknown
}

/**
 * `entrar`: contraseña → cookie (E2, E3).
 *
 * El orden es el que pide el spec, y es un Y de tres condiciones que se
 * evalúan de izquierda a derecha —cada una corta la siguiente si falla,
 * así el `scrypt` caro de `claveCorrecta` ni se corre cuando ya se sabe
 * que no va a entrar—: primero el freno de intentos por IP (E4, que
 * cuenta el intento ya esté permitido o no), después que el correo esté
 * en la lista, y recién al final la contraseña. Cualquiera de las tres
 * que falle termina en el MISMO 401.
 */
function entrar(pedido: Pedido, contexto: Contexto): Respuesta {
  const cuerpo = (pedido.cuerpo ?? {}) as CuerpoEntrar
  const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim() : ''
  const clave = typeof cuerpo.clave === 'string' ? cuerpo.clave : ''

  const permitido = intentoPermitido(contexto.ip, contexto.ahora())
  const correoOk = permitido && correoEnLista(correo, contexto.env.PANEL_CORREOS)
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

/** El dato tal cual está publicado HOY, uno por documento. Ver el porqué en el docstring de `publicarAccion`. */
const ACTUAL: Readonly<Record<IdDocumento, unknown>> = {
  sitio: datosSitio,
  sabores: datosSabores,
  fichas: datosFichas,
}

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
 * Por qué el dato ACTUAL sale de los JSON crudos bajo `src/contenido/datos/`
 * y no de las fachadas (`@/copy/sitio-marca`, `@/copy/sabores`,
 * `@/fichas/base`): las fachadas corren `cargar()` al importarse, que TIRA
 * si el contenido no pasa el esquema —`sitio-marca.ts` además necesita
 * `injerta()` con los cinco valores derivados, que sin `sabores`/`gotas`
 * ni siquiera se puede calcular—. Si `entrar` o `salud` importaran ese
 * camino sin querer (comparten el mismo bundle), un contenido roto
 * tumbaría TODO el panel, incluida la acción que existe para avisar que
 * algo está roto. El JSON crudo, en cambio, solo puede fallar por no ser
 * JSON válido —algo que `astro build` ya garantiza en cada deploy—. Y no
 * hace falta más: `resume()` salta los campos derivados (`seEdita()` los
 * filtra por `control: 'derivado'`), así que el valor de esos cinco
 * campos en el `antes` nunca se compara; y `conteosDe()` lee listas
 * (`sabores`, `gotas`, `polvo`, `recetas`…) que están en el JSON crudo tal
 * cual, sin que la inyección de derivados las toque.
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

  // Los conteos cruzan textos («15 sabores») contra listas reales, y esas
  // listas pueden vivir en un documento DISTINTO del que se está validando
  // (`anaquel.kicker`, del sitio, cuenta la lista de `sabores.json`). Si
  // ese otro documento viene en el mismo lote, se usa la versión que la
  // clienta está por publicar —no la vieja—; si no vino, se usa la
  // publicada hoy.
  const conteos = conteosDe({
    sitio: idsConocidos.includes('sitio') ? documentos.sitio : ACTUAL.sitio,
    sabores: idsConocidos.includes('sabores') ? documentos.sabores : ACTUAL.sabores,
  })

  const archivos: Archivo[] = []
  const cambios: Cambio[] = []

  for (const id of idsConocidos) {
    const esquema = DOCUMENTOS[id]
    const crudo = documentos[id]

    // El esquema COMPLETO, no solo los campos que cambiaron: la
    // revalidación del servidor es la única capa que un pedido armado a
    // mano no puede saltear.
    const problemas: Problema[] = validar(esquema, crudo, conteos)
    const bloqueante = problemas.find((p) => p.gravedad === 'impide')
    if (bloqueante) {
      return error(422, bloqueante.titulo, `${id}.${bloqueante.campo}`)
    }

    archivos.push({ ruta: RUTA_DEL_DOCUMENTO(id), contenido: serializa(esquema, crudo) })
    cambios.push(...resume(ACTUAL[id], crudo, esquema))
  }

  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  const resultado = await publica(gh, { archivos, autor: sesion.correo, cambios })
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
