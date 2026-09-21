/*
 * La pantalla que va a compartir el borrador (Tarea 3) y publicar/saber/
 * deshacer (Tarea 4, fase 6, en el próximo commit). Envuelve a `Editor`
 * (Tarea 2) — nunca reescribe el formulario, solo lo controla desde afuera
 * (`documentos`/`onCambia`, ver `Editor.tsx`) para poder autoguardar cada
 * cambio.
 *
 * Toda la lógica de estado vive en funciones/clases puras e inyectables en
 * `./borrador` — mismo criterio que `App.tsx` aplica a
 * `cargaInicial`/`intentaEntrar`: este componente es la plomería mínima que
 * las conecta a un formulario, así que se prueban DIRECTO, sin montar
 * nada. Ninguna llamada de red puede dejar una pantalla sin salida (regla
 * de la tarea): toda fase de error de acá abajo tiene, al lado, un botón
 * que hace algo.
 */
import { useEffect, useRef, useState } from 'react'
import Editor from './Editor'
import { contenidoPublicado, type Documentos } from './campos'
import { idDeAparato } from './aparato'
import { borradorLeer, borradorGuardar, type ResultadoBorradorLeer } from './api'
import {
  trasLeerBorrador, resuelveConflicto, resumenBorradorAjeno, resumenOtroBorrador,
  Autoguardado, type EstadoBorrador, type EleccionConflicto, type ResultadoGuardadoTraducido,
} from './borrador'

/*
 * ---------------------------------------------------------------------
 * El estado del guardado automático — capa visual sobre `ResultadoGuardadoTraducido`
 * ---------------------------------------------------------------------
 */

type EstadoAvisoGuardado = { tipo: 'ocioso' } | { tipo: 'pendiente' } | ResultadoGuardadoTraducido

/** Cuando no hay `base` (nunca en producción; solo si `historial` no pudo leer nada), no hay contra qué guardar. */
const PROBLEMA_SIN_BASE_LOCAL = 'No pudimos preparar la publicación: recarga el panel.'

export default function Sesion({ base }: { base: string | null }) {
  const [dispositivo] = useState(() => idDeAparato())
  const [documentos, setDocumentos] = useState<Documentos>(() => contenidoPublicado())
  const [originales] = useState<Documentos>(() => contenidoPublicado())
  const [baseActual] = useState<string | null>(base)
  const [estadoBorrador, setEstadoBorrador] = useState<EstadoBorrador>({ fase: 'leyendo' })
  const [avisoGuardado, setAvisoGuardado] = useState<EstadoAvisoGuardado>({ tipo: 'ocioso' })
  const [ahora] = useState(() => Date.now())

  const baseRef = useRef(baseActual)

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

  useEffect(() => {
    return () => {
      autoguardadoRef.current?.destruye()
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
    </div>
  )
}
