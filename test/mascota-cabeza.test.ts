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

describe('cabeza — técnica de relleno', () => {
  // La review de la Task 7 fijó esta técnica: las clases `.t-*` definen SOLO
  // trazo y el relleno va como atributo plano, para que la importación a Rive
  // no dependa de la cascada CSS. Los dos modos de romperla son silenciosos y
  // catastróficos, así que van con red:
  //   - si una clase vuelve a declarar `fill`, le gana al atributo de
  //     presentación y todas esas formas se dibujan huecas;
  //   - si una forma con clase se queda sin `fill`, cae al negro inicial
  //     de SVG y se dibuja como una mancha sólida.
  const estilo = doc.querySelector('style')?.textContent ?? ''

  it.each(['t-principal', 't-interior', 't-fino'])(
    '.%s define trazo y no declara fill',
    (clase) => {
      const bloque = estilo.match(new RegExp(`\\.${clase}\\s*\\{([^}]*)\\}`))?.[1]
      expect(bloque).toBeDefined()
      expect(bloque).toMatch(/\bstroke\s*:/)
      expect(bloque).not.toMatch(/\bfill\s*:/)
    },
  )

  it('toda forma con clase de trazo lleva un fill explícito', () => {
    const conClase = [...grupo('cabeza').querySelectorAll('[class]')]
    expect(conClase.length).toBeGreaterThan(0)
    for (const el of conClase) {
      expect(el.getAttribute('fill')).toMatch(/^(none|#[0-9A-F]{6})$/)
    }
  })

  it('no queda ningún relleno por style inline', () => {
    expect([...grupo('cabeza').querySelectorAll('[style]')]).toHaveLength(0)
  })
})

describe('cabeza — geometría horneada', () => {
  // El reescalado al presupuesto vertical se horneó en las coordenadas. Un
  // `transform` sobreviviente movería el dibujo respecto de sus pivotes, que
  // son coordenadas absolutas.
  it('ni la cabeza ni sus formas usan transform', () => {
    expect(grupo('cabeza').hasAttribute('transform')).toBe(false)
    expect([...grupo('cabeza').querySelectorAll('[transform]')]).toHaveLength(0)
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
