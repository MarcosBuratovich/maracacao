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
 * vuelva a renderizar con un `campo.valor` actualizado.
 *
 * [Ronda de arreglo final] Ese estado interno SÍ se resincroniza cuando la
 * prop trae otro valor. La versión anterior no lo hacía, con este
 * argumento: «cada campo se dibuja con una `key` propia por ruta, así que
 * un campo distinto monta una instancia nueva en vez de reciclar esta».
 * El argumento vale solo si RUTA == IDENTIDAD, y borrar un elemento que no
 * es el último rompe exactamente eso: el sobreviviente ocupa el índice del
 * borrado, la ruta no cambia, React recicla esta instancia — y adentro
 * seguía guardado el valor del ítem que ya no existe. La pantalla mostraba
 * los datos de la cocoa borrada; tocar una letra del nombre dejaba en el
 * documento un ítem Frankenstein (el nombre de una, el perfil y los
 * precios de la otra), y nada lo decía. En las fichas técnicas era peor:
 * borrar el par «Marca» corría las filas un lugar y «Vida de anaquel»
 * desaparecía de la vista, así que corregir la fila rotulada
 * «Presentaciones» escribía sobre una declaración que tiene que coincidir
 * con el empaque impreso.
 *
 * Se resincroniza comparando contra la ÚLTIMA PROP VISTA, no contra el
 * valor tipeado, y por eso sigue sirviendo para las dos cosas a la vez:
 *
 * - Mientras ella escribe, el padre controlado devuelve como prop lo mismo
 *   que ella acaba de tipear: la prop cambió, sí, pero coincide con lo que
 *   ya está en pantalla, así que no se pisa nada y —clave— `tocado` NO se
 *   reinicia: un error ya visible tiene que seguir actualizándose en vivo
 *   tecla a tecla, no volver a callarse en la primera pulsación.
 * - Con un padre que NO realimenta (los tests de esta pieza sola), la prop
 *   nunca cambia, así que nunca se resincroniza y lo tipeado queda intacto.
 * - Cuando la prop cambia a algo distinto de lo que se ve, es otro ítem
 *   (un borrado en el medio de la lista, una vuelta atrás del borrador):
 *   se reemplaza el valor y se vuelve al silencio de `tocado === false`,
 *   porque ella todavía no tocó ESTE dato.
 *
 * `Object.is` y no `!==`: el control de precio manda `Number(texto)`, que
 * con letras adentro da `NaN`, y `NaN !== NaN` es `true` — con `!==` el
 * componente se resincronizaría contra sí mismo en cada renderizado, para
 * siempre («Maximum update depth exceeded»).
 *
 * No se resuelve con el camino de arriba —subir el valor a la prop y
 * dibujar siempre `campo.valor`— porque el contador y el error quedarían
 * atados al ida y vuelta completo por cada tecla: son 692 campos y el
 * catálogo se reconstruye entero en cada cambio de `documentos`. Este
 * arreglo no agrega ni un recálculo: es una comparación por campo.
 *
 * Ronda de arreglo (revisión posterior a la Tarea 4): el error SOLO se
 * muestra después de que ella sale del campo por primera vez
 * (`tocado`) — antes de eso, la pantalla se calla aunque lo que va
 * tipeando todavía no sea válido (un correo a medio escribir, un campo
 * que acaba de vaciar para retipearlo). Validar en cada tecla desde el
 * primer carácter medía, en un campo de correo real, el mensaje de
 * error en pantalla en 16 de las 17 pulsaciones que hacían falta para
 * escribirlo entero: no es ayuda, es ruido, y un error que está siempre
 * prendido deja de leerse. Una vez que salió del campo la primera vez
 * (`tocado === true`), el error SÍ se actualiza en vivo — para que lo
 * vea desaparecer al corregirlo, sin tener que volver a salir.
 */
import { useState, type ChangeEvent, type FocusEvent } from 'react'
import type { CampoEditable } from './campos'

/** Lo que se escribe en el input: nunca "null"/"undefined" como texto — una caja vacía. */
function comoTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

/**
 * «Te quedan 74 letras», nunca «126/200»: la primera le dice a ella
 * cuánto margen le queda AHORA; la segunda le pide hacer la resta sola.
 *
 * Pasado el tope, el contador deja de contar hacia atrás («Te quedan -15
 * letras» la obliga a una cuenta mental para entender que se pasó) y dice
 * derecho por cuánto se excedió, en la misma unidad.
 */
function textoQuedan(quedan: number): string {
  if (quedan < 0) {
    const exceso = -quedan
    return `Te pasaste por ${exceso} ${exceso === 1 ? 'letra' : 'letras'}.`
  }
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
  // Arranca sin tocar: recién sale del silencio cuando ella deja el campo
  // por primera vez (`alSalir`, más abajo).
  const [tocado, setTocado] = useState(false)
  // La última `campo.valor` que vio este componente. No es lo mismo que
  // `valor` —ese es lo que ella tiene escrito— y esa diferencia es todo el
  // arreglo: ver el comentario de arriba.
  const [propVista, setPropVista] = useState<unknown>(campo.valor)
  const { meta } = campo

  // Ajustar estado DURANTE el renderizado cuando una prop cambia es el
  // camino que documenta React para este caso exacto: React descarta lo ya
  // renderizado y vuelve a llamar a esta función enseguida, sin pintar la
  // pantalla en el medio ni disparar un efecto de más. La condición
  // converge en una sola vuelta: `propVista` queda igual a `campo.valor`.
  if (!Object.is(campo.valor, propVista)) {
    setPropVista(campo.valor)
    // Solo cuando la prop trae algo DISTINTO de lo que se está mostrando:
    // si coincide, es el eco de su propia tecla y no hay nada que hacer.
    if (!Object.is(campo.valor, valor)) {
      setValor(campo.valor)
      setTocado(false)
    }
  }

  // La ruta concreta ('cocoas.lista.0.nombre') es única en todo el
  // catálogo — verificado contra los 198 campos reales, no supuesto—, así
  // que alcanza sola para un `id` sin colisiones entre documentos.
  const id = `campo-${campo.ruta}`
  const idAyuda = `${id}-ayuda`
  const idError = `${id}-error`

  const problema = campo.validar(valor)[0]
  // Lo que de verdad se DIBUJA: antes del primer `blur`, aunque `problema`
  // exista, la pantalla se calla.
  const problemaVisible = tocado ? problema : undefined

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

  function alSalir(_e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setTocado(true)
  }

  // La ayuda y, si hay, el error se leen JUNTO con el control — no solo
  // detrás de la etiqueta — para quien usa lector de pantalla.
  const describedBy = [idAyuda, problemaVisible ? idError : undefined].filter(Boolean).join(' ')

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
          onBlur={alSalir}
          aria-describedby={describedBy}
          aria-invalid={problemaVisible !== undefined}
        />
      ) : meta.control === 'precio' ? (
        <input
          id={id}
          inputMode="numeric"
          className="panel-campo-input"
          value={comoTexto(valor)}
          onChange={alCambiarPrecio}
          onBlur={alSalir}
          aria-describedby={describedBy}
          aria-invalid={problemaVisible !== undefined}
        />
      ) : (
        <input
          id={id}
          type="text"
          className="panel-campo-input"
          value={comoTexto(valor)}
          onChange={alCambiarTexto}
          onBlur={alSalir}
          aria-describedby={describedBy}
          aria-invalid={problemaVisible !== undefined}
        />
      )}

      {meta.maxCaracteres !== undefined && (
        <p className="panel-campo-contador">{textoQuedan(meta.maxCaracteres - comoTexto(valor).length)}</p>
      )}

      {problemaVisible && (
        <p id={idError} className="panel-campo-error" role="alert">
          {problemaVisible.titulo}
          {problemaVisible.arreglo && (
            <button type="button" className="panel-campo-arreglo" onClick={() => alCambiar(problemaVisible.arreglo?.valor)}>
              {problemaVisible.arreglo.etiqueta}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
