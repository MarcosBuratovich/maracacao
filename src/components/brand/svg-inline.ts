import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tokenizarSvg } from '@/lib/tokenize-svg'

/** Lee un SVG de marca, lo tokeniza y le saca la capa de pivotes. */
export function svgDeMarca(nombre: string): string {
  const ruta = fileURLToPath(new URL(`../../assets/brand/${nombre}.svg`, import.meta.url))
  const crudo = readFileSync(ruta, 'utf8')
  const sinPivotes = crudo.replace(/<g id="pivotes">[\s\S]*?<\/g>\s*/g, '')
  return tokenizarSvg(sinPivotes)
}
