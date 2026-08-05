/*
 * Presentación de identidad (spec 2026-08-05) — criterios de aceptación
 * §5. Complementa los guards existentes: el B2 de manual.test.ts ya
 * escanea src/components/landing y src/pages por hex a mano; acá viven
 * los chequeos propios de la presentación: registro es-MX, ritmo de
 * bandas, colores del sistema en los visuales de chocolate, y que el
 * revelado por scroll no esconda contenido sin JS ni con reduced-motion.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { landing, precioMXN } from '@/copy/landing'
import { copy } from '@/copy/marca'
import { todosLosColores } from '@/tokens/color'
import Banda from '@/components/landing/Banda.astro'
import PaletaTableta from '@/components/landing/PaletaTableta.astro'
import TabletaSabor from '@/components/landing/TabletaSabor.astro'
import Portada from '@/pages/index.astro'

const container = await AstroContainer.create()

/** Junta todos los strings visibles de una capa de copy, a cualquier profundidad. */
function stringsVisibles(nodo: unknown): string[] {
  if (typeof nodo === 'string') return [nodo]
  if (Array.isArray(nodo)) return nodo.flatMap(stringsVisibles)
  if (nodo !== null && typeof nodo === 'object') {
    return Object.values(nodo).flatMap(stringsVisibles)
  }
  return []
}

describe('registro es-MX del copy visible (§10.6 del spec de identidad)', () => {
  const textos = [...stringsVisibles(landing), ...stringsVisibles(copy)]

  it('hay copy y no está vacío', () => {
    expect(textos.length).toBeGreaterThan(30)
    for (const t of textos) expect(t.trim()).not.toBe('')
  })

  // Se escanean los VALORES exportados, no el archivo: los comentarios del
  // código pueden citar "packaging" al documentar; el copy visible, jamás.
  it.each(['pistachos', 'cacahuete', 'maní', 'packaging'])(
    'ningún string visible dice "%s"',
    (palabra) => {
      for (const t of textos) expect(t.toLowerCase()).not.toContain(palabra)
    },
  )

  it('el sabor canónico dice "pistaches"', () => {
    expect(textos.join(' ')).toMatch(/pistaches/i)
  })
})

describe('precios en pesos con locale es-MX (§10.6: Intl)', () => {
  it('formatea sin centavos y con signo de pesos', () => {
    expect(precioMXN(95)).toMatch(/^\$\s?95$/)
    expect(precioMXN(110)).toMatch(/^\$\s?110$/)
  })
})

describe('la presentación en /', () => {
  it('abre con la tesis del hero y el sello respirando', async () => {
    const html = await container.renderToString(Portada)
    expect(html).toContain(landing.hero.titulo)
    // El wrapper .mascota alrededor del sello es lo que activa la
    // animación ambiental (mascota-ambiental.css targetea .mascota #cuerpo).
    expect(html).toMatch(/class="mascota entra"/)
  })

  it('el ritmo de bandas es el del spec (§2): papel/verde alternado, profundo solo en el umbral y el footer', async () => {
    const html = await container.renderToString(Portada)
    const fondos = [...html.matchAll(/<section class="banda[^"]*" data-fondo="(\w+)"/g)].map((m) => m[1])
    expect(fondos).toEqual([
      'verde', // hero
      'papel', // el personaje
      'verde', // las firmas
      'papel', // la paleta
      'verde', // las voces
      'papel', // el movimiento
      'profundo', // el adelanto
      'papel', // el cierre
      'profundo', // footer
    ])
  })

  it('muestra las siete variantes con su nombre', async () => {
    const html = await container.renderToString(Portada)
    for (const { nombre } of landing.firmas.variantes) expect(html).toContain(nombre)
  })

  it('las vistas previas van marcadas como tales', async () => {
    const html = await container.renderToString(Portada)
    const chips = html.match(new RegExp(landing.adelanto.chip, 'g')) ?? []
    expect(chips.length).toBeGreaterThanOrEqual(3)
  })

  it('enlaza al manual vía ruta() y no usa la isla de Rive', async () => {
    const html = await container.renderToString(Portada)
    expect(html).toContain('href="/manual"')
    // La presentación vive del fallback CSS: mono.riv todavía no existe
    // (handoff §"El paso que falta"), así que nada debe pedir la isla.
    expect(html).not.toContain('mono.riv')
  })

  it('ningún enlace interno crudo en el fuente — anclas de página permitidas', () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toMatch(/href="\/(?!\{)/)
  })
})

describe('el revelado por scroll no esconde contenido (criterio 5 del spec)', () => {
  const css = readFileSync('src/styles/landing.css', 'utf8')

  it('el estado oculto solo existe bajo html.js', () => {
    expect(css).toMatch(/html\.js \[data-revelar\]/)
    // …y ninguna otra regla esconde [data-revelar] sin la clase js.
    expect(css).not.toMatch(/^\s*\[data-revelar\]\s*\{/m)
  })

  it('y solo dentro del media de no-preference', () => {
    const media = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    const oculto = css.indexOf('html.js [data-revelar]')
    expect(media).toBeGreaterThan(-1)
    expect(oculto).toBeGreaterThan(media)
  })

  it('ningún tiempo hardcodeado: las duraciones salen de los tokens', () => {
    // El único literal permitido es el fallback neutro `0ms` de --retardo.
    const tiempos = css.match(/\b\d[\d.]*(?:ms|s)\b/g) ?? []
    expect(new Set(tiempos)).toEqual(new Set(['0ms']))
  })

  it('el script del observer trabaja por data-attribute, nunca por id (ids duplicados del inlineado)', () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).toContain("querySelectorAll('[data-revelar]')")
    expect(src).not.toContain('getElementById')
  })
})

describe('Banda', () => {
  it('papel por defecto, y pasa el id para anclas', async () => {
    const html = await container.renderToString(Banda, { props: { id: 'identidad' } })
    expect(html).toMatch(/data-fondo="papel"/)
    expect(html).toMatch(/id="identidad"/)
  })
})

describe('PaletaTableta (elemento firma)', () => {
  it('18 cuadritos, una mordida y dos migajas', async () => {
    const html = await container.renderToString(PaletaTableta)
    expect(html.match(/class="cuadrito/g)).toHaveLength(18)
    expect(html.match(/class="cuadrito mordido"/g)).toHaveLength(1)
    expect(html.match(/class="migaja/g)).toHaveLength(2)
  })

  it('cada cuadrito lleva un color del sistema — ninguno inventado', async () => {
    const html = await container.renderToString(PaletaTableta)
    const permitidos = todosLosColores()
    const usados = [...html.matchAll(/background:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1])
    expect(usados.length).toBeGreaterThan(0)
    for (const hex of usados) expect(permitidos).toContain(hex)
  })
})

describe('TabletaSabor (chocolate con logo)', () => {
  it.each(['blanco', 'leche', 'oscuro'] as const)('el tono %s arma la tableta completa', async (tono) => {
    const html = await container.renderToString(TabletaSabor, {
      props: { nombre: 'Sabor de prueba', tono, precio: 95 },
    })
    expect(html.match(/class="tsabor-cuadro"/g)).toHaveLength(8)
    expect(html).toContain('<svg') // el logotipo inline sobre la envoltura
    expect(html).toMatch(/\$\s?95/)
  })

  it('la envoltura y el chocolate usan colores del sistema', async () => {
    const html = await container.renderToString(TabletaSabor, {
      props: { nombre: 'Sabor de prueba', tono: 'oscuro', precio: 110 },
    })
    const permitidos = todosLosColores()
    const usados = [...html.matchAll(/background:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1])
    for (const hex of usados) expect(permitidos).toContain(hex)
  })
})
