// @vitest-environment jsdom
/*
 * `Campo.tsx` (Tarea 4, fase 7): la pieza mas chica del panel, la que mas
 * se repite. Cuatro cosas, cada una con su porque:
 *
 * 1. La ayuda se ve SIEMPRE, sin tocar nada — nunca detras de un icono
 *    "?". Ya esta escrita para los 219 campos, en su idioma; esconderla es
 *    tener el trabajo hecho y no usarlo.
 * 2. El contador dice cuanto QUEDA, no cuanto lleva: "te quedan 74
 *    letras" es lo unico que le dice algo a ella, "126/200" no.
 * 3. El mensaje de error sale de `campo.validar()` — el mismo que usaria
 *    el servidor al publicar — nunca escrito a mano en este componente.
 * 4. Avisa hacia afuera con `onCambio`, para que quien lo use decida que
 *    hacer con el valor nuevo (autoguardar, revalidar, lo que sea).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { campos, contenidoPublicado } from '@/panel/campos'
import Campo from '@/panel/Campo'

afterEach(cleanup)

const unCampo = (ruta: string) => {
  const c = campos(contenidoPublicado()).find((x) => x.ruta === ruta)
  if (!c) throw new Error(`no existe el campo ${ruta}`)
  return c
}

describe('un campo', () => {
  it('muestra la ayuda SIN que haya que tocar nada', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    expect(screen.getByText(c.meta.ayuda!)).toBeTruthy()
  })

  it('el contador dice cuánto QUEDA, no cuánto lleva', () => {
    const c = unCampo('cocoas.lista.0.perfil')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const usadas = String(c.valor).length
    const quedan = c.meta.maxCaracteres! - usadas
    expect(screen.getByText(new RegExp(`${quedan}`))).toBeTruthy()
  })

  it('un precio mal escrito muestra el mensaje DEL ESQUEMA, no uno inventado', () => {
    const c = unCampo('cocoas.lista.0.precioChico')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = screen.getByLabelText(c.meta.etiqueta!)
    fireEvent.change(entrada, { target: { value: '86.50' } })
    const esperado = c.validar('86.50')[0].titulo
    expect(screen.getByText(esperado)).toBeTruthy()
  })

  it('avisa del cambio hacia afuera', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    const vistos: unknown[] = []
    render(createElement(Campo, { campo: c, onCambio: (v: unknown) => vistos.push(v) }))
    fireEvent.change(screen.getByLabelText(c.meta.etiqueta!), { target: { value: 'Cocoa nueva' } })
    expect(vistos).toEqual(['Cocoa nueva'])
  })
})
