/**
 * Único lugar donde se arman URLs internas.
 * Hoy no hay prefijo de idioma. Cuando lo haya, se cambia acá y nada más.
 */
export function ruta(destino: string): string {
  const limpio = destino.replace(/^\/+|\/+$/g, '')
  return limpio === '' ? '/' : `/${limpio}`
}
