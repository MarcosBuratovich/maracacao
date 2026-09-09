/*
 * Los precios que NO se editan porque se calculan.
 *
 * El mismo número está escrito en hasta tres lugares del contenido de hoy:
 * el 108 en las barras y en la pestaña de negocios, el 258 en las gotas,
 * en `gotas.precioDesde` y en otra pestaña. Pedirle a la clienta que los
 * mantenga sincronizados a mano es pedirle que se equivoque — y el error
 * sale caro, porque el que queda viejo es el que ven las cafeterías.
 *
 * En el panel se dibujan en gris con la nota de dónde salen.
 */

/** El más barato de la lista. Alimenta todos los «desde $X». */
export function precioDesde(items: readonly { precio: number }[]): number {
  if (items.length === 0) throw new Error('No se puede calcular un «desde» de una lista vacía.')
  return Math.min(...items.map((i) => i.precio))
}

/** El precio de un elemento por su clave. Tira si no está. */
export function precioDe(
  items: readonly { clave: string; precio: number }[],
  clave: string,
): number {
  const encontrado = items.find((i) => i.clave === clave)
  if (!encontrado) {
    // Un undefined acá se renderiza «$NaN» en la página. Que reviente el
    // build es estrictamente mejor.
    throw new Error(`No hay ningún elemento con la clave «${clave}» para sacarle el precio.`)
  }
  return encontrado.precio
}
