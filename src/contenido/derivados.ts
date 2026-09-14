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

/** De dónde salen los valores que no se editan. */
export interface FuentesDeDerivados {
  sabores: readonly { precio: number }[]
  gotas: readonly { clave: string; precio: number }[]
}

interface Derivado {
  /** La ruta punteada dentro del documento del sitio. */
  ruta: string
  calcula: (fuentes: FuentesDeDerivados) => number | string
}

/**
 * Los cinco valores del documento del sitio que se calculan en vez de
 * editarse. Cuatro son precios; el quinto —«de 15»— es el final del
 * contador del anaquel, texto armado con cuántas barras hay.
 *
 * Esta tabla y el metadato `control: 'derivado'` del esquema tienen que
 * decir exactamente lo mismo, y un test lo exige. Son dos declaraciones de
 * la misma verdad —el esquema para que el panel dibuje el campo en gris,
 * esta tabla para saber CÓMO se calcula— y ya sabemos qué pasa cuando dos
 * declaraciones de la misma verdad no tienen quién las mantenga alineadas.
 *
 * Las rutas con número (`negocios.tabs.1.precio`) son índices de `tupla`:
 * `recorre()` las emite así, con el índice, y por eso las dos listas se
 * pueden comparar directo.
 */
export const DERIVADOS_DEL_SITIO: readonly Derivado[] = [
  { ruta: 'gotas.precioDesde', calcula: (f) => precioDesde(f.gotas) },
  { ruta: 'gotas.precioJengibre', calcula: (f) => precioDe(f.gotas, 'jengibreYNaranja') },
  { ruta: 'negocios.tabs.1.precio', calcula: (f) => precioDesde(f.gotas) },
  { ruta: 'negocios.tabs.2.precio', calcula: (f) => precioDesde(f.sabores) },
  { ruta: 'anaquel.contadorDe', calcula: (f) => `de ${f.sabores.length}` },
]

/**
 * Devuelve una COPIA del documento con los derivados puestos en su lugar.
 *
 * Copia y no mutación porque el crudo llega del `import` del JSON, que en
 * un bundle es un módulo compartido: mutarlo le cambiaría el contenido a
 * cualquier otro que lo importe, y quién ve qué dependería del orden de
 * los imports. Esa clase de bug no se depura, se sufre.
 */
export function injerta(crudo: unknown, fuentes: FuentesDeDerivados): unknown {
  const copia = structuredClone(crudo) as Record<string, unknown>
  for (const { ruta, calcula } of DERIVADOS_DEL_SITIO) {
    const partes = ruta.split('.')
    const ultima = partes.pop() as string
    let donde: Record<string, unknown> = copia
    for (const parte of partes) {
      const hijo = donde[parte]
      if (hijo === null || typeof hijo !== 'object') {
        throw new Error(`injerta(): la ruta «${ruta}» se corta en «${parte}».`)
      }
      donde = hijo as Record<string, unknown>
    }
    donde[ultima] = calcula(fuentes)
  }
  return copia
}
