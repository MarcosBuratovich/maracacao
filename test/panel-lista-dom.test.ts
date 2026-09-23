// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { campos, contenidoPublicado } from '@/panel/campos'
import { camposDePuerta } from '@/panel/puertas'
import ListaDeItems, { itemsDe } from '@/panel/ListaDeItems'

afterEach(cleanup)

const itemsDeProductos = () => itemsDe(camposDePuerta(campos(contenidoPublicado()), 'productos'))

describe('la lista de ítems', () => {
  it('agrupa los 105 campos de Productos en ítems con nombre, no en 105 renglones', () => {
    const items = itemsDeProductos()
    expect(items.length).toBeLessThan(40)
    expect(items.some((i) => i.etiqueta.includes('Canela'))).toBe(true)
  })

  it('ningún ítem queda sin nombre', () => {
    for (const i of itemsDeProductos()) expect(i.etiqueta.trim().length).toBeGreaterThan(0)
  })

  it('el botón del cajón dice qué hace, no es solo un ícono', () => {
    render(createElement(ListaDeItems, {
      items: itemsDeProductos(), elegido: itemsDeProductos()[0].clave,
      onElegir: () => {}, abierta: false, onAbrir: () => {},
    }))
    const boton = screen.getByRole('button', { name: /elegir/i })
    expect(boton.textContent!.replace(/[^a-záéíóúñ ]/gi, '').trim().length).toBeGreaterThan(3)
  })

  it('elegir un ítem lo avisa hacia afuera', () => {
    const items = itemsDeProductos()
    const elegidos: string[] = []
    render(createElement(ListaDeItems, {
      items, elegido: items[0].clave,
      onElegir: (c: string) => elegidos.push(c), abierta: true, onAbrir: () => {},
    }))
    fireEvent.click(screen.getByText(items[1].etiqueta))
    expect(elegidos).toEqual([items[1].clave])
  })
})
