export type NivelWcag = 'AAA' | 'AA' | 'AA-grande' | 'falla'

function canal(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Hex inválido: ${hex}. Se esperan 6 dígitos.`)
  }
  const r = canal(parseInt(h.slice(0, 2), 16))
  const g = canal(parseInt(h.slice(2, 4), 16))
  const b = canal(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function nivelWcag(ratio: number): NivelWcag {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-grande'
  return 'falla'
}
