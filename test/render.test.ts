import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'

const SALIDA = 'test/tmp/ejemplo.png'
afterAll(() => rmSync('test/tmp', { recursive: true, force: true }))

describe('render-svg', () => {
  it('rasteriza un SVG a PNG', () => {
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', SALIDA, '--ancho', '200'])
    expect(existsSync(SALIDA)).toBe(true)
    // firma PNG
    expect([...readFileSync(SALIDA).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('falla con mensaje claro si falta la entrada', () => {
    expect(() =>
      execFileSync('node', ['scripts/render-svg.mjs'], { stdio: 'pipe' }),
    ).toThrow(/Uso: render-svg/)
  })

  it('respeta el parámetro --ancho (escala)', () => {
    const ancho100 = 'test/tmp/ancho-100.png'
    const ancho200 = 'test/tmp/ancho-200.png'
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', ancho100, '--ancho', '100'])
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', ancho200, '--ancho', '200'])

    const size100 = readFileSync(ancho100).length
    const size200 = readFileSync(ancho200).length

    // PNG con el doble de ancho debería ser significativamente más grande (más píxeles)
    // Esperamos al menos 1.5x de aumento de tamaño
    expect(size200).toBeGreaterThan(size100 * 1.5)
  })

  it('respeta el parámetro --fondo (color de fondo)', () => {
    const fondoTransp = 'test/tmp/fondo-transp.png'
    const fondoBlanco = 'test/tmp/fondo-blanco.png'
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', fondoTransp, '--ancho', '200', '--fondo', 'rgba(0,0,0,0)'])
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', fondoBlanco, '--ancho', '200', '--fondo', 'white'])

    const bufferTransp = readFileSync(fondoTransp)
    const bufferBlanco = readFileSync(fondoBlanco)

    // Ambos deben ser PNGs válidos
    expect([...bufferTransp.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect([...bufferBlanco.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])

    // Fondos diferentes producen contenido distinto (aunque sea mínimo, por compresión)
    // Lo importante es que el parámetro --fondo se respeta, no que sea ignorado
    expect(bufferTransp.equals(bufferBlanco)).toBe(false)
  })
})
