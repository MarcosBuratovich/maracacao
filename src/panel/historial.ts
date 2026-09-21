/*
 * El historial (Tarea 5, fase 6): la lista de publicaciones y la frase de
 * arriba de todo con el resultado de la última (spec §4.5) — «no un tablero
 * limpio».
 *
 * Puro e inyectable, mismo patrón que `./borrador` y `./publicacion`: el
 * reloj (`ahora`) entra por parámetro, nunca `Date.now()` acá adentro, para
 * que "hoy"/"ayer" se puedan probar sin depender del reloj real.
 * `Historial.tsx` solo pinta lo que estas funciones ya decidieron.
 *
 * [Ambigüedad sin resolver, ver el reporte de esta tarea] El servidor
 * manda `autor` (un correo) pero NINGUNA de las ocho acciones le dice al
 * navegador "con qué correo entraste vos" — `historial()` no lo trae, y la
 * cookie de sesión es `HttpOnly` a propósito (`sesion.ts`), así que
 * JavaScript no puede leerla. Sin ese dato, comparar `autor` contra "el
 * correo de ella" es adivinar, y adivinar mal sería peor que no
 * distinguir nada: le mostraría a Marcos como si fuera ella, o al revés.
 * `quienPublico()` asume, HOY, que toda publicación del panel es de ella
 * —cierto en el uso real de lanzamiento: Marcos publica con `git`, y esos
 * commits ni entran a esta lista (se filtran en `src/servidor/historial.ts`
 * por no llevar `Panel: sí`)—. El día que un segundo correo publique DE
 * VERDAD desde el panel, esto necesita que el servidor devuelva también
 * quién está mirando; ese cambio cae fuera de `src/panel/**`, que es lo
 * único que esta tarea puede tocar.
 */
import type { Publicada } from './api'

/*
 * ---------------------------------------------------------------------
 * La fecha, en palabras — nunca ISO 8601
 * ---------------------------------------------------------------------
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

function dosDigitos(n: number): string {
  return n.toString().padStart(2, '0')
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * `cuando` (ISO 8601, tal cual lo dio GitHub) en las palabras que ella lee:
 * de HOY, la hora; de AYER, "ayer"; más viejo, el día y el mes — el año
 * solo si no es el año en curso (nadie necesita que le repitan el año en
 * el que ya está).
 *
 * Usa la hora LOCAL del aparato que lo corre (los `get*` de `Date`, sin
 * forzar ningún huso): como este código vive en el navegador de ella
 * (`client:only="react"`), esa hora local ES la de ella — no hace falta
 * adivinar ningún huso horario, ya lo tiene el navegador.
 *
 * `ahora` entra por parámetro y no sale de `Date.now()` acá adentro (mismo
 * criterio que `haceCuanto()` en `./borrador`): "hoy"/"ayer" depende de qué
 * hora es AHORA, y un test que dependiera del reloj real sería un test que
 * pasa hoy y se rompe solo mañana.
 */
export function fechaEnPalabras(cuando: string, ahora: number): string {
  const fecha = new Date(cuando)
  if (Number.isNaN(fecha.getTime())) return 'hace un tiempo'

  const hoy = new Date(ahora)
  if (mismoDia(fecha, hoy)) return `hoy a las ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`

  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismoDia(fecha, ayer)) return 'ayer'

  const dia = fecha.getDate()
  const mes = MESES[fecha.getMonth()]
  return fecha.getFullYear() === hoy.getFullYear() ? `el ${dia} de ${mes}` : `el ${dia} de ${mes} de ${fecha.getFullYear()}`
}

/*
 * ---------------------------------------------------------------------
 * Quién — nunca un correo crudo en pantalla
 * ---------------------------------------------------------------------
 */

/**
 * El «quién» de una fila, sin mostrar nunca el correo (ver el docstring del
 * módulo sobre por qué HOY no se puede distinguir a una tercera persona).
 * `null` —el commit no lleva el trailer— nunca se muestra como "null": cae
 * en la misma frase, sin nombre, que ya usa el servidor para el correo de
 * Marcos cuando algo sale mal (`'alguien del panel'`,
 * `src/servidor/acciones.ts`).
 */
export function quienPublico(autor: string | null): string {
  return autor === null ? 'Lo publicó alguien del panel' : 'Lo publicaste tú'
}

/*
 * ---------------------------------------------------------------------
 * Una fila — y que una reversión se vea como tal
 * ---------------------------------------------------------------------
 */

export interface FilaHistorial {
  /** Qué se publicó, ya resuelto: el resumen tal cual, o "deshace «…»" si es una reversión. */
  titulo: string
  /** La fecha, en palabras (`fechaEnPalabras`). */
  cuando: string
  /** El «quién» (`quienPublico`). */
  quien: string
  /** Para que el componente la pinte distinta — nunca como un cambio suelto más. */
  esReversion: boolean
}

/**
 * Arma una fila. Si `revierteA` no es `null`, el título deja de ser el
 * `resumen` tal cual (que lee IGUAL que un cambio nuevo — sale del mismo
 * `frase()` que arma la bandeja de publicar, `../contenido/diff`) y pasa a
 * nombrar que fue un deshacer. Si el commit que revirtió sigue en `lista`
 * (las mismas 20, puede no estar), se lo nombra por SU resumen —dato real,
 * no inventado—; si no está, la fila se explica sola, sin inventar de qué
 * cambio se trataba.
 */
export function filaDeHistorial(p: Publicada, lista: readonly Publicada[], ahora: number): FilaHistorial {
  const cuando = fechaEnPalabras(p.cuando, ahora)
  const quien = quienPublico(p.autor)

  if (p.revierteA === null) {
    return { titulo: p.resumen, cuando, quien, esReversion: false }
  }

  const original = lista.find((o) => o.sha === p.revierteA)
  const titulo = original ? `deshace «${original.resumen}»` : 'deshace un cambio anterior'
  return { titulo, cuando, quien, esReversion: true }
}

/*
 * ---------------------------------------------------------------------
 * La primera pantalla: el resultado de la última publicación (spec §4.5)
 * ---------------------------------------------------------------------
 */

/**
 * La frase de arriba de todo: qué se publicó y cuándo, de la más reciente
 * de `publicaciones` — SIN volver a consultar el estado del despliegue
 * (esa llamada ya la hace `Sesion.tsx` cuando hace falta; pedirlo de nuevo
 * acá sería un viaje de más que además podría contestar otra cosa). Sin
 * `quién` a propósito: esta frase es sobre QUÉ pasó con lo último que se
 * publicó, no sobre quién lo publicó — eso ya lo lleva cada fila de la
 * lista completa.
 *
 * `null` cuando nunca publicó nada: no hay "última" de la que hablar, y
 * quien llama (`Historial.tsx`) decide ahí, aparte, cómo se siente una
 * primera vez legítima — nunca un hueco ni un cartel de error.
 */
export function resumenUltimaPublicacion(publicaciones: readonly Publicada[], ahora: number): string | null {
  if (publicaciones.length === 0) return null
  const fila = filaDeHistorial(publicaciones[0], publicaciones, ahora)
  return `Tu último cambio se publicó ${fila.cuando}: ${fila.titulo}.`
}
