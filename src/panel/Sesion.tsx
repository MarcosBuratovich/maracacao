/*
 * La pantalla que comparten las Tareas 3 y 4 (fase 6): el borrador y
 * publicar/saber/deshacer. Envuelve a `Puerta` (Tarea 6, fase 7 — antes
 * `Editor`, Tarea 2 de la fase 6, borrado en la Tarea 8) — nunca reescribe
 * el formulario, solo lo controla desde afuera (`documentos`/`onCambia`,
 * ver `Puerta.tsx`) para poder autoguardar cada cambio y armar la bandeja
 * de publicar con lo mismo que ella está viendo.
 *
 * Toda la lógica de estado vive en funciones/clases puras e inyectables en
 * `./borrador` y `./publicacion` — mismo criterio que `App.tsx` aplica a
 * `cargaInicial`/`intentaEntrar`: este componente es la plomería mínima que
 * las conecta a un formulario, así que se prueban DIRECTO, sin montar
 * nada. Ninguna llamada de red puede dejar una pantalla sin salida (regla
 * de la tarea): toda fase de error de acá abajo tiene, al lado, un botón
 * que hace algo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Puerta from './Puerta'
import { contenidoPublicado, type Documentos } from './campos'
import { idDeAparato } from './aparato'
import {
  borradorLeer, borradorGuardar, publicar as publicarApi, estado as estadoApi, deshacer as deshacerApi,
  URL_BASE,
  type AvisoPublicado, type ResultadoBorradorLeer,
} from './api'
import {
  trasLeerBorrador, resuelveConflicto, resumenBorradorAjeno, resumenOtroBorrador, cuerpoParaBeacon,
  Autoguardado, type EstadoBorrador, type EleccionConflicto, type ResultadoGuardadoTraducido,
} from './borrador'
import {
  preparaRevision, trasPublicar, trasEstado, trasDeshacer, sondea, puedeDeshacer, hrefVerSitio,
  siguienteBase, etiquetaDeCambio, puedeConfirmarPublicar, FRASE_PUBLICANDO,
  type EstadoPublicacion, type DatosSondeo, type ControladorSondeo,
} from './publicacion'

/*
 * ---------------------------------------------------------------------
 * El estado del guardado automático — capa visual sobre `ResultadoGuardadoTraducido`
 * ---------------------------------------------------------------------
 */

type EstadoAvisoGuardado = { tipo: 'ocioso' } | { tipo: 'pendiente' } | ResultadoGuardadoTraducido

/** Cuando no hay `base` (nunca en producción; solo si `historial` no pudo leer nada), no hay contra qué guardar ni publicar. */
const PROBLEMA_SIN_BASE_LOCAL = 'No pudimos preparar la publicación: recarga el panel.'

export default function Sesion({ base }: { base: string | null }) {
  const [dispositivo] = useState(() => idDeAparato())
  const [documentos, setDocumentos] = useState<Documentos>(() => contenidoPublicado())
  const [originales, setOriginales] = useState<Documentos>(() => contenidoPublicado())
  const [baseActual, setBaseActual] = useState<string | null>(base)
  const [estadoBorrador, setEstadoBorrador] = useState<EstadoBorrador>({ fase: 'leyendo' })
  const [avisoGuardado, setAvisoGuardado] = useState<EstadoAvisoGuardado>({ tipo: 'ocioso' })
  const [publicacion, setPublicacion] = useState<EstadoPublicacion | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  const baseRef = useRef(baseActual)
  useEffect(() => {
    baseRef.current = baseActual
  }, [baseActual])

  const sondeoRef = useRef<ControladorSondeo | null>(null)
  const autoguardadoRef = useRef<Autoguardado | null>(null)
  if (autoguardadoRef.current === null) {
    autoguardadoRef.current = new Autoguardado({
      guardar: (docs, args) => {
        if (baseRef.current === null) {
          return Promise.resolve({ ok: false, status: 0, problema: PROBLEMA_SIN_BASE_LOCAL })
        }
        return borradorGuardar({ documentos: docs, base: baseRef.current, horaLeida: args.horaLeida, pisar: args.pisar })
      },
      onResultado: (r) => setAvisoGuardado(r),
    })
  }

  // El reloj del botón «Deshacer»: se despierta cada rato, SOLO mientras
  // hay algo publicado que podría dejar de ser deshacible — nunca corre en
  // la edición normal, que es donde vive el 90% del tiempo.
  useEffect(() => {
    if (publicacion === null || !('datos' in publicacion)) return
    const id = setInterval(() => setAhora(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [publicacion])

  useEffect(() => {
    return () => {
      autoguardadoRef.current?.destruye()
      sondeoRef.current?.detente()
    }
  }, [])

  /**
   * [H4, ronda de arreglo] El guardado de emergencia al cerrar la pestaña.
   * Sin esto, cerrar antes de que el retardo (10 s) o el piso (30 s)
   * dispararan perdía lo escrito en silencio — `destruye()` (el cleanup
   * de arriba) descarta `this.pendiente` sin avisar, a propósito, porque
   * ahí el motivo normal es que ELLA navegó dentro del panel, no que se
   * fue del todo.
   *
   * `pagehide`, no `beforeunload`: `beforeunload` no dispara confiable en
   * navegadores de celular (la plataforma más importante para este
   * panel), y además interrumpe la navegación con un diálogo que acá no
   * hace falta. `navigator.sendBeacon` en vez de `fetch`: la página puede
   * desaparecer a mitad de un `await` y la respuesta no importa —esto es
   * mejor esfuerzo por diseño—, y a diferencia de `fetch`, el navegador
   * garantiza que el pedido SALE aunque el documento ya se esté
   * descargando. Las cookies del origen (la sesión) viajan solas, igual
   * que en cualquier pedido normal a la misma URL.
   *
   * La DECISIÓN de qué mandar —o si hay algo que mandar— es
   * `cuerpoParaBeacon()`, pura y probada sin `navigator` ni ningún DOM
   * (`test/panel-borrador.test.ts`); acá solo se llama.
   */
  useEffect(() => {
    function alCerrarLaPestana() {
      const cuerpo = cuerpoParaBeacon(autoguardadoRef.current?.datosPendientes() ?? null, baseRef.current)
      if (cuerpo === null) return
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return
      const blob = new Blob([JSON.stringify(cuerpo)], { type: 'application/json' })
      navigator.sendBeacon(`${URL_BASE}?accion=borrador.guardar`, blob)
    }
    window.addEventListener('pagehide', alCerrarLaPestana)
    return () => window.removeEventListener('pagehide', alCerrarLaPestana)
  }, [])

  function procesaLecturaBorrador(r: ResultadoBorradorLeer) {
    const siguiente = trasLeerBorrador(r, dispositivo)
    setEstadoBorrador(siguiente)
    if (siguiente.fase === 'listo') {
      autoguardadoRef.current?.fijaHoraLeida(siguiente.horaLeida)
      if (siguiente.documentos) {
        setDocumentos({ ...originales, ...siguiente.documentos } as Documentos)
      }
    }
  }

  useEffect(() => {
    let vivo = true
    void borradorLeer().then((r) => {
      if (vivo) procesaLecturaBorrador(r)
    })
    return () => {
      vivo = false
    }
  }, [])

  function alReintentarLecturaBorrador() {
    setEstadoBorrador({ fase: 'leyendo' })
    void borradorLeer().then(procesaLecturaBorrador)
  }

  function alResolverConflicto(eleccion: EleccionConflicto) {
    if (estadoBorrador.fase !== 'conflicto') return
    const { horaLeida, documentos: docsElegidos } = resuelveConflicto(eleccion, estadoBorrador.borrador)
    autoguardadoRef.current?.fijaHoraLeida(horaLeida)
    if (docsElegidos) setDocumentos({ ...originales, ...docsElegidos } as Documentos)
    setEstadoBorrador({ fase: 'listo', horaLeida, documentos: undefined })
  }

  function alCambiarDocumentos(siguiente: Documentos) {
    setDocumentos(siguiente)
    if (baseRef.current !== null) {
      setAvisoGuardado({ tipo: 'pendiente' })
      autoguardadoRef.current?.anota(siguiente)
    }
  }

  function alForzarGuardado() {
    setAvisoGuardado({ tipo: 'pendiente' })
    autoguardadoRef.current?.fuerzaProximoGuardado()
    autoguardadoRef.current?.guardaAhora(documentos)
  }

  function alReintentarGuardado() {
    setAvisoGuardado({ tipo: 'pendiente' })
    autoguardadoRef.current?.guardaAhora(documentos)
  }

  async function alVerBorradorMasNuevo() {
    setAvisoGuardado({ tipo: 'ocioso' })
    const r = await borradorLeer()
    procesaLecturaBorrador(r)
  }

  const revisionActual = useMemo(() => preparaRevision(documentos, originales), [documentos, originales])

  function alPulsarPublicar() {
    setPublicacion({ fase: 'revisando', cambios: revisionActual.cambios, fraseCorta: revisionActual.fraseCorta })
  }

  function alCancelarPublicacion() {
    sondeoRef.current?.detente()
    setPublicacion(null)
  }

  function arrancaSondeo(datos: DatosSondeo) {
    sondeoRef.current?.detente()
    sondeoRef.current = sondea(
      { sha: datos.sha, publicadoEn: datos.publicadoEn },
      {
        estado: estadoApi,
        espera: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onResultado: (r) => {
          setPublicacion((actual) => {
            if (actual === null || !('datos' in actual)) return actual
            return trasEstado(r, actual.datos)
          })
        },
      },
    )
  }

  async function alConfirmarPublicar() {
    // [H1, ronda de arreglo] `puedeConfirmarPublicar` acepta 'revisando'
    // (el botón «Confirmar y publicar») Y 'error-publicar' (el botón
    // «Reintentar» de la pantalla de error) — antes esta guarda solo
    // dejaba pasar 'revisando', así que «Reintentar» llamaba a esta MISMA
    // función y salía sin hacer nada: un botón muerto, justo en el error
    // más probable (el 409 de pisada, «Marcos cambió algo del sitio
    // mientras editabas: vuelve a intentar la publicación.»).
    //
    // A propósito NO se refresca `baseActual` antes de reintentar. Un 409
    // pasa porque, en el medio, Marcos cambió alguno de los documentos que
    // ella también está publicando — y el documento que ella tiene en
    // memoria arrancó de ANTES de ese cambio, así que no lo conoce. Pedir
    // un `base` fresco acá y publicar directo arriba de él arriesgaría
    // pisar el cambio de Marcos EN SILENCIO —el mismo tipo de pérdida de
    // trabajo que el hallazgo H5 de esta misma ronda, y exactamente lo que
    // el chequeo de `base` existe para evitar—, porque nada en este código
    // vuelve a mirar qué cambió antes de reintentar. Reintentar con el
    // MISMO `base` es seguro: si el choque sigue, sale el mismo 409 de
    // nuevo (nunca escribe nada raro); si ya no hay choque, el reintento
    // simplemente funciona. Si el 409 persiste, la salida real es volver a
    // abrir el panel (ahí sí se refrescan `base` Y el borrador) — no un
    // reintento ciego contra un estado que este código no volvió a mirar.
    if (!puedeConfirmarPublicar(publicacion) || baseActual === null) return
    const previo = { cambios: publicacion.cambios, fraseCorta: publicacion.fraseCorta }
    setPublicacion({ fase: 'publicando', ...previo })
    const publicadoEn = Date.now()
    const r = await publicarApi({ documentos, base: baseActual })
    if (r.ok) {
      setBaseActual((actual) => siguienteBase(actual, r.sha))
      setOriginales(documentos)
    }
    const siguiente = trasPublicar(r, publicadoEn, previo)
    setPublicacion(siguiente)
    if (siguiente.fase === 'sondeando') arrancaSondeo(siguiente.datos)
  }

  function alReintentarSondeo() {
    if (publicacion === null || !('datos' in publicacion)) return
    setPublicacion({ fase: 'sondeando', frase: FRASE_PUBLICANDO, datos: publicacion.datos })
    arrancaSondeo(publicacion.datos)
  }

  async function alConfirmarDeshacer() {
    if (publicacion === null || !('datos' in publicacion)) return
    const datos = publicacion.datos
    sondeoRef.current?.detente()
    setPublicacion({ fase: 'deshaciendo', datos })
    const r = await deshacerApi({ sha: datos.sha })
    if (r.ok) setBaseActual((actual) => siguienteBase(actual, r.sha))
    setPublicacion(trasDeshacer(r, datos))
  }

  /**
   * Recarga el panel ENTERO — la única salida de verdad en DOS pantallas
   * distintas, por la MISMA razón de fondo: ninguna de las ocho acciones
   * del servidor devuelve el contenido vivo de los tres documentos
   * (`historial()` da el `base`, no el contenido; arreglar eso de raíz
   * tocaría `src/servidor/**`, fuera del alcance de hoy), así que no hay
   * forma de armar un `originales`/`baseActual` frescos a mano. Una
   * recarga fuerza a `historial()` a pedir un `base` de verdad Y a que
   * `contenidoPublicado()` salga del paquete que HOY está desplegado —
   * no es perfecta (si un despliegue en curso todavía no terminó, sigue
   * mostrando el estado anterior un rato más), pero nunca es PEOR que
   * abrir el panel de cero, que es la única garantía que se puede dar
   * sin una acción nueva del servidor.
   *
   * [H5, ronda de arreglo] La primera pantalla que la necesitó: «Volver a
   * editar» tras deshacer. Antes, `setOriginales(contenidoPublicado())`
   * volvía al paquete COMPILADO del panel —no a lo que está vivo después
   * del deshacer—, así que con dos publicaciones en la misma sesión
   * (publica A, publica B, deshace B) la bandeja de revisión comparaba
   * dos copias igual de viejas, mostraba «1 cambio», y la publicación
   * siguiente escribía ese cambio MÁS la reversión en silencio de A —
   * trabajo suyo que desaparecía sin que la pantalla que existe para
   * evitar exactamente eso se diera cuenta.
   *
   * [Última ronda] La segunda: el 409 de pisada en `error-publicar`. La
   * ronda anterior aceptó «Reintentar» en esa fase (H1) razonando que
   * reintentar con el MISMO `base` era seguro —lo sigue siendo— «porque o
   * sale el mismo 409, o ya no hay choque» —eso es lo que estaba mal—.
   * Un 409 de pisada es DETERMINISTA: el servidor compara el `base` VIEJO
   * de ella contra la cabeza actual (`comparaRefs`, `acciones.ts`), y si
   * Marcos tocó alguno de los tres documentos que el panel manda siempre
   * juntos, ESE archivo sigue apareciendo en esa comparación contra
   * CUALQUIER cabeza posterior — nunca se «despisa» solo. Como
   * `baseActual` únicamente avanza con un ÉXITO, «Reintentar» nunca deja
   * de chocar, y «Cancelar» y volver a publicar da exactamente lo mismo:
   * un botón vivo que jamás puede tener éxito es, para ella, indistinguible
   * de uno muerto. La única salida real es esta misma recarga.
   */
  function recargaElPanel() {
    window.location.reload()
  }

  if (estadoBorrador.fase === 'leyendo') {
    return (
      <p className="panel-aviso" role="status">
        Buscando si tienes cambios guardados en otro aparato…
      </p>
    )
  }

  if (estadoBorrador.fase === 'conflicto') {
    const resumen = resumenBorradorAjeno(estadoBorrador.borrador, originales, ahora)
    return (
      <div className="panel-conflicto">
        <h2 className="panel-titulo">Encontramos un borrador tuyo en otro aparato.</h2>
        <p className="panel-aviso">{resumen}</p>
        <button type="button" className="panel-boton" onClick={() => alResolverConflicto('abrir-otro')}>
          Abrir ese borrador
        </button>
        <button type="button" className="panel-enlace-discreto" onClick={() => alResolverConflicto('seguir-publicado')}>
          Seguir con lo publicado
        </button>
      </div>
    )
  }

  return (
    <div className="panel-sesion">
      {estadoBorrador.fase === 'error' && (
        <div className="panel-conflicto">
          <p className="panel-error" role="alert">
            {estadoBorrador.problema}
          </p>
          <button type="button" className="panel-enlace-discreto" onClick={alReintentarLecturaBorrador}>
            Reintentar
          </button>
        </div>
      )}

      {publicacion === null && (
        <>
          {avisoGuardado.tipo === 'pendiente' && (
            <p className="panel-aviso" role="status">
              Guardando tu borrador…
            </p>
          )}
          {avisoGuardado.tipo === 'ok' && (
            <p className="panel-aviso" role="status">
              Tu borrador está guardado.
            </p>
          )}
          {avisoGuardado.tipo === 'conflicto' && (
            <div className="panel-conflicto">
              <p className="panel-error" role="alert">
                {avisoGuardado.problema}
              </p>
              <p className="panel-aviso">{resumenOtroBorrador(avisoGuardado.otro, ahora)}</p>
              <button type="button" className="panel-boton" onClick={alForzarGuardado}>
                Guardar mis cambios de todos modos
              </button>
              <button type="button" className="panel-enlace-discreto" onClick={() => void alVerBorradorMasNuevo()}>
                Ver ese borrador
              </button>
            </div>
          )}
          {avisoGuardado.tipo === 'error' && (
            <div className="panel-conflicto">
              <p className="panel-error" role="alert">
                {avisoGuardado.problema}
              </p>
              <button type="button" className="panel-enlace-discreto" onClick={alReintentarGuardado}>
                Reintentar
              </button>
            </div>
          )}

          <Puerta documentos={documentos} onCambia={alCambiarDocumentos} />

          {baseActual === null && <p className="panel-aviso">{PROBLEMA_SIN_BASE_LOCAL}</p>}
          {baseActual !== null && revisionActual.cambios.length === 0 && (
            <p className="panel-aviso">Todavía no cambiaste nada que publicar.</p>
          )}
          <button
            type="button"
            className="panel-boton"
            disabled={baseActual === null || revisionActual.cambios.length === 0}
            onClick={alPulsarPublicar}
          >
            Publicar
          </button>
        </>
      )}

      {publicacion !== null && (
        <PantallaPublicacion
          estado={publicacion}
          ahora={ahora}
          onConfirmar={() => void alConfirmarPublicar()}
          onCancelar={alCancelarPublicacion}
          onReintentarPublicar={() => void alConfirmarPublicar()}
          onReintentarSondeo={alReintentarSondeo}
          onDeshacer={() => void alConfirmarDeshacer()}
          onSeguirEditando={alCancelarPublicacion}
          onVolverTrasDeshacer={recargaElPanel}
          onVolverAAbrirElPanel={recargaElPanel}
        />
      )}
    </div>
  )
}

/*
 * ---------------------------------------------------------------------
 * La bandeja de revisión y el resultado de publicar
 * ---------------------------------------------------------------------
 */

export function ListaAvisos({ avisos }: { avisos: AvisoPublicado[] }) {
  if (avisos.length === 0) return null
  return (
    <div className="panel-avisos">
      <p className="panel-avisos-titulo">Para revisar cuando puedas (esto no bloquea nada):</p>
      <ul className="panel-avisos-lista">
        {avisos.map((a) => (
          <li key={a.campo}>
            <strong>{a.titulo}</strong>
            {a.detalle !== undefined && <span> {a.detalle}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BotonesDeSalida({
  datos, ahora, onDeshacer, onSeguirEditando,
}: {
  datos: DatosSondeo
  ahora: number
  onDeshacer: () => void
  onSeguirEditando: () => void
}) {
  return (
    <>
      {/*
       * [H2, ronda de arreglo] `target="_blank"` a propósito: `/panel/*`
       * va con `Cache-Control: no-store` (`vercel.json`), y esa cabecera
       * es una de las causas documentadas por las que Chrome/Firefox
       * dejan una página fuera del bfcache — así que sin esto, la acción
       * MÁS natural después de publicar («voy a ver cómo quedó») era
       * justo la que remontaba el panel entero al volver con «atrás» y
       * le sacaba el botón «Deshacer», con 29 de los 30 minutos todavía
       * disponibles. Abrir en pestaña nueva deja ESTA pantalla intacta.
       * `rel="noopener noreferrer"`: la pestaña nueva no puede tocar
       * `window.opener` de esta (seguridad estándar para un enlace que
       * abre algo del mismo sitio en una pestaña aparte).
       */}
      <a className="panel-boton" href={hrefVerSitio(ahora)} target="_blank" rel="noopener noreferrer">
        Ver mi sitio
      </a>
      {puedeDeshacer(datos.publicadoEn, ahora) && (
        <button type="button" className="panel-boton-deshacer" onClick={onDeshacer}>
          Deshacer esta publicación
        </button>
      )}
      <button type="button" className="panel-enlace-discreto" onClick={onSeguirEditando}>
        Seguir editando
      </button>
    </>
  )
}

/**
 * [H2/H8, ronda de arreglo] Exportada a propósito: es puramente
 * presentacional (`estado` entra por prop, nada de `useEffect` ni de
 * `fetch` acá adentro), así que se puede montar de verdad con
 * `renderToStaticMarkup` y afirmar sobre el HTML real —mismo patrón que
 * la Tarea 5 usa para `Historial`/`PantallaEditando`
 * (`test/panel-historial.test.ts`)— sin necesitar jsdom ni esperar a que
 * `Sesion.tsx` termine de leer un borrador para llegar hasta acá.
 */
export function PantallaPublicacion({
  estado, ahora, onConfirmar, onCancelar, onReintentarPublicar, onReintentarSondeo, onDeshacer, onSeguirEditando,
  onVolverTrasDeshacer, onVolverAAbrirElPanel,
}: {
  estado: EstadoPublicacion
  ahora: number
  onConfirmar: () => void
  onCancelar: () => void
  onReintentarPublicar: () => void
  onReintentarSondeo: () => void
  onDeshacer: () => void
  onSeguirEditando: () => void
  onVolverTrasDeshacer: () => void
  onVolverAAbrirElPanel: () => void
}) {
  if (estado.fase === 'revisando') {
    return (
      <div className="panel-revision">
        <h2 className="panel-titulo">Revisa lo que vas a publicar</h2>
        <p className="panel-aviso">{estado.fraseCorta}</p>
        <ul className="panel-revision-lista">
          {estado.cambios.map((c, i) => (
            <li key={`${c.campo}-${i}`}>{etiquetaDeCambio(c)}</li>
          ))}
        </ul>
        <button type="button" className="panel-boton" onClick={onConfirmar}>
          Confirmar y publicar
        </button>
        <button type="button" className="panel-enlace-discreto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    )
  }

  if (estado.fase === 'publicando') {
    return (
      <p className="panel-aviso" role="status">
        {FRASE_PUBLICANDO}
      </p>
    )
  }

  if (estado.fase === 'error-publicar') {
    return (
      <div className="panel-conflicto">
        <p className="panel-error" role="alert">
          {estado.problema}
        </p>
        <button type="button" className="panel-boton" onClick={onReintentarPublicar}>
          Reintentar
        </button>
        {/*
         * [Última ronda] «Reintentar» sigue sirviendo para un error de
         * verdad transitorio (una mala conexión, un 502) — pero un 409 de
         * pisada es DETERMINISTA (ver el docstring de `recargaElPanel`,
         * más arriba en `Sesion.tsx`): con el MISMO `base` que ya chocó,
         * reintentar nunca va a poder tener éxito. Sin este botón, la
         * única salida de verdad («volver a abrir el panel») no estaba
         * escrita en ningún lado de esta pantalla.
         */}
        <button type="button" className="panel-boton" onClick={onVolverAAbrirElPanel}>
          Volver a abrir el panel
        </button>
        {/*
         * El texto va DEBAJO de su botón, no arriba: arriba quedaba pegado
         * a «Reintentar» y «Esto trae lo más reciente del sitio» se leía
         * como si describiera a ese otro botón.
         */}
        <p className="panel-aviso">
          Esto trae lo más reciente del sitio, así tu cambio sí se puede publicar. No perdiste nada: lo que escribiste sigue guardado.
        </p>
        <button type="button" className="panel-enlace-discreto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    )
  }

  if (estado.fase === 'sin-cambios') {
    return (
      <div className="panel-resultado">
        <p className="panel-aviso" role="status">
          {estado.frase}
        </p>
        <button type="button" className="panel-enlace-discreto" onClick={onCancelar}>
          Volver a editar
        </button>
      </div>
    )
  }

  if (estado.fase === 'sondeando' || estado.fase === 'terminado') {
    return (
      <div className="panel-resultado">
        <p className="panel-aviso" role="status">
          {estado.frase}
        </p>
        <ListaAvisos avisos={estado.datos.avisos} />
        <BotonesDeSalida datos={estado.datos} ahora={ahora} onDeshacer={onDeshacer} onSeguirEditando={onSeguirEditando} />
      </div>
    )
  }

  if (estado.fase === 'error-sondeo') {
    return (
      <div className="panel-resultado">
        <p className="panel-error" role="alert">
          {estado.problema}
        </p>
        <button type="button" className="panel-boton" onClick={onReintentarSondeo}>
          Reintentar
        </button>
        <ListaAvisos avisos={estado.datos.avisos} />
        <BotonesDeSalida datos={estado.datos} ahora={ahora} onDeshacer={onDeshacer} onSeguirEditando={onSeguirEditando} />
      </div>
    )
  }

  if (estado.fase === 'deshaciendo') {
    return (
      <p className="panel-aviso" role="status">
        Deshaciendo…
      </p>
    )
  }

  if (estado.fase === 'error-deshacer') {
    return (
      <div className="panel-resultado">
        <p className="panel-error" role="alert">
          {estado.problema}
        </p>
        <button type="button" className="panel-boton" onClick={onDeshacer}>
          Reintentar
        </button>
        <BotonesDeSalida datos={estado.datos} ahora={ahora} onDeshacer={onDeshacer} onSeguirEditando={onSeguirEditando} />
      </div>
    )
  }

  // estado.fase === 'deshecho'
  return (
    <div className="panel-resultado">
      <p className="panel-aviso" role="status">
        {estado.resumen}
      </p>
      <button type="button" className="panel-boton" onClick={onVolverTrasDeshacer}>
        Volver a editar
      </button>
    </div>
  )
}
