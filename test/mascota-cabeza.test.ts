import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!

const PARTES = ['craneo', 'rostro', 'oreja-l', 'oreja-r', 'ojo-l', 'ojo-r',
                'cachete-l', 'cachete-r', 'nariz', 'boca'] as const

describe('cabeza — contenido', () => {
  it.each(PARTES)('#%s tiene al menos una forma', (id) => {
    expect(grupo(id).querySelectorAll('path, circle, ellipse, rect').length)
      .toBeGreaterThan(0)
  })

  it('la boca tiene forma y lengua', () => {
    expect(doc.querySelector('[id="boca-forma"]')).not.toBeNull()
    expect(doc.querySelector('[id="lengua"]')).not.toBeNull()
  })
})

describe('cabeza — trazo', () => {
  it('ningún trazo del grupo usa contorno relleno', () => {
    for (const el of grupo('cabeza').querySelectorAll('[stroke]')) {
      // stroke real, no una forma rellena que simula contorno
      expect(el.getAttribute('fill')).not.toBe('#372915')
    }
  })

  it('todos los trazos usan una clase del sistema', () => {
    for (const el of grupo('cabeza').querySelectorAll('[stroke], [class]')) {
      const cls = el.getAttribute('class') ?? ''
      if (el.hasAttribute('stroke') || cls.startsWith('t-')) {
        expect(cls).toMatch(/^t-(principal|interior|fino)$/)
      }
    }
  })
})

describe('cabeza — paleta', () => {
  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('cabeza — pivotes ubicados', () => {
  it.each(['piv-cabeza', 'piv-oreja-l', 'piv-oreja-r', 'piv-ojo-l', 'piv-ojo-r'])(
    '%s dejó de estar en el origen',
    (id) => {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    },
  )

  it('los pivotes de los ojos caen dentro de la caja de la cabeza', () => {
    for (const id of ['piv-ojo-l', 'piv-ojo-r']) {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThanOrEqual(300)
      expect(Number(el.getAttribute('cx'))).toBeLessThanOrEqual(700)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThanOrEqual(90)
      expect(Number(el.getAttribute('cy'))).toBeLessThanOrEqual(420)
    }
  })
})
