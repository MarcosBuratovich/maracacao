import { sabor } from '@/tokens/color'

/**
 * LOS QUINCE SABORES — la fuente única del rediseño (2026-08-13).
 *
 * Nombres: los IMPRESOS en la envoltura (decisión de Marcos, 2026-08-13),
 * no los del catálogo. Por eso «Jengibre y naranja» y no «Naranja con
 * jengibre», «Fresas y chile» y no «Fresas enchiladas», «Hierbabuena» y
 * no «Yerbabuena», «Tamarindo con chile» y no «Tamarindo». La envoltura
 * es la autoridad: es lo que la persona lee en el producto que compra.
 *
 * Ingredientes y % de cacao: leídos del arte de imprenta
 * (docs/envolturas.json, extraído por scripts/extrae-envolturas.py); un
 * test verifica que estas strings no se desvíen del JSON. Mango y piña
 * dicen 73% impreso aunque el cliente declaró «todos 70%» — se muestra
 * lo impreso hasta que el cliente resuelva el conflicto. Chamoy trae el
 * porcentaje dentro de la línea combinada («Chocolate 70% cacao y
 * chamoy»), por eso el JSON lo tiene en null pero acá va 70%.
 *
 * `orden` es la numeración impresa de la serie (1–15).
 * Precios del catálogo público (pulpos.shop): todas $108 salvo jengibre
 * y naranja $122.
 */
export interface Sabor {
  orden: number
  slug: string
  clave: keyof typeof sabor
  nombre: string
  /** Texto del ticket: 'Cacao 70%', 'Cacao 73%' o 'Chocolate blanco'. */
  cacao: string
  precio: number
  ingredientes: string
}

export const sabores: readonly Sabor[] = [
  { orden: 1, slug: 'jengibre-y-naranja', clave: 'jengibreYNaranja', nombre: 'Jengibre y naranja', cacao: 'Cacao 70%', precio: 122, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural y jengibre' },
  { orden: 2, slug: 'menta-intensa', clave: 'mentaIntensa', nombre: 'Menta intensa', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural' },
  { orden: 3, slug: 'limoncillo', clave: 'limoncillo', nombre: 'Limoncillo', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural' },
  { orden: 4, slug: 'lima-y-chile', clave: 'limaYChile', nombre: 'Lima y chile', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, chiles ahumados, esencia natural' },
  { orden: 5, slug: 'coriandro', clave: 'coriandro', nombre: 'Coriandro', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural' },
  { orden: 6, slug: 'fresas-y-chile', clave: 'fresasYChile', nombre: 'Fresas y chile', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, fresas, esencia natural de mandarina y chile chipotle' },
  { orden: 7, slug: 'hierbabuena', clave: 'hierbabuena', nombre: 'Hierbabuena', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural' },
  { orden: 8, slug: 'canela', clave: 'canela', nombre: 'Canela', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural' },
  { orden: 9, slug: 'sal-de-mar', clave: 'salDeMar', nombre: 'Sal de mar', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, sal de mar' },
  { orden: 10, slug: 'tamarindo', clave: 'tamarindo', nombre: 'Tamarindo con chile', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, tamarindo con chile' },
  { orden: 11, slug: 'pina-con-chile', clave: 'pinaConChile', nombre: 'Piña con chile', cacao: 'Cacao 73%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, piña con chile' },
  { orden: 12, slug: 'cardamomo', clave: 'cardamomo', nombre: 'Cardamomo', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, cardamomo' },
  { orden: 13, slug: 'blanco-con-pistache', clave: 'blancoConPistache', nombre: 'Blanco con pistache', cacao: 'Chocolate blanco', precio: 108, ingredientes: 'Manteca de cacao, leche en polvo, azúcar, lecitina de soya, pistaches' },
  { orden: 14, slug: 'mango-con-chile', clave: 'mangoConChile', nombre: 'Mango con chile', cacao: 'Cacao 73%', precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, mango con chile' },
  { orden: 15, slug: 'chamoy', clave: 'chamoy', nombre: 'Chamoy', cacao: 'Cacao 70%', precio: 108, ingredientes: 'Licor de cacao, manteca de cacao, azúcar, lecitina de soya, chamoy' },
] as const

/**
 * Las bolsas de GOTAS de 250 g (el cliente las llama gotas, nunca
 * «chispas»). Sabores y precios del catálogo; el nombre de sabor usa la
 * misma grafía que la barra correspondiente para que un sabor se llame
 * igual en todo el sitio. Casi todas $258; jengibre y naranja $340.
 */
export const gotas = [
  { clave: 'jengibreYNaranja', nombre: 'Jengibre y naranja', precio: 340 },
  { clave: 'hierbabuena', nombre: 'Hierbabuena', precio: 258 },
  { clave: 'canela', nombre: 'Canela', precio: 258 },
  { clave: 'mentaIntensa', nombre: 'Menta', precio: 258 },
  { clave: 'limoncillo', nombre: 'Limoncillo', precio: 258 },
  { clave: 'limaYChile', nombre: 'Lima y chile', precio: 258 },
] as const satisfies ReadonlyArray<{ clave: keyof typeof sabor; nombre: string; precio: number }>

/** Paquete de seis minis de 10 g: surtido, los sabores siempre cambian. */
export const paqueteSeis = { precio: 118 } as const

/**
 * La línea de chocolate en polvo (PRÓXIMAMENTE — no está a la venta).
 * Ocho etiquetas reales en public/sitio/etiqueta-*.webp; los campos de
 * color son los tonos `etiqueta` medidos de esas etiquetas.
 */
export const polvo = [
  { archivo: 'etiqueta-naranja-jengibre', nombre: 'Naranja y jengibre' },
  { archivo: 'etiqueta-canela', nombre: 'Canela' },
  { archivo: 'etiqueta-limoncillo', nombre: 'Limoncillo' },
  { archivo: 'etiqueta-chile', nombre: 'Chile' },
  { archivo: 'etiqueta-menta', nombre: 'Menta' },
  { archivo: 'etiqueta-cardamomo', nombre: 'Cardamomo' },
  { archivo: 'etiqueta-cocoa-natural', nombre: 'Cocoa natural' },
  { archivo: 'etiqueta-cocoa-alcalina', nombre: 'Cocoa alcalina' },
] as const
