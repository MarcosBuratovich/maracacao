/*
 * La puerta del panel. No hay base de datos: la cookie ES la sesión, firmada
 * con HMAC, y la contraseña vive hasheada en una variable de entorno que
 * solo Vercel conoce (`PANEL_CLAVE_HASH`). En claro no existe en ningún
 * lado más que en el llavero del teléfono de la clienta — ni Marcos la
 * sabe.
 *
 * Puro e inyectable (regla de `src/servidor/**`): nada de `process.env` ni
 * `globalThis.fetch` acá adentro. El secreto (`PANEL_SECRETO`) y el reloj
 * (`ahora`) llegan por parámetro; el borde (`api/panel.ts`) es quien los
 * lee.
 */
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'

/** El cuerpo de la cookie: quién es, hasta cuándo vale, desde qué aparato, desde cuándo. */
export interface Sesion {
  correo: string
  vence: number
  dispositivo: string
  /**
   * Cuándo se firmó, en epoch ms. No es lo mismo que `vence` y no se puede
   * derivar de él: `vence` depende de si el aparato se marcó como propio (un
   * año) o no (treinta días), así que dos sesiones que vencen el mismo día
   * pueden haberse emitido con once meses de diferencia. Esto es lo que hace
   * posible «cerrar sesión en todos lados» sin rotar el secreto: se corre una
   * fecha (`PANEL_SESIONES_DESDE`) y todo lo firmado antes deja de valer.
   */
  emitida: number
}

// Parámetros de scrypt: N=16384 (2^14), r=8, p=5. Es la fila N=2^14 de la
// tabla de la OWASP Password Storage Cheat Sheet (cheatsheetseries.owasp.org
// /cheatsheets/Password_Storage_Cheat_Sheet.html), verificada contra el
// documento en vivo el 2026-09-16 — no de memoria: esa fila es exactamente
// «N=2^14, r=8, p=5».
//
// Medido en esta máquina (Node 22, `scryptSync`, no es una cifra citada de
// otro lado):
//   - Memoria: con estos tres parámetros, el mínimo `maxmem` con el que
//     `scryptSync` no tira es ~16.01 MiB — y es CASI IGUAL con p=1 que con
//     p=5 (16.004 MiB vs. 16.008 MiB): en la implementación de Node, la
//     memoria depende de N y r (fórmula ~128·N·r), no de p. Contra lo que
//     decía el comentario anterior (64 MiB): esa cifra es la de la fila
//     N=2^16, p=2 de la misma tabla, no la de esta fila.
//   - Tiempo: un `hashDeClave` con p=1 tardó ~24 ms de promedio (5
//     corridas); con p=5, ~112 ms — unas 4.6 veces más lento. p es el
//     parámetro de paralelismo: no cambia cuánta memoria hace falta a la
//     vez, pero sí cuántas pasadas hace el algoritmo, así que el costo de
//     fuerza bruta offline contra un hash filtrado sube en la misma
//     proporción. Una vez por login, 112 ms no se siente; para quien
//     prueba millones de contraseñas offline, sí.
//
// Quedan grabados EN el hash guardado (no son una constante que se pueda
// perder) para que si algún día suben, los hashes viejos se sigan leyendo
// con sus propios parámetros — `claveCorrecta` deriva con los que lee del
// string, no con estas constantes.
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 5
const LARGO_SAL = 16
const LARGO_HASH = 64

// `maxmem` explícito en las dos llamadas a `scryptSync` de este archivo,
// bastante por encima de los ~16 MiB que estos parámetros piden hoy. Sin
// esto, Node usa su default (32 MiB) sin que el código lo diga en ningún
// lado — y el día que alguien suba `N` sin acordarse de este comentario,
// `scryptSync` empieza a pedir más memoria de la que el default cubre.
// En `hashDeClave` eso tira una excepción bien visible (no hay try/catch
// acá). En `claveCorrecta`, en cambio, SÍ hay un try/catch que existe para
// convertir un hash con formato raro en «contraseña incorrecta» — y ese
// mismo try/catch atraparía también un error de configuración,
// devolviendo el mismo `false`. Con el default sin nombrar, ese día
// alguien ve un lockout inexplicable y no un error de config. Fijarlo acá,
// generoso, no lo evita del todo (una suba grande de `N` igual pediría
// tocar esta constante) pero saca el número de la oscuridad del default y
// da margen a que un ajuste chico no rompa nada.
const MAXMEM = 64 * 1024 * 1024

/**
 * [C-1, revisión final] El largo mínimo que `PANEL_SECRETO` tiene que medir
 * para que firmar o verificar una cookie tenga sentido. `createHmac` no
 * exige ningún largo de clave — ni siquiera rechaza la cadena vacía— así
 * que, para HMAC, una clave corta o ausente NO es «la clave real, nomás
 * que débil»: es indistinguible de no tener firma en absoluto. Antes de
 * este chequeo, `acciones.ts` llamaba a `firmaSesion`/`verificaSesion` con
 * `contexto.env.PANEL_SECRETO ?? ''` cuando la variable faltaba en
 * producción, y `createHmac('sha256', '')` firma y verifica igual de
 * contento con la clave vacía — que cualquiera puede reproducir sin saber
 * ningún secreto. Setenta y dos horas después de un deploy sin la
 * variable, es la puerta de entrada la que queda firmando con una clave
 * que el mundo entero conoce. 32 no blinda contra un secreto elegido a
 * mano y débil —eso lo tiene que generar algo aleatorio, no este
 * candado— pero SÍ descarta con certeza los dos casos que de verdad
 * importan: la variable ausente (`undefined`, largo 0) y una clave
 * puesta a mano corta «para probar» y olvidada así en producción.
 */
export const LARGO_MIN_SECRETO = 32

/**
 * Hashea una contraseña con scrypt y una sal nueva (o la que se pase, para
 * tests). Formato guardado: `scrypt$N$r$p$<sal b64>$<hash b64>` — los
 * parámetros viajan adentro del string para que subirlos el día de mañana
 * no invalide lo que ya está guardado en `PANEL_CLAVE_HASH`.
 */
export function hashDeClave(clave: string, sal: Buffer = randomBytes(LARGO_SAL)): string {
  const hash = scryptSync(clave, sal, LARGO_HASH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${sal.toString('base64')}$${hash.toString('base64')}`
}

/**
 * ¿La contraseña en claro corresponde al hash guardado? Parsea el formato,
 * deriva con ESOS parámetros (no los de arriba: los del propio hash, para
 * seguir leyendo hashes viejos si algún día suben) y compara en tiempo
 * constante.
 *
 * Todo dentro de un try/catch que devuelve `false`: un valor pegado a mano
 * en la variable de entorno con otra forma no puede tirar la función — solo
 * puede ser «contraseña incorrecta». `timingSafeEqual` además tira si los
 * dos buffers no miden lo mismo, así que un candidato de otro largo tiene
 * que caer en el mismo `false`, nunca en una excepción sin atrapar.
 */
export function claveCorrecta(clave: string, guardado: string): boolean {
  try {
    const partes = guardado.split('$')
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false
    const [, nStr, rStr, pStr, salB64, hashB64] = partes
    const N = Number(nStr)
    const r = Number(rStr)
    const p = Number(pStr)
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
    const sal = Buffer.from(salB64, 'base64')
    const hashGuardado = Buffer.from(hashB64, 'base64')
    if (sal.length === 0 || hashGuardado.length === 0) return false

    const candidato = scryptSync(clave, sal, hashGuardado.length, { N, r, p, maxmem: MAXMEM })
    if (candidato.length !== hashGuardado.length) return false
    return timingSafeEqual(candidato, hashGuardado)
  } catch {
    return false
  }
}

/**
 * El propósito de un token firmado con `PANEL_SECRETO`, metido ADENTRO de lo
 * que se firma. El mismo secreto va a firmar dos cosas distintas —la cookie
 * de sesión y el enlace mágico de recuperación (spec §4.1)— y sin esto, un
 * token de uno sirve de token del otro: quien tenga un enlace mágico
 * interceptado en su bandeja de entrada lo pega como cookie y ya está
 * adentro, sin que el enlace se «consuma» nunca.
 *
 * Va como prefijo del mensaje y no como campo del JSON a propósito: un campo
 * del JSON también funcionaría, pero solo si TODOS los verificadores se
 * acuerdan de mirarlo. Como prefijo, olvidarse no es una opción — la firma
 * directamente no da.
 */
export const DOMINIO_SESION = 'sesion'

/** Lo que se le pasa al HMAC: el propósito, una barra, y el cuerpo. */
export const mensajeFirmado = (dominio: string, cuerpo: string): string => `${dominio}|${cuerpo}`

/**
 * Firma una sesión: `<JSON en base64url>.<HMAC-SHA256 en base64url>`.
 *
 * [C-1] Tira si `secreto` mide menos de `LARGO_MIN_SECRETO`: una firma hecha
 * con una clave corta o vacía no protege nada, así que emitirla sería peor
 * que no emitir cookie ninguna — quien llama (`acciones.ts`) tiene que
 * frenar ANTES de esto, y esta excepción es el candado que lo asegura
 * incluso si algún día ese frenado se rompe.
 */
export function firmaSesion(sesion: Sesion, secreto: string): string {
  if (secreto.length < LARGO_MIN_SECRETO) {
    throw new Error(
      `firmaSesion(): PANEL_SECRETO mide menos de ${LARGO_MIN_SECRETO} caracteres — una clave así de corta ` +
        'es, para HMAC, lo mismo que no tener firma.',
    )
  }
  const cuerpo = Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const firma = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_SESION, cuerpo)).digest('base64url')
  return `${cuerpo}.${firma}`
}

/**
 * Verifica una cookie de sesión y devuelve el cuerpo si es válida, o `null`
 * si no. El orden importa: primero la firma (con `timingSafeEqual`, tiempo
 * constante), DESPUÉS el vencimiento. Si se chequeara el vencimiento antes,
 * un cuerpo fabricado por un atacante sin el secreto decidiría cuándo
 * vence su propia cookie falsa — el chequeo tendría sentido pero sobre un
 * dato en el que no se puede confiar todavía.
 */
export function verificaSesion(cookie: string, secreto: string, ahora: number = Date.now()): Sesion | null {
  // [C-1] Misma razón que en `firmaSesion`, del lado de verificar: un
  // secreto corto o ausente (`''`) NO es «la clave real, nomás que
  // débil» — para `createHmac` es indistinguible de no tener firma. Sin
  // este chequeo, `PANEL_SECRETO` ausente en producción hacía que
  // `contexto.env.PANEL_SECRETO ?? ''` verificara con la cadena vacía, que
  // cualquiera puede reproducir sin saber ningún secreto: la puerta
  // firmaba y aceptaba cookies fabricadas por quien sea. Acá se devuelve
  // `null` (no se tira) porque `verificaSesion` siempre devuelve `null`
  // ante cualquier cookie que no puede confiar, y un secreto inservible es
  // exactamente eso.
  if (secreto.length < LARGO_MIN_SECRETO) return null
  try {
    const punto = cookie.indexOf('.')
    if (punto <= 0 || punto === cookie.length - 1) return null
    const cuerpo = cookie.slice(0, punto)
    const firma = cookie.slice(punto + 1)
    if (cookie.indexOf('.', punto + 1) !== -1) return null

    const firmaEsperada = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_SESION, cuerpo)).digest()
    const firmaRecibida = Buffer.from(firma, 'base64url')
    if (firmaRecibida.length !== firmaEsperada.length) return null
    if (!timingSafeEqual(firmaRecibida, firmaEsperada)) return null

    const sesion = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Sesion
    if (
      typeof sesion.correo !== 'string' ||
      typeof sesion.vence !== 'number' ||
      typeof sesion.dispositivo !== 'string' ||
      typeof sesion.emitida !== 'number'
    ) {
      return null
    }
    if (sesion.vence <= ahora) return null

    return sesion
  } catch {
    return null
  }
}

/**
 * Arma el `Set-Cookie` con las banderas que la protegen: `HttpOnly` (no la
 * toca JavaScript del navegador, así que un XSS no puede leerla),
 * `Secure` (solo viaja por HTTPS), `SameSite=Lax` (no viaja en pedidos de
 * otro sitio) y `Path=/` (vale para todo el panel).
 */
export function cookieDeSesion(valor: string, dias: number): string {
  const maxAge = Math.round(dias * 86_400)
  return `panel_sesion=${valor}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

// Freno a la fuerza bruta: marcas de tiempo de los últimos quince minutos
// por CLAVE, en memoria del proceso.
//
// [Ronda 1, Tarea 12, hallazgo E] La clave ya no es solo la IP. Antes,
// `entrar` y `salud` (y ahora `enlace`/`entrar-con-enlace`) compartían un
// único contador por IP — y eso se volvía en contra el día que más
// importaba: la clienta que pide el enlace cinco veces porque no le llega
// se quedaba, de paso, sin poder usar su contraseña por quince minutos.
// Cada llamador arma su propia clave (`<acción>:<ip>` en `acciones.ts`) para
// que el presupuesto de una acción no le coma el de otra. La misma función
// también frena por DESTINATARIO (hallazgo F: `enlace-destino:<correo>`,
// con su propio tope, más chico) — el mecanismo no sabe ni le importa qué
// representa la clave, solo cuenta cuántas veces se la vio en la ventana.
//
// [E4] Esto NO es la defensa principal, y hay que decirlo cada vez que
// alguien lo lea: las funciones serverless son efímeras y concurrentes —
// cada instancia tiene su propio `Map`, así que un atacante que dispare
// pedidos contra varias instancias a la vez (o espere a que Vercel recicle
// una) se lo saltea sin esfuerzo. Frena el intento casual y el script
// tonto, nada más. La defensa real es una contraseña larga (E2). Si algún
// día hace falta un freno de verdad, se hace con un almacén externo
// compartido entre instancias — hoy no existe.
const INTENTOS = new Map<string, number[]>()
const VENTANA_MS = 15 * 60_000
const TOPE_INTENTOS = 5

/**
 * [Revisión final de la rama] A partir de cuántas claves vivas se barren las
 * vencidas.
 *
 * El `Map` filtraba las marcas viejas de la clave que se estaba consultando,
 * pero NUNCA borraba una clave: cada dirección distinta que alguien mande a
 * `enlace` deja una (`enlace-destino:<correo>`), y eso es entrada controlada
 * por quien ataca — un bucle con direcciones inventadas hace crecer este
 * `Map` sin techo mientras la instancia viva. Con el barrido, lo que queda
 * vivo está acotado por las claves VISTAS EN LA VENTANA, no por todas las
 * vistas desde que arrancó el proceso.
 *
 * El umbral existe para que el camino normal siga siendo O(1): con menos
 * claves que esto, barrer no vale la pena (el `Map` cabe de sobra en
 * memoria); recién cuando alguien lo está inflando a propósito se paga el
 * recorrido, y se paga una vez cada tanto, no en cada pedido.
 */
const CLAVES_ANTES_DE_BARRER = 1_000

/** Saca del `Map` las claves cuyas marcas están todas fuera de la ventana. */
function barreVencidas(ahora: number): void {
  for (const [clave, marcas] of INTENTOS) {
    if (marcas.every((t) => ahora - t >= VENTANA_MS)) INTENTOS.delete(clave)
  }
}

/** Cuántas claves tiene vivas el freno ahora mismo. Solo para tests: no la usa ninguna acción. */
export const clavesDeFreno = (): number => INTENTOS.size

/**
 * ¿Esta clave puede intentar de nuevo? Cuenta los intentos de los últimos
 * quince minutos y, si ya hubo `tope` (cinco por defecto), frena — este
 * llamado en sí también cuenta como intento cuando se permite, así que
 * "cinco intentos permitidos, el sexto frena" es exacto. `tope` es
 * configurable para el freno por destinatario (hallazgo F), que protege
 * otra cosa (su bandeja, no nuestra cuota de intentos) con otro número.
 */
export function intentoPermitido(clave: string, ahora: number = Date.now(), tope: number = TOPE_INTENTOS): boolean {
  if (INTENTOS.size > CLAVES_ANTES_DE_BARRER) barreVencidas(ahora)

  const marcas = (INTENTOS.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS)

  if (marcas.length >= tope) {
    INTENTOS.set(clave, marcas)
    return false
  }

  marcas.push(ahora)
  INTENTOS.set(clave, marcas)
  return true
}
