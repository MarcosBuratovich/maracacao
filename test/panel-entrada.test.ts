/*
 * `src/servidor/entradas/panel.ts` es EL BORDE (regla de
 * `global-constraints.md`): el único archivo del panel que lee
 * `process.env` y toma `fetch` del global. Por eso la convención del repo
 * es no importarlo directo desde un test —ni `contacto.ts` tiene uno— y
 * probar en cambio la lógica pura que usa (`origen.ts`, `ip.ts`, y toda
 * `acciones.ts`).
 *
 * Este archivo es una excepción, y a propósito. Dos razones:
 *
 * - M-4 agrega un `console.warn` adentro del propio `handler`, ANTES de
 *   que se arme el `Contexto` (el chequeo de Origin corta antes de llamar
 *   a `entorno()`), así que se puede ejercitar sin mockear ninguna
 *   variable de entorno — solo `req`/`res` de mentira y un espía sobre
 *   `console.warn`.
 * - [M-9] Para probar QUÉ le arma el borde a `maneja()` —puntualmente,
 *   `bytesDelCuerpo`— no alcanza con mirar la respuesta HTTP: `maneja()`
 *   no le hace eco al contexto que recibió. Por eso este archivo mockea
 *   `../src/servidor/acciones` con `vi.mock` (en vitest, un mock de módulo
 *   es por ARCHIVO, no por test) y reemplaza `maneja` por un espía que
 *   guarda el `Contexto` de cada llamada. Los dos tests de M-4 de más
 *   abajo siguen valiendo con este cambio: el primero nunca llega a llamar
 *   a `maneja` (el 403 corta antes), y el segundo solo pide que el status
 *   no sea 403 y que no se haya avisado nada — ninguna de las dos cosas
 *   depende de qué conteste `maneja` de verdad.
 */
import { describe, it, expect, vi } from 'vitest'

const { contextosVistos, manejaEspia } = vi.hoisted(() => {
  const contextosVistos: unknown[] = []
  const manejaEspia = vi.fn(async (_accion: string, _pedido: unknown, contexto: unknown) => {
    contextosVistos.push(contexto)
    return { status: 404, cuerpo: { ok: false, problema: 'no existe' } }
  })
  return { contextosVistos, manejaEspia }
})

vi.mock('../src/servidor/acciones', () => ({ maneja: manejaEspia }))

import handler from '../src/servidor/entradas/panel'

function respuestaFalsa() {
  const vista: { status?: number; cuerpo?: unknown } = {}
  const res = {
    status(codigo: number) {
      vista.status = codigo
      return res
    },
    setHeader() {},
    json(cuerpo: unknown) {
      vista.cuerpo = cuerpo
    },
  }
  return { res, vista }
}

describe('M-4: el borde deja rastro cuando rechaza un Origin', () => {
  it('un POST con Origin no permitido contesta 403 Y avisa en el log con el origen rechazado', async () => {
    const avisos: unknown[][] = []
    const espia = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      avisos.push(args)
    })

    try {
      const { res, vista } = respuestaFalsa()
      await handler(
        {
          method: 'POST',
          headers: { origin: 'https://sitio-ajeno-cualquiera.com' },
          query: { accion: 'entrar' },
          body: {},
        },
        res,
      )

      expect(vista.status).toBe(403)
      // Antes de M-4 esto no dejaba ningún rastro: un 403 mudo no le
      // decía a Marcos si fue él mismo olvidándose de agregar un dominio
      // nuevo, o alguien probando el borde desde afuera.
      expect(avisos.some((args) => String(args[0]).includes('sitio-ajeno-cualquiera.com'))).toBe(true)
    } finally {
      espia.mockRestore()
    }
  })

  it('un GET (salud) no se frena por Origin, y no avisa nada', async () => {
    const espia = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { res, vista } = respuestaFalsa()
      await handler(
        { method: 'GET', headers: { origin: 'https://sitio-ajeno-cualquiera.com' }, query: { accion: 'salud' } },
        res,
      )
      // salud no cambia nada, así que el chequeo de Origin no aplica —
      // contesta lo que sea que conteste `maneja()` (mockeado más arriba),
      // nunca 403.
      expect(vista.status).not.toBe(403)
      expect(espia).not.toHaveBeenCalled()
    } finally {
      espia.mockRestore()
    }
  })
})

describe('M-9: el borde mide el cuerpo del pedido', () => {
  it('el borde mide el cuerpo por Content-Length, y 0 cuando no vino', async () => {
    const visto: number[] = []
    // `maneja()` está mockeado arriba: lo que este test mira es el
    // `Contexto` que el borde le arma, así que alcanza con una acción que
    // no existe para no tener que montar media sesión.
    for (const headers of [{ 'content-length': '4096' }, {}, { 'content-length': 'quién sabe' }]) {
      contextosVistos.length = 0
      const { res } = respuestaFalsa()
      await handler({ method: 'GET', headers, query: { accion: 'no-existe' } } as never, res as never)
      const contexto = contextosVistos[0] as { bytesDelCuerpo?: number } | undefined
      visto.push(contexto?.bytesDelCuerpo ?? -1)
    }
    expect(visto).toEqual([4096, 0, 0])
  })
})
