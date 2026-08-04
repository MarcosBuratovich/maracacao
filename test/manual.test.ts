import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ruta } from '@/lib/rutas'

// Fix round 1/5: el escaneo de "sin string a mano" de este archivo solo
// miraba los .mdx — el <title> hardcodeado de index.astro y
// manual/[...slug].astro (Task 17, regla 1 de la §10.6: "ningún string
// visible dentro de un componente") pasó por ese hueco de cobertura. Este
// helper recorre src/pages/ recursivamente (incluye rutas dinámicas como
// manual/[...slug].astro) para cerrarlo.
function archivosAstroEnPaginas(dir: string): string[] {
  const resultado: string[] = []
  for (const nombre of readdirSync(dir)) {
    const rutaEntrada = join(dir, nombre)
    if (statSync(rutaEntrada).isDirectory()) resultado.push(...archivosAstroEnPaginas(rutaEntrada))
    else if (nombre.endsWith('.astro')) resultado.push(rutaEntrada)
  }
  return resultado
}

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

describe('páginas de src/pages — sin <title> hardcodeado', () => {
  it('ningún .astro pasa titulo="..." como string literal a <Base> — tiene que venir de copy o del frontmatter', () => {
    for (const archivo of archivosAstroEnPaginas('src/pages')) {
      const contenido = readFileSync(archivo, 'utf8')
      expect(contenido, `${archivo} hardcodea titulo="..."`).not.toMatch(/\btitulo="/)
    }
  })
})
