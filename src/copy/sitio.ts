// Copy del sitio público (src/pages/sitio.astro) y de la página en
// construcción (src/pages/index.astro).
//
// Reglas vigentes: registro es-MX; el personaje nunca se llama "mono";
// sin carrito; títulos concretos, sin juegos de palabras; los precios
// van como NÚMEROS y los formatea `precioMXN`. Los textos largos son
// del cliente (docs/respuestas-formulario.md), editados a voz de tú,
// con el bloque de beneficios en versión suavizada por COFEPRIS.
//
// `tono` en los sabores no es decoración: es el ÍNDICE de la familia de
// sabor, con los colores medidos de las etiquetas reales (tokens
// `etiqueta`). El color es dato, no fondo de sección.
export const sitio = {
  titulo: 'Maracacao — Chocolate mexicano',
  skipLink: 'Ir al contenido',

  marca: {
    nombre: 'Maracacao',
    wordmark: 'MARACACAO',
    descriptor: 'Chocolate mexicano',
    selloAlt: 'Sello de Maracacao: la huella de una mano dentro de un círculo, con la palma formada por granos de cacao',
  },

  nav: {
    productos: 'Productos',
    abc: 'El ABC',
    recetas: 'Recetas',
    quienes: 'Quiénes somos',
    negocios: 'Negocios',
    contacto: 'Contacto',
  },

  cursor: {
    ver: 'Ver',
    abrir: 'Abrir',
    escribir: 'Escribir',
    leer: 'Leer',
  },

  hero: {
    lugar: 'Coyoacán, Ciudad de México',
    cacao: '70% cacao',
    hecho: 'Hecho a mano',
    tiraAria: 'Barras de Maracacao del catálogo',
    // Fotos reales del catálogo (chocolateria.pulpos.shop), recortadas
    // al vertical de la barra. El hero no lo llena una decoración: lo
    // llena el producto.
    // Curada: quedan fuera las fotos del catálogo que muestran barras de
    // Dulce Olivia (la otra marca de la casa) — en el hero de Maracacao
    // solo va empaque de Maracacao.
    tira: [
      { archivo: 'naranja-jengibre', nombre: 'Naranja con jengibre' },
      { archivo: 'mango-chile', nombre: 'Mango con chile' },
      { archivo: 'limoncillo', nombre: 'Limoncillo' },
      { archivo: 'sal-de-mar', nombre: 'Sal de mar' },
      { archivo: 'canela', nombre: 'Canela' },
      { archivo: 'lima-chile', nombre: 'Lima y chile' },
      { archivo: 'tamarindo', nombre: 'Tamarindo' },
      { archivo: 'paquete-seis', nombre: 'Paquete de seis minis' },
      { archivo: 'blanco-pistache', nombre: 'Chocolate blanco con pistache' },
      { archivo: 'chamoy', nombre: 'Chamoy' },
      { archivo: 'yerbabuena', nombre: 'Yerbabuena' },
      { archivo: 'fresas-enchiladas', nombre: 'Fresas enchiladas' },
      { archivo: 'gotas', nombre: 'Gotas de chocolate' },
    ] as const,
  },

  manifiesto: {
    marca: 'La marca',
    frase: 'Solo cacao, esencias naturales y azúcar de caña.',
    cuerpo:
      'Sin químicos, sin saborizantes, sin aditivos. Cada barra lleva 70% de cacao para que el cacao sea el que hable, acompañado de frutas, chiles, hierbas y especias que cambian por completo lo que esperas de un chocolate.',
    notaMargen: ['Cacao de Tabasco', 'Desde 2024'],
  },

  productos: {
    titulo: 'Nuestros productos',
    intro: 'Tres formas del mismo chocolate: para comer despacio, para cocinar y para beber.',
    notaMargen: ['Barras 70 g', 'Gotas 250 g', 'Polvo 250 g'],
    lineas: [
      {
        nombre: 'Barras',
        presentacion: '70 gramos · 70% cacao',
        precioDesde: 108,
        campo: 'morado',
        imagen: 'linea-barras',
        imagenAlt: 'Barra Maracacao de mango con chile sobre una mesa de madera, con granos de cacao alrededor',
        bullets: [
          'El cacao al frente del sabor, con menos protagonismo del azúcar',
          'Frutas, hierbas y especias: cada barra es una experiencia distinta',
          'Para comer despacio: catar, dejar fundir y disfrutar',
        ],
      },
      {
        nombre: 'Gotas de chocolate',
        presentacion: '250 gramos · 70% cacao',
        precioDesde: 258,
        campo: 'cacao',
        imagen: 'linea-gotas',
        imagenAlt: 'Bolsa de 250 gramos de gotas de chocolate Maracacao',
        bullets: [
          'Porciones de unos 10 gramos, listas para usar',
          'Para galletas, brownies y coberturas, o para fundir en taza y frappé',
          'Y para comer solas, como botana',
        ],
      },
      {
        nombre: 'Chocolate en polvo',
        presentacion: '250 gramos · Próximamente',
        campo: 'petroleo',
        imagen: 'linea-polvo',
        imagenAlt: 'Etiqueta del chocolate en polvo de cardamomo',
        bullets: [
          'Cocoa natural, cocoa alcalina y pasta de cacao',
          'Se integra fácil en bebidas calientes o frías',
          'También para licuados, repostería y postres',
        ],
      },
    ],
    fotos: [
      {
        archivo: 'foto-barra-naranja-jengibre',
        nombre: 'Naranja con jengibre',
        alt: 'Barra Maracacao de naranja con jengibre en su envoltura morada, rodeada de naranjas',
        precio: 122,
      },
      {
        archivo: 'foto-barra-mango-chile',
        nombre: 'Mango con chile',
        alt: 'Barra Maracacao de mango con chile en su envoltura roja, junto a mangos frescos',
        precio: 108,
      },
      {
        archivo: 'foto-minis',
        nombre: 'Paquete de seis minis',
        alt: 'Paquete de seis minis Maracacao de 10 gramos en envolturas de colores',
        precio: 118,
      },
    ] as const,
    indiceTitulo: 'Los quince sabores',
    indiceNota: 'Las minis de 10 gramos van en paquete de seis, con sabores siempre distintos.',
    // tono = familia de sabor (clave de los tokens `etiqueta`).
    barras: [
      { nombre: 'Naranja con jengibre', tono: 'morado' },
      { nombre: 'Canela', tono: 'carmin' },
      { nombre: 'Cardamomo', tono: 'petroleo' },
      { nombre: 'Coriandro', tono: 'petroleo' },
      { nombre: 'Menta intensa', tono: 'cielo' },
      { nombre: 'Yerbabuena', tono: 'cielo' },
      { nombre: 'Limoncillo', tono: 'menta' },
      { nombre: 'Mango con chile', tono: 'chile' },
      { nombre: 'Piña con chile', tono: 'chile' },
      { nombre: 'Lima y chile', tono: 'chile' },
      { nombre: 'Fresas enchiladas', tono: 'chile' },
      { nombre: 'Chamoy', tono: 'chile' },
      { nombre: 'Tamarindo', tono: 'chile' },
      { nombre: 'Sal de mar', tono: 'cacao' },
      { nombre: 'Chocolate blanco con pistache', tono: 'caramelo' },
    ] as const,
  },

  polvo: {
    titulo: 'La línea de chocolate en polvo',
    nota: 'Próximamente',
    intro: 'Ocho sabores para taza, hechos con cocoa natural, cocoa alcalina y pasta de cacao.',
    altPrefijo: 'Etiqueta del chocolate en polvo sabor',
    sabores: [
      { archivo: 'etiqueta-naranja-jengibre', campo: 'morado', nombre: 'Naranja y jengibre' },
      { archivo: 'etiqueta-canela', campo: 'carmin', nombre: 'Canela' },
      { archivo: 'etiqueta-limoncillo', campo: 'menta', nombre: 'Limoncillo' },
      { archivo: 'etiqueta-chile', campo: 'chile', nombre: 'Chile' },
      { archivo: 'etiqueta-menta', campo: 'cielo', nombre: 'Menta' },
      { archivo: 'etiqueta-cardamomo', campo: 'petroleo', nombre: 'Cardamomo' },
      { archivo: 'etiqueta-cocoa-natural', campo: 'caramelo', nombre: 'Cocoa natural' },
      { archivo: 'etiqueta-cocoa-alcalina', campo: 'cacao', nombre: 'Cocoa alcalina' },
    ] as const,
  },

  abc: {
    titulo: 'El ABC del chocolate',
    intro: 'Lo básico para elegir y disfrutar un buen chocolate, contado sin tecnicismos.',
    notaMargen: ['Porcentaje', 'Cata', 'Ingredientes'],
    bloques: [
      {
        titulo: '¿Qué significa 70% cacao?',
        cuerpo:
          'Es la parte de la barra que viene del cacao. Un chocolate 70% conserva una proporción importante de sus componentes naturales y tiene, en general, menos azúcar: se aprecian mejor sus sabores y aromas. No se trata de que el chocolate sea más oscuro, sino de que haya más cacao en cada bocado.',
      },
      {
        titulo: 'Por qué sin saborizantes ni aditivos',
        cuerpo:
          'Un buen chocolate no necesita esconderse detrás de una larga lista de ingredientes. Cuando el cacao es de calidad, su sabor y su aroma hablan por sí mismos. Por eso preferimos recetas sencillas, con ingredientes reconocibles. Menos artificios. Más cacao.',
      },
      {
        titulo: 'Lo que aporta el cacao',
        cuerpo:
          'El cacao es una fuente natural de antioxidantes, gracias a sus flavonoides, y aporta minerales como magnesio, hierro y cobre. Contribuye al bienestar y al buen ánimo, y es una deliciosa fuente de energía.',
      },
    ],
    catar: {
      titulo: 'Cómo catar un chocolate',
      pasos: [
        { nombre: 'Mirar', texto: 'Aspecto uniforme y, si está bien templado, una superficie lisa y ligeramente brillante.' },
        { nombre: 'Escuchar', texto: 'Al partirlo debe dar un "snap" limpio y seco.' },
        { nombre: 'Oler', texto: 'Acércalo a la nariz: puede revelar aromas frutales, florales, tostados o de frutos secos.' },
        { nombre: 'Dejar que se funda', texto: 'Un trozo sobre la lengua, sin masticar. El calor de la boca libera la manteca de cacao y sus aromas.' },
        { nombre: 'Descubrir los sabores', texto: 'Observa qué aparece primero y qué viene después: acidez, dulzor, amargor, fruta, café, especias.' },
        { nombre: 'El final', texto: 'Después de tragarlo, el cacao deja una sensación larga, limpia y compleja, no solo dulzor.' },
      ],
    },
    cita: 'El buen chocolate no se come de prisa: se mira, se escucha, se huele y se deja fundir.',
  },

  recetas: {
    titulo: 'Recetas',
    intro: 'Cuatro maneras de llevar el chocolate de la barra a la mesa, con las gotas y el chocolate en polvo.',
    notaMargen: ['Taza', 'Frío', 'Postre'],
    imagenAlt: 'El personaje de Maracacao batiendo chocolate en una taza con su molinillo',
    etiquetaTip: 'Tip Maracacao',
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
  },

  quienes: {
    titulo: 'Quiénes somos',
    frase: 'Empezó en una cocina, probando combinaciones.',
    prosa:
      'Maracacao nació en 2024 explorando frutas, chiles, hierbas y especias con chocolate de buen porcentaje de cacao. Somos un equipo que promueve el buen chocolate mexicano, con buenas prácticas ambientales y saborizado solo con ingredientes naturales.',
    origen:
      'Nuestro chocolate se elabora en Tabasco, la zona cacaotera más grande del país, a partir de cacao cuidadosamente seleccionado. El proceso pone especial atención en la fermentación y el manejo del grano, para lograr un sabor profundo, equilibrado y aromático.',
    notaMargen: ['2024', 'Tabasco', 'CDMX'],
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
    invitacion: 'Escríbenos y te contamos qué hay disponible.',
    correo: 'maracacaomx@gmail.com',
    puntoVentaEtiqueta: 'Punto de venta',
    puntoVenta: 'Mercado de Coyoacán · Malintzin s/n, Col. del Carmen, Coyoacán, CDMX',
    catalogoEtiqueta: 'Catálogo en línea',
    catalogoNombre: 'Ver el catálogo',
    catalogoUrl: 'https://chocolateria.pulpos.shop',
  },

  footer: {
    lugar: 'Ciudad de México',
    derechos: 'Maracacao · Chocolate mexicano',
  },

  // Página en construcción — lo público mientras se termina el sitio.
  // Sin juegos de palabras: al punto (retro de Marcos, 2026-08-12).
  construccion: {
    titulo: 'Maracacao — Sitio en construcción',
    encabezado: 'Sitio en construcción',
    sub: 'Estamos armando la página. Mientras tanto, el catálogo está abierto y el chocolate, disponible.',
    ctaCatalogo: 'Ver el catálogo',
    ctaCorreo: 'Escríbenos',
    personajeAlt: 'El personaje de Maracacao batiendo chocolate con su molinillo',
    logoAlt: 'Sello de Maracacao: la huella de una mano dentro de un círculo, con la palma formada por granos de cacao',
    lugar: 'Mercado de Coyoacán',
    muyPronto: 'Muy pronto',
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
