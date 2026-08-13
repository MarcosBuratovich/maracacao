/*
 * Copy del rediseño (src/copy/marca.ts + src/copy/sabores.ts). Misma
 * vigilancia que el copy anterior — registro es-MX, retro de Marcos —
 * más los guardias nuevos que dejó la auditoría del canvas
 * (docs/auditoria-diseno-v2.md): el canvas traía «mono», «chispas»,
 * «pack», «snack» y «smoothies», y acá se fija que no vuelvan.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo } from '@/copy/sabores'
import { sabor } from '@/tokens/color'

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
  const json = JSON.parse(readFileSync('docs/envolturas.json', 'utf8')) as Record<
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
      expect(impreso).toBe('73%') // lo impreso sigue diciendo 73…
      expect(s.cacao).toBe('Cacao 70%') // …y el sitio muestra la decisión
    } else if (impreso !== null) {
      expect(s.cacao).toBe(`Cacao ${impreso}`)
    }
    // chamoy y blanco vienen null en el JSON (el dato vive en la línea
    // combinada): chamoy es 70% según su propia línea, el blanco no es
    // chocolate oscuro.
    else if (s.slug === 'chamoy') expect(s.cacao).toBe('Cacao 70%')
    else expect(s.cacao).toBe('Chocolate blanco')
  })

  it('los nombres son los IMPRESOS en la envoltura (decisión 2026-08-13)', () => {
    const nombres = sabores.map((s) => s.nombre)
    expect(nombres).toContain('Jengibre y naranja') // no «Naranja con jengibre»
    expect(nombres).toContain('Fresas y chile') // no «Fresas enchiladas»
    expect(nombres).toContain('Hierbabuena') // no «Yerbabuena»
    expect(nombres).toContain('Tamarindo con chile') // no «Tamarindo» a secas
    expect(nombres).not.toContain('Naranja con jengibre')
    expect(nombres).not.toContain('Fresas enchiladas')
    expect(nombres).not.toContain('Yerbabuena')
  })

  it('cada clave apunta a un token de color real', () => {
    for (const s of sabores) expect(sabor).toHaveProperty(s.clave)
  })

  it('los assets de cada sabor existen (barra, mini e ilustración)', () => {
    for (const s of sabores) {
      for (const archivo of [
        `public/sitio/marca/barra-${s.slug}.webp`,
        `public/sitio/marca/barra-${s.slug}-mini.webp`,
        `public/sitio/marca/ilustracion-${s.slug}.webp`,
        `public/sitio/envoltura/${s.slug}-frente.webp`,
      ]) {
        expect(() => readFileSync(archivo)).not.toThrow()
      }
    }
  })

  it('precios del catálogo: jengibre y naranja 122, el resto 108', () => {
    for (const s of sabores) {
      expect(s.precio).toBe(s.slug === 'jengibre-y-naranja' ? 122 : 108)
    }
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
  it('las gotas son 6 sabores del catálogo, jengibre y naranja a 340', () => {
    expect(gotas).toHaveLength(6)
    for (const g of gotas) expect(g.precio).toBe(g.clave === 'jengibreYNaranja' ? 340 : 258)
  })

  it('la línea de polvo trae las OCHO etiquetas (el canvas mostraba 4)', () => {
    expect(polvo).toHaveLength(8)
    for (const p of polvo) {
      expect(() => readFileSync(`public/sitio/${p.archivo}.webp`)).not.toThrow()
    }
  })
})

describe('estructura de la página', () => {
  it('el menú incluye Nosotros (faltaba en el canvas)', () => {
    expect(marca.nav.items.map((i) => i.texto)).toContain('Nosotros')
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

  it('el lema del pie es la frase textual del cliente', () => {
    expect(marca.footer.lema).toBe('Más cacao, ingredientes sencillos y muchas maneras de disfrutarlo')
  })

  it('las claves de color citadas por el copy existen', () => {
    for (const paso of marca.catar.pasos) expect(sabor).toHaveProperty(paso.clave)
    for (const r of marca.recetas.lista) expect(sabor).toHaveProperty(r.clave)
    for (const t of marca.negocios.tabs) expect(sabor).toHaveProperty(t.clave)
  })
})
