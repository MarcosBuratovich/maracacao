/*
 * Lee las páginas CONSTRUIDAS y devuelve qué campos dice el HTML que
 * muestra: cada `data-campo` y cada `data-campo-attr` que encuentra,
 * partido en documento + ruta.
 *
 * Vive en test/lib/ y no en src/ porque hoy lo usa solo la suite. Cuando
 * la fase 4 traiga el medidor, ese va a necesitar exactamente esto sobre
 * el DOM vivo del iframe: si pasa, se muda a src/anti-desborde/ y el
 * test lo importa de ahí. No al revés.
 */
import { readFileSync, existsSync } from 'node:fs'
import { parseHTML } from 'linkedom'

/** Las páginas que consumen copy de la clienta (spec §3.1). */
export const PAGINAS = {
  'index.html': 'dist/index.html',
  '404.html': 'dist/404.html',
  'fichas-tecnicas.html': 'dist/fichas-tecnicas/index.html',
} as const

export type Pagina = keyof typeof PAGINAS

export interface Referencia {
  pagina: Pagina
  /** 'sitio' | 'sabores' | 'fichas' — tal cual vino, sin validar. */
  documento: string
  /** La ruta con índices concretos: 'recetas.lista.2.titulo'. */
  ruta: string
  /** El atributo, cuando vino de `data-campo-attr`. Si no, null. */
  atributo: string | null
  /** El valor crudo del atributo, para que un error diga qué leyó. */
  crudo: string
}

export function hayPaginasConstruidas(): boolean {
  return Object.values(PAGINAS).every((ruta) => existsSync(ruta))
}

/**
 * Si una ruta CONCRETA del HTML (`fichas.2.meta.0.1`) es una instancia del
 * patrón que emite `recorre()` para el esquema (`fichas[].meta[].1`).
 *
 * Se compara segmento por segmento, no colapsando números: `x[]` consume la
 * clave `x` más UN índice, `x[][]` consume `x` más DOS (las filas de una
 * tabla), y un segmento numérico del esquema es el índice FIJO de una tupla
 * y exige ese mismo número. Colapsar todo número a `[]` —que es lo que hacía
 * la primera versión— no distingue el índice fijo de una tupla del índice de
 * una lista, y por eso no podía emparejar `fichas[].meta[].0` ni
 * `negocios.tabs.0.datos[]`.
 */
export function coincideConPatron(concreta: string, patron: string): boolean {
  const segmentosConcretos = concreta.split('.')
  const segmentosPatron = patron.split('.')
  let i = 0 // cursor sobre segmentosConcretos: el patrón lo va empujando.

  for (const segmento of segmentosPatron) {
    const base = segmento.replace(/(\[\])+$/, '')
    const corchetes = segmento.length - base.length
    const indices = corchetes / 2 // cuántos índices consume este segmento: 0, 1 (lista) o 2 (tabla).

    if (indices === 0) {
      // Nombre de clave a secas, o el índice FIJO de una tupla ('0', '1'):
      // en los dos casos el segmento concreto tiene que ser IDÉNTICO.
      if (segmentosConcretos[i] !== segmento) return false
      i += 1
      continue
    }

    if (segmentosConcretos[i] !== base) return false
    i += 1
    for (let k = 0; k < indices; k++) {
      if (!/^\d+$/.test(segmentosConcretos[i] ?? '')) return false
      i += 1
    }
  }

  // Los dos tienen que terminar juntos: sobrar segmentos de un lado es el
  // mismo desajuste de longitud que faltar del otro.
  return i === segmentosConcretos.length
}

const partiendoEnDosPuntos = (valor: string): [string, string] | null => {
  const corte = valor.indexOf(':')
  if (corte <= 0 || corte === valor.length - 1) return null
  return [valor.slice(0, corte), valor.slice(corte + 1)]
}

export function referenciasDe(pagina: Pagina): Referencia[] {
  const { document } = parseHTML(readFileSync(PAGINAS[pagina], 'utf8'))
  const salida: Referencia[] = []

  for (const el of document.querySelectorAll('[data-campo]')) {
    const crudo = el.getAttribute('data-campo') ?? ''
    const partes = partiendoEnDosPuntos(crudo)
    salida.push({
      pagina,
      documento: partes?.[0] ?? '',
      ruta: partes?.[1] ?? '',
      atributo: null,
      crudo,
    })
  }

  for (const el of document.querySelectorAll('[data-campo-attr]')) {
    const crudo = el.getAttribute('data-campo-attr') ?? ''
    // Se parte DOS veces: 'alt:sitio:anaquel.envolturaAltPrefijo' →
    // atributo 'alt', y el resto es una referencia como la de data-campo.
    const primero = partiendoEnDosPuntos(crudo)
    const segundo = primero ? partiendoEnDosPuntos(primero[1]) : null
    salida.push({
      pagina,
      documento: segundo?.[0] ?? '',
      ruta: segundo?.[1] ?? '',
      atributo: primero?.[0] ?? '',
      crudo,
    })
  }

  return salida
}

export function todasLasReferencias(): Referencia[] {
  return (Object.keys(PAGINAS) as Pagina[]).flatMap(referenciasDe)
}
