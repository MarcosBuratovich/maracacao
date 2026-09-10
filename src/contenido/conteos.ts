/*
 * El «15» está escrito en nueve lugares del sitio: el kicker del anaquel,
 * el contador, textos en prosa de negocios, «6 sabores» de las gotas. Si
 * la clienta agrega un sabor, todos esos textos mienten y hoy no hay un
 * solo test que lo detecte.
 *
 * La regla `cuenta` del metadato cruza el texto contra la lista real. En
 * cifra Y en letras, porque «seis sabores» es tan probable como «6».
 */
import type { ColeccionContada } from './campos'

const LETRAS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
  'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
] as const

export const enLetras = (n: number): string => LETRAS[n] ?? String(n)

/**
 * Devuelve el aviso si el texto menciona, PEGADO al sustantivo, una
 * cantidad distinta de la real — o null si está bien. `esperado` es
 * cuántos hay de verdad; `sustantivo` es el nombre de la lista
 * (`'sabores'`, `'gotas'`, `'polvo'`, `'recetas'`, `'preguntas'`, tal
 * cual vive en el metadato `cuenta`).
 *
 * Un número suelto en el texto no habla necesariamente de esto: «16–20
 * °C» o «1 kg» no son sobre sabores. La primera versión marcaba CUALQUIER
 * número entre 0 y 20 en todo el texto, y contra copy real del sitio eso
 * dio cuatro falsos positivos de seis casos — un aviso falso es peor que
 * ninguno, porque la clienta deja de leerlos. Ahora solo cuenta si el
 * número —en cifra o en letras— es la palabra INMEDIATA ANTES o DESPUÉS
 * del sustantivo (o de su singular: «sabores» tolera «sabor», «gotas»
 * tolera «gota», etc.).
 */
export function cruzaConteo(texto: string, esperado: number, sustantivo: string): string | null {
  const formas = new Set([sustantivo])
  if (sustantivo.endsWith('es')) formas.add(sustantivo.slice(0, -2)) // sabores -> sabor
  if (sustantivo.endsWith('s')) formas.add(sustantivo.slice(0, -1)) // gotas -> gota
  const esSustantivo = (token: string) => formas.has(token.toLowerCase())

  // Dígitos y letras en corridas separadas, nunca mezcladas en un mismo
  // token: así "15sabores" (sin espacio) sigue partiendo en dos, con el
  // mismo criterio que antes daba la frontera `[^\d]`.
  const tokens = texto.match(/[0-9]+|[a-záéíóúñ]+/gi) ?? []

  for (let i = 0; i < tokens.length; i++) {
    if (!esSustantivo(tokens[i])) continue
    for (const vecino of [tokens[i - 1], tokens[i + 1]]) {
      if (vecino === undefined) continue
      for (let n = 0; n <= 20; n++) {
        if (n === esperado) continue
        if (vecino === String(n)) return `dice «${n}» pero hoy hay ${esperado}.`
        if (vecino.toLowerCase() === enLetras(n)) return `dice «${enLetras(n)}» pero hoy hay ${esperado}.`
      }
    }
  }
  return null
}

/*
 * De un nombre de colección a la lista de verdad.
 *
 * Hasta acá el mapa de conteos se escribía a mano en cada llamador —una
 * vez en el candado del contenido publicado, otra en las mutaciones— y
 * ahí está el agujero: un mapa a mano dice «15» aunque el JSON tenga 16,
 * así que agregar una barra sin tocar los textos quedaba VERDE y
 * corregir los textos quedaba ROJO. Premiaba el error y castigaba el
 * arreglo. `api/panel.ts` iba a ser la tercera copia.
 *
 * La tabla de abajo es lo único que se declara: qué documento y qué ruta
 * tiene cada lista. El número sale siempre del dato.
 */

/** Los documentos crudos de los que sale algún conteo. */
export interface FuentesDeConteo {
  /** El documento del sitio (`datos/sitio.json`), con o sin derivados. */
  sitio: unknown
  /** El documento de productos (`datos/sabores.json`). */
  sabores: unknown
}

/**
 * Dónde vive cada lista contada: el documento y la ruta punteada.
 *
 * `Record<ColeccionContada, …>` y no un objeto suelto a propósito: agregar
 * un nombre a `ColeccionContada` sin decir de dónde sale es un error de
 * tipos acá, en vez de un `undefined` que `validar()` descubre en runtime
 * cuando la clienta ya apretó Publicar.
 */
const DONDE: Readonly<Record<ColeccionContada, readonly [keyof FuentesDeConteo, string]>> = {
  sabores: ['sabores', 'sabores'],
  gotas: ['sabores', 'gotas'],
  polvo: ['sabores', 'polvo'],
  recetas: ['sitio', 'recetas.lista'],
  preguntas: ['sitio', 'preguntas.items'],
  pasos: ['sitio', 'catar.pasos'],
  ingredientes: ['sitio', 'postura.lleva'],
}

const enRuta = (dato: unknown, ruta: string): unknown => {
  let actual: unknown = dato
  for (const paso of ruta.split('.')) {
    if (actual === null || typeof actual !== 'object') return undefined
    actual = (actual as Record<string, unknown>)[paso]
  }
  return actual
}

/**
 * Cuántos hay de verdad en cada lista contada, leído del dato.
 *
 * Lo consumen los tres: el candado del contenido publicado, `validar()`
 * desde el navegador mientras la clienta escribe, y `api/panel.ts` antes
 * de tocar GitHub. Si la lista no está donde `DONDE` dice, TIRA: un
 * conteo que falta deja `validar()` sin poder cruzar ese texto, y
 * callarse ahí es volver al estado anterior —la regla declarada y nadie
 * ejecutándola—.
 */
export function conteosDe(fuentes: FuentesDeConteo): Readonly<Record<ColeccionContada, number>> {
  const conteos = {} as Record<ColeccionContada, number>
  for (const nombre of Object.keys(DONDE) as ColeccionContada[]) {
    const [documento, ruta] = DONDE[nombre]
    const lista = enRuta(fuentes[documento], ruta)
    if (!Array.isArray(lista)) {
      throw new Error(
        `conteosDe(): «${nombre}» sale de «${documento}.${ruta}» y ahí no hay una lista.`,
      )
    }
    conteos[nombre] = lista.length
  }
  return conteos
}
