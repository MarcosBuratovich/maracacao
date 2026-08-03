import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados, padreDe, idsDeGrupos } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!
const formas = (id: string) =>
  grupo(id).querySelectorAll('path, circle, ellipse, rect').length

describe('torso y brazos — contenido', () => {
  it.each(['cuerpo', 'brazo-l', 'mano-l', 'brazo-r', 'mano-r'])(
    '#%s tiene al menos una forma', (id) => expect(formas(id)).toBeGreaterThan(0),
  )

  it('la mano izquierda se pinta después de la cabeza — lleva el pistache a la boca', () => {
    // Cerrado contra la referencia (§9.2 del spec): en el packaging la mano
    // va por delante de la cara. En Rive se emparenta al hueso del brazo;
    // acá vive después de #cabeza por orden de pintado.
    expect(padreDe(doc, 'mano-l')).toBe('mono')
    const orden = idsDeGrupos(doc)
    expect(orden.indexOf('mano-l')).toBeGreaterThan(orden.indexOf('cabeza'))
  })

  it('la mano derecha vive dentro del brazo derecho', () => {
    expect(grupo('mano-r').closest('g[id="brazo-r"]')).not.toBeNull()
  })
})

describe('torso y brazos — paleta', () => {
  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('torso y brazos — pivotes ubicados', () => {
  it.each(['piv-brazo-l', 'piv-mano-l', 'piv-brazo-r', 'piv-mano-r'])(
    '%s dejó de estar en el origen', (id) => {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    },
  )

  it('los pivotes de hombro están por encima de los de muñeca', () => {
    const y = (id: string) => Number(doc.querySelector(`[id="${id}"]`)!.getAttribute('cy'))
    expect(y('piv-brazo-l')).toBeLessThan(y('piv-mano-l'))
  })

  // Los hombros son anatomía simétrica: misma disciplina que los pares de la
  // cabeza (oreja/ojo), que suman 1024. Un hombro corrido rompe cualquier
  // animación que mueva los dos brazos en espejo.
  it('los dos hombros son espejo exacto sobre el eje x=512', () => {
    const c = (id: string, attr: string) =>
      Number(doc.querySelector(`[id="${id}"]`)!.getAttribute(attr))
    expect(c('piv-brazo-l', 'cx') + c('piv-brazo-r', 'cx')).toBe(1024)
    expect(c('piv-brazo-l', 'cy')).toBe(c('piv-brazo-r', 'cy'))
  })
})

describe('torso y brazos — técnica de relleno', () => {
  // Mismo contrato que la cabeza (fijado en la review de la Task 7): las
  // clases `.t-*` definen SOLO trazo y el relleno va como atributo plano.
  // Si una forma se queda sin `fill`, cae al negro inicial de SVG y se
  // dibuja como una mancha sólida; si vuelve un `style` inline, el color
  // deja de sobrevivir a una importación que ignore estilos.
  const GRUPOS = ['cuerpo', 'brazo-l', 'mano-l', 'brazo-r'] as const

  it.each(GRUPOS)('toda forma de #%s con clase de trazo lleva fill explícito', (id) => {
    const conClase = [...grupo(id).querySelectorAll('[class]')]
    expect(conClase.length).toBeGreaterThan(0)
    for (const el of conClase) {
      expect(el.getAttribute('fill')).toMatch(/^(none|#[0-9A-F]{6})$/)
    }
  })

  it.each(GRUPOS)('#%s no usa style inline', (id) => {
    expect([...grupo(id).querySelectorAll('[style]')]).toHaveLength(0)
  })

  it.each(GRUPOS)('todo trazo de #%s usa una clase del sistema', (id) => {
    for (const el of grupo(id).querySelectorAll('[stroke], [class]')) {
      const cls = el.getAttribute('class') ?? ''
      if (el.hasAttribute('stroke') || cls.startsWith('t-')) {
        expect(cls).toMatch(/^t-(principal|interior|fino)$/)
      }
    }
  })

  it.each(GRUPOS)('ninguna forma de #%s simula contorno con relleno', (id) => {
    for (const el of grupo(id).querySelectorAll('[class]')) {
      expect(el.getAttribute('fill')).not.toBe('#372915')
    }
  })
})

describe('torso y brazos — geometría horneada', () => {
  // Las coordenadas son absolutas y los pivotes también. Un `transform`
  // sobreviviente (por ejemplo el de la prueba del brazo) mueve el dibujo
  // respecto de su pivote.
  it.each(['cuerpo', 'brazo-l', 'mano-l', 'brazo-r', 'mano-r'])(
    'ni #%s ni sus formas usan transform', (id) => {
      expect(grupo(id).hasAttribute('transform')).toBe(false)
      for (const el of grupo(id).querySelectorAll('*')) {
        expect(el.hasAttribute('transform')).toBe(false)
      }
    },
  )
})

describe('torso y brazos — presupuesto vertical', () => {
  // El torso arranca bajo el mentón (y=258) y la cadera queda ≈ y 560, con
  // las piernas de la Task 9 saliendo de ahí. Se mide sobre la caja del
  // path del torso, no sobre el render: es el contrato con la Task 9.
  const numeros = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const ys = (d: string) => numeros(d).filter((_, i) => i % 2 === 1)

  it('el torso llega a la cadera y no se pasa del presupuesto', () => {
    const d = doc.querySelector('[id="torso-forma"]')!.getAttribute('d')!
    const maxY = Math.max(...ys(d))
    expect(maxY).toBeGreaterThan(540)
    expect(maxY).toBeLessThan(620)
  })

  it('el torso arranca por encima del mentón para que no se vea la costura', () => {
    const d = doc.querySelector('[id="torso-forma"]')!.getAttribute('d')!
    expect(Math.min(...ys(d))).toBeLessThan(258)
  })
})
