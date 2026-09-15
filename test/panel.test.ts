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
  'sitio:preguntas.kicker',
  'sitio:preguntas.titulo',
  'sitio:preguntas.items[].p',
  'sitio:preguntas.items[].r',
  'sitio:contacto.kicker',
  'sitio:contacto.titulo',
  'sitio:contacto.puestoEtiqueta',
  'sitio:contacto.puestoTitulo.0',
  'sitio:contacto.puestoTitulo.1',
  'sitio:contacto.direccion.0',
  'sitio:contacto.direccion.1',
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
  'sitio:contacto.correoEtiqueta',
  'sitio:contacto.correo',
  'sitio:contacto.correoNota',
  'sitio:contacto.copiar',
  'sitio:contacto.copiado',
  'sitio:contacto.redesEtiqueta',
  'sitio:contacto.redes',
  'sitio:contacto.redesNota',
  'sitio:contacto.catalogoEtiqueta',
  'sitio:contacto.catalogoNombre',
  'sitio:contacto.catalogoNota',
  'sitio:contacto.personajeAlt',
  'sitio:contacto.formulario.titulo',
  'sitio:contacto.formulario.nombre',
  'sitio:contacto.formulario.correo',
  'sitio:contacto.formulario.tipo',
  'sitio:contacto.formulario.tipoOpciones.0.texto',
  'sitio:contacto.formulario.tipoOpciones.1.texto',
  'sitio:contacto.formulario.mensaje',
  'sitio:contacto.formulario.mensajeEjemplo',
  'sitio:contacto.formulario.enviar',
  'sitio:contacto.formulario.enviando',
  'sitio:contacto.formulario.nota',
  'sitio:contacto.formulario.exitoTitulo',
  'sitio:contacto.formulario.exitoSub',
  'sitio:contacto.formulario.otraVez',
  'sitio:contacto.formulario.aviso',
  'sitio:contacto.formulario.asuntoPersonal',
  'sitio:contacto.formulario.asuntoNegocio',
  'sitio:fichasTecnicas.titulo',
  'sitio:fichasTecnicas.descripcion',
  'sitio:fichasTecnicas.kicker',
  'sitio:fichasTecnicas.encabezado',
  'sitio:fichasTecnicas.sub',
  'sitio:fichasTecnicas.tipoDocumento',
  'sitio:fichasTecnicas.indiceAria',
  'sitio:fichasTecnicas.descargar',
  'sitio:fichasTecnicas.descargarNota',
  'sitio:fichasTecnicas.volver',
  'sitio:fichasTecnicas.contactoNota',
  'sitio:noEncontrada.titulo',
  'sitio:noEncontrada.encabezado',
  'sitio:noEncontrada.sub',
  'sitio:noEncontrada.cta',
  'sitio:footer.lema',
  'sitio:footer.linea',
  'sitio:footer.seccionesTitulo',
  'sitio:footer.productosTitulo',
  'sitio:footer.contactoTitulo',
  'sitio:footer.legalesTitulo',
  'sitio:footer.productos[].texto',
  'sitio:footer.legales[]',
  'sitio:footer.legalesNota',
  'sitio:footer.derechos',
  'sabores:gotas[].precio',
  'fichas:fichas[].producto',
  'fichas:fichas[].denominacion',
  'fichas:fichas[].meta[].0',
  'fichas:fichas[].meta[].1',
  'fichas:fichas[].secciones[].titulo',
  'fichas:fichas[].secciones[].bloques[].texto',
  'fichas:fichas[].secciones[].bloques[].items[]',
  'fichas:fichas[].secciones[].bloques[].encabezados[]',
  'fichas:fichas[].secciones[].bloques[].filas[][]',
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
