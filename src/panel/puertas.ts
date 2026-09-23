/*
 * Las cinco puertas del panel (fase 7, decisión D1 del diseño).
 *
 * La navegación deja de seguir las secciones de la PÁGINA y pasa a seguir
 * las cosas que la clienta administra. El mapa vive acá y no en el esquema
 * a propósito: las puertas son una decisión de la interfaz, y
 * `src/contenido/**` no tiene por qué enterarse de cómo se dibuja el panel.
 */
import type { CampoEditable, Seccion } from './campos'

export type Puerta = 'productos' | 'textos' | 'fichas' | 'negocio' | 'invisible'

export const PUERTAS: readonly Puerta[] = ['productos', 'textos', 'fichas', 'negocio', 'invisible']

export const ETIQUETA_DE_PUERTA: Readonly<Record<Puerta, string>> = {
  productos: 'Productos',
  textos: 'Textos del sitio',
  fichas: 'Fichas técnicas',
  negocio: 'Contacto y negocio',
  invisible: 'Lo que no se ve',
}

/*
 * Las fichas llevan advertencia y el resto no. No es decoración: ahí adentro
 * hay declaraciones que tienen que coincidir con el empaque impreso y con lo
 * que se declara ante la autoridad. Entrar ahí no puede sentirse igual que
 * corregir una errata de la portada.
 */
export const AVISO_DE_PUERTA: Readonly<Partial<Record<Puerta, string>>> = {
  fichas: 'Lo que cambies aquí tiene que decir exactamente lo mismo que la envoltura impresa.',
  invisible: 'Esto no se ve en la página: son las descripciones de las imágenes para quien no puede verlas, y lo que aparece en los buscadores.',
}

const PUERTA_DE_SECCION: Readonly<Record<Seccion, Puerta>> = {
  productos: 'productos',
  sabores: 'productos',
  portada: 'textos',
  catar: 'textos',
  recetas: 'textos',
  nosotros: 'textos',
  preguntas: 'textos',
  pie: 'textos',
  'no-encontrada': 'textos',
  fichas: 'fichas',
  contacto: 'negocio',
  negocios: 'negocio',
  accesibilidad: 'invisible',
  buscadores: 'invisible',
}

export function puertaDe(seccion: Seccion): Puerta {
  return PUERTA_DE_SECCION[seccion]
}

export function camposDePuerta(todos: readonly CampoEditable[], puerta: Puerta): CampoEditable[] {
  return todos.filter((c) => puertaDe(c.meta.seccion) === puerta)
}
