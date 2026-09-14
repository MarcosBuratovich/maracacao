/*
 * Tarea 7: la ilustración del anaquel (el <figure class="ficha-ilustracion">
 * de la ficha) solo se renderiza cuando el sabor tiene un dibujo de
 * verdad en `public/sitio/marca/`. Hoy los quince lo tienen —
 * `test/sitio.test.ts` prueba esa mitad, sobre el sabor de arranque
 * real— así que este archivo fabrica la otra mitad: un sabor SIN
 * ilustración, sin tener que borrar un archivo del repo.
 *
 * `vi.mock` es por archivo (ver `test/plantilla-vacios.test.ts`), así que
 * esta mentira sobre `src/lib/ilustraciones` vive sola acá y no le pisa
 * los datos reales a ningún otro test.
 */
import { describe, it, expect, vi } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'

// El sabor de arranque (canela, hoy) queda SIN ilustración; el resto, con.
vi.mock('@/lib/ilustraciones', () => ({
  tieneIlustracion: (slug: string) => slug !== 'canela',
}))

import Borrador from '@/pages/index.astro'
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'

const container = await AstroContainer.create()

describe('la ilustración condicional del anaquel (Tarea 7)', () => {
  it('sabor de arranque sin dibujo: el <figure> sale con hidden y sin un src roto', async () => {
    const inicial = sabores.find((s) => s.clave === marca.anaquel.saborInicial)!
    // El mock apaga justo el slug del sabor de arranque real: si algún
    // día `anaquel.saborInicial` deja de ser canela, este test lo dice
    // acá en vez de fallar más abajo por una razón que no es la suya.
    expect(inicial.slug).toBe('canela')

    const html = await container.renderToString(Borrador)
    const bloque = html.match(/<figure class="ficha-ilustracion"[^>]*>[\s\S]*?<\/figure>/)
    expect(bloque).not.toBeNull()
    expect(bloque![0]).toMatch(/^<figure class="ficha-ilustracion" hidden/)
    // Sin `src` roto: cuando el sabor no tiene dibujo, la plantilla no
    // debe emitir el atributo (ni vacío, ni apuntando a un .webp que no
    // existe).
    expect(bloque![0]).not.toMatch(/<img[^>]*\ssrc=/)
  })

  it('datos-anaquel: "ilustracion":false solo para el sabor sin dibujo', async () => {
    const html = await container.renderToString(Borrador)
    const crudo = html.match(
      /<script type="application\/json" id="datos-anaquel">([\s\S]*?)<\/script>/,
    )![1]
    const datos: Array<{ slug: string; ilustracion: boolean }> = JSON.parse(crudo)
    expect(datos).toHaveLength(sabores.length)

    const sinDibujo = datos.filter((d) => !d.ilustracion)
    expect(sinDibujo.map((d) => d.slug)).toEqual(['canela'])
    expect(datos.filter((d) => d.ilustracion)).toHaveLength(sabores.length - 1)
  })
})
