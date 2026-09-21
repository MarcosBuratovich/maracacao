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

/**
 * SISTEMA EDITORIAL del sitio público (2026-08-12). Una sola tinta sobre
 * un solo papel, medidos del logo oficial (`docs/referencias/logo-oficial.jpeg`:
 * papel #F8F0E5, tinta del sello ≈ #503820 profundizada a #241609).
 *
 * La decisión de fondo: el LIENZO no lleva color; el color lo pone el
 * producto. Los ocho tonos de `etiqueta` dejan de ser bandas de página y
 * pasan a ser ÍNDICE — la marca de cada sabor. Así el color informa en
 * vez de decorar, que era la queja real ("apagado, mal mezclado").
 *
 * Contrastes medidos: papel/tinta 15.57 · papel/tintaMedia 12.67 ·
 * humo/tinta 8.61 · sepia/papel 6.49 · tinta/papelHueso 14.01 (todos AAA).
 */
export const editorial = {
  tinta: '#241609',
  tintaMedia: '#3A2614',
  papel: '#F8F0E5',
  papelHueso: '#EFE4D4',
  humo: '#C4B39D',
  sepia: '#6B513A',
} as const

/**
 * LOS QUINCE COLORES DE ENVOLTURA, exactos (2026-08-12). Ya no son
 * medidos de una foto: salen de los PDF de diseño del propio cliente
 * (`scripts/extrae-envolturas.py`), con los textos en vectorial y las
 * ilustraciones a 300-550 ppi. Un color por sabor — esta es la paleta
 * viva de la marca, la que el audit de color venía pidiendo.
 *
 * Ojo: chamoy y mango con chile comparten color en el diseño original.
 */
export const sabor = {
  jengibreYNaranja: '#7E4CB1',
  canela: '#7D0303',
  cardamomo: '#11676A',
  coriandro: '#C07038',
  mentaIntensa: '#7BBBD9',
  hierbabuena: '#6F8473',
  limoncillo: '#97C8A8',
  mangoConChile: '#CB3C41',
  pinaConChile: '#E18B22',
  limaYChile: '#1A6E43',
  fresasYChile: '#B42B18',
  chamoy: '#CB3C41',
  tamarindo: '#E77F44',
  salDeMar: '#6F4380',
  blancoConPistache: '#8D9B3E',
} as const

/**
 * LA PALETA DEL REDISEÑO (2026-08-13) — del proyecto de Marcos en
 * claude.ai/design (`docs/auditoria-diseno-v2.md`). El empaque es el
 * sistema: crema y tinta son el papel y el café del sello, el rojo es el
 * del personaje, el amarillo es el ticket cosido. Las bandas alternan
 * secciones; `oscuro` es el piso del menú y de la banda de polvo.
 *
 * `textoSuave` NO es el #8A6F5A del canvas: ese daba 4.01 sobre crema
 * (falla AA en 13.5px). Se oscureció a #7A604A = 5.01, el más cercano en
 * calidez que pasa. `tintaImpreso` es la tinta que las envolturas claras
 * usan de verdad (menta, limoncillo) — más honda que `tinta` y la que
 * hace legibles los sabores claros (ver `tintaSabor`).
 */
export const marca = {
  crema: '#F8ECDE',
  tinta: '#4C2C16',
  tintaImpreso: '#241505',
  rojo: '#CB3C41',
  rojoHover: '#B03338',
  rojoHondo: '#7D0303',
  amarillo: '#F4D261',
  bandaCalida: '#F3E4CA',
  bandaClara: '#FFF9EE',
  oscuro: '#33190A',
  textoSuave: '#7A604A',
  /**
   * Blanco puro — no un tono cálido de la paleta. `paresAprobados` (abajo)
   * ya lo usaba como literal `'#FFFFFF'` para «texto en botón rojo» y
   * «texto sobre banda oscura»: acá se nombra, para que cualquier CSS
   * —el panel, `src/styles/panel.css`— lo pueda pedir como
   * `--mrc-marca-blanco` en vez de escribir el hex a mano.
   */
  blanco: '#FFFFFF',
} as const

/**
 * QUÉ TINTA VA SOBRE CADA COLOR DE SABOR (medido 2026-08-13). El canvas
 * ponía blanco fijo y siete sabores fallaban AA (menta 2.11, limoncillo
 * 1.88…). Con blanco o `tintaImpreso` según el fondo, CATORCE de quince
 * pasan AA para texto normal. La única excepción es hierbabuena: su
 * mejor tinta da 4.41 — sobre hierbabuena solo va texto display (≥3.0),
 * nunca cuerpo. El test de tokens fija todo esto.
 */
export const tintaSabor: Record<keyof typeof sabor, string> = {
  jengibreYNaranja: '#FFFFFF', // 5.91
  canela: '#FFFFFF', // 11.13
  cardamomo: '#FFFFFF', // 6.62
  coriandro: marca.tintaImpreso, // 4.74
  mentaIntensa: marca.tintaImpreso, // 8.40
  hierbabuena: marca.tintaImpreso, // 4.41 — SOLO display
  limoncillo: marca.tintaImpreso, // 9.41
  mangoConChile: '#FFFFFF', // 4.93
  pinaConChile: marca.tintaImpreso, // 6.68
  limaYChile: '#FFFFFF', // 6.26
  fresasYChile: '#FFFFFF', // 6.36
  chamoy: '#FFFFFF', // 4.93 (comparte color con mango)
  tamarindo: marca.tintaImpreso, // 6.35
  salDeMar: '#FFFFFF', // 7.53
  blancoConPistache: marca.tintaImpreso, // 5.82
} as const

/** Sabores donde ninguna tinta llega a 4.5: texto display únicamente. */
export const saboresSoloDisplay = ['hierbabuena'] as const

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
  // Sistema editorial del sitio público (2026-08-12).
  { frente: editorial.papel, fondo: editorial.tinta, uso: 'texto sobre tinta', minimo: 'AAA' },
  { frente: editorial.humo, fondo: editorial.tinta, uso: 'texto secundario sobre tinta', minimo: 'AAA' },
  { frente: editorial.tinta, fondo: editorial.papel, uso: 'texto sobre papel', minimo: 'AAA' },
  { frente: editorial.sepia, fondo: editorial.papel, uso: 'texto secundario sobre papel', minimo: 'AA' },
  { frente: editorial.tinta, fondo: editorial.papelHueso, uso: 'texto sobre papel hueso', minimo: 'AAA' },
  // Rediseño de marca (2026-08-13). Los pares texto-sobre-sabor viven en
  // tintaSabor y su propio test (hierbabuena es display-only y acá no cabe).
  { frente: marca.tinta, fondo: marca.crema, uso: 'texto sobre crema', minimo: 'AAA' },
  { frente: marca.tinta, fondo: marca.bandaCalida, uso: 'texto sobre banda cálida', minimo: 'AAA' },
  { frente: marca.tinta, fondo: marca.bandaClara, uso: 'texto sobre banda clara', minimo: 'AAA' },
  { frente: marca.textoSuave, fondo: marca.crema, uso: 'texto secundario sobre crema', minimo: 'AA' },
  { frente: '#FFFFFF', fondo: marca.rojo, uso: 'texto en botón rojo', minimo: 'AA' },
  { frente: '#FFFFFF', fondo: marca.rojoHover, uso: 'texto en botón rojo (hover)', minimo: 'AA' },
  { frente: marca.rojoHondo, fondo: marca.amarillo, uso: 'texto del ticket amarillo', minimo: 'AAA' },
  { frente: marca.tinta, fondo: marca.amarillo, uso: 'texto tinta sobre amarillo', minimo: 'AAA' },
  { frente: marca.amarillo, fondo: marca.oscuro, uso: 'acento amarillo sobre banda oscura', minimo: 'AAA' },
  { frente: '#FFFFFF', fondo: marca.oscuro, uso: 'texto sobre banda oscura', minimo: 'AAA' },
  { frente: marca.crema, fondo: marca.oscuro, uso: 'texto crema sobre banda oscura', minimo: 'AAA' },
  { frente: marca.rojoHondo, fondo: marca.crema, uso: 'acento rojo hondo sobre crema', minimo: 'AAA' },
] as const satisfies ReadonlyArray<{
  frente: string; fondo: string; uso: string; minimo: NivelWcag
}>

export const paresProhibidos = [
  { frente: fijos.crema, fondo: verde[500], razon: 'da 4.25, no llega a 4.5' },
  { frente: tan[500], fondo: verde[500], razon: 'da 2.89, falla fuerte' },
] as const

/**
 * Los 36 del sistema de identidad (proyecto 1). `empaque`, `etiqueta` y
 * `editorial` quedan afuera a propósito: son capas posteriores medidas
 * del producto real y del logo nuevo, con su propia verificación.
 */
export function todosLosColores(): string[] {
  return [
    ...Object.values(verde), ...Object.values(tan),
    ...Object.values(rosa), ...Object.values(fijos),
  ]
}
