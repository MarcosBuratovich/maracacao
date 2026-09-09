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

const esContenedor = (tipo: string): boolean =>
  tipo === 'object' || tipo === 'tuple' || tipo === 'array' || tipo === 'union'

const esEnvoltura = (tipo: string): boolean => tipo === 'optional' || tipo === 'nullable'

/**
 * Pela TODAS las envolturas (`optional`/`nullable`) de una vez y devuelve
 * las dos cosas que cuelgan de ese mismo desenvolvimiento:
 *
 * - `fondo`: qué hay abajo del todo, que es lo que decide si la envoltura
 *   es transparente (contenedor: hay que atravesar para sacar a los hijos)
 *   o si la envoltura entera es la hoja.
 * - `meta`: el metadato del panel del primer nivel de la cadena que lo tenga.
 *
 * Las dos salen de acá a propósito. Cuando cada una pelaba por su cuenta
 * —el fondo todos los niveles, el metadato uno solo— coincidían con UNA
 * envoltura (el único caso que hoy existe en `campos.ts`) y se separaban
 * con dos: el nivel intermedio no tiene registro propio, así que el
 * metadato se perdía SIN UN SOLO ERROR y el panel dibujaría ese campo sin
 * nombre. Un desenvolvimiento único no se puede desincronizar de sí mismo.
 *
 * Se pregunta nivel por nivel, de AFUERA hacia adentro, por dos razones:
 * `panel.get()` no sigue la cadena de padres a través de
 * `optional`/`nullable` (crean un tipo nuevo, sin `parent`) aunque sí la
 * siga a través de `.refine()`/`.max()`; y `anota()` recibe siempre el
 * esquema TERMINADO (ver `campos.ts`), así que si la cadena entera está
 * anotada —`precioONada`— esa es la anotación deliberada y gana. Si no lo
 * está —`texto({...}).optional()`, donde la base venía anotada antes de
 * envolverla— se sigue bajando hasta encontrarla.
 *
 * Recursivo y no iterativo a propósito: una cadena circular solo se puede
 * fabricar mutando `_zod.def` a mano, fuera de la API pública, y así
 * revienta enseguida con un `RangeError` en vez de colgarse para siempre.
 */
const desenvuelve = (
  esquema: z.ZodType,
  heredado?: MetaCampo,
): { fondo: z.ZodType; meta: MetaCampo | undefined } => {
  const meta = heredado ?? (panel.get(esquema) as MetaCampo | undefined)
  const def = definicion(esquema)
  return esEnvoltura(def.type)
    ? desenvuelve(def.innerType as z.ZodType, meta)
    : { fondo: esquema, meta }
}

/**
 * Recorre el árbol del esquema y llama a `visita` en cada HOJA, con su
 * ruta punteada ('hero.titular.1'), el metadato del panel y el esquema
 * que de verdad hay que usar para validar ese valor.
 *
 * Los contenedores (object, array, tuple) no son hojas: se atraviesan.
 * `optional`/`nullable` son transparentes SOLO cuando envuelven un
 * contenedor (ahí hay que seguir para sacar a los hijos). Cuando envuelven
 * una hoja, la hoja que se emite es la envoltura COMPLETA, no el interior
 * desnudo: `precioONada` existe para aceptar `null`, y el `z.int()` de
 * adentro, sin el `.nullable()` puesto, lo rechazaría.
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
    case 'nullable': {
      // Un solo desenvolvimiento alimenta las dos decisiones de este caso.
      const { fondo, meta } = desenvuelve(esquema)
      if (esContenedor(definicion(fondo).type)) {
        recorre(fondo, visita, prefijo)
      } else {
        visita(prefijo, meta, esquema)
      }
      return
    }
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
