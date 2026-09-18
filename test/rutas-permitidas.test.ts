/*
 * La lista blanca de escritura. Defensa en profundidad: el PAT ya no tiene
 * permiso de Workflows, así que GitHub rechazaría solo un push a
 * .github/workflows/**. Esto lo para antes, y para además todo lo que el PAT
 * SÍ podría escribir y el panel no tiene por qué tocar.
 */
import { describe, it, expect } from 'vitest'
import { rutaPermitida, rutaDeBorradorPermitida, revisaLote, TOPE_ARCHIVOS, TOPE_CUERPO } from '../src/servidor/rutas-permitidas'

describe('qué rutas puede escribir el panel', () => {
  it('acepta los cuatro documentos de contenido', () => {
    for (const r of ['sitio', 'sabores', 'fichas', 'envolturas']) {
      expect(rutaPermitida(`src/contenido/datos/${r}.json`)).toBe(true)
    }
  })

  it('acepta las fotos de producto donde viven', () => {
    expect(rutaPermitida('public/sitio/marca/barra-canela.webp')).toBe(true)
    expect(rutaPermitida('public/sitio/envoltura/canela-frente.webp')).toBe(true)
    expect(rutaPermitida('public/sitio/etiqueta-morado.webp')).toBe(true)
  })

  it('rechaza lo que rompería el sitio o la compuerta', () => {
    for (const r of [
      '.github/workflows/verifica.yml',
      'package.json',
      'src/pages/index.astro',
      'api/panel.js',
      'src/contenido/esquema/sitio.ts',
      'vercel.json',
    ]) {
      expect(rutaPermitida(r)).toBe(false)
    }
  })

  it('rechaza las escapadas de directorio y los nombres raros', () => {
    for (const r of [
      'src/contenido/datos/../../../etc/passwd',
      'src/contenido/datos/Sitio.json',          // mayúscula: el repo es todo minúsculas
      'src/contenido/datos/sitio.json.bak',
      '/src/contenido/datos/sitio.json',          // absoluta
      'src/contenido/datos/sub/sitio.json',
      'public/sitio/marca/../../../package.json',
    ]) {
      expect(rutaPermitida(r)).toBe(false)
    }
  })
})

describe('la lista blanca del borrador es OTRA lista', () => {
  it('el borrador solo puede escribir su propio archivo', () => {
    expect(rutaDeBorradorPermitida('panel/borrador.json')).toBe(true)
    for (const r of ['src/contenido/datos/sitio.json', 'panel/otro.json', 'panel/borrador.json.bak', '../panel/borrador.json']) {
      expect(rutaDeBorradorPermitida(r), r).toBe(false)
    }
  })

  it('y la de main no acepta el archivo del borrador', () => {
    // Las dos listas son disjuntas a propósito: el borrador nunca tiene que
    // poder aparecer en el sitio publicado, ni un documento de contenido en
    // el ref del borrador.
    expect(rutaPermitida('panel/borrador.json')).toBe(false)
  })
})

describe('los topes del lote', () => {
  it('acepta un lote normal', () => {
    expect(revisaLote(['src/contenido/datos/sitio.json'], 40_000)).toEqual({ ok: true })
  })

  it('rechaza demasiados archivos, con un mensaje que la clienta entiende', () => {
    const muchas = Array.from({ length: TOPE_ARCHIVOS + 1 }, (_, i) => `public/sitio/marca/barra-${i}.webp`)
    const r = revisaLote(muchas, 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problema).toMatch(/demasiad/i)
      expect(r.problema).not.toMatch(/TOPE_ARCHIVOS|array|payload/i)
    }
  })

  it('rechaza un cuerpo más grande que el tope', () => {
    const r = revisaLote(['src/contenido/datos/sitio.json'], TOPE_CUERPO + 1)
    expect(r.ok).toBe(false)
  })

  it('rechaza el lote entero si UNA ruta no está permitida', () => {
    const r = revisaLote(['src/contenido/datos/sitio.json', 'package.json'], 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problema).toContain('package.json')
  })
})
