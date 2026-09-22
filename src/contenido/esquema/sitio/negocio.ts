/*
 * La sección que le habla a cafeterías y negocios —los tres paneles de
 * producto y el semáforo de datos técnicos— y las preguntas frecuentes
 * del final de la página.
 *
 * Este archivo exporta CLAVES, no un `grupo`, por la misma razón que
 * `cabecera.ts`, `producto.ts` y `experiencia.ts`: `negocios` y `preguntas`
 * son bloques del mismo documento `marca`, y envolverlos en OTRO `grupo`
 * agregaría un nivel de anidamiento que no existe en el contenido
 * (`negocio.negocios.kicker` en vez de `negocios.kicker`).
 */
import type { z } from 'zod'
import {
  grupo, lista, tupla, texto, parrafo, ancla, correo, medida, claveSabor,
  derivado, precioONada, slug,
} from '../../campos'
import type { MetaCampo } from '../../campos'

const enNegocios = { seccion: 'negocios' } as const
const enPreguntas = { seccion: 'preguntas' } as const

/**
 * Un panel de la sección «Para negocios».
 *
 * Los tres son `tupla` y no `lista` porque el `id` y el `ficha` de cada
 * uno están cableados a anclas del markup y de /fichas-tecnicas: un cuarto
 * panel agregado desde el panel no apuntaría a nada. Y porque cada uno
 * menciona una cantidad distinta —«Ocho variedades», «6 sabores», «Las 15
 * barras»— y el metadato de una lista es uno solo para todos.
 *
 * El precio va como `derivado` en los dos que tienen precio: el 258 está
 * escrito en tres lugares del sitio y el 108 en dos. Si la clienta sube
 * las barras a 130 desde el anaquel y esta pestaña no se mueve, le sigue
 * diciendo «desde $108» a las cafeterías, que son exactamente el público
 * de esta sección. Nada avisa.
 */
const panelDeProducto = (p: {
  nombre: string          // «polvo», «gotas», «barras» — para las etiquetas
  topeCuerpo: number
  topeDatos: number
  cuentaCuerpo?: MetaCampo['cuenta']
  cuentaDatos?: MetaCampo['cuenta']
  // Tipado por el OUTPUT (number | null) y no `z.ZodType` a secas: con el
  // genérico vacío, z.object() infiere `precio` como `unknown` y
  // index.astro —que hace `t.precio === null ? … : precioMXN(t.precio)`—
  // no puede angostarlo a `number` en la rama del else. Los tres paneles
  // conviven en una sola `tupla`; el que no tiene precio todavía usa
  // `precioONada` (number | null), los otros dos usan `derivado` (number),
  // y `number` es subtipo de `number | null`, así que los tres calzan acá.
  precio: z.ZodType<number | null>       // derivado(...) o precioONada(...)
}) =>
  grupo({
    seccion: 'negocios',
    etiqueta: `Panel de ${p.nombre}`,
    ayuda: `La pestaña de chocolate en ${p.nombre} de la sección Para negocios.`,
    campos: {
      // El `id` es el nombre INTERNO de la pestaña —«polvo», «gotas»,
      // «barras»—, no un salto dentro de la página: no lleva «#» ni «/».
      // `ancla()` lo exige y por eso rechazaba el dato de hoy; `slug()` es
      // la misma regla («minúsculas, números y guiones») que este campo
      // de verdad necesita.
      id: slug({
        seccion: 'negocios',
        etiqueta: 'Nombre interno de la pestaña',
        ayuda: 'Con este nombre la página recuerda qué pestaña estaba abierta. No se cambia.',
      }),
      ficha: ancla({
        seccion: 'negocios',
        etiqueta: 'A qué ficha técnica lleva',
        ayuda: 'El salto a la ficha técnica de este producto. Tiene que existir esa ficha.',
      }),
      etiqueta: texto({
        seccion: 'negocios',
        etiqueta: 'Nombre de la pestaña',
        ayuda: 'Lo que se lee en el botón de la pestaña.',
        maxCaracteres: 40,
        falla: ['fila'],
      }),
      titulo: medida({
        seccion: 'negocios',
        etiqueta: 'Título del panel',
        ayuda: 'El título dentro de la pestaña. Entre el número y la unidad va un espacio que no parte el renglón.',
        maxCaracteres: 60,
      }),
      precioNota: texto({
        seccion: 'negocios',
        etiqueta: 'Palabra antes del precio',
        ayuda: 'La palabra chiquita antes del precio: «desde», «Precio de mayoreo».',
        maxCaracteres: 20,
      }),
      precio: p.precio,
      clave: claveSabor({
        seccion: 'negocios',
        etiqueta: 'Color del panel',
        ayuda: 'De aquí sale el color de fondo de esta pestaña.',
      }),
      cuerpo: parrafo({
        seccion: 'negocios',
        etiqueta: 'Texto del panel',
        ayuda: 'El párrafo que describe el producto dentro de la pestaña.',
        maxCaracteres: p.topeCuerpo,
        ...(p.cuentaCuerpo ? { cuenta: p.cuentaCuerpo } : {}),
      }),
      datos: lista({
        seccion: 'negocios',
        etiqueta: 'Datos del panel',
        ayuda: 'Las viñetas con los datos prácticos del producto.',
        minItems: 1,
        maxItems: 10,
        elemento: texto({
          seccion: 'negocios',
          etiqueta: 'Dato',
          ayuda: 'Una viñeta de la lista.',
          maxCaracteres: p.topeDatos,
          ...(p.cuentaDatos ? { cuenta: p.cuentaDatos } : {}),
        }),
      }),
    },
  })

const tabs = tupla({
  ...enNegocios,
  etiqueta: 'Los tres paneles de producto',
  ayuda: 'Polvo, gotas y barras. Son tres cajas fijas: cada una está enganchada a su ancla y a su ficha técnica.',
  partes: [
    // «Ocho variedades para la taza…» · sin precio todavía
    panelDeProducto({
      nombre: 'polvo',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaCuerpo: { de: 'polvo', sustantivo: 'variedades' },
      precio: precioONada({
        seccion: 'negocios',
        etiqueta: 'Precio del polvo',
        ayuda: 'El precio más bajo del chocolate en polvo, el de la bolsa chica sin sabor.',
      }),
    }),
    // «6 sabores: jengibre y naranja, …» — el conteo está en los DATOS
    panelDeProducto({
      nombre: 'gotas',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaDatos: { de: 'gotas', sustantivo: 'sabores' },
      precio: derivado({
        seccion: 'negocios',
        etiqueta: 'Precio de las gotas, en la pestaña',
        ayuda: 'Sale solo del precio más bajo de las bolsas de gotas. No se edita aquí.',
        saleDe: 'el precio más bajo de las bolsas de gotas',
      }),
    }),
    // «Las 15 barras de la línea…» — cuenta sabores y dice «barras»
    panelDeProducto({
      nombre: 'barras',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaCuerpo: { de: 'sabores', sustantivo: 'barras' },
      precio: derivado({
        seccion: 'negocios',
        etiqueta: 'Precio de las barras, en la pestaña',
        ayuda: 'Sale solo del precio más bajo de las barras. No se edita aquí.',
        saleDe: 'el precio más bajo de las barras',
      }),
    }),
  ],
})

export const camposDeNegocio = {
  negocios: grupo({
    ...enNegocios,
    etiqueta: 'Para negocios',
    ayuda: 'La sección que le habla a cafeterías y negocios: los tres paneles de producto y el semáforo de datos técnicos.',
    campos: {
      kicker: texto({
        ...enNegocios,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 40,
      }),
      titulo: texto({
        ...enNegocios,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «¿Con qué trabajas?».',
        maxCaracteres: 30,
      }),
      intro: parrafo({
        ...enNegocios,
        etiqueta: 'Texto de entrada',
        ayuda: 'El párrafo bajo el título: a qué negocios se les vende.',
        maxCaracteres: 100,
      }),
      correoEtiqueta: texto({
        ...enNegocios,
        etiqueta: 'Etiqueta del correo',
        ayuda: 'La palabra antes del correo de pedidos.',
        maxCaracteres: 30,
      }),
      // Sin `escribeTambien`: la ruta canónica del correo es
      // `contacto.correo`, y esa se declara recién en la Tarea 11. Acá va
      // un `correo()` común, igual que en `nav.pie` de cabecera.ts.
      correo: correo({
        ...enNegocios,
        etiqueta: 'Correo de pedidos',
        ayuda: 'El correo para cafeterías y mayoreo. Es el mismo de la sección Contacto.',
      }),
      fichasCta: texto({
        ...enNegocios,
        etiqueta: 'Botón de las fichas',
        ayuda: 'El botón que lleva a la página de fichas técnicas.',
        maxCaracteres: 40,
      }),
      fichaEnlace: texto({
        ...enNegocios,
        etiqueta: 'Enlace a la ficha del panel',
        ayuda: 'El enlace de cada panel que lleva a su propia ficha técnica.',
        maxCaracteres: 40,
      }),
      fichas: lista({
        ...enNegocios,
        etiqueta: 'Semáforo de datos técnicos',
        ayuda: 'Qué información técnica hay disponible hoy.',
        minItems: 1,
        maxItems: 8,
        elemento: grupo({
          ...enNegocios,
          etiqueta: 'Dato técnico',
          ayuda: 'Un renglón del semáforo de datos técnicos.',
          nombra: (v) => (v as { dato?: string }).dato ?? 'Dato',
          campos: {
            dato: texto({
              ...enNegocios,
              etiqueta: 'Qué dato es',
              ayuda: 'La columna izquierda: «Alérgenos».',
              maxCaracteres: 60,
            }),
            estado: texto({
              ...enNegocios,
              etiqueta: 'Dónde está ese dato',
              ayuda: 'La columna derecha: «confirmados en ficha técnica».',
              maxCaracteres: 50,
            }),
          },
        }),
      }),
      /*
       * Las condiciones de mayoreo (catálogo Maracacao, sección 06). Hasta
       * hoy el sitio invitaba a escribir por mayoreo sin decir NADA de lo
       * que una cafetería necesita saber antes de escribir: cuánto es el
       * mínimo, cuándo se paga y cuándo llega. Esa conversación se estaba
       * teniendo por WhatsApp una vez por cliente.
       *
       * Misma forma que `fichas` —dato a la izquierda, estado a la
       * derecha— a propósito: es el mismo tipo de lectura rápida y ya
       * tiene su lugar en la página.
       */
      condicionesTitulo: texto({
        ...enNegocios,
        etiqueta: 'Título de las condiciones',
        ayuda: 'El encabezado de la lista de condiciones de mayoreo.',
        maxCaracteres: 40,
      }),
      condiciones: lista({
        ...enNegocios,
        etiqueta: 'Condiciones de mayoreo',
        ayuda: 'Mínimo, pago, tiempos y entregas: lo que hay que saber antes de pedir.',
        minItems: 1,
        maxItems: 8,
        elemento: grupo({
          ...enNegocios,
          etiqueta: 'Condición',
          ayuda: 'Un renglón de las condiciones de mayoreo.',
          nombra: (v) => (v as { dato?: string }).dato ?? 'Condición',
          campos: {
            dato: texto({
              ...enNegocios,
              etiqueta: 'Qué condición es',
              ayuda: 'La columna izquierda: «Pedido mínimo».',
              maxCaracteres: 60,
            }),
            estado: texto({
              ...enNegocios,
              etiqueta: 'Cuál es la condición',
              ayuda: 'La columna derecha: «jueves o viernes».',
              maxCaracteres: 60,
            }),
            // El mínimo de mayoreo es un PRECIO y va en un campo de precio,
            // no adentro del texto: el sistema rechaza un «$4,000» escrito
            // en prosa justamente para que no se quede viejo sin que nadie
            // lo note. Los renglones que no hablan de plata lo dejan nulo.
            precio: precioONada({
              ...enNegocios,
              etiqueta: 'Monto de la condición',
              ayuda: 'Si la condición es un monto, va acá. Si no, se deja vacío.',
            }),
          },
        }),
      }),
      tabs,
    },
  }),

  preguntas: grupo({
    ...enPreguntas,
    etiqueta: 'Preguntas',
    ayuda: 'La sección de preguntas frecuentes, al final de la página.',
    campos: {
      kicker: texto({
        ...enPreguntas,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 40,
      }),
      titulo: texto({
        ...enPreguntas,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «Lo que más nos preguntan».',
        maxCaracteres: 40,
      }),
      items: lista({
        ...enPreguntas,
        etiqueta: 'Las preguntas',
        ayuda: 'Las preguntas frecuentes, en orden. Cada una se abre al tocarla.',
        minItems: 3,
        maxItems: 20,
        elemento: grupo({
          ...enPreguntas,
          etiqueta: 'Pregunta frecuente',
          ayuda: 'Una de las preguntas, con su respuesta.',
          nombra: (v) => (v as { p?: string }).p ?? 'Pregunta',
          campos: {
            p: texto({
              ...enPreguntas,
              etiqueta: 'La pregunta',
              ayuda: 'Lo que se lee con la respuesta cerrada.',
              maxCaracteres: 70,
            }),
            r: parrafo({
              ...enPreguntas,
              etiqueta: 'La respuesta',
              ayuda: 'Lo que aparece al abrir la pregunta.',
              maxCaracteres: 250,
            }),
          },
        }),
      }),
    },
  }),
}
