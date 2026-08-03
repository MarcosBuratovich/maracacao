import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'

export default defineConfig({
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
