/*
 * El artefacto `api/contacto.js` se commitea, así que puede quedar viejo: la
 * fuente cambia, nadie corre el bundle, y Vercel despliega la versión anterior
 * sin que nada se queje. Este test lo impide: reconstruye en memoria y compara.
 *
 * Si se pone rojo, corré `pnpm bundle:api` y commiteá el resultado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { build } from 'esbuild'

const FUENTE = 'src/servidor/entradas/contacto.ts'
const ARTEFACTO = 'api/contacto.js'

describe('el paquete de la función de contacto', () => {
  it('existe y no tiene imports de afuera: es autocontenido', () => {
    expect(existsSync(ARTEFACTO)).toBe(true)
    const js = readFileSync(ARTEFACTO, 'utf8')
    // Lo único que puede quedar afuera es el runtime de Node.
    const imports = [...js.matchAll(/^import .* from ['"](.+)['"]/gm)].map((m) => m[1])
    for (const ruta of imports) expect(ruta.startsWith('node:')).toBe(true)
  })

  it('está al día con su fuente', async () => {
    const { outputFiles } = await build({
      entryPoints: [FUENTE],
      bundle: true, platform: 'node', target: 'node22', format: 'esm',
      packages: 'bundle', external: ['node:*'], write: false,
      banner: { js: '/* GENERADO por scripts/bundle-api.ts — no editar a mano. */' },
      logLevel: 'silent',
    })
    expect(outputFiles[0].text).toBe(readFileSync(ARTEFACTO, 'utf8'))
  })
})
