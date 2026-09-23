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
 * 7. [Ronda de arreglo final] Cuando le cambian la prop `campo` por otra
 *    con la MISMA ruta y otro contenido — lo que pasa al borrar un item
 *    que no es el ultimo: el sobreviviente ocupa el indice del borrado y
 *    React recicla esta instancia en vez de montar una nueva — la pantalla
 *    muestra el valor NUEVO. Y las dos vueltas de eso, que son las que
 *    vuelven peligroso el arreglo ingenuo: un redibujado con el MISMO
 *    valor no le pisa lo que esta escribiendo, y el padre devolviendole
 *    lo que ella acaba de escribir no vuelve a silenciar el error que ya
 *    estaba a la vista.
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

  /*
   * Ronda de arreglo final: hasta ahora NINGÚN test cambiaba la prop
   * `campo` de este componente — la afirmación de seguridad que el propio
   * componente documentaba («no hace falta resincronizar, cada campo tiene
   * su `key` por ruta») no estaba protegida por nada, y era falsa: la ruta
   * es igual a la identidad solo mientras nadie borre un elemento
   * intermedio de una lista.
   */
  it('si le cambian el campo por otro con la misma ruta, muestra el valor nuevo', () => {
    const natural = unCampo('cocoas.lista.0.nombre')
    const { rerender } = render(createElement(Campo, { campo: natural, onCambio: () => {} }))
    const entrada = () => screen.getByLabelText(natural.meta.etiqueta!) as HTMLInputElement
    expect(entrada().value).toBe('Cocoa natural')

    // Exactamente lo que le llega a este componente cuando ella borra
    // «Cocoa natural» (índice 0 de 2): misma ruta, el contenido de la que
    // quedó. Sin resincronizar, la caja seguiría diciendo «Cocoa natural»
    // y el documento terminaría con un ítem Frankenstein.
    rerender(createElement(Campo, { campo: { ...natural, valor: 'Cocoa alcalina' }, onCambio: () => {} }))
    expect(entrada().value).toBe('Cocoa alcalina')
  })

  it('un redibujado con el MISMO valor no le pisa lo que está escribiendo', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    const { rerender } = render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = () => screen.getByLabelText(c.meta.etiqueta!) as HTMLInputElement
    fireEvent.change(entrada(), { target: { value: 'Cocoa nueva' } })

    // Un objeto `campo` NUEVO (así los arma `campos()` en cada redibujado)
    // con el mismo valor de antes: no es un ítem distinto, es el mismo —
    // lo que ella tiene a medio escribir no se toca.
    rerender(createElement(Campo, { campo: { ...c }, onCambio: () => {} }))
    expect(entrada().value).toBe('Cocoa nueva')
  })

  it('cuando el padre le devuelve lo que ella acaba de escribir, el error sigue en vivo', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    const { rerender } = render(createElement(Campo, { campo: c, onCambio: () => {} }))
    const entrada = () => screen.getByLabelText(c.meta.etiqueta!) as HTMLInputElement

    // Lo vacía, sale del campo: el error aparece.
    fireEvent.change(entrada(), { target: { value: '' } })
    fireEvent.blur(entrada())
    expect(screen.queryByRole('alert')).not.toBeNull()

    // El padre controlado la vuelve a dibujar con lo que ella misma
    // escribió. Eso NO es «otro ítem»: el error tiene que seguir a la
    // vista, no volver al silencio de antes del primer `blur`.
    rerender(createElement(Campo, { campo: { ...c, valor: '' }, onCambio: () => {} }))
    expect(screen.queryByRole('alert')).not.toBeNull()
  })

  it('avisa del cambio hacia afuera', () => {
    const c = unCampo('cocoas.lista.0.nombre')
    const vistos: unknown[] = []
    render(createElement(Campo, { campo: c, onCambio: (v: unknown) => vistos.push(v) }))
    fireEvent.change(screen.getByLabelText(c.meta.etiqueta!), { target: { value: 'Cocoa nueva' } })
    expect(vistos).toEqual(['Cocoa nueva'])
  })
})
