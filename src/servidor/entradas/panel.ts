/* Fuente de la función serverless del panel.
 *
 * Vive acá, en `src/servidor/entradas/`, y NO directo en `api/`, por la
 * misma razón que `contacto.ts` (ver ese archivo y `docs/panel-operacion.md`):
 * [MEDIDO 2026-09-16, en producción] una función de Vercel que importa algo
 * de afuera de `api/` CONSTRUYE y después muere al invocarla
 * (FUNCTION_INVOCATION_FAILED). `scripts/bundle-api.ts` (esbuild) la
 * empaqueta en `api/panel.js`, autocontenida, que es lo que Vercel
 * despliega de verdad. Tocás este archivo, corrés `pnpm bundle:api`, y
 * commiteás los dos: el test de `test/bundle-api.test.ts` no deja que se
 * separen.
 *
 * Es EL BORDE (regla de `global-constraints.md`): el único archivo de todo
 * el panel que lee `process.env` y toma `fetch` del global. Todo lo
 * demás —la sesión, la validación, GitHub, el router mismo
 * (`../acciones.ts`)— lo recibe por parámetro, incluido el reloj. Si este
 * archivo tiene un `if` de negocio (qué contraseña es correcta, qué
 * documento se puede publicar), está en el archivo equivocado: acá
 * adentro solo se arma el contexto, se llama a `maneja()` y se traduce lo
 * que devuelve a una respuesta HTTP.
 *
 * Un solo endpoint para las tres acciones de esta parte (E8): la acción
 * viaja en la query string —`GET /api/panel?accion=salud`,
 * `POST /api/panel?accion=entrar`, `POST /api/panel?accion=publicar`—, no
 * en la ruta, así que alcanza con una sola función.
 */
import { maneja, type Pedido, type Contexto, type Entorno } from '../acciones'
import { origenPermitido } from '../origen'
import { ipDelPedido } from '../ip'

interface PedidoHTTP {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}
interface RespuestaHTTP {
  status(codigo: number): RespuestaHTTP
  setHeader(nombre: string, valor: string): void
  json(cuerpo: unknown): void
}

const valorUnico = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

/** El valor de `panel_sesion` adentro del header `Cookie`, o `''` si no vino. */
function cookieDePanel(header: string | string[] | undefined): string {
  const cadena = Array.isArray(header) ? header.join('; ') : (header ?? '')
  for (const parte of cadena.split(';')) {
    const trozo = parte.trim()
    const igual = trozo.indexOf('=')
    if (igual === -1) continue
    if (trozo.slice(0, igual) !== 'panel_sesion') continue
    try {
      return decodeURIComponent(trozo.slice(igual + 1))
    } catch {
      return ''
    }
  }
  return ''
}

/**
 * Dueño y repo salen de las variables que Vercel YA inyecta en todo
 * deploy (`VERCEL_GIT_REPO_OWNER`/`VERCEL_GIT_REPO_SLUG`): no hace falta
 * que Marcos cargue una variable nueva para algo que la plataforma ya
 * sabe. El segundo default (`MarcosBuratovich`/`maracacao`) es para correr
 * local, donde esas dos variables de Vercel no existen.
 */
function entorno(): Entorno {
  return {
    PANEL_CLAVE_HASH: process.env.PANEL_CLAVE_HASH,
    PANEL_SECRETO: process.env.PANEL_SECRETO,
    PANEL_CORREOS: process.env.PANEL_CORREOS,
    PANEL_GITHUB_TOKEN: process.env.PANEL_GITHUB_TOKEN,
    GITHUB_DUENIO: process.env.GITHUB_DUENIO ?? process.env.VERCEL_GIT_REPO_OWNER ?? 'MarcosBuratovich',
    GITHUB_REPO: process.env.GITHUB_REPO ?? process.env.VERCEL_GIT_REPO_SLUG ?? 'maracacao',
  }
}

export default async function handler(req: PedidoHTTP, res: RespuestaHTTP) {
  const accion = valorUnico(req.query?.accion)

  // Defensa en profundidad para lo que cambia algo (la misma que ya usa
  // `contacto.ts`, compartida en `../origen`): `SameSite=Lax` en la cookie
  // ya frena la mayoría de los pedidos cruzados, esto frena el resto.
  // `salud` es GET y no cambia nada, así que no lo necesita.
  if (req.method === 'POST' && !origenPermitido(String(req.headers.origin ?? ''))) {
    // [M-4] Antes esto no dejaba rastro: un 403 mudo no le dice a Marcos
    // si fue él mismo olvidándose de agregar un dominio nuevo, o alguien
    // probando el borde desde afuera. Con el origen rechazado en el log,
    // al menos puede distinguir las dos cosas.
    console.warn(`panel: origen rechazado — ${req.headers.origin ?? '(sin Origin)'}`)
    return res.status(403).json({ ok: false, problema: 'No se pudo procesar tu pedido.' })
  }

  const pedido: Pedido = { cuerpo: req.body, cookie: cookieDePanel(req.headers.cookie) }
  const contexto: Contexto = {
    env: entorno(),
    fetch: globalThis.fetch,
    ahora: () => Date.now(),
    ip: ipDelPedido(req.headers),
  }

  const r = await maneja(accion, pedido, contexto)
  if (r.cookie) res.setHeader('Set-Cookie', r.cookie)
  return res.status(r.status).json(r.cuerpo)
}
