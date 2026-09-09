/*
 * `esc()` existe porque cuatro tests interpolaban contenido crudo en un
 * `new RegExp`. Mientras ningún nombre tuvo paréntesis nadie lo notó; con
 * el panel, la clienta puede escribir «Lima (con chile)» y el patrón
 * dejaría de matchear sin decir por qué. El escape saca esa restricción
 * de vocabulario, que nunca fue una decisión de marca: era un bug.
 */
import { describe, it, expect } from 'vitest'
import { esc } from './regex'

describe('esc()', () => {
  it('deja interpolar un nombre con paréntesis', () => {
    const nombre = 'Lima (con chile)'
    expect(new RegExp(`>${esc(nombre)}<`).test(`>${nombre}<`)).toBe(true)
    // Sin escapar, los paréntesis son un grupo: el patrón matchea
    // «>Lima con chile<», que es otra cadena.
    expect(new RegExp(`>${nombre}<`).test(`>${nombre}<`)).toBe(false)
  })

  it('deja interpolar un nombre con signo de pregunta', () => {
    const nombre = '¿Chamoy?'
    expect(new RegExp(`>${esc(nombre)}<`).test(`>${nombre}<`)).toBe(true)
    expect(new RegExp(`>${nombre}<`).test(`>${nombre}<`)).toBe(false)
  })

  it('no toca lo que no es metacarácter', () => {
    expect(esc('Fresas & chile')).toBe('Fresas & chile')
    expect(esc('Jengibre y naranja')).toBe('Jengibre y naranja')
  })
})
