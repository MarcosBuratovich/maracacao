// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { campos, contenidoPublicado } from '@/panel/campos'
import { camposDePuerta } from '@/panel/puertas'
import type { Puerta } from '@/panel/puertas'
import ListaDeItems, { itemsDe, esSuelto } from '@/panel/ListaDeItems'

afterEach(cleanup)

const itemsDeLaPuerta = (puerta: Puerta) => itemsDe(camposDePuerta(campos(contenidoPublicado()), puerta))
const itemsDeProductos = () => itemsDeLaPuerta('productos')

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

  /*
   * [Ronda de arreglo final] En el celular, elegir un ítem le pone
   * `display: none` al `<nav>` donde vive el botón que ella acaba de
   * tocar: sin mover el foco a mano, queda en `<body>` y el teclado
   * arranca de cero desde arriba de la página. El destino natural es el
   * botón que abre y cierra el cajón —el control que sigue en pantalla y
   * del que salió—, que es el patrón de siempre para algo que se despliega
   * y se vuelve a plegar.
   */
  it('al elegir del cajón abierto, el foco vuelve al botón que lo abre', () => {
    const items = itemsDeProductos()
    render(createElement(ListaDeItems, {
      items, elegido: items[0].clave,
      onElegir: () => {}, abierta: true, onAbrir: () => {},
    }))
    const boton = screen.getByRole('button', { name: /cerrar/i })
    fireEvent.click(screen.getByText(items[1].etiqueta))
    expect(document.activeElement).toBe(boton)
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

/*
 * ---------------------------------------------------------------------
 * Ronda de arreglo: el balde de sueltos, partido — «Contacto y negocio»
 * juntaba 78 campos en una sola fila, la misma promesa rota que esta
 * fase entera vino a arreglar, solo que trasladada del nivel de puerta al
 * nivel de ítem. Ver el comentario de `itemsDeSueltos()` en
 * `ListaDeItems.tsx`.
 * ---------------------------------------------------------------------
 */
describe('el reparto de sueltos — ronda de arreglo', () => {
  it('el reparto no pierde ni duplica ningún campo, se parta o no', () => {
    // Productos parte (49 sueltos > 20); Lo que no se ve no parte (19 ≤
    // 20): las dos ramas de `itemsDeSueltos()` quedan cubiertas.
    for (const puerta of ['productos', 'negocio', 'invisible'] as const) {
      const entrada = camposDePuerta(campos(contenidoPublicado()), puerta)
      const items = itemsDe(entrada)

      const total = items.reduce((n, i) => n + i.campos.length, 0)
      expect(total).toBe(entrada.length)

      // Cada campo de entrada aparece en EXACTAMENTE un ítem de salida:
      // ni falta ninguno (lo que lo volvería imposible de editar, sin que
      // nada en la pantalla lo delate) ni sobra ninguno repetido.
      const clave = (c: { documento: string; ruta: string }) => `${c.documento} ${c.ruta}`
      const deEntrada = entrada.map(clave).sort()
      const deSalida = items.flatMap((i) => i.campos.map(clave)).sort()
      expect(new Set(deSalida).size).toBe(deSalida.length)
      expect(deSalida).toEqual(deEntrada)
    }
  })

  it('«Contacto y negocio» (78 campos sueltos) queda repartido en ítems chicos: ninguno llega a 30', () => {
    // El peor caso de hoy, partido, da 26 («Los tres paneles de
    // producto»); 30 deja margen sin dejar de proteger la promesa —el
    // balde SIN partir daba 78, muy por encima de cualquiera de los dos.
    for (const i of itemsDeLaPuerta('negocio')) expect(i.campos.length).toBeLessThanOrEqual(30)
  })

  it('un balde chico no se fragmenta: «Lo que no se ve» (19 campos sueltos) queda en un solo ítem', () => {
    const sueltos = itemsDeLaPuerta('invisible').filter((i) => esSuelto(i.clave))
    expect(sueltos).toHaveLength(1)
    expect(sueltos[0].campos.length).toBe(19)
  })

  it('los nombres de los ítems partidos salen del esquema, nunca inventados', () => {
    const etiquetas = itemsDeLaPuerta('negocio').map((i) => i.etiqueta)
    // 'Contacto' y 'Formulario de contacto' son la etiqueta que `grupo()`
    // ya le puso a esos nodos en `contacto.ts`; 'Los tres paneles de
    // producto' es la de `negocios.tabs` en `negocio.ts`. Ninguna la
    // escribió este archivo.
    expect(etiquetas).toContain('Contacto')
    expect(etiquetas).toContain('Formulario de contacto')
    expect(etiquetas).toContain('Los tres paneles de producto')
  })
})
