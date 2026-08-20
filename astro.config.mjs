import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import { sitemapMaracacao } from './src/seo/sitemap'

export default defineConfig({
  // Host canónico: www (el apex hace 308 a www en Vercel). Alimenta los
  // canonicals de Base.astro y el sitemap (src/seo/sitemap.ts).
  site: 'https://www.maracacao.mx',
  // Una sola forma de URL (sin barra final); vercel.json hace el 308 en
  // producción con trailingSlash: false.
  trailingSlash: 'never',
  // Un solo locale hoy. La config existe para que sumar idiomas sea
  // agregar entradas, no reescribir el routing.
  i18n: {
    defaultLocale: 'es-MX',
    locales: ['es-MX'],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    // Un solo sitio de una página: el CSS va inline en el HTML y se
    // ahorra la ida y vuelta de tres hojas que bloqueaban el render
    // (~17KB gz; Lighthouse móvil, auditoría de lanzamiento).
    inlineStylesheets: 'always',
  },
  integrations: [
    mdx(),
    react(),
    // /sitemap.xml con lo indexable (filtra /presentacion y /manual).
    sitemapMaracacao(),
  ],
  vite: { plugins: [tailwindcss()] },
})
