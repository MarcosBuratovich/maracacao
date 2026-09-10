/*
 * El mapa de los documentos del sistema. Crece con cada documento que se
 * migra: primero productos, después fichas, después el sitio.
 *
 * Lo van a leer el panel (para saber qué puede editar), la función de
 * publicación (para revalidar todo desde cero antes de tocar GitHub) y los
 * candados de test.
 */
import type { z } from 'zod'
import { esquemaSitio } from './sitio'
import { esquemaSabores } from './sabores'
import { esquemaFichas } from './fichas'

export type IdDocumento = 'sitio' | 'sabores' | 'fichas'

export const DOCUMENTOS = {
  sitio: esquemaSitio,
  sabores: esquemaSabores,
  fichas: esquemaFichas,
} as const satisfies Readonly<Record<IdDocumento, z.ZodType>>
