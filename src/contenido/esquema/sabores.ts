/*
 * La forma de los productos: las 15 barras, las 6 bolsas de gotas y las 8
 * variedades de polvo.
 *
 * Los nombres son los IMPRESOS en la envoltura, no los del catálogo
 * (decisión del cliente, 2026-08-13): la envoltura es la autoridad porque
 * es lo que la persona lee en el producto que compra.
 *
 * Los topes de caracteres son TECHO DE CORDURA, generosos a propósito. Si
 * un texto entra o no lo decide el medidor de la fase 4 midiendo la página
 * de verdad; el panel dice «tope de seguridad», nunca «cabe».
 */
import { grupo, lista, texto, precio, numero, slug, archivo, claveSabor, url } from '../campos'
import { resuelveColor, mejorTinta, contrasteSuficiente } from '../color-sabor'

const sabor = grupo({
  etiqueta: 'Barra',
  seccion: 'sabores',
  ayuda: 'Una de las barras del anaquel.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Barra',
  campos: {
    orden: numero({
      etiqueta: 'Número de la serie',
      seccion: 'sabores',
      ayuda: 'La numeración impresa en la envoltura. La barra 3 dice «Barra n.º 3».',
      minValor: 1,
      maxValor: 99,
    }),
    slug: slug({
      etiqueta: 'Nombre del archivo',
      seccion: 'sabores',
      ayuda: 'Con este nombre se guardan las seis fotos de esta barra. No se cambia.',
    }),
    clave: claveSabor({
      etiqueta: 'Color de la banda',
      seccion: 'sabores',
      ayuda: 'De aquí salen el color de fondo y el color de la letra de esta barra.',
    }),
    nombre: texto({
      etiqueta: 'Nombre del sabor',
      seccion: 'sabores',
      ayuda: 'Como está impreso en la envoltura. Aparece en el anaquel y en el catálogo.',
      maxCaracteres: 40,
    }),
    cacao: texto({
      etiqueta: 'Porcentaje de cacao',
      seccion: 'sabores',
      ayuda: 'La línea chica bajo el nombre: «Cacao 70%» o «Chocolate blanco».',
      maxCaracteres: 30,
    }),
    precio: precio({
      etiqueta: 'Precio de la barra',
      seccion: 'sabores',
      ayuda: 'En pesos, sin centavos. De aquí sale el «desde» de la pestaña Para negocios.',
    }),
    ingredientes: texto({
      etiqueta: 'Ingredientes',
      seccion: 'sabores',
      ayuda: 'Copiados de la envoltura impresa, en el mismo orden. Es información legal.',
      maxCaracteres: 190,
    }),
    catalogo: url({
      etiqueta: 'Página en el catálogo',
      seccion: 'sabores',
      ayuda: 'La dirección de esta barra en la tienda en línea. Vacío si todavía no está dada de alta.',
    }).nullable(),
  },
})

const gota = grupo({
  etiqueta: 'Bolsa de gotas',
  seccion: 'productos',
  ayuda: 'Una de las bolsas de gotas de 250 g.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Bolsa',
  campos: {
    clave: claveSabor({
      etiqueta: 'Color del punto',
      seccion: 'productos',
      ayuda: 'De aquí sale el color del puntito que acompaña a este sabor.',
    }),
    nombre: texto({
      etiqueta: 'Nombre del sabor',
      seccion: 'productos',
      ayuda: 'Se escribe igual que en la barra del mismo sabor, para que se llame igual en todo el sitio.',
      maxCaracteres: 30,
    }),
    precio: precio({
      etiqueta: 'Precio de la bolsa',
      seccion: 'productos',
      ayuda: 'En pesos, sin centavos. De aquí sale el «desde» del bloque de gotas.',
    }),
  },
})

const variedadDePolvo = grupo({
  etiqueta: 'Variedad de polvo',
  seccion: 'productos',
  ayuda: 'Una de las etiquetas del chocolate en polvo.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Variedad',
  campos: {
    archivo: archivo({
      etiqueta: 'Nombre del archivo de la etiqueta',
      seccion: 'productos',
      ayuda: 'Con este nombre se guarda la foto de la etiqueta. No se cambia.',
    }),
    nombre: texto({
      etiqueta: 'Nombre de la variedad',
      seccion: 'productos',
      ayuda: 'Aparece bajo su etiqueta en el bloque «Chocolate para beber».',
      maxCaracteres: 30,
    }),
  },
})

/**
 * El contraste entre la banda de color y la tinta tiene que dar 4.5 o más:
 * es lo que hace que el nombre del sabor se lea encima de su propio color.
 *
 * Hereda la excepción que YA está declarada en los tokens
 * (`saboresSoloDisplay`, src/tokens/color.ts:182): hoy la hierbabuena da
 * 4.41 y está ahí a propósito. La regla la LEE de ahí en vez de
 * reinventarla — dos listas de excepciones es cómo una excepción
 * deliberada se convierte en un bug seis meses después.
 *
 * Va como `.superRefine()` sobre el grupo y no sobre `clave` porque
 * necesita las dos cosas: el color sale de `clave` y la excepción se
 * consulta por `slug`. Verificado contra zod 4.4.3: `.superRefine()` sobre
 * un objeto conserva `def.type === 'object'` y su `shape`, así que
 * `recorre()` y `serializa()` lo siguen atravesando, y el registro del
 * panel sigue la cadena de padres a través de él. El problema se reporta
 * en `clave`, que es el campo que la clienta tendría que cambiar.
 */
const saborConContraste = sabor.superRefine((v, ctx) => {
  const fondo = resuelveColor(v.clave)
  const tinta = mejorTinta(v.clave)
  // Si alguno falta, `claveSabor` ya emitió su propio problema: agregar
  // otro sobre el mismo campo es hacerle leer dos veces lo mismo.
  if (fondo === undefined || tinta === undefined) return
  if (!contrasteSuficiente(fondo, tinta, v.slug)) {
    ctx.addIssue({
      code: 'custom',
      path: ['clave'],
      message: 'Con ese color, el nombre del sabor no se alcanza a leer encima. Elegí otro.',
    })
  }
})

/** El documento entero de productos. */
export const esquemaSabores = grupo({
  etiqueta: 'Productos',
  seccion: 'sabores',
  ayuda: 'Las barras, las bolsas de gotas y el chocolate en polvo.',
  campos: {
    urlCatalogoBarras: url({
      etiqueta: 'Categoría de barras en el catálogo',
      seccion: 'sabores',
      ayuda: 'A dónde lleva «Ver en el catálogo» cuando una barra todavía no está dada de alta.',
    }),
    // Los mínimos y máximos son de cordura, no de negocio: hoy son 15, y
    // que sigan siendo 15 lo vigilan los tests de conteo hasta la fase 7,
    // que es cuando existe el alta de ítems.
    sabores: lista({
      etiqueta: 'Las barras',
      seccion: 'sabores',
      ayuda: 'El anaquel completo, en el orden en que se muestran.',
      minItems: 1,
      maxItems: 30,
      elemento: saborConContraste,
    }),
    gotas: lista({
      etiqueta: 'Las bolsas de gotas',
      seccion: 'productos',
      ayuda: 'Los sabores que hay en bolsa de 250 g.',
      minItems: 1,
      maxItems: 15,
      elemento: gota,
    }),
    polvo: lista({
      etiqueta: 'Las variedades de polvo',
      seccion: 'productos',
      ayuda: 'Las etiquetas del chocolate en polvo, todavía no a la venta.',
      minItems: 1,
      maxItems: 20,
      elemento: variedadDePolvo,
    }),
  },
})
