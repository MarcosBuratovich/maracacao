/**
 * Si el sabor tiene ilustración de la envoltura dibujada.
 *
 * La fase 7 va a dejar que la clienta dé de alta un sabor desde el panel,
 * y ese sabor no va a tener ilustración hasta que alguien la dibuje. La
 * verdad de si existe vive en el disco (`public/sitio/marca/`), no en un
 * campo del esquema: `src/contenido/**` no puede importar `node:*` (regla
 * dura de la carpeta), así que este chequeo vive afuera, en `src/lib/`.
 *
 * `process.cwd()` y no `import.meta.url`: en `astro build` este módulo
 * termina empaquetado en el server bundle y `import.meta.url` apunta a
 * donde quedó ESE archivo (p. ej. dentro de `dist/`), no a la raíz del
 * repo. `process.cwd()` es la raíz del repo tanto en `astro build` como
 * en `vitest` (los dos corren desde ahí) y también en Vercel, donde el
 * build corre con esa misma raíz como directorio de trabajo.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function tieneIlustracion(slug: string): boolean {
  return existsSync(resolve(process.cwd(), 'public/sitio/marca', `ilustracion-${slug}.webp`))
}
