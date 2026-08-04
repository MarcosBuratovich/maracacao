import mascotaRaw from '../../assets/brand/mascota.svg?raw'
import mascotaReducidaRaw from '../../assets/brand/mascota-reducida.svg?raw'
import logotipoRaw from '../../assets/brand/logotipo.svg?raw'
import logotipoArcoRaw from '../../assets/brand/logotipo-arco.svg?raw'
import descriptorRaw from '../../assets/brand/descriptor.svg?raw'
import { tokenizarSvg } from '@/lib/tokenize-svg'

/**
 * Bug compartido de la Task 15, descubierto en paralelo por la Task 18 y
 * por esta tarea: la versión original resolvía la ruta del SVG con
 * `fileURLToPath(new URL('...${nombre}.svg', import.meta.url))` en
 * runtime. Como `nombre` es dinámico, Vite no puede analizar ese `new
 * URL(...)` estáticamente para copiar el archivo al build, así que la
 * resolución quedaba relativa a dónde termina viviendo el módulo
 * compilado. Eso funcionaba en dev y bajo `AstroContainer` (el módulo
 * corre desde su ubicación real en `src/`), pero rompía con `ENOENT` en
 * `astro build`: el prerender reubica el chunk bajo
 * `dist/.prerender/chunks/`, y `../../assets/brand/` resuelto desde ahí
 * apunta a un `dist/assets/brand/` que nunca existió (los SVG de marca no
 * pasan por `public/`). Nadie había disparado esa rama en runtime hasta
 * que una tarea real montó estos componentes en una página dentro de
 * `astro build` — Task 17 (la styleguide) y Task 18 (el rig) lo pisaron
 * el mismo día, cada una en su propio worktree.
 *
 * Fix: imports estáticos `?raw` de Vite. Se resuelven en build-time y
 * viajan con el bundle — no dependen de dónde termine el chunk ni de que
 * el proceso corra con el cwd del repo. `nombre` solo toma estos cinco
 * valores en todo el código (ver los `svgDeMarca(...)` en
 * `src/components/brand/*.astro`); un mapa explícito es honesto para un
 * conjunto cerrado, no una limitación.
 */
const CRUDOS: Record<string, string> = {
  'mascota': mascotaRaw,
  'mascota-reducida': mascotaReducidaRaw,
  'logotipo': logotipoRaw,
  'logotipo-arco': logotipoArcoRaw,
  'descriptor': descriptorRaw,
}

/** Lee un SVG de marca, lo tokeniza y le saca la capa de pivotes. */
export function svgDeMarca(nombre: string): string {
  const crudo = CRUDOS[nombre]
  if (crudo === undefined) {
    throw new Error(`SVG de marca desconocido: "${nombre}". Nombres válidos: ${Object.keys(CRUDOS).join(', ')}`)
  }
  const sinPivotes = crudo.replace(/<g id="pivotes">[\s\S]*?<\/g>\s*/g, '')
  return tokenizarSvg(sinPivotes)
}
