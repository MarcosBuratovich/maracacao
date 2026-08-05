// Copy de la presentación de identidad (src/pages/index.astro y
// src/components/landing/*). Misma regla que marca.ts: ningún string
// visible dentro de un componente. Registro es-MX — "pistaches",
// "empaque", "plumón" — voz de la marca: golosa, ágil, orgullosa, sin
// folklore (§12 del spec de identidad).
//
// Retro de Marcos (2026-08-05), guardada como test en landing.test.ts:
// — El personaje no se llama "mono" en el copy visible.
// — Nada de contenido de negocio inventado: ni sabores que no existan en
//   el empaque, ni precios, ni datos de origen. Lo que se presenta es lo
//   que está en el manual de marca.
// — El sitio que viene es una landing informativa, no un ecommerce.
export const landing = {
  titulo: 'Maracacao — Presentación de identidad',
  skipLink: 'Ir al contenido',
  navManual: 'Manual de marca',

  hero: {
    overline: 'Presentación de identidad',
    titulo: 'El chocolate ya estaba listo. Ahora la marca también.',
    sub: 'Una mascota con antojo, los colores medidos de tu empaque y una familia de logos que trabaja a cualquier tamaño: esta es la identidad de Maracacao.',
    ctaRecorrido: 'Recorrer la identidad',
    ctaManual: 'Abrir el manual de marca',
  },

  personaje: {
    overline: 'El personaje',
    titulo: 'El personaje del empaque, ahora vivo',
    prosa:
      'Nació dibujado en tu empaque y lo redibujamos vector por vector: mismo gesto, mismos granos de cacao, mismas ganas de chocolate. Hoy es un personaje por capas — cabeza, cola, brazos, pistache — listo para animarse sin perder el trazo de plumón.',
    fotoEtiqueta: 'Tu empaque original',
    fotoAlt:
      'Fotografía del empaque original de Maracacao: tableta envuelta en papel verde con el sello dibujado a mano',
    vectorEtiqueta: 'El redibujo vectorial',
    hintSaluda: 'Pásale el cursor: te saluda.',
    rasgos: ['Goloso', 'Ágil', 'Orgulloso', 'Hecho a mano'],
  },

  firmas: {
    overline: 'El sistema de logos',
    titulo: 'Siete formas de firmar',
    intro:
      'Del empaque al favicon: cada variante tiene su tamaño, su fondo y su momento. Ninguna se improvisa.',
    // Mismo orden que la tabla §8 del spec de identidad. `banda` decide el
    // fondo del tile: las piezas con lettering crema solo viven en banda
    // oscura; el lockup de header, solo en banda clara (ver LockupHeader.astro).
    variantes: [
      { nombre: 'Sello completo', uso: 'Empaque, carteles y momentos grandes' },
      { nombre: 'Sello reducido', uso: 'Piezas medianas, sin descriptor' },
      { nombre: 'Logotipo', uso: 'Firma, pie de página y papelería' },
      { nombre: 'Isotipo', uso: 'Stickers e ilustración de apoyo' },
      { nombre: 'Sello circular', uso: 'Favicon y perfil de redes' },
      { nombre: 'Monocromo', uso: 'Grabados, sellos y una sola tinta' },
      { nombre: 'Lockup de header', uso: 'La barra del sitio, correos y membretes' },
    ],
  },

  paleta: {
    overline: 'El color',
    titulo: 'Una paleta medida, no inventada',
    prosa:
      'Los colores salen de tu empaque: los verdes, los tonos de chocolate y el rosa que le da vida a la cara del personaje. Cada combinación de texto pasó las pruebas de contraste — se lee bien en pantalla chica, con sol y sin lentes.',
    tabletaCaption: 'De los 36 colores del sistema, los 18 que más se ven. Nos comimos un cuadrito.',
    tabletaAria: 'La paleta de color acomodada como tableta de chocolate, con un cuadrito mordido',
    rampas: [
      { clave: 'verde', etiqueta: 'Verde — la voz principal' },
      { clave: 'tan', etiqueta: 'Tan — la ilustración' },
      { clave: 'rosa', etiqueta: 'Rosa — los cachetes' },
    ],
    fijosEtiqueta: 'Los fijos — papel, crema, tinta, bordó, amarillo y suelo',
  },

  voces: {
    overline: 'La tipografía',
    titulo: 'Dos voces que se llevan bien',
    frauncesNombre: 'Fraunces',
    frauncesRol:
      'La voz de los antojos: títulos y nombres de sabor. Es variable — puede ponerse más suave o más traviesa, y eso también se anima.',
    workSansNombre: 'Work Sans',
    workSansRol: 'La voz que acompaña: cuerpo, botones y etiquetas. Clara a cualquier tamaño.',
    nota: 'El logotipo MARACACAO no es tipografía: es lettering dibujado a mano, calcado de tu empaque.',
  },

  movimiento: {
    overline: 'El movimiento',
    titulo: 'Se mueve con calma',
    prosa:
      'Respira, parpadea y mueve la cola como quien no tiene prisa. Nada viaja en línea recta — todo describe un arco — y nunca se mueven más de dos cosas a la vez. Si tu teléfono pide menos movimiento, el personaje se queda quieto y la página no pierde nada.',
    demoHint: 'Este de aquí ya está vivo — míralo respirar.',
    principios: ['Arcos, nunca rectas', 'Peso: la cola llega tarde', 'Spring suave por defecto'],
  },

  adelanto: {
    overline: 'Lo que viene',
    titulo: 'Un adelanto del sitio',
    prosa:
      'Así se va a sentir el sitio: bandas que alternan como las caras de tu empaque y la información al centro. Una landing informativa por ahora — sin tienda — para presentar la marca, sus sabores y su historia.',
    chip: 'Vista previa',
    sabores: {
      titulo: 'Cada sabor, con su tableta',
      texto:
        'La sección de sabores presenta cada tableta con su nombre, empezando por la que ya existe en tu empaque.',
      // Único sabor real: el del empaque original (§3 del spec: la foto es
      // la autoridad). Los demás se suman cuando existan.
      items: [{ nombre: 'Chocolate blanco y pistaches', tono: 'blanco' }] as const,
    },
    origen: {
      titulo: 'De dónde viene',
      prosa:
        'La sección de origen cuenta la historia del cacao y de cómo se vuelve tableta, con la voz de la marca. El contenido lo pone Maracacao; la identidad ya sabe contarlo.',
    },
  },

  // Cotización de Marcos (2026-08-05): su pago es 500 USD, el dominio va
  // aparte y se renueva. El hosting es real que sale gratis: el sitio es
  // estático (astro build) y entra en el plan sin costo de cualquier
  // hosting estático. El rango del dominio es precio de mercado, marcado
  // como estimado — no un dato inventado del negocio.
  inversion: {
    overline: 'La inversión',
    titulo: 'Números claros, sin letras chicas',
    prosa:
      'El sitio es estático: se publica sin pagar servidor. Lo único que se renueva cada año es el dominio.',
    lineas: [
      {
        concepto: 'Diseño y desarrollo',
        detalle: 'Identidad completa, manual de marca y esta presentación — pago único',
        monto: '500 USD',
      },
      {
        concepto: 'Dominio',
        detalle: 'Se contrata directo con el registrador y se renueva cada año (estimado)',
        monto: '10 a 30 USD al año',
      },
      {
        concepto: 'Publicación y hosting',
        detalle: 'La página es estática: entra en el plan sin costo del hosting',
        monto: 'Incluido',
      },
    ],
    remate: 'Para arrancar: 500 USD y el dominio del primer año.',
    nota: 'Montos en dólares estadounidenses (USD).',
  },

  cierre: {
    overline: 'Ya está construido',
    titulo: 'Todo esto ya existe',
    prosa:
      'No son maquetas: cada color, logo y animación de esta página sale del sistema real de la marca. El manual de marca vive en este mismo sitio y se actualiza solo — lo que ves es lo que hay.',
    numeros: [
      { cifra: '7', concepto: 'variantes de logo' },
      { cifra: '36', concepto: 'colores medidos' },
      { cifra: '2', concepto: 'familias tipográficas' },
      { cifra: '1', concepto: 'personaje con antojo' },
    ],
    ctaManual: 'Explorar el manual de marca',
    siguiente: 'Lo que sigue: darle cuerda al personaje en Rive y construir la landing informativa.',
  },

  footer: {
    leyenda: 'Identidad Maracacao · Agosto de 2026',
    remate: 'Hecha a mano, como el chocolate.',
  },

  manualIndice: {
    volver: 'Volver a la presentación',
  },
} as const
