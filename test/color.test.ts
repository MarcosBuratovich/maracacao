import { describe, it, expect } from 'vitest'
import { contrastRatio, nivelWcag } from '@/tokens/contrast'
import {
  verde, tan, paresAprobados, paresProhibidos, todosLosColores,
} from '@/tokens/color'

describe('rampas', () => {
  it('verde y tan tienen los diez pasos', () => {
    const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
    expect(Object.keys(verde).map(Number).sort((a, b) => a - b)).toEqual(pasos)
    expect(Object.keys(tan).map(Number).sort((a, b) => a - b)).toEqual(pasos)
  })

  it('el verde oscurece monótonamente de 50 a 900', () => {
    const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    const lum = pasos.map((p) => contrastRatio(verde[p], '#000000'))
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1])
  })

  it('todos los hex están normalizados a mayúsculas con almohadilla', () => {
    for (const c of todosLosColores()) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('el 500 del verde es el color medido del render', () => {
    expect(verde[500]).toBe('#5B744B')
  })
})

describe('pares aprobados', () => {
  it('no está vacío', () => expect(paresAprobados.length).toBeGreaterThan(0))

  it.each(paresAprobados)(
    '$uso — $frente sobre $fondo alcanza al menos $minimo',
    ({ frente, fondo, minimo }) => {
      const ratio = contrastRatio(frente, fondo)
      const orden = { falla: 0, 'AA-grande': 1, AA: 2, AAA: 3 } as const
      expect(orden[nivelWcag(ratio)]).toBeGreaterThanOrEqual(orden[minimo])
    },
  )

  it('ningún par aprobado para texto queda por debajo de 4.5', () => {
    for (const p of paresAprobados) {
      if (p.minimo === 'AA' || p.minimo === 'AAA') {
        expect(contrastRatio(p.frente, p.fondo)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('pares prohibidos', () => {
  it.each(paresProhibidos)(
    '$frente sobre $fondo efectivamente no llega a 4.5 ($razon)',
    ({ frente, fondo }) => {
      expect(contrastRatio(frente, fondo)).toBeLessThan(4.5)
    },
  )

  it('ningún par prohibido aparece en la lista de aprobados', () => {
    // Se comparan por clave, no campo a campo. Como los dos arrays son
    // `as const`, TypeScript estrecha los hex a tipos literales y declara
    // que la comparación nunca puede ser verdadera (ts2367) — o sea, prueba
    // estáticamente lo mismo que este test verifica en runtime, y de paso
    // rompe el build. Concatenar a string ensancha el tipo y deja el test
    // vivo como red contra futuras ediciones de las listas.
    const clave = (p: { frente: string; fondo: string }) => `${p.frente}|${p.fondo}`
    const aprobadas = paresAprobados.map(clave)
    for (const p of paresProhibidos) {
      expect(aprobadas).not.toContain(clave(p))
    }
  })
})
