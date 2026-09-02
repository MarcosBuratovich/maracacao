// Sitemap propio (lanzamiento 2026-08-20). @astrojs/sitemap escribía la
// raíz sin barra (`https://www.maracacao.mx`) por trailingSlash 'never',
// distinta del canonical `https://www.maracacao.mx/`; con una sola página
// indexable y rutas privadas que filtrar, veinte líneas controlan el
// formato exacto. Las páginas nuevas entran solas al build.
import type { AstroIntegration } from 'astro'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** Rutas con candado + noindex: nunca van al sitemap. */
export const RUTAS_PRIVADAS = /^(presentacion|manual)(\/|$)/

/**
 * Las URL indexables a partir de los pathnames que Astro reporta al
 * terminar el build (`''` es la raíz; `404` y `500` son páginas de
 * estado). La raíz conserva su barra; el resto va sin barra final,
 * igual que los canonicals.
 */
export function urlsDelSitemap(site: string, pathnames: string[]): string[] {
  const origen = site.replace(/\/+$/, '')
  const vistas = new Set<string>()
  for (const crudo of pathnames) {
    const ruta = crudo.replace(/^\/+|\/+$/g, '')
    if (/^(404|500)$/.test(ruta) || RUTAS_PRIVADAS.test(ruta)) continue
    vistas.add(ruta === '' ? `${origen}/` : `${origen}/${ruta}`)
  }
  // La raíz primero: orden estable y legible del índice.
  return [...vistas].sort((a, b) => a.length - b.length)
}

export function xmlDelSitemap(urls: string[]): string {
  const entradas = urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entradas}\n</urlset>\n`
}

export function sitemapMaracacao(): AstroIntegration {
  let site: string | undefined
  return {
    name: 'maracacao:sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (!site) {
          logger.warn('Sin `site` en astro.config: no se escribe sitemap.xml')
          return
        }
        const urls = urlsDelSitemap(site, pages.map((p) => p.pathname))
        await writeFile(fileURLToPath(new URL('sitemap.xml', dir)), xmlDelSitemap(urls), 'utf8')
        logger.info(`sitemap.xml con ${urls.length} URL: ${urls.join(', ')}`)
      },
    },
  }
}
