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

// Fix 1/5 — Hallazgos 1 y 2 del review: hexUsados no encontraba hex de 3/4/8
// dígitos, y además leía innerHTML crudo como texto plano, lo que la hacía
// confundir un selector de ID (`#cafe00 { ... }`) o un comentario con un
// color real. Los tests de acá son adversariales a propósito: cada uno
// describe un caso que rompía la versión anterior.
describe('hexUsados — casos adversariales', () => {
  const doc = cargarSvg('test/fixtures/hex-hostil.svg')
  const hex = hexUsados(doc)

  it('expande un hex de 3 dígitos a 6, en mayúsculas (#abc -> #AABBCC)', () => {
    expect(hex).toContain('#AABBCC')
  })

  it('conserva un hex de 8 dígitos (con alfa) tal cual, en mayúsculas', () => {
    expect(hex).toContain('#11223344')
  })

  it('conserva un hex de 4 dígitos (con alfa) tal cual, ya en mayúsculas', () => {
    expect(hex).toContain('#ABCD')
  })

  it('normaliza a mayúsculas sin importar el casing de origen', () => {
    expect(hex).toContain('#F8B465') // venía de style inline en minúsculas
    expect(hex).toContain('#5B744B') // venía de stop-color en minúsculas
  })

  it('encuentra hex en un atributo style inline', () => {
    expect(hex).toContain('#F8B465')
  })

  it('encuentra hex en un stop-color', () => {
    expect(hex).toContain('#5B744B')
  })

  it('encuentra hex del lado derecho de una declaración dentro de <style>', () => {
    // Único valor de todo el fixture que solo aparece vía regla de clase
    // (.marca { fill: #123abc }) — si hexUsados no mirara <style>, faltaría.
    expect(hex).toContain('#123ABC')
  })

  it('ignora un selector de ID que parece hex (#cafe00 { display: none })', () => {
    expect(hex).not.toContain('#CAFE00')
  })

  it('ignora hex dentro de un comentario CSS, dentro de <style>', () => {
    expect(hex).not.toContain('#FF0000')
  })

  it('ignora hex dentro de un comentario HTML', () => {
    expect(hex).not.toContain('#DEAD00')
  })

  it('la lista completa es exactamente la esperada, sin sorpresas', () => {
    expect(hex.sort()).toEqual([
      '#11223344', '#123ABC', '#5B744B', '#AABBCC', '#ABCD', '#F8B465',
    ])
  })
})

// Fix 1/5 — Hallazgo 3 del review: atributosDeTrazo no resolvía stroke-width
// ni stroke-linecap cuando venían de una clase CSS en <style> (el patrón que
// usa el propio plan para poder ajustarlos en un solo lugar), y devolvía id
// como '' en vez de null cuando el trazo no cuelga de ningún g[id].
describe('atributosDeTrazo — resolución por clase y centinela de id', () => {
  const doc = cargarSvg('test/fixtures/trazo-clase.svg')

  it('resuelve width/cap por clase, gana el atributo sobre la clase cuando están los dos, y usa null cuando no hay g[id] contenedor', () => {
    expect(atributosDeTrazo(doc)).toEqual([
      // Solo clase (.t-por-clase): sin stroke-width/cap como atributo.
      { id: 'grupo-por-clase', width: '11', cap: 'square' },
      // Clase Y atributo presentes (.t-mixta da 9/butt, el atributo da
      // 4/round): gana el atributo, como la cascada real.
      { id: 'grupo-por-atributo', width: '4', cap: 'round' },
      // Mismo path que el primero (solo clase), pero sin ningún g[id]
      // ancestro: el id tiene que ser null, no ''.
      { id: null, width: '11', cap: 'square' },
    ])
  })
})
