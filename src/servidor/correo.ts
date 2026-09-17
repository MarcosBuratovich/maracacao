/*
 * El aviso por correo.
 *
 * Existe por una razón concreta del spec (§4.5): «ella va a guardar el
 * teléfono y atender tres clientes — nadie mira un reloj tres minutos parada
 * en un mercado». Sin el correo, publicar la obliga a quedarse mirando la
 * pantalla; con él, publica y sigue trabajando.
 *
 * [B3] ESTE MÓDULO NUNCA TIRA. Todo lo que lo llama está en medio de algo que
 * importa más que el aviso —publicando, revirtiendo un deploy roto—, así que
 * una excepción acá abortaría lo importante por culpa de lo accesorio. Todas
 * las formas de fallar (sin configurar, rechazado, sin red) vuelven como un
 * `{ ok: false, motivo }` que quien llama loguea y sigue.
 *
 * Y por eso mismo la falta de configuración es un resultado, no un error:
 * verificar el dominio en el proveedor es SPF+DKIM en el DNS, un trámite con
 * días de propagación (spec §4.1). Mientras no esté, el panel publica igual.
 *
 * Puro e inyectable (regla de `src/servidor/**`): la clave, el remitente y el
 * `fetch` llegan por parámetro. Nada acá lee `process.env`.
 */

export interface Carta {
  a: string[]
  asunto: string
  /** Texto plano. El panel no manda HTML: nada de lo que avisa lo necesita. */
  texto: string
}

export interface CredencialesCorreo {
  clave?: string
  /** `Nombre <dirección>` verificado en el proveedor. */
  remitente?: string
  fetch: typeof globalThis.fetch
}

export type ResultadoCorreo =
  | { ok: true }
  | { ok: false; motivo: 'sin-configurar' | 'rechazado' | 'sin-destino' }

export async function manda(c: CredencialesCorreo, carta: Carta): Promise<ResultadoCorreo> {
  if (!c.clave || !c.remitente) return { ok: false, motivo: 'sin-configurar' }
  if (carta.a.length === 0) return { ok: false, motivo: 'sin-destino' }

  try {
    const respuesta = await c.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: c.remitente, to: carta.a, subject: carta.asunto, text: carta.texto }),
    })
    return respuesta.ok ? { ok: true } : { ok: false, motivo: 'rechazado' }
  } catch {
    // La red se cayó, o el proveedor no contestó. Mismo tratamiento: quien
    // llama sigue su camino. El detalle no se loguea acá —este módulo no sabe
    // en qué contexto lo llamaron— sino en el llamador, que sí lo sabe.
    return { ok: false, motivo: 'rechazado' }
  }
}
