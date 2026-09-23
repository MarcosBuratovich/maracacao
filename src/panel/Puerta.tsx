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
 * elija antes de ver nada. Se elige el primer ítem REAL (no el balde de
 * "sueltos", que en Productos junta 49 campos sueltos y rompería la
 * promesa de "un puñado") y ella puede cambiarlo con el cajón, que sigue
 * ahí al costado.
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
import { useMemo, useState } from 'react'
import {
  campos, escribirValor,
  type CampoEditable, type Documentos,
} from './campos'
import {
  camposDePuerta, PUERTAS, ETIQUETA_DE_PUERTA, AVISO_DE_PUERTA,
  type Puerta as TipoPuerta,
} from './puertas'
import ListaDeItems, { itemsDe, type ItemNavegable } from './ListaDeItems'
import Campo from './Campo'

/*
 * ---------------------------------------------------------------------
 * Los textos propios de esta pantalla — ninguno sale de `src/contenido/**`
 * ---------------------------------------------------------------------
 */

const TITULO_PUERTAS = '¿Qué quieres editar?'

/**
 * Por ahora, ni un solo botón de agregar/quitar vive en esta pantalla —
 * llega recién en la Tarea 7. Sin este aviso, un cajón sin botón de alta se
 * lee como un error del panel; con él, se lee como lo que es: todavía no
 * se puede desde acá, y hay a quién escribirle. El mismo texto sirve para
 * cualquier puerta a propósito: hoy es cierto en las cinco por igual,
 * cocoas incluidas (Tarea 3 la dejó lista para dar de alta sola, pero esta
 * pantalla no le puso botón todavía).
 */
const AVISO_ALTA_BAJA =
  'Agregar o quitar un elemento de esta lista todavía no se puede desde el panel: esos los da de alta Marcos. Escríbele si necesitas uno nuevo.'

const AVISO_SIN_SECCION = 'Elige una sección para ver sus datos.'
const ETIQUETA_DATOS_GENERALES = 'Datos generales de la ficha'
const VOLVER_A_PUERTAS = 'Volver a las cinco puertas'

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
 * el primero que no sea el balde de "sueltos" — ese junta hasta 49 campos
 * en Productos, y elegirlo de arranque rompería la promesa de "un puñado"
 * el primer segundo que ella ve la pantalla. Si la puerta NO tiene más que
 * sueltos (el caso de "Lo que no se ve"), no queda otra: se elige ese.
 */
function primeroReal(items: readonly ItemNavegable[]): ItemNavegable | undefined {
  return items.find((i) => i.clave !== 'sueltos') ?? items[0]
}

/*
 * ---------------------------------------------------------------------
 * El formulario de UN ítem/sección ya elegido — nunca más de un puñado
 * ---------------------------------------------------------------------
 */

/**
 * Dibuja los campos de un ítem ya elegido, con un encabezado chico cada vez
 * que aparece un grupo más adentro del que ella ya eligió — el caso real es
 * un bloque (párrafo/lista/tabla) DENTRO de una sección de ficha, para que
 * una tabla de 20 celdas no se confunda con el párrafo de al lado. Para
 * cualquier ítem de las otras cuatro puertas esto nunca dibuja un
 * encabezado: `itemsDe()` ya agrupó esos campos por su único grupo, así que
 * `campo.grupo.ruta` nunca cambia dentro de un mismo ítem.
 */
function FormularioDeCampos({
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
    <div className="panel-puerta-campos">
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
        {nivel1Fichas.length > 1 && <p className="panel-aviso">{AVISO_ALTA_BAJA}</p>}

        <div className="panel-puerta-cuerpo">
          <ListaDeItems
            items={nivel1Fichas}
            elegido={elegido1 ?? ''}
            onElegir={elegirNivel1}
            abierta={cajon1Abierto}
            onAbrir={setCajon1Abierto}
          />
          <div className="panel-puerta-contenido">
            {fichaElegida !== null && !esFichaReal && (
              <FormularioDeCampos campos={fichaElegida.campos} rutaContexto={undefined} onCambio={alCambiarValor} />
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
                  />
                  <div className="panel-puerta-contenido">
                    {seccionElegida === null ? (
                      <p className="panel-aviso">{AVISO_SIN_SECCION}</p>
                    ) : (
                      <FormularioDeCampos
                        campos={seccionElegida.campos}
                        rutaContexto={seccionElegida.clave}
                        onCambio={alCambiarValor}
                      />
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
      {items.length > 1 && <p className="panel-aviso">{AVISO_ALTA_BAJA}</p>}
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
            <FormularioDeCampos
              campos={itemElegido.campos}
              rutaContexto={itemElegido.campos[0]?.grupo?.ruta}
              onCambio={alCambiarValor}
            />
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
