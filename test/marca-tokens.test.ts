import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/tokens/contrast'
import { sabor, marca, tintaSabor, saboresSoloDisplay } from '@/tokens/color'
import { customProperties } from '@/tokens/css'

// El canvas del rediseño ponía blanco fijo sobre el color del sabor y
// siete sabores fallaban AA. Estos tests fijan la solución: una tinta
// elegida POR SABOR, y la única excepción (hierbabuena) declarada
// explícitamente como display-only en vez de escondida.
describe('tintaSabor', () => {
  it('hay una tinta por cada sabor, sin sobras', () => {
    expect(Object.keys(tintaSabor).sort()).toEqual(Object.keys(sabor).sort())
  })

  it.each(Object.entries(tintaSabor))(
    'la tinta de %s pasa AA para texto normal (o está declarada display-only)',
    (nombre, tinta) => {
      const ratio = contrastRatio(tinta, sabor[nombre as keyof typeof sabor])
      if ((saboresSoloDisplay as readonly string[]).includes(nombre)) {
        // Display-only: alcanza para texto grande (≥3.0) pero no para
        // cuerpo — el CSS no debe poner texto normal sobre este fondo.
        expect(ratio).toBeGreaterThanOrEqual(3)
        expect(ratio).toBeLessThan(4.5)
      } else {
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('cada tinta elegida es la mejor de las dos candidatas', () => {
    // Si alguien cambia un hex de sabor, esto detecta que la tinta
    // asignada dejó de ser la óptima entre blanco y tinta de impreso.
    for (const [nombre, hex] of Object.entries(sabor)) {
      const blanco = contrastRatio('#FFFFFF', hex)
      const impreso = contrastRatio(marca.tintaImpreso, hex)
      const elegida = contrastRatio(tintaSabor[nombre as keyof typeof sabor], hex)
      expect(elegida).toBe(Math.max(blanco, impreso))
    }
  })
})

describe('paleta marca', () => {
  it('textoSuave corrige el #8A6F5A del canvas: pasa AA sobre crema', () => {
    expect(contrastRatio(marca.textoSuave, marca.crema)).toBeGreaterThanOrEqual(4.5)
    // El original del canvas efectivamente fallaba — si esto deja de ser
    // cierto, la corrección ya no se justifica y conviene revisarla.
    expect(contrastRatio('#8A6F5A', marca.crema)).toBeLessThan(4.5)
  })

  it('textoSuave también aguanta la banda cálida', () => {
    expect(contrastRatio(marca.textoSuave, marca.bandaCalida)).toBeGreaterThanOrEqual(4.5)
  })

  it('el rojo de acento NO sirve para texto chico sobre crema', () => {
    // 4.23: display sí, cuerpo no. Para texto chico en rojo va rojoHondo.
    expect(contrastRatio(marca.rojo, marca.crema)).toBeLessThan(4.5)
    expect(contrastRatio(marca.rojoHondo, marca.crema)).toBeGreaterThanOrEqual(7)
  })

  it('rojoHondo comparte hex con sabor.canela a propósito', () => {
    // Mismo pigmento, dos roles: granate de la canela y rojo profundo de
    // marca. Si el arte de canela cambiara, esta igualdad debe revisarse.
    expect(marca.rojoHondo).toBe(sabor.canela)
  })
})

describe('emisión CSS', () => {
  it('marca y tintaSabor salen con prefijo propio, sin pisar fijos', () => {
    const props = customProperties()
    expect(props['--mrc-marca-crema']).toBe(marca.crema)
    expect(props['--mrc-marca-amarillo']).toBe(marca.amarillo)
    expect(props['--mrc-tinta-sabor-mentaIntensa']).toBe(marca.tintaImpreso)
    expect(props['--mrc-tinta-sabor-canela']).toBe('#FFFFFF')
    // Los históricos siguen intactos — el motivo del prefijo.
    expect(props['--mrc-crema']).toBe('#F4E8C6')
    expect(props['--mrc-amarillo']).toBe('#ECC677')
  })

  it('las familias del rediseño están declaradas', () => {
    const props = customProperties()
    expect(props['--mrc-font-titular']).toContain('Bricolage Grotesque')
    expect(props['--mrc-font-serifMarca']).toContain('Trocchi')
    expect(props['--mrc-font-mono']).toContain('Courier Prime')
    expect(props['--mrc-font-mano']).toContain('Patrick Hand')
  })
})
