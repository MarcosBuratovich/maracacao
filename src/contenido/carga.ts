/*
 * El cargador de contenido.
 *
 * `recorre()` es lo ÚNICO del sistema que toca interna de Zod. Está
 * acotado a propósito a ~60 líneas y a cinco formas, y `test/contenido.test.ts`
 * afirma cada una: si una versión nueva de Zod las mueve, falla ahí —con
 * un mensaje que lo explica— y no adentro del panel seis meses después.
 */
import { z } from 'zod'
import { panel, type MetaCampo } from './campos'

type Def = { type: string; [clave: string]: unknown }
const definicion = (e: unknown) => (e as { _zod: { def: Def } })._zod.def

/**
 * Recorre el árbol del esquema y llama a `visita` en cada HOJA, con su
 * ruta punteada ('hero.titular.1') y el metadato del panel.
 *
 * Los contenedores (object, array, tuple) no son hojas: se atraviesan.
 * Un `optional` se desenvuelve y la hoja es lo de adentro.
 */
export function recorre(
  esquema: z.ZodType,
  visita: (ruta: string, meta: MetaCampo | undefined, hoja: z.ZodType) => void,
  prefijo = '',
): void {
  const def = definicion(esquema)
  const con = (parte: string) => (prefijo ? `${prefijo}.${parte}` : parte)

  switch (def.type) {
    case 'optional':
      recorre(def.innerType as z.ZodType, visita, prefijo)
      return
    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>
      for (const clave of Object.keys(shape)) recorre(shape[clave], visita, con(clave))
      return
    }
    case 'tuple': {
      const items = def.items as z.ZodType[]
      items.forEach((item, i) => recorre(item, visita, con(String(i))))
      return
    }
    case 'array':
      // La ruta del elemento lleva `[]`: el panel la instancia por índice
      // cuando pinta la lista, y el dato real dice cuántos hay.
      recorre(def.element as z.ZodType, visita, `${prefijo}[]`)
      return
    case 'union':
      // `z.discriminatedUnion` reporta `def.type === 'union'`, así que sin
      // este caso caería en `default` y se emitiría como HOJA: todos los
      // campos de cada variante quedarían invisibles para el panel, sin un
      // solo error. La fase 1 parte B lo va a necesitar de verdad —los
      // bloques de las fichas técnicas son una unión discriminada— y ahí se
      // decide cómo se nombra la ruta de cada variante, con el esquema real
      // delante. Hasta entonces, ruidoso antes que mudo.
      throw new Error(
        `recorre(): todavía no sé recorrer una unión (en «${prefijo || '(raíz)'}»). ` +
          'Lo agrega la fase 1 parte B, con los bloques de ficha.',
      )
    default:
      visita(prefijo, panel.get(esquema), esquema)
  }
}
