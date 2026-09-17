/*
 * «¿Ya está en el sitio?».
 *
 * Son DOS preguntas y las dos tienen que dar que sí (spec §4.5, decisión B2):
 *   1. La plataforma dice que el despliegue TERMINÓ.
 *   2. `version.json` —servido por el CDN, sin caché— dice que el commit que
 *      está entregando es ESE.
 * Entre una y otra hay una ventana de segundos. Es corta, y es exactamente
 * cuando ella toca «Ver mi sitio» y ve el precio viejo.
 *
 * Sin red a propósito: recibe las dos respuestas ya leídas. Así las once
 * combinaciones se prueban en milisegundos, y la acción del router queda
 * siendo dos lecturas y una llamada.
 *
 * Puro e inyectable (regla de `src/servidor/**`): ni `process.env` ni `fetch`.
 * Ni siquiera el reloj — quien llama pasa `desdeHaceMs`.
 */
import type { EstadoDeDespliegue } from './vercel'

/** El sitio de verdad. De acá sale `version.json`, que es lo que el CDN sirve. */
export const SITIO = 'https://www.maracacao.mx'

/** Cada cuánto volver a preguntar, y hasta cuándo (spec §4.5). */
const CADENCIA_RAPIDA_MS = 3_000
const CADENCIA_LENTA_MS = 6_000
const CAMBIA_DE_CADENCIA_MS = 60_000
const DEJA_DE_PREGUNTAR_MS = 300_000

/**
 * [B10] Las cuatro frases. Viven acá, juntas, para que se lean una al lado de
 * la otra: son lo único de este módulo que la clienta ve, y un test exige que
 * ninguna nombre una tecnología.
 */
const FRASE_LISTO = 'Tu cambio ya está en el sitio.'
const FRASE_EN_CURSO = 'Estamos subiendo tu cambio al sitio.'
// Esta frase promete DOS cosas que este módulo no hace: que algo se dejó como
// estaba, y que se le avisó a Marcos. Las dos las cumple `revierteYAvisa()` en
// `acciones.ts` (Tarea 8), en la MISMA invocación que devuelve este veredicto
// —la que ve el fracaso revierte y manda los dos correos antes de contestar—.
// Si algún día esa reversión deja de correr ahí, esta frase pasa a ser mentira
// y hay que cambiarla: es una promesa que este archivo hace y otro paga.
const FRASE_FALLO = 'No salió; lo dejé como estaba y ya le avisé a Marcos.'
const FRASE_TARDA =
  'Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.'

/**
 * Las palabras que NUNCA pueden aparecer en algo que lea la clienta.
 *
 * Vive exportada y no suelta adentro de un test porque el guardián tiene que
 * poder correr sobre TODAS las frases que una acción puede devolver, no solo
 * sobre las que produce este archivo: `estadoAccion` también contesta con las
 * frases compartidas del router (sesión inválida, «algo salió mal», «no
 * pudimos revisar el contenido»), y esas las puede editar mañana alguien que
 * está tocando otra acción y no se acuerda de que esta también las usa.
 */
export const JERGA_PROHIBIDA = ['Vercel', 'deploy', 'commit', 'build', 'GitHub', 'CDN', 'sha'] as const

export interface Veredicto {
  estado: 'enCurso' | 'listo' | 'falló'
  frase: string
  /** Milisegundos hasta la próxima pregunta, o `null` para dejar de preguntar. */
  reintentarEn: number | null
  /** La dirección donde quedó el despliegue, cuando la hay. */
  url: string | null
}

export function decide(e: {
  despliegue: EstadoDeDespliegue
  url: string | null
  /** El sha que `version.json` dice que el CDN está sirviendo, o `null`. */
  shaServido: string | null
  /** El sha que ella publicó. */
  shaPublicado: string
  /** Cuánto hace que se publicó. */
  desdeHaceMs: number
}): Veredicto {
  if (e.despliegue === 'falló') {
    return { estado: 'falló', frase: FRASE_FALLO, reintentarEn: null, url: e.url }
  }

  // [B2] Las dos fuentes. `shaServido` puede ser `null` construyendo fuera de
  // la plataforma; ahí no coincide con nada, que es lo correcto.
  if (e.despliegue === 'listo' && e.shaServido === e.shaPublicado) {
    return { estado: 'listo', frase: FRASE_LISTO, reintentarEn: null, url: e.url }
  }

  // «NUNCA gira infinito» (spec §4.5). Y la frase no promete un aviso: si ella
  // cerró el panel, no hay nadie sondeando que pueda mandarlo.
  if (e.desdeHaceMs > DEJA_DE_PREGUNTAR_MS) {
    return { estado: 'enCurso', frase: FRASE_TARDA, reintentarEn: null, url: e.url }
  }

  return {
    estado: 'enCurso',
    frase: FRASE_EN_CURSO,
    reintentarEn: e.desdeHaceMs > CAMBIA_DE_CADENCIA_MS ? CADENCIA_LENTA_MS : CADENCIA_RAPIDA_MS,
    url: e.url,
  }
}
