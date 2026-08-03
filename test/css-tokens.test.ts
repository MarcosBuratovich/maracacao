import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { customProperties, bloqueTheme } from '@/tokens/css'
import { verde, fijos, todosLosColores } from '@/tokens/color'
import { duraciones } from '@/tokens/motion'
import { ejesFraunces } from '@/tokens/type'

describe('customProperties', () => {
  it('emite una propiedad por cada color del sistema', () => {
    const props = customProperties()
    for (const hex of todosLosColores()) {
      expect(Object.values(props)).toContain(hex)
    }
  })

  it('usa el prefijo --mrc- en todas las claves', () => {
    for (const k of Object.keys(customProperties())) expect(k).toMatch(/^--mrc-/)
  })

  it('los nombres de color coinciden con los que emite tokenizarSvg', () => {
    const props = customProperties()
    expect(props['--mrc-verde-500']).toBe(verde[500])
    expect(props['--mrc-tinta']).toBe(fijos.tinta)
  })

  it('incluye duraciones de movimiento con unidad', () => {
    const props = customProperties()
    expect(props['--mrc-dur-micro']).toMatch(/ms$/)
    expect(props['--mrc-dur-ambiental']).toMatch(/m?s$/)
  })
})

describe('bloqueTheme', () => {
  it('genera un @theme válido de Tailwind', () => {
    const css = bloqueTheme()
    expect(css.startsWith('@theme {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('--mrc-verde-500: #5B744B;')
  })

  it('el archivo generado coincide con bloqueTheme()', () => {
    const esperado = `/* GENERADO por pnpm tokens. No editar a mano. */\n${bloqueTheme()}`
    const actual = readFileSync('src/styles/tokens.generated.css', 'utf-8')
    expect(actual).toBe(esperado)
  })
})

describe('movimiento', () => {
  it('las duraciones respetan los rangos del spec', () => {
    expect(duraciones.micro).toBeGreaterThanOrEqual(120)
    expect(duraciones.micro).toBeLessThanOrEqual(200)
    expect(duraciones.gesto).toBeGreaterThanOrEqual(300)
    expect(duraciones.gesto).toBeLessThanOrEqual(500)
    expect(duraciones.ambiental).toBeGreaterThanOrEqual(3000)
    expect(duraciones.ambiental).toBeLessThanOrEqual(5000)
  })
})

describe('tipografía', () => {
  it('Fraunces arranca en SOFT 60 WONK 1, como fija el spec', () => {
    expect(ejesFraunces.SOFT).toBe(60)
    expect(ejesFraunces.WONK).toBe(1)
  })
})
