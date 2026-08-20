/* Función serverless de Vercel: el formulario de contacto envía correo
 * de verdad (el mailto queda como fallback sin JS o sin configurar).
 *
 * Envío por Resend (https://resend.com). Variables de entorno en Vercel:
 *   RESEND_API_KEY        — obligatoria para enviar
 *   CONTACTO_DESTINO      — a quién llega (default maracacaomx@gmail.com)
 *   CONTACTO_REMITENTE    — from verificado en Resend,
 *                           p. ej. "Maracacao <contacto@maracacao.mx>"
 *   TURNSTILE_SECRET      — opcional: activa la verificación Turnstile
 *
 * Protección anti-bots, en capas:
 *   1. Honeypot: el campo «apellido» está oculto para humanos; si viene
 *      con contenido, es un bot → 200 silencioso (no le enseñamos nada).
 *   2. Trampa de tiempo: el form marca cuándo se abrió; enviar en menos
 *      de 4 segundos no es humano.
 *   3. Origen: solo aceptamos POST desde nuestros propios dominios.
 *   4. Turnstile (si está configurado): verificación server-side del
 *      token de Cloudflare.
 */

interface Pedido {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Respuesta {
  status(codigo: number): Respuesta
  json(cuerpo: unknown): void
  setHeader(nombre: string, valor: string): void
}

const ORIGENES_PERMITIDOS = [
  'https://maracacao.mx',
  'https://www.maracacao.mx',
  'http://localhost:4321',
  'http://localhost:4322',
]

const esTexto = (v: unknown): v is string => typeof v === 'string'

export default async function handler(req: Pedido, res: Respuesta) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Solo POST' })
  }

  const clave = process.env.RESEND_API_KEY
  if (!clave) {
    // Sin configurar: el cliente cae al mailto. No es un error del visitante.
    return res.status(503).json({ error: 'Envío no configurado' })
  }

  const origen = String(req.headers.origin ?? '')
  const origenValido =
    ORIGENES_PERMITIDOS.includes(origen) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origen)
  if (!origenValido) return res.status(403).json({ error: 'Origen no permitido' })

  const b = (req.body ?? {}) as Record<string, unknown>
  const nombre = esTexto(b.nombre) ? b.nombre.trim().slice(0, 120) : ''
  const correo = esTexto(b.correo) ? b.correo.trim().slice(0, 200) : ''
  const tipo = b.tipo === 'negocio' ? 'negocio' : 'personal'
  const mensaje = esTexto(b.mensaje) ? b.mensaje.trim().slice(0, 4000) : ''

  // Capa 1 — honeypot: para un bot, éxito; para nosotros, ruido menos.
  if (esTexto(b.apellido) && b.apellido.length > 0) {
    return res.status(200).json({ ok: true })
  }

  // Capa 2 — trampa de tiempo.
  const inicio = Number(b.inicio)
  if (!Number.isFinite(inicio) || Date.now() - inicio < 4000) {
    return res.status(200).json({ ok: true })
  }

  if (!nombre || !mensaje || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'Faltan datos o el correo no es válido' })
  }

  // Capa 4 — Turnstile, si está configurado.
  const secretoTurnstile = process.env.TURNSTILE_SECRET
  if (secretoTurnstile) {
    const token = esTexto(b.turnstile) ? b.turnstile : ''
    const verificacion = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretoTurnstile, response: token }),
    }).then((r) => r.json() as Promise<{ success: boolean }>)
    if (!verificacion.success) {
      return res.status(403).json({ error: 'Verificación anti-bots fallida' })
    }
  }

  const destino = process.env.CONTACTO_DESTINO ?? 'maracacaomx@gmail.com'
  const remitente = process.env.CONTACTO_REMITENTE ?? 'Maracacao <onboarding@resend.dev>'
  const asunto = `Mensaje del sitio — ${tipo === 'negocio' ? 'negocio' : 'compra personal'} — ${nombre}`

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remitente,
      to: [destino],
      reply_to: correo,
      subject: asunto,
      text: [
        `Nombre: ${nombre}`,
        `Correo: ${correo}`,
        `Tipo: ${tipo === 'negocio' ? 'Para su negocio (cafetería, panadería, repostería)' : 'Compra personal'}`,
        '',
        mensaje,
        '',
        '—',
        'Enviado desde el formulario de maracacao.mx',
      ].join('\n'),
    }),
  })

  if (!envio.ok) {
    return res.status(502).json({ error: 'El servicio de correo no aceptó el envío' })
  }
  return res.status(200).json({ ok: true })
}
