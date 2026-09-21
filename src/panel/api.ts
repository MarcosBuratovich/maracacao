/*
 * El cliente de las ocho acciones de `/api/panel` (Tarea 1, fase 6). UN
 * SOLO módulo: el servidor entero de esas ocho acciones vive en
 * `src/servidor/acciones.ts` (route único, la acción viaja en la query
 * string — `POST /api/panel?accion=entrar`, etc.); acá adentro no hay
 * ninguna decisión de negocio, solo la forma del pedido y de la respuesta.
 *
 * Mismo criterio que `src/servidor/correo.ts` — léelo, es el precedente
 * exacto que esta tarea pide seguir—: NINGUNA función de acá tira. Un 5xx,
 * un cuerpo que no parsea como JSON, o la red caída son, los tres, un
 * RESULTADO (`{ ok: false, status, problema }`), nunca una excepción que
 * se escape hacia el componente que llama. La única puerta a `fetch` es
 * `llama()`, más abajo, con su propio `try/catch`.
 *
 * La sesión es la cookie `HttpOnly` que el servidor ya emite al entrar
 * (`cookieDeSesion`, `sesion.ts`): `credentials: 'same-origin'` alcanza
 * para mandarla en cada pedido, y el código de acá NUNCA la lee ni la
 * guarda — no podría, es `HttpOnly`, el navegador se la esconde a
 * cualquier `document.cookie`.
 *
 * Los textos que la clienta lee (`problema`, `frase`, `mensaje`) los
 * escribe el SERVIDOR, en español mexicano — hay tests ahí (`jergaEn()`,
 * `src/servidor/estado.ts`) que los vigilan letra por letra. Acá adentro
 * se muestran TAL CUAL, nunca reescritos. Las dos únicas frases propias de
 * este archivo (`PROBLEMA_SIN_RED`, `PROBLEMA_RESPUESTA_INESPERADA`) son
 * para cuando el servidor nunca llegó a contestar nada — ahí no hay ningún
 * texto suyo que mostrar, y `/panel/entrar.astro` ya sienta el mismo
 * precedente para el primer caso («No se pudo conectar. Intenta de
 * nuevo.»).
 */

const URL_BASE = '/api/panel'

/** Cuando la red se cae antes de que el servidor conteste nada en absoluto. */
const PROBLEMA_SIN_RED = 'No se pudo conectar. Intenta de nuevo.'

/** Cuando el servidor sí contestó, pero el cuerpo no es JSON legible o le falta lo mínimo para confiar en él. */
const PROBLEMA_RESPUESTA_INESPERADA = 'Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.'

/** Cualquier fracaso de cualquiera de las ocho acciones — la forma común. */
export interface Falla {
  ok: false
  /** El status HTTP, o `0` cuando ni siquiera hubo respuesta (red caída). */
  status: number
  /** Tal cual lo escribió el servidor — o una de las dos frases de arriba, cuando el servidor no llegó a escribir nada. */
  problema: string
  /** Solo en `publicar`, cuando el problema señala un campo puntual. */
  campo?: string
}

function comoTexto(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function comoNumero(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

/** Arma una `Falla` a partir de lo que mandó el servidor — o la frase propia, si no vino nada usable. */
function falla(status: number, cuerpo: unknown): Falla {
  const c = (cuerpo ?? {}) as { problema?: unknown; campo?: unknown }
  const problema = comoTexto(c.problema) ?? PROBLEMA_RESPUESTA_INESPERADA
  const campo = comoTexto(c.campo)
  return campo === undefined ? { ok: false, status, problema } : { ok: false, status, problema, campo }
}

type Crudo =
  | { tipo: 'red-caida' }
  | { tipo: 'cuerpo-ilegible'; status: number }
  | { tipo: 'ok'; status: number; cuerpo: unknown }

/**
 * El único punto que toca `fetch` de verdad. Nunca tira: toda forma de
 * fallar —la red caída, un cuerpo que no parsea— vuelve en el tipo de
 * retorno, nunca como una excepción.
 */
async function llama(accion: string, cuerpoPedido: unknown): Promise<Crudo> {
  let r: Response
  try {
    r = await fetch(`${URL_BASE}?accion=${accion}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoPedido ?? {}),
    })
  } catch {
    return { tipo: 'red-caida' }
  }
  try {
    const json: unknown = await r.json()
    return { tipo: 'ok', status: r.status, cuerpo: json }
  } catch {
    return { tipo: 'cuerpo-ilegible', status: r.status }
  }
}

/**
 * El patrón que comparten las ocho acciones: pedir, y traducir lo crudo a
 * un resultado tipado. `comoExito` arma la forma de éxito a partir del
 * cuerpo ya parseado (solo se llama con un 2xx) — devuelve `null` si a ese
 * cuerpo le falta lo mínimo para confiar en él, y eso cae en
 * `PROBLEMA_RESPUESTA_INESPERADA`, nunca en un campo inventado con un
 * valor que no vino.
 */
async function pide<T extends object>(
  accion: string,
  cuerpoPedido: unknown,
  comoExito: (crudo: unknown) => T | null,
): Promise<({ ok: true } & T) | Falla> {
  const r = await llama(accion, cuerpoPedido)
  if (r.tipo === 'red-caida') return { ok: false, status: 0, problema: PROBLEMA_SIN_RED }
  if (r.tipo === 'cuerpo-ilegible') return { ok: false, status: r.status, problema: PROBLEMA_RESPUESTA_INESPERADA }
  if (r.status < 200 || r.status >= 300) return falla(r.status, r.cuerpo)
  const exito = comoExito(r.cuerpo)
  if (exito === null) return { ok: false, status: r.status, problema: PROBLEMA_RESPUESTA_INESPERADA }
  return { ok: true, ...exito }
}

/*
 * ---------------------------------------------------------------------
 * entrar
 * ---------------------------------------------------------------------
 */

export type ResultadoEntrar = { ok: true } | Falla

export interface CuerpoEntrar {
  correo: string
  clave: string
  /** «Recordar este aparato» — treinta días si es `false`, un año si es `true` (E3, `acciones.ts`). */
  recuerdame?: boolean
  /** El id de este navegador (ver `src/panel/aparato.ts`). */
  dispositivo?: string
}

export function entrar(cuerpo: CuerpoEntrar): Promise<ResultadoEntrar> {
  return pide('entrar', cuerpo, () => ({}))
}

/*
 * ---------------------------------------------------------------------
 * enlace — el «no me acuerdo»
 * ---------------------------------------------------------------------
 */

export type ResultadoEnlace = { ok: true; mensaje: string } | Falla

export function enlace(cuerpo: { correo: string }): Promise<ResultadoEnlace> {
  return pide('enlace', cuerpo, (crudo) => {
    const mensaje = comoTexto((crudo as { mensaje?: unknown } | null)?.mensaje)
    return mensaje === undefined ? null : { mensaje }
  })
}

/*
 * ---------------------------------------------------------------------
 * publicar
 * ---------------------------------------------------------------------
 */

/** Un aviso de conteo que sobrevivió a la publicación — no bloquea nada, se muestra aparte. */
export interface AvisoPublicado {
  campo: string
  titulo: string
  detalle?: string
}

export type ResultadoPublicar = { ok: true; sha: string | null; resumen: string; avisos: AvisoPublicado[] } | Falla

function comoAvisos(v: unknown): AvisoPublicado[] {
  if (!Array.isArray(v)) return []
  const avisos: AvisoPublicado[] = []
  for (const item of v) {
    if (item === null || typeof item !== 'object') continue
    const a = item as { campo?: unknown; titulo?: unknown; detalle?: unknown }
    const campo = comoTexto(a.campo)
    const titulo = comoTexto(a.titulo)
    if (campo === undefined || titulo === undefined) continue
    const detalle = comoTexto(a.detalle)
    avisos.push(detalle === undefined ? { campo, titulo } : { campo, titulo, detalle })
  }
  return avisos
}

export function publicar(cuerpo: { documentos: Record<string, unknown>; base: string }): Promise<ResultadoPublicar> {
  return pide('publicar', cuerpo, (crudo) => {
    const c = (crudo ?? {}) as { sha?: unknown; resumen?: unknown; avisos?: unknown }
    const resumen = comoTexto(c.resumen)
    if (resumen === undefined) return null
    const sha = typeof c.sha === 'string' ? c.sha : null
    return { sha, resumen, avisos: comoAvisos(c.avisos) }
  })
}

/*
 * ---------------------------------------------------------------------
 * estado — el sondeo de «¿ya está en el sitio?»
 * ---------------------------------------------------------------------
 */

export type EstadoDespliegue = 'enCurso' | 'listo' | 'falló'

export type ResultadoEstado =
  | { ok: true; estado: EstadoDespliegue; frase: string; reintentarEn: number | null; url: string | null }
  | Falla

function comoEstadoDespliegue(v: unknown): EstadoDespliegue | undefined {
  return v === 'enCurso' || v === 'listo' || v === 'falló' ? v : undefined
}

export function estado(cuerpo: { sha: string; publicadoEn?: number }): Promise<ResultadoEstado> {
  return pide('estado', cuerpo, (crudo) => {
    const c = (crudo ?? {}) as { estado?: unknown; frase?: unknown; reintentarEn?: unknown; url?: unknown }
    const despliegue = comoEstadoDespliegue(c.estado)
    const frase = comoTexto(c.frase)
    if (despliegue === undefined || frase === undefined) return null
    const reintentarEn = comoNumero(c.reintentarEn) ?? null
    const url = typeof c.url === 'string' ? c.url : null
    return { estado: despliegue, frase, reintentarEn, url }
  })
}

/*
 * ---------------------------------------------------------------------
 * deshacer
 * ---------------------------------------------------------------------
 */

export type ResultadoDeshacer = { ok: true; sha: string | null; resumen: string } | Falla

export function deshacer(cuerpo: { sha: string }): Promise<ResultadoDeshacer> {
  return pide('deshacer', cuerpo, (crudo) => {
    const c = (crudo ?? {}) as { sha?: unknown; resumen?: unknown }
    const resumen = comoTexto(c.resumen)
    if (resumen === undefined) return null
    const sha = typeof c.sha === 'string' ? c.sha : null
    return { sha, resumen }
  })
}

/*
 * ---------------------------------------------------------------------
 * historial — también la fuente del `base` que exige `publicar`
 * ---------------------------------------------------------------------
 */

/** Un commit del panel, ya leído en las palabras de la clienta (`Publicada`, `src/servidor/historial.ts`). */
export interface Publicada {
  sha: string
  resumen: string
  autor: string | null
  cuando: string
  revierteA: string | null
}

export type ResultadoHistorial = { ok: true; base: string | null; publicaciones: Publicada[] } | Falla

function comoPublicaciones(v: unknown): Publicada[] {
  if (!Array.isArray(v)) return []
  const lista: Publicada[] = []
  for (const item of v) {
    if (item === null || typeof item !== 'object') continue
    const p = item as { sha?: unknown; resumen?: unknown; autor?: unknown; cuando?: unknown; revierteA?: unknown }
    const sha = comoTexto(p.sha)
    const resumen = comoTexto(p.resumen)
    const cuando = comoTexto(p.cuando)
    if (sha === undefined || resumen === undefined || cuando === undefined) continue
    lista.push({
      sha,
      resumen,
      cuando,
      autor: typeof p.autor === 'string' ? p.autor : null,
      revierteA: typeof p.revierteA === 'string' ? p.revierteA : null,
    })
  }
  return lista
}

export function historial(): Promise<ResultadoHistorial> {
  return pide('historial', {}, (crudo) => {
    const c = (crudo ?? {}) as { base?: unknown; publicaciones?: unknown }
    const base = typeof c.base === 'string' ? c.base : null
    return { base, publicaciones: comoPublicaciones(c.publicaciones) }
  })
}

/*
 * ---------------------------------------------------------------------
 * borrador.guardar
 * ---------------------------------------------------------------------
 */

/** El borrador que YA estaba ahí, y que este guardado no pisó (motivo `hay-uno-mas-nuevo`). */
export interface OtroBorrador {
  dispositivo: string
  hora: number
}

export type ResultadoBorradorGuardar =
  | { ok: true }
  | Falla
  | { ok: false; status: number; problema: string; motivo: 'hay-uno-mas-nuevo'; otro: OtroBorrador }

export interface CuerpoBorradorGuardar {
  documentos: Record<string, unknown>
  base: string
  /** La `hora` del borrador que este aparato leyó, o ausente si no leyó ninguno (I1, `borrador.ts`). */
  horaLeida?: number
  /** Pisar el borrador de otro aparato aunque sea más nuevo. */
  pisar?: boolean
}

// Distinta del resto: el 409 de «hay-uno-mas-nuevo» trae, además de
// `problema`, un `motivo` y un `otro` que ninguna otra acción tiene — no
// entra en el molde de `falla()`/`pide()`, así que se arma a mano.
export async function borradorGuardar(cuerpo: CuerpoBorradorGuardar): Promise<ResultadoBorradorGuardar> {
  const r = await llama('borrador.guardar', cuerpo)
  if (r.tipo === 'red-caida') return { ok: false, status: 0, problema: PROBLEMA_SIN_RED }
  if (r.tipo === 'cuerpo-ilegible') return { ok: false, status: r.status, problema: PROBLEMA_RESPUESTA_INESPERADA }
  if (r.status >= 200 && r.status < 300) return { ok: true }

  const c = (r.cuerpo ?? {}) as { problema?: unknown; motivo?: unknown; otro?: unknown }
  const problema = comoTexto(c.problema) ?? PROBLEMA_RESPUESTA_INESPERADA
  if (c.motivo === 'hay-uno-mas-nuevo') {
    const o = (c.otro ?? {}) as { dispositivo?: unknown; hora?: unknown }
    const dispositivo = comoTexto(o.dispositivo)
    const hora = comoNumero(o.hora)
    if (dispositivo !== undefined && hora !== undefined) {
      return { ok: false, status: r.status, problema, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo, hora } }
    }
  }
  return { ok: false, status: r.status, problema }
}

/*
 * ---------------------------------------------------------------------
 * borrador.leer
 * ---------------------------------------------------------------------
 */

export interface Borrador {
  documentos: Record<string, unknown>
  base: string
  dispositivo: string
  autor: string
  hora: number
}

export type ResultadoBorradorLeer = { ok: true; borrador: Borrador | null } | Falla

function comoBorrador(v: unknown): Borrador | null {
  if (v === null || typeof v !== 'object') return null
  const b = v as { documentos?: unknown; base?: unknown; dispositivo?: unknown; autor?: unknown; hora?: unknown }
  const base = comoTexto(b.base)
  const dispositivo = comoTexto(b.dispositivo)
  const autor = comoTexto(b.autor)
  const hora = comoNumero(b.hora)
  if (base === undefined || dispositivo === undefined || autor === undefined || hora === undefined) return null
  const documentos =
    b.documentos !== null && typeof b.documentos === 'object' && !Array.isArray(b.documentos)
      ? (b.documentos as Record<string, unknown>)
      : {}
  return { documentos, base, dispositivo, autor, hora }
}

export function borradorLeer(): Promise<ResultadoBorradorLeer> {
  return pide('borrador.leer', {}, (crudo) => {
    const c = (crudo ?? {}) as { borrador?: unknown }
    return { borrador: comoBorrador(c.borrador) }
  })
}
