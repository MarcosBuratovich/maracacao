/*
 * `ListaDeItems.tsx` (Tarea 5, fase 7): la pieza que vuelve navegables los
 * 692 campos instanciados de hoy. Sin esto, elegir una puerta (Tarea 6)
 * todavía deja a la clienta mirando, por ejemplo, los 105 campos de
 * Productos en una sola tirada — 15 sabores × 2 campos, 5 gotas × 2, 6
 * polvos, 2 cocoas × 5, más 49 campos sueltos, todos juntos. Esto los
 * agrupa por INSTANCIA («Canela», «Cocoa natural»…) y deja que ella elija
 * una a la vez: entrar a un ítem muestra solo SUS campos, no los de los
 * otros 27.
 *
 * `itemsDe()` es la mitad de este archivo que no toca el DOM: agrupa por
 * `campo.grupo` —la instancia que ya calculó `campos.ts` con `nombra()`,
 * el metadato escrito a mano en la fase 1— y no reinventa ese cálculo.
 * `ListaDeItems` es la otra mitad: la lista al costado (Marcos eligió esta
 * maqueta entre tres) y, en el celular, el cajón que se abre POR ENCIMA
 * del formulario en vez de empujarla a otra pantalla (la misma elección,
 * hecha sobre tres comportamientos distintos).
 *
 * El layout responsive en sí —cajón fijo en celular, lista fija al
 * costado en escritorio— quedó afuera de esta tarea a propósito: esta
 * pieza solo deja la estructura y el estado (`abierta`/`onAbrir`) listos
 * para que esa hoja de estilos los use. La Tarea 6 (`Puerta.tsx`) la
 * escribió (`.panel-lista-*` en `src/styles/panel.css`). Ningún test de
 * ESTA pieza depende de esa hoja.
 *
 * [Ronda de arreglo] La primera versión juntaba TODOS los campos sueltos
 * —los que no viven en ninguna lista— en un solo ítem, «Textos generales».
 * Eso resolvía Productos (49 sueltos) pero dejaba intacto el problema en
 * Contacto y negocio: 78 sueltos en una sola fila, la MISMA promesa rota
 * que esta fase entera vino a arreglar, solo que trasladada del nivel de
 * puerta al nivel de ítem. `itemsDeSueltos()`/`partirBloque()`, más abajo,
 * son el arreglo: parten ese balde por BLOQUE de contenido —el primer
 * segmento de la ruta ('postura', 'contacto'…), que es exactamente el
 * nodo que la fase 1 ya envolvió con `grupo()`/`lista()`/`tupla()` y le
 * puso una etiqueta en español— y, si un bloque sigue siendo grande, un
 * nivel más. Nunca un texto inventado: cada nombre nuevo sale de
 * `panel.get()` sobre el nodo del esquema, la misma fuente que ya usa
 * `nodoDeLista()` en `listas.ts` para el nombre de una lista abierta.
 */
import type { z } from 'zod'
import type { CampoEditable, IdDocumento } from './campos'
import type { MetaCampo } from '../contenido/campos'
import { panel } from '../contenido/campos'
import { DOCUMENTOS } from '../contenido/esquema'

export interface ItemNavegable {
  clave: string
  etiqueta: string
  campos: CampoEditable[]
}

/*
 * ---------------------------------------------------------------------
 * itemsDe(): de 692 campos sueltos a un puñado de ítems con nombre
 * ---------------------------------------------------------------------
 */

// Ninguna instancia de lista real usa 'sitio'/'sabores'/'fichas' (los tres
// `IdDocumento`) como clave sin acompañarla de una ruta separada por un
// espacio — así arma sus claves `porInstancia()` en `campos.ts`, y acá se
// repite el mismo criterio a propósito, para no inventar un segundo
// esquema de claves. 'sueltos', sin espacio, no puede chocar con eso. Un
// pedazo partido extiende la misma clave con ':' — ni un espacio ni un
// punto, para que nunca se confunda con una clave de grupo ('documento
// ruta') ni con un segmento de ruta ('bloque.campo'). `esSuelto()`, más
// abajo, es la única forma en que el resto del panel debería reconocer un
// ítem de este balde: nunca comparando contra `'sueltos'` a mano.
const CLAVE_SUELTOS = 'sueltos'

// No es "Otros" ni "Varios": esos campos SÍ tienen un lugar preciso —son
// los textos de una sección entera (el kicker, el título, el cuerpo…) que
// no viven dentro de ninguna lista repetible— y decirlo así, en vez de con
// una palabra que suena a cajón de sastre, es más fiel a lo que hay adentro.
// Se usa SOLO cuando el balde entero entra en un puñado (`TOPE_SIN_PARTIR`)
// y no hace falta partirlo: cuando se parte, cada pedazo lleva el nombre
// real de su bloque (`etiquetaDeNodo()`), no este.
const ETIQUETA_SUELTOS = 'Textos generales'

/*
 * `nombra()` (fase 1, escrito a mano por cada lista) siempre trae un
 * `?? 'Cocoa'`/`?? 'Receta'`/etc. de respaldo — pero ese respaldo solo
 * entra en juego cuando el campo que nombra vale `undefined`. Si ella
 * BORRA el nombre a mano (lo deja en `''`, no en `undefined`), `nombra()`
 * devuelve exactamente `''`, y sin este chequeo el renglón le llegaría en
 * blanco: una fila sin letra en el costado, que ni se puede tocar con el
 * dedo con confianza ni dice qué es. Un ítem sin nombre es peor que uno
 * con un nombre provisorio, así que acá se le pone uno: entre paréntesis,
 * para que se note que es un aviso del sistema y no un nombre que ella
 * escribió. Mismo respaldo para un bloque cuyo nodo de esquema, contra
 * toda expectativa, no trajera `etiqueta` (ver `etiquetaDeNodo()`).
 */
const SIN_NOMBRE = '(sin nombre)'

/**
 * Está el ítem 'sueltos' propiamente dicho, o es UNO de sus pedazos
 * partidos (`itemsDeSueltos()`, más abajo). Exportada para que quien
 * consuma `ItemNavegable` —hoy, `Puerta.tsx`, para decidir «no hay
 * agregar/quitar acá» y «no elijas este balde de arranque»— nunca tenga
 * que adivinar la forma de la clave a mano: si el día de mañana cambia
 * (otro separador, otro prefijo), un solo lugar la sigue.
 */
export function esSuelto(clave: string): boolean {
  return clave === CLAVE_SUELTOS || clave.startsWith(`${CLAVE_SUELTOS}:`)
}

/*
 * ---------------------------------------------------------------------
 * El nombre de un bloque o de una de sus estructuras anidadas, leído del
 * ESQUEMA — nunca inventado
 * ---------------------------------------------------------------------
 */

/**
 * El nodo del esquema en `documento` que corresponde a una cadena de
 * CLAVES DE OBJETO PLANAS ('postura', o 'contacto', 'formulario'). Nunca
 * una ruta de LISTA con corchetes —para eso ya existe `nodoDeLista()` en
 * `listas.ts`, resolviendo otro problema (`minItems`/`maxItems` de una
 * lista abierta)—. Mismo criterio de esa función —bajar por la API
 * PÚBLICA de Zod, nunca `_zod.def`— para el único caso que hace falta acá:
 * un bloque de contenido siempre es un objeto, jamás un arreglo, así que
 * alcanza con `.shape`, sin el manejo de `[]` que si necesita
 * `nodoDeLista()`.
 */
function nodoDePartes(documento: IdDocumento, partes: readonly string[]): z.ZodType {
  let actual: z.ZodType = DOCUMENTOS[documento]
  for (const parte of partes) {
    actual = (actual as unknown as { shape: Record<string, z.ZodType> }).shape[parte]
  }
  return actual
}

/**
 * La etiqueta que la fase 1 ya le puso a este nodo con
 * `grupo()`/`lista()`/`tupla()`/un campo de hoja suelto — TODOS pasan por
 * `anota()`, así que TODOS quedan en el registro `panel` con su propia
 * `etiqueta`, sea un bloque entero o una hoja de un solo campo. Mismo
 * respaldo `SIN_NOMBRE` que ya usa el resto de este archivo, por si algún
 * nodo llegara sin registrar —no debería pasar nunca, ver la duda en el
 * reporte de esta ronda.
 */
function etiquetaDeNodo(documento: IdDocumento, partes: readonly string[]): string {
  const meta = panel.get(nodoDePartes(documento, partes)) as MetaCampo | undefined
  const etiqueta = meta?.etiqueta.trim() ?? ''
  return etiqueta.length > 0 ? etiqueta : SIN_NOMBRE
}

/*
 * ---------------------------------------------------------------------
 * El balde de sueltos, partido cuando hace falta
 * ---------------------------------------------------------------------
 */

// El mismo orden de magnitud de «un puñado» que ya usa el resto del panel
// (`Campo.tsx`: nunca más de siete campos de una vez a la vista dentro de
// una sección; `Puerta.tsx`: menos de veinte casillas por puerta al
// entrar) — no una cuenta matemática exacta. `TOPE_SIN_PARTIR` decide si
// vale la pena partir un balde chico (partir «Lo que no se ve», 19
// campos —descripciones de imagen sueltas—, en doce ítems de uno sería
// peor que dejarlo entero); `TOPE_POR_BLOQUE` decide si un bloque, ya
// partido una vez, sigue siendo demasiado para una sola fila.
const TOPE_SIN_PARTIR = 20
const TOPE_POR_BLOQUE = 25

/**
 * Un bloque que sigue grande después de partir por bloque (hoy: Contacto
 * con 44, Negocios con 34), partido UN nivel más. Sus campos DIRECTOS
 * (ruta `bloque.campo`, sin nada más adentro —el antetítulo, el correo, el
 * teléfono…) quedan juntos bajo la etiqueta del BLOQUE mismo: son,
 * literalmente, los textos generales de ese bloque. Cada estructura
 * anidada (`bloque.formulario.*`, un grupo; `bloque.tabs.*`, una tira) se
 * separa bajo SU PROPIA etiqueta, ya escrita en el esquema — nunca
 * agrupada campo por campo (`bloque.correoEtiqueta`, `bloque.correo`…
 * cada uno su propio segundo segmento), que hubiera dado veintipico
 * ítems de un campo en vez de un puñado de bloques con sentido.
 *
 * Se aplica UNA sola vez, no recursivamente: un bloque que sigue pasando
 * los 25 después de este segundo corte (hoy, los "tabs" de Negocios, con
 * 26) se deja así. Partirlo de nuevo pediría bajar a un tercer nivel sin
 * ninguna garantía de que ahí abajo haya una estructura que lo justifique
 * — la regla que pidió esta ronda es "un nivel más", no "hasta que quepa".
 */
function partirBloque(documento: IdDocumento, bloque: string, campos: readonly CampoEditable[]): ItemNavegable[] {
  const directos: CampoEditable[] = []
  const porSub = new Map<string, CampoEditable[]>()

  for (const campo of campos) {
    const partes = campo.ruta.split('.')
    if (partes.length === 2) {
      directos.push(campo)
      continue
    }
    const sub = partes[1]
    const balde = porSub.get(sub)
    if (balde) balde.push(campo)
    else porSub.set(sub, [campo])
  }

  const salida: ItemNavegable[] = []
  if (directos.length > 0) {
    salida.push({
      clave: `${CLAVE_SUELTOS}:${documento}:${bloque}`,
      etiqueta: etiquetaDeNodo(documento, [bloque]),
      campos: directos,
    })
  }
  for (const [sub, candidatos] of porSub) {
    salida.push({
      clave: `${CLAVE_SUELTOS}:${documento}:${bloque}:${sub}`,
      etiqueta: etiquetaDeNodo(documento, [bloque, sub]),
      campos: candidatos,
    })
  }
  return salida
}

/**
 * Reparte los campos sueltos de UNA puerta. Pocos (`TOPE_SIN_PARTIR` o
 * menos) quedan juntos, como antes de esta ronda: partir un balde chico
 * no ayuda a encontrar nada, solo agrega ítems. Muchos se parten por
 * BLOQUE DE CONTENIDO —el primer segmento de la ruta ('postura',
 * 'contacto'…), que es exactamente el nodo que la fase 1 envolvió con
 * `grupo()`— y, adentro de un bloque que sigue pasando `TOPE_POR_BLOQUE`,
 * un nivel más (`partirBloque()`).
 *
 * Ni un campo puede faltar a la salida: cada campo sale exactamente en UN
 * balde —`directos` o un único `porSub.get(sub)`— así que la partición no
 * pierde ni duplica nada; `test/panel-lista-dom.test.ts` lo verifica
 * sumando `campos.length` de la salida contra la entrada.
 */
function itemsDeSueltos(sueltos: readonly CampoEditable[]): ItemNavegable[] {
  if (sueltos.length === 0) return []
  if (sueltos.length <= TOPE_SIN_PARTIR) {
    return [{ clave: CLAVE_SUELTOS, etiqueta: ETIQUETA_SUELTOS, campos: [...sueltos] }]
  }

  const porBloque = new Map<string, { documento: IdDocumento; campos: CampoEditable[] }>()
  for (const campo of sueltos) {
    const bloque = campo.ruta.split('.')[0]
    // Mismo criterio de clave que el resto del archivo: el documento
    // separado por un espacio, nunca pegado al nombre del bloque.
    const clave = `${campo.documento} ${bloque}`
    const balde = porBloque.get(clave)
    if (balde) balde.campos.push(campo)
    else porBloque.set(clave, { documento: campo.documento, campos: [campo] })
  }

  const salida: ItemNavegable[] = []
  for (const [clave, { documento, campos }] of porBloque) {
    const bloque = clave.slice(documento.length + 1)
    if (campos.length > TOPE_POR_BLOQUE) {
      salida.push(...partirBloque(documento, bloque, campos))
    } else {
      salida.push({
        clave: `${CLAVE_SUELTOS}:${documento}:${bloque}`,
        etiqueta: etiquetaDeNodo(documento, [bloque]),
        campos,
      })
    }
  }
  return salida
}

/*
 * ---------------------------------------------------------------------
 * itemsDe(): el catálogo completo, listo para la lista
 * ---------------------------------------------------------------------
 */

/**
 * Agrupa por `campo.grupo` —la instancia de lista que ya resolvió
 * `campos.ts`— y reparte los campos sueltos (sin `grupo`) con
 * `itemsDeSueltos()`, al principio: antes de esta ronda de arreglo, todos
 * los sueltos caían en UN solo ítem sin importar cuántos fueran —bien
 * para Productos (49, que ya entraban en un puñado de ítems reales), mal
 * para Contacto y negocio (78 en una fila sola, la misma promesa rota que
 * esta fase entera existe para evitar).
 *
 * El orden de salida es el de PRIMERA aparición de cada grupo —`Map`
 * conserva el orden de inserción de sus claves—, que ya viene ordenado
 * por instancia porque `campos()` (Tarea 2, fase 6) reordena "por
 * instancia" antes de entregar el catálogo.
 */
export function itemsDe(campos: readonly CampoEditable[]): ItemNavegable[] {
  const grupos = new Map<string, ItemNavegable>()
  const sueltos: CampoEditable[] = []

  for (const campo of campos) {
    if (!campo.grupo) {
      sueltos.push(campo)
      continue
    }
    // Mismo criterio de clave que `porInstancia()` en `campos.ts`: el
    // documento entra en la clave porque dos documentos distintos podrían,
    // en teoría, compartir la misma ruta de instancia.
    const clave = `${campo.documento} ${campo.grupo.ruta}`
    const item = grupos.get(clave)
    if (item) {
      item.campos.push(campo)
      continue
    }
    const etiqueta = campo.grupo.etiqueta.trim()
    grupos.set(clave, {
      clave,
      etiqueta: etiqueta.length > 0 ? etiqueta : SIN_NOMBRE,
      campos: [campo],
    })
  }

  return [...itemsDeSueltos(sueltos), ...grupos.values()]
}

/*
 * ---------------------------------------------------------------------
 * ListaDeItems: la lista al costado y, en el celular, el cajón
 * ---------------------------------------------------------------------
 */

export default function ListaDeItems({
  items,
  elegido,
  onElegir,
  abierta,
  onAbrir,
}: {
  items: ItemNavegable[]
  elegido: string
  onElegir: (clave: string) => void
  abierta: boolean
  onAbrir: (v: boolean) => void
}) {
  // Elegir un ítem la devuelve al formulario: en el celular no tendría
  // sentido dejar el cajón abierto tapando lo que acaba de pedir ver. En
  // escritorio esto no se nota —la lista queda fija al costado sin
  // importar `abierta`— así que un mismo click sirve para los dos casos.
  function elegir(clave: string) {
    onElegir(clave)
    onAbrir(false)
  }

  return (
    <div className="panel-lista">
      {/*
        El botón del cajón, rotulado con PALABRAS. No es un detalle de
        estilo: un ícono de hamburguesa (☰) suelto es justo lo que nadie
        toca la primera vez, porque no dice qué pasa al tocarlo. Vive
        siempre en el marcado —es el CSS de `Puerta.tsx` (Tarea 6) el que
        lo esconde en escritorio, donde la lista ya está fija al costado y
        este botón no hace falta.
      */}
      <button
        type="button"
        className="panel-lista-boton-cajon"
        aria-expanded={abierta}
        onClick={() => onAbrir(!abierta)}
      >
        {abierta ? 'Cerrar la lista' : 'Elegir de la lista'}
      </button>

      <nav
        className={abierta ? 'panel-lista-items panel-lista-items-abierta' : 'panel-lista-items'}
        aria-label="Elementos de esta sección"
      >
        <ul className="panel-lista-ul">
          {items.map((item) => {
            const activo = item.clave === elegido
            return (
              <li key={item.clave}>
                <button
                  type="button"
                  className={activo ? 'panel-lista-fila panel-lista-fila-activa' : 'panel-lista-fila'}
                  aria-current={activo ? 'true' : undefined}
                  onClick={() => elegir(item.clave)}
                >
                  {item.etiqueta}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
