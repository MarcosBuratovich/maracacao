/*
 * Las páginas que no son la portada: la de fichas técnicas (el texto
 * alrededor de las cuatro fichas — el contenido de cada ficha vive en
 * `fichas.ts`, con su propio documento), la que se ve cuando un enlace está
 * roto, y el pie que se repite en todas las páginas del sitio.
 *
 * Este archivo exporta CLAVES, no un `grupo`, por la misma razón que los
 * otros cuatro de esta carpeta: `fichasTecnicas`, `noEncontrada` y `footer`
 * son bloques del mismo documento `marca`, y envolverlos en un `grupo`
 * agregaría un nivel de anidamiento que no existe en el contenido
 * (`paginas.fichasTecnicas.titulo` en vez de `fichasTecnicas.titulo`).
 */
import { grupo, lista, texto, parrafo, ruta, ancla, medida } from '../../campos'
import { sinHtml } from './cabecera'

const enFichas = { seccion: 'fichas' } as const
const enBuscadores = { seccion: 'buscadores' } as const
const enNoEncontrada = { seccion: 'no-encontrada' } as const
const enPie = { seccion: 'pie' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDePaginas = {
  fichasTecnicas: grupo({
    ...enFichas,
    etiqueta: 'Página de fichas técnicas',
    ayuda: 'La página en /fichas-tecnicas: el título, los textos y los botones alrededor de las cuatro fichas.',
    campos: {
      ruta: ruta({
        ...enFichas,
        etiqueta: 'Dirección de la página',
        ayuda: 'La dirección de la página de fichas técnicas. No se cambia.',
      }),
      rutaInicio: ruta({
        ...enFichas,
        etiqueta: 'Dirección del inicio',
        ayuda: 'A dónde lleva «Volver al sitio». No se cambia.',
      }),
      rutaPdf: ruta({
        ...enFichas,
        etiqueta: 'Carpeta de los PDF',
        ayuda: 'Dónde se publican los PDF de las fichas. No se cambia.',
      }),
      // Mismos topes que titulo/descripcion de la portada (cabecera.ts) y
      // la misma regla de `& < > "`: el <title> y la meta description de
      // esta página se escriben dentro del <head>, donde esos caracteres
      // no se escapan solos. `sinHtml` sale de cabecera.ts para no pagar
      // esa regla dos veces.
      titulo: sinHtml(
        texto({
          ...enBuscadores,
          etiqueta: 'Título en Google de esta página',
          ayuda: 'El renglón azul del resultado de búsqueda de la página de fichas.',
          maxCaracteres: 70,
          falla: ['ninguno'],
        }),
      ),
      descripcion: sinHtml(
        parrafo({
          ...enBuscadores,
          etiqueta: 'Descripción en Google de esta página',
          ayuda: 'El párrafo gris del resultado de búsqueda de la página de fichas.',
          maxCaracteres: 155,
          enAtributo: 'content',
          falla: ['ninguno'],
        }),
      ),
      kicker: texto({
        ...enFichas,
        etiqueta: 'Antetítulo de la página',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 40,
      }),
      encabezado: texto({
        ...enFichas,
        etiqueta: 'Título de la página',
        ayuda: 'El título grande de la página de fichas.',
        maxCaracteres: 30,
      }),
      sub: parrafo({
        ...enFichas,
        etiqueta: 'Texto de entrada',
        ayuda: 'El párrafo bajo el título: qué hay en las fichas.',
        maxCaracteres: 320,
      }),
      tipoDocumento: texto({
        ...enFichas,
        etiqueta: 'Tipo de documento',
        ayuda: 'La línea chiquita en el encabezado de cada ficha impresa.',
        maxCaracteres: 40,
      }),
      // Vive adentro de un `aria-label`, no en un nodo de texto: sin nada
      // geométrico que medir, así que va con sección accesibilidad y
      // `falla: ['ninguno']`.
      indiceAria: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del índice',
        ayuda: 'Cómo describe el lector de pantalla la lista de fichas. No se ve.',
        maxCaracteres: 30,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      descargar: texto({
        ...enFichas,
        etiqueta: 'Botón de descargar',
        ayuda: 'Lo que dice el botón que baja el PDF.',
        maxCaracteres: 30,
      }),
      descargarNota: texto({
        ...enFichas,
        etiqueta: 'Nota del botón',
        ayuda: 'La línea chiquita bajo el botón: tamaño y páginas.',
        maxCaracteres: 30,
      }),
      volver: texto({
        ...enFichas,
        etiqueta: 'Botón de volver',
        ayuda: 'El botón que regresa al sitio.',
        maxCaracteres: 30,
      }),
      contactoNota: texto({
        ...enFichas,
        etiqueta: 'Nota de contacto',
        ayuda: 'La línea antes del correo, al pie de la página.',
        maxCaracteres: 30,
      }),
    },
  }),

  noEncontrada: grupo({
    ...enNoEncontrada,
    etiqueta: 'Página de error',
    ayuda: 'La página que se ve cuando un enlace está roto.',
    campos: {
      // Los 404 no se indexan: el único consumidor de este título es el
      // <title> de la pestaña, y ahí Astro escapa solo. Por eso, a
      // diferencia de fichasTecnicas.titulo, NO lleva sinHtml.
      titulo: texto({
        ...enNoEncontrada,
        etiqueta: 'Título de la pestaña',
        ayuda: 'El nombre de la pestaña del navegador. Esta página no la indexa Google.',
        maxCaracteres: 60,
        falla: ['ninguno'],
      }),
      encabezado: texto({
        ...enNoEncontrada,
        etiqueta: 'Título de la página',
        ayuda: 'El título grande de la página de error.',
        maxCaracteres: 40,
      }),
      sub: parrafo({
        ...enNoEncontrada,
        etiqueta: 'Texto de la página',
        ayuda: 'El párrafo que explica qué pasó.',
        maxCaracteres: 120,
      }),
      cta: texto({
        ...enNoEncontrada,
        etiqueta: 'Botón de volver',
        ayuda: 'El botón que lleva al inicio.',
        maxCaracteres: 30,
      }),
      rutaInicio: ruta({
        ...enNoEncontrada,
        etiqueta: 'Dirección del inicio',
        ayuda: 'A dónde lleva el botón. No se cambia.',
      }),
    },
  }),

  footer: grupo({
    ...enPie,
    etiqueta: 'Pie de página',
    ayuda: 'La franja final del sitio: el lema, las columnas de enlaces y la línea de cierre.',
    campos: {
      lema: texto({
        ...enPie,
        etiqueta: 'Lema de la marca',
        ayuda: 'La frase grande del pie. Aparece también en la cinta que se desliza.',
        maxCaracteres: 110,
      }),
      linea: texto({
        ...enPie,
        etiqueta: 'Línea del pie',
        ayuda: 'La línea en versales bajo el lema.',
        maxCaracteres: 50,
      }),
      seccionesTitulo: texto({
        ...enPie,
        etiqueta: 'Título de la columna de secciones',
        ayuda: 'El encabezado de la primera columna del pie.',
        maxCaracteres: 20,
      }),
      productosTitulo: texto({
        ...enPie,
        etiqueta: 'Título de la columna de productos',
        ayuda: 'El encabezado de la segunda columna del pie.',
        maxCaracteres: 20,
      }),
      contactoTitulo: texto({
        ...enPie,
        etiqueta: 'Título de la columna de contacto',
        ayuda: 'El encabezado de la tercera columna del pie.',
        maxCaracteres: 20,
      }),
      legalesTitulo: texto({
        ...enPie,
        etiqueta: 'Título de la columna de legales',
        ayuda: 'El encabezado de la cuarta columna del pie.',
        maxCaracteres: 20,
      }),
      productos: lista({
        ...enPie,
        etiqueta: 'Enlaces de productos',
        ayuda: 'La columna de productos del pie.',
        minItems: 1,
        maxItems: 10,
        elemento: grupo({
          ...enPie,
          etiqueta: 'Enlace de producto',
          ayuda: 'Un renglón de la columna de productos, en el pie.',
          nombra: (v) => (v as { texto?: string }).texto ?? 'Enlace',
          campos: {
            ancla: ancla({
              ...enPie,
              etiqueta: 'A dónde lleva',
              ayuda: 'El salto o la página a la que lleva este enlace.',
            }),
            // Dos de los nueve espacios duros del sitio viven acá: dos de
            // los cuatro enlaces llevan una cifra pegada a su unidad. `medida`
            // y no `texto` es lo que exige el espacio que no parte el renglón.
            texto: medida({
              ...enPie,
              etiqueta: 'Texto del enlace',
              ayuda: 'Lo que se lee en el pie. Entre el número y la unidad va un espacio que no parte el renglón.',
              maxCaracteres: 60,
            }),
          },
        }),
      }),
      legales: lista({
        ...enPie,
        etiqueta: 'Páginas legales',
        ayuda: 'Los nombres de las páginas legales. Todavía no tienen enlace.',
        minItems: 1,
        maxItems: 6,
        elemento: texto({
          ...enPie,
          etiqueta: 'Página legal',
          ayuda: 'El nombre de una página legal.',
          maxCaracteres: 40,
        }),
      }),
      legalesNota: texto({
        ...enPie,
        etiqueta: 'Nota de legales',
        ayuda: 'La aclaración chiquita al lado: que todavía están en preparación.',
        maxCaracteres: 30,
      }),
      derechos: texto({
        ...enPie,
        etiqueta: 'Línea de cierre',
        ayuda: 'La última línea del pie.',
        maxCaracteres: 90,
      }),
    },
  }),
}
