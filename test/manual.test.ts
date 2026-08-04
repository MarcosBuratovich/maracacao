import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ruta } from '@/lib/rutas'

// Fix round 1/5: el escaneo de "sin string a mano" de este archivo solo
// miraba los .mdx — el <title> hardcodeado de index.astro y
// manual/[...slug].astro (Task 17, regla 1 de la §10.6: "ningún string
// visible dentro de un componente") pasó por ese hueco de cobertura. Este
// helper recorre un directorio recursivamente (incluye rutas dinámicas
// como manual/[...slug].astro) para cerrarlo. Nombre genérico —lo reusa
// también el guard de hex de más abajo (B2) sobre src/components/manual—
// aunque nació escaneando solo src/pages.
function archivosAstroEn(dir: string): string[] {
  const resultado: string[] = []
  for (const nombre of readdirSync(dir)) {
    const rutaEntrada = join(dir, nombre)
    if (statSync(rutaEntrada).isDirectory()) resultado.push(...archivosAstroEn(rutaEntrada))
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
    for (const archivo of archivosAstroEn('src/pages')) {
      const contenido = readFileSync(archivo, 'utf8')
      expect(contenido, `${archivo} hardcodea titulo="..."`).not.toMatch(/\btitulo="/)
    }
  })
})

// B2 (review final, Important): el guard de hex a mano de arriba
// ("contenido del manual") solo escaneaba src/content/manual/*.mdx.
// Rampa.astro (src/components/manual/) hardcodeaba '#FAF3E0'/'#372915' en
// vez de leer fijos.papel/fijos.tinta de @/tokens/color — falsificando el
// criterio de aceptación 4 del spec ("un solo lugar define los colores")
// justo en el componente que dibuja las rampas de color del propio
// manual. A diferencia del guard de MDX, acá NO se descarta el
// frontmatter: en un .astro el bloque `---...---` es código TypeScript,
// no metadata, y es exactamente donde vivía el bug (un hex dentro de un
// ternario JS que arma un `style="color:...`).
describe('guard de hex a mano fuera de content/manual (B2)', () => {
  const dirs = ['src/components/manual', 'src/pages']

  it.each(dirs)('ningún .astro de %s escribe un hex a mano — se lee de los tokens', (dir) => {
    for (const archivo of archivosAstroEn(dir)) {
      const contenido = readFileSync(archivo, 'utf8')
      const hex = contenido.match(/#[0-9A-Fa-f]{6}\b/g) ?? []
      expect(hex, `${archivo} hardcodea: ${hex.join(', ')}`).toEqual([])
    }
  })
})
