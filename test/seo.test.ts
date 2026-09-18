/*
 * SEO (auditoría 2026-08-19; lanzamiento 2026-08-20). Lo que fija:
 *
 * 1. El switch de lanzamiento quedó ejecutado: la landing vive en `/`
 *    sin candado ni robots; las páginas que siguen privadas
 *    (/presentacion, /manual) llevan candado ⇒ noindex,nofollow — y las
 *    páginas SIN candado jamás llevan noindex por accidente.
 * 2. El head completo de la home: title de categoría+marca, description
 *    ≤155, canonical absoluto en el host www, Open Graph con tarjeta
 *    social y JSON-LD que parsea, con cero datos inventados.
 * 3. Los archivos de rastreo: robots.txt sin Disallow de rutas con
 *    candado (bloquearlas escondería su noindex), el sitemap lo genera
 *    src/seo/sitemap.ts en el build (raíz con barra, igual que el
 *    canonical; sin rutas privadas ni 404), y vercel.json trae
 *    el 301 de /sitio → / (sin tragarse los assets de /sitio/…) más la
 *    cabecera X-Robots-Tag de refuerzo sobre lo privado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'
import { esquemaNegocio, esquemaPreguntas, esquemaBarras, origenCanonico } from '@/seo/esquema'
import { urlsDelSitemap, xmlDelSitemap } from '@/seo/sitemap'
import { esc } from './regex'
import Home from '@/pages/index.astro'
import Presentacion from '@/pages/presentacion.astro'
import NoEncontrada from '@/pages/404.astro'

const container = await AstroContainer.create()
const ORIGEN = 'https://www.maracacao.mx'

describe('el switch de lanzamiento: la home abierta, lo privado noindex', () => {
  it('la home NO lleva meta robots ni candado: es lo que se indexa', async () => {
    const html = await container.renderToString(Home)
    expect(html).not.toContain('name="robots"')
    expect(html).not.toContain('data-candado')
  })

  it('/presentacion (con candado) va noindex,nofollow', async () => {
    const html = await container.renderToString(Presentacion)
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
  })

  it('el noindex sale del prop candado en Base, no de una lista de rutas aparte', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(base).toMatch(/candado && \(?<meta name="robots"/)
  })

  it('ya no existe /sitio como página: la landing es index.astro', () => {
    expect(existsSync('src/pages/sitio.astro')).toBe(false)
    expect(existsSync('src/pages/index.astro')).toBe(true)
  })
})

describe('el head de la home', () => {
  it('description, canonical www sin barra extra, OG completo y tarjeta social', async () => {
    const html = await container.renderToString(Home)
    // Tarea 12: el <title> lleva data-campo (de qué campo sale), así que
    // el match es por contenido, no por el tag exacto.
    expect(html).toMatch(new RegExp(`<title[^>]*>${esc(marca.titulo)}</title>`))
    expect(html).toContain(`<meta name="description" content="${marca.descripcion}"`)
    expect(html).toContain(`<link rel="canonical" href="${ORIGEN}/"`)
    expect(html).toContain(`property="og:url" content="${ORIGEN}/"`)
    expect(html).toContain('property="og:locale" content="es_MX"')
    expect(html).toContain(`property="og:image" content="${ORIGEN}/social/tarjeta.png"`)
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    // Los assets siguen bajo /sitio/… (ruta de archivos); la PÁGINA /sitio ya no se referencia.
    expect(html).not.toContain(`${ORIGEN}/sitio"`)
  })

  it('title de categoría + marca (≤60) y description ≤155, sin «construcción»', () => {
    // Las tres palabras clave que este test exigía —«chocolate»,
    // «coyoacán», «maracacao»— cayeron con la Fase 1: `marca.titulo` pasa a
    // ser editable y no hay una «forma» razonable de pedir «tiene que
    // mencionar estas tres palabras». Si la recomendación de SEO se quiere
    // conservar, va como sugerencia en el panel, no como un test que rompe
    // el build de la clienta. Lo que queda son los topes que Google impone
    // de verdad y el guard anti-maqueta.
    const t = marca.titulo.toLowerCase()
    expect(t).not.toContain('construcción')
    expect(marca.titulo.length).toBeLessThanOrEqual(60)
    expect(marca.descripcion.length).toBeLessThanOrEqual(155)
  })

  it('la página en construcción se retiró del copy', () => {
    expect('construccion' in marca).toBe(false)
    expect('descripcionConstruccion' in marca).toBe(false)
  })

  it('favicon con respaldos: svg + ico + apple-touch-icon, y los archivos existen', async () => {
    const html = await container.renderToString(Home)
    for (const ref of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']) {
      expect(html).toContain(`href="${ref}"`)
      expect(existsSync(`public${ref}`)).toBe(true)
    }
  })

  it('la 404 tiene su título, vuelve al inicio y no lleva candado', async () => {
    const html = await container.renderToString(NoEncontrada)
    // Mismo motivo que arriba: el <title> lleva data-campo.
    expect(html).toMatch(new RegExp(`<title[^>]*>${esc(marca.noEncontrada.titulo)}</title>`))
    expect(html).toContain('href="/"')
    expect(html).not.toContain('data-candado')
  })
})

describe('JSON-LD — datos reales, nada inventado', () => {
  it('la home emite LocalBusiness + FAQPage + ItemList en ld+json que parsea', async () => {
    const html = await container.renderToString(Home)
    const bloques = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    expect(bloques.length).toBeGreaterThan(0)
    const tipos = bloques.flatMap(([, crudo]) => {
      const dato = JSON.parse(crudo) as { '@type': string } | { '@type': string }[]
      return (Array.isArray(dato) ? dato : [dato]).map((d) => d['@type'])
    })
    expect(tipos).toEqual(expect.arrayContaining(['LocalBusiness', 'FAQPage', 'ItemList']))
  })

  it('el negocio: el correo del cliente y la home como url', () => {
    const negocio = esquemaNegocio(ORIGEN)
    expect(negocio.url).toBe(`${ORIGEN}/`)
    expect(negocio.email).toBe(marca.contacto.correo)
    // Sin redes en sameAs hasta confirmar dónde vive @maracacaomx.
    expect(negocio.sameAs).toEqual([marca.contacto.catalogoUrl])
  })

  it('la dirección del JSON-LD sale del copy y no de cinco literales', () => {
    // El mismo dato estaba escrito en dos lugares: si el puesto se muda,
    // ella edita el copy y Google sigue mostrando la dirección vieja en su
    // ficha de negocio. Este test exige las dos cosas: que el JSON-LD siga
    // diciendo exactamente lo mismo que hoy, y que lo diga leyendo el
    // copy — comparado contra EL COPY, no contra un literal, porque un
    // literal acá es el mismo bug que esta tarea corrige, solo que ahora
    // vive en el test y bloquea `pnpm build` el día que ella edite la
    // dirección de verdad.
    const negocio = esquemaNegocio(ORIGEN)
    expect(negocio.address.streetAddress).toBe(
      `${marca.contacto.puestoTitulo.join(' ')}, ${marca.contacto.direccion[0]}`,
    )
    expect(negocio.address.addressLocality).toBe(marca.contacto.direccionPostal.localidad)
    expect(negocio.address.addressRegion).toBe(marca.contacto.direccionPostal.estado)
    expect(negocio.address.postalCode).toBe(marca.contacto.direccionPostal.codigoPostal)
    expect(negocio.address.addressCountry).toBe('MX')
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
      expect(existsSync(`public/sitio/marca/barra-${sabores[i].slug}.webp`)).toBe(true)
    }
  })

  it('origenCanonico: www con y sin `site` configurado', () => {
    expect(origenCanonico(undefined)).toBe(ORIGEN)
    expect(origenCanonico(new URL('https://www.maracacao.mx'))).toBe(ORIGEN)
  })

  it('el ItemList de las barras se llama como la sección que existe, no como una página retirada', () => {
    const lista = esquemaBarras('https://www.maracacao.mx')
    // Hasta 2026-09-08 publicaba el encabezado de /barras, una página
    // fuera de ruta desde el 2026-08-17: Google veía el nombre de algo
    // que no existe. Desde 2026-09-09 es el kicker del anaquel, no el
    // título — "Elige tu barra" es un CTA, no un nombre de lista.
    expect(lista.name).toBe(marca.anaquel.kicker)
    expect(lista.name).not.toContain('15 barras')
  })
})

describe('rastreo: robots.txt, sitemap y vercel.json', () => {
  const robots = readFileSync('public/robots.txt', 'utf8')
  const config = readFileSync('astro.config.mjs', 'utf8')
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    trailingSlash: boolean
    cleanUrls: boolean
    headers: { source: string; headers: { key: string; value: string }[] }[]
    redirects: { source: string; destination: string; permanent: boolean; has?: unknown }[]
  }

  it('robots.txt: solo /api/ va con Disallow — nunca las rutas con candado (esconderían su noindex)', () => {
    expect(robots).toContain('Disallow: /api/')
    for (const ruta of ['/sitio', '/presentacion', '/manual']) {
      expect(robots).not.toContain(`Disallow: ${ruta}`)
    }
    expect(robots).toContain(`Sitemap: ${ORIGEN}/sitemap.xml`)
  })

  it('el sitemap sale del build (src/seo/sitemap.ts): raíz con barra como el canonical, sin privadas ni 404', () => {
    expect(config).toContain("import { sitemapMaracacao } from './src/seo/sitemap'")
    expect(config).toContain('sitemapMaracacao()')
    expect(config).toContain(`site: '${ORIGEN}'`)
    // Ningún sitemap estático en public/ que pise al generado.
    expect(existsSync('public/sitemap.xml')).toBe(false)
    const urls = urlsDelSitemap(`${ORIGEN}/`, [
      '', '404', 'presentacion', 'manual', 'manual/color/', '/sabores/', 'sabores',
      // Tarea 12: /panel/entrar existe desde ahora — nunca al sitemap. Su
      // `noindex` sale de la cabecera de vercel.json, no de un candado; el
      // criterio para no listarla es el mismo que el de presentacion/manual.
      'panel/entrar',
    ])
    expect(urls).toEqual([`${ORIGEN}/`, `${ORIGEN}/sabores`])
    expect(xmlDelSitemap(urls)).toContain(`<loc>${ORIGEN}/</loc>`)
    expect(xmlDelSitemap(urls)).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/)
  })

  it('vercel.json: 301 exacto de /sitio → / (sin comerse /sitio/… de assets) y una sola forma de URL', () => {
    expect(vercel.trailingSlash).toBe(false)
    expect(vercel.cleanUrls).toBe(true) // /index.html → /
    // El alias *.vercel.app redirige ENTERO a www: `/:camino*` no cubre la
    // raíz en Vercel (verificado en producción), así que la raíz va aparte.
    const alAlias = vercel.redirects.filter((r) => JSON.stringify(r.has ?? []).includes('maracacao.vercel.app'))
    expect(alAlias.map((r) => r.source).sort()).toEqual(['/', '/:camino*'])
    const aHome = vercel.redirects.find((r) => r.source === '/sitio')
    expect(aHome).toEqual({ source: '/sitio', destination: '/', permanent: true })
    for (const r of vercel.redirects) expect(r.source).not.toMatch(/^\/sitio\//)
  })

  it('vercel.json: X-Robots-Tag de refuerzo solo sobre lo privado — ya no sobre /sitio (tapaba las imágenes)', () => {
    const cabecera = vercel.headers.find((h) => h.source.includes('presentacion|manual'))
    expect(cabecera).toBeDefined()
    expect(cabecera!.source).toContain('presentacion|manual')
    expect(cabecera!.source).not.toContain('sitio')
    expect(cabecera!.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
  })

  it('vercel.json: caché larga para fuentes (inmutables) y corta con revalidación para imágenes de public/', () => {
    const valor = (fuente: string) =>
      vercel.headers.find((h) => h.source.includes(fuente))?.headers.find((c) => c.key === 'Cache-Control')?.value
    expect(valor('/fonts/')).toBe('public, max-age=31536000, immutable')
    expect(valor('sitio|social')).toMatch(/^public, max-age=86400, stale-while-revalidate=/)
  })
})

describe('los sabores son texto servido, no solo aria-labels', () => {
  it('cada uno de los 15 nombres aparece como heading de su ficha', async () => {
    const html = await container.renderToString(Home)
    for (const s of sabores) {
      expect(html).toContain(`data-ficha-de="${s.slug}"`)
      // Astro suma su data-astro-cid de estilos scoped al tag.
      expect(html).toMatch(new RegExp(`<h3 class="ficha-nombre"[^>]*>${esc(s.nombre)}</h3>`))
    }
  })

  it('sin `hidden` servido en las fichas: sin JS se ven las quince (el script esconde al tomar control)', () => {
    // El corte termina en `ficha-ilustracion`, no en `ficha-extras`: el
    // <figure> de la ilustración (Tarea 7) SÍ puede traer `hidden` de
    // build cuando el sabor no tiene dibujo — no es una de las quince
    // fichas de este test, que solo cubre los divs `data-ficha-de`.
    const fuente = readFileSync('src/pages/index.astro', 'utf8')
    const bloque = fuente.slice(fuente.indexOf('data-ficha-de'), fuente.indexOf('ficha-ilustracion'))
    expect(bloque).not.toContain('hidden')
  })
})
