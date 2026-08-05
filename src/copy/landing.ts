// Copy de la presentación de identidad (src/pages/index.astro y
// src/components/landing/*). Misma regla que marca.ts: ningún string
// visible dentro de un componente. Registro es-MX — "pistaches",
// "empaque", "plumón", "chueca".
//
// Retro de Marcos (2026-08-05), guardada como test en landing.test.ts:
// — El personaje no se llama "mono" en el copy visible.
// — Nada de contenido de negocio inventado; el único sabor real es el del
//   empaque. Sin ecommerce: la página que viene es informativa.
// — Tono personal y directo, como Marcos hablándole a su cliente. Nada de
//   floritura de copywriter: frases cortas, pocas rayas, cero tríadas
//   perfectas, cero metáforas apiladas ("voces", "sin letras chicas").
export const landing = {
  titulo: 'Maracacao — Presentación de identidad',
  skipLink: 'Ir al contenido',
  navManual: 'Manual de marca',

  hero: {
    overline: 'Presentación de identidad',
    titulo: 'Así quedó tu marca.',
    sub: 'Partimos de tu empaque y armamos todo lo demás: la mascota redibujada, los colores medidos y los logos para cada uso. Baja y velo andando.',
    ctaRecorrido: 'Ver la marca',
    ctaManual: 'Abrir el manual',
  },

  personaje: {
    overline: 'El personaje',
    titulo: 'Tu personaje, ahora se mueve',
    prosa:
      'Lo sacamos de tu empaque y lo redibujamos vector por vector, sin cambiarle el gesto ni el trazo de plumón. Quedó armado por capas (cabeza, cola, brazos, pistache) para poder animarlo.',
    fotoEtiqueta: 'Tu empaque original',
    fotoAlt:
      'Fotografía del empaque original de Maracacao: tableta envuelta en papel verde con el sello dibujado a mano',
    vectorEtiqueta: 'El redibujo',
    hintSaluda: 'Pásale el cursor: te saluda.',
    rasgos: ['Goloso', 'Ágil', 'Orgulloso', 'Hecho a mano'],
  },

  firmas: {
    overline: 'El sistema de logos',
    titulo: 'Siete versiones del logo',
    intro:
      'No hay que adivinar cuál va dónde: cada una tiene su tamaño y su fondo, y el manual lo deja por escrito.',
    // Mismo orden que la tabla §8 del spec de identidad. `banda` decide el
    // fondo del tile: las piezas con lettering crema solo viven en banda
    // oscura; el lockup de header, solo en banda clara (ver LockupHeader.astro).
    variantes: [
      { nombre: 'Sello completo', uso: 'Empaque, carteles y piezas grandes' },
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
    titulo: 'Los colores, medidos de tu empaque',
    prosa:
      'No inventamos nada: medimos los verdes, los cafés y el rosa de los cachetes directo de tu empaque. Todas las combinaciones de texto pasan las pruebas de contraste, para que se lean bien hasta en el teléfono.',
    tabletaCaption: 'Son 36 en total; estos son los 18 que más se usan. Sí, nos comimos un cuadrito.',
    tabletaAria: 'La paleta de color acomodada como tableta de chocolate, con un cuadrito mordido',
    rampas: [
      { clave: 'verde', etiqueta: 'Verde, el principal' },
      { clave: 'tan', etiqueta: 'Tan, para la ilustración' },
      { clave: 'rosa', etiqueta: 'Rosa, para los cachetes' },
    ],
    fijosEtiqueta: 'Los fijos: papel, crema, tinta, bordó, amarillo y suelo',
  },

  voces: {
    overline: 'La tipografía',
    titulo: 'Dos tipografías, cada una en lo suyo',
    frauncesNombre: 'Fraunces',
    frauncesRol:
      'Para títulos y nombres de sabor. Es variable: se puede poner más suave o más chueca, y eso también se anima. Mírala moverse aquí arriba.',
    workSansNombre: 'Work Sans',
    workSansRol: 'Para el texto de todos los días: párrafos, botones, etiquetas. Se lee bien incluso chiquita.',
    nota: 'Ojo: el logotipo MARACACAO no es una fuente. Está dibujado a mano, calcado de tu empaque.',
  },

  movimiento: {
    overline: 'El movimiento',
    titulo: 'Se mueve con calma',
    prosa:
      'Respira, parpadea y mueve la cola, sin prisa. Las reglas son pocas: todo se mueve en arcos, nunca más de dos cosas a la vez, y si tu teléfono pide menos movimiento, todo se queda quieto.',
    demoHint: 'Míralo respirar.',
    principios: ['Todo en arcos', 'La cola llega tardecito', 'Rebote suave'],
  },

  adelanto: {
    overline: 'Lo que viene',
    titulo: 'Un adelanto del sitio',
    prosa:
      'El siguiente paso es la página pública. Va a ser informativa, sin tienda por ahora: presentar la marca, los sabores y la historia. Aquí van dos muestras de cómo se vería.',
    chip: 'Vista previa',
    sabores: {
      titulo: 'Cada sabor, con su tableta',
      texto:
        'Cada tableta con su nombre. Por ahora la única real es la de tu empaque; las demás se suman cuando existan.',
      // Único sabor real: el del empaque original (§3 del spec: la foto es
      // la autoridad).
      items: [{ nombre: 'Chocolate blanco y pistaches', tono: 'blanco' }] as const,
    },
    origen: {
      titulo: 'De dónde viene',
      prosa:
        'Aquí va tu historia: de dónde viene el cacao y cómo lo trabajas. Ese texto lo pones tú; el diseño ya está listo.',
    },
  },

  // Cotización de Marcos (2026-08-05): su pago es 500 USD, el dominio va
  // aparte y se renueva. El hosting sí sale gratis: el sitio es estático
  // (astro build) y entra en el plan sin costo de cualquier hosting
  // estático. El rango del dominio es precio de mercado, estimado.
  inversion: {
    overline: 'La inversión',
    titulo: 'Lo que cuesta',
    prosa:
      'La página no necesita servidor de paga. Lo único que se renueva cada año es el dominio.',
    lineas: [
      {
        concepto: 'Diseño y desarrollo',
        detalle: 'Identidad completa, manual de marca y esta presentación. Pago único.',
        monto: '500 USD',
      },
      {
        concepto: 'Dominio',
        detalle: 'Lo contratas directo con el registrador; el precio depende del dominio que elijas.',
        monto: '10 a 30 USD al año',
      },
      {
        concepto: 'Publicación y hosting',
        detalle: 'Entra en el plan gratuito de cualquier hosting estático.',
        monto: 'Sin costo',
      },
    ],
    remate: 'Para arrancar: 500 USD y el dominio del primer año.',
    nota: 'Montos en dólares estadounidenses (USD).',
  },

  cierre: {
    overline: 'Ya está construido',
    titulo: 'Todo esto ya existe',
    prosa:
      'Nada de esta página es maqueta: los colores, los logos y las animaciones salen del sistema ya construido. En el manual queda todo documentado para quien lo necesite después, sea imprenta, redes o quien haga el sitio.',
    numeros: [
      { cifra: '7', concepto: 'versiones del logo' },
      { cifra: '36', concepto: 'colores medidos' },
      { cifra: '2', concepto: 'tipografías' },
      { cifra: '1', concepto: 'personaje con antojo' },
    ],
    ctaManual: 'Abrir el manual de marca',
    siguiente: 'Sigue: animar al personaje y armar la página pública.',
  },

  footer: {
    leyenda: 'Identidad Maracacao · Agosto de 2026',
    remate: 'Hecha a mano, como el chocolate.',
  },

  manualIndice: {
    volver: 'Volver a la presentación',
  },
} as const
