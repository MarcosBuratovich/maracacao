/*
 * El resumen de qué cambió. Lo lee la clienta antes de publicar, es el asunto
 * del commit y es lo que el historial muestra. Si miente, miente en los tres
 * lugares a la vez.
 */
import { describe, it, expect } from 'vitest'
import { resume, frase } from '../src/contenido/diff'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { marca } from '@/copy/sitio-marca'

const clon = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe('el resumen de cambios', () => {
  it('sin cambios, no dice nada', () => {
    expect(resume(marca, clon(marca), esquemaSitio)).toEqual([])
  })

  it('un texto cambiado sale con su etiqueta del esquema, no con su ruta', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'Elegí tu barra'
    const cambios = resume(marca, despues, esquemaSitio)
    expect(cambios).toHaveLength(1)
    expect(cambios[0].campo).toBe('anaquel.titulo')
    // La etiqueta es lo que la clienta ve en el panel, y es lo que tiene que
    // leer en el resumen: «Título del anaquel», no «anaquel.titulo».
    expect(cambios[0].etiqueta).not.toContain('.')
    expect(cambios[0].antes).toBe(marca.anaquel.titulo)
    expect(cambios[0].despues).toBe('Elegí tu barra')
  })

  it('un elemento agregado a una lista es un alta, no un cambio', () => {
    const despues = clon(marca)
    despues.preguntas.items.push({ p: '¿Hacen envíos?', r: 'Todavía no.' })
    const cambios = resume(marca, despues, esquemaSitio)
    expect(cambios.some((c) => c.tipo === 'alta')).toBe(true)
  })

  it('un elemento borrado es una baja', () => {
    const despues = clon(marca)
    despues.preguntas.items.pop()
    expect(resume(marca, despues, esquemaSitio).some((c) => c.tipo === 'baja')).toBe(true)
  })

  it('no reporta los derivados: no se editan', () => {
    const despues = clon(marca)
    despues.anaquel.contadorDe = 'de 99'
    expect(resume(marca, despues, esquemaSitio)).toEqual([])
  })
})

describe('la frase', () => {
  it('con un solo cambio nombra el campo', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'Otro'
    expect(frase(resume(marca, despues, esquemaSitio))).toMatch(/cambi/i)
  })

  it('con varios cambios cuenta, y no lista quince cosas', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'A'
    despues.anaquel.kicker = 'B'
    despues.polvo.titulo = 'C'
    const f = frase(resume(marca, despues, esquemaSitio))
    expect(f).toMatch(/3/)
    expect(f.length).toBeLessThan(72)   // el asunto de un commit
  })

  it('sin cambios no inventa una frase', () => {
    expect(frase([])).toBe('')
  })

  it('la frase pasa el filtro de vocabulario de la marca', async () => {
    const { palabraProhibida } = await import('../src/contenido/vocabulario')
    const despues = clon(marca)
    despues.anaquel.titulo = 'Otro'
    expect(palabraProhibida(frase(resume(marca, despues, esquemaSitio)))).toBeNull()
  })
})
