/*
 * Lee las páginas CONSTRUIDAS y devuelve qué campos dice el HTML que
 * muestra: cada `data-campo`, cada `data-campo-attr` y cada
 * `data-campo-alterno` que encuentra, partido en documento + ruta (más el
 * texto o el valor de atributo que ese nodo muestra hoy — spec §3.1, D1/D2).
 *
 * `data-campo-attr` acepta una lista de referencias separadas por espacio
 * (un elemento puede tener que editar más de un atributo a la vez, como el
 * <form> de contacto) y `data-campo-alterno` acepta la forma de atributo
 * de D2 («atributo:documento:ruta») para el caso en que el script no
 * reemplaza el textContent del nodo marcado sino que le pone el valor a
 * un atributo de un elemento que crea adentro (el visor 3D). Los dos
 * casos se parten con la misma regla de D2: PRIMER `:` el atributo, el
 * resto una referencia de D1.
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
  /**
   * El nombre del atributo, cuando la referencia lo nombra: siempre para
   * `data-campo-attr`, y para el único `data-campo-alterno` que también
   * lo nombra (el visor 3D, `alt:documento:ruta`). `null` para un
   * `data-campo` liso o un `data-campo-alterno` que reemplaza textContent.
   */
  atributo: string | null
  /** El valor crudo de ESTA referencia (un token, si el atributo traía varias separadas por espacio). */
  crudo: string
  /**
   * El `textContent` del nodo marcado, tal cual quedó en el HTML
   * construido. `test/panel.test.ts` lo usa para medir si la plantilla
   * transforma el valor del campo antes de mostrarlo.
   */
  texto: string
  /**
   * El valor del atributo que nombra `atributo`, o `null` cuando
   * `atributo` es `null`. Mismo uso que `texto`, pero para `data-campo-attr`.
   */
  valorAtributo: string | null
  /**
   * De qué atributo HTML salió esta referencia. `atributo !== null` NO
   * alcanza para saber si es un `data-campo-attr` o el único
   * `data-campo-alterno` con forma de atributo (el visor 3D) — los dos
   * nombran un atributo. `test/panel.test.ts` necesita esta distinción
   * para no comparar un alterno (que el script pinta DESPUÉS) contra el
   * HTML de build, que todavía no lo tiene.
   */
  fuente: 'data-campo' | 'data-campo-attr' | 'data-campo-alterno'
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

/**
 * Partir 'atributo:documento:ruta' (D2) en sus tres partes: se parte por
 * el PRIMER `:` (el atributo) y lo que queda se vuelve a partir por su
 * propio primer `:` (documento y ruta, como D1). `null` si no hay
 * segundo `:` — o sea, si `valor` no tiene la forma de atributo.
 */
const partiendoEnTres = (
  valor: string,
): { atributo: string; documento: string; ruta: string } | null => {
  const primero = partiendoEnDosPuntos(valor)
  const segundo = primero ? partiendoEnDosPuntos(primero[1]) : null
  if (!primero || !segundo) return null
  return { atributo: primero[0], documento: segundo[0], ruta: segundo[1] }
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
      texto: el.textContent ?? '',
      valorAtributo: null,
      fuente: 'data-campo',
    })
  }

  for (const el of document.querySelectorAll('[data-campo-attr]')) {
    const crudo = el.getAttribute('data-campo-attr') ?? ''
    // Un elemento puede necesitar más de UNA referencia — el <form> de
    // contacto marca data-asunto-personal Y data-asunto-negocio a la vez,
    // y `data-campo-attr` es un solo atributo HTML — así que se parte por
    // espacios primero: cada token es una referencia independiente, con
    // la forma 'atributo:documento:ruta' de `partiendoEnTres`.
    for (const token of crudo.split(/\s+/).filter(Boolean)) {
      const tercias = partiendoEnTres(token)
      salida.push({
        pagina,
        documento: tercias?.documento ?? '',
        ruta: tercias?.ruta ?? '',
        atributo: tercias?.atributo ?? '',
        crudo: token,
        texto: el.textContent ?? '',
        valorAtributo: tercias ? el.getAttribute(tercias.atributo) ?? '' : null,
        fuente: 'data-campo-attr',
      })
    }
  }

  for (const el of document.querySelectorAll('[data-campo-alterno]')) {
    const crudo = el.getAttribute('data-campo-alterno') ?? ''
    // La mayoría de los alternos reemplazan el textContent del nodo
    // marcado («Cerrar menú», «¡Copiado!», «Enviando») y llevan la forma
    // lisa de D1 ('documento:ruta'). El visor 3D es distinto: el script
    // no toca el textContent de este contenedor, crea un <model-viewer>
    // ADENTRO y le pone el alt ahí — así que ese lleva la forma de
    // atributo de D2 ('alt:documento:ruta'), y se intenta primero: si
    // `partiendoEnTres` encuentra el segundo `:`, es la forma de
    // atributo y `atributo` queda con nombre; si no, es la forma lisa.
    // Con esto, «la referencia nombra un atributo ⇒ nunca tocar el
    // textContent» se lee del dato en vez de acordarse de un caso
    // especial. Cuenta para la biyección igual que un data-campo de
    // todos modos: el panel tiene que saber que la vista previa no lo va
    // a mostrar sin simular la interacción.
    const tercias = partiendoEnTres(crudo)
    if (tercias) {
      salida.push({
        pagina,
        documento: tercias.documento,
        ruta: tercias.ruta,
        atributo: tercias.atributo,
        crudo,
        texto: el.textContent ?? '',
        valorAtributo: el.getAttribute(tercias.atributo) ?? '',
        fuente: 'data-campo-alterno',
      })
      continue
    }
    const partes = partiendoEnDosPuntos(crudo)
    salida.push({
      pagina,
      documento: partes?.[0] ?? '',
      ruta: partes?.[1] ?? '',
      atributo: null,
      crudo,
      texto: el.textContent ?? '',
      valorAtributo: null,
      fuente: 'data-campo-alterno',
    })
  }

  return salida
}

export function todasLasReferencias(): Referencia[] {
  return (Object.keys(PAGINAS) as Pagina[]).flatMap(referenciasDe)
}
