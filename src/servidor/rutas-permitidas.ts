/*
 * La lista blanca de escritura del panel. Defensa en profundidad (E6): el
 * PAT fino ya no tiene permiso de Workflows, así que GitHub por sí solo
 * rechazaría un push que toque `.github/workflows/**`. Esto para ESO antes
 * de llegar a GitHub, y además para todo lo demás que el PAT sí podría
 * escribir (cualquier archivo del repo con permiso de Contents) y que el
 * panel no tiene por qué tocar: `package.json`, `vercel.json`, el código
 * fuente, el esquema de contenido.
 *
 * Puro e inyectable (regla de `src/servidor/**`): no lee nada del entorno,
 * no importa nada de `src/contenido/**`. Solo texto adentro, booleano
 * afuera.
 *
 * Deny-by-default con expresiones EXACTAS (`^...$`), no un chequeo de
 * prefijo: una ruta matchea entera o no matchea. Por eso una escapada de
 * directorio (`../`), una barra inicial (ruta absoluta), una barra doble,
 * un segmento de más o una mayúscula quedan afuera SIN normalizar nada
 * primero — no hay `path.normalize` ni `.toLowerCase()` en este archivo.
 * Si los hubiera, `Sitio.json` se colaría convertida a minúscula, o
 * `datos/../../../etc/passwd` se colaría resuelta a otra cosa: la regla
 * de esta lista es que la ruta tal cual LLEGA tiene que ser, letra por
 * letra, una de las que el patrón describe.
 */

/** Cada expresión es una ruta EXACTA (ancla ^ y $), no un prefijo. */
const RUTAS_PERMITIDAS: RegExp[] = [
  /^src\/contenido\/datos\/[a-z0-9-]+\.json$/,
  /^public\/sitio\/(marca|envoltura)\/[a-z0-9-]+\.webp$/,
  /^public\/sitio\/etiqueta-[a-z0-9-]+\.webp$/,
]

/** Si el panel puede escribir esta ruta exacta (crear, reemplazar o borrar). */
export function rutaPermitida(ruta: string): boolean {
  return RUTAS_PERMITIDAS.some((patron) => patron.test(ruta))
}

/** Cuántos archivos puede tocar una sola publicación. */
export const TOPE_ARCHIVOS = 40

/**
 * Cuántos bytes puede pesar el CUERPO del pedido de una sola publicación.
 * Es sobre el cuerpo, no sobre los binarios: la API de blobs exige
 * base64, que pesa ~4/3 del original — 3.5 MB de cuerpo son ~2.6 MB de
 * binario real.
 */
export const TOPE_CUERPO = 3.5 * 1024 * 1024

/**
 * Revisa un lote completo antes de tocar GitHub: cada ruta tiene que estar
 * en la lista blanca, y el lote entero tiene que entrar en los topes. Si
 * UNA ruta no está permitida, se rechaza el lote entero (no se publica una
 * parte) — el mensaje nombra esa ruta para que quien lo lea en el log
 * sepa cuál fue.
 */
export function revisaLote(rutas: string[], bytesDelCuerpo: number): { ok: true } | { ok: false; problema: string } {
  if (rutas.length > TOPE_ARCHIVOS) {
    return { ok: false, problema: `Son demasiadas fotos para una sola publicación: mandá hasta ${TOPE_ARCHIVOS} por vez.` }
  }

  if (bytesDelCuerpo > TOPE_CUERPO) {
    return { ok: false, problema: 'Es demasiado contenido para una sola publicación: mandá menos fotos, o de menor tamaño.' }
  }

  for (const ruta of rutas) {
    if (!rutaPermitida(ruta)) {
      return { ok: false, problema: `No se puede publicar "${ruta}": no es un archivo que el panel pueda tocar.` }
    }
  }

  return { ok: true }
}
