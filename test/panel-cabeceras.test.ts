/*
 * Las cabeceras de `/panel/:camino*` (Tarea 12, spec §4.1) no son
 * decoración: son parte del mecanismo del enlace mágico, igual que las de
 * `/version.json` (Tarea 4, `test/version-json.test.ts`, mismo patrón).
 *
 * - `Referrer-Policy: no-referrer` es lo que impide que el token se filtre
 *   en la cabecera `Referer` de la primera navegación que salga de
 *   `/panel/entrar` (un enlace externo, una imagen de otro dominio).
 * - `Cache-Control: no-store` es lo que impide que una respuesta con el
 *   token adentro de la URL quede guardada en un caché compartido.
 * - `X-Robots-Tag: noindex, nofollow` la saca de buscadores — nunca tiene
 *   que aparecer indexada, con o sin token.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..')

describe('cabeceras de /panel/:camino*', () => {
  const vercel = JSON.parse(readFileSync(resolve(RAIZ, 'vercel.json'), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  }
  const regla = vercel.headers.find((h) => h.source === '/panel/:camino*')

  it('existe la regla', () => {
    expect(regla, 'vercel.json no tiene una regla de cabeceras para /panel/:camino*').toBeDefined()
  })

  it('no se referencia el token en la navegación que sale de la página', () => {
    expect(regla!.headers.find((h) => h.key === 'Referrer-Policy')?.value).toBe('no-referrer')
  })

  it('nunca queda en un caché compartido', () => {
    expect(regla!.headers.find((h) => h.key === 'Cache-Control')?.value).toBe('no-store')
  })

  it('nunca se indexa', () => {
    expect(regla!.headers.find((h) => h.key === 'X-Robots-Tag')?.value).toBe('noindex, nofollow')
  })
})
