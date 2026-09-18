/*
 * `version.json` es la segunda de las dos fuentes que deciden si un cambio
 * «ya está en el sitio» (spec §4.5): la API de Vercel dice que el deploy
 * terminó, y esto dice qué commit está sirviendo el CDN AHORA. Sin la
 * segunda, el panel canta «listo» mientras el CDN sigue entregando lo
 * viejo — y ella abre el sitio, ve el precio de antes, y llama.
 *
 * El test lee `dist/`, no construye: construir desde un test es la bomba de
 * recursión que `test/meta.test.ts` prohíbe. Sin `dist/` avisa y se salta,
 * salvo en CI, donde faltarlo SÍ es un error.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..')
const ARCHIVO = resolve(RAIZ, 'dist/version.json')

describe('version.json', () => {
  const sinDist = !existsSync(ARCHIVO)
  const enCI = Boolean(process.env.CI || process.env.VERCEL)
  if (sinDist && !enCI) {
    console.warn('test/version-json.test.ts: no hay dist/ — corré `pnpm build:sitio` para que este test mida algo.')
  }

  it('el build lo escribe (en CI es obligatorio)', () => {
    if (sinDist && !enCI) return
    expect(existsSync(ARCHIVO)).toBe(true)
  })

  it('trae el sha del commit que construyó, o null cuando se construye fuera de la plataforma', () => {
    if (sinDist && !enCI) return
    const v = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as { sha: unknown; construido: unknown }
    // Cuarenta hexadecimales, o `null` — nunca `undefined`, nunca `''`: el
    // panel compara este valor contra el sha que publicó, y un `''` que se
    // compara distinto de todo es lo mismo que un `null`, pero sin decirlo.
    expect(v.sha === null || (typeof v.sha === 'string' && /^[0-9a-f]{40}$/.test(v.sha))).toBe(true)
    expect(typeof v.construido).toBe('string')
    expect(Number.isFinite(Date.parse(v.construido as string))).toBe(true)
  })

  it('la plataforma lo sirve sin caché: si se cachea, deja de significar algo', () => {
    // Un `version.json` cacheado te dice qué commit se servía CUANDO SE
    // CACHEÓ. Es exactamente la mentira que este archivo existe para no
    // contar, así que la cabecera no es un detalle de performance: es la
    // mitad del mecanismo.
    const vercel = JSON.parse(readFileSync(resolve(RAIZ, 'vercel.json'), 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    const regla = vercel.headers.find((h) => h.source === '/version.json')
    expect(regla, 'vercel.json no tiene una regla de cabeceras para /version.json').toBeDefined()
    expect(regla!.headers.find((h) => h.key === 'Cache-Control')?.value).toBe('no-store')
  })
})
