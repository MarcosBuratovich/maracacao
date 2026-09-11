/*
 * Deja el HTML comparable entre un antes y un después de la fase 2.
 *
 * La fase 2 no agrega solo atributos: en siete lugares el campo no tiene
 * elemento propio —comparte un nodo de texto con otra cosa— y hay que
 * inventar un <span> para colgarle el `data-campo`. Eso CAMBIA el HTML
 * renderizado, así que un `diff` crudo da cientos de líneas de ruido
 * legítimo y la única auditoría posible sería a ojo, que es justo lo que
 * el spec §3.2 prohíbe.
 *
 * Este normalizador borra lo que la fase 2 TIENE PERMITIDO agregar y no
 * toca nada más. Si después de normalizar los dos lados no son idénticos,
 * la fase 2 cambió algo que no debía.
 */
import { parseHTML } from 'linkedom'

export function normaliza(html: string): string {
  const { document } = parseHTML(html)

  // 1. Los dos atributos que la fase 2 agrega.
  for (const el of document.querySelectorAll('[data-campo], [data-campo-attr]')) {
    el.removeAttribute('data-campo')
    el.removeAttribute('data-campo-attr')
  }

  // 2. Un <span> que quedó SIN NINGÚN atributo después del paso 1 es un
  //    span que solo existía para colgar el `data-campo`: se lo reemplaza
  //    por sus hijos. Uno que ya traía `class` u otra cosa NO se toca,
  //    aunque le hayan puesto data-campo encima — ese ya existía.
  //
  //    La regla es exacta y no una aproximación: [MEDIDO] de los 248
  //    <span> de las tres páginas de contenido de hoy, los 248 tienen
  //    atributos. Cero pelados. Así que cualquiera que aparezca sin
  //    atributos es necesariamente obra de la fase 2. El test
  //    «el HTML de antes no tiene ningún span pelado» clava ese supuesto.
  //
  //    El snapshot con el spread queda a propósito, aunque MEDIDO (mutación
  //    del paso 4.3: sacar el spread y recorrer con `<p><span
  //    data-campo="a"><span data-campo="b">x</span></span></p>`) NO dio
  //    rojo — linkedom ya devuelve de `querySelectorAll` una lista estática,
  //    no una NodeList viva, así que ningún nodo se salteó ni con el
  //    iterador puesto directo. El spread es defensivo, no necesario hoy:
  //    se deja igual como cinturón, por si esa garantía de linkedom cambia
  //    de versión.
  for (const span of [...document.querySelectorAll('span')]) {
    if (span.attributes.length > 0) continue
    span.replaceWith(...span.childNodes)
  }

  return document.toString()
}
