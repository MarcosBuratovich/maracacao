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
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'
import { editorial, etiqueta } from '@/tokens/color'
import { customProperties } from '@/tokens/css'
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

  it('sin carrito; los precios van como números por precioMXN (pregunta 11: sí se muestran)', () => {
    for (const t of textos) {
      expect(t.toLowerCase()).not.toContain('carrito')
      expect(t).not.toMatch(/\$\s?\d/) // nunca precios pegados en strings
    }
    for (const f of sitio.productos.fotos) expect(typeof f.precio).toBe('number')
  })

  it('las 15 barras del catálogo están, sin inventar la 16', () => {
    expect(sitio.productos.barras).toHaveLength(15)
    expect(sitio.productos.barras.map((b) => b.nombre)).toContain('Chocolate blanco con pistache')
  })

  // El color dejó de ser fondo de sección y pasó a ser índice de sabor
  // (rediseño 2026-08-12): cada barra apunta a un token `etiqueta` real.
  it('cada sabor tiene un tono del sistema de etiquetas', () => {
    const validos = Object.keys(etiqueta)
    for (const b of sitio.productos.barras) expect(validos).toContain(b.tono)
  })
})

describe('la página /sitio (rediseño de marca, 2026-08-13)', () => {
  it('renderiza el contenido real: los 15 sabores, correo, catálogo, precios, Tabasco y punto de venta', async () => {
    const html = await container.renderToString(Borrador)
    // Los quince están presentes: en el anaquel cada barra es un radio
    // con su nombre como aria-label.
    for (const s of sabores) expect(html).toContain(`aria-label="${s.nombre}"`)
    expect(html).toContain(marca.contacto.correo)
    expect(html).toContain(marca.contacto.catalogoUrl)
    expect(html).toMatch(/\$\s?108/)
    expect(html).toContain('Tabasco')
    expect(html).toContain(marca.contacto.direccion[0])
  })

  it('títulos concretos, sin juegos de palabras: cada sección lleva su nombre', async () => {
    const html = await container.renderToString(Borrador)
    for (const titulo of [
      marca.postura.titulo, marca.anaquel.titulo, marca.polvo.titulo,
      marca.catar.titulo, marca.recetas.titulo, marca.nosotros.titulo,
      marca.negocios.titulo, marca.preguntas.titulo, marca.contacto.titulo,
    ]) {
      expect(html).toContain(titulo)
    }
  })

  it('las 4 recetas del cliente (completas y expandibles) y las 8 preguntas están', async () => {
    const html = await container.renderToString(Borrador)
    expect(marca.recetas.lista).toHaveLength(4)
    for (const r of marca.recetas.lista) {
      expect(html).toContain(r.titulo)
      // La receta completa del cliente viaja entera, no solo el resumen.
      for (const ing of r.ingredientes) expect(html).toContain(ing)
    }
    expect(html.match(/<details class="receta-completa"/g)).toHaveLength(4)
    expect(marca.preguntas.items).toHaveLength(8)
    expect(html.match(/<details class="pregunta"/g)).toHaveLength(8)
    for (const paso of marca.catar.pasos) expect(html).toContain(paso.nombre)
  })

  it('la ficha del anaquel arranca en canela y la banda trae su color y su tinta medida', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).toContain('aria-checked="true" aria-label="Canela"')
    expect(html).toMatch(/data-anaquel-banda[^>]*--fondo:#7D0303;--texto:#FFFFFF/)
  })

  it('sin marcas de maqueta: ni aviso de borrador ni chips de pendiente', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).not.toContain('Borrador')
    expect(html).not.toContain('PENDIENTE')
    expect(html).not.toMatch(/pregunta \d+/)
  })

  it('no pide la isla de Rive y no busca por id', () => {
    const src = readFileSync('src/pages/sitio.astro', 'utf8')
    expect(src).not.toContain('rive')
    expect(src).not.toContain('getElementById')
    expect(src).not.toMatch(/href="\/(?!\{)/)
  })

  it('solo usa el personaje del cliente, con los assets sin fondo', () => {
    const src = readFileSync('src/pages/sitio.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    expect(src).toContain('/sitio/personaje-sentado-t.webp')
  })

  it('el video del personaje respeta reduced-motion (se pausa y da controles)', () => {
    const src = readFileSync('src/scripts/editorial.ts', 'utf8')
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).toContain('video.pause()')
  })
})

/*
 * Rediseño editorial (2026-08-12): canon de Van de Graaf, una sola tinta
 * sobre un solo papel, y el wordmark del logo replicado en texto vivo
 * con la tipografía del sello.
 */
describe('sistema editorial', () => {
  const css = readFileSync('src/styles/editorial.css', 'utf8')

  it('los colores del lienzo salen de tokens con prefijo propio', () => {
    const props = customProperties()
    for (const [nombre, hex] of Object.entries(editorial)) {
      expect(props[`--mrc-ed-${nombre}`]).toBe(hex)
    }
    // `editorial.papel` y `fijos.papel` son colores distintos: sin el
    // prefijo `ed-` el segundo pisaría al primero y rompería el manual.
    expect(props['--mrc-papel']).not.toBe(editorial.papel)
  })

  it('el canon divide en nueve y el bloque de texto ocupa seis, con margen para notas', () => {
    expect(css).toContain('grid-template-columns: repeat(9, minmax(0, 1fr))')
    expect(css).toMatch(/\.bloque\s*\{\s*grid-column:\s*2\s*\/\s*8/)
    expect(css).toMatch(/\.margen\s*\{\s*grid-column:\s*8\s*\/\s*10/)
  })

  it('el wordmark es texto vivo, no una imagen (lockup y arco del pie)', async () => {
    const html = await container.renderToString(Borrador)
    // En el rediseño el wordmark vive dos veces como texto: el lockup de
    // la cabecera y el arco del pie (letra a letra, calculado en build).
    expect(html).toMatch(new RegExp(`class="lockup-nombre"[^>]*>${marca.marca.wordmark}<`))
    expect(html).toMatch(/class="arco"[^>]*aria-label="MARACACAO"/)
  })

  it('el sello va inline para tomar la tinta de su sección', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).toContain('fill="currentColor"')
    expect(html).not.toContain('/sitio/logo-t.png')
  })

  it('nada se esconde sin JS ni con reduced-motion', () => {
    // Todo el movimiento vive bajo `html.js` + no-preference.
    const ocultos = css.match(/\[data-revelar\]\s*\{\s*opacity:\s*0/g) ?? []
    for (const regla of ocultos) expect(css).toContain(`html.js .ed ${regla.split('{')[0].trim()}`)
    const media = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(media).toBeGreaterThan(-1)
    expect(css.indexOf('html.js .ed [data-revelar]')).toBeGreaterThan(media)
  })

  it('el cursor propio solo aparece con puntero fino y sin reduced-motion', () => {
    const js = readFileSync('src/scripts/editorial.ts', 'utf8')
    expect(js).toContain("matchMedia('(pointer: fine)')")
    expect(js).toMatch(/if \(punteroFino && !quieto\)/)
    expect(css).toContain('html.cursor-propio, html.cursor-propio * { cursor: none; }')
  })
})

describe('la página en construcción en / (lo público mientras llega el dominio)', () => {
  it('muestra el sello inline y el personaje recortado, con catálogo y correo', async () => {
    const html = await container.renderToString(EnConstruccion)
    expect(html).toContain('fill="currentColor"') // el sello, inline, toma la tinta de su sección
    expect(html).toContain(sitio.marca.wordmark)
    // El video del cliente trae fondo blanco: sobre la tinta se ve como
    // un parche, así que va la versión estática sin fondo.
    expect(html).not.toContain('.mp4')
    expect(html).toContain('/sitio/personaje-molinillo-t.webp')
    expect(html).toContain(sitio.contacto.catalogoUrl)
    expect(html).toContain(sitio.contacto.correo)
    expect(html).toContain(sitio.construccion.encabezado)
  })

  it('el título va al punto, sin juegos de palabras', () => {
    expect(sitio.construccion.encabezado).toBe('Sitio en construcción')
  })

  it('sin la mascota del sistema y sin enlaces a presentación/manual/borrador (van por URL directa)', async () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    const html = await container.renderToString(EnConstruccion)
    expect(html).not.toContain('href="/manual"')
    expect(html).not.toContain('href="/sitio"')
    expect(html).not.toContain('href="/presentacion"')
  })

  it('carga el módulo editorial, que apaga el movimiento bajo reduced-motion', () => {
    expect(readFileSync('src/pages/index.astro', 'utf8')).toContain("import '@/scripts/editorial'")
    const js = readFileSync('src/scripts/editorial.ts', 'utf8')
    expect(js).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
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
