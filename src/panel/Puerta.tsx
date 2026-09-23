/*
 * `Puerta.tsx` (Tarea 6, fase 7): la pantalla que junta todo lo anterior —
 * el ensamblado. Hoy ella entra al panel y ve los 692 campos instanciados
 * en una sola tirada; esta pieza los reparte en cinco puertas
 * (`ETIQUETA_DE_PUERTA`, Tarea 2) y, adentro de cada una, en ítems
 * navegables (`itemsDe`, Tarea 5) para que nunca vea más de un puñado de
 * campos (`Campo`, Tarea 4) a la vez.
 *
 * Al entrar a una puerta ya hay algo elegido — el diseño lo dice así
 * («detrás de «Productos» hay 105 campos, pero la pantalla MUESTRA entre
 * dos y siete», spec D2): nunca una pantalla en blanco pidiéndole que
 * elija antes de ver nada. Se elige el primer ítem REAL (nunca uno del
 * balde de "sueltos" —`esSuelto()`, en `./ListaDeItems`, ronda de arreglo
 * de la Tarea 5: ese balde se parte cuando es grande, pero sigue siendo
 * texto general de un bloque, no un ítem con nombre propio) y ella puede
 * cambiarlo con el cajón, que sigue ahí al costado.
 *
 * El árbol de navegación es SIEMPRE: puerta → ítem → campos — con UNA
 * excepción. Fichas técnicas ya viene anidada en el propio esquema (ficha →
 * sección → bloque), y las 341 casillas de esa puerta no entran en un solo
 * nivel de ítems sin repetir el mismo error que esta fase entera vino a
 * corregir: agrupar por el grupo MÁS CERCANO de cada campo (que es lo que
 * hace `itemsDe()`) corta una sección en tantos pedazos como bloques tenga
 * — un renglón para el título, uno para cada párrafo, uno para la tabla —
 * en vez de dejarla entrar UNA vez y ver la sección entera. Por eso acá
 * abajo hay un segundo camino, `fichasDe()`/`seccionesDe()`, que corta en
 * los dos lugares FIJOS que importan —la ficha, la sección— y dentro de
 * cada sección muestra los campos de un tirón (con un encabezado chico
 * cuando cambia de bloque, para que una tabla de 20 celdas no se lea como
 * una fila sola). Es "la misma idea, con un nivel más" (spec D2): el
 * cajón de fichas y el cajón de secciones conviven en pantalla, igual que
 * el cajón de ítems de cualquier otra puerta, uno anidado adentro del otro.
 *
 * Ninguna de las piezas que arma esta pantalla se reescribe: `camposDePuerta`,
 * `ETIQUETA_DE_PUERTA`, `AVISO_DE_PUERTA` (Tarea 2), `itemsDe`/`ListaDeItems`
 * (Tarea 5), `Campo` (Tarea 4) y `campos`/`escribirValor` (Tarea 2, fase 6)
 * se usan tal cual. Lo único nuevo es la plomería que las junta y el
 * recorrido de tres niveles de fichas, que no vivía en ninguna de ellas.
 *
 * El alta y la baja de ítems (Tarea 3, `./listas`) todavía NO tiene botón
 * en esta pantalla — llega en la Tarea 7, con su confirmación escrita. Por
 * eso acá no hay un solo «Agregar»: en su lugar, un aviso fijo dice que por
 * ahora el alta y la baja las hace Marcos, para que la ausencia del botón
 * se lea como una decisión y no como un error del panel.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  campos, escribirValor, leer,
  type CampoEditable, type Documentos, type IdDocumento,
} from './campos'
import {
  camposDePuerta, PUERTAS, ETIQUETA_DE_PUERTA, AVISO_DE_PUERTA,
  type Puerta as TipoPuerta,
} from './puertas'
import ListaDeItems, { itemsDe, esSuelto, type ItemNavegable } from './ListaDeItems'
import Campo from './Campo'
import {
  agregarItem, quitarItem, puedeAgregar, puedeBorrar, listasAbiertas,
  type ListaAbierta,
} from './listas'

/*
 * ---------------------------------------------------------------------
 * Los textos propios de esta pantalla — ninguno sale de `src/contenido/**`
 * ---------------------------------------------------------------------
 */

const TITULO_PUERTAS = '¿Qué quieres editar?'

/**
 * Tarea 7: ahora SÍ hay botón de agregar/quitar, pero solo en las cinco
 * listas que `listasAbiertas()` (Tarea 3) marca como enteras de ella. Este
 * aviso ya NO es un texto de puerta —sería falso en cocoas, preguntas,
 * condiciones de mayoreo, el semáforo y los datos de cabecera de una
 * ficha, que SÍ tienen botón— así que se dibuja por ÍTEM elegido, no por
 * puerta: solo cuando el ítem que ella está mirando pertenece a una de las
 * OTRAS nueve listas repetibles (sabores, gotas, polvo, recetas, los pasos
 * de «Cómo catar», los enlaces del menú, los productos del pie, las
 * fichas mismas y sus secciones). Ver `AltaBajaDeItem()` más abajo, que
 * decide esto llamando a `puedeAgregar()`/`puedeBorrar()`
 * en vez de a una lista fija escrita a mano.
 */
const AVISO_ALTA_BAJA =
  'Agregar o quitar un elemento de esta lista todavía no se puede desde el panel: esos los da de alta Marcos. Escríbele si necesitas uno nuevo.'

const AVISO_SIN_SECCION = 'Elige una sección para ver sus datos.'
const ETIQUETA_DATOS_GENERALES = 'Datos generales de la ficha'
const VOLVER_A_PUERTAS = 'Volver a las cinco puertas'

/*
 * [Ronda de arreglo final] La puerta de fichas es la única con DOS cajones
 * en pantalla, uno anidado adentro del otro. Con el texto por defecto de
 * `ListaDeItems` los dos botones decían «Elegir de la lista» —idénticos, y
 * en el celular apilados uno arriba del otro—, así que no había forma de
 * saber cuál elegía la ficha y cuál la sección sin tocarlos.
 */
const NOMBRE_LISTA_FICHAS = 'la lista de fichas'
const NOMBRE_LISTA_SECCIONES = 'la lista de secciones'

const ETIQUETA_BORRAR = 'Borrar este elemento'

/**
 * El rótulo de un par de «Datos de cabecera» y el de su botón de borrar.
 *
 * [Ronda de arreglo final] Antes, la pantalla dibujaba las cuatro cajas
 * «Nombre del dato» seguidas, después las cuatro «Valor del dato» —nunca
 * intercaladas— y debajo cuatro botones idénticos «Borrar este elemento»:
 * no había forma de saber qué valor iba con qué nombre, ni cuál borraba
 * cada botón, salvo tocándolo y leyendo la confirmación. En la puerta de
 * las fichas eso es grave: lo que dicen esas filas tiene que coincidir con
 * el empaque impreso.
 *
 * El número va además del nombre porque el nombre puede estar vacío
 * (`SIN_NOMBRE`) o repetido, y la posición no: siempre dice de cuál de las
 * filas de la tabla se está hablando.
 */
function rotuloDePar(indice: number, nombre: string): string {
  return `Dato ${indice + 1}: ${nombre}`
}

function etiquetaBorrarPar(nombre: string): string {
  return `Borrar el dato «${nombre}»`
}

/*
 * ---------------------------------------------------------------------
 * Fichas: agrupar por PREFIJO DE RUTA fijo, no por el grupo más cercano
 * ---------------------------------------------------------------------
 */

// Mismo criterio de "sin nombre" que ya usa `itemsDe()` (Tarea 5, en
// `ListaDeItems.tsx`): un ítem sin letra en el cajón es peor que uno con un
// nombre provisorio. No se importa la constante de ahí porque es privada
// del módulo — repetir esta única línea es más simple que exportarla para
// un solo uso.
const SIN_NOMBRE = '(sin nombre)'

/** 'fichas.0.secciones.1.bloques.2.texto' → 'fichas.0': la ficha dueña de este campo. */
function rutaDeFicha(ruta: string): string {
  return ruta.split('.').slice(0, 2).join('.')
}

/**
 * 'fichas.0.secciones.1.titulo' → 'fichas.0.secciones.1'; 'fichas.0.producto'
 * (no vive dentro de ninguna sección: es un dato directo de la ficha, como
 * el nombre del producto o los datos de cabecera) → `undefined`.
 */
function rutaDeSeccion(ruta: string): string | undefined {
  const partes = ruta.split('.')
  return partes[2] === 'secciones' ? partes.slice(0, 4).join('.') : undefined
}

/**
 * El nombre que calculó `nombra()` para el grupo `clave` — el mismo dato
 * que usa `itemsDe()` — buscando, entre los campos ya juntados bajo esa
 * clave, el que la trae de primera mano: el que vive DIRECTO en ese grupo
 * y no en uno más adentro (una sección no hereda el nombre de sus
 * bloques). Toda ficha y toda sección trae al menos un campo propio
 * (`producto`, `titulo`), así que el respaldo de abajo no debería
 * alcanzarse nunca — queda solo por las dudas, como ya hace `itemsDe()`.
 */
function etiquetaParaClave(candidatos: readonly CampoEditable[], clave: string): string {
  const propio = candidatos.find((c) => c.grupo?.ruta === clave)
  const etiqueta = propio?.grupo?.etiqueta.trim() ?? ''
  return etiqueta.length > 0 ? etiqueta : SIN_NOMBRE
}

/**
 * Nivel 1 de la puerta de fichas: una fila por ficha (4 hoy), más — si las
 * hay — los textos sueltos de la página `/fichas-tecnicas` que viven en el
 * documento `sitio`, no en `fichas` (el título de la página, el botón de
 * volver…): un documento distinto, así que no son de NINGUNA ficha y
 * necesitan su propio balde, con el mismo criterio de "sueltos" que ya usa
 * `itemsDe()`.
 */
function fichasDe(camposDeLaPuerta: readonly CampoEditable[]): ItemNavegable[] {
  const sueltos: CampoEditable[] = []
  const porFicha = new Map<string, CampoEditable[]>()

  for (const campo of camposDeLaPuerta) {
    if (campo.documento !== 'fichas') {
      sueltos.push(campo)
      continue
    }
    const clave = rutaDeFicha(campo.ruta)
    const balde = porFicha.get(clave)
    if (balde) balde.push(campo)
    else porFicha.set(clave, [campo])
  }

  const salida: ItemNavegable[] = []
  if (sueltos.length > 0) {
    salida.push({ clave: 'sueltos', etiqueta: 'Textos generales', campos: sueltos })
  }
  for (const [clave, candidatos] of porFicha) {
    salida.push({ clave, etiqueta: etiquetaParaClave(candidatos, clave), campos: candidatos })
  }
  return salida
}

/**
 * Nivel 2 de la puerta de fichas, dado UN ficha ya elegida: una fila por
 * sección, más — si los hay — los campos propios de la ficha que no viven
 * dentro de ninguna sección (el nombre del producto, la denominación legal,
 * los datos de cabecera). Esos campos propios necesitan un lugar al que
 * ella pueda entrar igual que a cualquier sección — nunca se dibujan solos,
 * sin que ella los haya elegido — así que se agrupan bajo un ítem más,
 * "Datos generales de la ficha", con la ruta de la FICHA como clave: no
 * colisiona con ninguna ruta de sección real (todas empiezan con
 * `<ruta>.secciones.`).
 */
function seccionesDe(rutaFicha: string, camposDeLaFicha: readonly CampoEditable[]): ItemNavegable[] {
  const propios: CampoEditable[] = []
  const porSeccion = new Map<string, CampoEditable[]>()

  for (const campo of camposDeLaFicha) {
    const clave = rutaDeSeccion(campo.ruta)
    if (clave === undefined) {
      propios.push(campo)
      continue
    }
    const balde = porSeccion.get(clave)
    if (balde) balde.push(campo)
    else porSeccion.set(clave, [campo])
  }

  const salida: ItemNavegable[] = []
  if (propios.length > 0) {
    salida.push({ clave: rutaFicha, etiqueta: ETIQUETA_DATOS_GENERALES, campos: propios })
  }
  for (const [clave, candidatos] of porSeccion) {
    salida.push({ clave, etiqueta: etiquetaParaClave(candidatos, clave), campos: candidatos })
  }
  return salida
}

/**
 * El ítem que se elige SOLO, al entrar a una puerta o al cambiar de ficha:
 * el primero que no sea del balde de "sueltos" —ni el balde entero cuando
 * queda sin partir, ni uno de sus pedazos partidos (Tarea 5, ronda de
 * arreglo: hasta 26 campos en un pedazo de Contacto y negocio)— porque
 * elegir cualquiera de esos de arranque rompería la promesa de "un
 * puñado" el primer segundo que ella ve la pantalla. Si la puerta NO
 * tiene más que sueltos (el caso de "Lo que no se ve"), no queda otra: se
 * elige ese. `esSuelto()` (`./ListaDeItems`) es la única fuente de verdad
 * de qué clave es del balde — nunca comparar contra `'sueltos'` a mano
 * acá: desde la ronda de arreglo, un pedazo partido lleva una clave como
 * `'sueltos:sitio:postura'`, que un `=== 'sueltos'` literal no reconoce.
 */
function primeroReal(items: readonly ItemNavegable[]): ItemNavegable | undefined {
  return items.find((i) => !esSuelto(i.clave)) ?? items[0]
}

/*
 * ---------------------------------------------------------------------
 * El formulario de UN ítem/sección ya elegido — nunca más de un puñado
 * ---------------------------------------------------------------------
 */

/**
 * «Falta 1 dato»/«Faltan 3 datos», nunca «Faltan 1 datos»: la única
 * diferencia entre singular y plural de esta frase.
 */
function textoResumenDeFaltantes(faltan: number, etiqueta: string): string {
  return faltan === 1
    ? `Falta 1 dato para poder publicar «${etiqueta}».`
    : `Faltan ${faltan} datos para poder publicar «${etiqueta}».`
}

/**
 * El resumen a nivel de ÍTEM, arriba de todo, cuando algo de adentro
 * todavía no puede publicarse (`gravedad: 'impide'`) — hallazgo de la
 * ronda de arreglo de la Tarea 6: `agregarItem()` (Tarea 3) crea un ítem
 * con `''`/`null` en todos sus campos A PROPÓSITO, y `Campo` (ronda de
 * arreglo de la Tarea 4) se calla hasta que ella sale de CADA campo por
 * primera vez. Sin este resumen, ella agrega una cocoa, ve casillas
 * vacías sin ningún aviso, y se entera recién al publicar. Cuenta CAMPOS,
 * no problemas —un campo puede traer más de uno, pero «faltan 3 datos»
 * tiene que decir cuántos CAMPOS bloquean, no cuántos problemas hay— y
 * usa el mismo `campo.validar()` que ya usa `Campo`, nunca una lista
 * propia de qué falta: si el esquema cambia qué es obligatorio, este
 * resumen lo sigue solo.
 */
function ResumenDeFaltantes({
  campos: lista,
  etiqueta,
}: {
  campos: readonly CampoEditable[]
  etiqueta: string
}) {
  const faltan = lista.filter((c) => c.validar(c.valor).some((p) => p.gravedad === 'impide')).length
  if (faltan === 0) return null
  return <p className="panel-aviso">{textoResumenDeFaltantes(faltan, etiqueta)}</p>
}

/**
 * Dibuja los campos de un ítem ya elegido, con un encabezado chico cada vez
 * que aparece un grupo más adentro del que ella ya eligió — el caso real es
 * un bloque (párrafo/lista/tabla) DENTRO de una sección de ficha, para que
 * una tabla de 20 celdas no se confunda con el párrafo de al lado. Para
 * cualquier ítem de las otras cuatro puertas esto nunca dibuja un
 * encabezado: `itemsDe()` ya agrupó esos campos por su único grupo, así que
 * `campo.grupo.ruta` nunca cambia dentro de un mismo ítem.
 *
 * [Ronda de arreglo final] Vive separado del resumen de faltantes y del
 * `<div>` que los envuelve (`FormularioDeCampos`, acá abajo) para que
 * «Datos generales de la ficha» pueda intercalar SUS propios pedazos —los
 * pares de cabecera, cada uno con su rótulo y su botón de borrar— entre
 * tandas de campos, sin dibujar dos veces el resumen ni repetir esta
 * lógica de encabezados.
 */
function ListaDeCampos({
  campos: lista,
  rutaContexto,
  onCambio,
}: {
  campos: readonly CampoEditable[]
  rutaContexto: string | undefined
  onCambio: (campo: CampoEditable, valor: unknown) => void
}) {
  let grupoAbierto: string | undefined
  return (
    <>
      {lista.map((campo) => {
        const clave = `${campo.documento} ${campo.ruta}`
        const esSubgrupo = campo.grupo !== undefined && campo.grupo.ruta !== rutaContexto
        const abreGrupo = esSubgrupo && campo.grupo!.ruta !== grupoAbierto
        grupoAbierto = campo.grupo?.ruta
        return (
          <div key={clave} className={esSubgrupo ? 'panel-campo-en-grupo' : undefined}>
            {abreGrupo && <h3 className="panel-grupo-titulo">{campo.grupo!.etiqueta}</h3>}
            <Campo campo={campo} onCambio={(valor) => onCambio(campo, valor)} />
          </div>
        )
      })}
    </>
  )
}

function FormularioDeCampos({
  campos: lista,
  etiqueta,
  rutaContexto,
  onCambio,
}: {
  campos: readonly CampoEditable[]
  etiqueta: string
  rutaContexto: string | undefined
  onCambio: (campo: CampoEditable, valor: unknown) => void
}) {
  return (
    <div className="panel-puerta-campos">
      <ResumenDeFaltantes campos={lista} etiqueta={etiqueta} />
      <ListaDeCampos campos={lista} rutaContexto={rutaContexto} onCambio={onCambio} />
    </div>
  )
}

/*
 * ---------------------------------------------------------------------
 * Alta y baja de ítems (Tarea 7): solo en las cinco listas de `listas.ts`
 * ---------------------------------------------------------------------
 *
 * `listasAbiertas()` (Tarea 3) da, por lista abierta, su ruta de ESQUEMA
 * ('cocoas.lista[]', 'fichas[].meta[]'): con corchetes en vez de índices.
 * Lo que tiene esta pantalla es la ruta CONCRETA del ítem que ella está
 * mirando ('cocoas.lista.0', 'fichas.0.meta.2'): con índices en vez de
 * corchetes. `buscarListaAbierta()` los empareja DESPOJANDO ambas formas a
 * una tercera, neutral, en vez de reconstruir la conversión índice→corchete
 * de `listas.ts` (esa lógica es privada de ese módulo a propósito, y
 * repetirla acá es un lugar más donde podría desalinearse si cambia).
 */

/** 'cocoas.lista[]' → 'cocoas.lista'; 'fichas[].meta[]' → 'fichas.meta'. */
function sinCorchetes(rutaEsquema: string): string {
  return rutaEsquema.replace(/\[\]/g, '')
}

/** 'cocoas.lista.0' → 'cocoas.lista'; 'fichas.0.meta' → 'fichas.meta'. */
function sinIndices(rutaConcreta: string): string {
  return rutaConcreta
    .split('.')
    .filter((parte) => !/^\d+$/.test(parte))
    .join('.')
}

/** La lista abierta que le corresponde a esta ruta concreta, si hay una. */
function buscarListaAbierta(
  abiertas: readonly ListaAbierta[],
  documento: IdDocumento,
  rutaListaConcreta: string,
): ListaAbierta | undefined {
  const objetivo = sinIndices(rutaListaConcreta)
  return abiertas.find((l) => l.documento === documento && sinCorchetes(l.rutaEsquema) === objetivo)
}

// Los cinco `minItems`/maxItems de hoy son chicos (1 o 3) — un número
// escrito con letra se lee más natural que un dígito solo en una frase
// («necesita al menos tres», no «necesita al menos 3»). Más allá de diez
// cae al dígito: ninguna de las cinco listas llega ni cerca.
//
// `1: 'uno'` es la forma CANÓNICA del número, correcta sola o delante de
// un sustantivo femenino («una») — no la forma que corresponde delante de
// un sustantivo MASCULINO («un elemento», nunca «uno elemento»: apócope,
// igual que «un año», no «uno año»). `enPalabras()` no sabe qué palabra
// viene después, así que ese apócope no es trabajo suyo: se resuelve en
// el punto donde se arma la frase — ver `textoMinimoElementos()`, la
// única llamada de hoy, y la única con un sustantivo masculino pegado.
const NUMEROS_EN_PALABRAS: Readonly<Record<number, string>> = {
  1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco',
  6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
}
function enPalabras(n: number): string {
  return NUMEROS_EN_PALABRAS[n] ?? String(n)
}

/**
 * «Esta lista necesita al menos un elemento»/«...tres elementos»: el
 * apócope de «uno» → «un» pasa ACÁ, no en `enPalabras()` — hallazgo del
 * revisor, ronda de arreglo: las cuatro listas de mínimo 1 (cocoas,
 * negocios.fichas, negocios.condiciones, fichas[].meta[]) leían «necesita
 * al menos UNO elemento», con la forma canónica en vez de la apocopada.
 * Verificado que `enPalabras()` no se usa en ningún otro lugar del
 * repo antes de tocar esto — si mañana gana un segundo llamador sin un
 * sustantivo masculino atrás, ese llamador sigue recibiendo «uno» sin
 * cambios, porque el apócope vive acá y no en la raíz.
 */
function textoMinimoElementos(minItems: number): string {
  const numero = minItems === 1 ? 'un' : enPalabras(minItems)
  const sustantivo = minItems === 1 ? 'elemento' : 'elementos'
  return `Esta lista necesita al menos ${numero} ${sustantivo}: no se puede borrar más.`
}

/**
 * El botón que agrega un elemento más al final de una lista abierta.
 *
 * `onAgregado` (no `onCambia` a secas, como tenía antes de la ronda de
 * arreglo) le entrega al que llama, además del documento nuevo, el ÍNDICE
 * donde quedó el elemento agregado — el largo ACTUAL de la lista, ya que
 * `agregarItem()` siempre agrega al final —, para que quien tenga el
 * estado de selección (`AltaBajaDeItem()`, más abajo) pueda pararse en él.
 * Sin esto, agregar no cambiaba nada en pantalla: el ítem nuevo entraba
 * calladito al fondo del cajón, sin resaltar y sin seleccionarse —
 * hallazgo del revisor, ronda de arreglo sobre la Tarea 7.
 */
function BotonAgregarLista({
  documentos,
  documento,
  rutaLista,
  info,
  onAgregado,
}: {
  documentos: Documentos
  documento: IdDocumento
  rutaLista: string
  info: ListaAbierta
  onAgregado: (documentos: Documentos, indiceNuevo: number) => void
}) {
  const habilitado = puedeAgregar(documentos, documento, rutaLista)
  return (
    <div className="panel-lista-agregar">
      <button
        type="button"
        className="panel-boton panel-boton-agregar"
        disabled={!habilitado}
        onClick={() => {
          const indiceNuevo = (leer(documentos[documento], rutaLista) as unknown[]).length
          onAgregado(agregarItem(documentos, documento, rutaLista), indiceNuevo)
        }}
      >
        {`Agregar a «${info.etiqueta}»`}
      </button>
      {!habilitado && (
        <p className="panel-aviso">
          {`Esta lista ya llegó a su máximo de ${info.maxItems} elementos: no se puede agregar otro.`}
        </p>
      )}
    </div>
  )
}

/**
 * El botón que borra UN elemento de una lista abierta — nunca con un
 * «¿estás seguro?» que se contesta sin leer: pide escribir el nombre del
 * elemento tal como se ve en pantalla. Borrar nunca toca `publicacion.ts`
 * ni `borrador.ts`: solo llama a `onCambia()`, igual que cualquier otro
 * cambio de un campo — queda en el borrador hasta que ella toque
 * «Publicar», con el deshacer de media hora de la Tarea 1 (fase 7) intacto.
 *
 * Cuando la lista está en su mínimo, el botón se DESHABILITA — no
 * desaparece — y dice por qué: que desaparezca deja a alguien buscando un
 * botón que existía hace un minuto.
 */
function BotonBorrarItem({
  documentos,
  documento,
  rutaLista,
  rutaItem,
  nombreItem,
  etiquetaBoton = ETIQUETA_BORRAR,
  info,
  onCambia,
}: {
  documentos: Documentos
  documento: IdDocumento
  rutaLista: string
  rutaItem: string
  nombreItem: string
  /** Solo cuando hay MÁS DE UN botón de borrar en pantalla: ver `DatosGeneralesDeFicha()`. */
  etiquetaBoton?: string
  info: ListaAbierta
  onCambia: (documentos: Documentos) => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [nombreEscrito, setNombreEscrito] = useState('')
  const [noCoincide, setNoCoincide] = useState(false)
  const habilitado = puedeBorrar(documentos, documento, rutaLista)
  const idNombre = `panel-borrar-nombre-${documento}-${rutaItem}`

  function cancelar() {
    setConfirmando(false)
    setNombreEscrito('')
    setNoCoincide(false)
  }

  function confirmar() {
    if (nombreEscrito.trim() !== nombreItem.trim()) {
      setNoCoincide(true)
      return
    }
    onCambia(quitarItem(documentos, documento, rutaItem))
    cancelar()
  }

  return (
    <div className="panel-lista-borrar">
      {!confirmando ? (
        // El texto por defecto NO lleva el nombre del ítem (a diferencia del
        // párrafo de confirmación, de acá abajo): el nombre real vive
        // TAMBIÉN en el cajón de la izquierda («Cocoa natural», etc.), y
        // repetirlo acá le da a `getByText()` dos lugares donde matchear el
        // mismo texto —lo encontré corriendo el test 1 del despacho, que
        // elige el ítem por su nombre y por eso necesita que ese nombre sea
        // único en pantalla. Ese razonamiento vale mientras haya UN solo
        // botón de borrar en pantalla, que es el caso de las cuatro puertas
        // de dos niveles; los pares de cabecera de una ficha dibujan varios
        // a la vez y le pasan un rótulo propio.
        <button
          type="button"
          className="panel-boton panel-boton-borrar"
          disabled={!habilitado}
          onClick={() => setConfirmando(true)}
        >
          {etiquetaBoton}
        </button>
      ) : (
        <div className="panel-confirmar-borrado">
          <p>{`Para borrar «${nombreItem}», escribe su nombre exactamente como aparece.`}</p>
          <label htmlFor={idNombre}>Escribe el nombre para confirmar</label>
          <input
            id={idNombre}
            type="text"
            value={nombreEscrito}
            onChange={(e) => {
              setNombreEscrito(e.target.value)
              setNoCoincide(false)
            }}
          />
          <button type="button" className="panel-boton" onClick={confirmar}>
            Confirmar
          </button>
          <button type="button" className="panel-enlace-discreto" onClick={cancelar}>
            Cancelar
          </button>
          {noCoincide && (
            <p className="panel-campo-error" role="alert">
              Lo que escribiste no coincide con el nombre: no se borró nada.
            </p>
          )}
        </div>
      )}
      {!habilitado && (
        <p className="panel-aviso">
          {textoMinimoElementos(info.minItems)}
        </p>
      )}
    </div>
  )
}

/**
 * El bloque de alta/baja para el ítem que ella está mirando en una de las
 * cuatro puertas «de dos niveles» (todo menos fichas). Tres resultados:
 * nada (está en el balde de "sueltos": no es un ítem de una lista
 * repetible, así que "agregar/quitar" no tiene sentido acá), el aviso fijo
 * (el ítem SÍ es de una lista repetible, pero cerrada: nueve de las
 * catorce), o los botones reales (una de las cinco abiertas).
 *
 * `onElegir` es el mismo `elegirNivel1()` que ya usa `ListaDeItems`: acá
 * se reutiliza para pararla en el ítem RECIÉN agregado, en vez de dejarla
 * mirando el que ya tenía elegido mientras el nuevo entra calladito al
 * fondo del cajón.
 */
function AltaBajaDeItem({
  documentos,
  itemElegido,
  abiertas,
  onCambia,
  onElegir,
}: {
  documentos: Documentos
  itemElegido: ItemNavegable
  abiertas: readonly ListaAbierta[]
  onCambia: (documentos: Documentos) => void
  onElegir: (clave: string) => void
}) {
  if (esSuelto(itemElegido.clave)) return null
  const documento = itemElegido.campos[0]?.documento
  if (!documento) return null
  // `itemElegido.clave` es '<documento> <rutaConcreta>' (ver `itemsDe()`
  // en `ListaDeItems.tsx`): sacar el prefijo del documento y el espacio
  // que lo separa da la ruta concreta del ítem.
  const rutaItem = itemElegido.clave.slice(documento.length + 1)
  const rutaLista = rutaItem.split('.').slice(0, -1).join('.')
  const info = buscarListaAbierta(abiertas, documento, rutaLista)
  if (!info) return <p className="panel-aviso">{AVISO_ALTA_BAJA}</p>
  return (
    <div className="panel-lista-alta-baja">
      <BotonAgregarLista
        documentos={documentos}
        documento={documento}
        rutaLista={rutaLista}
        info={info}
        onAgregado={(documentosNuevos, indiceNuevo) => {
          onCambia(documentosNuevos)
          onElegir(`${documento} ${rutaLista}.${indiceNuevo}`)
        }}
      />
      <BotonBorrarItem
        key={rutaItem}
        documentos={documentos}
        documento={documento}
        rutaLista={rutaLista}
        rutaItem={rutaItem}
        nombreItem={itemElegido.etiqueta}
        info={info}
        onCambia={onCambia}
      />
    </div>
  )
}

/**
 * 'fichas.0.meta.2.0' → 2 (la fila de la tabla de cabecera a la que
 * pertenece este campo); cualquier otra ruta de la ficha → `undefined`.
 */
function indiceDePar(rutaLista: string, ruta: string): number | undefined {
  const prefijo = `${rutaLista}.`
  if (!ruta.startsWith(prefijo)) return undefined
  const indice = ruta.slice(prefijo.length).split('.')[0]
  return /^\d+$/.test(indice) ? Number(indice) : undefined
}

/** Las dos partes de un par, siempre en el orden del esquema: el nombre y después el valor. */
function ordenarPorParte(campos: readonly CampoEditable[]): CampoEditable[] {
  const parte = (c: CampoEditable) => Number(c.ruta.split('.').at(-1))
  return [...campos].sort((a, b) => parte(a) - parte(b))
}

/**
 * Cómo se llama un par: lo que ella escribió en «Nombre del dato» (la
 * parte 0 de la tupla). Se lee del campo y no del documento para que el
 * rótulo y el botón de borrar la sigan mientras escribe, en vez de quedar
 * un renglón atrás. Mismo respaldo `SIN_NOMBRE` que el resto del panel: un
 * rótulo en blanco es peor que uno provisorio.
 */
function nombreDelPar(campos: readonly CampoEditable[]): string {
  const primera = campos.find((c) => c.ruta.endsWith('.0'))
  const crudo = typeof primera?.valor === 'string' ? primera.valor.trim() : ''
  return crudo.length > 0 ? crudo : SIN_NOMBRE
}

/**
 * «Datos generales de la ficha»: el nombre del producto, la denominación
 * legal y —lo que le da trabajo a este componente— los pares «Nombre del
 * dato / Valor del dato» del encabezado, que son la QUINTA lista abierta
 * (`fichas[].meta[]`).
 *
 * Esos pares no son ítems navegables como los de las otras cuatro puertas:
 * su elemento es una TUPLA sin `nombra()` (ver el esquema de fichas), así
 * que `campo.grupo` nunca se completa para ellos y caen todos juntos
 * adentro de este ítem, mezclados con el nombre del producto y la
 * denominación legal. Y como `campos()` recorre el esquema HOJA POR HOJA
 * —todas las instancias de «Nombre del dato», después todas las de «Valor
 * del dato»— llegan acá en ese orden: cuatro nombres seguidos y después
 * cuatro valores.
 *
 * [Ronda de arreglo final] Por eso este componente los REAGRUPA por
 * índice de par antes de dibujarlos, le pone a cada par su rótulo
 * (`rotuloDePar()`) y le deja SU botón de borrar adentro, diciendo cuál
 * borra. Antes de esto, la pantalla mostraba las cuatro cajas de nombre,
 * después las cuatro de valor, y debajo cuatro botones idénticos: la
 * puerta donde viven las declaraciones que tienen que coincidir con el
 * empaque impreso era, literalmente, la que no se podía usar.
 */
function DatosGeneralesDeFicha({
  item,
  rutaFicha,
  documentos,
  abiertas,
  onCambio,
  onCambia,
}: {
  item: ItemNavegable
  rutaFicha: string
  documentos: Documentos
  abiertas: readonly ListaAbierta[]
  onCambio: (campo: CampoEditable, valor: unknown) => void
  onCambia: (documentos: Documentos) => void
}) {
  const rutaLista = `${rutaFicha}.meta`
  // No debería faltar — 'fichas[].meta[]' es una de las cinco abiertas por
  // diseño — pero si el día de mañana deja de estarlo, los pares se siguen
  // viendo y emparejados: lo único que desaparece son los botones.
  const info = buscarListaAbierta(abiertas, 'fichas', rutaLista)

  const sinPar: CampoEditable[] = []
  const pares = new Map<number, CampoEditable[]>()
  for (const campo of item.campos) {
    const indice = indiceDePar(rutaLista, campo.ruta)
    if (indice === undefined) {
      sinPar.push(campo)
      continue
    }
    const balde = pares.get(indice)
    if (balde) balde.push(campo)
    else pares.set(indice, [campo])
  }
  const ordenados = [...pares.entries()].sort(([a], [b]) => a - b)

  return (
    <div className="panel-puerta-campos">
      {/* El resumen cuenta TODOS los campos del ítem, pares incluidos: lo
          que falta para poder publicar no cambia porque abajo se dibuje en
          dos tandas. */}
      <ResumenDeFaltantes campos={item.campos} etiqueta={item.etiqueta} />
      <ListaDeCampos campos={sinPar} rutaContexto={rutaFicha} onCambio={onCambio} />

      {ordenados.length > 0 && info && (
        <div className="panel-datos-cabecera">
          <h3 className="panel-grupo-titulo">{info.etiqueta}</h3>
          {ordenados.map(([indice, campos]) => {
            const nombre = nombreDelPar(campos)
            const rutaItem = `${rutaLista}.${indice}`
            // La `key` lleva la ruta ENTERA, con la ficha adentro, y no el
            // índice solo: `BotonBorrarItem` guarda adentro si está
            // confirmando y qué nombre escribió ella, y con una `key` que
            // se repite entre fichas ese estado viajaría de una ficha a la
            // otra al cambiar de ficha en el cajón. Es la misma trampa que
            // esta ronda vino a arreglar en `Campo`, un piso más arriba.
            return (
              <div key={rutaItem} className="panel-dato-par">
                <h4 className="panel-dato-par-titulo">{rotuloDePar(indice, nombre)}</h4>
                <ListaDeCampos campos={ordenarPorParte(campos)} rutaContexto={rutaFicha} onCambio={onCambio} />
                <BotonBorrarItem
                  documentos={documentos}
                  documento="fichas"
                  rutaLista={rutaLista}
                  rutaItem={rutaItem}
                  nombreItem={nombre}
                  etiquetaBoton={etiquetaBorrarPar(nombre)}
                  info={info}
                  onCambia={onCambia}
                />
              </div>
            )
          })}
        </div>
      )}

      {info && (
        // Acá no hace falta "pararse en el nuevo": los pares de cabecera no
        // son ítems navegables (ver el docstring de arriba) — el par nuevo
        // aparece de una en esta misma vista, sin necesitar que se mueva
        // ninguna selección.
        <BotonAgregarLista
          documentos={documentos}
          documento="fichas"
          rutaLista={rutaLista}
          info={info}
          onAgregado={onCambia}
        />
      )}
    </div>
  )
}

/*
 * ---------------------------------------------------------------------
 * El componente
 * ---------------------------------------------------------------------
 */

export default function Puerta({
  documentos,
  onCambia,
}: {
  documentos: Documentos
  onCambia: (documentos: Documentos) => void
}) {
  const [puerta, setPuerta] = useState<TipoPuerta | null>(null)
  // El ítem elegido en el nivel "de dos niveles" (las cuatro puertas que no
  // son fichas) O la ficha elegida en el nivel 1 de fichas — dos preguntas
  // distintas que nunca conviven, así que comparten esta única variable.
  const [elegido1, setElegido1] = useState<string | null>(null)
  // La sección elegida, SOLO tiene sentido una vez que `elegido1` ya es una
  // ficha real (no "sueltos") dentro de la puerta de fichas.
  const [elegido2, setElegido2] = useState<string | null>(null)
  // Dos cajones, no uno: el de fichas (nivel 1) y el de secciones (nivel 2)
  // conviven en la misma pantalla y cada uno se abre y se cierra solo.
  const [cajon1Abierto, setCajon1Abierto] = useState(false)
  const [cajon2Abierto, setCajon2Abierto] = useState(false)

  // Se recalcula solo cuando `documentos` cambia — no en cada click de
  // navegación: mismo criterio que ya usaba `Editor.tsx` con `useMemo`.
  const todos = useMemo(() => campos(documentos), [documentos])
  const camposPuerta = useMemo(() => (puerta ? camposDePuerta(todos, puerta) : []), [todos, puerta])

  /*
   * Las reglas de los hooks de React exigen llamarlos SIEMPRE en el mismo
   * orden — nunca adentro de un `if` — así que las dos formas de esta
   * pantalla (fichas, de tres niveles; las otras cuatro, de dos) se
   * calculan ACÁ, sin condicionar la LLAMADA a `useMemo`, aunque el VALOR
   * de adentro quede vacío cuando esta puerta no es la que corresponde. El
   * costo es mínimo: como mucho, recorrer los 341 campos de fichas una vez
   * de más.
   */
  const nivel1Fichas = useMemo(() => (puerta === 'fichas' ? fichasDe(camposPuerta) : []), [puerta, camposPuerta])
  const fichaElegida = puerta === 'fichas' ? (nivel1Fichas.find((i) => i.clave === elegido1) ?? null) : null
  const esFichaReal = fichaElegida !== null && fichaElegida.clave !== 'sueltos'
  const nivel2Fichas = useMemo(
    () => (fichaElegida !== null && esFichaReal ? seccionesDe(fichaElegida.clave, fichaElegida.campos) : []),
    [fichaElegida, esFichaReal],
  )
  const seccionElegida = esFichaReal ? (nivel2Fichas.find((i) => i.clave === elegido2) ?? null) : null

  const items = useMemo(
    () => (puerta && puerta !== 'fichas' ? itemsDe(camposPuerta) : []),
    [puerta, camposPuerta],
  )
  const itemElegido = puerta && puerta !== 'fichas' ? (items.find((i) => i.clave === elegido1) ?? null) : null

  // Solo depende del ESQUEMA (Tarea 3), no de `documentos`: se calcula una
  // sola vez, no en cada tecla.
  const abiertas = useMemo(() => listasAbiertas(), [])

  /**
   * Borrar el ÚLTIMO ítem de una lista dentro de las cuatro puertas "de dos
   * niveles" deja `elegido1` apuntando a una clave que ya no existe —
   * borrar cualquier otro ítem no tiene este problema: como la clave lleva
   * el ÍNDICE, lo que estaba un lugar más atrás ocupa la misma clave y
   * sigue eligiéndose solo. Sin este efecto, la pantalla se queda en
   * blanco después de borrar el último elemento de una lista.
   */
  useEffect(() => {
    if (!puerta || puerta === 'fichas') return
    if (items.length === 0) return
    if (items.some((i) => i.clave === elegido1)) return
    setElegido1(primeroReal(items)?.clave ?? null)
  }, [puerta, items, elegido1])

  function alCambiarValor(campo: CampoEditable, valor: unknown) {
    onCambia(escribirValor(documentos, campo, valor))
  }

  /**
   * Abre una puerta con algo YA elegido — nunca en blanco. Se recalculan
   * `camposDePuerta`/`itemsDe`/`fichasDe` acá, en vez de esperar a que
   * `items`/`nivel1Fichas` (arriba) se pongan al día con la puerta nueva,
   * porque este mismo evento es el que hace que se pongan al día: cuando
   * `elegirPuerta()` corre, esos `useMemo` todavía traen los de la puerta
   * VIEJA. Es la única función de este archivo que repite un cálculo que
   * el resto saca de un `useMemo` — a propósito, por esa misma razón.
   */
  function elegirPuerta(p: TipoPuerta) {
    setPuerta(p)
    setCajon1Abierto(false)
    setCajon2Abierto(false)
    if (p === 'fichas') {
      const nivel1 = fichasDe(camposDePuerta(todos, p))
      const defecto = primeroReal(nivel1)
      setElegido1(defecto?.clave ?? null)
      setElegido2(
        defecto && defecto.clave !== 'sueltos'
          ? (primeroReal(seccionesDe(defecto.clave, defecto.campos))?.clave ?? null)
          : null,
      )
    } else {
      const its = itemsDe(camposDePuerta(todos, p))
      setElegido1(primeroReal(its)?.clave ?? null)
      setElegido2(null)
    }
  }

  function volverAPuertas() {
    setPuerta(null)
    setElegido1(null)
    setElegido2(null)
    setCajon1Abierto(false)
    setCajon2Abierto(false)
  }

  /** Elegir un ítem en el nivel "de dos niveles", O una ficha en el nivel 1 de fichas. */
  function elegirNivel1(clave: string) {
    setElegido1(clave)
    if (puerta === 'fichas') {
      const ficha = nivel1Fichas.find((i) => i.clave === clave)
      setElegido2(
        ficha && ficha.clave !== 'sueltos'
          ? (primeroReal(seccionesDe(ficha.clave, ficha.campos))?.clave ?? null)
          : null,
      )
    } else {
      setElegido2(null)
    }
  }

  /*
   * -----------------------------------------------------------------
   * Pantalla 0: las cinco puertas, por su nombre
   * -----------------------------------------------------------------
   */
  if (puerta === null) {
    return (
      <div className="panel-puertas">
        <h2 className="panel-titulo">{TITULO_PUERTAS}</h2>
        <ul className="panel-puertas-lista">
          {PUERTAS.map((p) => (
            <li key={p}>
              <button type="button" className="panel-puerta-boton" onClick={() => elegirPuerta(p)}>
                {ETIQUETA_DE_PUERTA[p]}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const avisoDePuerta = AVISO_DE_PUERTA[puerta]

  /*
   * -----------------------------------------------------------------
   * Fichas técnicas: el único camino de tres niveles. Los DOS cajones
   * —fichas y secciones— conviven en pantalla, uno anidado adentro del
   * otro, en vez de que elegir una ficha tape la lista de fichas: así
   * ella puede saltar de "Chocolate en polvo" a "Cocoa natural" sin
   * volver un paso atrás primero.
   * -----------------------------------------------------------------
   */
  if (puerta === 'fichas') {
    return (
      <div className="panel-puerta">
        <CabeceraDePuerta titulo={ETIQUETA_DE_PUERTA.fichas} onVolver={volverAPuertas} />
        {avisoDePuerta && <AvisoDePuerta texto={avisoDePuerta} />}

        <div className="panel-puerta-cuerpo">
          <ListaDeItems
            items={nivel1Fichas}
            elegido={elegido1 ?? ''}
            onElegir={elegirNivel1}
            abierta={cajon1Abierto}
            onAbrir={setCajon1Abierto}
            nombre={NOMBRE_LISTA_FICHAS}
          />
          <div className="panel-puerta-contenido">
            {fichaElegida !== null && !esFichaReal && (
              <FormularioDeCampos
                campos={fichaElegida.campos}
                etiqueta={fichaElegida.etiqueta}
                rutaContexto={undefined}
                onCambio={alCambiarValor}
              />
            )}

            {fichaElegida !== null && esFichaReal && (
              <>
                <h3 className="panel-puerta-subtitulo">{fichaElegida.etiqueta}</h3>
                <div className="panel-puerta-cuerpo">
                  <ListaDeItems
                    items={nivel2Fichas}
                    elegido={elegido2 ?? ''}
                    onElegir={setElegido2}
                    abierta={cajon2Abierto}
                    onAbrir={setCajon2Abierto}
                    nombre={NOMBRE_LISTA_SECCIONES}
                  />
                  <div className="panel-puerta-contenido">
                    {seccionElegida === null ? (
                      <p className="panel-aviso">{AVISO_SIN_SECCION}</p>
                    ) : (
                      /*
                        "Datos generales de la ficha" (Tarea 6) es el ÚNICO
                        ítem de nivel 2 cuya clave es la ruta de la FICHA
                        misma (ver `seccionesDe()`, más arriba): ahí adentro
                        viven los pares de "Datos de cabecera"
                        (`fichas[].meta[]`), la quinta lista abierta, que
                        necesitan su propio armado. Ninguna sección real
                        (`fichas.<i>.secciones.<j>`) entra acá.
                      */
                      seccionElegida.clave === fichaElegida.clave ? (
                        <DatosGeneralesDeFicha
                          item={seccionElegida}
                          rutaFicha={fichaElegida.clave}
                          documentos={documentos}
                          abiertas={abiertas}
                          onCambio={alCambiarValor}
                          onCambia={onCambia}
                        />
                      ) : (
                        <FormularioDeCampos
                          campos={seccionElegida.campos}
                          etiqueta={seccionElegida.etiqueta}
                          rutaContexto={seccionElegida.clave}
                          onCambio={alCambiarValor}
                        />
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  /*
   * -----------------------------------------------------------------
   * Las otras cuatro puertas: dos niveles — el ítem, y sus campos
   * -----------------------------------------------------------------
   */
  return (
    <div className="panel-puerta">
      <CabeceraDePuerta titulo={ETIQUETA_DE_PUERTA[puerta]} onVolver={volverAPuertas} />
      {avisoDePuerta && <AvisoDePuerta texto={avisoDePuerta} />}
      <div className="panel-puerta-cuerpo">
        <ListaDeItems
          items={items}
          elegido={elegido1 ?? ''}
          onElegir={elegirNivel1}
          abierta={cajon1Abierto}
          onAbrir={setCajon1Abierto}
        />
        <div className="panel-puerta-contenido">
          {itemElegido !== null && (
            <>
              <FormularioDeCampos
                campos={itemElegido.campos}
                etiqueta={itemElegido.etiqueta}
                rutaContexto={itemElegido.campos[0]?.grupo?.ruta}
                onCambio={alCambiarValor}
              />
              <AltaBajaDeItem
                documentos={documentos}
                itemElegido={itemElegido}
                abiertas={abiertas}
                onCambia={onCambia}
                onElegir={elegirNivel1}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/*
 * ---------------------------------------------------------------------
 * Piezas chicas, compartidas por las dos formas de la pantalla
 * ---------------------------------------------------------------------
 */

function CabeceraDePuerta({ titulo, onVolver }: { titulo: string; onVolver: () => void }) {
  return (
    <div className="panel-puerta-cabecera">
      <button type="button" className="panel-enlace-discreto" onClick={onVolver}>
        {VOLVER_A_PUERTAS}
      </button>
      <h2 className="panel-titulo">{titulo}</h2>
    </div>
  )
}

/**
 * El aviso de una puerta (hoy, fichas e invisible): una caja que se nota
 * más que `.panel-aviso` a propósito — la de fichas existe para que entrar
 * ahí no se sienta igual que corregir una errata de la portada.
 */
function AvisoDePuerta({ texto }: { texto: string }) {
  return (
    <p className="panel-puerta-advertencia" role="note">
      {texto}
    </p>
  )
}
