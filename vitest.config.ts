/// <reference types="vitest/config" />
// Task 15: `test/variantes-logo.test.ts` importa componentes `.astro` y los
// renderiza con `experimental_AstroContainer`. Un `defineConfig` de
// `vitest/config` a secas (lo que había acá) no registra el plugin de Vite
// de Astro, así que Vite intenta parsear el `.astro` como JS/TS plano y
// revienta en el primer `<span ...>` del template con "Failed to parse
// source for import analysis... make sure to name the file .jsx/.tsx".
// `getViteConfig` (de `astro/config`) arma el mismo Vite config que usa
// `astro dev`/`astro build` — con el plugin de Astro adentro — y además
// relee `astro.config.mjs` (Tailwind, mdx, react), así que los tests de
// componentes ven el mismo entorno que el sitio real. Se mantiene el mismo
// alias `@` explícito que ya había, en vez de asumir que Astro lo toma
// solo de `tsconfig.json` paths — no hay que arriesgar el resto de la
// suite (287 tests preexistentes que ya dependen de `@/...`) a ese
// supuesto.
import { getViteConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

export default getViteConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})
