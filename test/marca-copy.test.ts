/*
 * Copy del rediseño (src/copy/marca.ts + src/copy/sabores.ts). Misma
 * vigilancia que el copy anterior — registro es-MX, retro de Marcos —
 * más los guardias nuevos que dejó la auditoría del canvas
 * (docs/auditoria-diseno-v2.md): el canvas traía «mono», «chispas»,
 * «pack», «snack» y «smoothies», y acá se fija que no vuelvan.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo } from '@/copy/sabores'
import { sabor } from '@/tokens/color'
import Home from '@/pages/index.astro'

function stringsVisibles(nodo: unknown): string[] {
  if (typeof nodo === 'string') return [nodo]
  if (Array.isArray(nodo)) return nodo.flatMap(stringsVisibles)
  if (nodo !== null && typeof nodo === 'object') return Object.values(nodo).flatMap(stringsVisibles)
  return []
}

const textos = [...stringsVisibles(marca), ...stringsVisibles(sabores), ...stringsVisibles(gotas), ...stringsVisibles(polvo)]

describe('registro y retro vigentes', () => {
  it('es-MX: nunca regionalismos ni anglicismos ajenos', () => {
    for (const t of textos) {
      for (const palabra of ['pistachos', 'cacahuete', 'maní', 'packaging', 'snack', 'smoothie', 'pack ']) {
        expect(t.toLowerCase()).not.toContain(palabra)
      }
    }
  })

  it('el personaje no se llama "mono" (ni "chango")', () => {
    for (const t of textos) expect(t).not.toMatch(/\b(monos?|changos?|changuitos?)\b/i)
  })

  it('las gotas nunca se llaman "chispas" (nombre del cliente: gotas)', () => {
    for (const t of textos) expect(t.toLowerCase()).not.toContain('chispa')
  })

  it('sin carrito; sin precios pegados en strings (van por precioMXN)', () => {
    for (const t of textos) {
      expect(t.toLowerCase()).not.toContain('carrito')
      expect(t).not.toMatch(/\$\s?\d/)
    }
  })

  it('sin promesas de canales que no existen (el canvas decía "te avisamos")', () => {
    for (const t of textos) expect(t.toLowerCase()).not.toContain('te avisamos')
  })
})

describe('sabores — fuente única sincronizada con el arte de imprenta', () => {
  const json = JSON.parse(readFileSync('src/contenido/datos/envolturas.json', 'utf8')) as Record<
    string,
    { color: string; cacao: string | null; ingredientes: string }
  >

  it('son 15, numerados 1–15 sin huecos', () => {
    expect(sabores).toHaveLength(15)
    expect([...sabores].map((s) => s.orden).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    )
  })

  it('cada slug existe en el JSON extraído de los PDF', () => {
    for (const s of sabores) expect(json).toHaveProperty(s.slug)
  })

  it.each([...sabores])('los ingredientes de $nombre no se desvían del arte', (s) => {
    // El JSON trae el texto crudo del PDF (espacios perdidos, remates de
    // peso); la string del sitio es la versión limpia. Se compara
    // normalizando: mismos tokens, mismo orden.
    const normaliza = (t: string) =>
      t.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
    const crudo = normaliza(json[s.slug].ingredientes)
    expect(crudo.startsWith(normaliza(s.ingredientes))).toBe(true)
  })

  // El cliente cerró el conflicto 70 vs 73 (2026-08-13, WhatsApp: «hay
  // que sostenerlo en 70%»): la línea entera se declara 70% aunque las
  // envolturas de mango y piña impriman 73 — el empaque es lo que él
  // planea corregir. Si el JSON deja de decir 73, la excepción sobra y
  // este test lo va a avisar.
  const decididos70 = ['mango-con-chile', 'pina-con-chile']

  it.each([...sabores])('el cacao de $nombre sale de lo impreso (salvo la decisión del cliente)', (s) => {
    const impreso = json[s.slug].cacao
    if (decididos70.includes(s.slug)) {
      // Solo el HECHO IMPRESO en la envoltura física, que no es copy del
      // sitio. Lo que el sitio MUESTRA para estos dos («Cacao 70%») era un
      // assert de valor y cayó con la Fase 1: es contenido de la clienta,
      // igual que el precio.
      expect(impreso).toBe('73%')
    } else if (impreso !== null) {
      expect(s.cacao).toBe(`Cacao ${impreso}`)
    }
    // chamoy y blanco vienen null en el JSON (el dato vive en la línea
    // combinada), así que acá no hay nada impreso contra qué comparar: los
    // dos asserts que fijaban «Cacao 70%» y «Chocolate blanco» a mano
    // cayeron con la Fase 1 por el mismo motivo.
  })

  it('cada clave apunta a un token de color real', () => {
    for (const s of sabores) expect(sabor).toHaveProperty(s.clave)
  })

  it('los assets de cada sabor existen (barra, mini, ilustración y pliego 3D)', () => {
    for (const s of sabores) {
      for (const archivo of [
        `public/sitio/marca/barra-${s.slug}.webp`,
        `public/sitio/marca/barra-${s.slug}-mini.webp`,
        `public/sitio/marca/ilustracion-${s.slug}.webp`,
        `public/sitio/envoltura/${s.slug}-frente.webp`,
        `public/sitio/marca/pliego-${s.slug}.webp`,
      ]) {
        expect(() => readFileSync(archivo)).not.toThrow()
      }
    }
  })

  it('el visor 3D tiene su modelo y su librería self-hosteados', () => {
    // Un solo GLB (el modelo de Marcos, optimizado) + model-viewer local:
    // el 3D no depende de ningún CDN externo.
    expect(readFileSync('public/sitio/marca/barra.glb').length).toBeLessThan(600 * 1024)
    expect(readFileSync('public/vendor/model-viewer.min.js').length).toBeGreaterThan(100 * 1024)
  })

  it('el enlace al catálogo es por producto; solo faltan los 4 sin alta (2026-08-13)', () => {
    // Cosechado del propio catálogo: naranja-jengibre (la barra), mango,
    // chamoy y blanco NO existen como producto todavía — caen a la
    // categoría. Si el cliente los da de alta, actualizar sabores.ts.
    const sinProducto = ['jengibre-y-naranja', 'mango-con-chile', 'chamoy', 'blanco-con-pistache']
    for (const s of sabores) {
      if (sinProducto.includes(s.slug)) {
        expect(s.catalogo).toBeNull()
      } else {
        expect(s.catalogo).toMatch(/^https:\/\/chocolateria\.pulpos\.shop\/product\/[a-z0-9]+$/)
      }
    }
  })
})

describe('gotas y polvo', () => {
  it('las gotas son 6 sabores del catálogo', () => {
    // El conteo se queda hasta la Fase 7: hasta que exista el alta de ítems
    // nadie lo puede violar, así que es un guard gratis. Los precios
    // exactos (340 / 258) no: eran el mismo assert de valor que los 122/108
    // de las barras y cayeron con ellos en la Fase 1.
    expect(gotas).toHaveLength(6)
  })

  it('cada variedad de polvo tiene su etiqueta en disco (el canvas mostraba 4)', () => {
    // [2026-09-22] Eran ocho: las seis variedades saborizadas más «cocoa
    // natural» y «cocoa alcalina». Las dos cocoas salieron de acá porque no
    // son sabores del polvo sino productos aparte —cada una tiene su PROPIA
    // ficha técnica—, y listarlas como variedades inflaba el conteo que el
    // sitio publica («Ocho variedades…»).
    //
    // Lo que este test cuida no es el número sino lo de abajo: que ninguna
    // variedad quede sin su imagen de etiqueta. El día que aparezca
    // «neutro» —que la expo ya anuncia— va a hacer falta
    // `etiqueta-neutro.webp`, y sin ese archivo esto falla acá en vez de
    // fallar como un hueco en la página.
    expect(polvo).toHaveLength(6)
    for (const p of polvo) {
      expect(() => readFileSync(`public/sitio/${p.archivo}.webp`)).not.toThrow()
    }
  })
})

describe('estructura de la página', () => {
  it('el menú: ninguna entrada repite su nombre ni su destino', () => {
    // A FORMA (Fase 1). Exigía el texto «Nosotros», que es exactamente lo
    // que la clienta va a poder renombrar desde el panel.
    //
    // Lo que queda NO es «cada texto no está vacío»: eso ya lo garantiza el
    // esquema, y un assert que repite al esquema da la impresión de
    // proteger algo sin proteger nada. Es que ninguna entrada repita su
    // ancla ni su nombre — el esquema no lo puede ver, porque valida cada
    // ítem por separado, y dos entradas al mismo lugar es el error
    // plausible del día que ella reordena el menú. La otra mitad, que cada
    // ancla tenga una sección viva, la cubre el candado 8.
    const items = marca.nav.items
    expect(items.length).toBeGreaterThan(0)
    expect(new Set(items.map((i) => i.ancla)).size, 'dos entradas al mismo lugar').toBe(items.length)
    expect(new Set(items.map((i) => i.texto)).size, 'dos entradas con el mismo nombre').toBe(items.length)
  })

  it('el FAQ quedó fusionado en 8 preguntas', () => {
    expect(marca.preguntas.items).toHaveLength(8)
  })

  it('las 4 recetas conservan el contenido completo del cliente', () => {
    expect(marca.recetas.lista).toHaveLength(4)
    for (const r of marca.recetas.lista) {
      expect(r.ingredientes.length).toBeGreaterThanOrEqual(3)
      expect(r.pasos.length).toBeGreaterThan(60)
      expect(r.tip.length).toBeGreaterThan(10)
    }
  })

  it('las claves de color citadas por el copy existen', () => {
    for (const paso of marca.catar.pasos) expect(sabor).toHaveProperty(paso.clave)
    for (const r of marca.recetas.lista) expect(sabor).toHaveProperty(r.clave)
    for (const t of marca.negocios.tabs) expect(sabor).toHaveProperty(t.clave)
  })

  it('ningún campo de copy queda sin llegar al HTML: lo muerto se borra, no se acumula', async () => {
    // Un campo que la clienta puede editar y no cambia nada en la página
    // es el peor caso del panel: como no pasa nada, insiste. Este guard
    // no cubre los 327 campos —la fase 2 hace ese trabajo con
    // data-campo—; cubre los cuatro que se borraron el 2026-09-08, para
    // que no vuelvan por copiar y pegar.
    const container = await AstroContainer.create()
    const html = await container.renderToString(Home)
    for (const muerto of [
      'Sello de Maracacao: la huella de una mano',
      'Ver el catálogo completo',
      'Chocolate mexicano, escrito a mano como en la envoltura',
    ]) {
      expect(html).not.toContain(muerto)
    }
    // Y que el campo ya no exista en el copy, no solo su texto:
    // JSON.stringify incluye los nombres de las claves. selloAlt,
    // verTodas y wordmarkAlt vivían en sitio-marca.ts (marca).
    const copy = JSON.stringify(marca)
    for (const clave of ['selloAlt', 'verTodas', 'wordmarkAlt']) {
      expect(copy).not.toContain(clave)
    }
    // paqueteSeis vivía en sabores.ts como export propio, no como campo
    // DENTRO del array `sabores` —serializar `sabores` no lo vería nunca,
    // esté o no reintroducido—, así que acá se mira el módulo entero.
    const modulo = await import('@/copy/sabores')
    expect(modulo).not.toHaveProperty('paqueteSeis')
  })
})
