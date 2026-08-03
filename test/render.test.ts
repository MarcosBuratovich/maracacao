import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

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

  it('rasteriza colores correctamente (píxeles verificables)', () => {
    // SVG con colores conocidos: fondo verde, región tan, cuadrado rojo
    const svgContent = readFileSync('test/fixtures/colores-conocidos.svg', 'utf8')

    // Rasterizar con ancho 100px (escala 1:1 con viewBox)
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: 100 },
      background: 'rgba(0,0,0,0)' // Sin fondo adicional, solo el SVG
    })
    const rendered = resvg.render()
    const pixels = rendered.pixels

    // Helper para leer píxel RGBA en posición (x, y)
    const getPixelRGBA = (x: number, y: number): [number, number, number, number] => {
      const idx = (y * rendered.width + x) * 4
      return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
    }

    // Helper para verificar que un píxel está "cerca" del color esperado
    // (permite pequeña variación por antialiasing en bordes)
    const isColorClose = (actual: [number, number, number, number], expected: [number, number, number, number], tolerance = 5) => {
      return Math.abs(actual[0] - expected[0]) <= tolerance &&
             Math.abs(actual[1] - expected[1]) <= tolerance &&
             Math.abs(actual[2] - expected[2]) <= tolerance &&
             Math.abs(actual[3] - expected[3]) <= tolerance
    }

    // Verificar fondo verde #3A4A30 = rgb(58, 74, 48), alfa 255
    // Muestrear desde esquina bien dentro, lejos de bordes
    const pixelFondoVerde = getPixelRGBA(5, 5)
    expect(isColorClose(pixelFondoVerde, [58, 74, 48, 255])).toBe(true)

    // Verificar región tan #FAF3E0 = rgb(250, 243, 224), alfa 255
    // Muestrear desde centro de la región (25-75 en viewBox, samplear en 50)
    const pixelFondoTan = getPixelRGBA(50, 50)
    expect(isColorClose(pixelFondoTan, [250, 243, 224, 255])).toBe(true)

    // Verificar cuadrado rojo #FF3333 = rgb(255, 51, 51), alfa 255
    // Cuadrado en (10,10) tamaño 15, samplear en centro (17.5 ≈ 17)
    const pixelRojo = getPixelRGBA(17, 17)
    expect(isColorClose(pixelRojo, [255, 51, 51, 255])).toBe(true)

    // Verificación negativa: píxel en la esquina inferior derecha debe ser VERDE (fondo)
    // no TAN (que está solo en región 25-75)
    const pixelEsquinaVerde = getPixelRGBA(95, 95)
    expect(isColorClose(pixelEsquinaVerde, [58, 74, 48, 255])).toBe(true)
    expect(isColorClose(pixelEsquinaVerde, [250, 243, 224, 255])).toBe(false)
  })
})
