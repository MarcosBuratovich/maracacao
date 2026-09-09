/*
 * Guards del propio andamiaje de tests.
 *
 * Existen por la compuerta de publicación (2026-09-08): `build` corre los
 * tests, así que un test que construya el sitio hace que el build se
 * llame a sí mismo y deja todos los deploys rojos. La trampa ya estuvo
 * puesta una vez (css-tokens.test.ts hacía execSync); esto impide que
 * vuelva.
 *
 * Este archivo se excluye a sí mismo del barrido: nombra la regla que
 * vigila, así que se encontraría solo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

describe('el andamiaje de tests', () => {
  it('ningún test construye el sitio: construir desde adentro es recursión', () => {
    const culpables: string[] = []
    const archivos = readdirSync('test')
      .filter((a) => a.endsWith('.test.ts') && a !== 'meta.test.ts')

    for (const archivo of archivos) {
      const fuente = readFileSync(`test/${archivo}`, 'utf8')
      // Los comentarios quedan fuera: el que explica la regla la nombra.
      const codigo = fuente
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // `build:sitio` sí está permitido: es el script que NO verifica.
      if (/pnpm (run )?build(?![:\w])/.test(codigo)) culpables.push(archivo)
    }

    expect(culpables).toEqual([])
  })

  it('`build` construye antes de verificar, y verifica siempre', () => {
    const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(scripts['build:sitio']).toBe('astro build')
    expect(scripts.verifica).toBe('vitest run && astro check')
    expect(scripts.build).toBe('pnpm build:sitio && pnpm verifica')
  })
})
