/*
 * Los artefactos de `api/` se commitean, así que pueden quedar viejos: la
 * fuente cambia, nadie corre el bundle, y Vercel despliega la versión anterior
 * sin que nada se queje. Este test lo impide: reconstruye cada uno en memoria
 * y compara.
 *
 * Si se pone rojo, corré `pnpm bundle:api` y commiteá el resultado.
 *
 * Las opciones de esbuild (`OPCIONES`) y la lista de funciones (`FUNCIONES`)
 * se importan de `scripts/bundle-api.ts` en vez de repetirse acá: antes este
 * archivo tenía su propia copia del objeto de opciones, y las dos coincidían
 * de casualidad. Con una sola fuente, ya no hay una segunda que se pueda
 * desincronizar en silencio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { build } from 'esbuild'
import { OPCIONES, FUNCIONES } from '../scripts/bundle-api'

describe.each(FUNCIONES)('el paquete de $salida', ({ entrada, salida }) => {
  it('existe y no tiene imports de afuera: es autocontenido', () => {
    expect(existsSync(salida)).toBe(true)
    const js = readFileSync(salida, 'utf8')
    // Lo único que puede quedar afuera es el runtime de Node.
    const imports = [...js.matchAll(/^import .* from ['"](.+)['"]/gm)].map((m) => m[1])
    for (const ruta of imports) expect(ruta.startsWith('node:')).toBe(true)
  })

  it('está al día con su fuente', async () => {
    const { outputFiles } = await build({
      entryPoints: [entrada],
      write: false,
      ...OPCIONES,
    })
    expect(outputFiles[0].text).toBe(readFileSync(salida, 'utf8'))
  })
})
