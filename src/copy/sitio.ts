// Copy del BORRADOR del sitio público (src/pages/sitio.astro) y de la
// página en construcción (src/pages/index.astro). Mismas reglas que
// landing.ts: registro es-MX, sin "mono"/"chango" (el personaje), sin
// carrito. Los precios van como NÚMEROS y se formatean con precioMXN
// (pregunta 11 del formulario: sí se muestran). Todo el contenido sale
// de docs/contenido-sitio.md y docs/respuestas-formulario.md (palabras
// del cliente); lo aún pendiente va marcado con su número de pregunta.
export const sitio = {
  titulo: 'Maracacao — Borrador del sitio',
  skipLink: 'Ir al contenido',
  aviso: 'Borrador para revisar ideas. Lo marcado en amarillo falta que nos lo respondan.',
  pendiente: 'Pendiente',

  // Página en construcción — lo único público "de verdad" mientras el
  // dominio apunta acá (decisión de Marcos, 2026-08-12).
  construccion: {
    titulo: 'Maracacao — Muy pronto',
    overline: 'Chocolate mexicano',
    encabezado: 'Estamos poniendo la mesa',
    sub: 'La página de Maracacao está en construcción. Mientras tanto, el catálogo está abierto y el chocolate, disponible.',
    ctaCatalogo: 'Ver el catálogo',
    ctaCorreo: 'Escríbenos',
    videoAria: 'El personaje de Maracacao batiendo chocolate con su molinillo',
    logoAlt: 'Logotipo de Maracacao: la huella de una mano dentro de un círculo, con la palma formada por granos de cacao',
    lugar: 'Encuéntranos en el Mercado de Coyoacán',
    muyPronto: 'Muy pronto',
  },

  inicio: {
    titulo: 'Chocolate mexicano, de verdad',
    sub: 'Solo cacao, esencias naturales y azúcar de caña. Sin químicos, saborizantes ni aditivos.',
    ctaSabores: 'Ver los sabores',
    ctaCatalogo: 'Ir al catálogo',
  },

  productos: {
    overline: 'Nuestros productos',
    titulo: 'Quince maneras de comer cacao',
    // Del formulario: todos 70% cacao, minis solo en paquete sorpresa de
    // seis, y las bolsas de 250 g son gotas de chocolate.
    intro: 'Barras de 70% cacao para que el chocolate sea siempre el protagonista. Minis de 10 gramos en paquetes de seis, con sabores siempre distintos. Y gotas de chocolate en bolsas de 250 gramos: para comer como botana, fundir en una taza o preparar un frappé.',
    // Los 15 sabores finales (la de almendras no sale — formulario, pregunta 8).
    barras: [
      'Naranja con jengibre', 'Chamoy', 'Mango con chile',
      'Chocolate blanco con pistache', 'Sal de mar', 'Limoncillo',
      'Tamarindo', 'Lima y chile', 'Cardamomo', 'Canela',
      'Menta intensa', 'Fresas enchiladas', 'Piña con chile',
      'Coriandro', 'Yerbabuena',
    ],
    // Precios del catálogo (pregunta 11: sí se muestran).
    destacadas: [
      { nombre: 'Chocolate blanco con pistache', tono: 'blanco', precio: 108 },
      { nombre: 'Sal de mar', tono: 'oscuro', precio: 108 },
      { nombre: 'Mango con chile', tono: 'leche', precio: 108 },
    ] as const,
  },

  abc: {
    overline: 'El ABC del chocolate',
    titulo: 'Para comerlo sabiendo',
    intro: 'La sección que enseña lo básico, sin ponerse técnica. Los textos ya están escritos por Maracacao; aquí va la probada.',
    // Los 4 temas que marcaron en el formulario, con sus textos listos
    // (docs/respuestas-formulario.md). La nota del beneficio pasa por el
    // filtro COFEPRIS al redactar la versión final.
    temas: [
      { titulo: '¿Qué dice el porcentaje?', nota: 'Texto del cliente listo; en maquetación.' },
      { titulo: 'Cómo catar un chocolate', nota: 'Los seis pasos, listos; en maquetación.' },
      { titulo: 'Sin saborizantes ni aditivos', nota: 'Texto del cliente listo; en maquetación.' },
      { titulo: 'Los beneficios del cacao', nota: 'Texto listo; se redacta con cuidado COFEPRIS.' },
    ],
    cita: '"El buen chocolate no se come de prisa: se mira, se escucha, se huele y se deja fundir."',
  },

  recetas: {
    overline: 'Recetas',
    titulo: 'Qué hacer con él',
    intro: 'Del chocolate en taza a la repostería. El personaje del empaque acompaña la sección.',
    videoAria: 'El personaje de Maracacao batiendo chocolate en una taza con su molinillo',
    // La primera de las cuatro recetas reales del formulario.
    destacada: {
      titulo: 'Chocolate caliente con jengibre y naranja',
      porcion: 'Para 1 taza',
      ingredientes: [
        '250 ml de leche',
        '30 g de gotas de chocolate con jengibre y naranja',
        'Un trocito de cáscara de naranja',
      ],
      pasos: 'Calienta la leche sin hervir. Agrega las gotas y mueve hasta que se fundan. Deja la cáscara de naranja un minuto y retírala. Sirve caliente.',
      tip: 'Tip Maracacao: espuma la leche al final para hacerlo más cremoso.',
    },
    notaRecetas: 'Hay cuatro recetas listas del cliente; entran todas en la versión final.',
  },

  quienes: {
    overline: 'Quiénes somos',
    titulo: 'Regresar al sabor auténtico del cacao',
    // Palabras del cliente (cuestionario 1 + formulario 2026-08-12).
    prosa: 'Maracacao nació en 2024, en una cocina, explorando combinaciones de frutas, chiles, hierbas y especias con chocolate de buen porcentaje de cacao. Somos un equipo que promueve el buen chocolate mexicano, con buenas prácticas ambientales y saborizado solo con ingredientes naturales. Nuestro chocolate se elabora en Tabasco, la zona cacaotera más grande del país, con especial cuidado en la fermentación y el manejo del grano.',
    imagenAlt: 'El personaje de Maracacao sentado y sonriendo',
  },

  negocios: {
    overline: 'Para cafeterías y negocios',
    titulo: 'El cacao también trabaja en tu cocina',
    prosa: 'Barras, gotas y chocolate en polvo para cafeterías, panaderías y repostería, con fichas técnicas de cada producto: ingredientes, tabla nutrimental, alérgenos, vida de anaquel y conservación.',
    ctaFichas: 'Pedir fichas técnicas',
    notaFichas: 'Los PDFs de las fichas están por terminarse; condiciones de mayoreo por confirmar (pregunta 15).',
  },

  faq: {
    overline: 'Preguntas frecuentes',
    titulo: 'Lo que siempre preguntan',
    nota: 'Preguntas confirmadas por el cliente; las respuestas se redactan con ellos (pregunta 18).',
    ejemplos: [
      '¿Hacen envíos?',
      '¿Dónde los encuentro?',
      '¿Qué azúcar usan?',
      '¿El chocolate aguanta el calor del envío?',
      '¿Hacen mayoreo?',
    ],
  },

  contacto: {
    overline: 'Contacto',
    titulo: 'Aquí nos encuentras',
    // Correo oficial confirmado en el formulario (2026-08-12).
    correo: 'maracacaomx@gmail.com',
    puntoVenta: 'Mercado de Coyoacán · Malintzin s/n, Col. del Carmen, Coyoacán, CDMX',
    catalogoNombre: 'Catálogo en línea',
    catalogoUrl: 'https://chocolateria.pulpos.shop',
    notaContacto: 'WhatsApp y redes: pendientes (pregunta 20).',
  },

  footer: {
    leyenda: 'Maracacao · Chocolate mexicano',
    nota: 'Borrador de trabajo · Agosto de 2026',
  },
} as const

/** Precio en pesos con el locale del sitio (pregunta 11: los precios van). */
export function precioMXN(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}
