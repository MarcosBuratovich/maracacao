/*
 * El historial es git leído en las palabras de la clienta: el asunto de cada
 * commit ES el resumen que ella vio antes de publicar (`frase()`), así que
 * acá no se traduce nada — se filtra, se parte y se ordena.
 */
import { describe, it, expect } from 'vitest'
import { lee } from '../src/servidor/historial'

const commit = (sha: string, mensaje: string, fecha = '2026-09-17T12:00:00Z') => ({ sha, mensaje, fecha })

describe('el historial que ve la clienta', () => {
  it('solo trae lo que publicó el panel: lo de Marcos no es su historial', () => {
    const r = lee([
      commit('c1', 'cambia Línea de cierre\n\nPanel: sí\nPanel-Autor: ella@x.mx'),
      commit('c2', 'fix: acomoda el hero en el celular'),
    ], 0)
    expect(r.map((p) => p.sha)).toEqual(['c1'])
  })

  it('el resumen es el asunto, y el autor sale del trailer', () => {
    const [p] = lee([commit('c1', 'cambia Línea de cierre\n\nPanel: sí\nPanel-Autor: ella@x.mx')], 0)
    expect(p.resumen).toBe('cambia Línea de cierre')
    expect(p.autor).toBe('ella@x.mx')
  })

  it('una reversión se ve como tal, y dice a qué revirtió', () => {
    // Si el historial no lo dijera, «cambia Línea de cierre» y su deshacer se
    // verían como dos cambios distintos del mismo campo, que es confuso justo
    // en el momento en que ella está tratando de entender qué pasó.
    const [p] = lee([commit('c1', 'Deshace un cambio\n\nPanel: sí\nPanel-Autor: ella@x.mx\nPanel-Revierte: abc')], 0)
    expect(p.revierteA).toBe('abc')
  })

  it('un commit del panel sin trailer de autor no rompe: el autor queda en null', () => {
    const [p] = lee([commit('c1', 'algo\n\nPanel: sí')], 0)
    expect(p.autor).toBeNull()
  })

  it('no reordena: devuelve lo que vino, en el mismo orden (la API ya los da del más nuevo al más viejo)', () => {
    const r = lee([
      commit('c3', 'cambia C\n\nPanel: sí'),
      commit('c1', 'cambia A\n\nPanel: sí'),
      commit('c2', 'cambia B\n\nPanel: sí'),
    ], 0)
    expect(r.map((p) => p.sha)).toEqual(['c3', 'c1', 'c2'])
  })
})
