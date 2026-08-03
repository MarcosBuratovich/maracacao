import { verde, tan, rosa, fijos } from '@/tokens/color'

const MAPA: ReadonlyMap<string, string> = new Map([
  ...Object.entries(verde).map(([p, hex]) => [hex.toUpperCase(), `verde-${p}`] as const),
  ...Object.entries(tan).map(([p, hex]) => [hex.toUpperCase(), `tan-${p}`] as const),
  ...Object.entries(rosa).map(([p, hex]) => [hex.toUpperCase(), `rosa-${p}`] as const),
  ...Object.entries(fijos).map(([n, hex]) => [hex.toUpperCase(), n] as const),
])

export function nombreDeToken(hex: string): string | null {
  return MAPA.get(hex.toUpperCase()) ?? null
}

export function tokenizarSvg(svg: string): string {
  // Lookbehind negativo: excluye hex ya precedidos por un fallback var(--mrc-
  // para que la función sea idempotente. Sin esto, aplicada dos veces envuelve
  // los hex dentro de los fallbacks: var(--mrc-tinta, var(--mrc-tinta, #372915))
  return svg.replace(/(?<!var\(--mrc-[a-z0-9-]+, )#[0-9A-Fa-f]{6}\b/g, (hex) => {
    const token = nombreDeToken(hex)
    return token ? `var(--mrc-${token}, ${hex.toUpperCase()})` : hex
  })
}
