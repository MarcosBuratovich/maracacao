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

  // Un solo recorrido hace dos cosas: (a) borra los dos atributos que la
  // fase 2 tiene permitido agregar, en cualquier elemento; (b) mientras
  // los borra, anota qué <span> hay que desenvolver después —porque no
  // era un elemento real, era puro percha para el data-campo.
  //
  // El candidato a desenvolver NO es «quedó sin atributos». Eso sería
  // cierto en HTML escrito a mano, pero no en lo que Astro construye: todo
  // elemento que sale de un componente con `<style>` —index.astro tiene
  // uno— se estampa con un `data-astro-cid-<hash>` propio del componente,
  // sin excepción. Un <span> inventado, `<span data-campo="x">`, nunca
  // llega pelado entonces: Astro le cuelga el mismo hash que a cualquier
  // otro elemento del componente, `data-astro-cid-lcdefpme` o el que
  // toque. Contar atributos después de sacar data-campo daba siempre 1
  // (el hash), así que la regla vieja —«¿quedó en cero?»— nunca disparaba
  // contra HTML de verdad: solo contra los tests unitarios, que usaban
  // markup a mano sin ese hash, una forma que Astro no emite.
  //
  // «Pelado» entonces tiene que leerse después de descontar el hash de
  // Astro, no antes: no queda nada más que ver ahí, es ruido del
  // compilador, no algo que haya escrito nadie. Y hace falta además que el
  // elemento HAYA TRAÍDO `data-campo` —esa es la marca de que la fase 2 lo
  // tocó. Un <span> que ya existía puede recibir data-campo también (por
  // ejemplo uno con `class`), pero eso no lo inventó, y por eso NO se
  // desenvuelve aunque después de sacarle data-campo y el hash no le quede
  // nada: si solo tenía el hash de Astro para empezar —ni data-campo ni
  // ningún otro atributo—, ya era un <span> pelado ANTES de la fase 2, y
  // desenvolverlo escondería que alguien lo borró por error.
  const inventados: Element[] = []
  for (const el of document.querySelectorAll('[data-campo], [data-campo-attr]')) {
    const teniaCampo = el.hasAttribute('data-campo')
    el.removeAttribute('data-campo')
    el.removeAttribute('data-campo-attr')
    if (
      teniaCampo &&
      el.tagName === 'SPAN' &&
      [...el.attributes].every((a) => a.name.startsWith('data-astro-cid-'))
    ) {
      inventados.push(el)
    }
  }
  // El desenvolver se hace en un segundo paso, sobre `inventados`, en vez
  // de adentro del for de arriba: mutar el árbol (replaceWith) mientras
  // todavía se lo recorre buscando más candidatos es innecesariamente
  // arriesgado, aunque `querySelectorAll` de linkedom ya haya devuelto una
  // lista estática y no una NodeList viva —eso alcanza para que el primer
  // for no se salte elementos, pero no hace falta apoyarse en eso además
  // para el reemplazo.
  for (const span of inventados) {
    span.replaceWith(...span.childNodes)
  }

  return document.toString()
}
