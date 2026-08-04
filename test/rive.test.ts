import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cargarSvg } from './svg-utils'
import { PIVOTES } from '@/assets/brand/jerarquia'

const spec = readFileSync('docs/rig-spec.md', 'utf8')
const tsx = readFileSync('src/components/brand/MascotaRive.tsx', 'utf8')

describe('rig-spec.md', () => {
  it.each(Object.keys(PIVOTES))('documenta el pivote de #%s', (id) => {
    expect(spec).toContain(`#${id}`)
  })

  it('lista las coordenadas reales de cada marcador', () => {
    const doc = cargarSvg('src/assets/brand/mascota.svg')
    for (const id of Object.keys(PIVOTES)) {
      const el = doc.querySelector(`[id="piv-${id}"]`)!
      expect(spec).toContain(`${el.getAttribute('cx')}, ${el.getAttribute('cy')}`)
    }
  })

  it('documenta los cuatro inputs de la state machine', () => {
    for (const input of ['hover', 'scrollY', 'celebrar', 'banda']) {
      expect(spec).toContain(input)
    }
  })

  it('documenta los cuatro estados', () => {
    for (const estado of ['Idle', 'Saluda', 'Come', 'Celebra']) {
      expect(spec).toContain(estado)
    }
  })

  it('avisa que la capa de pivotes se borra después de alinear', () => {
    expect(spec).toMatch(/borra|eliminar/i)
  })

  it('avisa explícitamente que #mano-l se reemparenta al hueso de brazo-l en Rive', () => {
    // Ledger: JERARQUIA reporta a #mano-l colgando de #mono (es el orden de
    // pintado, no el esqueleto). Si el rig-spec no lo dice en un lugar
    // imposible de saltear, el rigger cuelga la mano de #mono en Rive y el
    // brazo queda sin mano al moverse.
    expect(spec).toMatch(/mano-l/)
    expect(spec).toMatch(/brazo-l/)
    expect(spec).toMatch(/reempare|re-empare/i)
  })
})

describe('MascotaRive', () => {
  it('no monta bajo prefers-reduced-motion', () => {
    expect(tsx).toContain('prefers-reduced-motion')
  })

  it('parte del fallback y solo reemplaza cuando el .riv cargó', () => {
    expect(tsx).toMatch(/riveLoaded|isLoaded|hasLoaded/)
  })

  it('no importa Rive en el módulo de nivel superior de Astro', () => {
    const astro = readFileSync('src/components/brand/Mascota.astro', 'utf8')
    expect(astro).not.toContain('@rive-app')
    expect(astro).toContain('client:visible')
  })
})
