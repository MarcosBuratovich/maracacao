/*
 * La forma de las cuatro fichas técnicas oficiales.
 *
 * El contenido es VERBATIM de los documentos del cliente (2026-08-14
 * barras y gotas, 2026-08-17 polvo): son datos que se declaran ante
 * COFEPRIS y que las cafeterías reenvían a sus propios clientes. Los topes
 * son generosos a propósito; lo que no se puede es que un dato quede
 * vacío o pierda su forma.
 *
 * Los bloques son una unión discriminada de tres formas —párrafo, lista y
 * tabla— y son el caso real para el que la Tarea 2 enseñó a recorrer
 * uniones.
 *
 * DATO QUE NO SE «CORRIGE» DE VUELTA: la tabla «Información nutrimental
 * calculada» de la ficha del chocolate en polvo dice 396 kcal / 1,672 kJ y
 * 0 mg de grasas trans. Corregido con el docx (1) del cliente, 2026-08-19:
 * la versión anterior decía 395 kcal/1,654 kJ y 2.2 mg trans. El comentario
 * vivía pegado a esas filas en `src/fichas/base.ts` y se perdió al pasar el
 * contenido a `datos/fichas.json`, que no admite comentarios. Se declara
 * ante COFEPRIS: sin este contexto, el próximo que compare la ficha con un
 * documento viejo la «arregla» al revés.
 */
import { z } from 'zod'
import { marca as tokensMarca } from '../../tokens/color'
import { grupo, lista, tupla, texto, parrafo, archivo, tokenColor, valorFijo } from '../campos'

const enFichas = { seccion: 'fichas' } as const

/**
 * Un recorte del texto para nombrar la fila en el panel.
 *
 * Sin esto, los cuatro bloques de una sección se ven como cuatro filas
 * idénticas y la clienta tiene que abrirlas de a una para saber cuál es
 * cuál. Corta en palabra entera y agrega puntos suspensivos.
 */
const recorte = (valor: unknown, largo = 42): string => {
  const t = typeof valor === 'string' ? valor.trim() : ''
  if (t.length <= largo) return t
  const cortado = t.slice(0, largo)
  const espacio = cortado.lastIndexOf(' ')
  return `${(espacio > largo / 2 ? cortado.slice(0, espacio) : cortado).trimEnd()}…`
}

/** «Párrafo: «Producto elaborado…»», o solo «Párrafo» si todavía está vacío. */
const nombreDeBloque = (forma: string, contenido: string): string =>
  contenido === '' ? forma : `${forma}: «${contenido}»`

const bloqueParrafo = grupo({
  ...enFichas,
  etiqueta: 'Bloque de párrafo',
  ayuda: 'Un párrafo corrido, dentro de una sección de la ficha.',
  nombra: (v) => nombreDeBloque('Párrafo', recorte((v as { texto?: string }).texto)),
  campos: {
    tipo: valorFijo({
      ...enFichas,
      etiqueta: 'Forma del bloque',
      ayuda: 'Este bloque es un párrafo corrido.',
      valores: ['parrafo'],
    }),
    texto: parrafo({
      ...enFichas,
      etiqueta: 'Texto del párrafo',
      ayuda: 'Un párrafo de la ficha, tal como aparece en el documento oficial.',
      maxCaracteres: 580,
    }),
  },
})

const bloqueLista = grupo({
  ...enFichas,
  etiqueta: 'Bloque de lista',
  ayuda: 'Una lista de viñetas, dentro de una sección de la ficha.',
  nombra: (v) =>
    nombreDeBloque('Lista', recorte((v as { items?: unknown[] }).items?.[0])),
  campos: {
    tipo: valorFijo({
      ...enFichas,
      etiqueta: 'Forma del bloque',
      ayuda: 'Este bloque es una lista de viñetas.',
      valores: ['lista'],
    }),
    items: lista({
      ...enFichas,
      etiqueta: 'Viñetas',
      ayuda: 'Cada renglón de la lista, en orden.',
      minItems: 1,
      maxItems: 20,
      elemento: texto({
        ...enFichas,
        etiqueta: 'Viñeta',
        ayuda: 'Un renglón de la lista.',
        maxCaracteres: 190,
      }),
    }),
  },
})

const bloqueTabla = grupo({
  ...enFichas,
  etiqueta: 'Bloque de tabla',
  ayuda: 'Una tabla con encabezados, dentro de una sección de la ficha.',
  nombra: (v) =>
    nombreDeBloque('Tabla', recorte((v as { encabezados?: unknown[] }).encabezados?.[0])),
  campos: {
    tipo: valorFijo({
      ...enFichas,
      etiqueta: 'Forma del bloque',
      ayuda: 'Este bloque es una tabla con encabezados.',
      valores: ['tabla'],
    }),
    encabezados: lista({
      ...enFichas,
      etiqueta: 'Encabezados de la tabla',
      ayuda: 'Los títulos de las columnas. Cada fila tiene que traer esta misma cantidad de celdas.',
      minItems: 1,
      maxItems: 6,
      elemento: texto({
        ...enFichas,
        etiqueta: 'Encabezado',
        ayuda: 'El título de una columna.',
        maxCaracteres: 20,
      }),
    }),
    filas: lista({
      ...enFichas,
      etiqueta: 'Filas de la tabla',
      ayuda: 'Cada fila, con una celda por columna.',
      minItems: 1,
      maxItems: 40,
      elemento: lista({
        ...enFichas,
        etiqueta: 'Fila',
        ayuda: 'Las celdas de una fila, en el orden de los encabezados.',
        minItems: 1,
        maxItems: 6,
        elemento: texto({
          ...enFichas,
          etiqueta: 'Celda',
          ayuda: 'El contenido de una celda.',
          maxCaracteres: 60,
        }),
      }),
    }),
  },
})

/**
 * Un bloque de una sección. La unión va DISCRIMINADA por `tipo`: sin
 * discriminante, Zod probaría las tres formas y el error de una tabla mal
 * escrita saldría como «ninguna de las 3 opciones coincide», que no le
 * dice nada a nadie.
 */
const bloque = z.discriminatedUnion('tipo', [bloqueParrafo, bloqueLista, bloqueTabla])

const seccion = grupo({
  ...enFichas,
  etiqueta: 'Sección de la ficha',
  ayuda: 'Un apartado de la ficha, con su título y sus bloques.',
  nombra: (v) => (v as { titulo?: string }).titulo ?? 'Sección',
  campos: {
    titulo: texto({
      ...enFichas,
      etiqueta: 'Título de la sección',
      ayuda: 'El encabezado del apartado: «Alérgenos», «Información nutrimental de referencia».',
      maxCaracteres: 70,
    }),
    bloques: lista({
      ...enFichas,
      etiqueta: 'Bloques',
      ayuda: 'El contenido del apartado: párrafos, listas y tablas, en orden.',
      minItems: 1,
      maxItems: 10,
      elemento: bloque,
    }),
  },
})

const ficha = grupo({
  ...enFichas,
  etiqueta: 'Ficha técnica',
  ayuda: 'Una de las cuatro fichas oficiales.',
  nombra: (v) => (v as { producto?: string }).producto ?? 'Ficha',
  campos: {
    archivo: archivo({
      ...enFichas,
      etiqueta: 'Nombre del archivo PDF',
      ayuda: 'Con este nombre se publica el PDF de esta ficha. No se cambia.',
    }),
    producto: texto({
      ...enFichas,
      etiqueta: 'Nombre del producto',
      ayuda: 'El título grande de la ficha, arriba a la derecha.',
      maxCaracteres: 40,
    }),
    denominacion: texto({
      ...enFichas,
      etiqueta: 'Denominación legal',
      ayuda: 'Cómo se llama el producto ante las autoridades. Sale del documento oficial.',
      maxCaracteres: 120,
    }),
    acento: tokenColor({
      ...enFichas,
      etiqueta: 'Color de acento',
      ayuda: 'El color del nombre del producto en la ficha.',
      valores: Object.values(tokensMarca),
    }),
    meta: lista({
      ...enFichas,
      etiqueta: 'Datos de cabecera',
      ayuda: 'Los pares de la tabla chica del encabezado: «Marca / Maracacao».',
      minItems: 1,
      maxItems: 10,
      elemento: tupla({
        ...enFichas,
        etiqueta: 'Dato de cabecera',
        ayuda: 'Un par: primero cómo se llama el dato, después el dato.',
        partes: [
          texto({
            ...enFichas,
            etiqueta: 'Nombre del dato',
            ayuda: 'La columna izquierda: «País de elaboración».',
            maxCaracteres: 40,
          }),
          texto({
            ...enFichas,
            etiqueta: 'Valor del dato',
            ayuda: 'La columna derecha: «México».',
            maxCaracteres: 70,
          }),
        ],
      }),
    }),
    secciones: lista({
      ...enFichas,
      etiqueta: 'Secciones',
      ayuda: 'Los apartados de la ficha, en el orden en que se imprimen.',
      minItems: 1,
      maxItems: 20,
      elemento: seccion,
    }),
  },
})

/** El documento entero de fichas. */
export const esquemaFichas = grupo({
  ...enFichas,
  etiqueta: 'Fichas técnicas',
  ayuda: 'Las fichas oficiales que se publican en la página y en PDF.',
  campos: {
    fichas: lista({
      ...enFichas,
      etiqueta: 'Las fichas',
      ayuda: 'Una por producto.',
      minItems: 1,
      maxItems: 12,
      elemento: ficha,
    }),
  },
})
