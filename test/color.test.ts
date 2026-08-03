import { describe, it, expect } from 'vitest'
import { contrastRatio, nivelWcag } from '@/tokens/contrast'
import {
  verde, tan, rosa, fijos, roles, paresAprobados, paresProhibidos, todosLosColores,
} from '@/tokens/color'

describe('rampas', () => {
  it.each([['verde', verde], ['tan', tan], ['rosa', rosa]] as const)(
    'la rampa %s tiene los diez pasos', (_nombre, rampa) => {
      const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
      expect(Object.keys(rampa).map(Number).sort((a, b) => a - b)).toEqual(pasos)
    },
  )

  it('el verde oscurece monótonamente de 50 a 900', () => {
    const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    const lum = pasos.map((p) => contrastRatio(verde[p], '#000000'))
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1])
  })

  it('todos los hex están normalizados a mayúsculas con almohadilla', () => {
    for (const c of todosLosColores()) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('el 500 del verde es el color medido del render', () => {
    expect(verde[500]).toBe('#5B744B')
  })

  it('todos los valores de rampas y fijos coinciden con el snapshot', () => {
    expect({ verde, tan, rosa, fijos }).toMatchInlineSnapshot(`
      {
        "fijos": {
          "amarillo": "#ECC677",
          "bordo": "#8B4D3F",
          "crema": "#F4E8C6",
          "papel": "#FAF3E0",
          "suelo": "#E3BC87",
          "tinta": "#372915",
        },
        "rosa": {
          "100": "#F5E3E2",
          "200": "#EBC8C5",
          "300": "#E0A9A4",
          "400": "#D48881",
          "50": "#FBF3F2",
          "500": "#C8665D",
          "600": "#A4544C",
          "700": "#80413C",
          "800": "#5C2F2B",
          "900": "#3C1F1C",
        },
        "tan": {
          "100": "#FEF2E3",
          "200": "#FCE4C8",
          "300": "#FBD5A9",
          "400": "#FAC487",
          "50": "#FEF9F3",
          "500": "#F8B465",
          "600": "#CB9453",
          "700": "#9F7341",
          "800": "#72532E",
          "900": "#4A361E",
        },
        "verde": {
          "100": "#E1E6DF",
          "200": "#C4CDBE",
          "300": "#A3B19A",
          "400": "#7F9373",
          "50": "#F2F4F1",
          "500": "#5B744B",
          "600": "#4B5F3E",
          "700": "#3A4A30",
          "800": "#2A3522",
          "900": "#1B2316",
        },
      }
    `)
  })

  it('todosLosColores() es exhaustivo', () => {
    const todos = todosLosColores()
    expect(todos).toHaveLength(36)
    for (const v of Object.values(verde)) expect(todos).toContain(v)
    for (const t of Object.values(tan)) expect(todos).toContain(t)
    for (const r of Object.values(rosa)) expect(todos).toContain(r)
    for (const f of Object.values(fijos)) expect(todos).toContain(f)
  })
})

describe('roles semánticos', () => {
  it('fondo-claro apunta al token correcto', () => {
    expect(roles['fondo-claro']).toBe(fijos.papel)
  })

  it('fondo-oscuro apunta al token correcto', () => {
    expect(roles['fondo-oscuro']).toBe(verde[700])
  })

  it('fondo-profundo apunta al token correcto', () => {
    expect(roles['fondo-profundo']).toBe(verde[800])
  })

  it('texto-cuerpo apunta al token correcto', () => {
    expect(roles['texto-cuerpo']).toBe(fijos.tinta)
  })

  it('texto-titulo apunta al token correcto', () => {
    expect(roles['texto-titulo']).toBe(verde[700])
  })

  it('texto-secundario apunta al token correcto', () => {
    expect(roles['texto-secundario']).toBe(verde[600])
  })

  it('texto-sobre-oscuro apunta al token correcto', () => {
    expect(roles['texto-sobre-oscuro']).toBe(fijos.papel)
  })

  it('acento apunta al token correcto', () => {
    expect(roles['acento']).toBe(fijos.bordo)
  })

  it('destacado apunta al token correcto', () => {
    expect(roles['destacado']).toBe(fijos.amarillo)
  })

  it('contorno-ilustracion apunta al token correcto', () => {
    expect(roles['contorno-ilustracion']).toBe(fijos.tinta)
  })
})

describe('pares aprobados', () => {
  it('no está vacío', () => expect(paresAprobados.length).toBeGreaterThan(0))

  it.each(paresAprobados)(
    '$uso — $frente sobre $fondo alcanza al menos $minimo',
    ({ frente, fondo, minimo }) => {
      const ratio = contrastRatio(frente, fondo)
      const orden = { falla: 0, 'AA-grande': 1, AA: 2, AAA: 3 } as const
      expect(orden[nivelWcag(ratio)]).toBeGreaterThanOrEqual(orden[minimo])
    },
  )

  it('ningún par aprobado para texto queda por debajo de 4.5', () => {
    for (const p of paresAprobados) {
      if (p.minimo === 'AA' || p.minimo === 'AAA') {
        expect(contrastRatio(p.frente, p.fondo)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('pares prohibidos', () => {
  it.each(paresProhibidos)(
    '$frente sobre $fondo efectivamente no llega a 4.5 ($razon)',
    ({ frente, fondo }) => {
      expect(contrastRatio(frente, fondo)).toBeLessThan(4.5)
    },
  )

  it('ningún par prohibido aparece en la lista de aprobados', () => {
    // Se comparan por clave, no campo a campo. Como los dos arrays son
    // `as const`, TypeScript estrecha los hex a tipos literales y declara
    // que la comparación nunca puede ser verdadera (ts2367) — o sea, prueba
    // estáticamente lo mismo que este test verifica en runtime, y de paso
    // rompe el build. Concatenar a string ensancha el tipo y deja el test
    // vivo como red contra futuras ediciones de las listas.
    const clave = (p: { frente: string; fondo: string }) => `${p.frente}|${p.fondo}`
    const aprobadas = paresAprobados.map(clave)
    for (const p of paresProhibidos) {
      expect(aprobadas).not.toContain(clave(p))
    }
  })
})
