/*
 * Los dos componentes cuyo nodo de texto vive adentro: desde la página no
 * se puede marcar, así que reciben la ruta por prop.
 *
 * Se renderizan de verdad (container de Astro), no se les lee el fuente:
 * lo que importa es en QUÉ nodo termina el atributo.
 */
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Insignia from '@/components/marca/Insignia.astro'
import EtiquetaSabor from '@/components/marca/EtiquetaSabor.astro'

const container = await AstroContainer.create()

describe('los componentes que reciben la ruta del campo', () => {
  it('Insignia pone data-campo en el span que muestra el texto', async () => {
    const html = await container.renderToString(Insignia, {
      props: { tono: 'cacao', campo: 'sitio:postura.chips.0' },
      slots: { default: 'SIN AZÚCAR REFINADA' },
    })
    expect(html).toMatch(/<span[^>]*data-campo="sitio:postura\.chips\.0"[^>]*>/)
    expect(html).toContain('SIN AZÚCAR REFINADA')
  })

  it('Insignia sin campo no agrega el atributo (el HTML de hoy no cambia)', async () => {
    const html = await container.renderToString(Insignia, {
      props: { tono: 'cacao' },
      slots: { default: 'SIN AZÚCAR REFINADA' },
    })
    expect(html).not.toContain('data-campo')
  })

  it('EtiquetaSabor pone data-campo en el span del texto, no en el envoltorio', async () => {
    const html = await container.renderToString(EtiquetaSabor, {
      props: { texto: 'LO QUE LLEVA', campo: 'sitio:postura.kicker' },
    })
    expect(html).toMatch(/<span class="texto"[^>]*data-campo="sitio:postura\.kicker"[^>]*>LO QUE LLEVA<\/span>/)
  })

  it('EtiquetaSabor sin campo no agrega el atributo', async () => {
    const html = await container.renderToString(EtiquetaSabor, { props: { texto: 'LO QUE LLEVA' } })
    expect(html).not.toContain('data-campo')
  })
})
