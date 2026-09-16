import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const SALIDA = 'test/tmp/ejemplo.png'
afterAll(() => rmSync('test/tmp', { recursive: true, force: true }))

/*
 * Cada test de acá arranca un `node` aparte que carga @resvg, que es un
 * binario nativo. En esta máquina son ~1.8 s los trece juntos; en el
 * contenedor de build de Vercel —cuatro núcleos compartidos y disco frío— el
 * PRIMERO solo pagó 5.2 s de arranque y se pasó del tope de 5 s de vitest,
 * tumbando el deploy del 2026-09-16 con los otros 907 tests en verde. El tope
 * de acá es de arranque, no de trabajo: si alguno tarda 30 s hay algo roto de
 * verdad.
 */
describe('render-svg', { timeout: 30_000 }, () => {
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

  it('verifica que @resvg renderiza colores fielmente (chequeo de librería)', () => {
    // Chequeo de cordura: @resvg renderiza los colores del SVG correctamente.
    // Esto verifica la librería de terceros, no nuestro script.
    const svgContent = readFileSync('test/fixtures/colores-conocidos.svg', 'utf8')

    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: 100 },
      background: 'rgba(0,0,0,0)'
    })
    const rendered = resvg.render()
    const pixels = rendered.pixels

    const getPixelRGBA = (x: number, y: number): [number, number, number, number] => {
      const idx = (y * rendered.width + x) * 4
      return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
    }

    const isColorClose = (actual: [number, number, number, number], expected: [number, number, number, number], tolerance = 5) => {
      return Math.abs(actual[0] - expected[0]) <= tolerance &&
             Math.abs(actual[1] - expected[1]) <= tolerance &&
             Math.abs(actual[2] - expected[2]) <= tolerance &&
             Math.abs(actual[3] - expected[3]) <= tolerance
    }

    const pixelFondoVerde = getPixelRGBA(5, 5)
    expect(isColorClose(pixelFondoVerde, [58, 74, 48, 255])).toBe(true)

    const pixelFondoTan = getPixelRGBA(50, 50)
    expect(isColorClose(pixelFondoTan, [250, 243, 224, 255])).toBe(true)

    const pixelRojo = getPixelRGBA(17, 17)
    expect(isColorClose(pixelRojo, [255, 51, 51, 255])).toBe(true)
  })

  it('respeta hexadecimales en --fondo (notación #HEX como Task 9 usa)', () => {
    // CRÍTICO: Task 9 pasa --fondo '#FAF3E0' y --fondo '#3A4A30' (hexadecimales).
    // Este test verifica que la notación hex es parseada, interpretada y produce
    // fondos distintos. Si hex fuera ignorado, los resultados serían idénticos (fondo transparente).
    const fondoTan = 'test/tmp/fondo-FAF3E0.png'
    const fondoVerde = 'test/tmp/fondo-3A4A30.png'
    const fondoDefault = 'test/tmp/fondo-default.png'

    // Ejecutar script con los dos hexadecimales que Task 9 usa
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', fondoTan, '--ancho', '200', '--fondo', '#FAF3E0'])
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', fondoVerde, '--ancho', '200', '--fondo', '#3A4A30'])
    // Y sin --fondo (transparente por defecto)
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', fondoDefault, '--ancho', '200'])

    const bufferTan = readFileSync(fondoTan)
    const bufferVerde = readFileSync(fondoVerde)
    const bufferDefault = readFileSync(fondoDefault)

    // Todos deben ser PNGs válidos
    expect([...bufferTan.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect([...bufferVerde.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect([...bufferDefault.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])

    // Tan y verde deben diferir (hexadecimales distintos → fondos distintos)
    expect(bufferTan.equals(bufferVerde)).toBe(false)

    // Ambos hexadecimales deben diferir del default (transparente)
    expect(bufferTan.equals(bufferDefault)).toBe(false)
    expect(bufferVerde.equals(bufferDefault)).toBe(false)
  })

  // Validación de argumentos: casos de error
  describe('validación de argumentos', () => {
    const runScript = (args: string[]) => {
      let stderr = ''
      let exitCode = 0
      try {
        execFileSync('node', ['scripts/render-svg.mjs', ...args], {
          encoding: 'utf8'
        })
      } catch (err: unknown) {
        const e = err as { stderr?: string; status?: number }
        stderr = e.stderr || ''
        exitCode = e.status || 1
      }
      return { stderr, exitCode }
    }

    it('falla si --ancho no tiene valor', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/--ancho requiere un valor/)
    })

    it('falla si --ancho tiene valor no-numérico', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho', 'abc'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/debe ser un número positivo/)
    })

    it('falla si --ancho es cero', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho', '0'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/debe ser un número positivo/)
    })

    it('falla si --ancho es negativo', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho', '-100'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/debe ser un número positivo/)
    })

    it('falla si --fondo no tiene valor', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--fondo'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/--fondo requiere un valor/)
    })

    it('falla si --ancho va seguido de otro flag sin valor', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho', '--fondo'])
      expect(exitCode).toBe(1)
      expect(stderr).toMatch(/--ancho requiere un valor.*flag/)
    })

    it('imprime mensaje de uso con comillas para evitar comentarios en shell', () => {
      const { stderr, exitCode } = runScript(['test/fixtures/ejemplo.svg', 'test/tmp/test.png', '--ancho', 'x'])
      expect(exitCode).toBe(1)
      // Verifica que el mensaje de uso incluye comillas alrededor de #HEX
      expect(stderr).toMatch(/\'#HEX\'/)
    })
  })
})
