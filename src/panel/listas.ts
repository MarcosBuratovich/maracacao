/*
 * Dónde se puede dar de alta y de baja un ítem, y cómo (Tarea 3, fase 7).
 *
 * De los catorce grupos repetibles del contenido, solo CINCO tienen todos
 * sus campos en poder de la clienta: en los otros nueve falta un dato que
 * maneja Marcos (la clave de color de un sabor sale de un enum del código;
 * el % de cacao y los ingredientes tienen que decir lo mismo que la
 * envoltura impresa). Agregar o quitar un ítem en esos nueve dejaría un
 * producto a medio crear — a medio crear, no a medio EDITAR, que es lo que
 * el resto del panel ya sabe hacer. Por eso el alta y la baja existen
 * SOLO en los cinco: `listasAbiertas()` decide cuáles son.
 *
 * Esa decisión se CALCULA recorriendo el esquema, no se escribe a mano en
 * una constante: el día que un campo cambie de dueño, la lista tiene que
 * aparecer o desaparecer sola, sin que nadie se acuerde de tocar este
 * archivo.
 *
 * El ítem que arma `agregarItem()` puede venir con un campo en un estado
 * que no pasa `validar()` (un precio en null cuando el esquema pide un
 * entero) — es a propósito: ver el comentario de `valorVacioDe()`.
 */
import type { z } from 'zod'
import type { Documentos, IdDocumento } from './campos'
import { leer, escribir } from './campos'
import { DOCUMENTOS } from '../contenido/esquema'
import { recorre } from '../contenido/carga'
import { panel } from '../contenido/campos'
import type { MetaCampo } from '../contenido/campos'

export interface ListaAbierta {
  documento: IdDocumento
  /** La ruta de esquema de la lista misma, tal como la emite `recorre()`: 'cocoas.lista[]'. */
  rutaEsquema: string
  etiqueta: string
  minItems: number
  maxItems: number
}

/*
 * ---------------------------------------------------------------------
 * Qué es de ella, ENTERO — la misma pregunta que campos.ts, aplicada al
 * GRUPO y no al campo suelto
 * ---------------------------------------------------------------------
 */

/**
 * Igual que `esDeElla()` en `campos.ts` (no exportada de ahí, así que se
 * repite acá: es una sola línea y la regla la fija el diseño, no este
 * archivo): `quien: 'marcos'` son decisiones o datos que no son de ella;
 * `control: 'oculto'` son identificadores internos; `control: 'derivado'`
 * son precios calculados. Un solo campo en cualquiera de los tres estados
 * alcanza para que la clienta NO pueda dar de alta sola.
 */
function esDeElla(meta: MetaCampo | undefined): meta is MetaCampo {
  return meta !== undefined && meta.quien !== 'marcos' && meta.control !== 'oculto' && meta.control !== 'derivado'
}

/*
 * ---------------------------------------------------------------------
 * El nodo de la LISTA, no el de sus hojas
 * ---------------------------------------------------------------------
 */

/**
 * Encuentra el nodo de la LISTA en el árbol del esquema, a partir de su
 * ruta ('cocoas.lista[]', 'fichas[].meta[]'). `recorre()` (contenido/carga.ts)
 * visita únicamente HOJAS: el minItems/maxItems que `lista()`
 * (contenido/campos.ts) registra vive en el nodo de la lista MISMA, y
 * `recorre()` nunca se lo entrega a nadie — solo a sus descendientes, vía
 * `instancia`. Hay que ir a buscarlo aparte.
 *
 * Baja por la misma forma de ruta que emite `recorre()`, con la API
 * PÚBLICA de Zod (`.shape` de un objeto, `.element` de un arreglo) — nunca
 * con `_zod.def`: esa es la línea que `carga.ts` se reserva para sí mismo,
 * a propósito, para que una versión nueva de Zod falle en UN solo lugar.
 *
 * Alcanza con UN solo par de corchetes por segmento — es la forma real de
 * las cinco listas de hoy y de cualquier lista que no sea, a su vez, una
 * lista de listas (el caso 'filas[][]' de una tabla, que ninguna de las
 * cinco es).
 */
function nodoDeLista(raiz: z.ZodType, rutaEsquema: string): z.ZodType {
  const partes = rutaEsquema.split('.')
  let actual: z.ZodType = raiz
  partes.forEach((parte, i) => {
    const esUltima = i === partes.length - 1
    const clave = parte.endsWith('[]') ? parte.slice(0, -2) : parte
    actual = (actual as unknown as { shape: Record<string, z.ZodType> }).shape[clave]
    // El último par de corchetes del último segmento ES la lista que se
    // busca: ahí hay que PARAR. Cualquier otro `[]` es una lista
    // intermedia por la que solo se está de paso (como 'fichas[]' antes
    // de llegar a '.meta[]') y hay que atravesarla para seguir bajando.
    if (parte.endsWith('[]') && !esUltima) {
      actual = (actual as unknown as { element: z.ZodType }).element
    }
  })
  return actual
}

/**
 * Un «ítem» es un bloque con forma —campos nombrados (`grupo`) o
 * posiciones fijas (`tupla`)—, no un renglón suelto de texto. Una lista de
 * viñetas sencillas (los datos de un panel de «Para negocios», una fila de
 * ingredientes) no entra acá: no es uno de los catorce grupos repetibles
 * del contenido, y «dar de alta un ítem» no tiene sentido para un string
 * suelto. `campos`/`partes` los pone únicamente `grupo()`/`tupla()`
 * (`contenido/campos.ts`) en el metadato del ELEMENTO.
 */
function esCompuesto(metaElemento: MetaCampo): boolean {
  return metaElemento.campos !== undefined || metaElemento.partes !== undefined
}

/**
 * Las listas que la clienta controla ENTERA: los catorce grupos repetibles
 * del contenido, filtrados a los que no tienen NINGÚN campo de Marcos, ni
 * oculto, ni derivado — en NINGÚN nivel de su interior, incluidas las
 * listas anidadas adentro (una sección de ficha tiene `titulo`, que es de
 * ella, pero también `bloques`, y cada bloque lleva un `tipo` fijo que no
 * lo es: eso basta para que la sección ENTERA quede cerrada, aunque
 * `titulo` solo, mirado aislado, se vea abierto).
 *
 * Por esa razón se arma en DOS pasadas: la primera junta, para cada
 * documento, la lista COMPLETA de hojas (con su ruta de esquema tal cual
 * la emite `recorre()`) y el conjunto de candidatas —instancias de lista
 * cuyo elemento es compuesto—; la segunda decide cada candidata mirando
 * TODAS las hojas cuya ruta cae DENTRO de la suya, sin importar a qué
 * instancia más cercana las haya asignado `recorre()`.
 */
export function listasAbiertas(): ListaAbierta[] {
  const salida: ListaAbierta[] = []

  for (const documento of Object.keys(DOCUMENTOS) as IdDocumento[]) {
    const hojas: Array<{ ruta: string; meta: MetaCampo | undefined }> = []
    const candidatas = new Set<string>()

    recorre(DOCUMENTOS[documento], (ruta, meta, _hoja, instancia) => {
      hojas.push({ ruta, meta })
      if (!instancia) return
      // `instancia.ruta` también marca la variante de una unión
      // ('bloques[]<tipo=parrafo>'): eso no es un arreglo con
      // minItems/maxItems propios, y no se puede dar de alta ni de baja
      // como si fuera un elemento suelto de una lista.
      if (!instancia.ruta.endsWith('[]')) return
      if (!esCompuesto(instancia.meta)) return
      candidatas.add(instancia.ruta)
    })

    for (const rutaEsquema of candidatas) {
      const prefijo = `${rutaEsquema}.`
      const abierta = hojas
        .filter((h) => h.ruta.startsWith(prefijo))
        .every((h) => esDeElla(h.meta))
      if (!abierta) continue

      const nodo = nodoDeLista(DOCUMENTOS[documento], rutaEsquema)
      const meta = panel.get(nodo) as MetaCampo | undefined
      const { etiqueta, minItems, maxItems } = meta ?? {}
      if (etiqueta === undefined || minItems === undefined || maxItems === undefined) {
        // Si esto salta, no es un dato de la clienta: es que una lista
        // candidata llegó hasta acá sin haber pasado por `lista()`, y eso
        // es un bug de este archivo, no del contenido.
        throw new Error(`listasAbiertas(): «${documento}:${rutaEsquema}» no tiene minItems/maxItems registrados.`)
      }
      salida.push({ documento, rutaEsquema, etiqueta, minItems, maxItems })
    }
  }

  return salida
}

/*
 * ---------------------------------------------------------------------
 * De una ruta CONCRETA a la lista abierta que le corresponde
 * ---------------------------------------------------------------------
 */

/**
 * 'cocoas.lista' → 'cocoas.lista[]'; 'fichas.2.meta' → 'fichas[].meta[]'.
 * La misma forma de ruta que arma `recorre()` para una lista: un índice
 * numérico se pega con `[]` a la clave anterior, SIN punto — nunca es un
 * segmento propio — y el campo mismo, que siempre es una lista acá, cierra
 * con su propio `[]`.
 */
function aRutaEsquema(rutaLista: string): string {
  const salida: string[] = []
  for (const parte of rutaLista.split('.')) {
    if (/^\d+$/.test(parte)) salida[salida.length - 1] += '[]'
    else salida.push(parte)
  }
  return `${salida.join('.')}[]`
}

/** 'cocoas.lista.0' → { rutaLista: 'cocoas.lista', indice: 0 }. */
function padreYDindice(rutaItem: string): { rutaLista: string; indice: number } {
  const corte = rutaItem.lastIndexOf('.')
  return { rutaLista: rutaItem.slice(0, corte), indice: Number(rutaItem.slice(corte + 1)) }
}

/** `undefined` si `rutaLista` no es una de las listas donde ella puede dar de alta o de baja sola. */
function buscarLista(documento: IdDocumento, rutaLista: string): ListaAbierta | undefined {
  const rutaEsquema = aRutaEsquema(rutaLista)
  return listasAbiertas().find((l) => l.documento === documento && l.rutaEsquema === rutaEsquema)
}

/*
 * ---------------------------------------------------------------------
 * Puede / no puede
 * ---------------------------------------------------------------------
 */

export function puedeAgregar(documentos: Documentos, documento: IdDocumento, rutaLista: string): boolean {
  const lista = buscarLista(documento, rutaLista)
  if (!lista) return false
  const actuales = leer(documentos[documento], rutaLista) as unknown[]
  return actuales.length < lista.maxItems
}

export function puedeBorrar(documentos: Documentos, documento: IdDocumento, rutaLista: string): boolean {
  const lista = buscarLista(documento, rutaLista)
  if (!lista) return false
  const actuales = leer(documentos[documento], rutaLista) as unknown[]
  return actuales.length > lista.minItems
}

/*
 * ---------------------------------------------------------------------
 * El ítem vacío
 * ---------------------------------------------------------------------
 */

/**
 * El valor de arranque de UN campo del ítem nuevo, según su control.
 *
 * Los de texto arrancan en `''`; TODOS los demás arrancan en `null` —
 * nunca en `0` ni en cualquier otro valor inventado. Para `precioChico`
 * (control `precio`, que no acepta `null`) esto deja al ítem sin pasar
 * `validar()` hasta que ella cargue un precio de verdad, y es exactamente
 * lo que se busca: un producto recién agregado ESTÁ incompleto, y
 * publicarle un precio inventado (un `1` cualquiera, para que la
 * validación no se queje) sería mentirle a quien compra. El sistema ya
 * tiene quién avise — `validar()` en el panel mientras ella escribe, y el
 * servidor al publicar, con el mismo mensaje — así que no hace falta
 * inventar nada acá.
 */
function valorVacioDe(meta: MetaCampo | undefined): unknown {
  return meta?.control === 'texto' || meta?.control === 'parrafo' ? '' : null
}

/**
 * El elemento nuevo de una lista, con cada campo en su valor vacío — NUNCA
 * clonado del último elemento: clonar deja dos productos iguales
 * publicados, y la clienta tendría que acordarse de cambiar todo.
 *
 * La FORMA del elemento —un bloque con nombres, como «Una cocoa» (nombre,
 * perfil, precioChico…), o una tira de posiciones fijas, como un renglón
 * de «Datos de cabecera» (nombre del dato, valor del dato)— sale de
 * recorrer el esquema, no de escribirla a mano: si mañana una de las
 * cinco listas gana o pierde un campo, el elemento nuevo la sigue solo.
 */
function itemVacio(documento: IdDocumento, rutaLista: string): unknown {
  const rutaEsquema = aRutaEsquema(rutaLista)
  const prefijo = `${rutaEsquema}.`
  const campos: Array<{ clave: string; meta: MetaCampo | undefined }> = []

  recorre(DOCUMENTOS[documento], (ruta, meta, _hoja, instancia) => {
    if (instancia?.ruta !== rutaEsquema || !ruta.startsWith(prefijo)) return
    const clave = ruta.slice(prefijo.length)
    // Un punto acá significa que el campo vive más adentro que un solo
    // nivel (un grupo anidado dentro del elemento). Ninguna de las cinco
    // listas de hoy lo tiene; si alguna lo gana, ese campo queda afuera
    // del ítem vacío en vez de que este archivo intente adivinar cómo
    // anidarlo.
    if (clave.includes('.')) return
    campos.push({ clave, meta })
  })

  // Una tira (tupla) tiene posiciones numéricas — '0', '1' — en vez de
  // nombres: es la forma de 'fichas[].meta[]'. Un bloque (grupo) tiene
  // nombres — 'nombre', 'precioChico' —: es la forma de las otras cuatro.
  const esTira = campos.length > 0 && campos.every((c) => /^\d+$/.test(c.clave))
  if (esTira) {
    const tira: unknown[] = []
    for (const { clave, meta } of campos) tira[Number(clave)] = valorVacioDe(meta)
    return tira
  }
  const bloque: Record<string, unknown> = {}
  for (const { clave, meta } of campos) bloque[clave] = valorVacioDe(meta)
  return bloque
}

/*
 * ---------------------------------------------------------------------
 * Alta y baja
 * ---------------------------------------------------------------------
 */

export function agregarItem(documentos: Documentos, documento: IdDocumento, rutaLista: string): Documentos {
  const lista = buscarLista(documento, rutaLista)
  if (!lista) {
    throw new Error(`No se puede agregar en «${rutaLista}»: no es una lista donde ella dé de alta sola.`)
  }
  const actuales = leer(documentos[documento], rutaLista) as unknown[]
  // El chequeo se repite acá — `puedeAgregar()` ya lo dice antes — porque
  // la interfaz no puede ser el único guardia: quien llame a esta función
  // directo, sin pasar por el botón que ya está deshabilitado, tampoco
  // puede pasarse del máximo.
  if (actuales.length >= lista.maxItems) {
    throw new Error(`No se puede agregar: ya está en el máximo de ${lista.maxItems}.`)
  }
  const contenido = escribir(documentos[documento], rutaLista, [...actuales, itemVacio(documento, rutaLista)])
  return { ...documentos, [documento]: contenido }
}

export function quitarItem(documentos: Documentos, documento: IdDocumento, rutaItem: string): Documentos {
  const { rutaLista, indice } = padreYDindice(rutaItem)
  const lista = buscarLista(documento, rutaLista)
  if (!lista) {
    throw new Error(`No se puede quitar de «${rutaLista}»: no es una lista donde ella dé de baja sola.`)
  }
  const actuales = leer(documentos[documento], rutaLista) as unknown[]
  // `actuales.filter((_, i) => i !== indice)` no se queja si `indice` no
  // matchea ningún elemento: simplemente no saca nada, y de ahí abajo
  // sale un documento «nuevo» que en realidad es idéntico al de entrada.
  // Sin este chequeo, un índice que no existe (`999`, `-1`, o `NaN` por un
  // `rutaItem` mal formado como 'cocoas.lista.abc') hace que la pantalla
  // le muestre a ella la confirmación de un borrado que nunca pasó.
  // `Number.isInteger()` hace falta ADEMÁS de `indice < 0`: `NaN < 0` da
  // `false`, así que un `NaN` solo, sin este chequeo, se cuela como si
  // fuera válido.
  if (!Number.isInteger(indice) || indice < 0 || indice >= actuales.length) {
    throw new Error(`No se puede quitar: «${rutaItem}» no es un ítem que exista.`)
  }
  // Mismo motivo que en `agregarItem()`: el guardia va acá TAMBIÉN, no
  // solo en `puedeBorrar()`.
  if (actuales.length <= lista.minItems) {
    throw new Error(`No se puede quitar: ya está en el mínimo de ${lista.minItems}.`)
  }
  const restantes = actuales.filter((_, i) => i !== indice)
  const contenido = escribir(documentos[documento], rutaLista, restantes)
  return { ...documentos, [documento]: contenido }
}
