/*
 * El enlace mágico de recuperación (spec §4.1). Mismo mecanismo HMAC que
 * la cookie de sesión (`sesion.ts`), con su propio dominio (`entrar`, en
 * vez de `sesion`) metido adentro de lo que se firma — B7 es el test que
 * demuestra que esa separación es real, en las dos direcciones.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { firmaEnlace, verificaEnlace } from '../src/servidor/enlace'
import { firmaSesion, verificaSesion } from '../src/servidor/sesion'

const SECRETO = 'x'.repeat(40)
const QUINCE_MIN = 15 * 60_000

describe('el enlace de recuperación', () => {
  it('vale hasta su vencimiento y trae el correo', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaEnlace(t, SECRETO, 1_000)).toEqual({ correo: 'ella@ejemplo.mx' })
  })

  it('a los quince minutos deja de valer', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaEnlace(t, SECRETO, 1_000 + QUINCE_MIN + 1)).toBeNull()
  })

  it('B7: un token de enlace NO sirve como cookie de sesión', () => {
    // El mismo secreto firma las dos cosas. Sin el propósito ADENTRO de lo
    // que se firma, un enlace interceptado en una bandeja de entrada se pega
    // como cookie y ya está adentro — sin consumir el enlace, sin dejar
    // rastro, y para todo lo que dure la sesión, no quince minutos.
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaSesion(t, SECRETO, 1_000)).toBeNull()
  })

  it('B7: y una cookie de sesión no sirve como enlace', () => {
    const cookie = firmaSesion(
      { correo: 'ella@ejemplo.mx', vence: 9_000_000, dispositivo: 'celu', emitida: 1 },
      SECRETO,
    )
    expect(verificaEnlace(cookie, SECRETO, 1_000)).toBeNull()
  })

  it('un token con la firma cambiada no vale, aunque el correo sea el correcto', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    const [cuerpo] = t.split('.')
    expect(verificaEnlace(`${cuerpo}.firmaInventada`, SECRETO, 1_000)).toBeNull()
  })

  it('un secreto corto no firma ni verifica nada', () => {
    // Mismo candado que la sesión (C-1 de la Parte A): para HMAC, una clave
    // corta o vacía es indistinguible de no tener firma.
    expect(() => firmaEnlace('ella@ejemplo.mx', 1, 'corto')).toThrow()
    expect(verificaEnlace('lo.que.sea', 'corto', 1)).toBeNull()
  })

  it('un cuerpo que no tiene forma de CuerpoEnlace (correo o vence de otro tipo) no vale', () => {
    // Firmado a mano, con la misma mecánica que `firmaEnlace` pero con un
    // cuerpo que le falta `vence` — el caso que `esCuerpoEnlace()` existe
    // para cerrar: un `JSON.parse` que no falla no es lo mismo que un valor
    // con la forma correcta (mismo criterio que la Tarea 11 aplicó al
    // borrador).
    const cuerpo = Buffer.from(JSON.stringify({ correo: 'ella@ejemplo.mx' })).toString('base64url')
    const firma = createHmac('sha256', SECRETO).update(`entrar|${cuerpo}`).digest('base64url')
    expect(verificaEnlace(`${cuerpo}.${firma}`, SECRETO, 1_000)).toBeNull()
  })
})
