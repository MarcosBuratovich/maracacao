// Ningún string visible dentro de un componente: todo texto de cara al
// usuario que consumen las siete variantes de logo (Task 15) vive acá.
export const copy = {
  logoAria: 'Maracacao — chocolate mexicano',
  // Isotipo suelto (solo la cabeza, sin logotipo): nombre propio del
  // personaje, ya establecido como aria-label del propio SVG de origen
  // (ver mascota.svg / mascota-reducida.svg). Deliberadamente distinto de
  // `logoAria`: acá no hay "logo", hay una ilustración de apoyo.
  mascotaAria: 'Mono de Maracacao',
  navSabores: 'Sabores',
  navOrigen: 'Origen',
  navTienda: 'Tienda',
} as const
