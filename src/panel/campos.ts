/*
 * El catálogo de campos del panel (Tarea 2, fase 6): los 198 campos que
 * son de ella, agrupados por sección, con sus rutas ya instanciadas contra
 * el contenido real, y leer/escribir un valor por ruta.
 *
 * El acelerador de esta tarea es `src/contenido/**`: este archivo NO
 * reimplementa nada de eso. `recorre()` (carga.ts) camina los tres
 * esquemas y da, por cada hoja, su metadato (`etiqueta`, `ayuda`,
 * `seccion`, `control`, `maxCaracteres`…) — escrito a mano, campo por
 * campo, en la fase 1. `enRutas()` (validacion.ts) instancia una ruta de
 * esquema ('recetas.lista[].titulo') contra el contenido real y da las
 * rutas concretas ('recetas.lista.2.titulo') con su valor — la MISMA
 * función que usa `validar()` para reportar en qué elemento de una lista
 * está el problema. `validarContra()` (mismo archivo) es la validación de
 * un valor contra su esquema — el mismo mensaje que vería el servidor.
 *
 * Lo único que agrega este archivo es la PLOMERÍA del panel: qué campos
 * son de ella (no de Marcos, no ocultos, no derivados), cómo se ven en
 * conjunto agrupados por sección y por instancia de lista, y cómo se lee y
 * se escribe un valor sin mutar el documento que ya se mandó a guardar.
 */
import type { z } from 'zod'
import { recorre } from '../contenido/carga'
import { validarContra, enRutas } from '../contenido/validacion'
import type { Problema } from '../contenido/validacion'
import type { MetaCampo, Seccion } from '../contenido/campos'
import { DOCUMENTOS } from '../contenido/esquema'
import type { IdDocumento } from '../contenido/esquema'
import { marca } from '../copy/sitio-marca'
import { urlCatalogoBarras, sabores, gotas, polvo } from '../copy/sabores'
import { fichasBase } from '../fichas/base'

export type { IdDocumento, Seccion, Problema }

/*
 * ---------------------------------------------------------------------
 * El contenido de hoy, en la forma de los tres documentos
 * ---------------------------------------------------------------------
 */

/** El contenido de los tres documentos, en la forma exacta que declara su esquema. */
export type Documentos = Readonly<Record<IdDocumento, unknown>>

/**
 * El contenido de hoy, tal como lo sirve el sitio — el punto de partida de
 * cada edición. Copiado y no compartido: las fachadas devuelven objetos
 * CONGELADOS (`cargar()`, en `carga.ts`) y además son módulos compartidos
 * — mutar el mismo objeto que usa `index.astro` es el bug que `injerta()`
 * (`derivados.ts`) ya pagó una vez.
 *
 * `sabores` y `fichas` se arman a mano con la forma exacta de su esquema
 * porque sus fachadas (`copy/sabores.ts`, `fichas/base.ts`) exportan
 * PARTES sueltas, cada una para lo que su propio consumidor necesita —
 * `sabores`/`gotas`/`polvo` sueltos, `fichasBase` sin el nombre de la
 * clave que lo envuelve —, no el documento entero.
 */
export function contenidoPublicado(): Documentos {
  return {
    sitio: structuredClone(marca),
    sabores: structuredClone({ urlCatalogoBarras, sabores, gotas, polvo }),
    fichas: structuredClone({ fichas: fichasBase }),
  }
}

/*
 * ---------------------------------------------------------------------
 * Qué es de ella
 * ---------------------------------------------------------------------
 */

/**
 * Quién puede editar este campo, y si el panel lo dibuja: solo lo que es
 * de ELLA. `quien: 'marcos'` son decisiones de diseño o datos legales que
 * no le pertenecen (el color de un token, el texto de la envoltura
 * impresa); `control: 'oculto'` son identificadores internos (slugs,
 * rutas, valores fijos) que romperían algo si se tocan; `control:
 * 'derivado'` son precios calculados — editarlos a mano es exactamente lo
 * que `derivados.ts` existe para evitar.
 */
function esDeElla(meta: MetaCampo | undefined): meta is MetaCampo {
  return meta !== undefined && meta.quien !== 'marcos' && meta.control !== 'oculto' && meta.control !== 'derivado'
}

/*
 * ---------------------------------------------------------------------
 * El catálogo: las 198 hojas de esquema, sin instanciar
 * ---------------------------------------------------------------------
 */

interface Hoja {
  documento: IdDocumento
  /** La ruta que emite recorre(): 'recetas.lista[].titulo'. Una por cada uno de los 198 campos. */
  rutaEsquema: string
  meta: MetaCampo
  hoja: z.ZodType
  // `| undefined` explícito y no solo `?`: bajo `exactOptionalPropertyTypes`
  // (tsconfig strict de Astro) un `?:` a secas prohíbe asignar `undefined`
  // a mano, y `recorre()` entrega exactamente eso cuando la hoja no vive
  // dentro de ninguna lista — ver `carga.ts`.
  /** La instancia de lista más cercana, si esta hoja vive dentro de una. */
  instancia: { ruta: string; meta: MetaCampo } | undefined
}

function hojasDe(documento: IdDocumento): Hoja[] {
  const salida: Hoja[] = []
  recorre(DOCUMENTOS[documento], (rutaEsquema, meta, hoja, instancia) => {
    if (!esDeElla(meta)) return
    salida.push({ documento, rutaEsquema, meta, hoja, instancia })
  })
  return salida
}

/*
 * ---------------------------------------------------------------------
 * Los grupos de lista: «Receta: peras al vino», no «Receta 3»
 * ---------------------------------------------------------------------
 */

export interface GrupoDeInstancia {
  /** Ruta concreta de la instancia: 'recetas.lista.2'. */
  ruta: string
  /** Calculada con `nombra`, contra el valor real de esa instancia. */
  etiqueta: string
}

/**
 * Una entrada por cada instancia de lista cuyo elemento declara `nombra`,
 * indexada por su ruta CONCRETA ('recetas.lista.2'). `hojasDe()` visita
 * cada instancia-de-lista tantas veces como campos tiene su elemento —acá
 * alcanza con procesarla la primera vez, `vistas` evita repetir el trabajo
 * las demás.
 */
function gruposDe(contenido: unknown, hojas: readonly Hoja[]): Map<string, GrupoDeInstancia> {
  const grupos = new Map<string, GrupoDeInstancia>()
  const vistas = new Set<string>()
  for (const { instancia } of hojas) {
    if (!instancia || typeof instancia.meta.nombra !== 'function') continue
    if (vistas.has(instancia.ruta)) continue
    vistas.add(instancia.ruta)
    const nombra = instancia.meta.nombra
    for (const { ruta, valor } of enRutas(contenido, instancia.ruta)) {
      grupos.set(ruta, { ruta, etiqueta: nombra(valor) })
    }
  }
  return grupos
}

/** El grupo más específico (la ruta más larga) que contiene esta ruta concreta, si hay alguno. */
function grupoDe(grupos: Map<string, GrupoDeInstancia>, ruta: string): GrupoDeInstancia | undefined {
  let mejor: GrupoDeInstancia | undefined
  for (const g of grupos.values()) {
    if (ruta !== g.ruta && !ruta.startsWith(`${g.ruta}.`)) continue
    if (!mejor || g.ruta.length > mejor.ruta.length) mejor = g
  }
  return mejor
}

/*
 * ---------------------------------------------------------------------
 * El catálogo instanciado: lo que el panel dibuja
 * ---------------------------------------------------------------------
 */

export interface CampoEditable {
  documento: IdDocumento
  /** Ruta concreta, con índices reales: 'recetas.lista.2.titulo'. La usa `leer()`/`escribirValor()`. */
  ruta: string
  /** Ruta de esquema, tal como la emite `recorre()`: 'recetas.lista[].titulo'. Una por cada uno de los 198 campos. */
  rutaEsquema: string
  meta: MetaCampo
  valor: unknown
  // `| undefined` explícito por la misma razón que `Hoja.instancia`, más
  // arriba: `exactOptionalPropertyTypes` prohíbe asignarle `undefined` a
  // mano a un `?:` a secas, y `grupoDe()` devuelve exactamente eso cuando
  // el campo no vive dentro de ninguna lista con `nombra`.
  /** El grupo de lista más cercano al que pertenece este campo, si hay uno. */
  grupo: GrupoDeInstancia | undefined
  /** Valida un valor nuevo para ESTE campo — el mismo mensaje que vería el servidor. */
  validar: (valor: unknown) => Problema[]
}

/**
 * Reordena de «por campo» (todos los kickers, después todos los títulos…)
 * a «por instancia» (los ocho campos de la receta 0, después los ocho de
 * la receta 1…), que es como se lee en el panel. No hace falta comparar
 * índices a mano: agrupar por la ruta del grupo más cercano y conservar,
 * dentro de cada grupo, el orden de LLEGADA alcanza, porque ese orden de
 * llegada YA es el del esquema (un campo por hoja, en el orden en que
 * `campos()` las procesa más abajo) — y `Map` conserva el orden de
 * inserción de sus claves, así que el primer grupo visto es el primero
 * en salir.
 *
 * Límite conocido: cuando una lista es una unión discriminada (los
 * bloques de una ficha: párrafo, lista o tabla), cada FORMA es su propia
 * hoja de esquema, así que sus campos llegan agrupados por forma antes
 * que por instancia real. El agrupamiento entre bloques del mismo tipo
 * queda correcto igual; entre bloques de tipos distintos dentro de la
 * misma sección, no. Rehacerlo con el orden perfecto pide caminar el
 * ÁRBOL guiado por el contenido en vez de por hoja de esquema — más
 * trabajo del que esta entrega necesita, y ningún campo queda invisible
 * ni mal etiquetado: solo el orden relativo entre TIPOS de bloque.
 */
function porInstancia(items: readonly CampoEditable[]): CampoEditable[] {
  const baldes = new Map<string, CampoEditable[]>()
  let sueltos = 0
  for (const item of items) {
    // Un campo sin grupo es su propia instancia de uno: una clave única
    // (el contador, no la ruta) evita que dos campos sueltos de distinta
    // sección se mezclen si alguna vez compartieran ruta por casualidad.
    const clave = item.grupo ? `${item.documento} ${item.grupo.ruta}` : ` suelto ${sueltos++}`
    const balde = baldes.get(clave)
    if (balde) balde.push(item)
    else baldes.set(clave, [item])
  }
  return [...baldes.values()].flat()
}

/**
 * El catálogo instanciado: los 198 campos de esquema, con sus rutas
 * concretas contra `documentos` — una ruta de lista se vuelve tantos
 * campos como elementos tenga esa lista hoy.
 */
export function campos(documentos: Documentos): CampoEditable[] {
  const salida: CampoEditable[] = []
  for (const documento of Object.keys(DOCUMENTOS) as IdDocumento[]) {
    const contenido = documentos[documento]
    const hojas = hojasDe(documento)
    const grupos = gruposDe(contenido, hojas)
    for (const h of hojas) {
      for (const { ruta, valor } of enRutas(contenido, h.rutaEsquema)) {
        salida.push({
          documento,
          ruta,
          rutaEsquema: h.rutaEsquema,
          meta: h.meta,
          valor,
          grupo: grupoDe(grupos, ruta),
          validar: (v: unknown) => validarContra(h.hoja, v),
        })
      }
    }
  }
  return porInstancia(salida)
}

/*
 * ---------------------------------------------------------------------
 * Leer y escribir un valor por ruta
 * ---------------------------------------------------------------------
 */

function partes(ruta: string): (string | number)[] {
  return ruta === '' ? [] : ruta.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p))
}

/** Lee el valor en una ruta concreta ('recetas.lista.2.titulo') de UN documento. */
export function leer(contenido: unknown, ruta: string): unknown {
  let actual: unknown = contenido
  for (const parte of partes(ruta)) {
    if (actual === null || typeof actual !== 'object') return undefined
    actual = (actual as Record<string | number, unknown>)[parte]
  }
  return actual
}

/**
 * Escribe un valor en una ruta concreta de UN documento, devolviendo una
 * COPIA — nunca muta el que recibe. Solo se copian los nodos del CAMINO
 * (el objeto raíz, y cada contenedor hasta llegar a la clave): todo lo
 * demás sigue siendo el mismo objeto de antes, así que React sabe qué
 * cambió sin que este archivo tenga que decírselo.
 */
export function escribir(contenido: unknown, ruta: string, valor: unknown): unknown {
  const camino = partes(ruta)
  if (camino.length === 0) return valor

  const copiaDe = (v: unknown): Record<string | number, unknown> =>
    Array.isArray(v) ? ([...v] as unknown as Record<string | number, unknown>) : { ...(v as Record<string, unknown>) }

  const raiz = copiaDe(contenido)
  let actual = raiz
  for (let i = 0; i < camino.length - 1; i++) {
    const parte = camino[i]
    const copiaHija = copiaDe(actual[parte])
    actual[parte] = copiaHija
    actual = copiaHija
  }
  actual[camino[camino.length - 1]] = valor
  return raiz
}

/**
 * Escribe el valor de un campo en `documentos`, propagándolo también a
 * sus rutas hermanas (`meta.escribeTambien`: el correo vive en cuatro
 * lugares, y tres de ellos son rutas hermanas del mismo documento). Nunca
 * muta `documentos`: devuelve el objeto siguiente.
 */
export function escribirValor(documentos: Documentos, campo: CampoEditable, valor: unknown): Documentos {
  let contenido = escribir(documentos[campo.documento], campo.ruta, valor)
  for (const hermana of campo.meta.escribeTambien ?? []) {
    contenido = escribir(contenido, hermana, valor)
  }
  return { ...documentos, [campo.documento]: contenido }
}

/*
 * ---------------------------------------------------------------------
 * Las secciones, en el orden en que la clienta las ve en el panel
 * ---------------------------------------------------------------------
 */

/**
 * El orden de navegación del panel: el de la página, de arriba hacia
 * abajo, y las cuatro secciones técnicas (fichas, buscadores,
 * accesibilidad, la página de error) al final — existen, pero no son
 * lo primero que ella va a querer tocar.
 */
export const SECCIONES: readonly Seccion[] = [
  'portada', 'productos', 'sabores', 'catar', 'recetas', 'nosotros',
  'negocios', 'preguntas', 'contacto', 'pie',
  'fichas', 'buscadores', 'accesibilidad', 'no-encontrada',
]

/** Cómo se llama cada sección en el panel — en su idioma, sin nombrar el esquema. */
export const ETIQUETA_DE_SECCION: Readonly<Record<Seccion, string>> = {
  portada: 'Portada',
  productos: 'Productos',
  sabores: 'Anaquel de sabores',
  catar: 'Cómo catar',
  recetas: 'Recetas',
  nosotros: 'Nosotros',
  negocios: 'Para negocios',
  preguntas: 'Preguntas frecuentes',
  contacto: 'Contacto',
  pie: 'Pie de página',
  fichas: 'Fichas técnicas',
  buscadores: 'Buscadores',
  accesibilidad: 'Accesibilidad',
  'no-encontrada': 'Página de enlace roto',
}

/** Los campos de una sección, ya agrupados por instancia — lo que pinta cada pestaña del panel. */
export function camposDeSeccion(todos: readonly CampoEditable[], seccion: Seccion): CampoEditable[] {
  return todos.filter((c) => c.meta.seccion === seccion)
}
