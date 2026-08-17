/*
 * Las fichas técnicas: la plantilla compartida (pnpm fichas y /fichas
 * renderizan lo mismo), la convención de texto editable, y el generador
 * en línea tras el candado.
 */
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { textoABloques, bloquesATexto, fichaHtml, type Bloque } from '@/fichas/plantilla'
import { fichasBase } from '@/fichas/base'
import Generador from '@/pages/fichas.astro'

const container = await AstroContainer.create()

describe('la convención de texto editable', () => {
  it('párrafos, listas y tablas van y vuelven sin perder nada', () => {
    const bloques: Bloque[] = [
      { tipo: 'parrafo', texto: 'Un párrafo cualquiera.' },
      { tipo: 'lista', items: ['Primero', 'Segundo'] },
      { tipo: 'tabla', encabezados: ['Nutrimento', 'Cantidad'], filas: [['Sodio', '13 mg']] },
    ]
    expect(textoABloques(bloquesATexto(bloques))).toEqual(bloques)
  })

  it('las DOS fichas oficiales sobreviven el viaje completo por el editor', () => {
    // Garantiza que lo que el cliente ve precargado en /fichas rinde el
    // mismo documento que el PDF oficial.
    for (const ficha of fichasBase) {
      for (const seccion of ficha.secciones) {
        expect(textoABloques(bloquesATexto(seccion.bloques))).toEqual(seccion.bloques)
      }
    }
  })

  it('el contenido del cliente se escapa: nada de HTML inyectado', () => {
    const html = fichaHtml(
      {
        archivo: 'x',
        producto: '<script>alert(1)</script>',
        denominacion: 'a & b',
        acento: '#7D0303',
        meta: [['K', '<b>v</b>']],
        secciones: [{ titulo: 'T', bloques: [{ tipo: 'parrafo', texto: '<img src=x>' }] }],
      },
      '/fonts',
      '<svg></svg>',
    )
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('el generador en línea (/fichas)', () => {
  it('está tras el candado, precargado con la ficha de barras', async () => {
    const html = await container.renderToString(Generador)
    expect(html).toContain('data-candado')
    expect(html).toContain(fichasBase[0].producto)
    expect(html).toContain('data-generador')
    expect(html).toContain('data-descargar')
    // Las secciones precargadas llevan la convención editable.
    expect(html).toContain('Licor de cacao, azúcar, manteca de cacao')
  })
})
