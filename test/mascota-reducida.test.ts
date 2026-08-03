import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados, atributosDeTrazo } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota-reducida.svg')

describe('mascota reducida', () => {
  it('es cuadrada, 512', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 512 512')
  })

  it('tiene 12 formas o menos — si no, no se lee a 32 px', () => {
    expect(doc.querySelectorAll('path, circle, ellipse, rect').length)
      .toBeLessThanOrEqual(12)
  })

  it('no arrastra partes que no son la cabeza', () => {
    for (const id of ['bowl', 'cola', 'granos-orbita', 'suelo', 'brazo-l', 'chispas']) {
      expect(doc.querySelector(`[id="${id}"]`)).toBeNull()
    }
  })

  it('el trazo es proporcionalmente más grueso que en la mascota completa', () => {
    // Se lee con el helper compartido de la Task 4, que resuelve tanto el
    // atributo del elemento como el valor que llega por clase CSS.
    // Reimplementar la lectura acá dejaría dos definiciones de "grosor de
    // trazo" conviviendo, y en cuanto una cambie la otra miente.
    const anchos = atributosDeTrazo(doc)
      .map((t) => Number(t.width))
      .filter((n) => Number.isFinite(n) && n > 0)
    expect(anchos.length).toBeGreaterThan(0)
    // 11/1024 = 0.0107 ; el objetivo es al menos 14/512 = 0.027
    expect(Math.max(...anchos) / 512).toBeGreaterThan(0.025)
  })

  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})
