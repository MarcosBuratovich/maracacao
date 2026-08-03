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

// Hex de 3, 4, 6 u 8 dígitos (shorthand / shorthand+alfa / estándar / con
// alfa). Alternancia de más largo a más corto + lookahead negativo: sin el
// lookahead, un hex de 8 dígitos matchearía primero como uno de 6 (dejando 2
// dígitos sueltos sin sentido), y un intento de 3 dígitos se "comería" solo
// la mitad de uno de 6. El lookahead niega que siga otro dígito hexadecimal,
// así que nunca se corta una corrida de dígitos por la mitad.
const HEX_RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g

function normalizarHex(digitos: string): string {
  const mayus = digitos.toUpperCase()
  // Solo el shorthand de 3 dígitos tiene una expansión real: #ABC == #AABBCC.
  // Los de 4 y 8 (con canal alfa) se dejan tal cual — no van a matchear
  // ningún token de la paleta (que son todos de 6 dígitos sin alfa), así que
  // quedan correctamente marcados como fuera de paleta por quien consuma esto.
  if (mayus.length === 3) return mayus.split('').map((c) => c + c).join('')
  return mayus
}

function extraerHexDe(texto: string, destino: Set<string>): void {
  for (const m of texto.matchAll(HEX_RE)) destino.add(`#${normalizarHex(m[1])}`)
}

function textoDeEstilos(doc: Document): string {
  return [...doc.querySelectorAll('style')].map((el) => el.textContent ?? '').join('\n')
}

interface ReglaCss {
  selector: string
  declaraciones: string
}

// Parser mínimo de bloques `selector { declaraciones }`: no entiende @media
// ni reglas anidadas, pero alcanza para el <style> plano de un SVG de marca.
// Separar selector de declaraciones (en vez de tratar todo el texto como una
// bolsa de caracteres) es lo que permite ignorar sin casos especiales un
// selector de ID que parece hex, del estilo `#cafe00 { display: none }`.
function reglasDeEstilo(doc: Document): ReglaCss[] {
  const sinComentarios = textoDeEstilos(doc).replace(/\/\*[\s\S]*?\*\//g, '')
  const reglas: ReglaCss[] = []
  for (const m of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    reglas.push({ selector: m[1].trim(), declaraciones: m[2] })
  }
  return reglas
}

export function hexUsados(doc: Document): string[] {
  const encontrados = new Set<string>()

  // Los colores viven en valores de atributos (fill, stroke, el atributo
  // style inline, stop-color, ...) — nunca en el nombre del atributo. Barrer
  // por atributo (en vez de correr la regex sobre el innerHTML crudo) evita
  // por construcción cualquier falso positivo que viva en texto de nodo,
  // como un comentario HTML.
  for (const el of doc.querySelectorAll('*')) {
    for (const nombre of el.getAttributeNames()) {
      extraerHexDe(el.getAttribute(nombre) ?? '', encontrados)
    }
  }

  // Y del lado derecho de las declaraciones dentro de <style> — nunca del
  // selector (evita el falso positivo de un selector de ID tipo `#cafe00`) ni
  // de un comentario CSS (se descartan antes de parsear reglas).
  for (const { declaraciones } of reglasDeEstilo(doc)) {
    extraerHexDe(declaraciones, encontrados)
  }

  return [...encontrados]
}

function valorDeDeclaracion(declaraciones: string, propiedad: string): string | null {
  for (const decl of declaraciones.split(';')) {
    const i = decl.indexOf(':')
    if (i === -1) continue
    if (decl.slice(0, i).trim() === propiedad) return decl.slice(i + 1).trim()
  }
  return null
}

// Solo resuelve selectores de clase simple (`.nombre`), que es el patrón que
// usa el plan para stroke-width/stroke-linecap. No entiende combinadores,
// selectores compuestos (`path.clase`) ni pseudo-clases.
function valorPorClase(doc: Document, el: Element, propiedad: string): string | null {
  const clases = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  if (clases.length === 0) return null
  for (const { selector, declaraciones } of reglasDeEstilo(doc)) {
    const selectores = selector.split(',').map((s) => s.trim())
    if (!clases.some((c) => selectores.includes(`.${c}`))) continue
    const valor = valorDeDeclaracion(declaraciones, propiedad)
    if (valor !== null) return valor
  }
  return null
}

export function atributosDeTrazo(
  doc: Document,
): Array<{ id: string | null; width: string; cap: string }> {
  return [...doc.querySelectorAll('[stroke]')].map((el) => {
    const contenedor = el.closest('g[id]')
    return {
      // Centinela explícito: `null` cuando el trazo no cuelga de ningún
      // g[id], en vez de '' — no queda ambiguo con "el grupo se llama vacío".
      id: contenedor?.getAttribute('id') ?? null,
      // El atributo del elemento gana si está presente, igual que la
      // cascada real; si no está, se resuelve por la clase CSS.
      width: el.getAttribute('stroke-width') ?? valorPorClase(doc, el, 'stroke-width') ?? '',
      cap: el.getAttribute('stroke-linecap') ?? valorPorClase(doc, el, 'stroke-linecap') ?? '',
    }
  })
}
