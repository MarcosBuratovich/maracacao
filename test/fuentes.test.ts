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

  // El layout dejó de listar dos <link> fijos: precarga el par que
  // corresponda a la página (identidad o sitio, 2026-08-12). Lo que
  // importa sigue siendo que precargue woff2 propios y que cada juego
  // tenga sus dos familias.
  it('el layout precarga las fuentes de la página, sin CDN', () => {
    const layout = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(layout).toMatch(/rel="preload"[^>]*as="font"/)
    for (const f of [
      '/fonts/fraunces-variable.woff2', '/fonts/work-sans-variable.woff2',
      '/fonts/cormorant-garamond.woff2', '/fonts/jost.woff2',
    ]) {
      expect(layout).toContain(f)
    }
  })

  // Tipografía del sitio público: la del sello (2026-08-12).
  it('el sitio declara Cormorant Garamond y Jost, self-hosteadas y con swap', () => {
    const sitio = readFileSync('src/styles/fuentes-sitio.css', 'utf8')
    expect(sitio).toContain("font-family: 'Cormorant Garamond'")
    expect(sitio).toContain("font-family: 'Jost'")
    const bloques = sitio.match(/@font-face\s*\{[^}]*\}/g) ?? []
    expect(bloques.length).toBe(2)
    for (const b of bloques) {
      expect(b).toContain('font-display: swap')
      expect(b).toMatch(/url\('\/fonts\//)
    }
  })
})
