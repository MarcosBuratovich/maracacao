/*
 * El sitio público (la home, /; hasta el lanzamiento 2026-08-20 vivió
 * en /sitio con candado). Los guards estructurales (hex a
 * mano, <title> literal) ya lo cubren vía manual.test.ts; acá va lo
 * propio: el renderizado de la página con su contenido real, y que los
 * assets decorativos respeten las reglas de construcción de la marca.
 * El registro es-MX del copy vivo lo cubre `marca-copy.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'
import { esc } from './regex'
import { editorial } from '@/tokens/color'
import { customProperties } from '@/tokens/css'
import Borrador from '@/pages/index.astro'
import Presentacion from '@/pages/presentacion.astro'
import TazaEspuma from '@/components/sitio/TazaEspuma.astro'
import HojaCacao from '@/components/sitio/HojaCacao.astro'
import Mazorca from '@/components/sitio/Mazorca.astro'
import Canela from '@/components/sitio/Canela.astro'

const container = await AstroContainer.create()

describe('la página / (rediseño de marca, 2026-08-13; en la raíz desde 2026-08-20)', () => {
  it('renderiza el contenido real: los 15 sabores, correo, catálogo, precios, Tabasco y punto de venta', async () => {
    const html = await container.renderToString(Borrador)
    // Los quince están presentes: en el anaquel cada barra es un radio
    // con su nombre como aria-label.
    for (const s of sabores) expect(html).toContain(`aria-label="${s.nombre}"`)
    expect(html).toContain(marca.contacto.correo)
    expect(html).toContain(marca.contacto.catalogoUrl)
    expect(html).toMatch(/\$\s?108/)
    expect(html).toContain('Tabasco')
    expect(html).toContain(marca.contacto.direccion[0])
  })

  it('títulos concretos, sin juegos de palabras: cada sección lleva su nombre', async () => {
    const html = await container.renderToString(Borrador)
    for (const titulo of [
      marca.postura.titulo, marca.anaquel.titulo, marca.polvo.titulo,
      marca.catar.titulo, marca.recetas.titulo, marca.nosotros.titulo,
      marca.negocios.titulo, marca.preguntas.titulo, marca.contacto.titulo,
    ]) {
      expect(html).toContain(titulo)
    }
  })

  it('las 4 recetas del cliente (completas y expandibles) y las 8 preguntas están', async () => {
    const html = await container.renderToString(Borrador)
    expect(marca.recetas.lista).toHaveLength(4)
    for (const r of marca.recetas.lista) {
      expect(html).toContain(r.titulo)
      // La receta completa del cliente viaja entera, no solo el resumen.
      for (const ing of r.ingredientes) expect(html).toContain(ing)
    }
    expect(html.match(/<details class="receta-completa"/g)).toHaveLength(4)
    expect(marca.preguntas.items).toHaveLength(8)
    expect(html.match(/<details class="pregunta"/g)).toHaveLength(8)
    for (const paso of marca.catar.pasos) expect(html).toContain(paso.nombre)
  })

  it('la ficha del anaquel arranca en canela y la banda trae su color y su tinta medida', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).toContain('aria-checked="true" aria-label="Canela"')
    expect(html).toMatch(/data-anaquel-banda[^>]*--fondo:#7D0303;--texto:#FFFFFF/)
  })

  it('sin marcas de maqueta: ni aviso de borrador ni chips de pendiente', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).not.toContain('Borrador')
    expect(html).not.toContain('PENDIENTE')
    expect(html).not.toMatch(/pregunta \d+/)
  })

  it('no pide la isla de Rive y no busca por id', () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('rive')
    expect(src).not.toContain('getElementById')
    expect(src).not.toMatch(/href="\/(?!\{)/)
  })

  it('solo usa el personaje del cliente, con los assets sin fondo', () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    expect(src).toContain('/sitio/personaje-sentado-t.webp')
  })

  it('el video del personaje respeta reduced-motion (se pausa y da controles)', () => {
    const src = readFileSync('src/scripts/editorial.ts', 'utf8')
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).toContain('video.pause()')
  })

  it('el anaquel se inyecta con jsonParaHtml(), no con JSON.stringify a mano', () => {
    // Esta es la que de verdad blinda la regresión: con los datos de hoy
    // (ningún campo trae «<») el bloque renderizado sale limpio tanto si
    // se usa jsonParaHtml como si alguien vuelve a poner JSON.stringify a
    // mano —así que probar el HTML resultante no alcanza para detectar un
    // revert. Esto sí lo detecta: si la línea 776 de index.astro deja de
    // llamar a jsonParaHtml(datosAnaquel), este test se rompe ahí mismo.
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).toMatch(/id="datos-anaquel"\s+set:html=\{jsonParaHtml\(datosAnaquel\)\}/)
  })

  it('el JSON del anaquel renderizado parsea con las quince fichas (y hoy, sin un solo «<»)', async () => {
    const html = await container.renderToString(Borrador)
    const bloque = html.match(
      /<script type="application\/json" id="datos-anaquel">([\s\S]*?)<\/script>/,
    )
    expect(bloque).not.toBeNull()
    const crudo = bloque![1]
    expect(crudo).not.toContain('<')
    expect(JSON.parse(crudo)).toHaveLength(sabores.length)
  })

  it('el 2.º renglón del titular termina en coma, y se pinta sin ella con la coma aparte en rojo', async () => {
    // La regla del slot es una sola: el segundo renglón CIERRA en coma,
    // que la plantilla saca para repintarla en el acento. No exige que
    // sea la única coma del renglón —un «70% CACAO, DE VERDAD,» es
    // titular legítimo, con su coma interna y la de cierre— así que acá
    // no se valida eso. Sacar la coma con replace(',', '') quitaba la
    // PRIMERA, no la última: con ese mismo titular la página mostraba
    // dos comas mal puestas y la regla de «termina en coma» igual daba
    // por buena la cadena.
    expect(marca.hero.titular).toHaveLength(3)
    expect(marca.hero.titular[1].endsWith(',')).toBe(true)
    const sinComa = marca.hero.titular[1].slice(0, -1)

    const html = await container.renderToString(Borrador)
    expect(html).toMatch(new RegExp(`${esc(sinComa)}<span class="acento"[^>]*>,</span>`))
  })
})

/*
 * Rediseño editorial (2026-08-12): canon de Van de Graaf, una sola tinta
 * sobre un solo papel, y el wordmark del logo replicado en texto vivo
 * con la tipografía del sello.
 */
describe('sistema editorial', () => {
  const css = readFileSync('src/styles/editorial.css', 'utf8')

  it('los colores del lienzo salen de tokens con prefijo propio', () => {
    const props = customProperties()
    for (const [nombre, hex] of Object.entries(editorial)) {
      expect(props[`--mrc-ed-${nombre}`]).toBe(hex)
    }
    // `editorial.papel` y `fijos.papel` son colores distintos: sin el
    // prefijo `ed-` el segundo pisaría al primero y rompería el manual.
    expect(props['--mrc-papel']).not.toBe(editorial.papel)
  })

  it('el canon divide en nueve y el bloque de texto ocupa seis, con margen para notas', () => {
    expect(css).toContain('grid-template-columns: repeat(9, minmax(0, 1fr))')
    expect(css).toMatch(/\.bloque\s*\{\s*grid-column:\s*2\s*\/\s*8/)
    expect(css).toMatch(/\.margen\s*\{\s*grid-column:\s*8\s*\/\s*10/)
  })

  it('el wordmark es texto vivo, no una imagen (cabecera, hero y pie)', async () => {
    const html = await container.renderToString(Borrador)
    // El wordmark vive tres veces como texto: cabecera, lockup del hero
    // y pie — nunca como imagen (el arco a mano del pie se reemplazó por
    // el lockup vectorial, retro de Marcos 2026-08-13).
    expect(html).toMatch(new RegExp(`class="lockup-nombre"[^>]*>${esc(marca.marca.wordmark)}<`))
    expect(html).toMatch(new RegExp(`class="portada-wordmark"[^>]*>${esc(marca.marca.wordmark)}<`))
    expect(html).toMatch(new RegExp(`class="pie-wordmark"[^>]*>${esc(marca.marca.wordmark)}<`))
  })

  it('el sello va inline para tomar la tinta de su sección', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).toContain('fill="currentColor"')
    expect(html).not.toContain('/sitio/logo-t.png')
  })

  it('nada se esconde sin JS ni con reduced-motion', () => {
    // Todo el movimiento vive bajo `html.js` + no-preference.
    const ocultos = css.match(/\[data-revelar\]\s*\{\s*opacity:\s*0/g) ?? []
    for (const regla of ocultos) expect(css).toContain(`html.js .ed ${regla.split('{')[0].trim()}`)
    const media = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(media).toBeGreaterThan(-1)
    expect(css.indexOf('html.js .ed [data-revelar]')).toBeGreaterThan(media)
  })

  it('el cursor propio solo aparece con puntero fino y sin reduced-motion', () => {
    const js = readFileSync('src/scripts/editorial.ts', 'utf8')
    expect(js).toContain("matchMedia('(pointer: fine)')")
    expect(js).toMatch(/if \(punteroFino && !quieto\)/)
    expect(css).toContain('html.cursor-propio, html.cursor-propio * { cursor: none; }')
  })
})

describe('el lanzamiento (2026-08-20): la landing es la home', () => {
  it('la home no enlaza presentación/manual/borrador (van por URL directa) ni usa la mascota del sistema', async () => {
    const src = readFileSync('src/pages/index.astro', 'utf8')
    expect(src).not.toContain('components/brand/Mascota')
    const html = await container.renderToString(Borrador)
    expect(html).not.toContain('href="/manual"')
    expect(html).not.toContain('href="/sitio"')
    expect(html).not.toContain('href="/presentacion"')
    expect(html).not.toContain('Sitio en construcción')
  })

  it('carga el módulo de marca, que apaga el movimiento bajo reduced-motion', () => {
    expect(readFileSync('src/pages/index.astro', 'utf8')).toContain("import '@/scripts/marca'")
    const js = readFileSync('src/scripts/marca.ts', 'utf8')
    expect(js).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
  })
})

describe('el formulario con envío real (2026-08-17)', () => {
  it('la función de Vercel existe, con sus capas anti-bots', () => {
    const fn = readFileSync('api/contacto.ts', 'utf8')
    expect(fn).toContain('RESEND_API_KEY')
    expect(fn).toContain('apellido') // capa 1: honeypot
    expect(fn).toContain('4000') // capa 2: trampa de tiempo
    expect(fn).toContain('ORIGENES_PERMITIDOS') // capa 3: origen
    expect(fn).toContain('TURNSTILE_SECRET') // capa 4: opcional
    // La clave nunca viaja en el código: solo por variable de entorno.
    expect(fn).not.toMatch(/re_[A-Za-z0-9]{20,}/)
  })

  it('el form arma las trampas y conserva el respaldo mailto', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).toContain('name="apellido"')
    expect(html).toContain('name="inicio"')
    expect(html).toContain('action="mailto:')
    expect(html).toContain('data-formulario-exito')
  })
})

describe('el candado de cortesía (2026-08-13)', () => {
  it('las páginas privadas lo piden; la home, no', () => {
    for (const pagina of [
      'src/pages/presentacion.astro',
      'src/pages/manual/index.astro',
      'src/pages/manual/[...slug].astro',
    ]) {
      // [^>]* cruza saltos de línea: la llamada a <Base> puede ser multilínea.
      expect(readFileSync(pagina, 'utf8')).toMatch(/<Base[^>]*\scandado/)
    }
    expect(readFileSync('src/pages/index.astro', 'utf8')).not.toMatch(/<Base[^>]*\scandado/)
  })

  it('cerrado por defecto y sin la contraseña en claro', async () => {
    const html = await container.renderToString(Presentacion)
    // El formulario del candado está, con el hash como única llave.
    expect(html).toContain('data-candado')
    expect(html).toMatch(/data-llave="[0-9a-f]{64}"/)
    // La regla que esconde el contenido sin llave viaja en el HTML.
    expect(html).toContain('html:not(.acceso)')
    // En el layout no hay contraseña en claro: solo el SHA-256.
    const base = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(base).toMatch(/LLAVE_SHA256 = '[0-9a-f]{64}'/)
  })

  it('la home no lleva candado en su HTML', async () => {
    const html = await container.renderToString(Borrador)
    expect(html).not.toContain('data-candado')
  })
})

describe('assets decorativos — reglas de construcción (§9.1)', () => {
  const casos = [
    ['TazaEspuma', TazaEspuma],
    ['HojaCacao', HojaCacao],
    ['Mazorca', Mazorca],
    ['Canela', Canela],
  ] as const

  it.each(casos)('%s: fills de tokens, trazo redondeado, sin ids en el SVG', async (_, Comp) => {
    const html = await container.renderToString(Comp)
    expect(html).toContain('var(--mrc-')
    expect(html).toContain('stroke-linecap="round"')
    // Ids duplicados al inlinear: deuda que estos assets NO heredan —
    // toda referencia de animación va por clase.
    expect(html).not.toMatch(/<(g|path|circle|ellipse|rect)[^>]* id="/)
    expect(html).toContain('aria-hidden="true"')
  })

  it('las animaciones usan los tokens de movimiento, nunca tiempos a mano', () => {
    for (const archivo of ['TazaEspuma', 'HojaCacao', 'Mazorca', 'Canela']) {
      const src = readFileSync(`src/components/sitio/${archivo}.astro`, 'utf8')
      const enEstilos = src.match(/<style>[\s\S]*<\/style>/)?.[0] ?? ''
      const tiempos = (enEstilos.match(/\b\d[\d.]*(?:ms|s)\b/g) ?? []).filter((t) => t !== '0ms')
      // 100ms es el retardo de peso permitido por §12 (cola/orejas 80-120ms).
      expect(tiempos.filter((t) => t !== '100ms')).toEqual([])
    }
  })
})
