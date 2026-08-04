import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Mascota from '@/components/brand/Mascota.astro'
import { amplitudes } from '@/tokens/motion'

const css = readFileSync('src/styles/mascota-ambiental.css', 'utf8')
const container = await AstroContainer.create()

describe('animación ambiental', () => {
  it.each(['respiracion', 'parpadeo', 'cola'])('define el keyframe %s', (n) => {
    expect(css).toMatch(new RegExp(`@keyframes\\s+${n}\\b`))
  })

  it('la respiración usa la amplitud del token', () => {
    expect(css).toContain(`scale(${amplitudes.respiracionEscala})`)
  })

  it('la cola usa los grados del token', () => {
    expect(css).toContain(`${amplitudes.colaGrados}deg`)
  })

  it('las duraciones salen de custom properties, no están hardcodeadas', () => {
    const duracionesCrudas = css.match(/animation:[^;]*\b\d+(\.\d+)?s\b/g) ?? []
    expect(duracionesCrudas).toEqual([])
    expect(css).toContain('var(--mrc-dur-ambiental)')
  })

  it('apaga por completo con prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    const bloque = css.slice(css.indexOf('prefers-reduced-motion'))
    expect(bloque).toContain('animation: none')
    expect(bloque).not.toContain('animation-duration: 0.01')
  })

  it('cada parte animada usa su pivote, no el centro de la caja', () => {
    for (const parte of ['cola', 'cabeza']) {
      expect(css).toMatch(new RegExp(`#${parte}[^{]*\\{[^}]*transform-origin:`))
    }
  })
})

describe('<Mascota/>', () => {
  it('renderiza el SVG inline sin la capa de pivotes', async () => {
    const html = await container.renderToString(Mascota)
    expect(html).toContain('<svg')
    expect(html).not.toContain('id="pivotes"')
  })
})
