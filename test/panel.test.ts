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
 * LO QUE FALTA MARCAR. Cada tarea de la fase 2 Parte B borra de acá las
 * rutas que marcó; la última tarea borra la lista entera y este archivo
 * pasa a exigir la biyección completa.
 *
 * El test falla de las dos maneras a propósito: una ruta editable sin
 * nodo que NO esté acá es una regresión, y una ruta que está acá pero ya
 * tiene nodo es una lista podrida que le miente al que la lee.
 */
const PENDIENTES = new Set<string>([
  'sitio:titulo',
  'sitio:descripcion',
  'sitio:marca.nombre',
  'sitio:nav.cerrar',
  // El polvo todavía no tiene precio (`null`), así que la plantilla no
  // renderiza ningún nodo. Cuando la clienta le ponga uno, el nodo aparece
  // con su data-campo y esta línea se borra. Antes no.
  'sitio:negocios.tabs.0.precio',
  // Los tres campos de la dirección que lee Google (localidad, estado,
  // código postal) no tienen nodo en el cuerpo de la página: viven solo en
  // el JSON-LD del <head> (PostalAddress). Los marca la Tarea 12, que se
  // ocupa del <head>.
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
  // El script lo pinta sobre el botón de copiar en runtime (Parte A,
  // textos-ui): no está en el HTML que construye Astro. Se resuelve en la
  // Tarea 13.
  'sitio:contacto.copiado',
  // El script lo pinta sobre el botón de enviar mientras el formulario
  // manda el mensaje (Parte A, textos-ui): no está en el HTML que
  // construye Astro. Se resuelve en la Tarea 13.
  'sitio:contacto.formulario.enviando',
  // El <form> lleva los dos asuntos en data-asunto-*; `data-campo-attr` es
  // un solo atributo por elemento. Se resuelve en la fase 6, cuando el
  // panel tenga la ficha del formulario: ahí los dos se editan juntos y
  // ninguno de los dos necesita nodo propio. Ver spec §1.7.
  'sitio:contacto.formulario.asuntoNegocio',
  // El <title> de esta página sale del prop `titulo` de Base.astro: lo
  // marca la Tarea 12, que es dueña del <head> compartido de las tres
  // páginas. Ver Tarea 11.
  'sitio:fichasTecnicas.titulo',
  // Mismo caso que el título: `descripcion` solo alimenta la meta
  // description, el og:description y el twitter:description del <head>
  // de Base.astro (prop `descripcion`) — no hay ningún nodo en el cuerpo
  // de fichas-tecnicas.astro donde colgarle el data-campo, así que le
  // toca a la Tarea 12 igual que el título.
  'sitio:fichasTecnicas.descripcion',
  // El <title> de esta página también sale del prop `titulo` de
  // Base.astro: mismo caso que fichasTecnicas.titulo, lo marca la
  // Tarea 12.
  'sitio:noEncontrada.titulo',
  'sabores:gotas[].precio',
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
        if (PENDIENTES.has(clave)) continue
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

  it('la lista de pendientes no está podrida: todo lo que dice existe y falta de verdad', () => {
    if (sinDist && !enCI) return
    const editables = new Set(
      (Object.keys(DOCUMENTOS) as IdDocumento[]).flatMap((id) =>
        rutasEditables(id).map((ruta) => `${id}:${ruta}`),
      ),
    )
    const inventadas = [...PENDIENTES].filter((clave) => !editables.has(clave))
    const yaHechas = [...PENDIENTES].filter((clave) => {
      const corte = clave.indexOf(':')
      const id = clave.slice(0, corte) as IdDocumento
      const ruta = clave.slice(corte + 1)
      return referencias.some((r) => r.documento === id && coincideConPatron(r.ruta, ruta))
    })
    expect({ inventadas, yaHechas }).toEqual({ inventadas: [], yaHechas: [] })
  })
})
