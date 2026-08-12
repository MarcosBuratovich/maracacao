// Copy del sitio público (src/pages/sitio.astro) y de la página en
// construcción (src/pages/index.astro). Reglas vigentes: registro es-MX,
// sin "mono"/"chango" (el personaje), sin carrito; los precios van como
// NÚMEROS y se formatean con precioMXN (pregunta 11: sí se muestran).
// Títulos CONCRETOS, sin juegos de palabras (retro de Marcos 2026-08-12:
// "es un centro de información concreto"). Los textos largos son del
// cliente (docs/respuestas-formulario.md), editados a voz de tú y con el
// bloque de beneficios suavizado por el tema COFEPRIS (sin claims de
// patologías ni prevención).
export const sitio = {
  titulo: 'Maracacao — Chocolate mexicano',
  skipLink: 'Ir al contenido',

  nav: {
    productos: 'Productos',
    abc: 'El ABC del chocolate',
    recetas: 'Recetas',
    quienes: 'Quiénes somos',
    negocios: 'Negocios',
    faq: 'Preguntas frecuentes',
    contacto: 'Contacto',
  },

  // Página en construcción — lo público mientras se termina el sitio.
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

  hero: {
    titulo: 'Chocolate mexicano, de verdad',
    sub: 'Solo cacao, esencias naturales y azúcar de caña. Sin químicos, saborizantes ni aditivos. Hecho en México, con cacao de Tabasco.',
    ctaSabores: 'Ver los productos',
    ctaCatalogo: 'Comprar en el catálogo',
    imagenAlt: 'El personaje de Maracacao batiendo chocolate con su molinillo',
  },

  productos: {
    titulo: 'Nuestros productos',
    intro: 'Todo parte de lo mismo: chocolate 70% cacao, para que el cacao sea siempre el protagonista.',
    // Las tres líneas, con los textos del cliente condensados.
    lineas: [
      {
        nombre: 'Barras 70% cacao',
        presentacion: 'Barras de 70 g',
        precioDesde: 108,
        bullets: [
          'El cacao al frente del sabor, con menos protagonismo del azúcar',
          'Frutas, hierbas y especias que hacen de cada barra una experiencia distinta',
          'Para comer despacio: catar, dejar fundir y disfrutar',
        ],
      },
      {
        nombre: 'Gotas de chocolate',
        presentacion: 'Bolsas de 250 g',
        precioDesde: 258,
        bullets: [
          'Chocolate 70% en porciones pequeñas, listas para usar',
          'Para galletas, brownies, coberturas, o fundir en taza y frappé',
          'Y para comer solitas, como botana',
        ],
      },
      {
        nombre: 'Chocolate en polvo',
        presentacion: 'Próximamente',
        bullets: [
          'Cocoa natural, cocoa alcalina y pasta de cacao: cacao de verdad',
          'Se integra fácil en bebidas calientes o frías',
          'También para licuados, repostería y postres',
        ],
      },
    ],
    saboresTitulo: 'Los 15 sabores de barra',
    // Sabores finales (formulario, pregunta 8: la de almendras no sale).
    barras: [
      'Naranja con jengibre', 'Chamoy', 'Mango con chile',
      'Chocolate blanco con pistache', 'Sal de mar', 'Limoncillo',
      'Tamarindo', 'Lima y chile', 'Cardamomo', 'Canela',
      'Menta intensa', 'Fresas enchiladas', 'Piña con chile',
      'Coriandro', 'Yerbabuena',
    ],
    destacadas: [
      { nombre: 'Chocolate blanco con pistache', tono: 'blanco', precio: 108 },
      { nombre: 'Sal de mar', tono: 'oscuro', precio: 108 },
      { nombre: 'Mango con chile', tono: 'leche', precio: 108 },
    ] as const,
    notaMinis: 'También hay minis de 10 gramos, en paquete de seis con sabores siempre distintos.',
    precioMinis: 118,
    tagline: 'Más cacao, ingredientes sencillos y muchas maneras de disfrutarlo.',
  },

  abc: {
    titulo: 'El ABC del chocolate',
    intro: 'Lo básico para elegir y disfrutar un buen chocolate, contado sin tecnicismos.',
    porcentaje: {
      titulo: '¿Qué significa 70% cacao?',
      cuerpo:
        'Es la parte de la barra que viene del cacao. Un chocolate 70% conserva una proporción importante de sus componentes naturales y tiene, en general, menos azúcar: se aprecian mejor sus sabores y aromas, sin que el azúcar sea el protagonista. No se trata de que el chocolate sea más oscuro: se trata de que haya más cacao en cada bocado.',
    },
    aditivos: {
      titulo: 'Por qué sin saborizantes ni aditivos',
      cuerpo:
        'Un buen chocolate no necesita esconderse detrás de una larga lista de ingredientes. Cuando el cacao es de calidad, su sabor, aroma y carácter hablan por sí mismos. Por eso preferimos recetas sencillas, con ingredientes reconocibles. Menos artificios. Más cacao. Más chocolate.',
    },
    beneficios: {
      titulo: 'Lo que aporta el cacao',
      cuerpo:
        'El cacao es una fuente natural de antioxidantes, gracias a sus flavonoides, y aporta minerales como magnesio, hierro y cobre. Contribuye al bienestar y al buen ánimo, y es una deliciosa fuente de energía.',
    },
    catar: {
      titulo: 'Cómo catar un chocolate',
      pasos: [
        { nombre: 'Mirar', texto: 'Aspecto uniforme y, si está bien templado, una superficie lisa y ligeramente brillante.' },
        { nombre: 'Escuchar', texto: 'Al partirlo debe dar un "snap" limpio y seco.' },
        { nombre: 'Oler', texto: 'Acércalo a la nariz: puede revelar aromas frutales, florales, tostados, especiados o de frutos secos.' },
        { nombre: 'Dejar que se funda', texto: 'Un trozo sobre la lengua, sin masticar: el calor de la boca libera la manteca de cacao y sus aromas.' },
        { nombre: 'Descubrir los sabores', texto: 'Observa qué aparece primero y qué viene después: acidez, dulzor, amargor, fruta, café, especias.' },
        { nombre: 'El final', texto: 'Después de tragarlo, el cacao deja una sensación larga, limpia y compleja, no solo dulzor.' },
      ],
    },
    cita: '"El buen chocolate no se come de prisa: se mira, se escucha, se huele y se deja fundir."',
  },

  recetas: {
    titulo: 'Recetas',
    intro: 'Cuatro maneras de llevar el chocolate de la barra a la mesa, con las gotas y el chocolate en polvo.',
    videoAria: 'El personaje de Maracacao batiendo chocolate en una taza con su molinillo',
    lista: [
      {
        titulo: 'Chocolate caliente con jengibre y naranja',
        porcion: 'Para 1 taza',
        ingredientes: ['250 ml de leche', '30 g de gotas de chocolate con jengibre y naranja', 'Un trocito de cáscara de naranja'],
        pasos: 'Calienta la leche sin hervir. Agrega las gotas y mueve hasta que se fundan. Deja la cáscara de naranja un minuto y retírala. Sirve caliente.',
        tip: 'Espuma la leche al final para hacerlo más cremoso.',
      },
      {
        titulo: 'Chocolate frío naranja-jengibre',
        porcion: 'Para 1 vaso',
        ingredientes: ['30 g de gotas de chocolate con jengibre y naranja', '50 ml de agua o leche caliente', '200 ml de leche fría', 'Hielo', 'Una rodaja de naranja'],
        pasos: 'Funde las gotas en el líquido caliente. Agrega la leche fría y mezcla bien. Sirve sobre mucho hielo y termina con la rodaja de naranja.',
        tip: 'Una pizquita de canela le queda espectacular.',
      },
      {
        titulo: 'Peras con chocolate y canela',
        porcion: 'Para 2 porciones',
        ingredientes: ['2 peras', '50 g de gotas de chocolate con canela', '2 cucharadas de agua o leche', 'Nueces o almendras picadas'],
        pasos: 'Corta las peras en gajos y dóralas ligeramente en un sartén. Funde las gotas con el agua o la leche y viértelas sobre las peras tibias. Termina con las nueces.',
        tip: 'Sírvelas con yogur griego o una bola de helado de vainilla.',
      },
      {
        titulo: 'Mousse rápida de chocolate con cardamomo',
        porcion: 'Para 4 porciones',
        ingredientes: ['80 g de chocolate en polvo con cardamomo', '200 ml de crema para batir bien fría', '100 g de yogur griego natural', 'Frutos rojos o naranja para decorar'],
        pasos: 'Bate la crema hasta que esté firme. Mezcla aparte el yogur con el chocolate en polvo. Incorpora la crema con suavidad y refrigera una hora.',
        tip: 'El cardamomo hace que un postre sencillísimo sepa mucho más sofisticado.',
      },
    ],
    etiquetaTip: 'Tip Maracacao:',
  },

  quienes: {
    titulo: 'Quiénes somos',
    prosa:
      'Maracacao nació en 2024, en una cocina, explorando combinaciones de frutas, chiles, hierbas y especias con chocolate de buen porcentaje de cacao. Somos un equipo que promueve el buen chocolate mexicano, con buenas prácticas ambientales y saborizado solo con ingredientes naturales.',
    origen:
      'Nuestro chocolate se elabora en Tabasco, la zona cacaotera más grande del país, a partir de cacao cuidadosamente seleccionado. El proceso pone especial atención en la fermentación y el manejo del grano, para lograr un sabor profundo, equilibrado y aromático.',
    imagenAlt: 'El personaje de Maracacao sentado y sonriendo',
  },

  negocios: {
    titulo: 'Para cafeterías y negocios',
    prosa:
      'Barras, gotas y chocolate en polvo para cafeterías, panaderías y repostería. Cada producto tiene su ficha técnica con la información completa para tu cocina.',
    fichasDatos: ['Ingredientes', 'Tabla nutrimental', 'Alérgenos', 'Vida de anaquel', 'Conservación', 'Presentaciones'],
    ctaFichas: 'Pedir fichas técnicas',
  },

  faq: {
    titulo: 'Preguntas frecuentes',
    intro: 'Lo que más nos preguntan sobre el chocolate.',
    items: [
      { p: '¿Qué significa realmente 70% cacao?', r: 'Es la parte de la barra que procede del cacao: pasta, manteca y sólidos. Más porcentaje significa más cacao y menos protagonismo del azúcar.' },
      { p: '¿Un buen chocolate sabe solamente amargo?', r: 'No. Puede tener notas naturalmente frutales, florales, tostadas, de nueces, especias, café o caramelo.' },
      { p: '¿Mientras más oscuro, más cacao?', r: 'No siempre. El color por sí solo no determina la calidad ni el porcentaje. Conviene mirar el porcentaje y, sobre todo, los ingredientes.' },
      { p: '¿Qué es ese "crack" al partir una barra?', r: 'El sonido habla de la estructura del chocolate y de un buen templado. En chocolates con alto contenido de cacao es especialmente claro.' },
      { p: '¿Por qué se derrite en la boca?', r: 'La manteca de cacao se funde cerca de la temperatura corporal. Por eso un buen chocolate cambia tanto cuando dejas de masticarlo y permites que se funda.' },
      { p: '¿Qué es la capa blanquecina que a veces aparece?', r: 'Se llama bloom y no significa que el chocolate esté echado a perder: suele deberse a cambios de temperatura o humedad que mueven la grasa o el azúcar.' },
      { p: '¿Cómo conservo mi chocolate?', r: 'En un lugar fresco, seco, sin sol y lejos de olores fuertes. El refrigerador generalmente no es su mejor amigo: le pegan la humedad y los olores.' },
      { p: '¿Qué diferencia hay entre cocoa natural y alcalina?', r: 'La natural tiene sabor intenso y ligeramente ácido; la alcalina es más oscura, con sabor más suave, redondo y profundo.' },
    ],
  },

  contacto: {
    titulo: 'Contacto',
    correo: 'maracacaomx@gmail.com',
    puntoVenta: 'Mercado de Coyoacán · Malintzin s/n, Col. del Carmen, Coyoacán, CDMX',
    catalogoNombre: 'Catálogo en línea',
    catalogoUrl: 'https://chocolateria.pulpos.shop',
  },

  footer: {
    leyenda: 'Maracacao · Chocolate mexicano',
    nota: 'Hecho en México · Cacao de Tabasco',
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
