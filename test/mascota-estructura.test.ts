import { describe, it, expect } from 'vitest'
import { cargarSvg, idsDeGrupos, padreDe, hexUsados } from './svg-utils'
import { JERARQUIA, PIVOTES } from '@/assets/brand/jerarquia'
import { todosLosColores } from '@/tokens/color'
import { readFileSync } from 'node:fs'

const RUTA = 'src/assets/brand/mascota.svg'
const doc = cargarSvg(RUTA)
const fuente = readFileSync(RUTA, 'utf8')

describe('mascota.svg — estructura', () => {
  it('declara el viewBox del spec', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1024 1024')
  })

  it.each(JERARQUIA)('existe el grupo #$id', ({ id }) => {
    expect(idsDeGrupos(doc)).toContain(id)
  })

  it.each(JERARQUIA)('#$id cuelga de $padre', ({ id, padre }) => {
    expect(padreDe(doc, id)).toBe(padre)
  })

  it('no hay grupos de más', () => {
    const declarados = JERARQUIA.map((g) => g.id) as readonly string[]
    const sobrantes = idsDeGrupos(doc).filter(
      (id) => !declarados.includes(id) && !id.startsWith('piv-') && !id.startsWith('grano-'),
    )
    expect(sobrantes).toEqual([])
  })
})

describe('mascota.svg — restricciones duras', () => {
  it('no usa <text>', () => expect(doc.querySelector('text')).toBeNull())
  it('no usa <use>', () => expect(doc.querySelector('use')).toBeNull())
  it('no usa gradientes', () => {
    expect(fuente).not.toMatch(/<(linear|radial)Gradient/i)
  })
  it('no usa filtros', () => expect(fuente).not.toMatch(/<filter\b/i))
  it('no usa <defs>', () => expect(doc.querySelector('defs')).toBeNull())
  it('no usa <image>', () => expect(doc.querySelector('image')).toBeNull())
})

describe('mascota.svg — paleta cerrada', () => {
  it('todo hex del archivo pertenece a los tokens', () => {
    const permitidos = todosLosColores()
    const rogue = hexUsados(doc).filter((c) => !permitidos.includes(c))
    expect(rogue).toEqual([])
  })
})

describe('mascota.svg — pivotes', () => {
  it.each(Object.keys(PIVOTES))('existe el marcador piv-%s', (id) => {
    expect(doc.querySelector(`[id="piv-${id}"]`)).not.toBeNull()
  })

  it('no hay marcadores huérfanos', () => {
    const marcadores = [...doc.querySelectorAll('[id^="piv-"]')]
      .map((el) => el.getAttribute('id')!.replace('piv-', ''))
    for (const m of marcadores) expect(Object.keys(PIVOTES)).toContain(m)
  })

  it('todos los marcadores viven dentro de #pivotes', () => {
    for (const el of doc.querySelectorAll('[id^="piv-"]')) {
      expect(el.closest('g[id="pivotes"]')).not.toBeNull()
    }
  })
})
