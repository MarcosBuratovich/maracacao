import { describe, it, expect } from 'vitest'
import { contenidoPublicado, leer } from '@/panel/campos'
import { listasAbiertas, puedeAgregar, puedeBorrar, agregarItem, quitarItem } from '@/panel/listas'

describe('dónde se puede agregar y borrar', () => {
  it('son exactamente las cinco listas que la clienta controla entera', () => {
    const rutas = listasAbiertas().map((l) => `${l.documento}:${l.rutaEsquema}`).sort()
    expect(rutas).toEqual([
      'fichas:fichas[].meta[]',
      'sitio:cocoas.lista[]',
      'sitio:negocios.condiciones[]',
      'sitio:negocios.fichas[]',
      'sitio:preguntas.items[]',
    ])
  })

  it('las barras NO están: de sus ocho campos la clienta controla dos', () => {
    const rutas = listasAbiertas().map((l) => l.rutaEsquema)
    expect(rutas).not.toContain('sabores[]')
    expect(rutas).not.toContain('gotas[]')
  })
})

describe('agregar un ítem', () => {
  it('agrega al final y no muta el documento que recibió', () => {
    const antes = contenidoPublicado()
    const largoAntes = (leer(antes.sitio, 'cocoas.lista') as unknown[]).length
    const despues = agregarItem(antes, 'sitio', 'cocoas.lista')
    expect((leer(despues.sitio, 'cocoas.lista') as unknown[]).length).toBe(largoAntes + 1)
    expect((leer(antes.sitio, 'cocoas.lista') as unknown[]).length).toBe(largoAntes)
  })

  it('el ítem nuevo viene vacío, no clonado del anterior', () => {
    const d = agregarItem(contenidoPublicado(), 'sitio', 'cocoas.lista')
    const lista = leer(d.sitio, 'cocoas.lista') as Array<Record<string, unknown>>
    const nuevo = lista[lista.length - 1]
    expect(nuevo.nombre).toBe('')
    expect(nuevo.precioChico).toBeNull()
  })

  it('no deja pasar el máximo: cocoas admite seis', () => {
    let d = contenidoPublicado()
    for (let i = 0; i < 4; i++) d = agregarItem(d, 'sitio', 'cocoas.lista')
    expect((leer(d.sitio, 'cocoas.lista') as unknown[]).length).toBe(6)
    expect(puedeAgregar(d, 'sitio', 'cocoas.lista')).toBe(false)
    expect(() => agregarItem(d, 'sitio', 'cocoas.lista')).toThrow()
  })
})

describe('quitar un ítem', () => {
  it('quita el que se le pide, no el último', () => {
    const antes = contenidoPublicado()
    const lista = leer(antes.sitio, 'cocoas.lista') as Array<{ nombre: string }>
    const despues = quitarItem(antes, 'sitio', 'cocoas.lista.0')
    const quedan = leer(despues.sitio, 'cocoas.lista') as Array<{ nombre: string }>
    expect(quedan).toHaveLength(lista.length - 1)
    expect(quedan[0].nombre).toBe(lista[1].nombre)
  })

  it('no deja bajar del mínimo: preguntas exige tres', () => {
    let d = contenidoPublicado()
    while ((leer(d.sitio, 'preguntas.items') as unknown[]).length > 3) {
      d = quitarItem(d, 'sitio', 'preguntas.items.0')
    }
    expect(puedeBorrar(d, 'sitio', 'preguntas.items')).toBe(false)
    expect(() => quitarItem(d, 'sitio', 'preguntas.items.0')).toThrow()
  })
})
