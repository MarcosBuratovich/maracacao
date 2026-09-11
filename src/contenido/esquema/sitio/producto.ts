/*
 * Lo que hay debajo de la portada: la postura de la barra (qué lleva y qué
 * no lleva), el anaquel de los 15 sabores, y las tres tarjetas de los
 * otros formatos — el paquete de minis, las bolsas de gotas y el
 * chocolate en polvo.
 *
 * Este archivo exporta CLAVES, no un `grupo`, por la misma razón que
 * `cabecera.ts`: `postura`, `anaquel`, `minis`, `gotas`, `polvoCard` y
 * `polvo` son bloques del mismo documento `marca`, y envolverlos en un
 * `grupo` agregaría un nivel de anidamiento que no existe en el contenido
 * (`producto.postura.titulo` en vez de `postura.titulo`).
 */
import { grupo, lista, texto, parrafo, precio, medida, derivado, claveSabor } from '../../campos'

const enProductos = { seccion: 'productos' } as const
const enSabores = { seccion: 'sabores' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDeProducto = {
  postura: grupo({
    ...enProductos,
    etiqueta: 'Ingredientes de la barra',
    ayuda: 'La sección que explica qué lleva y qué no lleva cada barra.',
    campos: {
      kicker: texto({
        ...enProductos,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea chiquita en versales arriba del título.',
        maxCaracteres: 30,
      }),
      titulo: texto({
        ...enProductos,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «¿Qué hay en una barra?».',
        maxCaracteres: 40,
      }),
      // El párrafo dice CUÁNTOS ingredientes lleva la barra («Cinco
      // ingredientes que puedes leer de corrido»): si la clienta agrega o
      // quita un ingrediente de la lista de abajo y no toca este texto, el
      // sitio miente.
      intro: parrafo({
        ...enProductos,
        etiqueta: 'Texto de entrada',
        ayuda: 'El párrafo bajo el título. Dice cuántos ingredientes lleva la barra.',
        maxCaracteres: 180,
        cuenta: { de: 'ingredientes', sustantivo: 'ingredientes' },
      }),
      chips: lista({
        ...enProductos,
        etiqueta: 'Sellos',
        ayuda: 'Las cápsulas de la sección: origen, año y hechura.',
        minItems: 1,
        maxItems: 6,
        elemento: texto({
          ...enProductos,
          etiqueta: 'Sello',
          ayuda: 'Una cápsula: «Cacao de Tabasco».',
          maxCaracteres: 30,
        }),
      }),
      tabSi: texto({
        ...enProductos,
        etiqueta: 'Pestaña «Sí lleva»',
        ayuda: 'El nombre de la pestaña izquierda.',
        maxCaracteres: 20,
      }),
      tabNo: texto({
        ...enProductos,
        etiqueta: 'Pestaña «No lleva»',
        ayuda: 'El nombre de la pestaña derecha.',
        maxCaracteres: 20,
      }),
      lleva: lista({
        ...enProductos,
        etiqueta: 'Lo que lleva',
        ayuda: 'Los ingredientes de la barra, del que más hay al que menos.',
        minItems: 1,
        maxItems: 12,
        elemento: texto({
          ...enProductos,
          etiqueta: 'Ingrediente',
          ayuda: 'Un ingrediente de la lista.',
          maxCaracteres: 110,
        }),
      }),
      llevaNota: parrafo({
        ...enProductos,
        etiqueta: 'Nota al pie de los ingredientes',
        ayuda: 'La aclaración chiquita bajo la lista: de dónde sale el 70% y qué lleva el blanco.',
        maxCaracteres: 240,
      }),
      noLleva: lista({
        ...enProductos,
        etiqueta: 'Lo que no lleva',
        ayuda: 'Lo que la barra no tiene, en la pestaña derecha.',
        minItems: 1,
        maxItems: 12,
        elemento: texto({
          ...enProductos,
          etiqueta: 'Cosa que no lleva',
          ayuda: 'Un renglón de la lista.',
          maxCaracteres: 40,
        }),
      }),
      noLlevaCierre: parrafo({
        ...enProductos,
        etiqueta: 'Cierre de la pestaña',
        ayuda: 'La frase que cierra la pestaña «No lleva».',
        maxCaracteres: 140,
      }),
    },
  }),

  anaquel: grupo({
    ...enSabores,
    etiqueta: 'El anaquel de sabores',
    ayuda: 'La sección donde se elige la barra, sabor por sabor.',
    campos: {
      // El antetítulo dice CUÁNTOS sabores hay («LOS 15 SABORES»): si la
      // clienta agrega o quita un sabor del anaquel y no toca este texto,
      // el sitio miente.
      kicker: texto({
        ...enSabores,
        etiqueta: 'Antetítulo del anaquel',
        ayuda: 'La línea en versales arriba de «Elige tu barra». Dice cuántos sabores hay.',
        maxCaracteres: 30,
        mayusculas: true,
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
      titulo: texto({
        ...enSabores,
        etiqueta: 'Título del anaquel',
        ayuda: 'El título grande de la sección de sabores.',
        maxCaracteres: 30,
      }),
      // Con qué barra abre el anaquel antes de que la visitante elija.
      // Estaba escrito a mano en TRES lugares —index.astro, marca.ts y
      // marca.css— y ninguno se llamaba igual, así que dar de baja ese
      // sabor en la fase 7 rompía el sitio en tres puntos sin relación
      // aparente. `quien: 'marcos'` porque es una decisión de diseño del
      // anaquel, no copy: la clienta no la ve escrita en ningún lado.
      saborInicial: claveSabor({
        ...enSabores,
        etiqueta: 'Sabor con el que abre el anaquel',
        ayuda: 'La barra que se muestra al llegar a la sección, antes de que la visitante elija otra.',
      }),
      // «de 15». No lleva `cuenta`: cruzaConteo() exige que el número sea
      // vecino inmediato de un sustantivo y acá no hay ninguno (la
      // plantilla arma «n.º 3 de 15» pegando este texto al número). Lo
      // cubre la aserción de forma 9 de `test/contenido-fachada.test.ts`,
      // que exige que este texto termine en `sabores.length` — sin ella,
      // agregar una barra deja publicado un «n.º 16 de 15». Va como
      // `quien: 'marcos'`: si la clienta lo edita a mano, el contador
      // miente y nada en el panel se lo avisa.
      contadorDe: texto({
        ...enSabores,
        etiqueta: 'Final del contador',
        ayuda: 'Lo que va después del número: «n.º 3 de 15». Cambia cuando cambia la cantidad de barras.',
        maxCaracteres: 20,
        quien: 'marcos',
        falla: ['nowrap'],
      }),
      fichaEtiqueta: texto({
        ...enSabores,
        etiqueta: 'Etiqueta del contador',
        ayuda: 'Lo que va antes del número: «Barra n.º 3».',
        maxCaracteres: 20,
      }),
      // Vive adentro de un `aria-label`, no en un nodo de texto: no hay
      // nada geométrico que medir, así que va con sección accesibilidad y
      // `falla: ['ninguno']`.
      grupoAria: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del selector de sabores',
        ayuda: 'Cómo describe el lector de pantalla la fila de barras. No se ve en la página.',
        maxCaracteres: 60,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      // El sello redondo sobre la envoltura. Lleva el espacio duro entre
      // la cifra y la unidad: sin él, la «g» queda sola en el renglón
      // siguiente en el celular.
      pesoInsignia: medida({
        ...enSabores,
        etiqueta: 'Peso en la insignia',
        ayuda: 'El sello redondo sobre la envoltura. Entre el número y la unidad va un espacio que no parte el renglón.',
        maxCaracteres: 20,
        falla: ['nowrap'],
      }),
      manoInsignia: texto({
        ...enSabores,
        etiqueta: 'Texto de la insignia',
        ayuda: 'La segunda línea del sello redondo sobre la envoltura.',
        maxCaracteres: 20,
      }),
      // La plantilla le agrega los dos puntos: «Ingredientes: licor de
      // cacao…». El panel dibuja el sufijo en gris al lado del campo para
      // que la clienta no lo escriba dos veces.
      ingredientesEtiqueta: texto({
        ...enSabores,
        etiqueta: 'Etiqueta de ingredientes',
        ayuda: 'La palabra antes de la lista de ingredientes de cada barra.',
        maxCaracteres: 20,
        sufijo: ':',
      }),
      cta: texto({
        ...enSabores,
        etiqueta: 'Botón del catálogo, en la ficha',
        ayuda: 'El botón bajo cada barra que lleva a comprarla.',
        maxCaracteres: 30,
      }),
      remate: texto({
        ...enSabores,
        etiqueta: 'Remate del anaquel',
        ayuda: 'La frase que cierra la sección de sabores.',
        maxCaracteres: 50,
      }),
      ilustracionCaption: texto({
        ...enSabores,
        etiqueta: 'Pie de la ilustración',
        ayuda: 'El texto bajo el dibujo de la envoltura.',
        maxCaracteres: 50,
      }),
      // Se le agrega el nombre del sabor: vive adentro de un `alt`, sin
      // nada geométrico que medir.
      ilustracionAltPrefijo: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del dibujo',
        ayuda: 'Cómo empieza la descripción del dibujo para quien no lo ve. Se le agrega el nombre del sabor.',
        maxCaracteres: 50,
        enAtributo: 'alt',
        falla: ['ninguno'],
      }),
      envolturaAltPrefijo: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción de la foto de la envoltura',
        ayuda: 'Cómo empieza la descripción de la foto para quien no la ve. Se le agrega el nombre del sabor.',
        maxCaracteres: 20,
        enAtributo: 'alt',
        falla: ['ninguno'],
      }),
    },
  }),

  minis: grupo({
    ...enProductos,
    etiqueta: 'Paquete de minis',
    ayuda: 'La tarjeta del paquete de seis minibarras.',
    campos: {
      titulo: texto({
        ...enProductos,
        etiqueta: 'Título del paquete de minis',
        ayuda: 'El título de la tarjeta del paquete de seis.',
        maxCaracteres: 40,
      }),
      precio: precio({
        ...enProductos,
        etiqueta: 'Precio del paquete',
        ayuda: 'En pesos, sin centavos.',
      }),
      cuerpo: parrafo({
        ...enProductos,
        etiqueta: 'Texto del paquete',
        ayuda: 'El párrafo de la tarjeta del paquete de seis.',
        maxCaracteres: 160,
      }),
      nota: texto({
        ...enProductos,
        etiqueta: 'Nota del paquete',
        ayuda: 'La línea chiquita al pie de la tarjeta.',
        maxCaracteres: 90,
      }),
    },
  }),

  gotas: grupo({
    ...enProductos,
    etiqueta: 'Gotas de chocolate',
    ayuda: 'La tarjeta de las bolsas de gotas.',
    campos: {
      // El título de la tarjeta de las bolsas. Lleva el espacio duro entre
      // la cifra y la unidad, igual que `anaquel.pesoInsignia`.
      titulo: medida({
        ...enProductos,
        etiqueta: 'Título del bloque de gotas',
        ayuda: 'El título de la tarjeta de las bolsas. Entre el número y la unidad va un espacio que no parte el renglón.',
        maxCaracteres: 50,
        falla: ['nowrap'],
      }),
      // NO viaja al JSON: lo calcula la fachada (Tarea 13) a partir del
      // precio más bajo de las bolsas de gotas. El motivo: el 258 está
      // escrito en tres lugares, y si la clienta sube las bolsas desde el
      // anaquel y este número no se mueve, la tarjeta le sigue diciendo
      // «desde $258» a quien está por comprar.
      precioDesde: derivado({
        seccion: 'productos',
        etiqueta: 'Precio desde',
        ayuda: 'Sale solo del precio más bajo de las bolsas de gotas. No se edita aquí.',
        saleDe: 'el precio más bajo de las bolsas de gotas',
      }),
      // NO viaja al JSON: lo calcula la fachada a partir del precio de la
      // bolsa de jengibre y naranja, que cuesta distinto de las demás.
      precioJengibre: derivado({
        seccion: 'productos',
        etiqueta: 'Precio de la bolsa de jengibre y naranja',
        ayuda: 'Sale solo del precio de esa bolsa. No se edita aquí.',
        saleDe: 'el precio de la bolsa de jengibre y naranja',
      }),
      desdeEtiqueta: texto({
        ...enProductos,
        etiqueta: 'Palabra antes del precio',
        ayuda: 'La palabra chiquita antes del precio: «desde $258».',
        maxCaracteres: 20,
      }),
      cuerpo: parrafo({
        ...enProductos,
        etiqueta: 'Texto de las gotas',
        ayuda: 'El párrafo de la tarjeta de las bolsas.',
        maxCaracteres: 150,
      }),
      // Cuenta la lista de GOTAS pero dice «sabores»: «6 sabores» habla de
      // cuántos sabores hay en bolsa, y esa cantidad sale de la lista de
      // gotas, no de la de barras.
      sabores: texto({
        ...enProductos,
        etiqueta: 'Cuántos sabores hay en gotas',
        ayuda: 'La cápsula que dice cuántos sabores hay en bolsa.',
        maxCaracteres: 20,
        cuenta: { de: 'gotas', sustantivo: 'sabores' },
      }),
      notaPrecio: texto({
        ...enProductos,
        etiqueta: 'Sabor del precio distinto',
        ayuda: 'El nombre del sabor que cuesta distinto, al lado de su precio.',
        maxCaracteres: 30,
      }),
    },
  }),

  polvoCard: grupo({
    ...enProductos,
    etiqueta: 'Tarjeta de chocolate en polvo',
    ayuda: 'La tarjeta chica que anticipa el chocolate en polvo.',
    campos: {
      // El título de la tarjeta chica. Lleva el espacio duro entre la
      // cifra y la unidad, igual que `anaquel.pesoInsignia`.
      titulo: medida({
        ...enProductos,
        etiqueta: 'Título de la tarjeta de polvo',
        ayuda: 'El título de la tarjeta chica del chocolate en polvo.',
        maxCaracteres: 30,
        falla: ['nowrap'],
      }),
      chip: texto({
        ...enProductos,
        etiqueta: 'Cápsula de la tarjeta',
        ayuda: 'La cápsula amarilla que avisa que todavía no está a la venta.',
        maxCaracteres: 20,
      }),
      cuerpo: parrafo({
        ...enProductos,
        etiqueta: 'Texto de la tarjeta de polvo',
        ayuda: 'El párrafo de la tarjeta chica.',
        maxCaracteres: 100,
      }),
    },
  }),

  polvo: grupo({
    ...enProductos,
    etiqueta: 'Chocolate en polvo',
    ayuda: 'El bloque grande del chocolate en polvo, con sus variedades.',
    campos: {
      kicker: texto({
        ...enProductos,
        etiqueta: 'Antetítulo del bloque de polvo',
        ayuda: 'La línea en versales arriba de «Chocolate para beber».',
        maxCaracteres: 20,
      }),
      chip: texto({
        ...enProductos,
        etiqueta: 'Cápsula del bloque',
        ayuda: 'La cápsula amarilla del bloque grande de polvo.',
        maxCaracteres: 20,
      }),
      titulo: texto({
        ...enProductos,
        etiqueta: 'Título del bloque de polvo',
        ayuda: 'El título grande: «Chocolate para beber».',
        maxCaracteres: 40,
      }),
      // El párrafo dice CUÁNTAS variedades hay («Ocho variedades…», en
      // letras): si la clienta agrega o quita una variedad y no toca este
      // texto, el sitio miente.
      cuerpo: parrafo({
        ...enProductos,
        etiqueta: 'Texto del bloque de polvo',
        ayuda: 'El párrafo del bloque. Dice cuántas variedades hay.',
        maxCaracteres: 120,
        cuenta: { de: 'polvo', sustantivo: 'variedades' },
      }),
      // Se le agrega el nombre de la variedad: vive adentro de un `alt`,
      // sin nada geométrico que medir.
      altPrefijo: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción de las etiquetas',
        ayuda: 'Cómo empieza la descripción de cada etiqueta para quien no la ve. Se le agrega el nombre de la variedad.',
        maxCaracteres: 60,
        enAtributo: 'alt',
        falla: ['ninguno'],
      }),
    },
  }),
}
