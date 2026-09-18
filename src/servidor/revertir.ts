/*
 * Volver atrás un commit del panel.
 *
 * Es un commit NUEVO con los blobs VIEJOS (spec §4.6). Nunca un `reset`,
 * nunca un `force`, nunca reescribir la historia: el historial tiene que
 * poder contar que hubo un cambio y que se deshizo, porque eso es justamente
 * lo que la clienta va a querer entender después.
 *
 * Dos cosas lo usan, con la misma mecánica y distinto disparador:
 *   - la reversión AUTOMÁTICA, cuando el despliegue del commit falla;
 *   - el botón «Deshacer esta publicación» de los 30 minutos.
 *
 * Y las dos pasan por la misma validación que cualquier publicación: el
 * contenido viejo puede no pasar las reglas de HOY (el esquema cambió, un
 * campo nuevo se volvió obligatorio). Por eso no se toma ningún atajo del
 * tipo «como ya estuvo publicado, es válido».
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe el cliente ya armado.
 */
import { cliente } from './github'
import { publica, type Archivo } from './publicar'
import { validarContra } from '../contenido/validacion'
import { injerta, type FuentesDeDerivados } from '../contenido/derivados'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'

/**
 * La marca que deja un commit de reversión en su propio cuerpo. Es lo que
 * hace que revertir sea IDEMPOTENTE sin guardar estado en ningún lado: dos
 * invocaciones que ven el mismo fracaso al mismo tiempo miran la cabeza, la
 * segunda encuentra esta línea, y se va sin hacer nada. Sin esto, la segunda
 * revertiría la reversión — o sea, volvería a dejar el commit malo.
 */
export const TRAILER_REVIERTE = 'Panel-Revierte'

/**
 * La marca que el panel le pone a todo lo que publica (`publicar.ts`).
 * Exportada: es la MISMA línea que decide si un commit puede escribir en
 * `main` desde `revisaLaCabeza()` (acciones.ts) — escribirla dos veces sería
 * la clase de duplicado que se desincroniza sola.
 */
export const TRAILER_PANEL = 'Panel: sí'

/** El trailer que lleva el correo de quien publicó de verdad (`publicar.ts`). */
const TRAILER_AUTOR = 'Panel-Autor'

export type ResultadoReversion =
  | { ok: true; sha: string | null; revirtio: string }
  | {
      ok: false
      motivo: 'no-es-del-panel' | 'no-es-la-cabeza' | 'ya-revertido' | 'nada-que-revertir' | 'no-valida' | 'falló'
      detalle: string
    }

const RUTA_DEL_DOCUMENTO = (id: IdDocumento): string => `src/contenido/datos/${id}.json`
const DOCUMENTO_DE_RUTA = new Map<string, IdDocumento>(
  (Object.keys(DOCUMENTOS) as IdDocumento[]).map((id) => [RUTA_DEL_DOCUMENTO(id), id]),
)

/**
 * [F-4] ¿El mensaje de un commit lleva esta línea de trailer EXACTA? Anclado
 * por línea completa —una de las líneas del mensaje, partido por `\n`, tiene
 * que ser IGUAL a `lineaExacta`— y no un substring en cualquier lado. Sin
 * esto, un commit escrito a mano cuyo cuerpo mencione «Panel: sí» en medio de
 * una oración («revierto lo que decía Panel: sí, a mano») pasaría por un
 * commit del panel.
 */
export function tieneTrailer(mensaje: string, lineaExacta: string): boolean {
  return mensaje.split('\n').includes(lineaExacta)
}

/**
 * [F-4] El valor de un trailer `Clave: valor`, buscado por línea (el prefijo
 * `Clave: ` tiene que estar al principio de una línea entera), o `undefined`
 * si no está. Se usa tanto para detectar «esto YA es una reversión de algo»
 * (`TRAILER_REVIERTE`, sin saber de antemano qué sha sigue) como para leer
 * `Panel-Autor:` sin tener que reconstruir la línea completa primero.
 */
export function valorDeTrailer(mensaje: string, clave: string): string | undefined {
  const prefijo = `${clave}: `
  const linea = mensaje.split('\n').find((l) => l.startsWith(prefijo))
  return linea === undefined ? undefined : linea.slice(prefijo.length)
}

/**
 * Las fuentes de los cinco derivados de `sitio`, sacadas de un documento de
 * `sabores` crudo. Misma forma que `publicarAccion` calcula en
 * `acciones.ts` (`fuentesDeSabores`) — se repite acá, chica y sin estado,
 * en vez de exportarla desde el router: `revertir.ts` no depende de
 * `acciones.ts`, y al revés sí (Tarea 8, paso 7), así que importarla de ahí
 * sería un ciclo. Nunca tira: si el documento vino incompleto, listas
 * vacías hacen que `injerta()` sea quien tire, más abajo.
 */
function fuentesDeSabores(v: unknown): FuentesDeDerivados {
  const doc = (v ?? {}) as { sabores?: unknown; gotas?: unknown }
  return {
    sabores: (Array.isArray(doc.sabores) ? doc.sabores : []) as FuentesDeDerivados['sabores'],
    gotas: (Array.isArray(doc.gotas) ? doc.gotas : []) as FuentesDeDerivados['gotas'],
  }
}

export async function revierte(
  gh: ReturnType<typeof cliente>,
  p: { sha: string; autor: string },
): Promise<ResultadoReversion> {
  const cabeza = await gh.ref('heads/main')

  // [B8] Solo se deshace la CABEZA. Deshacer un commit del medio es resolver
  // un merge de contenido, y este camino es el del arrepentimiento inmediato
  // («un 1300 en vez de 130, se ve a los veinte segundos»), no el del
  // historial.
  if (cabeza.sha !== p.sha) {
    const cabezaCommit = await gh.commit(cabeza.sha)
    // …salvo que la cabeza SEA la reversión de este mismo sha. Ahí no es un
    // error: es que alguien ya lo hizo, y la respuesta correcta es «listo»,
    // no «no se puede».
    if (valorDeTrailer(cabezaCommit.message, TRAILER_REVIERTE) === p.sha) {
      return { ok: false, motivo: 'ya-revertido', detalle: `${cabeza.sha} ya revierte ${p.sha}` }
    }
    return { ok: false, motivo: 'no-es-la-cabeza', detalle: `la cabeza es ${cabeza.sha}` }
  }

  const commit = await gh.commit(p.sha)

  // El panel no deshace lo que no publicó. Un commit de Marcos, hecho a mano,
  // no se toca desde acá ni aunque el despliegue haya fallado por su culpa.
  if (!tieneTrailer(commit.message, TRAILER_PANEL)) {
    return { ok: false, motivo: 'no-es-del-panel', detalle: `${p.sha} no lleva «${TRAILER_PANEL}»` }
  }

  // [A] Una reversión no se revierte. Republicar el contenido de una
  // reversión es resucitar EXACTAMENTE el contenido que se acaba de declarar
  // roto — y encima en un commit nuevo que lleva su PROPIO trailer, así que
  // la red de seguridad (`revisaLaCabeza()`, acciones.ts) nunca lo va a
  // volver a tocar: quedaría malo para siempre. La guardia vive ACÁ, no solo
  // en quien llama: una invariante que depende de que todo llamador se
  // acuerde de chequearla antes no es una invariante.
  if (valorDeTrailer(commit.message, TRAILER_REVIERTE) !== undefined) {
    return { ok: false, motivo: 'ya-revertido', detalle: `${p.sha} ya es una reversión` }
  }

  const padre = commit.padres[0]
  if (!padre) {
    return { ok: false, motivo: 'falló', detalle: `${p.sha} no tiene padre` }
  }

  // Qué rutas tocó ESE commit. Solo se revierten las de contenido: si alguna
  // vez un commit del panel tocara otra cosa, revertirla sería tocar código
  // desde acá, que es exactamente lo que la lista blanca existe para impedir.
  const { archivos: tocadas } = await gh.comparaRefs(padre, p.sha)
  const documentos = tocadas.flatMap((ruta) => {
    const id = DOCUMENTO_DE_RUTA.get(ruta)
    return id ? [{ ruta, id }] : []
  })

  // [D] Nada que revertir NO es lo mismo que «revertido»: `main` sigue con el
  // commit roto (hoy no alcanzable —un commit del panel siempre toca al
  // menos un documento de contenido—, pero deja de serlo en cuanto la fase 7
  // publique imágenes sueltas, que no están en `DOCUMENTO_DE_RUTA`). Decirlo
  // como éxito le mentía a Marcos: el correo decía «revertido» con el sitio
  // todavía roto.
  if (documentos.length === 0) {
    return { ok: false, motivo: 'nada-que-revertir', detalle: `${p.sha} no tocó ningún documento de contenido` }
  }

  // El contenido VIEJO (en el padre) de cada documento tocado, leído de una
  // sola vez: `sitio` puede necesitar el de `sabores` para sus derivados
  // (ver más abajo), y si `sabores` TAMBIÉN se revierte en este mismo lote,
  // usa el que ya se leyó acá en vez de pedirlo de nuevo.
  const contenidos = new Map<IdDocumento, string>()
  for (const { ruta, id } of documentos) {
    contenidos.set(id, await gh.archivoEnRef(ruta, padre))
  }

  const archivos: Archivo[] = []
  for (const { ruta, id } of documentos) {
    const viejo = contenidos.get(id) as string

    // [F-3] El contenido viejo puede no ser JSON válido (corrupción rara,
    // migración a medio camino). Eso es un motivo de la MISMA familia que
    // «no pasa las reglas de hoy» — un `falló` con detalle, nunca una
    // excepción que tire a quien llamó, que es justo lo que el tipo de
    // retorno de esta función promete no hacer.
    let crudo: unknown
    try {
      crudo = JSON.parse(viejo)
    } catch (e) {
      return { ok: false, motivo: 'falló', detalle: `${ruta}: el contenido del padre no es JSON válido (${String(e)})` }
    }

    // `sitio` tiene cinco campos derivados que `serializa()` nunca escribe
    // (carga.ts:390-395; ver derivados.ts) — así que el JSON que vive en el
    // repo, tal cual, NUNCA los trae. Validarlo crudo rechaza CUALQUIER
    // reversión real de `sitio` con «el campo quedó vacío» sobre el primer
    // derivado: el mismo bug que encontró el humo de producción
    // (`scripts/humo-panel.sh`, paso 4a) para `publicarAccion`, acá para la
    // reversión. Se injertan antes de validar, con las MISMAS fuentes que usa
    // el router: las de `sabores` si también se está revirtiendo en este
    // lote (sus valores son los que van a quedar vivos después de este
    // commit), o si no, las de `sabores` vivo en el mismo padre.
    let paraValidar: unknown = crudo
    if (id === 'sitio') {
      const textoSabores = contenidos.has('sabores')
        ? (contenidos.get('sabores') as string)
        : await gh.archivoEnRef(RUTA_DEL_DOCUMENTO('sabores'), padre)
      let saboresCrudo: unknown
      try {
        saboresCrudo = JSON.parse(textoSabores)
      } catch {
        saboresCrudo = undefined
      }
      const fuentes = fuentesDeSabores(saboresCrudo)
      // Mismo criterio que `publicarAccion`: si `injerta()` tira porque al
      // documento le falta un CONTENEDOR entero (`gotas`, no solo
      // `gotas.precioDesde`), eso es un documento con una forma rota de
      // verdad, no el caso que este injerto existe para arreglar — se valida
      // el documento TAL CUAL para que sea `validarContra`, no un 500, quien
      // diga qué falta.
      try {
        paraValidar = injerta(crudo, fuentes)
      } catch {
        // se deja `paraValidar` tal cual llegó, sin injertar.
      }
    }

    // Misma revalidación que cualquier publicación: el contenido de ayer
    // puede no pasar las reglas de hoy. Si no pasa, no se publica a la
    // fuerza — quien llamó decide qué hacer (el spec §4.6 dice que el panel
    // se lo ofrece como borrador).
    const problemas = validarContra(DOCUMENTOS[id], paraValidar)
    if (problemas.length > 0) {
      return { ok: false, motivo: 'no-valida', detalle: `${ruta}: ${problemas[0].titulo}` }
    }
    archivos.push({ ruta, contenido: viejo })
  }

  const resultado = await publica(gh, {
    archivos,
    autor: p.autor,
    trailers: { [TRAILER_REVIERTE]: p.sha },
    // [E] Sin el reintento interno de `publica()`: ese reintento rearmaría
    // el árbol SOBRE el commit que ganó la carrera, pero con los bytes
    // VIEJOS de esta reversión — si ese commit es de Marcos, publicado justo
    // en la ventana entre que se leyó el ref y se movió, su cambio
    // desaparecería sin 409 y sin log. Perder la carrera acá se traduce
    // abajo en `no-es-la-cabeza`: la próxima invocación relee todo desde
    // cero, que es lo correcto para algo idempotente.
    reintentar: false,
    // [Revisión final de la rama] SIN `bytesDelCuerpo`. Lo tenía, y el único
    // llamador que se lo pasaba (`deshacerAccion`) le daba el peso del cuerpo
    // HTTP del pedido de deshacer — unos cincuenta bytes—, así que el tope de
    // 3,5 MB se comparaba contra eso y quedaba desactivado justo en el camino
    // que más lo necesita: lo que se escribe acá no es el cuerpo del pedido,
    // son los archivos VIEJOS que se están restaurando, y pueden pesar
    // cualquier cosa. `publica()` los mide solo, que es la cuenta correcta.
    // El parámetro se fue entero: dejarlo era dejar armada la misma trampa
    // para el próximo llamador.
  })

  if (!resultado.ok) {
    return {
      ok: false,
      // [E] El 409 de `publica()` con `reintentar:false` es exactamente la
      // misma situación que la guardia de arriba detecta ANTES de escribir:
      // la cabeza cambió. Contarlo con el mismo motivo es lo que le permite a
      // quien llama tratar los dos casos igual.
      motivo: resultado.codigo === 409 ? 'no-es-la-cabeza' : 'falló',
      detalle: resultado.problema,
    }
  }
  return { ok: true, sha: resultado.sha, revirtio: p.sha }
}

/** El correo de quien publicó de verdad, leído del trailer `Panel-Autor:` — nunca de quien pidió la reversión. */
export const autorDelCommit = (mensaje: string): string | undefined => valorDeTrailer(mensaje, TRAILER_AUTOR)
