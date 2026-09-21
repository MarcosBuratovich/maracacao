/*
 * `src/panel/aparato.ts`: el id de aparato del panel. Mismas propiedades
 * que el helper equivalente ya prueba en `test/entrar-astro.test.ts`
 * (I7) — acá se prueban directo sobre la función, con un almacén de
 * mentira inyectado, en vez de correr un `<script>` completo.
 */
import { describe, it, expect } from 'vitest'
import { idDeAparato } from '@/panel/aparato'

/** Un `Storage` de mentira mínimo — mismo criterio que `almacenDeMentira()` de `test/entrar-astro.test.ts`. */
function almacenDeMentira(mapa: Map<string, string> = new Map(), rompe = false) {
  return {
    getItem: (k: string) => {
      if (rompe) throw new Error('almacenamiento bloqueado')
      return mapa.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (rompe) throw new Error('almacenamiento bloqueado')
      mapa.set(k, v)
    },
  }
}

describe('idDeAparato', () => {
  it('el mismo almacén, dos llamadas: el MISMO id', () => {
    const almacen = almacenDeMentira()
    const primero = idDeAparato(almacen)
    const segundo = idDeAparato(almacen)
    expect(segundo).toBe(primero)
  })

  it('dos almacenes distintos: ids DISTINTOS', () => {
    const a = idDeAparato(almacenDeMentira())
    const b = idDeAparato(almacenDeMentira())
    expect(a).not.toBe(b)
  })

  it('el id cae en el alfabeto que `idDeDispositivo()` del servidor deja pasar intacto (letras, números, guion, guion bajo)', () => {
    const id = idDeAparato(almacenDeMentira())
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('nunca es "sin-nombre" — ese es el id compartido que el servidor usa para "no me lo dijiste"', () => {
    const id = idDeAparato(almacenDeMentira())
    expect(id).not.toBe('sin-nombre')
  })

  it('con el almacenamiento bloqueado (modo privado): igual devuelve un id propio, no tira', () => {
    const id = idDeAparato(almacenDeMentira(new Map(), true))
    expect(id).toBeTruthy()
    expect(id).toMatch(/^aparato-/)
  })

  it('con el almacenamiento bloqueado, dos llamadas dan ids DISTINTOS — perder la estabilidad es aceptable, compartir el id no', () => {
    const almacen = almacenDeMentira(new Map(), true)
    const a = idDeAparato(almacen)
    const b = idDeAparato(almacen)
    expect(a).not.toBe(b)
  })

  it('sin almacén (el `localStorage` por defecto, ausente en este entorno de test): igual devuelve un id, sin tirar', () => {
    // Node no tiene `localStorage` global salvo que algo lo agregue — este
    // es justo el camino que ejercita el valor por defecto del parámetro
    // (`globalThis.localStorage`), no el almacén inyectado de los tests de
    // arriba. Si el `try/catch` de `idDeAparato` se sacara, esto tira un
    // `TypeError` y el test lo vería.
    const id = idDeAparato()
    expect(id).toMatch(/^aparato-/)
  })
})
