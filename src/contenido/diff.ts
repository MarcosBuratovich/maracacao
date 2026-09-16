/*
 * El resumen de qué cambió: la clienta lo lee en la bandeja antes de
 * publicar, es el asunto del commit que arma la función (Tarea 5), y en la
 * fase 6 va a ser el historial. Una sola función para los tres — si cada
 * consumidor lo calculara por su cuenta, tres resúmenes de la MISMA edición
 * terminarían diciendo cosas distintas.
 *
 * Como el resto de `src/contenido/`, corre en el navegador (la bandeja), en
 * la función serverless (el asunto del commit) y en vitest: nada de
 * `node:*`, nada de Astro, solo `zod` y rutas relativas sin extensión.
 *
 * `resume()` NO toca `_zod.def`: eso es lo único que `recorre()` (en
 * `carga.ts`) tiene permiso de hacer. Este archivo camina el esquema
 * apoyándose en las RUTAS GENÉRICAS que `recorre()` ya produce —con `[]`
 * donde hay una lista y `<clave=valor>` donde hay una variante de unión— y
 * las instancia contra los dos documentos reales (antes y después) con la
 * misma técnica que `enRutas()` usa en `validacion.ts` para los avisos de
 * conteo, pero comparando DOS valores a la vez en lugar de uno.
 */
import type { z } from 'zod'
import { recorre } from './carga'
import type { MetaCampo } from './campos'

export interface Cambio {
  campo: string
  etiqueta: string
  antes: unknown
  despues: unknown
  tipo: 'cambio' | 'alta' | 'baja'
}

/**
 * Un campo lo edita la clienta cuando su metadato existe y no está marcado
 * como derivado, oculto o de Marcos.
 *
 * `control: 'derivado'` se recalcula (ver `derivados.ts`): reportarlo
 * pondría «cambiaste el contador» en cada publicación donde la cantidad de
 * barras se movió sola, aunque nadie tocó ese campo. `control: 'oculto'` y
 * `quien: 'marcos'` son las dos formas en que un campo queda fuera de lo que
 * la clienta ve — la primera por tipo de control (tokens, slugs, rutas
 * internas), la segunda porque un campo con forma de texto normal
 * (`trampa`, la caja del formulario) igual es de Marcos. Un campo sin
 * metadato registrado tampoco se reporta: sin metadato no hay etiqueta, y
 * sin etiqueta no hay nada honesto que mostrarle a la clienta (regla del
 * campo 3 de esta tarea).
 */
function seEdita(meta: MetaCampo | undefined): meta is MetaCampo {
  return meta !== undefined && meta.control !== 'derivado' && meta.control !== 'oculto' && meta.quien !== 'marcos'
}

/** Misma regla que `con()` en carga.ts y `une()` en validacion.ts: la raíz no lleva punto adelante. */
const una = (a: string, b: string | number): string => (a === '' ? String(b) : `${a}.${b}`)

/** Indexa un valor por clave sin explotar si el valor es `null`/`undefined` (un `optional`/`nullable` de por medio). */
function valorEn(v: unknown, clave: string): unknown {
  if (v === null || typeof v !== 'object') return undefined
  return (v as Record<string, unknown>)[clave]
}

/**
 * Misma forma que la de `validacion.ts`: una parte de ruta trae la clave
 * (puede faltar: 'filas[][]' trae dos `[]` seguidos sin clave entre medio),
 * cero o más `[]` de lista, y la marca `<discriminante=variante>` de una
 * unión. Se repite acá — y no se importa de `validacion.ts`, que no la
 * exporta— porque lo que hay que hacer con cada parte es distinto: allí se
 * instancia UN documento, acá se instancian DOS a la vez y una lista que
 * cambió de largo corta la baja en seco en vez de seguir bajando.
 */
const PARTE = /^([^<[]*)((?:\[\])*)(?:<([^=>]+)=([^>]+)>)?$/

/** Un candidato de comparación: una ruta ya concreta con su valor de cada lado. */
interface Par {
  ruta: string
  antes: unknown
  despues: unknown
}

/**
 * Instancia una ruta genérica contra los dos documentos y agrega los
 * `Cambio` que encuentra a `cambios`.
 *
 * Para las listas compara por índice, PERO si el largo cambió no baja a
 * comparar elemento por elemento: reporta un único alta o baja para toda la
 * lista y corta ahí. Sin este corte, borrar la segunda de ocho preguntas se
 * lee como «cambiaron las preguntas 2 a 7 y desapareció la 8» — siete
 * avisos de una sola tijera. `vistos` deduplica ese único aviso: una ruta
 * como `preguntas.items[].p` y `preguntas.items[].r` son DOS rutas
 * genéricas para el mismo campo `items`, y las dos van a pisar el mismo
 * cambio de largo si no se recuerda que ya se reportó.
 */
function comparaRuta(
  ruta: string,
  meta: MetaCampo,
  antesRaiz: unknown,
  despuesRaiz: unknown,
  cambios: Cambio[],
  vistos: Set<string>,
): void {
  const partes = ruta.split('.')
  let actuales: Par[] = [{ ruta: '', antes: antesRaiz, despues: despuesRaiz }]

  for (let i = 0; i < partes.length; i++) {
    const m = PARTE.exec(partes[i])
    if (!m) throw new Error(`diff: no entiendo la parte «${partes[i]}» de la ruta «${ruta}».`)
    const [, clave, corchetes, discriminante, variante] = m
    const niveles = corchetes.length / 2
    // Es la última parte de la ruta cuando, además de ser el último punto,
    // no queda ningún `[]` sin desenvolver: ahí es donde el VALOR que se
    // está mirando es la hoja de verdad, la del `meta` que recibió esta
    // llamada — y no un contenedor que todavía tiene un campo adentro.
    const siguiente: Par[] = []

    for (const par of actuales) {
      const base = clave ? una(par.ruta, clave) : par.ruta
      const antesDentro = clave ? valorEn(par.antes, clave) : par.antes
      const despuesDentro = clave ? valorEn(par.despues, clave) : par.despues

      let candidatos: Par[] = [{ ruta: base, antes: antesDentro, despues: despuesDentro }]
      for (let nivel = 0; nivel < niveles; nivel++) {
        const esUltimoNivel = i === partes.length - 1 && nivel === niveles - 1
        const desenvueltos: Par[] = []
        for (const c of candidatos) {
          const aArr = Array.isArray(c.antes) ? c.antes : []
          const dArr = Array.isArray(c.despues) ? c.despues : []
          if (aArr.length !== dArr.length) {
            if (!vistos.has(c.ruta)) {
              vistos.add(c.ruta)
              // Cuando la lista termina la ruta ACÁ (sin más campos
              // después), el elemento es la hoja misma y su propio
              // metadato («Sello») es la etiqueta correcta. Cuando la
              // lista guarda un bloque con más de un campo (`items[].p`,
              // `items[].r`), ese metadato es el de UN campo del bloque, no
              // el de la lista — `recorre()` nunca visita la lista como
              // hoja, así que no hay forma de llegar a «Las preguntas» sin
              // tocar `_zod.def`. La sección (siempre presente, compartida
              // por todos los campos del bloque) es el mejor sustituto que
              // se puede armar sin esa herramienta.
              const etiqueta = esUltimoNivel
                ? meta.etiqueta
                : meta.seccion.charAt(0).toUpperCase() + meta.seccion.slice(1)
              cambios.push({
                campo: c.ruta,
                etiqueta,
                antes: aArr.length,
                despues: dArr.length,
                tipo: dArr.length > aArr.length ? 'alta' : 'baja',
              })
            }
            continue // no sigue bajando por esta rama: ya quedó resuelta.
          }
          aArr.forEach((v, idx) => desenvueltos.push({ ruta: una(c.ruta, idx), antes: v, despues: dArr[idx] }))
        }
        candidatos = desenvueltos
      }

      for (const c of candidatos) {
        // La variante FILTRA por lo que dice HOY el documento: un bloque
        // que cambió de tipo no arrastra los campos de su tipo viejo. Es la
        // misma pregunta que resuelve `enRutas()` en validacion.ts, mirada
        // desde el lado de «qué hay que mostrar», no desde «qué avisos
        // corren».
        if (discriminante !== undefined) {
          const dice = valorEn(c.despues, discriminante)
          if (dice !== variante) continue
        }
        siguiente.push(c)
      }
    }
    actuales = siguiente
  }

  for (const par of actuales) {
    if (par.antes === par.despues) continue
    cambios.push({ campo: par.ruta, etiqueta: meta.etiqueta, antes: par.antes, despues: par.despues, tipo: 'cambio' })
  }
}

/**
 * Qué cambió entre dos documentos del mismo esquema, listo para que la
 * clienta lo lea, el commit lo firme y —fase 6— el historial lo muestre.
 *
 * Recorre el esquema con `recorre()` — la misma función que usan el panel y
 * la biyección — y por cada hoja que la clienta edita compara el valor de
 * `antes` con el de `despues`. Las listas se comparan por índice, salvo que
 * el largo haya cambiado: ahí es un alta o una baja, no una cascada de
 * «cambió» por cada elemento corrido.
 */
export function resume(antes: unknown, despues: unknown, esquema: z.ZodType): Cambio[] {
  const cambios: Cambio[] = []
  const vistos = new Set<string>()

  recorre(esquema, (ruta, meta) => {
    if (!seEdita(meta)) return
    comparaRuta(ruta, meta, antes, despues, cambios, vistos)
  })

  return cambios
}

/** Tope duro: lo que entra en el asunto de un commit sin que git lo corte feo a mitad de palabra. */
const LARGO_MAXIMO = 72

/** Cuenta con su singular o su plural: `1 texto`, `3 textos`. */
const cuenta = (n: number, [singular, plural]: readonly [string, string]): string =>
  n === 1 ? `1 ${singular}` : `${n} ${plural}`

/** «a», «a y b», «a, b y c». */
function une(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * De qué habla un `Cambio` de tipo `'cambio'`, para contarlo en la frase.
 *
 * `Cambio` no guarda el `control` del campo —la interfaz de esta tarea es
 * la que el spec pide, sin un campo extra que nadie más usa— así que la
 * categoría sale del TIPO del valor, no del esquema: un precio es un
 * número, un texto es una cadena. Es lo mismo que separa «cambia 3 textos»
 * de «cambia 2 precios» en el ejemplo del brief, sin inventar una segunda
 * fuente de verdad sobre qué es cada campo.
 */
function categoriaDe(c: Cambio): readonly [string, string] {
  if (typeof c.antes === 'number' || typeof c.despues === 'number') return ['precio', 'precios']
  return ['texto', 'textos']
}

const ALTA: readonly [string, string] = ['elemento agregado', 'elementos agregados']
const BAJA: readonly [string, string] = ['elemento quitado', 'elementos quitados']

/**
 * Arma la oración honesta y completa —«cambia 3 textos, 2 precios y 1
 * elemento agregado»— y la usa si entra en el tope. Si no entra, no la
 * corta a mitad de palabra: degrada a un conteo total, que siempre es
 * corto.
 */
function fraseVarios(cambios: Cambio[]): string {
  const categorias = new Map<string, { nombres: readonly [string, string]; n: number }>()
  let altas = 0
  let bajas = 0

  for (const c of cambios) {
    if (c.tipo === 'alta') { altas++; continue }
    if (c.tipo === 'baja') { bajas++; continue }
    const nombres = categoriaDe(c)
    const existente = categorias.get(nombres[1])
    if (existente) existente.n++
    else categorias.set(nombres[1], { nombres, n: 1 })
  }

  const clausulas = [...categorias.values()].map(({ n, nombres }) => cuenta(n, nombres))
  if (altas > 0) clausulas.push(cuenta(altas, ALTA))
  if (bajas > 0) clausulas.push(cuenta(bajas, BAJA))

  const honesta = `cambia ${une(clausulas)}`
  return honesta.length <= LARGO_MAXIMO ? honesta : `cambia ${cambios.length} campos`
}

/**
 * El asunto del commit (Tarea 5) y, en la fase 6, el resumen de la bandeja y
 * del historial: una sola función para los tres lugares que leen «qué
 * cambió», para que los tres digan lo mismo.
 *
 * Sin cambios no inventa nada. Con uno solo, nombra el campo por su
 * etiqueta. Con varios, cuenta por categoría — nunca los lista uno por
 * uno: quince líneas no caben en un asunto de commit y tampoco se leen en
 * la bandeja de un vistazo.
 */
export function frase(cambios: Cambio[]): string {
  if (cambios.length === 0) return ''

  if (cambios.length === 1) {
    const [c] = cambios
    const verbo = c.tipo === 'alta' ? 'agrega' : c.tipo === 'baja' ? 'quita' : 'cambia'
    const honesta = `${verbo} ${c.etiqueta}`
    return honesta.length <= LARGO_MAXIMO ? honesta : `${verbo} 1 campo`
  }

  return fraseVarios(cambios)
}
