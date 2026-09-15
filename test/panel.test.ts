/*
 * LA BIYECCIÓN CAMPO ↔ HTML, en los dos sentidos y por página (spec §3.1).
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
 * renderizan en build— y esa versión del test no puede pasar.
 */
import { describe, it, expect } from 'vitest'
import { recorre } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { esquemaFichas } from '../src/contenido/esquema/fichas'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '@/copy/sabores'
import { fichasBase } from '@/fichas/base'
import { todasLasReferencias, coincideConPatron, hayPaginasConstruidas } from './lib/campos-en-html'

/**
 * Los campos editables que NO tienen ningún nodo en el HTML, con su razón.
 * No es una lista de pendientes: es la lista de excepciones, y cada línea
 * tiene que poder defenderse sola. Agregar una es una decisión, no un
 * atajo — el panel de la fase 6 tiene que tratar a estos campos distinto
 * (vista previa textual, sin resaltado), y esta lista es de dónde lo saca.
 */
const SIN_NODO = new Set<string>([
  // El polvo todavía no tiene precio (`null`), así que la plantilla no
  // renderiza ningún nodo. El día que la clienta le ponga uno, el nodo
  // aparece con su data-campo y esta línea se borra.
  'sitio:negocios.tabs.0.precio',

  // Es un campo editable, pero ninguna plantilla lo renderiza: el precio
  // que se ve del bloque de gotas es el derivado `gotas.precioDesde` (el
  // mínimo de los seis), nunca el precio suelto de una gota individual. No
  // hay texto de este campo en ninguna página al que colgarle un nodo.
  'sabores:gotas[].precio',

  // El <form> lleva los dos asuntos en data-asunto-*, y `data-campo-attr`
  // es un solo atributo por elemento. El panel los edita juntos desde la
  // ficha del formulario.
  'sitio:contacto.formulario.asuntoNegocio',

  // Los tres viven solo adentro del JSON-LD del <head>, que es un bloque
  // de JSON y no un nodo de texto. Vista previa textual, sin resaltado
  // (spec §1.7).
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
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

/** El valor que hay en esa ruta con índices concretos, o undefined. */
function valorEn(id: IdDocumento, ruta: string): unknown {
  let v: unknown = DOCUMENTOS[id].datos
  for (const parte of ruta.split('.')) {
    if (v == null || typeof v !== 'object') return undefined
    v = (v as Record<string, unknown>)[parte]
  }
  return v
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

  it('las excepciones son exactamente estas seis y ninguna más', () => {
    // Si alguien agrega un campo editable y no lo marca, la salida más
    // barata es meterlo acá. Este test hace que esa salida cueste: hay
    // que editar la lista Y editar este número, y el diff lo muestra.
    expect([...SIN_NODO].sort()).toEqual([
      'sabores:gotas[].precio',
      'sitio:contacto.direccionPostal.codigoPostal',
      'sitio:contacto.direccionPostal.estado',
      'sitio:contacto.direccionPostal.localidad',
      'sitio:contacto.formulario.asuntoNegocio',
      'sitio:negocios.tabs.0.precio',
    ])
  })
})
