/*
 * Guards de la capa de contenido.
 *
 * El primero es la constitución de la carpeta: `src/contenido/**` tiene que
 * poder correr en TRES lugares —el navegador de la clienta, la función
 * serverless y vitest— así que no puede tocar `node:*`, ni Astro, ni el
 * alias `@/` (que solo resuelven el bundler y vitest, no el navegador).
 * Sin este guard, la primera vez que alguien importe `node:fs` para una
 * comodidad, el panel deja de compilar en el navegador y nadie sabe por qué.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { MARCA, MAQUETA, palabraProhibida } from '../src/contenido/vocabulario'

describe('la capa de contenido', () => {
  it('src/contenido/ no importa node:, ni Astro, ni el alias @/', () => {
    const infractores: string[] = []
    const archivos = readdirSync('src/contenido', { recursive: true, encoding: 'utf8' })

    for (const archivo of archivos) {
      if (!archivo.endsWith('.ts')) continue
      const fuente = readFileSync(`src/contenido/${archivo}`, 'utf8')
      // Los comentarios quedan fuera: este mismo archivo los nombra.
      const codigo = fuente
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')

      const prohibidos = [
        [/from\s+['"]node:/, 'node:'],
        [/from\s+['"]astro/, 'astro'],
        [/from\s+['"]@\//, 'el alias @/'],
      ] as const

      for (const [patron, motivo] of prohibidos) {
        if (patron.test(codigo)) infractores.push(`${archivo} importa ${motivo}`)
      }
    }

    expect(infractores).toEqual([])
  })

  it('palabraProhibida encuentra la palabra, y no la encuentra donde no está', () => {
    // Las que tiene que cachar, incluidas las formas en plural.
    expect(palabraProhibida('el mono de la envoltura')).toBe('mono')
    expect(palabraProhibida('dos monos')).toBe('mono')
    expect(palabraProhibida('chispas de chocolate')).toBe('chispa')
    expect(palabraProhibida('agregá al carrito')).toBe('carrito')
    expect(palabraProhibida('los carritos')).toBe('carrito')
    expect(palabraProhibida('con pistachos')).toBe('pistachos')
    expect(palabraProhibida('trae maní')).toBe('maní')

    // Las que NO son la palabra prohibida, aunque la contengan. Sin
    // esto, el filtro le prohibiría a la clienta escribir «monocromo».
    expect(palabraProhibida('impresión monocromo')).toBeNull()
    expect(palabraProhibida('un chispazo de sabor')).toBeNull()
    expect(palabraProhibida('la manía de revisar')).toBeNull()
    expect(palabraProhibida('Chocolate con pistaches')).toBeNull()
  })

  it('MAQUETA no contamina al panel: «Borrador» no está en MARCA', () => {
    // El panel necesita esa palabra para su concepto central. Si algún
    // día alguien funde las dos listas, este test lo frena.
    expect(MARCA).not.toContain('borrador')
    expect(MAQUETA).toContain('borrador')
    expect(palabraProhibida('Borrador sin publicar')).toBeNull()
  })
})
