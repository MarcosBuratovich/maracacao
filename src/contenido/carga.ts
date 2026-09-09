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
 * las TRES cosas que cuelgan de ese mismo desenvolvimiento:
 *
 * - `fondo`: qué hay abajo del todo, que es lo que decide si la envoltura
 *   es transparente (contenedor: hay que atravesar para sacar a los hijos)
 *   o si la envoltura entera es la hoja.
 * - `meta`: el metadato del panel del primer nivel de la cadena que lo tenga.
 * - `opcional`: si en CUALQUIER nivel de la cadena hubo un `.optional()`.
 *   Es lo que decide si `serializa()` puede omitir la clave sin tirar: un
 *   `.optional()` en cualquier posición hace que el valor completo acepte
 *   `undefined` de verdad —Zod lo prueba contra el resto de la cadena—,
 *   así que mirar solo el nivel MÁS EXTERNO se equivoca con
 *   `.optional().nullable()`: ahí el nivel externo es `nullable`, el
 *   `.optional()` quedó adentro, y una clave que sí acepta `undefined`
 *   se exigiría como si fuera obligatoria.
 *
 * Las tres salen de ACÁ, del mismo desenvolvimiento, a propósito — es la
 * lección de este archivo repetida una vez más. Cuando `fondo` y `meta`
 * pelaban por su cuenta cada uno (`fondo` todos los niveles, `meta` uno
 * solo) coincidían con UNA envoltura y se separaban con dos: el nivel
 * intermedio no tiene registro propio, así que el metadato se perdía SIN
 * UN SOLO ERROR y el panel dibujaría ese campo sin nombre. `opcional` es
 * la misma trampa con una tercera pregunta: antes de esto vivía en un
 * desenvolvimiento APARTE, adentro de `ordenaSegun()`, que pelaba un solo
 * nivel — y ese desenvolvimiento aparte fue justo lo que se desincronizó
 * en la revisión de esta tarea. Un desenvolvimiento único no se puede
 * desincronizar de sí mismo.
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
  opcional = false,
): { fondo: z.ZodType; meta: MetaCampo | undefined; opcional: boolean } => {
  const meta = heredado ?? (panel.get(esquema) as MetaCampo | undefined)
  const def = definicion(esquema)
  return esEnvoltura(def.type)
    ? desenvuelve(def.innerType as z.ZodType, meta, opcional || def.type === 'optional')
    : { fondo: esquema, meta, opcional }
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

/** Congela hacia adentro. La garantía real es de runtime, no de tipos. */
function congela<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') return valor
  for (const v of Object.values(valor)) congela(v)
  return Object.freeze(valor)
}

/**
 * Valida el JSON contra su esquema y devuelve el objeto congelado.
 *
 * Si falla, TIRA. Y tiene que tirar: `cargar()` corre adentro del módulo
 * que `index.astro` importa, así que un JSON inválido revienta
 * `astro build` y Vercel deja servido el deploy anterior. Envolverlo en
 * try/catch publicaría la página rota, que es exactamente lo contrario.
 */
export function cargar<E extends z.ZodType>(
  archivo: string,
  esquema: E,
  crudo: unknown,
): Readonly<z.infer<E>> {
  const r = esquema.safeParse(crudo)
  if (!r.success) {
    const problemas = r.error.issues
      .map((i) => `  ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n')
    throw new Error(`${archivo} — ${r.error.issues.length} problema(s):\n${problemas}`)
  }
  return congela(r.data) as Readonly<z.infer<E>>
}

/**
 * Bytes canónicos: el orden de las claves lo manda el ESQUEMA, no el
 * objeto, y los invisibles (U+00A0 y compañía) salen escapados.
 *
 * Lo primero evita que dos guardados seguidos produzcan diffs distintos
 * sin que haya cambiado nada. Lo segundo conserva una convención que el
 * repo ya tiene: hoy hay cero caracteres U+00A0 literales en el fuente.
 *
 * Tira si el esquema y el dato no coinciden — y por eso además sirve como
 * prueba de que el esquema describe exactamente el contenido de hoy.
 */
export function serializa<E extends z.ZodType>(esquema: E, valor: unknown): string {
  const ordenado = ordenaSegun(esquema, valor, '')
  return JSON.stringify(ordenado, null, 2).replace(
    // Escritos como \u para que el archivo no dependa de caracteres que
    // un copiar-y-pegar puede comerse: espacio duro, los espacios finos,
    // los de ancho cero y el BOM.
    /[\u00a0\u2000-\u200d\ufeff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

function ordenaSegun(esquema: z.ZodType, valor: unknown, ruta: string): unknown {
  const def = definicion(esquema)
  const donde = ruta || '(raíz)'

  switch (def.type) {
    case 'optional':
      return valor === undefined
        ? undefined
        : ordenaSegun(def.innerType as z.ZodType, valor, ruta)

    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>
      if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
        throw new Error(`${donde}: el esquema espera un bloque y el dato trae ${typeof valor}.`)
      }
      const dato = valor as Record<string, unknown>
      const sobrantes = Object.keys(dato).filter((k) => !(k in shape))
      if (sobrantes.length) {
        throw new Error(
          `${donde}: el dato trae claves que el esquema no declara: ${sobrantes.join(', ')}.`,
        )
      }
      const salida: Record<string, unknown> = {}
      for (const clave of Object.keys(shape)) {
        const hijo = shape[clave]
        // Mismo desenvolvimiento que usa recorre(): pela TODOS los
        // niveles, no uno solo. Un chequeo aparte de un nivel es
        // exactamente el bug que ya pagó recorre() en otra forma — ver
        // el comentario de desenvuelve().
        const { opcional } = desenvuelve(hijo)
        if (!(clave in dato)) {
          if (opcional) continue
          throw new Error(`${donde}: falta «${clave}», que el esquema declara.`)
        }
        salida[clave] = ordenaSegun(hijo, dato[clave], ruta ? `${ruta}.${clave}` : clave)
      }
      return salida
    }

    case 'tuple': {
      const items = def.items as z.ZodType[]
      if (!Array.isArray(valor) || valor.length !== items.length) {
        throw new Error(`${donde}: el esquema espera exactamente ${items.length} elementos.`)
      }
      return items.map((it, i) => ordenaSegun(it, valor[i], `${ruta}.${i}`))
    }

    case 'array': {
      if (!Array.isArray(valor)) throw new Error(`${donde}: el esquema espera una lista.`)
      return valor.map((v, i) => ordenaSegun(def.element as z.ZodType, v, `${ruta}.${i}`))
    }

    default:
      return valor
  }
}
