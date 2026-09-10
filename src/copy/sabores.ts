/*
 * La fachada de los productos. El contenido vive en
 * `src/contenido/datos/sabores.json` y su forma en
 * `src/contenido/esquema/sabores.ts`, que es también el catálogo de campos
 * que el panel lee para pintarse.
 *
 * `cargar()` corre acá adentro, en el camino del import de index.astro: un
 * JSON inválido revienta `astro build` y Vercel deja servido el deploy
 * anterior. PROHIBIDO envolverlo en try/catch — eso publicaría la página
 * rota, que es exactamente lo contrario de lo que se quiere.
 */
import { cargar } from '../contenido/carga'
import { esquemaSabores } from '../contenido/esquema/sabores'
import datos from '../contenido/datos/sabores.json'

const productos = cargar('src/contenido/datos/sabores.json', esquemaSabores, datos)

export type Sabor = (typeof productos.sabores)[number]

export const { urlCatalogoBarras, sabores, gotas, polvo } = productos
