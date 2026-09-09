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
 * Devuelve el aviso si el texto menciona una cantidad distinta de la real,
 * o null si está bien. `esperado` es cuántos hay de verdad.
 */
export function cruzaConteo(texto: string, esperado: number): string | null {
  for (let n = 0; n <= 20; n++) {
    if (n === esperado) continue
    const cifra = new RegExp(`(^|[^\\d])${n}([^\\d]|$)`)
    const letra = new RegExp(`(^|[^a-záéíóúñ])${enLetras(n)}([^a-záéíóúñ]|$)`, 'i')
    if (cifra.test(texto)) return `dice «${n}» pero hoy hay ${esperado}.`
    if (letra.test(texto)) return `dice «${enLetras(n)}» pero hoy hay ${esperado}.`
  }
  return null
}
