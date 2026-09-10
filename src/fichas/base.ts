/*
 * La fachada de las fichas técnicas. El contenido vive en
 * `src/contenido/datos/fichas.json` y su forma en
 * `src/contenido/esquema/fichas.ts`.
 *
 * Lo consumen el generador de PDF (`pnpm fichas`) y la página
 * `/fichas-tecnicas`. La anotación `: Ficha[]` no es decorativa: es un
 * test estructural gratis contra el contrato del renderizador. Si el
 * esquema se separa de `Ficha`, `astro check` lo dice acá.
 */
import { cargar } from '../contenido/carga'
import { esquemaFichas } from '../contenido/esquema/fichas'
import datos from '../contenido/datos/fichas.json'
import type { Ficha } from './plantilla'

export const fichasBase: Ficha[] = cargar(
  'src/contenido/datos/fichas.json',
  esquemaFichas,
  datos,
).fichas
