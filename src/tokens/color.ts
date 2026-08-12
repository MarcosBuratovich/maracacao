import type { NivelWcag } from './contrast'

/** Base 500 = color medido del render limpio. Ver §6.2 del spec. */
export const verde = {
  50: '#F2F4F1', 100: '#E1E6DF', 200: '#C4CDBE', 300: '#A3B19A', 400: '#7F9373',
  500: '#5B744B', 600: '#4B5F3E', 700: '#3A4A30', 800: '#2A3522', 900: '#1B2316',
} as const

/** Solo ilustración y superficies decorativas. Nunca texto sobre verde. */
export const tan = {
  50: '#FEF9F3', 100: '#FEF2E3', 200: '#FCE4C8', 300: '#FBD5A9', 400: '#FAC487',
  500: '#F8B465', 600: '#CB9453', 700: '#9F7341', 800: '#72532E', 900: '#4A361E',
} as const

/**
 * Base 500 medida del render en cachetes y boca. Se sumó en la Task 7: el
 * original tiene cachetes y lengua rosas y la paleta no tenía ningún rosa,
 * con lo cual la lengua quedaba crema y se leía como un diente.
 * `rosa-500` sobre papel da 3.44 — no usar para texto normal.
 */
export const rosa = {
  50: '#FBF3F2', 100: '#F5E3E2', 200: '#EBC8C5', 300: '#E0A9A4', 400: '#D48881',
  500: '#C8665D', 600: '#A4544C', 700: '#80413C', 800: '#5C2F2B', 900: '#3C1F1C',
} as const

export const fijos = {
  papel: '#FAF3E0',
  crema: '#F4E8C6',
  tinta: '#372915',
  bordo: '#8B4D3F',
  amarillo: '#ECC677',
  suelo: '#E3BC87',
} as const

/**
 * Colores MEDIDOS de las referencias reales del cliente (2026-08-10):
 * fotos de empaques, etiquetas de la línea 250 g e ilustraciones del
 * personaje (ver docs/referencias/estilo-cliente/). Son referencia de
 * trabajo para el sitio público y los prompts de diseño — NO forman parte
 * todavía del sistema de 36 (rampas + pares de contraste): esa
 * re-derivación es la fase de diseño que sigue. Por eso no entran en
 * todosLosColores().
 *
 * Hallazgo: el rojo de la envoltura mango-chile midió #C66361 ≈ rosa-500
 * (#C8665D) — ya existe en el sistema, no se duplica acá.
 */
export const empaque = {
  morado: '#774A95', // envoltura jengibre y naranja
  verdeHoja: '#376042', // mini lima y chile
  menta: '#B2C0AD', // mini zacate limón
  naranja: '#DA8843', // envoltura/mini naranja
  cafe: '#723D13', // etiqueta cocoa alcalina
  amarilloEtiqueta: '#F3D87C', // recuadro de sabor de las etiquetas
  rosaFondo: '#E5BFBF', // fondo de las fotos de producto
  rojoPersonaje: '#BD1608', // cabeza del changuito (la sombra midió #A6271C)
  cremaPersonaje: '#FBD98A', // cara y panza del changuito
} as const

/**
 * Los fondos de las OCHO etiquetas reales de la línea de polvos (medidos
 * 2026-08-12, `docs/referencias/etiquetas/`). Son la paleta viva del
 * sitio público — el "replanteo" pedido por Marcos: el oliva del sistema
 * de identidad se sintió apagado al lado de esto. Contrastes medidos:
 * cacao 7.93 y carmin 10.05 sobre papel (AAA); petroleo 5.98, morado
 * 5.39 y caramelo 4.68 (AA); chile 4.45 (solo display/grande); menta y
 * cielo son claros (texto tinta: 6.64 / 5.74).
 */
export const etiqueta = {
  morado: '#7E4BB0', // naranja & jengibre
  carmin: '#7D0302', // canela
  menta: '#95BC94', // limoncillo
  cacao: '#723D13', // cocoa alcalina
  chile: '#CB3C40', // chile
  cielo: '#7CAEB2', // menta
  caramelo: '#976125', // cocoa natural
  petroleo: '#136769', // cardamomo
} as const

export const roles = {
  'fondo-claro': fijos.papel,
  'fondo-oscuro': verde[700],
  'fondo-profundo': verde[800],
  'texto-cuerpo': fijos.tinta,
  'texto-titulo': verde[700],
  'texto-secundario': verde[600],
  'texto-sobre-oscuro': fijos.papel,
  'acento': fijos.bordo,
  'destacado': fijos.amarillo,
  'contorno-ilustracion': fijos.tinta,
} as const

export const paresAprobados = [
  { frente: fijos.tinta, fondo: fijos.papel, uso: 'texto cuerpo sobre banda clara', minimo: 'AAA' },
  { frente: verde[700], fondo: fijos.papel, uso: 'títulos sobre banda clara', minimo: 'AAA' },
  { frente: verde[600], fondo: fijos.papel, uso: 'texto secundario sobre banda clara', minimo: 'AA' },
  { frente: fijos.papel, fondo: verde[700], uso: 'texto sobre banda verde', minimo: 'AAA' },
  { frente: fijos.crema, fondo: verde[700], uso: 'texto crema sobre banda verde', minimo: 'AAA' },
  { frente: fijos.papel, fondo: verde[800], uso: 'texto sobre banda verde profunda', minimo: 'AAA' },
  { frente: fijos.tinta, fondo: fijos.amarillo, uso: 'texto en botón amarillo', minimo: 'AAA' },
  { frente: fijos.papel, fondo: fijos.bordo, uso: 'texto en botón bordó', minimo: 'AA' },
  { frente: fijos.bordo, fondo: fijos.papel, uso: 'acento sobre banda clara', minimo: 'AA' },
] as const satisfies ReadonlyArray<{
  frente: string; fondo: string; uso: string; minimo: NivelWcag
}>

export const paresProhibidos = [
  { frente: fijos.crema, fondo: verde[500], razon: 'da 4.25, no llega a 4.5' },
  { frente: tan[500], fondo: verde[500], razon: 'da 2.89, falla fuerte' },
] as const

export function todosLosColores(): string[] {
  return [
    ...Object.values(verde), ...Object.values(tan),
    ...Object.values(rosa), ...Object.values(fijos),
  ]
}
