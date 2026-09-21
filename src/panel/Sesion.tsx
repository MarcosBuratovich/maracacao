/*
 * La pantalla que comparten las Tareas 3 y 4 (fase 6): el borrador y
 * publicar/saber/deshacer. Envuelve a `Editor` (Tarea 2) — nunca reescribe
 * el formulario, solo lo controla desde afuera (`documentos`/`onCambia`,
 * ver `Editor.tsx`) para poder autoguardar cada cambio y armar la bandeja
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
import Editor from './Editor'
import { contenidoPublicado, type Documentos } from './campos'
import { idDeAparato } from './aparato'
import {
  borradorLeer, borradorGuardar, publicar as publicarApi, estado as estadoApi, deshacer as deshacerApi,
  historial as historialApi,
  type AvisoPublicado, type ResultadoBorradorLeer,
} from './api'
import {
  trasLeerBorrador, resuelveConflicto, resumenBorradorAjeno, resumenOtroBorrador,
  Autoguardado, type EstadoBorrador, type EleccionConflicto, type ResultadoGuardadoTraducido,
} from './borrador'
import {
  preparaRevision, trasPublicar, trasEstado, trasDeshacer, sondea, puedeDeshacer, hrefVerSitio,
  siguienteBase, etiquetaDeCambio, FRASE_PUBLICANDO,
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
    if (publicacion === null || publicacion.fase !== 'revisando' || baseActual === null) return
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

  async function alVolverAEditarTrasDeshacer() {
    setPublicacion(null)
    const fresco = contenidoPublicado()
    setDocumentos(fresco)
    setOriginales(fresco)
    const r = await historialApi()
    if (r.ok) setBaseActual(r.base)
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

          <Editor documentos={documentos} onCambia={alCambiarDocumentos} />

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
          onVolverTrasDeshacer={() => void alVolverAEditarTrasDeshacer()}
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

function ListaAvisos({ avisos }: { avisos: AvisoPublicado[] }) {
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

function BotonesDeSalida({
  datos, ahora, onDeshacer, onSeguirEditando,
}: {
  datos: DatosSondeo
  ahora: number
  onDeshacer: () => void
  onSeguirEditando: () => void
}) {
  return (
    <>
      <a className="panel-boton" href={hrefVerSitio(ahora)}>
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

function PantallaPublicacion({
  estado, ahora, onConfirmar, onCancelar, onReintentarPublicar, onReintentarSondeo, onDeshacer, onSeguirEditando,
  onVolverTrasDeshacer,
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
