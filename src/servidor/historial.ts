/*
 * El historial de publicaciones: qué se publicó, cuándo y quién (spec §4.6).
 *
 * No hay base de datos y no hace falta —git ya guarda las tres cosas—, y el
 * asunto de cada commit ES el resumen que la clienta vio antes de publicar
 * (`frase()`, en `../contenido/diff.ts`): así que este módulo no traduce
 * nada, solo lee lo que `github.ts` ya trajo, lo filtra y lo parte en sus
 * partes (asunto vs. trailers).
 *
 * Los trailers se leen con los MISMOS ayudantes que `revertir.ts` —anclados
 * por línea completa, no por substring—: escribir una detección propia acá
 * sería el mismo bug que ya se encontró una vez (un commit a mano que
 * MENCIONE «Panel: sí» en una oración no puede colarse como si fuera del
 * panel).
 *
 * Puro e inyectable (regla de `src/servidor/**`), incluido el reloj: `lee()`
 * recibe `ahora` por parámetro y no llama a `Date.now()`, aunque hoy no lo
 * necesite para nada —ninguno de los cinco campos de `Publicada` depende de
 * la hora actual—. Se acepta igual, sin usarlo, para no tener que volver
 * pura una función que dejó de serlo el día que el historial necesite algo
 * relativo a "ahora" (por ejemplo, para el badge de una publicación
 * revertible desde acá).
 */
import { TRAILER_PANEL, TRAILER_REVIERTE, tieneTrailer, valorDeTrailer, autorDelCommit } from './revertir'

/** Un commit del panel, ya leído en las palabras de la clienta. */
export interface Publicada {
  sha: string
  /** El asunto del commit: la primera línea, tal cual ella la vio antes de publicar. */
  resumen: string
  /** El correo de quien publicó, del trailer `Panel-Autor:` — o `null` si el commit no lo lleva. */
  autor: string | null
  /** La fecha del commit, tal cual la dio GitHub (ISO 8601). */
  cuando: string
  /** El sha al que este commit revirtió, si es una reversión — o `null` si no lo es. */
  revierteA: string | null
}

/**
 * Filtra y traduce los commits de `gh.listaCommits()` a lo que la clienta va
 * a leer.
 *
 * Filtra por `Panel: sí`: lo que publicó Marcos a mano (una plantilla, un
 * fix del sitio) no es SU historial, y mezclarlo la confundiría justo en el
 * momento en que está tratando de entender qué pasó con su sitio.
 *
 * No reordena nada: `gh.listaCommits()` ya los da del más nuevo al más
 * viejo (así los devuelve la API de Commits de GitHub), y ese es el orden
 * en el que ella los quiere ver.
 *
 * Una reversión se ve COMO TAL —`revierteA` no es `null`— y no como un
 * cambio suelto más: sin esto, «cambia Línea de cierre» y su deshacer
 * aparecerían como dos cambios distintos del mismo campo.
 */
export function lee(commits: Array<{ sha: string; mensaje: string; fecha: string }>, ahora: number): Publicada[] {
  void ahora // ver el docstring del módulo: reservado para el reloj, sin uso hoy.
  return commits
    .filter((c) => tieneTrailer(c.mensaje, TRAILER_PANEL))
    .map((c) => ({
      sha: c.sha,
      resumen: c.mensaje.split('\n')[0],
      autor: autorDelCommit(c.mensaje) ?? null,
      cuando: c.fecha,
      revierteA: valorDeTrailer(c.mensaje, TRAILER_REVIERTE) ?? null,
    }))
}
