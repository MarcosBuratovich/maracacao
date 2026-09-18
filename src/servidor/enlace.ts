/*
 * El enlace mágico de recuperación (spec §4.1): la puerta de emergencia —
 * la que se usa el día que el llavero del teléfono se perdió, y por eso
 * tiene que funcionar SOLA, sin depender de que ya exista una sesión ni de
 * que exista el panel de la fase siguiente.
 *
 * Mismo mecanismo HMAC que la cookie de sesión (`sesion.ts`): un cuerpo en
 * base64url, una firma en base64url, unidos por un punto. La diferencia —y
 * la que importa— es el DOMINIO que viaja adentro de lo que se firma
 * (`mensajeFirmado`, `sesion.ts`): la cookie firma sobre `sesion|…`, esto
 * firma sobre `entrar|…`. Sin esa separación, el mismo secreto serviría
 * para firmar dos cosas indistinguibles entre sí, y un enlace interceptado
 * en una bandeja de entrada se podría pegar como cookie de sesión —sin
 * consumir el enlace, sin dejar rastro, y por todo lo que dure la sesión
 * (hasta un año), no los quince minutos que este archivo firma.
 *
 * Sin estado propio: no hay lista de enlaces emitidos ni de enlaces ya
 * usados. Todo lo que hace válido a un enlace vive DENTRO del propio token
 * (el correo, hasta cuándo vale) y se verifica con el secreto — igual que
 * la cookie. Eso es una elección, no un descuido: un almacén de enlaces
 * usados necesitaría un lugar compartido entre instancias que hoy no
 * existe (`intentoPermitido`, `sesion.ts`, tiene el mismo límite y lo dice
 * en su propio comentario), y el spec no pide un enlace de un solo uso —
 * pide que no se gaste SOLO, sin que ella lo toque (eso lo resuelve que se
 * consuma con POST, nunca con GET: ver `entrar.astro` y la acción
 * `entrar-con-enlace` en `acciones.ts`).
 *
 * Puro e inyectable (regla de `src/servidor/**`): el secreto y `ahora`
 * llegan por parámetro. Nada acá adentro lee `process.env` ni toma `fetch`
 * del global.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mensajeFirmado, LARGO_MIN_SECRETO } from './sesion'

/**
 * El dominio de este token, metido ADENTRO de lo que se firma (ver el
 * docstring de `mensajeFirmado` en `sesion.ts`). Nunca `'sesion'`: esa
 * distinción es la que hace que un token de acá no sirva de cookie, ni una
 * cookie sirva acá — B7 en `test/enlace.test.ts` lo prueba en las dos
 * direcciones.
 */
export const DOMINIO_ENLACE = 'entrar'

/** Cuánto vale un enlace mágico desde que se pide: quince minutos, spec §4.1. */
export const DURACION_ENLACE_MS = 15 * 60_000

interface CuerpoEnlace {
  correo: string
  vence: number
}

/** ¿Tiene la forma de un `CuerpoEnlace`? Ningún campo de más importa; los de menos, sí. */
function esCuerpoEnlace(v: unknown): v is CuerpoEnlace {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as CuerpoEnlace).correo === 'string' &&
    typeof (v as CuerpoEnlace).vence === 'number'
  )
}

/**
 * Firma un enlace: `<JSON en base64url>.<HMAC-SHA256 en base64url>`, con el
 * correo de quien lo pidió y hasta cuándo vale.
 *
 * Tira si `secreto` mide menos de `LARGO_MIN_SECRETO` — mismo candado que
 * `firmaSesion` (C-1, `sesion.ts`) y por la misma razón: un enlace firmado
 * con una clave corta o vacía no protege nada, así que emitirlo sería peor
 * que no emitir ninguno. Quien llama (`acciones.ts`) tiene que frenar ANTES
 * de esto; esta excepción es el candado que lo asegura si ese frenado
 * alguna vez se rompe.
 */
export function firmaEnlace(correo: string, vence: number, secreto: string): string {
  if (secreto.length < LARGO_MIN_SECRETO) {
    throw new Error(
      `firmaEnlace(): el secreto mide menos de ${LARGO_MIN_SECRETO} caracteres — una clave así de corta ` +
        'es, para HMAC, lo mismo que no tener firma.',
    )
  }
  const cuerpo = Buffer.from(JSON.stringify({ correo, vence } satisfies CuerpoEnlace)).toString('base64url')
  const firma = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_ENLACE, cuerpo)).digest('base64url')
  return `${cuerpo}.${firma}`
}

/**
 * Verifica un enlace y devuelve el correo si es válido, o `null` si no.
 * Mismo orden que `verificaSesion` y por la misma razón: primero la firma
 * (tiempo constante), DESPUÉS el vencimiento — si se mirara el vencimiento
 * antes, un cuerpo fabricado por quien no tiene el secreto decidiría cuándo
 * vence su propio token falso.
 */
export function verificaEnlace(token: string, secreto: string, ahora: number = Date.now()): { correo: string } | null {
  // Mismo candado que `verificaSesion` (C-1): un secreto corto o ausente no
  // es «el secreto real, nomás que débil» — para `createHmac` es
  // indistinguible de no tener firma.
  if (secreto.length < LARGO_MIN_SECRETO) return null
  try {
    const punto = token.indexOf('.')
    if (punto <= 0 || punto === token.length - 1) return null
    const cuerpo = token.slice(0, punto)
    const firma = token.slice(punto + 1)
    if (token.indexOf('.', punto + 1) !== -1) return null

    const firmaEsperada = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_ENLACE, cuerpo)).digest()
    const firmaRecibida = Buffer.from(firma, 'base64url')
    if (firmaRecibida.length !== firmaEsperada.length) return null
    if (!timingSafeEqual(firmaRecibida, firmaEsperada)) return null

    const datos: unknown = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    if (!esCuerpoEnlace(datos)) return null
    if (datos.vence <= ahora) return null

    return { correo: datos.correo }
  } catch {
    return null
  }
}
