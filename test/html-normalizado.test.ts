import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseHTML } from 'linkedom'
import { normaliza } from './lib/html-normalizado'

const env = (cuerpo: string) => `<html><head></head><body>${cuerpo}</body></html>`

describe('el normalizador de HTML de la fase 2', () => {
  it('borra data-campo y data-campo-attr, y deja el resto igual', () => {
    const antes = env('<p class="mono">Hola</p>')
    const despues = env('<p class="mono" data-campo="hero.sub">Hola</p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
  })

  it('desenvuelve el span que la fase 2 inventó', () => {
    // El caso de index.astro:317 — «Ingredientes: cacao.» es un solo nodo
    // de texto hoy, y marcar la etiqueta obliga a envolverla.
    const antes = env('<p>Ingredientes: cacao.</p>')
    const despues = env('<p><span data-campo="anaquel.ingredientesEtiqueta">Ingredientes</span>: cacao.</p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
  })

  it('NO desenvuelve un span que ya existía, aunque le pongan data-campo', () => {
    // Si lo desenvolviera, la fase 2 podría borrar un <span class="mono">
    // de verdad y el verificador no lo vería.
    const antes = env('<p><span class="mono">$108</span></p>')
    const despues = env('<p><span class="mono" data-campo="minis.precio">$108</span></p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
    expect(normaliza(despues)).toContain('class="mono"')
  })

  it('ve un cambio de contenido de verdad', () => {
    // La razón de ser del verificador: que NO sea un espejo.
    const antes = env('<p>Hola</p>')
    const despues = env('<p data-campo="x">Chau</p>')
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })

  it('ve un elemento borrado, aunque le hayan puesto data-campo al vecino', () => {
    const antes = env('<p>Uno</p><p>Dos</p>')
    const despues = env('<p data-campo="a">Uno</p>')
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })
})

describe('el supuesto que hace exacta la regla del span', () => {
  it('el HTML de hoy no tiene ni un span sin atributos', () => {
    // Si esto deja de ser cierto, el normalizador se vuelve ciego a que la
    // fase 2 borre un span pelado preexistente — porque lo desenvolvería
    // en los dos lados. [MEDIDO hoy: 248 spans, los 248 con atributos.]
    const paginas = ['dist/index.html', 'dist/404.html', 'dist/fichas-tecnicas/index.html']
    if (!existsSync(paginas[0]) && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    for (const p of paginas) {
      const { document } = parseHTML(readFileSync(p, 'utf8'))
      const pelados = [...document.querySelectorAll('span')].filter((s) => s.attributes.length === 0)
      expect(pelados.map((s) => s.outerHTML), p).toEqual([])
    }
  })
})

describe('el HTML renderizado, contra la foto de antes de la fase 2', () => {
  // Es el verificador de toda la fase. Cada tarea que cambie el HTML a
  // propósito lo pone rojo, y ahí hay que leer el diff y recapturar en el
  // mismo commit, explicando qué cambió. Esa fricción es el punto: sin
  // ella, el verificador se vuelve un espejo.
  it('las once páginas son idénticas salvo lo que la fase 2 puede agregar', () => {
    const dir = 'test/fixtures/html-antes-fase-2'
    if (!existsSync('dist/index.html') && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    expect(existsSync('dist/index.html')).toBe(true)
    for (const archivo of readdirSync(dir).sort()) {
      const enDist = 'dist/' + archivo.replace(/__/g, '/')
      expect(existsSync(enDist), `${archivo} ya no se construye`).toBe(true)
      expect(normaliza(readFileSync(enDist, 'utf8')), archivo)
        .toBe(normaliza(readFileSync(join(dir, archivo), 'utf8')))
    }
  })
})
