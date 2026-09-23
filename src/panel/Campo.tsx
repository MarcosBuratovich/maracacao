/*
 * `Campo.tsx` (Tarea 4, fase 7): la pieza más chica del panel y la que más
 * se repite — se dibuja una vez por cada uno de los 198 campos de ella.
 *
 * Dibuja, en este orden: la etiqueta (`meta.etiqueta`), la ayuda —
 * SIEMPRE visible, nunca detrás de un ícono «?»— el control según
 * `meta.control`, el contador cuando el campo tiene `meta.maxCaracteres`,
 * y el error cuando `campo.validar(valor)` devuelve algo.
 *
 * Por qué la ayuda va siempre a la vista: ya está escrita para los 219
 * campos del esquema (fase 1), en su idioma — esconderla detrás de un
 * clic es tener el trabajo hecho y no usarlo. Y como la navegación nueva
 * (las puertas) le muestra un ítem a la vez, nunca hay más de siete
 * campos juntos en pantalla: el alto de más no molesta.
 *
 * Por qué el error nunca se escribe acá: `campo.validar()` viene de
 * `src/contenido/validacion.ts`, la MISMA función que corre en el
 * servidor antes de publicar. Si este componente inventara su propio
 * texto de error, podría aprobar algo que el servidor rechaza después —
 * exactamente lo que este diseño existe para volver imposible.
 *
 * El estado del valor tipeado vive ACÁ adentro (sembrado con
 * `campo.valor`) y no en la prop: así el contador y el error reaccionan
 * a lo que ella está escribiendo AHORA, sin depender de que el padre
 * vuelva a renderizar con un `campo.valor` actualizado. No hace falta
 * resincronizarlo cuando la prop cambia: cada campo se dibuja con una
 * `key` propia por ruta (ver `ListaDeCampos` en `Editor.tsx`), así que un
 * campo distinto monta una instancia nueva en vez de reciclar esta.
 */
import { useState, type ChangeEvent } from 'react'
import type { CampoEditable } from './campos'

/** Lo que se escribe en el input: nunca "null"/"undefined" como texto — una caja vacía. */
function comoTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

/**
 * «Te quedan 74 letras», nunca «126/200»: la primera le dice a ella
 * cuánto margen le queda AHORA; la segunda le pide hacer la resta sola.
 */
function textoQuedan(quedan: number): string {
  return `Te quedan ${quedan} ${quedan === 1 ? 'letra' : 'letras'}.`
}

export default function Campo({
  campo,
  onCambio,
}: {
  campo: CampoEditable
  onCambio: (valor: unknown) => void
}) {
  const [valor, setValor] = useState<unknown>(campo.valor)
  const { meta } = campo

  // La ruta concreta ('cocoas.lista.0.nombre') es única en todo el
  // catálogo — verificado contra los 198 campos reales, no supuesto—, así
  // que alcanza sola para un `id` sin colisiones entre documentos.
  const id = `campo-${campo.ruta}`
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`

  const problema = campo.validar(valor)[0]

  function alCambiar(nuevo: unknown) {
    setValor(nuevo)
    onCambio(nuevo)
  }

  function alCambiarTexto(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    alCambiar(e.target.value)
  }

  // El precio se escribe en un input de texto (con teclado numérico como
  // sugerencia, no como tipo): `meta.control === 'precio'` exige un
  // NÚMERO entero (`z.int()`, en `contenido/campos.ts`), y un string como
  // "108" no pasa esa validación aunque esté perfecto — z.int() rechaza
  // cualquier valor que no sea, de entrada, del tipo `number`.
  function alCambiarPrecio(e: ChangeEvent<HTMLInputElement>) {
    alCambiar(e.target.value === '' ? null : Number(e.target.value))
  }

  // La ayuda y, si hay, el error se leen JUNTO con el control — no solo
  // detrás de la etiqueta — para quien usa lector de pantalla.
  const describedBy = [idAyuda, problema ? idError : undefined].filter(Boolean).join(' ')

  return (
    <div className="panel-campo">
      <label htmlFor={id} className="panel-campo-etiqueta">
        {meta.etiqueta}
      </label>

      {/* La ayuda siempre a la vista: es la decisión de diseño de esta
          tarea, y el rojo de la Tarea 4 se confirma comentando este
          renglón. */}
      <p id={idAyuda} className="panel-campo-ayuda">
        {meta.ayuda}
      </p>

      {meta.control === 'parrafo' ? (
        <textarea
          id={id}
          className="panel-campo-textarea"
          value={comoTexto(valor)}
          onChange={alCambiarTexto}
          aria-describedby={describedBy}
          aria-invalid={problema !== undefined}
        />
      ) : meta.control === 'precio' ? (
        <input
          id={id}
          inputMode="numeric"
          className="panel-campo-input"
          value={comoTexto(valor)}
          onChange={alCambiarPrecio}
          aria-describedby={describedBy}
          aria-invalid={problema !== undefined}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="panel-campo-input"
          value={comoTexto(valor)}
          onChange={alCambiarTexto}
          aria-describedby={describedBy}
          aria-invalid={problema !== undefined}
        />
      )}

      {meta.maxCaracteres !== undefined && (
        <p className="panel-campo-contador">{textoQuedan(meta.maxCaracteres - comoTexto(valor).length)}</p>
      )}

      {problema && (
        <p id={idError} className="panel-campo-error" role="alert">
          {problema.titulo}
        </p>
      )}
    </div>
  )
}
