import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'
import { JERARQUIA, PIVOTES } from '@/assets/brand/jerarquia'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!
const formas = (id: string) =>
  grupo(id).querySelectorAll('path, circle, ellipse, rect').length

describe('mascota completa', () => {
  it('ningún grupo del contrato quedó vacío', () => {
    const vacios = JERARQUIA
      .filter((g) => !['escena', 'mono', 'bowl', 'pivotes'].includes(g.id))
      .filter((g) => formas(g.id) === 0)
      .map((g) => g.id)
    expect(vacios).toEqual([])
  })

  it('hay exactamente 14 granos en órbita, numerados con padding', () => {
    const granos = [...grupo('granos-orbita').querySelectorAll('[id^="grano-"]')]
      .map((el) => el.getAttribute('id')!)
    expect(granos).toHaveLength(14)
    for (const id of granos) expect(id).toMatch(/^grano-\d{2}$/)
    expect(new Set(granos).size).toBe(14)
  })

  it('hay exactamente 3 chispas', () => {
    expect(formas('chispas')).toBe(3)
  })

  it('cada grano declara su pivote como atributo transform-origin', () => {
    // Atributo de presentación de SVG 2, no style= — el archivo mantiene
    // cero style= (técnica fijada en las reviews de las Tasks 7 y 8). El
    // selector [transform] de los tests de "cero transform" no matchea
    // transform-origin, así que no colisionan.
    for (const el of grupo('granos-orbita').querySelectorAll('[id^="grano-"]')) {
      expect(el.getAttribute('transform-origin') ?? '').toMatch(/^\d+(\.\d+)?[ ,]\d+(\.\d+)?$/)
    }
  })
})

describe('mascota completa — técnica de relleno en los grupos de la Task 9', () => {
  // Misma red que `mascota-torso.test.ts` monta sobre torso y brazos, ahora
  // sobre lo que dibuja esta tarea. No es alcance de más: sin esto los ocho
  // grupos nuevos quedarían sin ninguna de las garantías que las reviews de
  // las Tasks 7 y 8 fijaron — una forma sin `fill` cae al negro inicial de
  // SVG y se pinta como mancha sólida, y un `style` inline deja de
  // sobrevivir a una importación que ignore estilos.
  const GRUPOS = [
    'suelo', 'granos-orbita', 'cola', 'pierna-apoyo', 'pie-apoyo',
    'pierna-post', 'pie-post', 'bowl-cuenco', 'bowl-contenido', 'bowl-borde',
    'chispas',
  ] as const
  // #chispas es el único sin trazo: son manchas planas, como la nariz y los
  // cachetes de la cabeza. En la referencia las rayitas del "¡mmm!" no
  // llevan contorno.
  const CON_TRAZO = GRUPOS.filter((g) => g !== 'chispas')

  it.each(GRUPOS)('toda forma de #%s lleva fill explícito', (id) => {
    const formas = [...grupo(id).querySelectorAll('path, circle, ellipse, rect')]
    expect(formas.length).toBeGreaterThan(0)
    for (const el of formas) {
      expect(el.getAttribute('fill')).toMatch(/^(none|#[0-9A-F]{6})$/)
    }
  })

  it.each(CON_TRAZO)('#%s dibuja su contorno con una clase, no a mano', (id) => {
    expect([...grupo(id).querySelectorAll('[class]')].length).toBeGreaterThan(0)
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

  it.each(GRUPOS)('ni #%s ni sus formas usan transform', (id) => {
    // `transform-origin` NO es `transform`: el selector de atributo es
    // exacto, así que el pivote declarado de cada grano no colisiona con
    // esta red (que existe para que no quede puesto el rotate de la
    // batería de rig).
    expect(grupo(id).hasAttribute('transform')).toBe(false)
    for (const el of grupo(id).querySelectorAll('*')) {
      expect(el.hasAttribute('transform')).toBe(false)
    }
  })
})

describe('mascota completa — presupuesto vertical y contrato de cadera', () => {
  const numeros = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const ys = (d: string) => numeros(d).filter((_, i) => i % 2 === 1)
  const d = (id: string) => doc.querySelector(`[id="${id}"]`)!.getAttribute('d')!
  const piv = (id: string, a: string) =>
    Number(doc.querySelector(`[id="piv-${id}"]`)!.getAttribute(a))

  it('la planta del pie de apoyo llega a y=956', () => {
    // El número del presupuesto vertical: corona y=64, planta y=956, figura
    // completa 4.6 cabezas. Se mide sobre el path, no sobre el render.
    expect(Math.max(...ys(d('pie-apoyo-forma')))).toBeCloseTo(956, 0)
  })

  it('el suelo y sus ondas no se pasan de y≈1004', () => {
    for (const el of grupo('suelo').querySelectorAll('path')) {
      expect(Math.max(...ys(el.getAttribute('d')!))).toBeLessThanOrEqual(1006)
    }
  })

  it('los dos pivotes de cadera son espejo exacto sobre el eje x=512', () => {
    // Misma disciplina que los hombros: una cadera corrida rompe cualquier
    // animación que mueva las dos piernas en espejo.
    expect(piv('pierna-apoyo', 'cx') + piv('pierna-post', 'cx')).toBe(1024)
    expect(piv('pierna-apoyo', 'cy')).toBe(piv('pierna-post', 'cy'))
  })

  it('las caderas están donde el torso las dejó (≈ y 560) y los tobillos más abajo', () => {
    for (const p of ['pierna-apoyo', 'pierna-post'] as const) {
      expect(piv(p, 'cy')).toBeGreaterThan(520)
      expect(piv(p, 'cy')).toBeLessThan(600)
    }
    expect(piv('pie-apoyo', 'cy')).toBeGreaterThan(piv('pierna-apoyo', 'cy'))
    expect(piv('pie-post', 'cy')).toBeGreaterThan(piv('pierna-post', 'cy'))
  })
})

describe('mascota completa — invariantes globales', () => {
  it('todo hex pertenece a los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })

  it('todos los pivotes están ubicados', () => {
    for (const id of Object.keys(PIVOTES)) {
      const el = doc.querySelector(`[id="piv-${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    }
  })

  it('sigue sin haber <text>, <use>, gradientes ni filtros', () => {
    expect(doc.querySelector('text')).toBeNull()
    expect(doc.querySelector('use')).toBeNull()
    expect(doc.body.innerHTML).not.toMatch(/<(linear|radial)Gradient|<filter\b/i)
  })
})
