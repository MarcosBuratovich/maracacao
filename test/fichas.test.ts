/*
 * Las fichas técnicas: la plantilla compartida que consume pnpm fichas.
 * (El generador en línea /fichas se eliminó el 2026-08-18 — el cliente
 * recibe la plantilla Word de scripts/genera-plantilla-docx.py.)
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fichaHtml } from '@/fichas/plantilla'
import { fichasBase } from '@/fichas/base'

describe('la plantilla de fichas', () => {
  it('las dos fichas oficiales existen y rinden documento completo', () => {
    expect(fichasBase).toHaveLength(2)
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
