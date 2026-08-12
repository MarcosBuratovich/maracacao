/*
 * Borrador del sitio público (/sitio). Los guards estructurales (hex a
 * mano, <title> literal) ya lo cubren vía manual.test.ts; acá va lo
 * propio: registro es-MX y retro de Marcos sobre el copy nuevo, el
 * renderizado de la página con su contenido real, y que los assets
 * decorativos respeten las reglas de construcción de la marca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { sitio } from '@/copy/sitio'
import Borrador from '@/pages/sitio.astro'
import EnConstruccion from '@/pages/index.astro'
import TazaEspuma from '@/components/sitio/TazaEspuma.astro'
import HojaCacao from '@/components/sitio/HojaCacao.astro'
import Mazorca from '@/components/sitio/Mazorca.astro'
import Canela from '@/components/sitio/Canela.astro'

const container = await AstroContainer.create()

function stringsVisibles(nodo: unknown): string[] {
  if (typeof nodo === 'string') return [nodo]
  if (Array.isArray(nodo)) return nodo.flatMap(stringsVisibles)
  if (nodo !== null && typeof nodo === 'object') return Object.values(nodo).flatMap(stringsVisibles)
  return []
}

describe('copy del borrador — registro y retro vigentes', () => {
  const textos = stringsVisibles(sitio)

  it('es-MX: nunca "pistachos" ni regionalismos ajenos', () => {
    for (const t of textos) {
      for (const palabra of ['pistachos', 'cacahuete', 'maní', 'packaging']) {
        expect(t.toLowerCase()).not.toContain(palabra)
      }
    }
  })

  it('el personaje no se llama "mono" (ni "chango")', () => {
    for (const t of textos) expect(t).not.toMatch(/\b(monos?|changos?|changuitos?)\b/i)
  })

  it('sin carrito y sin precios: el borrador no decide la pregunta 11', () => {
    for (const t of textos) {
      expect(t.toLowerCase()).not.toContain('carrito')
      expect(t).not.toMatch(/\$\s?\d/)
    }
  })

  it('las 15 barras del catálogo están, sin inventar la 16', () => {
    expect(sitio.productos.barras).toHaveLength(15)
    expect(sitio.productos.barras).toContain('Chocolate blanco con pistache')
  })
})

describe('la página /sitio', () => {
  it('renderiza el contenido real: barras, correo y catálogo', async () => {
    const html = await container.renderToString(Borrador)
    for (const barra of sitio.productos.barras) expect(html).toContain(barra)
    expect(html).toContain(sitio.contacto.correo)
    expect(html).toContain(sitio.contacto.catalogoUrl)
  })

  it('cada dato faltante va marcado con su pregunta del cuestionario', async () => {
    const html = await container.renderToString(Borrador)
    const marcas = html.match(/pregunta[s]? \d+/g) ?? []
    expect(marcas.length).toBeGreaterThanOrEqual(7)
    expect(html).toContain(sitio.aviso)
  })

  it('no pide la isla de Rive y no busca por id', () => {
    const src = readFileSync('src/pages/sitio.astro', 'utf8')
    expect(src).not.toContain('rive')
    expect(src).not.toContain('getElementById')
    expect(src).not.toMatch(/href="\/(?!\{)/)
  })

  it('solo usa el personaje del cliente — la mascota del sistema quedó fuera (retro 2026-08-10)', () => {
    const src = readFileSync('src/pages/sitio.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    expect(src).toContain('/sitio/personaje-sentado.webp')
  })

  it('el video del personaje respeta reduced-motion (se pausa y da controles)', () => {
    const src = readFileSync('src/pages/sitio.astro', 'utf8')
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).toContain('video.pause()')
  })
})

describe('la página en construcción en / (lo público mientras llega el dominio)', () => {
  it('muestra las dos voces: el sello oficial y el personaje en movimiento, con catálogo y correo', async () => {
    const html = await container.renderToString(EnConstruccion)
    expect(html).toContain('/sitio/logo-maracacao.webp') // logo oficial (decisión 2026-08-12)
    expect(html).toContain('/sitio/changuito-molinillo.mp4')
    expect(html).toContain(sitio.contacto.catalogoUrl)
    expect(html).toContain(sitio.contacto.correo)
    expect(html).toContain(sitio.construccion.encabezado)
  })

  it('sin la mascota del sistema y sin enlaces a presentación/manual/borrador (van por URL directa)', async () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    const html = await container.renderToString(EnConstruccion)
    expect(html).not.toContain('href="/manual"')
    expect(html).not.toContain('href="/sitio"')
    expect(html).not.toContain('href="/presentacion"')
  })

  it('el video respeta reduced-motion', () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).toContain('video.pause()')
  })
})

describe('assets decorativos — reglas de construcción (§9.1)', () => {
  const casos = [
    ['TazaEspuma', TazaEspuma],
    ['HojaCacao', HojaCacao],
    ['Mazorca', Mazorca],
    ['Canela', Canela],
  ] as const

  it.each(casos)('%s: fills de tokens, trazo redondeado, sin ids en el SVG', async (_, Comp) => {
    const html = await container.renderToString(Comp)
    expect(html).toContain('var(--mrc-')
    expect(html).toContain('stroke-linecap="round"')
    // Ids duplicados al inlinear: deuda que estos assets NO heredan —
    // toda referencia de animación va por clase.
    expect(html).not.toMatch(/<(g|path|circle|ellipse|rect)[^>]* id="/)
    expect(html).toContain('aria-hidden="true"')
  })

  it('las animaciones usan los tokens de movimiento, nunca tiempos a mano', () => {
    for (const archivo of ['TazaEspuma', 'HojaCacao', 'Mazorca', 'Canela']) {
      const src = readFileSync(`src/components/sitio/${archivo}.astro`, 'utf8')
      const enEstilos = src.match(/<style>[\s\S]*<\/style>/)?.[0] ?? ''
      const tiempos = (enEstilos.match(/\b\d[\d.]*(?:ms|s)\b/g) ?? []).filter((t) => t !== '0ms')
      // 100ms es el retardo de peso permitido por §12 (cola/orejas 80-120ms).
      expect(tiempos.filter((t) => t !== '100ms')).toEqual([])
    }
  })
})
