/*
 * El «15» está escrito en nueve lugares del sitio: el kicker del anaquel,
 * el contador, textos en prosa de negocios, «6 sabores» de las gotas. Si
 * la clienta agrega un sabor, todos esos textos mienten y hoy no hay un
 * solo test que lo detecte.
 *
 * La regla `cuenta` del metadato cruza el texto contra la lista real. En
 * cifra Y en letras, porque «seis sabores» es tan probable como «6».
 */
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
