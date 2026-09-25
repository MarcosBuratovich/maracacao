import { describe, it, expect } from 'vitest'
import { campos, contenidoPublicado, SECCIONES } from '@/panel/campos'
import { PUERTAS, ETIQUETA_DE_PUERTA, puertaDe, camposDePuerta } from '@/panel/puertas'

describe('las cinco puertas', () => {
  it('cada una de las catorce secciones tiene puerta, y ninguna sobra', () => {
    for (const s of SECCIONES) expect(PUERTAS).toContain(puertaDe(s))
  })

  it('las cinco puertas juntas cubren los 692 campos, sin repetir ninguno', () => {
    const todos = campos(contenidoPublicado())
    const vistos = new Set<string>()
    let suma = 0
    for (const p of PUERTAS) {
      for (const c of camposDePuerta(todos, p)) {
        expect(vistos.has(c.documento + ':' + c.ruta)).toBe(false)
        vistos.add(c.documento + ':' + c.ruta)
        suma++
      }
    }
    expect(suma).toBe(todos.length)
  })

  it('el reparto es el que declaró el diseño', () => {
    const todos = campos(contenidoPublicado())
    expect(camposDePuerta(todos, 'fichas')).toHaveLength(341)
    expect(camposDePuerta(todos, 'textos')).toHaveLength(128)
    expect(camposDePuerta(todos, 'productos')).toHaveLength(105)
    expect(camposDePuerta(todos, 'negocio')).toHaveLength(99)
    expect(camposDePuerta(todos, 'invisible')).toHaveLength(19)
  })

  it('ninguna etiqueta de puerta usa jerga técnica', async () => {
    const { jergaEn } = await import('@/servidor/estado')
    for (const p of PUERTAS) expect(jergaEn(ETIQUETA_DE_PUERTA[p]), ETIQUETA_DE_PUERTA[p]).toBeNull()
  })
})
