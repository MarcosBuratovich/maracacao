import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

export function cargarSvg(ruta: string): Document {
  const { document } = parseHTML(`<html><body>${readFileSync(ruta, 'utf8')}</body></html>`)
  return document as unknown as Document
}

export function idsDeGrupos(doc: Document): string[] {
  return [...doc.querySelectorAll('g[id]')].map((g) => g.getAttribute('id')!)
}

export function padreDe(doc: Document, id: string): string | null {
  // Selector por atributo: `CSS.escape` no existe en Node sin DOM global.
  const el = doc.querySelector(`[id="${id}"]`)
  if (!el) throw new Error(`No existe el elemento con id "${id}"`)
  const padre = el.parentElement
  if (!padre || padre.tagName.toLowerCase() !== 'g') return null
  return padre.getAttribute('id')
}

export function hexUsados(doc: Document): string[] {
  const encontrados = new Set<string>()
  const fuente = doc.body.innerHTML
  for (const m of fuente.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    encontrados.add(`#${m[1].toUpperCase()}`)
  }
  return [...encontrados]
}

export function atributosDeTrazo(doc: Document): Array<{ id: string; width: string; cap: string }> {
  return [...doc.querySelectorAll('[stroke]')].map((el) => {
    const contenedor = el.closest('g[id]')
    return {
      id: contenedor?.getAttribute('id') ?? '',
      width: el.getAttribute('stroke-width') ?? '',
      cap: el.getAttribute('stroke-linecap') ?? '',
    }
  })
}
