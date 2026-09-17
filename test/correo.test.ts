/*
 * El aviso por correo. Puro e inyectable: la clave, el remitente y el `fetch`
 * llegan por parámetro, así que esto se prueba sin red y sin ninguna clave
 * real.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { manda } from '../src/servidor/correo'

describe('mandar un aviso', () => {
  it('manda el correo con el remitente configurado', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { id: 'abc' } }])
    const r = await manda(
      { clave: 'k', remitente: 'Panel Maracacao <panel@maracacao.mx>', fetch: f },
      { a: ['ella@ejemplo.mx'], asunto: 'Tu cambio ya está en el sitio', texto: 'Listo.' },
    )
    expect(r).toEqual({ ok: true })
    expect(pedidos[0].url).toBe('https://api.resend.com/emails')
    expect(pedidos[0].cuerpo).toEqual({
      from: 'Panel Maracacao <panel@maracacao.mx>',
      to: ['ella@ejemplo.mx'],
      subject: 'Tu cambio ya está en el sitio',
      text: 'Listo.',
    })
  })

  it('B3: sin clave o sin remitente NO tira: dice que no está configurado y no toca la red', async () => {
    // Verificar el dominio en el proveedor es un trámite de DNS con días de
    // propagación (spec §4.1). Mientras no esté, publicar tiene que seguir
    // funcionando: lo que se pierde es el aviso, no la publicación.
    const { f, pedidos } = fetchFalso([])
    const carta = { a: ['ella@ejemplo.mx'], asunto: 'x', texto: 'y' }

    expect(await manda({ remitente: 'r', fetch: f }, carta)).toEqual({ ok: false, motivo: 'sin-configurar' })
    expect(await manda({ clave: 'k', fetch: f }, carta)).toEqual({ ok: false, motivo: 'sin-configurar' })
    expect(pedidos).toHaveLength(0)
  })

  it('sin ningún destinatario tampoco toca la red', async () => {
    const { f, pedidos } = fetchFalso([])
    expect(await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: [], asunto: 'x', texto: 'y' })).toEqual({
      ok: false,
      motivo: 'sin-destino',
    })
    expect(pedidos).toHaveLength(0)
  })

  it('si el proveedor rechaza, devuelve `rechazado` — nunca tira hacia afuera', async () => {
    // Quien llama a esto está en medio de publicar o de revertir. Una
    // excepción acá abortaría algo importante por culpa de algo que no lo es.
    const { f } = fetchFalso([{ status: 422, cuerpo: { message: 'domain not verified' } }])
    expect(
      await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: ['x@y.mx'], asunto: 'x', texto: 'y' }),
    ).toEqual({ ok: false, motivo: 'rechazado' })
  })

  it('si la red se cae, tampoco tira', async () => {
    const f = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof globalThis.fetch
    expect(
      await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: ['x@y.mx'], asunto: 'x', texto: 'y' }),
    ).toEqual({ ok: false, motivo: 'rechazado' })
  })
})
