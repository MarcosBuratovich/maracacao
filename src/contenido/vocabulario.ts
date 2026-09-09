/*
 * Las dos listas de palabras prohibidas, separadas a propósito.
 *
 * MARCA salió de la retro del cliente (2026-08-05) y aplica al copy del
 * sitio Y a los mensajes del panel: son palabras que la marca no usa,
 * en ningún lado.
 *
 * MAQUETA es un guard anti-borrador que aplica SOLO al sitio publicado.
 * Si el panel compartiera una lista sola, tendría prohibida la palabra
 * «Borrador» — que es justamente su concepto central.
 */
export const MARCA = [
  'mono',
  'chango',
  'changuito',
  'chispa',
  'carrito',
  'pistachos',
  'cacahuete',
  'maní',
  'packaging',
  'snack',
  'smoothie',
] as const

export const MAQUETA = ['borrador', 'pendiente', 'te avisamos', 'lorem'] as const

// `\b` de JavaScript es ASCII: entre «n» e «í» ve una frontera, así que
// `\bmaní\b` matchearía adentro de cualquier palabra con acento. Se
// declara el alfabeto a mano para que «monocromo» y «un chispazo de
// sabor» no cuenten como la palabra prohibida, pero «monos» y «los
// carritos» (su plural) sí.
const LETRA = 'a-záéíóúñü'

/** La primera palabra de MARCA que aparece en el texto, o null. */
export function palabraProhibida(texto: string): string | null {
  for (const palabra of MARCA) {
    const re = new RegExp(`(^|[^${LETRA}])${palabra}s?($|[^${LETRA}])`, 'i')
    if (re.test(texto)) return palabra
  }
  return null
}
