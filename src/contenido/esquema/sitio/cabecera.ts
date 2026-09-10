/*
 * Lo primero que ve la visitante y lo que ve Google: el <title> y la
 * descripción de los buscadores, el logotipo, el menú y la portada.
 *
 * Los seis archivos de `esquema/sitio/` exportan CLAVES, no grupos: son
 * bloques del mismo documento, y envolverlos agregaría un nivel de
 * anidamiento que no existe en el contenido (`cabecera.hero.sub` en vez de
 * `hero.sub`), cambiando todas las rutas del sistema.
 */
// `sinHtml` vivía acá, porque este archivo fue el primero en necesitarla.
// Ahora sale de `campos.ts`, junto a `sinMenorQue`: las dos reglas de
// carácter del spec §1.2 en el mismo lugar, que es lo contrario de tener la
// misma familia repartida en dos archivos.
import { grupo, lista, tupla, texto, parrafo, ancla, correo, sinHtml } from '../../campos'

const enBuscadores = { seccion: 'buscadores' } as const
const enPortada = { seccion: 'portada' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDeCabecera = {
  titulo: sinHtml(
    texto({
      ...enBuscadores,
      etiqueta: 'Título en Google',
      ayuda: 'El renglón azul del resultado de búsqueda y el nombre de la pestaña del navegador.',
      // 70 y no el techo × 1,6: pasado ese largo Google lo corta y el
      // campo deja de hacer lo que existe para hacer. Acá el tope de
      // cordura Y el de diseño son el mismo número.
      maxCaracteres: 70,
      falla: ['ninguno'],
    }),
  ),
  descripcion: sinHtml(
    parrafo({
      ...enBuscadores,
      etiqueta: 'Descripción en Google',
      ayuda: 'El párrafo gris debajo del título en el resultado de búsqueda. Dice cuántos sabores hay.',
      // Misma razón: Google corta en 155.
      maxCaracteres: 155,
      enAtributo: 'content',
      falla: ['ninguno'],
      // «Barras 70% cacao con 15 sabores mexicanos…»: menciona el conteo y
      // hasta acá no lo declaraba. Es el único texto del sitio cuya versión
      // vieja se sigue sirviendo después de cambiarla —desde el índice del
      // buscador—, así que quedarse con un número viejo acá dura más que en
      // cualquier otro campo.
      cuenta: { de: 'sabores', sustantivo: 'sabores' },
    }),
  ),
  skipLink: texto({
    ...enAccesibilidad,
    etiqueta: 'Salto al contenido',
    ayuda: 'El enlace invisible que aparece al apretar Tab: lleva al contenido saltándose el menú.',
    maxCaracteres: 30,
    falla: ['ninguno'],
  }),

  marca: grupo({
    ...enPortada,
    etiqueta: 'La marca',
    ayuda: 'Cómo se escribe el nombre en el logotipo.',
    campos: {
      nombre: texto({
        ...enPortada,
        etiqueta: 'Nombre',
        ayuda: 'El nombre de la marca que lee Google en la ficha de datos de la página. No se ve escrito en el sitio.',
        maxCaracteres: 20,
        falla: ['ninguno'],
      }),
      wordmark: texto({
        ...enPortada,
        etiqueta: 'Nombre en el logotipo',
        ayuda: 'Como se dibuja en la cabecera, la portada y el pie: todo en mayúsculas.',
        maxCaracteres: 20,
        mayusculas: true,
      }),
      descriptor: texto({
        ...enPortada,
        etiqueta: 'Bajada del logotipo',
        ayuda: 'La línea chiquita bajo el nombre en el sello.',
        maxCaracteres: 30,
        mayusculas: true,
      }),
    },
  }),

  nav: grupo({
    ...enPortada,
    etiqueta: 'Menú',
    ayuda: 'El menú de arriba y su versión desplegada.',
    campos: {
      abrir: texto({
        ...enAccesibilidad,
        etiqueta: 'Botón para abrir el menú',
        ayuda: 'Lo que dice el botón de las tres rayas cuando el menú está cerrado.',
        maxCaracteres: 20,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      cerrar: texto({
        ...enAccesibilidad,
        etiqueta: 'Botón para cerrar el menú',
        ayuda: 'Lo mismo, con el menú abierto.',
        maxCaracteres: 20,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      etiqueta: texto({
        ...enAccesibilidad,
        etiqueta: 'Nombre del menú',
        ayuda: 'Cómo nombra al menú el lector de pantalla. No se ve en la página.',
        maxCaracteres: 30,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      items: lista({
        ...enPortada,
        etiqueta: 'Entradas del menú',
        ayuda: 'En el orden en que aparecen, arriba y en el pie.',
        minItems: 3,
        maxItems: 12,
        elemento: grupo({
          ...enPortada,
          etiqueta: 'Entrada del menú',
          ayuda: 'Un renglón del menú.',
          nombra: (v) => (v as { texto?: string }).texto ?? 'Entrada',
          campos: {
            ancla: ancla({
              ...enPortada,
              etiqueta: 'A qué sección lleva',
              ayuda: 'El salto dentro de la página. Tiene que existir una sección con ese nombre.',
            }),
            texto: texto({
              ...enPortada,
              etiqueta: 'Texto de la entrada',
              ayuda: 'Lo que se lee en el menú. Aparece en el menú desplegado y en el pie.',
              maxCaracteres: 30,
              falla: ['nowrap'],
            }),
          },
        }),
      }),
      catalogo: texto({
        ...enPortada,
        etiqueta: 'Enlace al catálogo, en el menú',
        ayuda: 'El botón del menú desplegado que lleva a la tienda en línea.',
        maxCaracteres: 30,
      }),
      pie: tupla({
        ...enPortada,
        etiqueta: 'Pie del menú desplegado',
        ayuda: 'Las dos líneas chiquitas abajo del menú abierto: dónde estamos y el correo.',
        partes: [
          texto({
            ...enPortada,
            etiqueta: 'Dónde estamos',
            ayuda: 'La primera línea del pie del menú.',
            maxCaracteres: 50,
            mayusculas: true,
          }),
          correo({
            ...enPortada,
            etiqueta: 'Correo, en el menú',
            ayuda: 'La segunda línea del pie del menú. Tiene que ser el mismo correo de la sección Contacto.',
          }),
        ],
      }),
    },
  }),

  hero: grupo({
    ...enPortada,
    etiqueta: 'Portada',
    ayuda: 'Lo primero que se ve al entrar.',
    campos: {
      titular: tupla({
        ...enPortada,
        etiqueta: 'Titular',
        ayuda: 'Los tres renglones grandes de la portada. Son tres cajas fijas: no se agregan ni se quitan.',
        falla: ['nowrap', 'renglones'],
        partes: [
          texto({
            ...enPortada,
            etiqueta: 'Renglón 1 del titular',
            ayuda: 'El primer renglón grande. Se dibuja en versales.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }),
          // El renglón 2 es el único con una regla propia, y es una regla
          // que se paga cara: la plantilla le SACA la coma del final y
          // pinta una coma de color en su lugar. Si el renglón trae dos
          // comas, la del medio se queda y el título dice
          // «70% CACAO, DE VERDAD,,». La regla «termina en coma» no
          // alcanzaba: hay que exigir que sea la ÚNICA.
          texto({
            ...enPortada,
            etiqueta: 'Renglón 2 del titular',
            ayuda: 'El segundo renglón grande. Tiene que terminar en coma, y esa tiene que ser la única coma: la página la vuelve a dibujar en rojo.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }).refine(
            (v) => /^[^,]+,$/.test(v),
            'Este renglón tiene que terminar en «,» y no llevar ninguna otra coma.',
          ),
          texto({
            ...enPortada,
            etiqueta: 'Renglón 3 del titular',
            ayuda: 'El tercer renglón grande, el que cierra.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }),
        ],
      }),
      sub: parrafo({
        ...enPortada,
        etiqueta: 'Texto bajo el titular',
        ayuda: 'El párrafo que explica la marca, debajo de los tres renglones grandes.',
        maxCaracteres: 200,
        falla: ['renglones'],
      }),
      ctaCatalogo: texto({
        ...enPortada,
        etiqueta: 'Botón del catálogo',
        ayuda: 'El botón rojo de la portada. Lleva a la tienda en línea.',
        maxCaracteres: 40,
        falla: ['nowrap'],
      }),
      ctaSabores: texto({
        ...enPortada,
        etiqueta: 'Botón que baja al anaquel',
        ayuda: 'El botón claro de la portada. Baja a los sabores.',
        maxCaracteres: 30,
        falla: ['nowrap'],
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
      marquesinaAria: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción de la cinta de barras',
        ayuda: 'Cómo describe el lector de pantalla la cinta de barras que se desliza sola. No se ve en la página.',
        maxCaracteres: 70,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
    },
  }),
}
