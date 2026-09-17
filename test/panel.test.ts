/*
 * LA BIYECCIÓN CAMPO ↔ HTML (spec §3.1).
 *
 * El panel de la fase 6 parchea `querySelectorAll('[data-campo="…"]')` y
 * mide el PEOR de los nodos que encuentra. Dos cosas lo rompen en
 * silencio: un campo editable que no tiene ningún nodo (la vista previa
 * no cambia nada y la clienta cree que su edición no funcionó), y un
 * `data-campo` que apunta a una ruta que ya no existe (parchea nada).
 * Este test es lo único que las ataja antes de producción.
 *
 * Nunca «exactamente un nodo»: está MEDIDO que el mapeo es uno-a-muchos
 * —`anaquel.pesoInsignia` sale 17 veces porque las quince fichas se
 * renderizan en build— y esa versión del test no puede pasar. (a) es
 * GLOBAL, no por página: un campo se da por marcado si aparece en
 * CUALQUIERA de las tres, porque la clienta lo puede editar desde
 * cualquiera de las páginas donde vive — exigirlo en cada una rechazaría,
 * por ejemplo, un campo que solo `/fichas-tecnicas` muestra.
 *
 * Además de la biyección, este archivo mide una tercera cosa (test (c)):
 * que el texto o atributo que el HTML muestra sea el valor CRUDO del
 * campo, no una versión que la plantilla alteró sin que nadie lo anote.
 * Es lo que reemplaza a `test/html-normalizado.test.ts` (el verificador
 * retirado en el commit «la biyección campo ↔ HTML está completa») para
 * esta clase de regresión puntual: donde el verificador comparaba el HTML
 * contra una CAPTURA byte a byte —y por eso se ponía rojo con cualquier
 * edición de copy de la clienta, mereciera o no la alarma—, (c) compara el
 * HTML contra el CONTENIDO (el JSON de hoy), así que una edición legítima
 * de copy no lo toca: solo se pone rojo si el nodo deja de mostrar lo que
 * el campo dice, que es la regresión de verdad.
 */
import { describe, it, expect } from 'vitest'
import { recorre } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { esquemaFichas } from '../src/contenido/esquema/fichas'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '@/copy/sabores'
import { fichasBase } from '@/fichas/base'
import {
  todasLasReferencias,
  coincideConPatron,
  hayPaginasConstruidas,
  type Referencia,
} from './lib/campos-en-html'

/**
 * Los campos editables que NO tienen ningún nodo en el HTML, con su razón.
 * No es una lista de pendientes: es la lista de excepciones, y cada línea
 * tiene que poder defenderse sola. Agregar una es una decisión, no un
 * atajo — el panel de la fase 6 tiene que tratar a estos campos distinto
 * (vista previa textual, sin resaltado), y esta lista es de dónde lo saca.
 */
const SIN_NODO = new Set<string>([
  // Acá vivía `sitio:negocios.tabs.0.precio`, y la excepción estaba mal
  // planteada: decía «hoy este campo no tiene nodo» y agregaba «el día que
  // la clienta le ponga un precio, hay que venir a borrar esta línea». O
  // sea que la clienta ponía un precio y su propio deploy se caía. Ese
  // campo no necesita una excepción con nombre: no tiene nodo porque HOY
  // vale `null`, y eso ya lo sabe el test (a) mirando el contenido
  // (`tieneValorHoy`). Esta lista es solo para los campos que SÍ tienen
  // valor y aun así no se renderizan en ninguna página.

  // Es un campo editable, pero ninguna plantilla lo renderiza: el precio
  // que se ve del bloque de gotas es el derivado `gotas.precioDesde` (el
  // mínimo de los seis), nunca el precio suelto de una gota individual. No
  // hay texto de este campo en ninguna página al que colgarle un nodo.
  'sabores:gotas[].precio',

  // Los tres viven solo adentro del JSON-LD del <head>, que es un bloque
  // de JSON y no un nodo de texto. Vista previa textual, sin resaltado
  // (spec §1.7).
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
])

/**
 * Los campos que la plantilla SÍ marca pero NO muestra crudos — D5: «los
 * campos que la plantilla transforma igual se marcan». Ruta (en forma de
 * patrón, como la que arma el esquema) → qué le hace la plantilla, en
 * rioplatense y corto. Una entrada por RUTA, no por nodo: los quince
 * precios de las barras son una sola entrada, no quince.
 *
 * Sin esta lista, el test (c) de abajo no podría distinguir «la plantilla
 * lo cambió a propósito, y el panel lo va a previsualizar transformado
 * igual» de «el data-campo cuelga del nodo equivocado» — que es
 * exactamente la regresión que (c) existe para atajar.
 */
const TRANSFORMADOS = new Map<string, string>([
  ['sitio:hero.titular.1', 'la plantilla le saca la coma final del segundo renglón'],
  ['sitio:catar.pasos[].nombre', 'el punto final queda adentro del <b> que lleva la marca'],
  ['sitio:catar.aporteTitulo', 'el punto final queda adentro del <b> que lleva la marca'],
  ['sitio:recetas.etiquetaTip', 'los dos puntos quedan adentro del <b> que lleva la marca'],
  ['sitio:footer.lema', 'la marquesina le agrega el separador " ·" a cada copia'],
  ['sitio:footer.legalesNota', 'va en minúsculas y entre paréntesis'],
  ['sitio:minis.precio', 'precioMXN() le pone el signo $'],
  // Hoy vale `null` y no tiene nodo, así que no hay nada que comparar;
  // la entrada está puesta de antemano para el día que la clienta le
  // ponga un precio y el nodo aparezca solo. Por eso el test de
  // podredumbre de más abajo no exige que cada entrada tenga nodo hoy.
  ['sitio:negocios.tabs.0.precio', 'precioMXN() le pone el signo $'],
  ['sabores:sabores[].precio', 'precioMXN() le pone el signo $'],
  ['sabores:polvo[].nombre', 'se muestra en minúsculas'],
  ['sitio:anaquel.envolturaAltPrefijo', 'el alt le agrega el nombre del sabor elegido'],
  ['sitio:anaquel.ilustracionAltPrefijo', 'el alt le agrega el nombre del sabor elegido'],
  ['sitio:polvo.altPrefijo', 'el alt le agrega el nombre de la etiqueta de polvo'],
])

const DOCUMENTOS = {
  sitio: { esquema: esquemaSitio, datos: marca as unknown },
  sabores: { esquema: esquemaSabores, datos: { sabores, gotas, polvo, urlCatalogoBarras } as unknown },
  fichas: { esquema: esquemaFichas, datos: { fichas: fichasBase } as unknown },
} as const

type IdDocumento = keyof typeof DOCUMENTOS

/** Saca la variante de las uniones discriminadas: `bloques[]<tipo=tabla>.filas[][]` → `bloques[].filas[][]`. */
const sinVariante = (ruta: string) => ruta.replace(/<[^>]*>/g, '')

/** Las rutas que la clienta edita: las que el panel tiene que poder resaltar. */
function rutasEditables(id: IdDocumento): string[] {
  const salida: string[] = []
  recorre(DOCUMENTOS[id].esquema as never, (ruta, meta) => {
    if (!meta) return
    const quien = meta.quien ?? 'cliente'
    const control = meta.control ?? 'texto'
    if (quien === 'marcos' || control === 'oculto' || control === 'derivado') return
    salida.push(sinVariante(ruta))
  })
  return salida
}

/**
 * Si el contenido de HOY tiene algún valor mostrable en ese PATRÓN de ruta.
 *
 * Un campo opcional que hoy está en `null` —o una clave opcional que hoy no
 * está en ningún elemento de la lista— no puede tener nodo: la plantilla lo
 * saltea, y con razón. Exigirle nodo igual convierte una edición legítima
 * de la clienta («sacale el chip de polvo a esa receta», «todavía no hay
 * precio de lista para el polvo») en un deploy en rojo. Esto lo mide contra
 * el dato en vez de pedir una excepción escrita a mano por campo.
 *
 * Lo que NO afloja: un campo que sí tiene valor y no tiene nodo sigue
 * siendo huérfano, que es la regresión que (a) existe para atajar.
 */
function tieneValorHoy(id: IdDocumento, patron: string): boolean {
  const camina = (dato: unknown, partes: string[]): boolean => {
    if (dato == null) return false
    if (partes.length === 0) return typeof dato === 'string' || typeof dato === 'number'
    const [cabeza, ...resto] = partes
    const corchetes = (cabeza.match(/\[\]/g) ?? []).length
    const clave = cabeza.replace(/(\[\])+$/, '')
    let hijo: unknown = (dato as Record<string, unknown>)[clave]
    for (let nivel = 0; nivel < corchetes; nivel += 1) {
      if (!Array.isArray(hijo)) return false
      if (nivel === corchetes - 1) return hijo.some((elemento) => camina(elemento, resto))
      hijo = hijo.flat()
    }
    return camina(hijo, resto)
  }
  return camina(DOCUMENTOS[id].datos, patron.split('.'))
}

/** El valor que hay en esa ruta con índices concretos, o undefined. */
function valorEn(id: IdDocumento, ruta: string): unknown {
  let v: unknown = DOCUMENTOS[id].datos
  for (const parte of ruta.split('.')) {
    if (v == null || typeof v !== 'object') return undefined
    v = (v as Record<string, unknown>)[parte]
  }
  return v
}

/** El motivo declarado en TRANSFORMADOS para esta referencia, o undefined si el nodo tiene que mostrar el valor crudo. */
function motivoTransformado(documento: string, ruta: string): string | undefined {
  for (const [clave, motivo] of TRANSFORMADOS) {
    const corte = clave.indexOf(':')
    if (clave.slice(0, corte) !== documento) continue
    if (coincideConPatron(ruta, clave.slice(corte + 1))) return motivo
  }
  return undefined
}

/**
 * Lo que ESTE nodo muestra hoy: el textContent para un `data-campo`, el
 * valor del atributo para un `data-campo-attr`. `data-campo-alterno`
 * devuelve null a propósito — el script lo pinta DESPUÉS del build (a
 * veces sobre un elemento que ni existe en este HTML, como el visor 3D),
 * así que no hay nada que comparar contra el HTML construido.
 */
function loQueMuestra(r: Referencia): string | null {
  if (r.fuente === 'data-campo') return r.texto
  if (r.fuente === 'data-campo-attr') return r.valorAtributo
  return null
}

/**
 * Colapsa los segmentos numéricos de una ruta concreta a `[]`, SOLO para
 * agrupar el reporte de (c): los quince precios de las barras son la
 * misma transformación repetida quince veces, y listarlos quince veces
 * ahoga al resto. La comparación de valores de (c) sigue siendo nodo por
 * nodo — esto no toca esa lógica, solo el mensaje.
 */
function patronDe(ruta: string): string {
  return ruta
    .split('.')
    .map((segmento) => (/^\d+$/.test(segmento) ? '[]' : segmento))
    .join('.')
}

const referencias = hayPaginasConstruidas() ? todasLasReferencias() : []

describe('la biyección campo ↔ data-campo (spec §3.1)', () => {
  // Mismo patrón que test/css-tokens.test.ts: sin `dist/` el test no
  // puede decir nada, pero en CI la ausencia de dist/ SÍ es un error.
  const sinDist = !hayPaginasConstruidas()
  const enCI = Boolean(process.env.CI || process.env.VERCEL)
  if (sinDist && !enCI) {
    console.warn('test/panel.test.ts: no hay dist/ — corré `pnpm build:sitio` para que este test mida algo.')
  }

  it('hay páginas construidas para medir (en CI es obligatorio)', () => {
    if (sinDist && !enCI) return
    expect(hayPaginasConstruidas()).toBe(true)
  })

  it('(a) todo campo que la clienta edita tiene al menos un nodo en alguna página', () => {
    if (sinDist && !enCI) return
    const huerfanas: string[] = []
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      for (const ruta of rutasEditables(id)) {
        const clave = `${id}:${ruta}`
        const tieneNodo = referencias.some(
          (r) => r.documento === id && coincideConPatron(r.ruta, ruta),
        )
        if (tieneNodo) continue
        if (SIN_NODO.has(clave)) continue
        // Sin valor hoy no hay nada que renderizar: ver `tieneValorHoy`.
        if (!tieneValorHoy(id, ruta)) continue
        huerfanas.push(clave)
      }
    }
    expect(huerfanas).toEqual([])
  })

  it('(b) todo data-campo del HTML existe en el esquema y resuelve a un valor', () => {
    if (sinDist && !enCI) return
    const editablesPorDocumento = new Map(
      (Object.keys(DOCUMENTOS) as IdDocumento[]).map((id) => [id, rutasEditables(id)] as const),
    )
    const rotas: string[] = []
    for (const r of referencias) {
      if (!(r.documento in DOCUMENTOS)) {
        rotas.push(`${r.pagina}: documento desconocido en «${r.crudo}»`)
        continue
      }
      const id = r.documento as IdDocumento
      const enEsquema = (editablesPorDocumento.get(id) ?? []).some((ruta) =>
        coincideConPatron(r.ruta, ruta),
      )
      if (!enEsquema) {
        rotas.push(`${r.pagina}: «${r.crudo}» no es un campo editable del esquema`)
        continue
      }
      const valor = valorEn(id, r.ruta)
      if (typeof valor !== 'string' && typeof valor !== 'number') {
        rotas.push(`${r.pagina}: «${r.crudo}» no resuelve a un texto ni a un número`)
      }
    }
    expect(rotas).toEqual([])
  })

  it('(c) el nodo marcado muestra el valor crudo del campo, salvo la transformación declarada en TRANSFORMADOS', () => {
    if (sinDist && !enCI) return
    // Un solo representante por ruta-patrón: ver el comentario de
    // `patronDe`. El Map deja la primera coincidencia y descarta el
    // resto — no hace falta más para saber que la ruta está mal.
    const descalces = new Map<string, string>()
    for (const r of referencias) {
      const mostrado = loQueMuestra(r)
      if (mostrado === null) continue // data-campo-alterno: nada que medir en el build.
      if (!(r.documento in DOCUMENTOS)) continue // ya lo marca (b); acá solo interesan los que sí resuelven.
      const id = r.documento as IdDocumento
      const valor = valorEn(id, r.ruta)
      if (typeof valor !== 'string' && typeof valor !== 'number') continue // ya lo marca (b).
      const esperado = String(valor)
      if (mostrado === esperado) continue
      if (motivoTransformado(r.documento, r.ruta)) continue
      const clave = `${r.documento}:${patronDe(r.ruta)}`
      if (!descalces.has(clave)) {
        descalces.set(
          clave,
          `${clave} (${r.pagina}, «${r.crudo}»): el campo dice "${esperado}" y el HTML muestra "${mostrado}"`,
        )
      }
    }
    expect([...descalces.values()]).toEqual([])
  })

  it('TRANSFORMADOS no tiene entradas podridas: cada una sigue siendo un descalce de verdad', () => {
    if (sinDist && !enCI) return
    // El mismo riesgo que SIN_NODO: si alguien corrige la plantilla y deja
    // la entrada, la lista miente — dice que hay una transformación donde
    // ya no la hay, y (c) deja de poder detectar que ESE campo se rompió.
    const podridas: string[] = []
    for (const clave of TRANSFORMADOS.keys()) {
      const corte = clave.indexOf(':')
      const documento = clave.slice(0, corte)
      const patron = clave.slice(corte + 1)
      // Una entrada DORMIDA no está podrida: es el caso de un campo
      // opcional que hoy vale `null`, así que la plantilla no lo renderiza
      // y no hay ningún nodo contra el cual medir la transformación. La
      // entrada se deja escrita para el día que la clienta le ponga valor
      // —ese día el nodo aparece solo y la transformación ya está
      // declarada—, en vez de hacer que ESE día el deploy se caiga.
      if (!tieneValorHoy(documento as IdDocumento, patron)) continue
      const sigueSiendoDescalce = referencias.some((r) => {
        if (r.documento !== documento) return false
        if (!coincideConPatron(r.ruta, patron)) return false
        if (!(r.documento in DOCUMENTOS)) return false
        const valor = valorEn(r.documento as IdDocumento, r.ruta)
        if (typeof valor !== 'string' && typeof valor !== 'number') return false
        const mostrado = loQueMuestra(r)
        return mostrado !== null && mostrado !== String(valor)
      })
      if (!sigueSiendoDescalce) podridas.push(clave)
    }
    expect(podridas).toEqual([])
  })

  it('la lista de excepciones no está podrida: todo lo que dice existe y de verdad no tiene nodo', () => {
    if (sinDist && !enCI) return
    const editables = new Set(
      (Object.keys(DOCUMENTOS) as IdDocumento[]).flatMap((id) =>
        rutasEditables(id).map((ruta) => `${id}:${ruta}`),
      ),
    )
    const inventadas = [...SIN_NODO].filter((clave) => !editables.has(clave))
    const yaHechas = [...SIN_NODO].filter((clave) => {
      const corte = clave.indexOf(':')
      const id = clave.slice(0, corte) as IdDocumento
      const ruta = clave.slice(corte + 1)
      return referencias.some((r) => r.documento === id && coincideConPatron(r.ruta, ruta))
    })
    expect({ inventadas, yaHechas }).toEqual({ inventadas: [], yaHechas: [] })
  })

  it('las excepciones son exactamente estas cuatro y ninguna más', () => {
    // Si alguien agrega un campo editable y no lo marca, la salida más
    // barata es meterlo acá. Este test hace que esa salida cueste: hay
    // que editar la lista Y editar este número, y el diff lo muestra.
    expect([...SIN_NODO].sort()).toEqual([
      'sabores:gotas[].precio',
      'sitio:contacto.direccionPostal.codigoPostal',
      'sitio:contacto.direccionPostal.estado',
      'sitio:contacto.direccionPostal.localidad',
    ])
  })
})
