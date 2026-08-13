// Copy del sitio público rediseñado (2026-08-13, diseño de Marcos en
// claude.ai/design — auditoría en docs/auditoria-diseno-v2.md).
//
// Reglas vigentes: registro es-MX de tú; el personaje nunca se llama
// "mono"; las bolsas son GOTAS (nunca "chispas"); sin carrito; títulos
// concretos; los precios van como NÚMEROS y los formatea `precioMXN`;
// nada de contenido de negocio inventado. Los textos largos son del
// cliente (docs/respuestas-formulario.md); el bloque de beneficios va en
// la versión suavizada por COFEPRIS.
//
// Los datos de producto (nombres, ingredientes, %, precios) NO viven
// acá: salen de src/copy/sabores.ts, la fuente única.
export const marca = {
  titulo: 'Maracacao — Chocolate mexicano, 70% cacao',
  skipLink: 'Ir al contenido',

  marca: {
    nombre: 'Maracacao',
    wordmark: 'MARACACAO',
    descriptor: 'CHOCOLATE MEXICANO',
    selloAlt: 'Sello de Maracacao: la huella de una mano dentro de un círculo, con la palma formada por granos de cacao',
  },

  nav: {
    abrir: 'Abrir menú',
    cerrar: 'Cerrar menú',
    etiqueta: 'Menú principal',
    // El overlay numera las entradas; «Nosotros» faltaba en el canvas.
    items: [
      { ancla: '#sabores', texto: 'Sabores' },
      { ancla: '#recetas', texto: 'Recetas' },
      { ancla: '#catar', texto: 'Cómo catar' },
      { ancla: '#nosotros', texto: 'Nosotros' },
      { ancla: '#negocios', texto: 'Para negocios' },
      { ancla: '#preguntas', texto: 'Preguntas' },
      { ancla: '#contacto', texto: 'Contacto' },
    ],
    catalogo: 'Catálogo en línea',
    pie: ['MERCADO DE COYOACÁN · CDMX', 'maracacaomx@gmail.com'],
  },

  hero: {
    // Titular «directo», el elegido de las tres variantes del canvas.
    titular: ['CHOCOLATE', 'MEXICANO,', '70% CACAO.'],
    sub: 'Hecho a mano con frutas, chiles, hierbas y especias. Más cacao, ingredientes sencillos y muchas maneras de disfrutarlo.',
    ctaCatalogo: 'Ver catálogo en línea',
    ctaSabores: 'Los 15 sabores ↓',
    marquesinaAria: 'Barras de los quince sabores, decorativa',
  },

  postura: {
    kicker: 'LA RECETA COMPLETA',
    titulo: '¿Qué hay en una barra?',
    intro: 'Cinco ingredientes que puedes leer de corrido. Cuando el cacao es de buena calidad, no hace falta nada más.',
    chips: ['Cacao de Tabasco', 'Fundado en 2024', 'Hecho a mano'],
    tabSi: 'Sí lleva',
    tabNo: 'No lleva',
    // En el orden impreso (de mayor a menor cantidad).
    lleva: [
      'Licor de cacao',
      'Azúcar de caña',
      'Manteca de cacao',
      'Lecitina de soya',
      'El sabor: frutas, chiles, hierbas, especias o esencias naturales',
    ],
    llevaNota: 'Del cacao —licor y manteca— viene el 70% de cada barra. * Blanco con pistache: manteca de cacao, leche en polvo, azúcar, lecitina de soya y pistaches.',
    noLleva: ['Saborizantes artificiales', 'Químicos', 'Aditivos innecesarios'],
    noLlevaCierre: 'Cuando el cacao es de buena calidad, su sabor, aroma y carácter hablan por sí mismos.',
  },

  anaquel: {
    kicker: 'LOS 15 SABORES',
    titulo: 'Elige tu barra',
    contadorDe: 'de 15',
    fichaEtiqueta: 'Barra n.º',
    grupoAria: 'Elige un sabor para ver su ficha',
    pesoInsignia: '70 g',
    manoInsignia: 'hecho a mano',
    ingredientesEtiqueta: 'Ingredientes',
    cta: 'Ver en el catálogo',
    remate: 'Hecho para comerse despacio.',
    ilustracionCaption: 'El personaje de la etiqueta',
    ilustracionAltPrefijo: 'Ilustración de la envoltura de',
    envolturaAltPrefijo: 'Envoltura de',
  },

  minis: {
    titulo: 'Paquete de seis minis',
    precio: 118,
    cuerpo: 'Seis minibarras surtidas de 10 g. Los sabores siempre cambian: es un surtido, no una selección fija.',
    nota: 'Para probar la línea sin casarte con una sola barra.',
  },

  gotas: {
    titulo: 'Gotas de chocolate · 250 g',
    precioDesde: 258,
    precioJengibre: 340,
    desdeEtiqueta: 'desde',
    cuerpo: 'Gotas de 10 g del mismo chocolate 70%: para hornear, fundir en taza o comer como botana.',
    sabores: '6 sabores',
    notaPrecio: 'Jengibre y naranja',
  },

  polvoCard: {
    titulo: 'En polvo · 250 g',
    chip: 'PRÓXIMAMENTE',
    cuerpo: 'Para beber frío o caliente, con espuma, aroma y tradición.',
  },

  polvo: {
    kicker: 'LO QUE VIENE',
    chip: 'PRÓXIMAMENTE',
    titulo: 'Chocolate para beber',
    cuerpo: 'Ocho variedades hechas con cocoa natural, cocoa alcalina y pasta de cacao.',
    altPrefijo: 'Etiqueta del chocolate en polvo sabor',
  },

  catar: {
    kicker: 'CÓMO CATAR CHOCOLATE',
    titulo: 'Seis pasos para probarlo bien',
    pasos: [
      { nombre: 'Mira', texto: 'Uniforme y, bien templado, con superficie lisa y ligeramente brillante.', clave: 'mangoConChile' },
      { nombre: 'Escucha', texto: 'Al partirlo debe dar un crac limpio y seco.', clave: 'pinaConChile' },
      { nombre: 'Huele', texto: 'Puede revelar aromas frutales, florales, tostados, especiados, terrosos o a nueces.', clave: 'cardamomo' },
      { nombre: 'Déjalo fundir', texto: 'Un trozo en la lengua, sin masticarlo de inmediato. La manteca de cacao se funde casi a temperatura corporal.', clave: 'jengibreYNaranja' },
      { nombre: 'Encuentra los sabores', texto: 'Acidez, dulzor, amargor, notas de fruta, café o especias.', clave: 'limaYChile' },
      { nombre: 'Observa el final', texto: 'Debe permanecer: largo, limpio y complejo, no solo dulce.', clave: 'fresasYChile' },
    ],
    cita: 'El buen chocolate no se come de prisa: se mira, se escucha, se huele y se deja fundir.',
    porqueTitulo: '¿Por qué 70% cacao?',
    porque: 'Un chocolate con 70% conserva más componentes naturales del cacao y lleva menos azúcar. No se trata de que sea más oscuro: se trata de que haya más cacao en cada mordida.',
    // Tema elegido por el cliente en el cuestionario; versión suavizada
    // por el filtro COFEPRIS (nada de prevención de patologías).
    aporteTitulo: 'Lo que aporta el cacao',
    aporte: 'El cacao es una fuente natural de antioxidantes, gracias a sus flavonoides, y aporta minerales como magnesio, hierro y cobre. Contribuye al bienestar y al buen ánimo, y es una deliciosa fuente de energía.',
  },

  recetas: {
    kicker: 'RECETAS',
    titulo: 'Qué hacer con ellas',
    deslizaNota: 'desliza →',
    verCompleta: 'Ver la receta completa',
    etiquetaTip: 'Tip Maracacao',
    listaAria: 'Recetas, lista deslizable',
    lista: [
      {
        kicker: 'CON GOTAS · 1 TAZA',
        titulo: 'Chocolate caliente de jengibre y naranja',
        resumen: '250 ml de leche caliente sin hervir, 30 g de gotas y un minuto de cáscara de naranja.',
        clave: 'jengibreYNaranja',
        ingredientes: ['250 ml de leche', '30 g de gotas de chocolate con jengibre y naranja', 'Un trocito de cáscara de naranja'],
        pasos: 'Calienta la leche sin hervir. Agrega las gotas y mueve hasta que se fundan. Deja la cáscara de naranja un minuto y retírala. Sirve caliente.',
        tip: 'Espuma la leche al final para hacerlo más cremoso.',
      },
      {
        kicker: 'CON GOTAS · 1 VASO',
        titulo: 'Chocolate frío de jengibre y naranja',
        resumen: '30 g de gotas fundidas, 200 ml de leche fría, bastante hielo y una rodaja de naranja.',
        clave: 'pinaConChile',
        ingredientes: ['30 g de gotas de chocolate con jengibre y naranja', '50 ml de agua o leche caliente', '200 ml de leche fría', 'Hielo', 'Una rodaja de naranja'],
        pasos: 'Funde las gotas en el líquido caliente. Agrega la leche fría y mezcla bien. Sirve sobre mucho hielo y termina con la rodaja de naranja.',
        tip: 'Una pizquita de canela le queda espectacular.',
      },
      {
        kicker: 'CON GOTAS · 2 PORCIONES',
        titulo: 'Peras con chocolate y canela',
        resumen: 'Gajos dorados en sartén, bañados con 50 g de gotas de canela fundidas y nuez picada.',
        clave: 'canela',
        ingredientes: ['2 peras', '50 g de gotas de chocolate con canela', '2 cucharadas de agua o leche', 'Nueces o almendras picadas'],
        pasos: 'Corta las peras en gajos y dóralas ligeramente en un sartén. Funde las gotas con el agua o la leche y viértelas sobre las peras tibias. Termina con las nueces.',
        tip: 'Sírvelas con yogur griego o una bola de helado de vainilla.',
      },
      {
        kicker: 'CON POLVO · 4 PORCIONES',
        titulo: 'Mousse rápida de chocolate con cardamomo',
        resumen: 'Crema batida firme, yogur griego y 80 g de chocolate en polvo de cardamomo. Una hora al frío.',
        clave: 'cardamomo',
        chipPolvo: 'USA EL POLVO · PRÓXIMAMENTE',
        ingredientes: ['80 g de chocolate en polvo con cardamomo', '200 ml de crema para batir bien fría', '100 g de yogur griego natural', 'Frutos rojos o naranja para decorar'],
        pasos: 'Bate la crema hasta que esté firme. Mezcla aparte el yogur con el chocolate en polvo. Incorpora la crema con suavidad y refrigera una hora.',
        tip: 'El cardamomo hace que un postre sencillísimo sepa mucho más sofisticado.',
      },
    ],
  },

  nosotros: {
    kicker: 'NOSOTROS',
    titulo: 'Empezó en una cocina',
    parrafos: [
      'En 2024 empezamos a explorar combinaciones de sabores, aromas y frutas — y, por supuesto, chocolate con un buen porcentaje de cacao. De esa cocina salió Maracacao: chocolates 70% cacao donde el cacao siempre es el protagonista, acompañado de frutas, chiles, hierbas y esencias naturales.',
      'Somos un equipo de trabajo unido por el interés de promover buen chocolate mexicano: hecho con buenas prácticas ambientales, respetando la integridad del cacao y saborizado únicamente con ingredientes naturales.',
    ],
    cacaoTitulo: 'El cacao.',
    cacao: 'Nuestro chocolate se produce en Tabasco, la región cacaotera más grande de México, con granos cuidadosamente seleccionados. El proceso cuida la fermentación y el manejo del grano para lograr un sabor profundo, balanceado y aromático.',
    datos: ['Coyoacán, Ciudad de México', 'desde 2024'],
    personajeAlt: 'El personaje de Maracacao sentado y sonriendo',
  },

  negocios: {
    kicker: 'PARA CAFÉS Y NEGOCIOS',
    titulo: '¿Con qué trabajas?',
    intro: 'Atendemos cafeterías, panaderías y cocinas de repostería.',
    correoEtiqueta: 'Pedidos y fichas técnicas:',
    correo: 'maracacaomx@gmail.com',
    // Semáforo honesto de datos técnicos (rescatado de las opciones del
    // canvas): qué existe hoy y qué sigue en preparación.
    fichas: [
      { dato: 'Ingredientes y % de cacao', estado: 'disponibles por sabor' },
      { dato: 'Alérgenos', estado: 'visibles en el empaque' },
      { dato: 'Tabla nutrimental y vida de anaquel', estado: 'en preparación' },
    ],
    tabs: [
      {
        id: 'gotas',
        etiqueta: 'Gotas',
        titulo: 'Gotas de chocolate · 250 g',
        precioNota: 'desde',
        precio: 258,
        clave: 'cardamomo',
        cuerpo: 'Gotas de unos 10 g del mismo chocolate 70% de las barras. Listas para usar: sin picar, rallar ni trocear.',
        datos: [
          '6 sabores: jengibre y naranja, hierbabuena, canela, menta, limoncillo y lima y chile',
          'Para galletas, brownies, panes, ganaches y coberturas',
          'También se comen solas, como botana',
        ],
      },
      {
        id: 'barras',
        etiqueta: 'Barras',
        titulo: 'Barras · 70 g',
        precioNota: 'desde',
        precio: 108,
        clave: 'canela',
        cuerpo: 'Las 15 barras de la línea, para vitrina, regalo y mesa de postres.',
        datos: [
          'Envueltas de a una, con el porcentaje de cacao impreso por sabor',
          'Ingredientes disponibles por sabor',
          'Todas llevan lecitina de soya; el blanco, además, leche y pistaches',
        ],
      },
      {
        id: 'polvo',
        etiqueta: 'Polvo',
        titulo: 'En polvo · 250 g',
        precioNota: 'próximamente',
        precio: null,
        clave: 'salDeMar',
        cuerpo: 'Ocho variedades para la taza, hechas con cocoa natural, cocoa alcalina y pasta de cacao.',
        datos: [
          'Se disuelve en bebidas frías o calientes',
          'También para licuados, repostería y postres',
          'Aún no está a la venta: escríbenos si te interesa',
        ],
      },
    ],
  },

  preguntas: {
    kicker: 'PREGUNTAS FRECUENTES',
    titulo: 'Lo que más nos preguntan',
    items: [
      { p: '¿Dónde puedo comprar?', r: 'En el Mercado de Coyoacán (Malintzin s/n, Col. del Carmen) y en nuestro catálogo en línea, con precios públicos en pesos.' },
      { p: '¿Qué significa realmente 70% cacao?', r: 'Es la parte de la barra que procede del cacao: licor y manteca. Más porcentaje significa más cacao y menos protagonismo del azúcar.' },
      { p: '¿Qué azúcar usan?', r: 'Azúcar de caña. Y menos de la que esperas: con 70% cacao, el azúcar no es la protagonista.' },
      { p: '¿Qué alérgenos tienen?', r: 'Todas las barras contienen lecitina de soya. El blanco con pistache contiene además leche en polvo y pistaches.' },
      { p: '¿Por qué se derrite en la boca?', r: 'La manteca de cacao se funde cerca de la temperatura corporal. Por eso un buen chocolate cambia tanto cuando dejas de masticarlo y permites que se funda.' },
      { p: '¿Cómo guardo mi chocolate?', r: 'En un lugar fresco y seco, lejos del sol y de olores fuertes. El refrigerador, en general, no es su amigo.' },
      { p: '¿Y la capa blanca que a veces aparece?', r: 'Es el bloom: no significa que el chocolate esté echado a perder. Suele deberse a cambios de temperatura o humedad.' },
      { p: '¿Envíos, mayoreo o regalos?', r: 'Escríbenos a maracacaomx@gmail.com y lo resolvemos contigo.' },
    ],
  },

  contacto: {
    kicker: 'CONTACTO',
    titulo: 'Estamos en Coyoacán',
    puestoEtiqueta: 'NUESTRO PUESTO',
    puestoTitulo: ['Mercado de', 'Coyoacán'],
    direccion: ['Malintzin s/n, Col. del Carmen', 'Coyoacán, C.P. 04100, CDMX'],
    correoEtiqueta: 'CORREO',
    correo: 'maracacaomx@gmail.com',
    correoNota: 'Pedidos, mayoreo, regalos y dudas.',
    copiar: 'Copiar correo',
    copiado: '¡Copiado!',
    catalogoEtiqueta: 'CATÁLOGO EN LÍNEA',
    catalogoNombre: 'chocolateria.pulpos.shop',
    catalogoUrl: 'https://chocolateria.pulpos.shop',
    catalogoNota: 'Precios públicos en pesos mexicanos.',
    personajeAlt: 'El personaje de Maracacao batiendo chocolate con su molinillo',
    // El formulario no tiene servidor detrás: arma el mensaje y lo abre
    // en el correo del visitante, listo para mandarse al de la marca.
    // La nota lo dice sin rodeos — nada de fingir un «enviado».
    formulario: {
      titulo: 'Escríbenos',
      nombre: 'Tu nombre',
      correo: 'Tu correo',
      tipo: '¿Qué tipo de contacto es?',
      tipoOpciones: [
        { valor: 'personal', texto: 'Compra personal' },
        { valor: 'negocio', texto: 'Para mi negocio (cafetería, panadería, repostería)' },
      ],
      mensaje: 'Tu mensaje',
      mensajeEjemplo: 'Cuéntanos qué necesitas: pedidos, mayoreo, regalos, dudas…',
      enviar: 'Enviar mensaje',
      nota: 'Al enviar se abre tu aplicación de correo con el mensaje listo para maracacaomx@gmail.com.',
      asuntoPersonal: 'Mensaje desde el sitio — compra personal',
      asuntoNegocio: 'Mensaje desde el sitio — negocio',
    },
  },

  // Página en construcción — lo público mientras el sitio no sale.
  // Sin juegos de palabras: dice lo que pasa (retro de Marcos, vigente).
  construccion: {
    titulo: 'Maracacao — Sitio en construcción',
    encabezado: 'Sitio en construcción',
    sub: 'Estamos armando la página. Mientras tanto, el catálogo está abierto y el chocolate, disponible.',
    ctaCatalogo: 'Ver el catálogo',
    ctaCorreo: 'Escríbenos',
    lugar: 'Mercado de Coyoacán · CDMX',
    muyPronto: 'Muy pronto',
    personajeAlt: 'El personaje de Maracacao batiendo chocolate con su molinillo',
  },

  footer: {
    // El lema es la frase textual del cliente (formulario, pregunta 11b).
    lema: 'Más cacao, ingredientes sencillos y muchas maneras de disfrutarlo',
    wordmarkAlt: 'Chocolate mexicano, escrito a mano como en la envoltura',
    linea: 'CACAO 70% · COYOACÁN · CDMX',
    seccionesTitulo: 'Secciones',
    productosTitulo: 'Productos',
    contactoTitulo: 'Contacto',
    legalesTitulo: 'Legales',
    productos: [
      { ancla: '#sabores', texto: 'Barras 70 g' },
      { ancla: '#sabores', texto: 'Gotas de chocolate 250 g' },
      { ancla: '#polvo', texto: 'Chocolate en polvo (próximamente)' },
    ],
    // Las páginas legales todavía no existen: van sin enlace, marcadas,
    // para que la estructura ya esté y activarlas sea poner el href.
    legales: ['Aviso de privacidad', 'Términos y condiciones'],
    legalesNota: 'En preparación',
    derechos: 'Maracacao · Chocolate mexicano · Hecho a mano en México',
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
