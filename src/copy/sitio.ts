// Copy del BORRADOR del sitio público (src/pages/sitio.astro). Mismas
// reglas que landing.ts: registro es-MX, primera persona del singular en
// notas de trabajo, sin "mono" (el personaje es "el changuito" — así le
// dice el material del cliente — o "el personaje"), sin precios (pendiente
// pregunta 11) y sin contenido de negocio inventado: todo lo que no está
// confirmado en docs/contenido-sitio.md va marcado como pendiente con el
// número de pregunta del cuestionario.
export const sitio = {
  titulo: 'Maracacao — Borrador del sitio',
  skipLink: 'Ir al contenido',
  aviso: 'Borrador para revisar ideas. Lo marcado en amarillo falta que nos lo respondan.',
  pendiente: 'Pendiente',

  inicio: {
    titulo: 'Chocolate mexicano, de verdad',
    sub: 'Solo cacao, esencias naturales y azúcar de caña. Sin químicos, saborizantes ni aditivos.',
    ctaSabores: 'Ver los sabores',
    ctaCatalogo: 'Ir al catálogo',
  },

  productos: {
    overline: 'Nuestros productos',
    titulo: 'Dieciséis maneras de comer cacao',
    intro: 'Barras de 70 gramos con el cacao como protagonista, minis de 10 gramos para probar de todo, y bolsas de 250 gramos.',
    // Los 15 nombres del catálogo (docs/contenido-sitio.md). El sabor 16 y
    // el % de cacao por barra: pregunta 8.
    barras: [
      'Naranja con jengibre', 'Chamoy', 'Mango con chile',
      'Chocolate blanco con pistache', 'Sal de mar', 'Limoncillo',
      'Tamarindo', 'Lima y chile', 'Cardamomo', 'Canela',
      'Menta intensa', 'Fresas enchiladas', 'Piña con chile',
      'Coriandro', 'Yerbabuena',
    ],
    destacadas: [
      { nombre: 'Chocolate blanco con pistache', tono: 'blanco' },
      { nombre: 'Sal de mar', tono: 'oscuro' },
      { nombre: 'Mango con chile', tono: 'leche' },
    ] as const,
    notaBarras: 'Falta el porcentaje de cacao de cada barra y el sabor 16 (pregunta 8).',
    notaBolsas: 'Las bolsas de 250 g y la línea de polvos entran cuando nos confirmen qué son y cómo van (pregunta 10).',
  },

  abc: {
    overline: 'El ABC del chocolate',
    titulo: 'Para comerlo sabiendo',
    intro: 'La sección que enseña lo básico, sin ponerse técnica.',
    temas: [
      { titulo: '¿Qué dice el porcentaje?', nota: 'Texto pendiente (preguntas 5 y 6).' },
      { titulo: 'Cómo guardarlo', nota: 'Texto pendiente (preguntas 5 y 6).' },
      { titulo: 'Sin saborizantes ni aditivos', nota: 'Texto pendiente (preguntas 5 y 6).' },
    ],
  },

  recetas: {
    overline: 'Recetas',
    titulo: 'Qué hacer con él',
    intro: 'Del chocolate en taza a la repostería. El personaje del empaque acompaña la sección.',
    videoAria: 'El personaje de Maracacao batiendo chocolate en una taza con su molinillo',
    notaRecetas: 'Aquí van de 3 a 5 recetas suyas, con foto (pregunta 12).',
  },

  quienes: {
    overline: 'Quiénes somos',
    titulo: 'Regresar al sabor auténtico del cacao',
    // Palabras del cliente, del primer cuestionario (docs/contenido-sitio.md).
    prosa: 'Maracacao es una marca mexicana de chocolates y polvos elaborados con cacao y productos naturales. Busca regresar al sabor auténtico del cacao, con mezclas de sabores tradicionales, para consumidores y para cafeterías y negocios que valoran el chocolate mexicano auténtico.',
    imagenAlt: 'El personaje de Maracacao sentado y sonriendo',
    notaHistoria: 'La historia de cómo empezó y de dónde viene su cacao: preguntas 2, 3 y 4.',
  },

  negocios: {
    overline: 'Para cafeterías y negocios',
    titulo: 'El cacao también trabaja en tu cocina',
    prosa: 'Barras y presentaciones para cafeterías, panaderías y repostería, con fichas técnicas de cada producto.',
    ctaFichas: 'Pedir fichas técnicas',
    notaFichas: 'Qué datos llevan las fichas y si van públicas: preguntas 16, 17 y 15.',
  },

  faq: {
    overline: 'Preguntas frecuentes',
    titulo: 'Lo que siempre preguntan',
    nota: 'Las 5 a 8 preguntas reales vienen de la pregunta 18 del cuestionario.',
    ejemplos: ['¿Hacen envíos?', '¿Dónde los encuentro?', '¿Qué azúcar usan?'],
  },

  contacto: {
    overline: 'Contacto',
    titulo: 'Aquí nos encuentras',
    correo: 'chocolateriadulceolivia@gmail.com',
    catalogoNombre: 'Catálogo en línea',
    catalogoUrl: 'https://chocolateria.pulpos.shop',
    notaContacto: 'WhatsApp, redes y punto de venta: preguntas 19, 20 y 21.',
  },

  footer: {
    leyenda: 'Maracacao · Chocolate mexicano',
    nota: 'Borrador de trabajo · Agosto de 2026',
  },
} as const
