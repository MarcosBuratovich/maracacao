import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const css = () => readFileSync('src/styles/fuentes.css', 'utf8')

describe('fuentes', () => {
  it('los woff2 existen y no están vacíos', () => {
    const archivos = readdirSync('public/fonts').filter((f) => f.endsWith('.woff2'))
    expect(archivos.length).toBeGreaterThanOrEqual(2)
    for (const f of archivos) {
      expect(statSync(`public/fonts/${f}`).size).toBeGreaterThan(1000)
    }
  })

  it('declara las dos familias', () => {
    expect(css()).toContain("font-family: 'Fraunces Variable'")
    expect(css()).toContain("font-family: 'Work Sans Variable'")
  })

  it('usa font-display: swap', () => {
    const bloques = css().match(/@font-face\s*\{[^}]*\}/g) ?? []
    expect(bloques.length).toBeGreaterThanOrEqual(2)
    for (const b of bloques) expect(b).toContain('font-display: swap')
  })

  it('no queda ninguna referencia a Google Fonts', () => {
    for (const ruta of ['src/styles/fuentes.css', 'src/layouts/Base.astro']) {
      expect(readFileSync(ruta, 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    }
  })

  it('el layout precarga las dos fuentes', () => {
    const layout = readFileSync('src/layouts/Base.astro', 'utf8')
    const preloads = layout.match(/rel="preload"[^>]*as="font"/g) ?? []
    expect(preloads.length).toBeGreaterThanOrEqual(2)
  })
})
