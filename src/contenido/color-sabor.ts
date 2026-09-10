/*
 * La regla de contraste, en un solo lugar.
 *
 * Hoy vive repartida: `contrastRatio` en los tokens y una lista de
 * excepciones (`saboresSoloDisplay`) al lado. Cuando la clienta pueda dar
 * de alta un sabor (fase 7), el color nuevo va a tener que pasar por acá.
 */
import { contrastRatio } from '../tokens/contrast'
import { sabor, tintaSabor, saboresSoloDisplay } from '../tokens/color'

export const resuelveColor = (clave: string): string | undefined =>
  (sabor as Record<string, string>)[clave]

/** La tinta declarada para ese sabor. */
export const mejorTinta = (clave: string): string | undefined =>
  (tintaSabor as Record<string, string>)[clave]

/**
 * ¿Se puede poner texto normal sobre esa banda?
 *
 * El umbral es 4.5 (AA). La excepción es por SLUG y sale de
 * `saboresSoloDisplay` en los tokens: hierbabuena da 4.41 medido y está
 * declarada ahí. La regla la hereda; no la reinventa ni la pisa.
 */
export function contrasteSuficiente(fondo: string, tinta: string, slug: string): boolean {
  if ((saboresSoloDisplay as readonly string[]).includes(slug)) return true
  return contrastRatio(fondo, tinta) >= 4.5
}
