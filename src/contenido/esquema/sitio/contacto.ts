/*
 * El final de la página: dónde encontrarnos, el correo, las redes, el
 * enlace a la tienda en línea y el formulario para escribir.
 *
 * Es el bloque más grande del documento — 46 campos entre las dos tablas
 * del brief — y el que la clienta más va a tocar, porque acá vive el
 * correo. Este archivo SÍ exporta un `grupo` (`camposDeContacto.contacto`)
 * y no claves sueltas como `cabecera.ts`, `producto.ts` y `experiencia.ts`:
 * en el contenido de hoy `contacto` y `contacto.formulario` ya son un solo
 * bloque anidado (`marca.contacto.formulario.titulo`), así que envolverlo
 * en `grupo` no agrega ningún nivel que no exista.
 */
import { grupo, tupla, texto, parrafo, url, correo, valorFijo } from '../../campos'

const enContacto = { seccion: 'contacto' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDeContacto = {
  contacto: grupo({
    ...enContacto,
    etiqueta: 'Contacto',
    ayuda: 'La sección del final de la página: dónde encontrarnos, el correo, las redes y el formulario para escribir.',
    campos: {
      kicker: texto({
        ...enContacto,
        etiqueta: 'Antetítulo de la sección',
        ayuda: 'La línea en versales arriba del título.',
        maxCaracteres: 20,
      }),
      titulo: texto({
        ...enContacto,
        etiqueta: 'Título de la sección',
        ayuda: 'El título grande: «Estamos en Coyoacán».',
        maxCaracteres: 40,
      }),
      puestoEtiqueta: texto({
        ...enContacto,
        etiqueta: 'Etiqueta del puesto',
        ayuda: 'La línea en versales sobre el nombre del mercado.',
        maxCaracteres: 30,
      }),
      puestoTitulo: tupla({
        ...enContacto,
        etiqueta: 'Nombre del puesto',
        ayuda: 'El nombre del mercado, en dos renglones. Son dos cajas fijas.',
        partes: [
          texto({
            ...enContacto,
            etiqueta: 'Primer renglón del nombre',
            ayuda: 'La primera mitad: «Mercado de».',
            maxCaracteres: 20,
          }),
          texto({
            ...enContacto,
            etiqueta: 'Segundo renglón del nombre',
            ayuda: 'La segunda mitad: «Coyoacán».',
            maxCaracteres: 20,
          }),
        ],
      }),
      direccion: tupla({
        ...enContacto,
        etiqueta: 'Dirección',
        ayuda: 'Las dos líneas de la dirección del puesto. Son dos cajas fijas.',
        partes: [
          texto({
            ...enContacto,
            etiqueta: 'Calle y colonia',
            ayuda: 'La primera línea de la dirección.',
            maxCaracteres: 50,
          }),
          texto({
            ...enContacto,
            etiqueta: 'Alcaldía, código postal y ciudad',
            ayuda: 'La segunda línea de la dirección.',
            maxCaracteres: 50,
          }),
        ],
      }),
      // ── La dirección que lee Google, no la que lee la persona ──────
      //
      // El JSON-LD (`PostalAddress`, src/seo/esquema.ts) necesita la
      // localidad, el estado y el código postal como VALORES SUELTOS, y
      // `direccion` de arriba no los tiene así: «Coyoacán» en
      // `puestoTitulo` es el nombre del MERCADO, no la alcaldía —coincide
      // con ella de pura casualidad—, y el CP y el estado viven adentro
      // de la segunda línea de `direccion` como texto libre («Coyoacán,
      // C.P. 04100, CDMX», con «CDMX» ≠ «Ciudad de México»). Sacarlos de
      // ahí con un regex es adivinar, y la clienta puede reescribir esa
      // línea mañana sin saber que algo más la está leyendo. Por eso son
      // TRES campos propios, con su propio candado más abajo
      // (`.superRefine()`) que avisa si esta línea y esos campos dejan
      // de decir lo mismo.
      direccionPostal: grupo({
        ...enContacto,
        etiqueta: 'Dirección para Google',
        ayuda: 'No se ve en la página: es la dirección que Google usa en la ficha del negocio y en los buscadores.',
        campos: {
          localidad: texto({
            ...enContacto,
            etiqueta: 'Localidad (para Google)',
            ayuda: 'No se ve en la página: es la localidad que Google muestra en la ficha del negocio. Si cambias la dirección del pie de página, cambia también esta.',
            maxCaracteres: 30,
          }),
          estado: texto({
            ...enContacto,
            etiqueta: 'Estado (para Google)',
            ayuda: 'No se ve en la página: es el estado que Google muestra en la ficha del negocio. Si cambias la dirección del pie de página, cambia también esta.',
            maxCaracteres: 30,
          }),
          codigoPostal: texto({
            ...enContacto,
            etiqueta: 'Código postal (para Google)',
            ayuda: 'No se ve en la página: es el código postal que Google muestra en la ficha del negocio. Si cambias la dirección del pie de página, cambia también este.',
            maxCaracteres: 5,
          }).refine((v) => /^\d{5}$/.test(v), 'El código postal va con 5 dígitos, por ejemplo 04100.'),
        },
      }),
      correoEtiqueta: texto({
        ...enContacto,
        etiqueta: 'Etiqueta del correo',
        ayuda: 'La línea en versales sobre el correo.',
        maxCaracteres: 20,
      }),
      // ── El correo, que vive en CUATRO lugares ───────────────────────
      //
      // Esta es la ruta CANÓNICA. `escribeTambien` declara las hermanas
      // que reciben el mismo valor: el pie del menú desplegado
      // (`nav.pie.1`, en cabecera.ts) y la sección Para negocios
      // (`negocios.correo`, en negocio.ts). La cuarta aparición está
      // adentro de la respuesta de una pregunta frecuente («Escríbenos a
      // maracacaomx@gmail.com…»), en medio de una oración, así que no
      // puede ser una ruta hermana — la cubre el candado de la Tarea 16,
      // que exige que todo correo escrito en el documento sea este mismo.
      //
      // `falla: ['ninguno']` porque el correo se renderiza PARTIDO —
      // {usuario}@<wbr />{dominio}, index.astro:748 — para que no rompa
      // el renglón en el celular. No hay un solo nodo que medir, y el
      // panel muestra vista previa textual en vez de decir «no pude
      // revisar».
      //
      // `enAtributo: 'data-copiar'` porque además viaja al atributo que
      // lee el botón de copiar (index.astro:674).
      correo: correo({
        ...enContacto,
        etiqueta: 'Correo de la marca',
        ayuda: 'El correo que se ve en la página y al que llegan los mensajes. Se escribe también en el menú y en la sección Para negocios.',
        escribeTambien: ['nav.pie.1', 'negocios.correo'],
        enAtributo: 'data-copiar',
        falla: ['ninguno'],
      }),
      correoNota: texto({
        ...enContacto,
        etiqueta: 'Nota del correo',
        ayuda: 'La línea chiquita bajo el correo: para qué escribir.',
        maxCaracteres: 60,
      }),
      copiar: texto({
        ...enContacto,
        etiqueta: 'Botón de copiar',
        ayuda: 'Lo que dice el botón antes de copiar el correo.',
        maxCaracteres: 30,
      }),
      copiado: texto({
        ...enContacto,
        etiqueta: 'Aviso de copiado',
        ayuda: 'Lo que dice el botón un momento después de copiar.',
        maxCaracteres: 20,
      }),
      redesEtiqueta: texto({
        ...enContacto,
        etiqueta: 'Etiqueta de redes',
        ayuda: 'La línea en versales sobre el nombre de usuario.',
        maxCaracteres: 20,
      }),
      redes: texto({
        ...enContacto,
        etiqueta: 'Nombre en redes',
        ayuda: 'El nombre de usuario de la marca en redes sociales.',
        maxCaracteres: 20,
      }),
      redesNota: texto({
        ...enContacto,
        etiqueta: 'Nota de redes',
        ayuda: 'La línea chiquita bajo el nombre de usuario.',
        maxCaracteres: 50,
      }),
      catalogoEtiqueta: texto({
        ...enContacto,
        etiqueta: 'Etiqueta del catálogo',
        ayuda: 'La línea en versales sobre el enlace a la tienda.',
        maxCaracteres: 30,
      }),
      catalogoNombre: texto({
        ...enContacto,
        etiqueta: 'Nombre del catálogo',
        ayuda: 'Cómo se lee el enlace a la tienda en línea.',
        maxCaracteres: 40,
      }),
      catalogoUrl: url({
        ...enContacto,
        etiqueta: 'Dirección del catálogo',
        ayuda: 'A dónde lleva el enlace de la tienda en línea.',
      }),
      catalogoNota: texto({
        ...enContacto,
        etiqueta: 'Nota del catálogo',
        ayuda: 'La línea chiquita bajo el enlace de la tienda.',
        maxCaracteres: 60,
      }),
      // El dibujo del personaje batiendo chocolate.
      personajeAlt: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción del personaje',
        ayuda: 'Cómo se describe el dibujo para quien no lo ve. No se ve en la página.',
        maxCaracteres: 100,
        enAtributo: 'alt',
        falla: ['ninguno'],
      }),

      formulario: grupo({
        ...enContacto,
        etiqueta: 'Formulario de contacto',
        ayuda: 'El recuadro para escribir un mensaje, al final de la sección Contacto.',
        campos: {
          titulo: texto({
            ...enContacto,
            etiqueta: 'Título del formulario',
            ayuda: 'El título del recuadro de escribir.',
            maxCaracteres: 20,
          }),
          nombre: texto({
            ...enContacto,
            etiqueta: 'Caja del nombre',
            ayuda: 'Lo que dice la caja donde la persona escribe su nombre.',
            maxCaracteres: 20,
          }),
          correo: texto({
            ...enContacto,
            etiqueta: 'Caja del correo',
            ayuda: 'Lo que dice la caja donde la persona escribe su correo.',
            maxCaracteres: 20,
          }),
          tipo: texto({
            ...enContacto,
            etiqueta: 'Pregunta del tipo de contacto',
            ayuda: 'La pregunta antes de las dos opciones.',
            maxCaracteres: 40,
          }),
          // Los dos valores del selector del formulario. La página los lee
          // para elegir entre `asuntoPersonal` y `asuntoNegocio`: si
          // cambian, el correo sale con el asunto equivocado y nada
          // avisa. Por eso son valores fijos y no texto libre.
          tipoOpciones: tupla({
            ...enContacto,
            etiqueta: 'Las dos opciones',
            ayuda: 'Compra personal o para un negocio. Son dos cajas fijas: la página elige el asunto del correo según cuál se marque.',
            partes: [
              grupo({
                ...enContacto,
                etiqueta: 'Primera opción del selector',
                ayuda: 'El nombre interno y el texto de la opción de compra personal, dentro del formulario.',
                campos: {
                  valor: valorFijo({
                    ...enContacto,
                    etiqueta: 'Nombre interno de la opción',
                    ayuda: 'Con este nombre la página elige el asunto del mensaje. No se cambia.',
                    valores: ['personal'],
                  }),
                  texto: texto({
                    ...enContacto,
                    etiqueta: 'Texto de la primera opción',
                    ayuda: 'Lo que se lee en la primera opción.',
                    maxCaracteres: 80,
                  }),
                },
              }),
              grupo({
                ...enContacto,
                etiqueta: 'Segunda opción del selector',
                ayuda: 'El nombre interno y el texto de la opción para un negocio, dentro del formulario.',
                campos: {
                  valor: valorFijo({
                    ...enContacto,
                    etiqueta: 'Nombre interno de la opción',
                    ayuda: 'Con este nombre la página elige el asunto del mensaje. No se cambia.',
                    valores: ['negocio'],
                  }),
                  texto: texto({
                    ...enContacto,
                    etiqueta: 'Texto de la segunda opción',
                    ayuda: 'Lo que se lee en la segunda opción.',
                    maxCaracteres: 80,
                  }),
                },
              }),
            ],
          }),
          mensaje: texto({
            ...enContacto,
            etiqueta: 'Caja del mensaje',
            ayuda: 'Lo que dice la caja donde la persona escribe su mensaje.',
            maxCaracteres: 20,
          }),
          mensajeEjemplo: texto({
            ...enContacto,
            etiqueta: 'Ejemplo del mensaje',
            ayuda: 'El texto gris de ejemplo dentro de la caja del mensaje.',
            maxCaracteres: 100,
          }),
          enviar: texto({
            ...enContacto,
            etiqueta: 'Botón de enviar',
            ayuda: 'Lo que dice el botón.',
            maxCaracteres: 30,
          }),
          enviando: texto({
            ...enContacto,
            etiqueta: 'Botón mientras envía',
            ayuda: 'Lo que dice el botón mientras se está mandando el mensaje.',
            maxCaracteres: 20,
          }),
          nota: texto({
            ...enContacto,
            etiqueta: 'Nota del formulario',
            ayuda: 'La línea chiquita bajo el botón.',
            maxCaracteres: 70,
          }),
          exitoTitulo: texto({
            ...enContacto,
            etiqueta: 'Título del aviso de enviado',
            ayuda: 'El título que aparece cuando el mensaje se mandó.',
            maxCaracteres: 30,
          }),
          exitoSub: texto({
            ...enContacto,
            etiqueta: 'Texto del aviso de enviado',
            ayuda: 'El párrafo que aparece cuando el mensaje se mandó.',
            maxCaracteres: 80,
          }),
          otraVez: texto({
            ...enContacto,
            etiqueta: 'Botón de escribir otra vez',
            ayuda: 'El botón que vuelve a abrir el formulario vacío.',
            maxCaracteres: 40,
          }),
          aviso: parrafo({
            ...enContacto,
            etiqueta: 'Aviso de que falló el envío',
            ayuda: 'Lo que se muestra si el mensaje no se pudo mandar y se abre la aplicación de correo.',
            maxCaracteres: 130,
          }),
          // El honeypot: invisible para humanos, irresistible para los
          // bots. Va `quien: 'marcos'` — es una defensa, no copy, y si la
          // clienta lo edita pensando que es un campo del formulario, lo
          // rompe sin enterarse.
          trampa: texto({
            ...enContacto,
            etiqueta: 'Caja trampa',
            ayuda: 'Una caja invisible para las personas y visible para los programas que mandan correo basura. Lo que diga aquí no lo lee nadie.',
            maxCaracteres: 40,
            quien: 'marcos',
            falla: ['ninguno'],
          }),
          asuntoPersonal: texto({
            ...enContacto,
            etiqueta: 'Asunto de una compra personal',
            ayuda: 'El asunto del correo cuando alguien escribe por una compra personal.',
            maxCaracteres: 70,
          }),
          asuntoNegocio: texto({
            ...enContacto,
            etiqueta: 'Asunto de un negocio',
            ayuda: 'El asunto del correo cuando alguien escribe por su negocio.',
            maxCaracteres: 60,
          }),
        },
      }),
    },
  }).superRefine((v, ctx) => {
    // El candado cruzado: `direccion[1]` («Coyoacán, C.P. 04100, CDMX») y
    // `direccionPostal` cuentan la MISMA dirección en dos formas — si se
    // desalinean, el pie de página y la ficha de Google dicen cosas
    // distintas y nadie se entera hasta que alguien busca el puesto y no
    // lo encuentra donde el sitio dice. `.includes()` y no un regex: la
    // pregunta es «¿la segunda línea SIGUE mencionando esto?», no «¿tiene
    // esta forma exacta?» — así la clienta puede reordenar o puntuar esa
    // línea distinto sin que el candado se dispare en falso.
    //
    // Verificado contra zod 4.4.3 (con el mismo patrón que
    // `saborConContraste` en sabores.ts): `.superRefine()` sobre un objeto
    // conserva `def.type === 'object'`, así que `recorre()` y `serializa()`
    // lo siguen atravesando, y el problema se reporta en el campo nuevo
    // —`direccionPostal.codigoPostal` o `.localidad`—, que es el que la
    // clienta tendría que revisar.
    const segundaLinea = v.direccion[1]
    if (!segundaLinea.includes(v.direccionPostal.codigoPostal)) {
      ctx.addIssue({
        code: 'custom',
        path: ['direccionPostal', 'codigoPostal'],
        message: 'Este código postal no aparece en la segunda línea de la dirección de arriba («Alcaldía, código postal y ciudad»): revisa que las dos digan lo mismo.',
      })
    }
    if (!segundaLinea.includes(v.direccionPostal.localidad)) {
      ctx.addIssue({
        code: 'custom',
        path: ['direccionPostal', 'localidad'],
        message: 'Esta localidad no aparece en la segunda línea de la dirección de arriba («Alcaldía, código postal y ciudad»): revisa que las dos digan lo mismo.',
      })
    }
  }),
}
