import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { customProperties, bloqueTheme } from '@/tokens/css'
import { verde, fijos, todosLosColores } from '@/tokens/color'
import { duraciones, easings, amplitudes } from '@/tokens/motion'
import { ejesFraunces, familias, escala } from '@/tokens/type'

describe('customProperties', () => {
  it('emite una propiedad por cada color del sistema', () => {
    const props = customProperties()
    for (const hex of todosLosColores()) {
      expect(Object.values(props)).toContain(hex)
    }
  })

  it('usa el prefijo --mrc- en todas las claves', () => {
    for (const k of Object.keys(customProperties())) expect(k).toMatch(/^--mrc-/)
  })

  it('los nombres de color coinciden con los que emite tokenizarSvg', () => {
    const props = customProperties()
    expect(props['--mrc-verde-500']).toBe(verde[500])
    expect(props['--mrc-tinta']).toBe(fijos.tinta)
  })

  it('incluye duraciones de movimiento con unidad', () => {
    const props = customProperties()
    expect(props['--mrc-dur-micro']).toMatch(/ms$/)
    expect(props['--mrc-dur-ambiental']).toMatch(/m?s$/)
  })
})

describe('bloqueTheme', () => {
  it('genera un @theme static válido de Tailwind (sin tree-shaking)', () => {
    const css = bloqueTheme()
    expect(css.startsWith('@theme static {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('--mrc-verde-500: #5B744B;')
  })

  it('el archivo generado coincide con bloqueTheme()', () => {
    const esperado = `/* GENERADO por pnpm tokens. No editar a mano. */\n${bloqueTheme()}`
    const actual = readFileSync('src/styles/tokens.generated.css', 'utf-8')
    expect(actual).toBe(esperado)
  })

  /**
   * Verifica que TODAS las propiedades --mrc-* lleguen al CSS que emite
   * Tailwind. Es el único test que puede detectar tree-shaking en @theme
   * (sin `static`, Tailwind emite solo las variables referenciadas):
   * vitest importa TypeScript directo, sin pasar por Astro+Vite+Tailwind,
   * así que todos los otros tests «pasan» mientras el navegador recibe un
   * artefacto incompleto.
   *
   * LEE dist/, no lo construye. Construir desde acá era recursión: el
   * script `build` corre los tests (compuerta de publicación, 2026-09-08),
   * y test/meta.test.ts lo vigila. Además, leer el artefacto es lo que el
   * test siempre quiso hacer — ahora verifica exactamente lo que Vercel
   * publica.
   *
   * El conteo se deriva de `customProperties()` en vez de estar
   * hardcodeado: la rampa rosa lo movió de 52 a 62 y un número a mano
   * obliga a editar el test cada vez que crece la paleta.
   *
   * El salto por falta de dist/ solo vale en local (comodidad: el bucle
   * corto `pnpm test` no construye). En CI/Vercel el test SÍ corre, y si
   * dist/ falta ahí es un fallo real: correr `pnpm verifica` sin su guard
   * más importante no puede volver verde.
   */
  const hayDist = existsSync('dist/index.html')
  // En local el salto es comodidad: `pnpm test` no construye y no vale la pena
  // obligar a construir para el bucle corto. En CI o en Vercel, NO: ahí la
  // ausencia de dist significa que la verificación corrió sin su guard más
  // importante, y eso tiene que ser rojo. Un verde que no vale es peor que un
  // rojo, sobre todo en la compuerta que decide si el sitio se publica.
  const automatizado = !!(process.env.CI || process.env.VERCEL)
  if (!hayDist && !automatizado) {
    console.warn(
      '\n[css-tokens] Falta dist/index.html: se salta el guard del CSS compilado.' +
        '\n  Corré `pnpm build:sitio` para que corra.\n',
    )
  }

  it.skipIf(!hayDist && !automatizado)(
    'todas las propiedades --mrc-* llegan al CSS compilado por Tailwind',
    async () => {
      // Aserción dura, no condición de salto: si el artefacto no está cuando
      // el test SÍ corre, es un fallo ruidoso.
      expect(existsSync('dist/index.html')).toBe(true)
      const html = readFileSync('dist/index.html', 'utf-8')

      // Extraer referencias a archivos CSS (pueden ser inline o externos)
      const cssMatches = html.match(/href="([^"]+\.css)"/g) || []
      const cssFiles = cssMatches.map(m => {
        const match = m.match(/href="([^"]+)"/)
        return match ? match[1] : ''
      }).filter(Boolean)

      // Leer los CSS y concatenarlos
      let cssContent = ''
      for (const file of cssFiles) {
        const path = `dist/${file}`
        if (existsSync(path)) {
          cssContent += readFileSync(path, 'utf-8')
        }
      }

      // Si no hay archivos CSS externos, el CSS puede estar inline
      if (!cssContent) {
        const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g)
        if (styleMatch) {
          cssContent = styleMatch.map(s => s.replace(/<style[^>]*>|<\/style>/g, '')).join('')
        }
      }

      // Verificar que todas las propiedades estén en el CSS compilado
      const props = customProperties()
      const propNames = Object.keys(props)

      expect(propNames.length).toBeGreaterThanOrEqual(52)

      for (const propName of propNames) {
        expect(cssContent).toContain(propName)
      }
    }
  )
})

describe('movimiento', () => {
  it('las duraciones respetan los rangos del spec', () => {
    expect(duraciones.micro).toBeGreaterThanOrEqual(120)
    expect(duraciones.micro).toBeLessThanOrEqual(200)
    expect(duraciones.gesto).toBeGreaterThanOrEqual(300)
    expect(duraciones.gesto).toBeLessThanOrEqual(500)
    expect(duraciones.ambiental).toBeGreaterThanOrEqual(3000)
    expect(duraciones.ambiental).toBeLessThanOrEqual(5000)
  })

  it('duraciones.parpadeo es el ciclo completo (6000ms)', () => {
    // duraciones.parpadeo es el ciclo completo de una animación de parpadeo.
    // El intervalo entre parpadeos (4-7s) está en amplitudes.parpadeoMinMs/MaxMs.
    expect(duraciones.parpadeo).toBe(6000)
  })

  it('easings tiene spring, salida y entrada definidos', () => {
    expect(easings.spring).toBe('linear(0, 0.02, 0.4 12%, 0.87 26%, 1.06 38%, 1.01 62%, 1)')
    expect(easings.salida).toBe('cubic-bezier(0.4, 0, 1, 1)')
    expect(easings.entrada).toBe('cubic-bezier(0, 0, 0.2, 1)')
  })

  it('amplitudes contiene valores de intervalo de parpadeo (4000-7000ms)', () => {
    expect(amplitudes.parpadeoMinMs).toBe(4000)
    expect(amplitudes.parpadeoMaxMs).toBe(7000)
    expect(amplitudes.respiracionEscala).toBe(1.02)
    expect(amplitudes.colaGrados).toBe(6)
  })
})

describe('tipografía', () => {
  it('Fraunces arranca en SOFT 60 WONK 1, como fija el spec', () => {
    expect(ejesFraunces.SOFT).toBe(60)
    expect(ejesFraunces.WONK).toBe(1)
  })

  it('ejesFraunces.opsz es 32', () => {
    expect(ejesFraunces.opsz).toBe(32)
  })

  it('familias tiene display y texto correctas', () => {
    expect(familias.display).toBe("'Fraunces Variable', Fraunces, Georgia, serif")
    expect(familias.texto).toBe("'Work Sans Variable', 'Work Sans', system-ui, sans-serif")
  })

  it('escala tiene 7 tamaños definidos', () => {
    expect(Object.keys(escala)).toHaveLength(7)
    expect(escala['display-xl']).toBe('3.5rem')
    expect(escala['display-l']).toBe('2.5rem')
    expect(escala.titulo).toBe('1.75rem')
    expect(escala.subtitulo).toBe('1.25rem')
    expect(escala.cuerpo).toBe('1rem')
    expect(escala.menor).toBe('0.875rem')
    expect(escala.etiqueta).toBe('0.75rem')
  })
})

describe('CSS global', () => {
  it('prefers-reduced-motion desactiva animaciones completamente (no atenúa)', () => {
    // El spec prohibe reducir duraciones mínimas — hay que apagar completamente.
    // animation: none y transition: none es lo correcto.
    const globalCss = readFileSync('src/styles/global.css', 'utf-8')
    expect(globalCss).toContain('prefers-reduced-motion: reduce')
    expect(globalCss).toContain('animation: none !important;')
    expect(globalCss).toContain('transition: none !important;')
  })
})
