/*
 * `/panel` (Tarea 1, fase 6): la cáscara estática con la isla React.
 *
 * Mismo mecanismo que `test/rive.test.ts` usa para `<Mascota rive />`
 * (léelo, es el precedente: `AstroContainer.create()` sin más no trae
 * ningún renderer de framework registrado, así que hace falta cargar el
 * de `@astrojs/react` a mano con `loadRenderers`). La diferencia con esa
 * suite es el punto entero de esta página: `client:only="react"` hace que
 * la isla NUNCA se renderice en el servidor —a diferencia de
 * `client:visible`, que si deja algo server-rendered—, así que lo único
 * que puede afirmar un render real acá es que el `<astro-island>` quedó
 * bien armado (apuntando al componente correcto, con `client="only"` y el
 * renderer de React), nunca su contenido — eso lo cubre
 * `test/panel-app.test.ts`, sin DOM, por la misma razón que ese archivo
 * documenta.
 */
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { loadRenderers } from 'astro:container'
import { getContainerRenderer } from '@astrojs/react/container-renderer'
import Panel from '@/pages/panel/index.astro'
import { jergaEn } from '@/servidor/estado'

async function renderiza(): Promise<string> {
  const renderers = await loadRenderers([getContainerRenderer()])
  const container = await AstroContainer.create({ renderers })
  return container.renderToString(Panel)
}

describe('/panel — la cáscara', () => {
  it('sin candado: no lleva `data-candado` en ningún lado', async () => {
    const html = await renderiza()
    expect(html).not.toContain('data-candado')
  })

  it('[G] tiene su propio meta robots, además de la cabecera de vercel.json', async () => {
    const html = await renderiza()
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow"/)
  })

  it('tiene título', async () => {
    const html = await renderiza()
    expect(html).toMatch(/<title>[^<]+<\/title>/)
  })

  it('monta la isla con `client:only="react"` — nunca `load`/`idle`/`visible`/`media`', async () => {
    const html = await renderiza()
    expect(html).toContain('<astro-island')
    expect(html).toMatch(/\bclient="only"/)
    // El nombre del framework viaja en `opts`, no en el atributo `client`
    // (ese solo dice "only") — sin esto, un cambio a `client:only="vue"`
    // (o cualquier otro framework) pasaría este test igual.
    expect(html).toMatch(/opts="[^"]*&quot;value&quot;:&quot;react&quot;/)
    for (const otra of ['client="load"', 'client="idle"', 'client="visible"', 'client="media"']) {
      expect(html).not.toContain(otra)
    }
  })

  it('la isla apunta al componente del panel, no a otra cosa', async () => {
    const html = await renderiza()
    expect(html).toMatch(/component-url="[^"]*panel\/App"/)
  })

  it('`client:only` nunca renderiza nada adentro del `<astro-island>` en el servidor — no hay ningún formulario que un curioso pueda leer sin JS', async () => {
    const html = await renderiza()
    const adentro = html.match(/<astro-island[^>]*>([\s\S]*?)<\/astro-island>/)?.[1] ?? '¿no se encontró la isla?'
    expect(adentro.trim()).toBe('')
  })

  it('ningún texto visible de la cáscara (el título) usa jerga técnica', async () => {
    const html = await renderiza()
    const titulo = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
    expect(titulo).not.toBe('')
    expect(jergaEn(titulo)).toBeNull()
  })
})
