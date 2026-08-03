import { verde, tan, fijos, roles } from './color'
import { familias, escala } from './type'
import { duraciones, easings } from './motion'

export function customProperties(): Record<string, string> {
  const props: Record<string, string> = {}
  for (const [paso, hex] of Object.entries(verde)) props[`--mrc-verde-${paso}`] = hex
  for (const [paso, hex] of Object.entries(tan)) props[`--mrc-tan-${paso}`] = hex
  for (const [nombre, hex] of Object.entries(fijos)) props[`--mrc-${nombre}`] = hex
  for (const [rol, hex] of Object.entries(roles)) props[`--mrc-rol-${rol}`] = hex
  for (const [nombre, valor] of Object.entries(familias)) props[`--mrc-font-${nombre}`] = valor
  for (const [nombre, valor] of Object.entries(escala)) props[`--mrc-text-${nombre}`] = valor
  for (const [nombre, ms] of Object.entries(duraciones)) props[`--mrc-dur-${nombre}`] = `${ms}ms`
  for (const [nombre, valor] of Object.entries(easings)) props[`--mrc-ease-${nombre}`] = valor
  return props
}

export function bloqueTheme(): string {
  const lineas = Object.entries(customProperties())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `@theme {\n${lineas}\n}\n`
}
