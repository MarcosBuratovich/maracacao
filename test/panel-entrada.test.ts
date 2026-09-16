/*
 * `src/servidor/entradas/panel.ts` es EL BORDE (regla de
 * `global-constraints.md`): el único archivo del panel que lee
 * `process.env` y toma `fetch` del global. Por eso la convención del repo
 * es no importarlo directo desde un test —ni `contacto.ts` tiene uno— y
 * probar en cambio la lógica pura que usa (`origen.ts`, `ip.ts`, y toda
 * `acciones.ts`).
 *
 * Este archivo es la única excepción, y a propósito: M-4 agrega un
 * `console.warn` adentro del propio `handler`, ANTES de que se arme el
 * `Contexto` (el chequeo de Origin corta antes de llamar a `entorno()`),
 * así que se puede ejercitar sin mockear ninguna variable de entorno —
 * solo `req`/`res` de mentira y un espía sobre `console.warn`.
 */
import { describe, it, expect, vi } from 'vitest'
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
      // contesta lo que sea que conteste `maneja()` (503, sin variables en
      // este entorno de test), nunca 403.
      expect(vista.status).not.toBe(403)
      expect(espia).not.toHaveBeenCalled()
    } finally {
      espia.mockRestore()
    }
  })
})
