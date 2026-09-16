/*
 * La lista de orígenes que comparten las funciones serverless.
 *
 * El test importa el MISMO módulo que importa `api/contacto.ts`: si alguien
 * agrega un dominio en un lado y se olvida del otro, acá no se nota — pero
 * tampoco puede pasar, porque hay un solo lado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { origenPermitido, ORIGENES_PERMITIDOS, PREVIEW_DE_VERCEL } from '../src/servidor/origen'

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

describe('la copia duplicada en api/contacto.ts', () => {
  // POR QUÉ ESTÁN DUPLICADAS, y por qué este test existe:
  // [MEDIDO 2026-09-16, en producción] `api/contacto.ts` importando
  // '../src/servidor/origen' CONSTRUYE pero no arranca: la función muere con
  // FUNCTION_INVOCATION_FAILED porque el tracer de Vercel no se lleva el
  // archivo de afuera de api/ al paquete. Es la respuesta al experimento del
  // spec §4 y decide la arquitectura de la fase 5: hace falta un paso de
  // esbuild que arme funciones autocontenidas.
  //
  // Hasta que ese paso exista, la lista vive en dos lados. Este test es lo
  // único que impide que se separen — que es exactamente cómo un dominio
  // nuevo queda habilitado en una función y bloqueado en la otra.
  it('dice exactamente los mismos orígenes que src/servidor/origen.ts', () => {
    const fn = readFileSync('api/contacto.ts', 'utf8')
    const bloque = fn.match(/const ORIGENES_PERMITIDOS = \[([\s\S]*?)\]/)
    expect(bloque).not.toBeNull()
    const enLaFuncion = [...bloque![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(enLaFuncion).toEqual([...ORIGENES_PERMITIDOS])
  })

  it('usa el mismo patrón de preview de Vercel', () => {
    const fn = readFileSync('api/contacto.ts', 'utf8')
    // El patrón está escrito como literal de regex en la función. Se compara
    // lo que ese literal declara —no su texto— recortando entre el `/` que lo
    // abre y el `/.test(` que lo cierra: en el fuente las barras van
    // escapadas y en `.source` no.
    const abre = fn.indexOf('|| /') + '|| /'.length
    const cierra = fn.indexOf('/.test(origen)', abre)
    expect(abre).toBeGreaterThan(3)
    expect(cierra).toBeGreaterThan(abre)
    expect(fn.slice(abre, cierra)).toBe(PREVIEW_DE_VERCEL.source)
  })
})
