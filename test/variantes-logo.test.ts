import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import LockupHeader from '@/components/brand/LockupHeader.astro'
import SelloCircular from '@/components/brand/SelloCircular.astro'
import Logotipo from '@/components/brand/Logotipo.astro'
import IsotipoSuelto from '@/components/brand/IsotipoSuelto.astro'
import SelloCompleto from '@/components/brand/SelloCompleto.astro'
import SelloReducido from '@/components/brand/SelloReducido.astro'
import Monocromo from '@/components/brand/Monocromo.astro'
import { svgDeMarca } from '@/components/brand/svg-inline'
import { cargarSvg, atributosDeTrazo } from './svg-utils'

const container = await AstroContainer.create()

describe('LockupHeader', () => {
  it('inyecta el SVG inline, no como <img>', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('<svg')
    expect(html).not.toContain('<img')
  })

  it('usa var() de tokens en vez de hex crudos', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('var(--mrc-')
  })

  it('muestra el descriptor por defecto y lo oculta bajo 640px', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('descriptor')
    // la mitigación de §8 del spec
    expect(html).toMatch(/max-sm:hidden|hidden sm:block/)
  })

  it('lleva un aria-label en español', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toMatch(/aria-label="Maracacao[^"]*"/)
  })

  it('fija la altura de los tres SVG inyectados (no depende del tamaño por defecto del navegador)', async () => {
    // Ninguno de mascota-reducida/logotipo/descriptor trae width/height
    // propio. Sin fijarlo acá, el tamaño de reemplazo de un <svg> sin
    // medidas es indefinido entre navegadores y no responde al contenedor.
    const html = await container.renderToString(LockupHeader, { props: { alto: 44 } })
    expect(html).toMatch(/<svg[^>]*\sheight="44"/)
    expect(html).toMatch(/<svg[^>]*\sheight="22"/) // logotipo, 0.5 × 44
    expect(html).toMatch(/<svg[^>]*\sheight="13"/) // descriptor, 0.3 × 44
  })

  // Fix de integración (Task 17, ver el comentario en LockupHeader.astro).
  // El lettering de logotipo.svg/descriptor.svg trae fill crema fijo
  // (contraste ≈1.10 contra el papel — casi invisible sobre banda clara,
  // que es donde vive este header). Regresión: que no vuelva el crema
  // crudo y que el mecanismo currentColor + token de título siga ahí.
  //
  // Fix B1 (review final): la reescritura pasó de apuntar a la regla CSS
  // del <style> embebido (`fill: var(--mrc-crema, ...);`) a apuntar al
  // atributo de presentación de cada <path> (`fill="var(--mrc-crema, ...)"`)
  // — misma técnica que Monocromo.astro:16-17. El <style> de los tres SVG
  // de lettering ya no lleva ningún color, así que esas dos formas viejas
  // ya no pueden aparecer en absoluto.
  it('el lettering (logotipo/descriptor) usa currentColor, no el fill crema crudo', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).not.toContain('fill: var(--mrc-crema')
    expect(html).not.toContain('fill="var(--mrc-crema')
    expect(html).not.toContain('#F4E8C6')
    expect(html).not.toContain('fill: currentColor') // ya no es una regla CSS...
    expect(html).toContain('fill="currentColor"') // ...es un atributo por <path>
  })

  it('fija el color del lettering con el token de título sobre banda clara', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('color:var(--mrc-rol-texto-titulo)')
  })
})

// B1 (review final, Critical): los tres SVG de lettering traían su color en
// una regla CSS de clase (`.letra { fill: #F4E8C6; }`) dentro de un <style>
// embebido sin scopear. Al inlinear varios SVG en el mismo documento (como
// hace /manual/logo, que junta las 7 variantes), esos <style> aplican al
// documento entero — no al SVG que los trae. LockupHeader reescribe SU
// copia a `fill: currentColor`, y esa regla, por venir última en el
// documento y tener la misma especificidad que la de logotipo.svg /
// logotipo-arco.svg (ambos con lettering crema, pensado para banda oscura),
// les ganaba la cascada: MARACACAO se pintaba con el currentColor heredado
// del header (tinta sobre verde-700 ≈ 1.48 de contraste) en vez del crema
// del propio archivo. El fix mueve el color a un atributo de presentación
// por <path> — los atributos no tienen cascada entre documentos, cada SVG
// es dueño del suyo — así que el mecanismo de conflicto no es que "hoy no
// choquen", es que ya no existe una regla de la que pueda depender ningún
// otro SVG.
describe('lettering embebido: sin conflicto de cascada entre variantes (B1)', () => {
  it('el documento no contiene ninguna regla .letra con fill en un <style>', async () => {
    // Composición deliberada: LockupHeader (crema -> currentColor, banda
    // clara) + Logotipo (crema crudo, banda oscura) en el mismo documento —
    // exactamente la convivencia que rompía en /manual/logo. Si cualquiera
    // de los dos todavía definiera el color en una regla CSS de clase, esta
    // aserción lo agarra sin importar el orden de render.
    const cabecera = await container.renderToString(LockupHeader)
    const logotipo = await container.renderToString(Logotipo)
    const documento = `<html><body>${cabecera}${logotipo}</body></html>`

    const estilos = [...documento.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    expect(estilos).not.toMatch(/\.letra\s*\{[^}]*\bfill\s*:/)
  })

  it('cada letra sigue llevando su color como atributo de presentación (viaja con el archivo)', async () => {
    const html = await container.renderToString(Logotipo)
    // Sobre banda oscura, Logotipo usa el SVG tal cual sale de svgDeMarca:
    // fill tokenizado en el atributo, no reescrito a currentColor.
    expect(html).toMatch(/<path[^>]*class="letra"[^>]*fill="var\(--mrc-crema, #F4E8C6\)"/)
  })
})

describe('SelloCircular', () => {
  it('usa la mascota reducida, no la completa', async () => {
    const html = await container.renderToString(SelloCircular)
    expect(html).not.toContain('id="bowl"')
    expect(html).not.toContain('id="granos-orbita"')
  })

  it('llena el contenedor al 100% x 100% (no depende del tamaño por defecto del navegador para <svg>)', async () => {
    const html = await container.renderToString(SelloCircular)
    expect(html).toMatch(/<svg[^>]*\swidth="100%"/)
    expect(html).toMatch(/<svg[^>]*\sheight="100%"/)
  })

  it('acepta una prop de tamaño (diametro) y la aplica a su contenedor efectivo', async () => {
    // El <svg> inyectado siempre es width/height 100% (llena el círculo);
    // `diametro` no se propaga al <svg> sino al <span> que lo recorta. El
    // "contenedor efectivo" acá es ese span — si un refactor futuro de
    // svgDeMarca/.replace() rompe la propagación de diametro, este test
    // tiene que agarrarlo.
    const html = await container.renderToString(SelloCircular, { props: { diametro: 64 } })
    expect(html).toMatch(/width:\s*64px/)
    expect(html).toMatch(/height:\s*64px/)
  })
})

describe('SelloCircular — piso de radio (orejas)', () => {
  // Task 14 (mascota reducida) midió que las orejas, no lo vertical, son la
  // restricción estructural de un recorte circular: un recorte por debajo
  // de ~90-94% del medio-canvas las corta en línea recta (ver
  // task-14-report.md, "Preocupaciones para quien revise" #4). Este test
  // reproduce esa cuenta contra el archivo real: si alguna vez alguien
  // agranda las orejas (o su trazo) sin revisar esto, el test lo agarra
  // ANTES de que SelloCircular (que llena el círculo al 100%) empiece a
  // cortarlas.
  it('el punto más lejano del dibujo (borde de oreja + medio trazo) queda dentro del 100% del medio-canvas', () => {
    const doc = cargarSvg('src/assets/brand/mascota-reducida.svg')
    const raiz = doc.querySelector('svg')!
    const partes = raiz.getAttribute('viewBox')!.split(' ').map(Number)
    const w = partes[2]!
    const h = partes[3]!
    expect(w).toBe(h) // el sello es un contenedor cuadrado — si esto deja de valer, la cuenta de abajo no aplica

    const medioCanvas = w / 2
    const centro = { x: w / 2, y: h / 2 }
    const anchos = atributosDeTrazo(doc)
    const anchoTrazoDe = (id: string): number => {
      const encontrado = anchos.find((a) => a.id === id)
      return encontrado ? Number(encontrado.width) : 0
    }

    let maxRatio = 0
    for (const id of ['oreja-l', 'oreja-r']) {
      const disco = doc.querySelector(`[id="${id}"] circle`)
      expect(disco).not.toBeNull()
      const cx = Number(disco!.getAttribute('cx'))
      const cy = Number(disco!.getAttribute('cy'))
      const r = Number(disco!.getAttribute('r'))
      const distanciaAlCentro = Math.hypot(cx - centro.x, cy - centro.y)
      const alcance = distanciaAlCentro + r + anchoTrazoDe(id) / 2
      maxRatio = Math.max(maxRatio, alcance / medioCanvas)
    }

    // Piso medido: 90-94% del medio-canvas (ver SelloCircular.astro).
    expect(maxRatio).toBeGreaterThan(0.85) // confirma que de verdad estamos cerca del piso medido, no un margen artificial
    expect(maxRatio).toBeLessThan(1) // si esto falla, un SelloCircular al 100% recorta las orejas
  })
})

describe('Logotipo', () => {
  it('acepta una prop de tamaño y la aplica', async () => {
    const html = await container.renderToString(Logotipo, { props: { alto: 48 } })
    expect(html).toMatch(/height="48"|height:\s*48px/)
  })
})

describe('IsotipoSuelto', () => {
  it('inyecta el SVG inline de la mascota reducida', async () => {
    const html = await container.renderToString(IsotipoSuelto)
    expect(html).toContain('<svg')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('id="bowl"') // es la mascota reducida, no la completa
  })

  it('acepta una prop de tamaño y la aplica', async () => {
    const html = await container.renderToString(IsotipoSuelto, { props: { alto: 64 } })
    expect(html).toMatch(/<svg[^>]*\sheight="64"/)
  })

  it('lleva un aria-label propio, distinto del logo completo', async () => {
    const html = await container.renderToString(IsotipoSuelto)
    expect(html).toContain('aria-label="Mono de Maracacao"')
  })
})

describe('SelloCompleto', () => {
  it('compone arco + mascota + descriptor, los tres inline', async () => {
    const html = await container.renderToString(SelloCompleto)
    expect(html.match(/<svg/g)).toHaveLength(3)
    expect(html).not.toContain('<img')
  })

  it('no filtra la capa de pivotes de mascota.svg', async () => {
    const html = await container.renderToString(SelloCompleto)
    expect(html).not.toContain('id="pivotes"')
    expect(html).not.toContain('piv-cabeza')
    expect(html).not.toContain('piv-oreja-l')
  })

  it('acepta una prop de tamaño (ancho) y la aplica a su contenedor efectivo', async () => {
    // Los tres <svg> inyectados son width 100% de su <span> (arco/mascota/
    // descriptor); `ancho` se aplica al <div> que los envuelve, no a los
    // <svg> en sí. Contenedor efectivo = ese div.
    const html = await container.renderToString(SelloCompleto, { props: { ancho: 200 } })
    expect(html).toMatch(/width:\s*200px/)
  })
})

describe('SelloReducido', () => {
  it('compone arco + mascota, sin descriptor', async () => {
    const html = await container.renderToString(SelloReducido)
    expect(html.match(/<svg/g)).toHaveLength(2)
  })

  it('no filtra la capa de pivotes de mascota.svg', async () => {
    const html = await container.renderToString(SelloReducido)
    expect(html).not.toContain('id="pivotes"')
    expect(html).not.toContain('piv-cabeza')
  })

  it('acepta una prop de tamaño (ancho) y la aplica a su contenedor efectivo', async () => {
    const html = await container.renderToString(SelloReducido, { props: { ancho: 150 } })
    expect(html).toMatch(/width:\s*150px/)
  })
})

describe('Monocromo', () => {
  it('reemplaza los fill/stroke tokenizados por currentColor', async () => {
    const html = await container.renderToString(Monocromo)
    expect(html).not.toMatch(/fill="var\(--mrc-/)
    expect(html).not.toMatch(/stroke="var\(--mrc-/)
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('stroke="currentColor"')
  })

  it('variante positivo usa tinta; negativo usa papel', async () => {
    const positivo = await container.renderToString(Monocromo, { props: { variante: 'positivo' } })
    const negativo = await container.renderToString(Monocromo, { props: { variante: 'negativo' } })
    expect(positivo).toContain('var(--mrc-tinta)')
    expect(negativo).toContain('var(--mrc-papel)')
  })

  it('acepta una prop de tamaño (alto) y la aplica al SVG inyectado', async () => {
    const html = await container.renderToString(Monocromo, { props: { alto: 64 } })
    expect(html).toMatch(/<svg[^>]*\sheight="64"/)
  })
})

describe('svgDeMarca', () => {
  it('saca la capa #pivotes de mascota.svg (el replace matchea el archivo real, no uno viejo)', () => {
    const svg = svgDeMarca('mascota')
    expect(svg).not.toContain('id="pivotes"')
    expect(svg).not.toContain('piv-cabeza')
    expect(svg).not.toContain('piv-oreja-l')
    expect(svg).not.toContain('piv-mano-r')
  })

  it('tokeniza colores del sistema a var(--mrc-...)', () => {
    const svg = svgDeMarca('mascota')
    expect(svg).toContain('var(--mrc-')
  })
})
