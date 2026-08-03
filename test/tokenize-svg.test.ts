import { describe, it, expect } from 'vitest'
import { nombreDeToken, tokenizarSvg } from '@/lib/tokenize-svg'
import { readFileSync } from 'node:fs'

describe('nombreDeToken', () => {
  it('resuelve un paso de rampa', () => expect(nombreDeToken('#5B744B')).toBe('verde-500'))
  it('resuelve un color fijo', () => expect(nombreDeToken('#372915')).toBe('tinta'))
  it('es insensible a mayúsculas', () => expect(nombreDeToken('#5b744b')).toBe('verde-500'))
  it('devuelve null si no es del sistema', () => expect(nombreDeToken('#123456')).toBeNull())
})

describe('tokenizarSvg', () => {
  it('reemplaza hex por var() con fallback', () => {
    expect(tokenizarSvg('<path fill="#5B744B"/>'))
      .toBe('<path fill="var(--mrc-verde-500, #5B744B)"/>')
  })

  it('deja intactos los hex que no son del sistema', () => {
    expect(tokenizarSvg('<path fill="#123456"/>')).toBe('<path fill="#123456"/>')
  })

  it('tokeniza también dentro de un bloque <style>', () => {
    const salida = tokenizarSvg('<style>.t{stroke:#372915}</style>')
    expect(salida).toContain('var(--mrc-tinta, #372915)')
  })

  it('la mascota real queda sin ningún hex crudo fuera de los fallbacks', () => {
    const salida = tokenizarSvg(readFileSync('src/assets/brand/mascota.svg', 'utf8'))
    const crudos = [...salida.matchAll(/#[0-9A-Fa-f]{6}/g)]
      .filter((m) => {
        const antes = salida.slice(Math.max(0, m.index! - 40), m.index!)
        return !antes.includes('var(--mrc-')
      })
    expect(crudos).toEqual([])
  })
})
