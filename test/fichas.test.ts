/*
 * Las fichas técnicas: la plantilla compartida que consume pnpm fichas
 * y, desde 2026-09-02, la página pública /fichas-tecnicas que las hace
 * legibles en el sitio con su PDF descargable. (El generador en línea
 * /fichas se eliminó el 2026-08-18 — el cliente recibe la plantilla
 * Word de scripts/genera-plantilla-docx.py.)
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { fichaHtml } from '@/fichas/plantilla'
import { fichasBase } from '@/fichas/base'
import { marca } from '@/copy/sitio-marca'
import FichasTecnicas from '@/pages/fichas-tecnicas.astro'
import Home from '@/pages/index.astro'

const container = await AstroContainer.create()

describe('la plantilla de fichas', () => {
  it('las cuatro fichas oficiales existen y rinden documento completo', () => {
    // barras/gotas · chocolate en polvo (corregida 2026-08-19) · cocoa
    // natural · cocoa alcalina (especificaciones industriales B2B).
    expect(fichasBase).toHaveLength(4)
    for (const ficha of fichasBase) {
      const html = fichaHtml(ficha, '/fonts', '<svg></svg>')
      expect(html).toContain('MARACACAO')
      expect(html).toContain(ficha.producto)
      expect(html).toContain('@maracacaomx')
    }
  })

  it('el contenido se escapa: nada de HTML inyectado', () => {
    const html = fichaHtml(
      {
        archivo: 'x',
        producto: '<script>alert(1)</script>',
        denominacion: 'a & b',
        acento: '#7D0303',
        meta: [['K', '<b>v</b>']],
        secciones: [{ titulo: 'T', bloques: [{ tipo: 'parrafo', texto: '<img src=x>' }] }],
      },
      '/fonts',
      '<svg></svg>',
    )
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el generador en línea quedó eliminado', () => {
    expect(existsSync('src/pages/fichas.astro')).toBe(false)
  })
})

describe('la página /fichas-tecnicas (2026-09-02): legibles en el sitio', () => {
  it('rinde las cuatro fichas completas desde la fuente única, sin candado ni noindex', async () => {
    const html = await container.renderToString(FichasTecnicas)
    for (const f of fichasBase) {
      expect(html).toContain(`id="${f.archivo.replace('ficha-tecnica-', '')}"`)
      expect(html).toMatch(new RegExp(`<h2[^>]*>${f.producto}</h2>`))
      expect(html).toContain(`href="${marca.fichasTecnicas.rutaPdf}/${f.archivo}.pdf"`)
    }
    // Datos duros servidos como texto: alérgenos y tabla nutrimental.
    expect(html).toContain('Contiene soya. Puede contener leche y frutos de cáscara.')
    expect(html).toContain('Contenido energético')
    expect(html).not.toContain('data-candado')
    expect(html).not.toContain('name="robots"')
    expect(html).toContain(`<link rel="canonical" href="https://www.maracacao.mx${marca.fichasTecnicas.ruta}"`)
    expect(html).toContain(`<title>${marca.fichasTecnicas.titulo}</title>`)
  })

  it('cada PDF publicado existe en public/fichas (pnpm fichas escribe ahí)', () => {
    for (const f of fichasBase) expect(existsSync(`public/fichas/${f.archivo}.pdf`)).toBe(true)
    expect(readFileSync('scripts/genera-fichas.ts', 'utf8')).toContain("resolve(RAIZ, 'public/fichas')")
  })

  it('la home enlaza la página: bajo el semáforo de negocios y en el footer', async () => {
    const html = await container.renderToString(Home)
    const enlaces = html.match(new RegExp(`href="${marca.fichasTecnicas.ruta}"`, 'g')) ?? []
    expect(enlaces.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain(marca.negocios.fichasCta)
  })

  it('los PDF van noindex en Vercel: la página HTML es la cara indexable', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; headers: { key: string; value: string }[] }[]
    }
    const regla = vercel.headers.find((h) => h.source.startsWith('/fichas/'))
    expect(regla?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' })
  })
})
