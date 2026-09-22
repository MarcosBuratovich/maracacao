/*
 * El id de ESTE navegador — comodidad de aparato, no de sesión (regla del
 * proyecto: `localStorage` solo para eso; el borrador de verdad vive en el
 * servidor). Mismo criterio y la misma forma que el helper que ya usa
 * `/panel/entrar` (`entrar.astro`, inline ahí porque esa página no pasa
 * por ningún build de JS): un valor al azar, estable entre visitas del
 * mismo navegador — nunca un nombre, este código no tiene forma de saber
 * si es un celular o una tablet prestada.
 *
 * Sirve para dos cosas del lado del servidor: la revocación quirúrgica de
 * UN aparato (`idDeDispositivo()`, `src/servidor/acciones.ts` — ese
 * normalizador ya se encarga de limar cualquier carácter fuera de su
 * alfabeto, así que acá alcanza con que el id sea estable y distinto por
 * navegador) y, más adelante, el candado anti-pisada del borrador entre
 * dos aparatos.
 */

const CLAVE = 'maracacao_aparato'

type AlmacenMinimo = Pick<Storage, 'getItem' | 'setItem'>

function generaId(): string {
  return 'aparato-' + crypto.randomUUID()
}

/**
 * El id de este navegador. Estable entre llamadas mientras `storage`
 * sirva; si el almacenamiento está bloqueado (modo privado, permisos) o
 * directamente no existe, cae a un id de esta sola visita — sigue siendo
 * DISTINTO del de cualquier otro aparato, que es lo único que le importa
 * al servidor. Perder la estabilidad ahí es mucho menos grave que volver a
 * compartir un id con todo el mundo.
 */
export function idDeAparato(storage: AlmacenMinimo = globalThis.localStorage): string {
  try {
    const guardado = storage.getItem(CLAVE)
    if (guardado) return guardado
    const nuevo = generaId()
    storage.setItem(CLAVE, nuevo)
    return nuevo
  } catch {
    return generaId()
  }
}
