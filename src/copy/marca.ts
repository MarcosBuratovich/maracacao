// Ningún string visible dentro de un componente: todo texto de cara al
// usuario que consumen las siete variantes de logo (Task 15) vive acá.
export const copy = {
  logoAria: 'Maracacao — chocolate mexicano',
  // Isotipo suelto (solo la cabeza, sin logotipo): nombre propio del
  // personaje, ya establecido como aria-label del propio SVG de origen
  // (ver mascota.svg / mascota-reducida.svg). Deliberadamente distinto de
  // `logoAria`: acá no hay "logo", hay una ilustración de apoyo.
  mascotaAria: 'La mascota de Maracacao',
  navSabores: 'Sabores',
  navOrigen: 'Origen',
  navTienda: 'Tienda',

  // Task 17 — styleguide navegable (src/pages/index.astro,
  // src/pages/manual/[...slug].astro y src/content/manual/*.mdx). Resuelve
  // la deuda dejada a propósito en la Task 1: `index.astro` tenía un <h1>
  // hardcodeado con un comentario que apuntaba acá.
  manualTitulo: 'Manual de marca',
  manualIntro:
    'Cada color, tipografía y variante de logo de esta página sale en vivo del código de marca: nada es una captura vieja.',
  navIndice: 'Índice del manual',
  navAnterior: 'Anterior',
  navSiguiente: 'Siguiente',

  // Fix round 1/5: los <title> de index.astro y manual/[...slug].astro
  // estaban hardcodeados como string literal en el atributo `titulo` de
  // <Base>, violando la regla 1 de la §10.6 ("ningún string visible
  // dentro de un componente") — la misma regla que el comentario de
  // arriba ya cita. `tituloPortada` es el <title> completo de la home;
  // `sufijoTituloPagina` es la cola que `manual/[...slug].astro` compone
  // con `pagina.data.titulo` (el único dato que sí viene del frontmatter
  // MDX, no de acá).
  tituloPortada: 'Maracacao — Manual de marca',
  sufijoTituloPagina: 'Manual Maracacao',

  // Bandas.astro (§6.4 del spec) — el mono cambiando de banda.
  demoBandaClara: 'Banda clara: el mono recorta contra el papel.',
  demoBandaOscura: 'Banda verde: el contorno sostiene la figura.',

  // Especimen.astro (tipografia.mdx). El texto de Fraunces es el propio
  // descriptor de sabor del packaging original (§3 del spec: "serif para
  // el descriptor de sabor"); el de Work Sans es una oración de cuerpo
  // nueva, en el mismo registro es-MX ("pistaches", no "pistachos").
  tipoMuestraDisplay: 'Chocolate blanco y pistaches',
  tipoMuestraTexto: 'Hecho a mano, en lotes chicos, con pistaches de verdad.',
} as const
