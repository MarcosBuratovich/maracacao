/*
 * SEO (2026-08-19). Lo que fija:
 *
 * 1. El switch de lanzamiento: candado ⇒ noindex,nofollow. Quitar el
 *    candado el día del lanzamiento abre la indexación solo — y las
 *    páginas SIN candado jamás llevan noindex por accidente.
 * 2. El head completo de las dos páginas raíz: description, canonical
 *    absoluto en el host www, Open Graph con imagen social y JSON-LD
 *    que parsea, con cero datos inventados.
 * 3. Los archivos de rastreo: robots.txt sin Disallow de rutas con
 *    candado (bloquearlas escondería su noindex), sitemap solo con lo
 *    indexable, y vercel.json con la cabecera X-Robots-Tag de refuerzo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'
import { esquemaNegocio, esquemaPreguntas, esquemaBarras, origenCanonico } from '@/seo/esquema'
import Sitio from '@/pages/sitio.astro'
import EnConstruccion from '@/pages/index.astro'
import NoEncontrada from '@/pages/404.astro'

const container = await AstroContainer.create()
const ORIGEN = 'https://www.maracacao.mx'

describe('el switch de lanzamiento: candado ⇒ noindex', () => {
  it('/sitio (con candado) va noindex,nofollow', async () => {
    const html = await container.renderToString(Sitio)
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
  })

  it('la portada pública NO lleva meta robots: es la semilla de indexación del dominio', async () => {
    const html = await container.renderToString(EnConstruccion)
    expect(html).not.toContain('name="robots"')
  })

  it('el noindex sale del prop candado en Base, no de una lista de rutas aparte', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(base).toMatch(/candado && \(?<meta name="robots"/)
  })
})

describe('el head de las páginas raíz', () => {
  it('la portada: description, canonical www, OG completo y tarjeta social', async () => {
    const html = await container.renderToString(EnConstruccion)
    expect(html).toContain(`<meta name="description" content="${marca.descripcionConstruccion}"`)
    expect(html).toContain(`<link rel="canonical" href="${ORIGEN}/"`)
    expect(html).toContain('property="og:locale" content="es_MX"')
    expect(html).toContain(`property="og:image" content="${ORIGEN}/social/tarjeta.png"`)
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('/sitio: description propia y canonical /sitio (sin barra final: una sola forma de URL)', async () => {
    const html = await container.renderToString(Sitio)
    expect(html).toContain(`<meta name="description" content="${marca.descripcion}"`)
    expect(html).toContain(`<link rel="canonical" href="${ORIGEN}/sitio"`)
    expect(html).not.toContain(`href="${ORIGEN}/sitio/"`)
  })

  it('el título de la portada trabaja la marca y la categoría, no «en construcción»', () => {
    expect(marca.construccion.titulo.toLowerCase()).toContain('chocolate')
    expect(marca.construccion.titulo.toLowerCase()).not.toContain('construcción')
  })

  it('favicon con respaldos: svg + ico + apple-touch-icon, y los archivos existen', async () => {
    const html = await container.renderToString(EnConstruccion)
    for (const ref of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']) {
      expect(html).toContain(`href="${ref}"`)
      expect(existsSync(`public${ref}`)).toBe(true)
    }
  })
})

describe('JSON-LD — datos reales, nada inventado', () => {
  it('las dos páginas emiten script ld+json que parsea', async () => {
    for (const Pagina of [EnConstruccion, Sitio]) {
      const html = await container.renderToString(Pagina)
      const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      expect(bloques.length).toBeGreaterThan(0)
      for (const [, crudo] of bloques) expect(() => JSON.parse(crudo)).not.toThrow()
    }
  })

  it('el negocio: dirección real de Coyoacán y el correo del cliente', () => {
    const negocio = esquemaNegocio(ORIGEN)
    expect(negocio.address.streetAddress).toContain('Mercado de Coyoacán')
    expect(negocio.address.postalCode).toBe('04100')
    expect(negocio.email).toBe(marca.contacto.correo)
    // Sin redes en sameAs hasta confirmar dónde vive @maracacaomx.
    expect(negocio.sameAs).toEqual([marca.contacto.catalogoUrl])
  })

  it('las preguntas del FAQPage son las 8 de la sección, textuales', () => {
    const faq = esquemaPreguntas()
    expect(faq.mainEntity).toHaveLength(marca.preguntas.items.length)
    expect(faq.mainEntity.map((q) => q.name)).toEqual(marca.preguntas.items.map((i) => i.p))
  })

  it('las 15 barras con su precio real en MXN y su URL de catálogo', () => {
    const lista = esquemaBarras(ORIGEN)
    expect(lista.itemListElement).toHaveLength(15)
    for (const [i, el] of lista.itemListElement.entries()) {
      expect(el.item.offers.price).toBe(sabores[i].precio)
      expect(el.item.offers.priceCurrency).toBe('MXN')
      expect(el.item.offers.url).toMatch(/^https:\/\/chocolateria\.pulpos\.shop/)
    }
  })

  it('origenCanonico: www con y sin `site` configurado', () => {
    expect(origenCanonico(undefined)).toBe(ORIGEN)
    expect(origenCanonico(new URL('https://www.maracacao.mx'))).toBe(ORIGEN)
  })
})

describe('rastreo: robots.txt, sitemap y vercel.json', () => {
  const robots = readFileSync('public/robots.txt', 'utf8')
  const sitemap = readFileSync('public/sitemap.xml', 'utf8')
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))

  it('robots.txt: solo /api/ va con Disallow — nunca las rutas con candado (esconderían su noindex)', () => {
    expect(robots).toContain('Disallow: /api/')
    for (const ruta of ['/sitio', '/presentacion', '/manual']) {
      expect(robots).not.toContain(`Disallow: ${ruta}`)
    }
    expect(robots).toContain(`Sitemap: ${ORIGEN}/sitemap.xml`)
  })

  it('el sitemap lista solo lo indexable hoy: la portada en el host www', () => {
    expect(sitemap).toContain(`<loc>${ORIGEN}/</loc>`)
    expect(sitemap).not.toContain('/sitio</loc>')
  })

  it('vercel.json: X-Robots-Tag de refuerzo sobre las rutas privadas y una sola forma de URL', () => {
    expect(vercel.trailingSlash).toBe(false)
    const cabecera = vercel.headers?.[0]
    expect(cabecera.source).toContain('sitio|presentacion|manual')
    expect(cabecera.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
  })
})

describe('los sabores son texto servido, no solo aria-labels', () => {
  it('cada uno de los 15 nombres aparece como heading de su ficha', async () => {
    const html = await container.renderToString(Sitio)
    for (const s of sabores) {
      expect(html).toContain(`data-ficha-de="${s.slug}"`)
      // Astro suma su data-astro-cid de estilos scoped al tag.
      expect(html).toMatch(new RegExp(`<h3 class="ficha-nombre"[^>]*>${s.nombre}</h3>`))
    }
  })

  it('sin `hidden` servido en las fichas: sin JS se ven las quince (el script esconde al tomar control)', () => {
    const fuente = readFileSync('src/pages/sitio.astro', 'utf8')
    const bloque = fuente.slice(fuente.indexOf('data-ficha-de'), fuente.indexOf('ficha-extras'))
    expect(bloque).not.toContain('hidden')
  })
})
