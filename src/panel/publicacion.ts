/*
 * Publicar, saber si llegó, y poder deshacerlo (Tarea 4, fase 6).
 *
 * El acelerador: `resume()`/`frase()` (`../contenido/diff`) son las MISMAS
 * funciones que usa el servidor para armar el asunto del commit
 * (`publicarAccion`, `src/servidor/acciones.ts`) — el resumen que ella ve
 * antes de publicar y el mensaje que queda en el historial salen del mismo
 * cálculo, nunca de dos.
 *
 * Todo lo de acá es PURO: cada función de «tras…» traduce el resultado de
 * una acción de `./api` al estado siguiente de la pantalla, sin tocar React
 * ni el reloj real ni `setTimeout`. `sondea()` es la única con un efecto de
 * verdad (llama, espera, vuelve a llamar), y hasta esa recibe el reloj y el
 * `estado()` por parámetro — mismo criterio que `src/servidor/**`, del lado
 * del navegador.
 */
import type { Cambio } from '../contenido/diff'
import { resume, frase } from '../contenido/diff'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'
import type { Documentos } from './campos'
import type { AvisoPublicado, ResultadoDeshacer, ResultadoEstado, ResultadoPublicar } from './api'

/*
 * ---------------------------------------------------------------------
 * La bandeja de revisión: qué cambió, con `resume()`/`frase()`
 * ---------------------------------------------------------------------
 */

export interface Revision {
  cambios: Cambio[]
  fraseCorta: string
}

/**
 * Arma la revisión que ella ve antes de publicar: recorre los tres
 * documentos y junta lo que cambió cada uno. `originales` es lo publicado
 * (`contenidoPublicado()`, en `./campos`) — el mismo punto de comparación
 * que usa el servidor (contra lo que lee vivo antes de escribir), nunca el
 * documento con el que arrancó un borrador viejo.
 */
export function preparaRevision(documentos: Documentos, originales: Documentos): Revision {
  const cambios: Cambio[] = []
  for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
    cambios.push(...resume(originales[id], documentos[id], DOCUMENTOS[id]))
  }
  return { cambios, fraseCorta: frase(cambios) }
}

/**
 * Cómo se lee UN cambio en la lista de la bandeja — la etiqueta del campo
 * (ya vetada, `test/panel-campos.test.ts`) más, si es una lista, si fue
 * agregado o quitado. Mismo vocabulario que `frase()` («elemento
 * agregado»/«elemento quitado»), para no decir dos cosas distintas de lo
 * mismo en la misma pantalla.
 */
export function etiquetaDeCambio(c: Cambio): string {
  if (c.tipo === 'alta') return `${c.etiqueta} (agregado)`
  if (c.tipo === 'baja') return `${c.etiqueta} (quitado)`
  return c.etiqueta
}

/*
 * ---------------------------------------------------------------------
 * El estado de la pantalla, de «revisando» a «deshecho»
 * ---------------------------------------------------------------------
 */

/** Antes de que conteste la primera vez `estado()` — nunca se le inventa una frase del servidor, esta es la única que es de acá. */
export const FRASE_PUBLICANDO = 'Publicando tu cambio…'

/** Lo que hace falta para seguir sondeando o para deshacer, una vez que `publicar()` contestó con un commit de verdad. */
export interface DatosSondeo {
  sha: string
  /** Reloj de ESTE aparato, no del servidor — el mismo criterio que ya usa `estado()`: es quien mide «hace cuánto» tanto para la cadencia como para la ventana de deshacer. */
  publicadoEn: number
  avisos: AvisoPublicado[]
}

export type EstadoPublicacion =
  | { fase: 'revisando'; cambios: Cambio[]; fraseCorta: string }
  | { fase: 'publicando'; cambios: Cambio[]; fraseCorta: string }
  | { fase: 'error-publicar'; problema: string; cambios: Cambio[]; fraseCorta: string }
  /** `publicar()` contestó `sha: null`: ningún documento había cambiado de verdad. Nada que sondear ni que deshacer. */
  | { fase: 'sin-cambios'; frase: string }
  | { fase: 'sondeando'; frase: string; datos: DatosSondeo }
  /** Un sondeo que falló de red — no un veredicto del servidor. Reintento a mano, nunca automático. */
  | { fase: 'error-sondeo'; problema: string; datos: DatosSondeo }
  /** `reintentarEn` vino `null`: se dejó de sondear. NO implica `estado: 'listo'` — puede ser la frase de «está tardando más de lo normal» (spec §4.5, `DEJA_DE_PREGUNTAR_MS`) y aun así hay que salir de acá con algo que hacer. */
  | { fase: 'terminado'; frase: string; datos: DatosSondeo }
  | { fase: 'deshaciendo'; datos: DatosSondeo }
  | { fase: 'error-deshacer'; problema: string; datos: DatosSondeo }
  | { fase: 'deshecho'; resumen: string }

/**
 * [H1, ronda de arreglo] ¿Desde esta fase se puede publicar de verdad?
 * Antes solo `'revisando'` (el botón «Confirmar y publicar») pasaba, así
 * que «Reintentar» en `'error-publicar'` llamaba a la MISMA función de
 * publicar y salía sin hacer nada — un botón muerto, justo en el error
 * más probable (el 409 de pisada, cuyo propio texto le dice «vuelve a
 * intentar la publicación»). Las dos fases llevan `cambios`/`fraseCorta`
 * con la misma forma, así que aceptar las dos es seguro de tipos.
 *
 * A propósito NO decide acá si conviene refrescar `base` antes de
 * reintentar — eso lo decide `Sesion.tsx`, en el llamador (ver el
 * comentario ahí): esta función solo contesta «¿hay algo que confirmar?».
 */
export function puedeConfirmarPublicar(
  estado: EstadoPublicacion | null,
): estado is Extract<EstadoPublicacion, { fase: 'revisando' | 'error-publicar' }> {
  return estado !== null && (estado.fase === 'revisando' || estado.fase === 'error-publicar')
}

/** Tras `publicar()`: el 400/409/422/502 se muestra tal cual —nunca se traga—, y `avisos` viaja intacto hacia la pantalla siguiente, nunca como un bloqueo. */
export function trasPublicar(
  r: ResultadoPublicar,
  publicadoEn: number,
  previo: { cambios: Cambio[]; fraseCorta: string },
): EstadoPublicacion {
  if (!r.ok) return { fase: 'error-publicar', problema: r.problema, ...previo }
  if (r.sha === null) return { fase: 'sin-cambios', frase: r.resumen }
  return { fase: 'sondeando', frase: FRASE_PUBLICANDO, datos: { sha: r.sha, publicadoEn, avisos: r.avisos } }
}

/** Tras una vuelta de `estado()`: obedece `reintentarEn` (`sondea()`, más abajo, es quien de verdad espera ese número) y solo decide si hay que seguir sondeando o si ya hay que salir con lo que haya. */
export function trasEstado(r: ResultadoEstado, datos: DatosSondeo): EstadoPublicacion {
  if (!r.ok) return { fase: 'error-sondeo', problema: r.problema, datos }
  if (r.reintentarEn === null) return { fase: 'terminado', frase: r.frase, datos }
  return { fase: 'sondeando', frase: r.frase, datos }
}

/** Tras `deshacer()`: el mismo criterio, la frase del servidor tal cual, con salida (`datos`) si falla. */
export function trasDeshacer(r: ResultadoDeshacer, datos: DatosSondeo): EstadoPublicacion {
  if (!r.ok) return { fase: 'error-deshacer', problema: r.problema, datos }
  return { fase: 'deshecho', resumen: r.resumen }
}

/** El `base` para la PRÓXIMA publicación: el commit que se acaba de crear (`publicar()` o `deshacer()`), o el que ya había si esta vez no se escribió nada nuevo (`sha: null`). */
export function siguienteBase(actual: string | null, sha: string | null): string | null {
  return sha ?? actual
}

/*
 * ---------------------------------------------------------------------
 * El sondeo: obedece `reintentarEn`, para con `null` — nunca un intervalo propio
 * ---------------------------------------------------------------------
 */

export interface DependenciasSondeo {
  /** `estado` de `./api` (o un doble de prueba). Nunca tira. */
  estado: (cuerpo: { sha: string; publicadoEn?: number }) => Promise<ResultadoEstado>
  /** El reloj de espera, inyectado — nunca `setTimeout` suelto acá, por la misma razón que `src/servidor/**`. */
  espera: (ms: number) => Promise<void>
  onResultado: (r: ResultadoEstado) => void
}

export interface ControladorSondeo {
  /** Corta el ciclo — nunca más vuelve a llamar a `estado()` después de esto. Idempotente. */
  detente: () => void
}

/**
 * Sondea `estado()` una vez, y de nuevo cuando `reintentarEn` lo diga,
 * hasta que venga `null` o la llamada falle. El número de espera SIEMPRE
 * sale de la respuesta del servidor — nunca una cadencia propia (regla de
 * la tarea) — y una falla de red CORTA el ciclo (no reintenta sola): la
 * pantalla es quien decide, con un botón, si vuelve a sondear.
 */
export function sondea(args: { sha: string; publicadoEn: number }, deps: DependenciasSondeo): ControladorSondeo {
  let activo = true

  async function ciclo(): Promise<void> {
    for (;;) {
      if (!activo) return
      const r = await deps.estado({ sha: args.sha, publicadoEn: args.publicadoEn })
      if (!activo) return
      deps.onResultado(r)
      if (!r.ok) return
      if (r.reintentarEn === null) return
      await deps.espera(r.reintentarEn)
    }
  }

  void ciclo()
  return {
    detente: () => {
      activo = false
    },
  }
}

/*
 * ---------------------------------------------------------------------
 * El botón «Deshacer», durante 30 minutos
 * ---------------------------------------------------------------------
 */

/**
 * La misma ventana que el servidor (`VENTANA_DESHACER_MS`,
 * `src/servidor/acciones.ts`), duplicada a propósito: ese archivo importa
 * el cliente de GitHub, `vercel.ts` y compañía, y traerlo al navegador solo
 * por un número sería inflar el paquete del panel para no ganar nada — el
 * servidor es quien de verdad decide si un `deshacer()` puntual entra en la
 * ventana (`PROBLEMA_TARDE` si no); esta copia es solo para no MOSTRAR un
 * botón que ya se sabe que va a fallar. Si algún día las dos se
 * desincronizan, el peor caso es un botón que se queda un rato de más o de
 * menos, nunca un permiso real.
 */
export const VENTANA_DESHACER_MS = 30 * 60_000

export function puedeDeshacer(publicadoEn: number, ahora: number): boolean {
  return ahora - publicadoEn <= VENTANA_DESHACER_MS
}

/*
 * ---------------------------------------------------------------------
 * «Ver mi sitio», con parámetro anticaché
 * ---------------------------------------------------------------------
 */

/**
 * Relativa a propósito: el panel vive en el mismo sitio que ella quiere
 * ver (`/panel`), así que no hace falta nombrar el dominio ni importar
 * `SITIO` de `src/servidor/estado.ts` (ese módulo es del servidor). El
 * parámetro salta cualquier caché intermedio del navegador o de un proxy
 * —mismo motivo que `version.json` se sirve sin caché—: un precio viejo
 * justo cuando ella va a revisar es pánico y llamada.
 */
export function hrefVerSitio(ahora: number): string {
  return `/?t=${ahora}`
}
