import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { ruta } from '@/lib/rutas'

describe('helper de rutas', () => {
  it('arma rutas internas sin locale hoy', () => {
    expect(ruta('manual/color')).toBe('/manual/color')
  })
  it('normaliza barras de más', () => {
    expect(ruta('/manual/color/')).toBe('/manual/color')
  })
  it('la raíz es una sola barra', () => expect(ruta('')).toBe('/'))
})

describe('contenido del manual', () => {
  const archivos = readdirSync('src/content/manual').filter((f) => f.endsWith('.mdx'))

  it('cubre las secciones del spec', () => {
    const slugs = archivos.map((f) => f.replace('.mdx', ''))
    for (const s of ['color', 'tipografia', 'logo', 'mascota', 'animacion', 'referencias']) {
      expect(slugs).toContain(s)
    }
  })

  it('cada página declara título y orden', () => {
    for (const f of archivos) {
      const fm = readFileSync(`src/content/manual/${f}`, 'utf8')
      expect(fm).toMatch(/^---[\s\S]*titulo:/m)
      expect(fm).toMatch(/^---[\s\S]*orden:/m)
    }
  })

  it('ninguna página escribe un hex a mano — se leen de los tokens', () => {
    for (const f of archivos) {
      const cuerpo = readFileSync(`src/content/manual/${f}`, 'utf8').replace(/^---[\s\S]*?---/, '')
      const hex = cuerpo.match(/#[0-9A-Fa-f]{6}\b/g) ?? []
      expect(hex).toEqual([])
    }
  })

  it('ninguna página enlaza con href crudo', () => {
    for (const f of archivos) {
      const cuerpo = readFileSync(`src/content/manual/${f}`, 'utf8')
      expect(cuerpo).not.toMatch(/href="\/(?!\{)/)
    }
  })
})
