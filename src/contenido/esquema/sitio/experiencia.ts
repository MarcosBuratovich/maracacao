/*
 * Cómo catar el chocolate, las cuatro recetas del carrusel y la historia de
 * la marca: los tres bloques que van después del anaquel y las tarjetas de
 * producto.
 *
 * Este archivo exporta CLAVES, no un `grupo`, por la misma razón que
 * `cabecera.ts` y `producto.ts`: `catar`, `recetas` y `nosotros` son
 * bloques del mismo documento `marca`, y envolverlos en un `grupo` agregaría
 * un nivel de anidamiento que no existe en el contenido (`experiencia.catar.kicker`
 * en vez de `catar.kicker`).
 */
import { grupo, lista, tupla, texto, parrafo, claveSabor } from '../../campos'

const enCatar = { seccion: 'catar' } as const
const enRecetas = { seccion: 'recetas' } as const
const enNosotros = { seccion: 'nosotros' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDeExperiencia = {
  catar: grupo({
    ...enCatar,
    etiqueta: 'Cómo catar',
    ayuda: 'La sección que explica cómo catar el chocolate, paso por paso.',
    campos: {
      kicker: texto({
        ...enCatar,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 40,
      }),
      // El único conteo de este archivo: «Seis pasos para probarlo bien».
      titulo: texto({
        ...enCatar,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande. Dice cuántos pasos son.',
        maxCaracteres: 50,
        cuenta: { de: 'pasos', sustantivo: 'pasos' },
      }),
      pasos: lista({
        ...enCatar,
        etiqueta: 'Los pasos',
        ayuda: 'Los pasos para catar, en orden.',
        minItems: 1,
        maxItems: 12,
        elemento: grupo({
          ...enCatar,
          etiqueta: 'Paso',
          ayuda: 'Uno de los pasos para catar.',
          campos: {
            nombre: texto({
              ...enCatar,
              etiqueta: 'Nombre del paso',
              ayuda: 'La palabra en negrita al empezar el paso: «Mira», «Escucha».',
              maxCaracteres: 40,
            }),
            texto: parrafo({
              ...enCatar,
              etiqueta: 'Texto del paso',
              ayuda: 'Lo que explica el paso.',
              maxCaracteres: 180,
            }),
            clave: claveSabor({
              ...enCatar,
              etiqueta: 'Color del paso',
              ayuda: 'De aquí sale el color de fondo de la tarjeta de este paso.',
            }),
          },
        }),
      }),
      cita: parrafo({
        ...enCatar,
        etiqueta: 'Cita de la sección',
        ayuda: 'La frase destacada, en cursiva.',
        maxCaracteres: 140,
      }),
      porqueTitulo: texto({
        ...enCatar,
        etiqueta: 'Título de «¿Por qué 70% cacao?»',
        ayuda: 'El título del bloque que explica el porcentaje.',
        maxCaracteres: 40,
      }),
      porque: parrafo({
        ...enCatar,
        etiqueta: 'Texto de «¿Por qué 70% cacao?»',
        ayuda: 'El párrafo que explica el porcentaje.',
        maxCaracteres: 280,
      }),
      aporteTitulo: texto({
        ...enCatar,
        etiqueta: 'Título de «Lo que aporta el cacao»',
        ayuda: 'El título del bloque de propiedades.',
        maxCaracteres: 40,
      }),
      // El párrafo de propiedades del cacao pasó por el filtro de COFEPRIS: no
      // promete prevenir ni curar nada, y esa redacción es una decisión legal,
      // no de estilo. La ayuda no lo dice con esas palabras porque la clienta
      // no necesita el nombre del organismo para entender que no se toca a la
      // ligera — pero el comentario del código sí, para el que venga después.
      aporte: parrafo({
        ...enCatar,
        etiqueta: 'Texto de «Lo que aporta el cacao»',
        ayuda: 'El párrafo de propiedades. Está redactado para cumplir con las reglas de COFEPRIS.',
        maxCaracteres: 330,
      }),
    },
  }),

  recetas: grupo({
    ...enRecetas,
    etiqueta: 'Recetas',
    ayuda: 'El carrusel de recetas, con las gotas y el chocolate en polvo.',
    campos: {
      kicker: texto({
        ...enRecetas,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 20,
      }),
      titulo: texto({
        ...enRecetas,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «Qué hacer con ellas».',
        maxCaracteres: 40,
      }),
      deslizaNota: texto({
        ...enRecetas,
        etiqueta: 'Aviso de deslizar',
        ayuda: 'La línea chiquita que invita a deslizar el carrusel.',
        maxCaracteres: 20,
      }),
      verCompleta: texto({
        ...enRecetas,
        etiqueta: 'Botón de la receta',
        ayuda: 'El botón que abre la receta completa.',
        maxCaracteres: 40,
      }),
      etiquetaTip: texto({
        ...enRecetas,
        etiqueta: 'Etiqueta del consejo',
        ayuda: 'El título del recuadro del consejo, al final de cada receta.',
        maxCaracteres: 30,
      }),
      // Vive adentro de un `aria-label`, no en un nodo de texto: sin nada
      // geométrico que medir, así que va con sección accesibilidad y
      // `falla: ['ninguno']`.
      listaAria: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del carrusel',
        ayuda: 'Cómo describe el lector de pantalla el carrusel. No se ve en la página.',
        maxCaracteres: 40,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      lista: lista({
        ...enRecetas,
        etiqueta: 'Las recetas',
        ayuda: 'Las recetas del carrusel, en orden.',
        minItems: 1,
        maxItems: 12,
        elemento: grupo({
          ...enRecetas,
          etiqueta: 'Receta',
          ayuda: 'Una de las tarjetas del carrusel.',
          campos: {
            kicker: texto({
              ...enRecetas,
              etiqueta: 'Antetítulo de la receta',
              ayuda: 'La línea en versales: «CON GOTAS · 2 PORCIONES».',
              maxCaracteres: 40,
            }),
            titulo: texto({
              ...enRecetas,
              etiqueta: 'Nombre de la receta',
              ayuda: 'El título de la tarjeta.',
              maxCaracteres: 70,
            }),
            resumen: parrafo({
              ...enRecetas,
              etiqueta: 'Resumen de la receta',
              ayuda: 'El párrafo corto que se ve con la tarjeta cerrada.',
              maxCaracteres: 150,
            }),
            clave: claveSabor({
              ...enRecetas,
              etiqueta: 'Color de la receta',
              ayuda: 'De aquí salen el color de fondo y el de la letra de esta receta.',
            }),
            ingredientes: lista({
              ...enRecetas,
              etiqueta: 'Ingredientes',
              ayuda: 'Lo que hace falta, en orden.',
              minItems: 1,
              maxItems: 15,
              elemento: texto({
                ...enRecetas,
                etiqueta: 'Ingrediente',
                ayuda: 'Un renglón de la lista.',
                maxCaracteres: 80,
              }),
            }),
            pasos: parrafo({
              ...enRecetas,
              etiqueta: 'Preparación',
              ayuda: 'Cómo se hace, en un párrafo corrido.',
              maxCaracteres: 260,
            }),
            tip: parrafo({
              ...enRecetas,
              etiqueta: 'Consejo',
              ayuda: 'El consejo del recuadro al final de la receta.',
              maxCaracteres: 120,
            }),
            // ── El primer campo opcional del sistema ────────────────────
            //
            // Solo una de las cuatro recetas usa el polvo. Va `.optional()`,
            // y el registro del panel lo sigue encontrando: `desenvuelve()`
            // pela la envoltura y busca el metadato hacia adentro (por eso
            // `anota()` recibe siempre el esquema TERMINADO, antes de
            // envolverlo).
            //
            // LA TRAMPA, MEDIDA: index.astro:448 hace `{'chipPolvo' in r &&
            // …}`, que pregunta si la CLAVE existe, no si tiene contenido.
            // En zod 4.4.3, `.optional()` sobre `{chipPolvo: ''}` devuelve
            // el objeto CON la clave. Si el panel guardara '' al vaciar el
            // campo, se renderizaría `<p class="mono receta-chip"></p>`:
            // una cajita amarilla vacía de 6×10 px con 12 px de margen, y
            // como las cuatro tarjetas se estiran a la más alta, crecen las
            // cuatro.
            //
            // El arreglo de index.astro es de la FASE 2 (esta fase no toca
            // .astro). Lo que sí se clava acá es la forma que hoy lo hace
            // imposible: la clave NO existe en las tres recetas sin chip.
            chipPolvo: texto({
              ...enRecetas,
              etiqueta: 'Cápsula de polvo',
              ayuda: 'La cápsula amarilla que avisa que esta receta usa el chocolate en polvo, que todavía no está a la venta.',
              maxCaracteres: 50,
            }).optional(),
          },
        }),
      }),
    },
  }),

  nosotros: grupo({
    ...enNosotros,
    etiqueta: 'Nosotros',
    ayuda: 'La sección de la historia de la marca y el origen del cacao.',
    campos: {
      kicker: texto({
        ...enNosotros,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 20,
      }),
      titulo: texto({
        ...enNosotros,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «Empezó en una cocina».',
        maxCaracteres: 40,
      }),
      parrafos: lista({
        ...enNosotros,
        etiqueta: 'Párrafos de la historia',
        ayuda: 'La historia de la marca, un párrafo por caja.',
        minItems: 1,
        maxItems: 6,
        elemento: parrafo({
          ...enNosotros,
          etiqueta: 'Párrafo',
          ayuda: 'Uno de los párrafos de la historia.',
          maxCaracteres: 380,
        }),
      }),
      cacaoTitulo: texto({
        ...enNosotros,
        etiqueta: 'Título del recuadro del cacao',
        ayuda: 'El título chiquito del recuadro sobre el origen del cacao.',
        maxCaracteres: 20,
      }),
      cacao: parrafo({
        ...enNosotros,
        etiqueta: 'Texto del recuadro del cacao',
        ayuda: 'El párrafo sobre de dónde viene el cacao y cómo se trabaja.',
        maxCaracteres: 380,
      }),
      datos: tupla({
        ...enNosotros,
        etiqueta: 'Datos al pie',
        ayuda: 'Las dos líneas al pie de la sección. Son dos cajas fijas.',
        partes: [
          texto({
            ...enNosotros,
            etiqueta: 'Dónde estamos',
            ayuda: 'La primera de las dos líneas al pie.',
            maxCaracteres: 50,
          }),
          texto({
            ...enNosotros,
            etiqueta: 'Desde cuándo',
            ayuda: 'La segunda de las dos líneas al pie.',
            maxCaracteres: 50,
          }),
        ],
      }),
      // Vive adentro de un `alt`, sin nada geométrico que medir.
      personajeAlt: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del personaje',
        ayuda: 'Cómo se describe el dibujo para quien no lo ve. No se ve en la página.',
        maxCaracteres: 80,
        enAtributo: 'alt',
        falla: ['ninguno'],
      }),
    },
  }),
}
