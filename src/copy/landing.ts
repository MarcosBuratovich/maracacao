// Copy de la presentación de identidad (src/pages/index.astro y
// src/components/landing/*). Misma regla que marca.ts: ningún string
// visible dentro de un componente. Registro es-MX — "pistaches",
// "cacahuate", "empaque", "plumón" — voz de la marca: golosa, ágil,
// orgullosa, sin folklore (§12 del spec de identidad).
export const landing = {
  titulo: 'Maracacao — Presentación de identidad',
  skipLink: 'Ir al contenido',
  navManual: 'Manual de marca',

  hero: {
    overline: 'Presentación de identidad',
    titulo: 'El chocolate ya estaba listo. Ahora la marca también.',
    sub: 'Un mono goloso, los colores medidos de tu empaque y una familia de logos que trabaja del favicon al aparador: esta es la identidad de Maracacao.',
    ctaRecorrido: 'Recorrer la identidad',
    ctaManual: 'Abrir el manual de marca',
  },

  mono: {
    overline: 'El personaje',
    titulo: 'El mismo mono, ahora vivo',
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
      'Los colores salen de tu empaque: verdes de cacaotal, tonos de chocolate y el rosa que le da vida a la cara del mono. Cada combinación de texto pasó las pruebas de contraste — se lee bien en pantalla chica, con sol y sin lentes.',
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
      'Respira, parpadea y mueve la cola como quien no tiene prisa. Nada viaja en línea recta — todo describe un arco — y nunca se mueven más de dos cosas a la vez. Si tu teléfono pide menos movimiento, el mono se queda quieto y la página no pierde nada.',
    demoHint: 'Este de aquí ya está vivo — míralo respirar.',
    principios: ['Arcos, nunca rectas', 'Peso: la cola llega tarde', 'Spring suave por defecto'],
  },

  adelanto: {
    overline: 'Lo que viene',
    titulo: 'Un adelanto del sitio',
    prosa:
      'Así se va a sentir navegar Maracacao: bandas que alternan como las caras de tu empaque, el mono acompañando el recorrido y el chocolate siempre al centro. Tres muestras:',
    chip: 'Vista previa',
    sabores: {
      titulo: 'Para cada antojo',
      items: [
        { nombre: 'Chocolate blanco y pistaches', tono: 'blanco', precio: 95 },
        { nombre: 'Chocolate de leche con cacahuate', tono: 'leche', precio: 95 },
        { nombre: 'Chocolate oscuro 70% cacao', tono: 'oscuro', precio: 110 },
      ] as const,
    },
    origen: {
      titulo: 'Cacao de aquí',
      prosa: 'Grano de Tabasco y Chiapas, tostado y molido en casa. Del cacaotal a la tableta, sin escalas.',
    },
    tienda: {
      titulo: 'Directo a tu puerta',
      prosa: 'Envíos a todo México.',
      botonPrimario: 'Agregar al carrito',
      botonSecundario: 'Ver sabores',
    },
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
      { cifra: '1', concepto: 'mono con hambre' },
    ],
    ctaManual: 'Explorar el manual de marca',
    siguiente: 'Lo que sigue: darle cuerda al mono en Rive y construir el sitio completo.',
  },

  footer: {
    leyenda: 'Identidad Maracacao · Agosto de 2026',
    remate: 'Hecha a mano, como el chocolate.',
  },

  manualIndice: {
    volver: 'Volver a la presentación',
  },
} as const

/** Precio en pesos, siempre con el locale del sitio (§10.6: Intl es-MX). */
export function precioMXN(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}
