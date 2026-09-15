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
 * Colapsa los índices de lista para poder comparar contra el esquema:
 * 'recetas.lista.2.titulo' → 'recetas.lista[].titulo'.
 *
 * El `[]` se le pega al segmento ANTERIOR porque así lo emite `recorre()`
 * (`lista[]`, no `lista.[]`). Ojo: las TUPLAS del esquema tienen índice
 * numérico propio y fijo (`hero.titular.0`), así que quien compare tiene
 * que probar primero la ruta tal cual y recién después la colapsada.
 */
export function colapsaIndices(ruta: string): string {
  const salida: string[] = []
  for (const parte of ruta.split('.')) {
    if (/^\d+$/.test(parte) && salida.length > 0) salida[salida.length - 1] += '[]'
    else salida.push(parte)
  }
  return salida.join('.')
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
