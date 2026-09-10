/*
 * La fachada del sitio. El contenido vive en
 * `src/contenido/datos/sitio.json` y su forma en
 * `src/contenido/esquema/sitio.ts`, que es también el catálogo de campos
 * que el panel lee para pintarse.
 *
 * Los cuatro precios derivados NO están en el JSON: se calculan acá, antes
 * de validar, porque el mismo número está escrito en hasta tres lugares y
 * pedirle a la clienta que los mantenga sincronizados es pedirle que se
 * equivoque. Ver `derivados.ts`.
 *
 * `cargar()` corre en el camino del import de index.astro: un JSON
 * inválido revienta `astro build` y Vercel deja servido el deploy
 * anterior. PROHIBIDO envolverlo en try/catch.
 */
import { cargar } from '../contenido/carga'
import { injerta } from '../contenido/derivados'
import { esquemaSitio } from '../contenido/esquema/sitio'
import datos from '../contenido/datos/sitio.json'
import { sabores, gotas } from './sabores'

export const marca = cargar(
  'src/contenido/datos/sitio.json',
  esquemaSitio,
  injerta(datos, { sabores, gotas }),
)

/** Precio en pesos con el locale del sitio. */
export function precioMXN(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}
