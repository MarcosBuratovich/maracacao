import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { loadRenderers } from 'astro:container'
import { getContainerRenderer } from '@astrojs/react/container-renderer'
import { cargarSvg } from './svg-utils'
import { PIVOTES } from '@/assets/brand/jerarquia'
import Mascota from '@/components/brand/Mascota.astro'

const spec = readFileSync('docs/rig-spec.md', 'utf8')
const tsx = readFileSync('src/components/brand/MascotaRive.tsx', 'utf8')

describe('rig-spec.md', () => {
  it.each(Object.keys(PIVOTES))('documenta el pivote de #%s', (id) => {
    expect(spec).toContain(`#${id}`)
  })

  it('lista las coordenadas reales de cada marcador', () => {
    const doc = cargarSvg('src/assets/brand/mascota.svg')
    for (const id of Object.keys(PIVOTES)) {
      const el = doc.querySelector(`[id="piv-${id}"]`)!
      expect(spec).toContain(`${el.getAttribute('cx')}, ${el.getAttribute('cy')}`)
    }
  })

  it('documenta los cuatro inputs de la state machine', () => {
    for (const input of ['hover', 'scrollY', 'celebrar', 'banda']) {
      expect(spec).toContain(input)
    }
  })

  it('documenta los cuatro estados', () => {
    for (const estado of ['Idle', 'Saluda', 'Come', 'Celebra']) {
      expect(spec).toContain(estado)
    }
  })

  it('avisa que la capa de pivotes se borra después de alinear', () => {
    expect(spec).toMatch(/borra|eliminar/i)
  })

  it('avisa explícitamente que #mano-l se reemparenta al hueso de brazo-l en Rive', () => {
    // Ledger: JERARQUIA reporta a #mano-l colgando de #mono (es el orden de
    // pintado, no el esqueleto). Si el rig-spec no lo dice en un lugar
    // imposible de saltear, el rigger cuelga la mano de #mono en Rive y el
    // brazo queda sin mano al moverse.
    expect(spec).toMatch(/mano-l/)
    expect(spec).toMatch(/brazo-l/)
    expect(spec).toMatch(/reempare|re-empare/i)
  })
})

describe('MascotaRive', () => {
  it('no monta bajo prefers-reduced-motion', () => {
    // Sigue siendo grep: prefers-reduced-motion es una media query que se
    // evalúa en un efecto de React que solo corre en el navegador (ver el
    // comentario en MascotaRive.tsx) — el harness de test no tiene DOM real
    // con matchMedia significativo, así que no hay forma de ejercitar las
    // dos ramas (reduced-motion sí/no) con un render real acá. El grep sigue
    // siendo la cobertura honesta para esto.
    expect(tsx).toContain('prefers-reduced-motion')
  })

  it('no importa Rive en el módulo de nivel superior de Astro', () => {
    const astro = readFileSync('src/components/brand/Mascota.astro', 'utf8')
    expect(astro).not.toContain('@rive-app')
    expect(astro).toContain('client:visible')
  })
})

// Fix B3 (review final, Important): "parte del fallback y solo reemplaza
// cuando el .riv cargó" vivía como grep sobre el texto fuente
// (`/riveLoaded|isLoaded|hasLoaded/`), que solo prueba que la palabra existe
// en el archivo — no que la isla realmente renderiza el fallback. La razón
// por la que no había un render real: `AstroContainer.create()` sin más no
// trae ningún renderer de framework registrado, así que intentar montar
// `<Mascota rive />` (que monta `MascotaRive`, una isla de React) tiraba
// "Unable to render ... No renderer installed". El mecanismo correcto —
// investigado acá, no en vitest.config.ts — es cargar el renderer de
// `@astrojs/react` explícitamente con `loadRenderers` (que resuelve el
// módulo virtual `astro:container`, disponible porque `vitest.config.ts` ya
// usa `getViteConfig`, que arma el mismo Vite config que `astro dev`/`build`
// e incluye el plugin que expone ese módulo) y pasarlo a
// `AstroContainer.create({ renderers })`. No hizo falta tocar
// `vitest.config.ts`: el registro del renderer es responsabilidad de quien
// crea el container, no de la config global de Vite/Vitest.
describe('<Mascota rive /> — render real de la isla (B3)', () => {
  it('monta la isla con el fallback dimensionado adentro (no un <canvas> — SSR nunca corre el efecto de Rive)', async () => {
    const renderers = await loadRenderers([getContainerRenderer()])
    const container = await AstroContainer.create({ renderers })
    const html = await container.renderToString(Mascota, { props: { rive: true, class: 'h-40' } })

    // La isla de React está presente en el HTML servido (client:visible la
    // hidrata recién en el navegador cuando entra en viewport; esto prueba
    // que el SSR la produce, no que se hidrata).
    expect(html).toContain('astro-island')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Mono de Maracacao"')

    // "Parte del fallback": en SSR el efecto que decide `permitido` (y por
    // lo tanto `riveLoaded`) nunca corre, igual que en el primer paint real
    // del navegador antes de que el useEffect dispare — así que lo que se
    // sirve es el SVG estático width/height 100%, nunca un <canvas> de Rive.
    expect(html).toMatch(/<svg[^>]*\swidth="100%"[^>]*\sheight="100%"/)
    expect(html).not.toContain('<canvas')

    // Fix de tamaño (Task 17 vuelto a pagar): el wrapper y el contenedor del
    // fallback llevan aspect-ratio:1/1 — sin esto vuelve el bug 696×696/0×0.
    const ocurrencias = html.match(/aspect-ratio:1\/1/g) ?? []
    expect(ocurrencias.length).toBeGreaterThanOrEqual(2)
  })
})
