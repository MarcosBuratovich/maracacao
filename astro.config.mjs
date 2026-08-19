import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'

export default defineConfig({
  // Host canónico: www (el apex hace 308 a www en Vercel). Alimenta los
  // canonicals de Base.astro y, al lanzar, @astrojs/sitemap.
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
  integrations: [mdx(), react()],
  vite: { plugins: [tailwindcss()] },
})
