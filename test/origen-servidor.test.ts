/*
 * La lista de orígenes que comparten las funciones serverless.
 *
 * El test importa el MISMO módulo que importa `src/servidor/entradas/
 * contacto.ts`: si alguien agrega un dominio en un lado y se olvida del
 * otro, acá no se nota — pero tampoco puede pasar, porque hay un solo lado.
 * (Hasta la Tarea 1 de la fase 5 parte A esta lista vivía duplicada en
 * `api/contacto.ts`, y este archivo tenía un segundo describe que exigía
 * que las dos copias dijeran lo mismo. Con esbuild empaquetando la función
 * desde una única fuente, esa copia dejó de existir y el test de sincronía
 * se borró: no hay nada que sincronizar cuando hay una sola lista.)
 */
import { describe, it, expect } from 'vitest'
import { origenPermitido, ORIGENES_PERMITIDOS } from '../src/servidor/origen'

describe('los orígenes que pueden pedirle a una función nuestra', () => {
  it('acepta los dominios propios y los de desarrollo', () => {
    for (const origen of ORIGENES_PERMITIDOS) expect(origenPermitido(origen)).toBe(true)
  })

  it('acepta un preview de Vercel, que cambia de subdominio en cada deploy', () => {
    expect(origenPermitido('https://maracacao-git-prueba-abc123.vercel.app')).toBe(true)
  })

  it('rechaza cualquier otro origen, incluido un parecido', () => {
    // El modo de falla que ataja: un dominio que TERMINA en el nuestro
    // («maracacao.mx.malo.com») o que lo lleva de prefijo.
    expect(origenPermitido('https://maracacao.mx.malo.com')).toBe(false)
    expect(origenPermitido('https://malo.com')).toBe(false)
    expect(origenPermitido('http://www.maracacao.mx')).toBe(false)
    expect(origenPermitido('')).toBe(false)
  })

  it('rechaza un subdominio de vercel.app que no sea un preview plano', () => {
    expect(origenPermitido('https://algo.maracacao.vercel.app')).toBe(false)
  })
})
