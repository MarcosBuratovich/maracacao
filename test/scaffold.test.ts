// test/scaffold.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('el sitio declara es-MX como locale por defecto', () => {
    const cfg = readFileSync('astro.config.mjs', 'utf8')
    expect(cfg).toContain("defaultLocale: 'es-MX'")
  })

  it('el layout raíz marca lang="es-MX"', () => {
    const layout = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(layout).toContain('lang="es-MX"')
  })
})
