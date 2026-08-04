/*
 * Task 19 — suite de aceptación final contra los ocho criterios del §13
 * del spec (`docs/superpowers/specs/2026-08-03-maracacao-identidad-design.md`).
 *
 * Este archivo NO reemplaza los tests de cada tarea de dibujo — los
 * complementa. Los criterios 1, 4, 5 y 8 tienen un chequeo estructural
 * que se puede automatizar y vive acá. Los criterios 2, 3, 6 y 7 no se
 * automatizan (requieren mirar un render, correr un servidor o leer
 * prosa como un lector externo) y su veredicto vive en
 * `task-19-report.md`, citando la evidencia automatizada o de review que
 * ya existe para cada uno.
 *
 * Nada de lo de acá hardcodea un conteo (de colores, de pares de
 * contraste, de grupos): todo se deriva de `todosLosColores()`,
 * `paresAprobados` y `JERARQUIA`, que son la fuente de verdad real. Así
 * la suite no se desactualiza cuando la paleta o el contrato crecen — la
 * rampa `rosa` (Task 7) ya subió el conteo de colores de 26 a 36 sin que
 * hiciera falta tocar un solo número acá.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { cargarSvg, idsDeGrupos, hexUsados } from './svg-utils'
import { JERARQUIA } from '@/assets/brand/jerarquia'
import { paresAprobados, todosLosColores } from '@/tokens/color'
import { contrastRatio } from '@/tokens/contrast'

describe('criterio 1 — el SVG importa limpio a Rive', () => {
  const doc = cargarSvg('src/assets/brand/mascota.svg')
  it('todos los grupos del contrato existen con su nombre exacto', () => {
    const ids = idsDeGrupos(doc)
    for (const { id } of JERARQUIA) expect(ids).toContain(id)
  })
  // La jerarquía completa (padre-hijo, sin grupos de más, pivotes) ya la
  // verifica `test/mascota-estructura.test.ts` contra este mismo
  // contrato — no se repite acá para no duplicar 30 asserts; este test
  // es el smoke check final de que el contrato y el SVG siguen en sync.
})

describe('criterio 4 — un solo lugar define los colores', () => {
  it('el CSS generado sale de los tokens', () => {
    const css = readFileSync('src/styles/tokens.generated.css', 'utf8')
    for (const hex of todosLosColores()) expect(css).toContain(hex)
  })
  it('ningún SVG de marca tiene colores fuera del sistema', () => {
    const permitidos = todosLosColores()
    for (const n of ['mascota', 'mascota-reducida', 'logotipo', 'logotipo-arco', 'descriptor']) {
      const rogue = hexUsados(cargarSvg(`src/assets/brand/${n}.svg`))
        .filter((c) => !permitidos.includes(c))
      expect({ archivo: n, rogue }).toEqual({ archivo: n, rogue: [] })
    }
  })
})

describe('criterio 5 — todos los pares de texto cumplen 4.5:1', () => {
  it.each(paresAprobados.filter((p) => p.minimo === 'AA' || p.minimo === 'AAA'))(
    '$uso', ({ frente, fondo }) => {
      expect(contrastRatio(frente, fondo)).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('criterio 8 — reduced-motion apaga todo', () => {
  it('el CSS global y el de la mascota lo contemplan', () => {
    for (const ruta of ['src/styles/global.css', 'src/styles/mascota-ambiental.css']) {
      expect(readFileSync(ruta, 'utf8')).toMatch(/prefers-reduced-motion:\s*reduce/)
    }
  })
})

describe('las referencias están versionadas', () => {
  it.each(['docs/referencias/packaging-foto.jpg', 'docs/referencias/render-limpio.png'])(
    '%s existe', (r) => expect(existsSync(r)).toBe(true),
  )
})
