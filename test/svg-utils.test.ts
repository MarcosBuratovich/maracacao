import { describe, it, expect } from 'vitest'
import { cargarSvg, idsDeGrupos, padreDe, hexUsados, atributosDeTrazo } from './svg-utils'

const doc = cargarSvg('test/fixtures/ejemplo.svg')

describe('svg-utils', () => {
  it('lista todos los ids de grupo', () => {
    expect(idsDeGrupos(doc).sort()).toEqual(['hijo-a', 'hijo-b', 'raiz'])
  })

  it('resuelve el grupo padre de un id', () => {
    expect(padreDe(doc, 'hijo-a')).toBe('raiz')
    expect(padreDe(doc, 'raiz')).toBeNull()
  })

  it('junta los hex de fill y stroke, normalizados', () => {
    expect(hexUsados(doc).sort()).toEqual(['#5B744B', '#F8B465'])
  })

  it('lee los atributos de trazo', () => {
    expect(atributosDeTrazo(doc)).toEqual([
      { id: 'hijo-a', width: '4', cap: 'round' },
    ])
  })
})
