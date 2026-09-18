/*
 * «¿Ya está en el sitio?».
 *
 * [Inversión de precedencia, medida en producción] Antes esto eran DOS
 * preguntas que las dos tenían que dar que sí (spec §4.5, decisión B2).
 * Dejó de serlo: `version.json` —servido por el CDN mismo, sin caché— es
 * un HECHO observable, no un reporte sobre el hecho. Si dice que el CDN ya
 * entrega el sha publicado, eso ES que el cambio está en el sitio, y
 * ninguna otra fuente hace falta para confirmarlo.
 *
 * La plataforma sigue haciendo falta, pero para la otra pregunta: cuando
 * el CDN TODAVÍA no sirve el sha publicado, distinguir «el despliegue
 * falló» de «todavía está yendo» — algo que `version.json` no puede
 * contestar, porque en los dos casos sigue mostrando lo viejo.
 *
 * Medido en producción, el día de este arreglo: el despliegue había
 * terminado bien, el CDN ya servía el sha nuevo, y la plataforma —por una
 * razón ajena a este archivo, todavía en diagnóstico— contestaba que no
 * encontraba el despliegue. Con el orden viejo, eso eran 31 sondeos
 * seguidos de «en curso» con el cambio YA publicado: la fuente barata y
 * confiable esperando detrás de la que podía fallar.
 *
 * Sin red a propósito: recibe las dos respuestas ya leídas. Así todas las
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
 * [B10] Las frases. Viven acá, juntas, para que se lean una al lado de la
 * otra: son lo único de este módulo que la clienta ve, y un test exige que
 * ninguna nombre una tecnología. Las del FRACASO son cuatro y salen de
 * `fraseDeFracaso()`, más abajo — dejaron de ser una sola el día que se midió
 * que prometía dos cosas que otro archivo puede no haber cumplido.
 */
const FRASE_LISTO = 'Tu cambio ya está en el sitio.'
const FRASE_EN_CURSO = 'Estamos subiendo tu cambio al sitio.'
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

/**
 * ¿Esta frase le habla a la clienta con jerga? Devuelve la palabra de
 * `JERGA_PROHIBIDA` que encontró, o `null` si la frase está limpia.
 *
 * [Tarea 9, Ronda 1] Por LÍMITES DE PALABRA y no por substring crudo (que es
 * como comparaban a mano los tres lugares que usaban esta lista antes de
 * esta función), porque `'sha'` —la única entrada de tres letras— vive
 * adentro de «deshacer» y de «deshabilitar», que son exactamente el
 * vocabulario de un panel de publicación (el botón de la Tarea 9 SE LLAMA
 * «Deshacer»). Un guardián que rechaza la palabra del botón principal no se
 * corrige: se afloja, y a la tercera vez que alguien lo pelea, deja de
 * proteger — que es peor que no tenerlo, porque nadie se entera de que dejó
 * de proteger.
 *
 * Se normalizan los acentos antes de comparar (NFD, sin las marcas
 * diacríticas) para que «commit» no se cuele escrito como «cómmit».
 */
export function jergaEn(frase: string): string | null {
  const normalizada = frase.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const jerga of JERGA_PROHIBIDA) {
    if (new RegExp(`\\b${jerga}\\b`, 'i').test(normalizada)) return jerga
  }
  return null
}

/**
 * Qué pasó de verdad cuando el despliegue falló: si el sitio quedó como
 * estaba, y si Marcos se enteró.
 *
 * [Revisión final de la rama, I4] Existe porque la frase del fracaso decía
 * «lo dejé como estaba **y ya le avisé a Marcos**» SIEMPRE, y las dos mitades
 * pueden ser falsas. El comentario que había acá mismo ya lo anticipaba —«es
 * una promesa que este archivo hace y otro paga»—: el pago está
 * CONDICIONADO, así que la promesa también tiene que estarlo.
 *
 * El escenario medido de la mitad del correo: las variables de correo
 * todavía no están cargadas (es un trámite de DNS), `mandaProtegido()`
 * degrada por diseño —loguea y sigue—, ella lee que Marcos ya sabe, Marcos
 * no sabe nada, y los dos esperan al otro.
 */
export interface Fracaso {
  /** ¿La reversión automática dejó el sitio como estaba? */
  revertido: boolean
  /** ¿Se le pudo mandar el aviso a Marcos? */
  avisadoAMarcos: boolean
}

/**
 * [B10 · I4] Las cuatro frases del fracaso, juntas, para que se lean una al
 * lado de la otra: son las únicas de este módulo que prometen algo sobre
 * lo que hizo OTRO archivo, y ninguna puede prometer más de lo que pasó.
 *
 * `undefined` —nadie intentó revertir ni avisar todavía— cae en la más
 * conservadora: no afirma que el sitio quedó como estaba ni que Marcos sabe.
 * Hoy `estadoAccion` siempre pasa el resultado; la rama existe para que el
 * día que alguien llame a `decide()` sin él, lo que salga sea verdad igual.
 */
export function fraseDeFracaso(f?: Fracaso): string {
  if (f === undefined) return 'No salió. Avísale a Marcos para que lo revise.'
  if (f.revertido && f.avisadoAMarcos) return 'No salió; lo dejé como estaba y ya le avisé a Marcos.'
  if (f.revertido) return 'No salió; lo dejé como estaba. Avísale a Marcos para que lo revise.'
  if (f.avisadoAMarcos) return 'No salió y no pude dejarlo como estaba. Ya le avisé a Marcos.'
  return 'No salió y no pude dejarlo como estaba. Avísale a Marcos para que lo revise.'
}

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
  /**
   * El sha que `version.json` dice que el CDN está sirviendo, o `null` si
   * esa lectura falló o no se hizo. Si coincide con `shaPublicado`, ALCANZA
   * para «listo» por sí solo — ver el comentario dentro de `decide()`.
   */
  shaServido: string | null
  /** El sha que ella publicó. */
  shaPublicado: string
  /** Cuánto hace que se publicó. */
  desdeHaceMs: number
  /**
   * [I4] Qué pasó con la reversión y el aviso, cuando el despliegue falló.
   * Quien llama tiene que haberlos INTENTADO antes de pedir el veredicto —
   * si no, la frase no puede decir la verdad sobre ellos (ver
   * `fraseDeFracaso`).
   */
  fracaso?: Fracaso
}): Veredicto {
  // [Inversión de precedencia] Esta rama va PRIMERO, antes de mirar
  // `despliegue` — a propósito, y por esto: el CDN es el hecho observable
  // (lo que de verdad se le está sirviendo a cualquiera que abra el
  // sitio); `despliegue` es un REPORTE de la plataforma sobre ese hecho, un
  // paso más lejos de la verdad, y puede estar mal (es exactamente lo que
  // se midió en producción: la plataforma decía que no encontraba un
  // despliegue que el CDN ya estaba sirviendo). Cuando las dos fuentes se
  // contradicen — acá incluido el caso `despliegue === 'falló'` con el sha
  // nuevo ya servido, una combinación rara pero posible—, gana la que se
  // puede observar, no la que informa sobre ella.
  //
  // `shaServido` puede ser `null` (version.json no contestó, o se está
  // construyendo fuera de la plataforma); ahí no coincide con nada, que es
  // lo correcto — una fuente caída no se vuelve un «sí» por omisión.
  if (e.shaServido === e.shaPublicado) {
    return { estado: 'listo', frase: FRASE_LISTO, reintentarEn: null, url: e.url }
  }

  // Acá abajo, el CDN TODAVÍA no confirma el sha publicado (o no contestó).
  // Eso es exactamente lo que se ve tanto si el despliegue falló como si
  // sigue yendo — `version.json` no puede distinguir los dos casos, porque
  // en los dos sigue mostrando lo viejo. Para esa distinción sí hace falta
  // la plataforma.
  if (e.despliegue === 'falló') {
    return { estado: 'falló', frase: fraseDeFracaso(e.fracaso), reintentarEn: null, url: e.url }
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
