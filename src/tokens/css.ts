import { verde, tan, rosa, fijos, roles, empaque, etiqueta, editorial, sabor, marca, tintaSabor } from './color'
import { familias, escala } from './type'
import { duraciones, easings } from './motion'

export function customProperties(): Record<string, string> {
  const props: Record<string, string> = {}
  for (const [paso, hex] of Object.entries(verde)) props[`--mrc-verde-${paso}`] = hex
  for (const [paso, hex] of Object.entries(tan)) props[`--mrc-tan-${paso}`] = hex
  for (const [paso, hex] of Object.entries(rosa)) props[`--mrc-rosa-${paso}`] = hex
  for (const [nombre, hex] of Object.entries(fijos)) props[`--mrc-${nombre}`] = hex
  for (const [nombre, hex] of Object.entries(empaque)) props[`--mrc-empaque-${nombre}`] = hex
  for (const [nombre, hex] of Object.entries(etiqueta)) props[`--mrc-etiqueta-${nombre}`] = hex
  for (const [nombre, hex] of Object.entries(sabor)) props[`--mrc-sabor-${nombre}`] = hex
  // Prefijo `ed-` obligatorio: `editorial.papel` y `fijos.papel` son
  // colores distintos y sin prefijo el segundo pisaría al primero,
  // rompiendo el manual y la presentación (que usan --mrc-papel).
  for (const [nombre, hex] of Object.entries(editorial)) props[`--mrc-ed-${nombre}`] = hex
  // Rediseño 2026-08-13: mismo motivo, prefijo propio. `marca.crema` y
  // `marca.amarillo` chocarían con `fijos.crema`/`fijos.amarillo`.
  for (const [nombre, hex] of Object.entries(marca)) props[`--mrc-marca-${nombre}`] = hex
  for (const [nombre, hex] of Object.entries(tintaSabor)) props[`--mrc-tinta-sabor-${nombre}`] = hex
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
  return `@theme static {\n${lineas}\n}\n`
}
