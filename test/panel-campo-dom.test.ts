// @vitest-environment jsdom
/*
 * `Campo.tsx` (Tarea 4, fase 7 + ronda de arreglo posterior): la pieza mas
 * chica del panel, la que mas se repite. Lo que protege cada test:
 *
 * 1. La ayuda se ve SIEMPRE, sin tocar nada — nunca detras de un icono
 *    "?". Ya esta escrita para los 219 campos, en su idioma; esconderla es
 *    tener el trabajo hecho y no usarlo. El test afirma VISIBILIDAD, no
 *    solo presencia en el DOM: `getByText` encuentra un texto igual si
 *    esta adentro de un `display:none`, y eso no protegeria nada.
 * 2. El contador dice cuanto QUEDA, no cuanto lleva: "te quedan 74
 *    letras" es lo unico que le dice algo a ella, "126/200" no. Y pasado
 *    el tope deja de contar hacia atras (nunca un numero negativo): dice
 *    derecho por cuanto se paso.
 * 3. El mensaje de error sale de `campo.validar()` — el mismo que usaria
 *    el servidor al publicar — nunca escrito a mano en este componente.
 * 4. El error espera a que ella SALGA del campo la primera vez: validar en
 *    cada tecla desde el primer caracter es ruido, no ayuda (medido en un
 *    campo de correo real: el mensaje quedaba en pantalla en 16 de las 17
 *    pulsaciones que hacen falta para escribirlo entero). Una vez que
 *    salio una vez, el error SI se actualiza en vivo.
 * 5. Cuando el problema trae un arreglo de un toque (el espacio duro entre
 *    cifra y unidad, el caso real de `medida`), hay un boton que lo
 *    aplica — el mismo comportamiento que tenia el `Campo` privado de
 *    `Editor.tsx`, que esta tarea reemplaza.
 * 6. Avisa hacia afuera con `onCambio`, para que quien lo use decida que
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

/**
 * `getByText` solo mira el CONTENIDO del DOM, no si se ve: un nodo dentro
 * de un `display:none` matchea igual. Camina hasta la raíz mirando el
 * estilo COMPUTADO de cada ancestro — lo mismo que haría un `toBeVisible`
 * de una librería de matchers, sin sumar una dependencia nueva para un
 * solo chequeo.
 */
function visible(el: HTMLElement): boolean {
  let nodo: HTMLElement | null = el
  while (nodo) {
    const estilo = getComputedStyle(nodo)
    if (estilo.display === 'none' || estilo.visibility === 'hidden' || estilo.visibility === 'collapse') return false
    if (nodo.hidden) return false
    nodo = nodo.parentElement
  }
  return true
}

describe('un campo', () => {
  it('muestra la ayuda VISIBLE, sin que haya que tocar nada', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    expect(visible(screen.getByText(c.meta.ayuda!))).toBe(true)
  })

  it('el contador dice cuánto QUEDA, no cuánto lleva', () => {
    const c = unCampo('cocoas.lista.0.perfil')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const usadas = String(c.valor).length
    const quedan = c.meta.maxCaracteres! - usadas
    expect(screen.getByText(new RegExp(`${quedan}`))).toBeTruthy()
  })

  it('pasado el tope, dice por cuánto se pasó — nunca un número negativo', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = screen.getByLabelText(c.meta.etiqueta!)
    const exceso = 15
    const largo = c.meta.maxCaracteres! + exceso
    fireEvent.change(entrada, { target: { value: 'x'.repeat(largo) } })
    expect(screen.getByText(new RegExp(`pasaste por ${exceso}`, 'i'))).toBeTruthy()
    expect(screen.queryByText(new RegExp(`-${exceso}\\b`))).toBeNull()
  })

  it('un precio mal escrito muestra el mensaje DEL ESQUEMA, no uno inventado', () => {
    const c = unCampo('cocoas.lista.0.precioChico')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = screen.getByLabelText(c.meta.etiqueta!)
    fireEvent.change(entrada, { target: { value: '86.50' } })
    fireEvent.blur(entrada)
    const esperado = c.validar('86.50')[0].titulo
    expect(screen.getByText(esperado)).toBeTruthy()
  })

  it('mientras escribe, la pantalla se calla — el error espera a que salga del campo', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = screen.getByLabelText(c.meta.etiqueta!)

    // Lo vacía para retipearlo: mientras no salió del campo, ni un aviso.
    fireEvent.change(entrada, { target: { value: '' } })
    expect(screen.queryByRole('alert')).toBeNull()

    // Sale del campo por primera vez: ahí sí aparece.
    fireEvent.blur(entrada)
    const esperado = c.validar('')[0].titulo
    expect(screen.getByText(esperado)).toBeTruthy()

    // Ya "tocado", lo corrige sin volver a salir: desaparece solo, en vivo.
    fireEvent.change(entrada, { target: { value: 'Cocoa nueva' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('el error trae un botón que arregla de un toque el espacio duro', () => {
    const c = unCampo('anaquel.pesoInsignia')
    const vistos: unknown[] = []
    render(createElement(Campo, { campo: c, onCambio: (v: unknown) => vistos.push(v) }))
    const entrada = screen.getByLabelText(c.meta.etiqueta!)

    // Escribe la medida con un espacio común (no el duro) y sale del campo.
    const malEscrito = '70 g'
    fireEvent.change(entrada, { target: { value: malEscrito } })
    fireEvent.blur(entrada)

    const arreglo = c.validar(malEscrito)[0].arreglo!
    const boton = screen.getByRole('button', { name: arreglo.etiqueta })
    fireEvent.click(boton)

    expect(vistos.at(-1)).toBe(arreglo.valor)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa del cambio hacia afuera', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    const vistos: unknown[] = []
    render(createElement(Campo, { campo: c, onCambio: (v: unknown) => vistos.push(v) }))
    fireEvent.change(screen.getByLabelText(c.meta.etiqueta!), { target: { value: 'Cocoa nueva' } })
    expect(vistos).toEqual(['Cocoa nueva'])
  })
})
