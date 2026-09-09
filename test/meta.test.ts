/*
 * Guards del propio andamiaje de tests.
 *
 * Existen por la compuerta de publicación (2026-09-08): `build` corre los
 * tests, así que un test que construya el sitio hace que el build se
 * llame a sí mismo y deja todos los deploys rojos. La trampa ya estuvo
 * puesta una vez (css-tokens.test.ts hacía execSync); esto impide que
 * vuelva.
 *
 * Este archivo se excluye a sí mismo del barrido. Hoy el regex no se
 * encuentra a sí mismo —su propio literal no arma "pnpm build" en una
 * corrida contigua—, pero es una casualidad frágil: un ajuste futuro al
 * regex (o a este comentario, si se sale del bloque que el barrido
 * descarta) podría hacer que sí matchee. La autoexclusión es defensa
 * contra ese día, no una necesidad de hoy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

describe('el andamiaje de tests', () => {
  it('ningún test construye el sitio: construir desde adentro es recursión', () => {
    const culpables: string[] = []
    // Recursivo: vitest.config.ts incluye `test/**/*.test.ts`, así que un
    // futuro test/e2e/algo.test.ts corre igual que uno en la raíz — el
    // barrido tiene que alcanzarlo.
    // `encoding: 'utf8'` explícito: sin él, el overload de readdirSync que
    // resuelve TypeScript devuelve `string | Buffer`, y `.endsWith` no
    // existe en `Buffer`.
    const archivos = readdirSync('test', { recursive: true, encoding: 'utf8' })
      .filter((a) => a.endsWith('.test.ts') && a !== 'meta.test.ts')

    for (const archivo of archivos) {
      const fuente = readFileSync(`test/${archivo}`, 'utf8')
      // Los comentarios quedan fuera: el que explica la regla la nombra.
      const codigo = fuente
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // `build:sitio` sí está permitido: es el script que NO verifica.
      // Cubre los cuatro gestores y flags entre `run`/`build` (`-s`,
      // `--silent`, etc.): un guard que atrapa una sola grafía de
      // `pnpm build` es un recordatorio, no una barrera.
      if (/(pnpm|npm|yarn|bun)\s+(run\s+)?(-\S+\s+)*build(?![:\w])/.test(codigo)) culpables.push(archivo)
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
