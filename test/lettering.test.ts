import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const ARCHIVOS = {
  logotipo: { ruta: 'src/assets/brand/logotipo.svg', letras: 9 },
  arco: { ruta: 'src/assets/brand/logotipo-arco.svg', letras: 9 },
  descriptor: { ruta: 'src/assets/brand/descriptor.svg', letras: 17 },
} as const

describe.each(Object.entries(ARCHIVOS))('%s', (_nombre, { ruta, letras }) => {
  const doc = cargarSvg(ruta)

  it('no usa <text> — es lettering, no tipografía', () => {
    expect(doc.querySelector('text')).toBeNull()
    expect(doc.querySelector('textPath')).toBeNull()
  })

  it(`tiene exactamente ${letras} letras, numeradas con padding`, () => {
    const ids = [...doc.querySelectorAll('[id^="letra-"]')].map((e) => e.getAttribute('id')!)
    expect(ids).toHaveLength(letras)
    for (const id of ids) expect(id).toMatch(/^letra-\d{2}$/)
    expect(new Set(ids).size).toBe(letras)
  })

  it('cada letra es un path', () => {
    for (const el of doc.querySelectorAll('[id^="letra-"]')) {
      expect(el.tagName.toLowerCase()).toBe('path')
    }
  })

  it('declara viewBox', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/)
  })

  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('logotipo recto vs arco', () => {
  it('los dos deletrean las mismas 9 letras en el mismo orden', () => {
    const ids = (ruta: string) =>
      [...cargarSvg(ruta).querySelectorAll('[id^="letra-"]')].map((e) => e.getAttribute('id'))
    expect(ids(ARCHIVOS.logotipo.ruta)).toEqual(ids(ARCHIVOS.arco.ruta))
  })
})
