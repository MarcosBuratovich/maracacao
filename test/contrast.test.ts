import { describe, it, expect } from 'vitest'
import { contrastRatio, nivelWcag, relativeLuminance } from '@/tokens/contrast'

describe('relativeLuminance', () => {
  it('el negro es 0', () => expect(relativeLuminance('#000000')).toBe(0))
  it('el blanco es 1', () => expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5))

  describe('validación de entrada', () => {
    it('rechaza hex de largo incorrecto (5 dígitos)', () => {
      expect(() => relativeLuminance('#12345')).toThrow('Hex inválido')
    })
    it('rechaza hex de largo incorrecto (7 dígitos)', () => {
      expect(() => relativeLuminance('#1234567')).toThrow('Hex inválido')
    })
    it('rechaza shorthand de 3 dígitos', () => {
      expect(() => relativeLuminance('#fff')).toThrow('Hex inválido')
    })
    it('rechaza 8 dígitos con alfa', () => {
      expect(() => relativeLuminance('#FFFFFFFF')).toThrow('Hex inválido')
    })
    it('rechaza caracteres no hexadecimales', () => {
      expect(() => relativeLuminance('#GGGGGG')).toThrow('Hex inválido')
    })
    it('rechaza string vacío', () => {
      expect(() => relativeLuminance('')).toThrow('Hex inválido')
    })
    it('rechaza null con error documentado', () => {
      // TypeScript cast necesario: la firma dice string, pero validamos en runtime
      expect(() => relativeLuminance(null as unknown as string)).toThrow('Hex inválido')
    })
    it('rechaza undefined con error documentado', () => {
      // TypeScript cast necesario: la firma dice string, pero validamos en runtime
      expect(() => relativeLuminance(undefined as unknown as string)).toThrow('Hex inválido')
    })
    it('rechaza number con error documentado', () => {
      // TypeScript cast necesario: la firma dice string, pero validamos en runtime
      expect(() => relativeLuminance(123456 as unknown as string)).toThrow('Hex inválido')
    })
  })
})

describe('contrastRatio', () => {
  it('negro contra blanco es 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })
  it('es simétrico', () => {
    expect(contrastRatio('#372915', '#FAF3E0'))
      .toBeCloseTo(contrastRatio('#FAF3E0', '#372915'), 10)
  })
  it('acepta hex con y sin almohadilla', () => {
    expect(contrastRatio('372915', 'FAF3E0')).toBeCloseTo(12.72, 1)
  })
})

describe('nivelWcag', () => {
  it.each([
    [21, 'AAA'], [7, 'AAA'], [6.31, 'AA'], [4.5, 'AA'],
    [4.25, 'AA-grande'], [3, 'AA-grande'], [2.89, 'falla'], [1, 'falla'],
  ] as const)('%s → %s', (ratio, esperado) => {
    expect(nivelWcag(ratio)).toBe(esperado)
  })
})
