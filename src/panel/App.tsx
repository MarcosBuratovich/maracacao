/*
 * La isla del panel (Tarea 1, fase 6): decide entre «pedir la contraseña»
 * y «editar», y nada más — el editor de verdad (198 campos) es la Tarea 2.
 *
 * `client:only="react"` (`src/pages/panel/index.astro`): este componente
 * NUNCA se renderiza en el servidor. Arranca siempre en `cargando` y
 * recién en el navegador llama a `historial()` para decidir: un 401 es
 * «pedí la contraseña» (spec, Tarea 1); cualquier otro fracaso es un error
 * franco, con la frase del servidor tal cual — nunca se asume que hay
 * sesión solo porque no vino un 401.
 *
 * Toda la lógica de decisión vive en funciones puras/inyectables
 * (`cargaInicial`, `intentaEntrar`, `pideEnlace`), exportadas y probadas
 * sin necesitar un DOM real — el componente en sí es la plomería mínima
 * que las conecta a un formulario.
 */
import { useEffect, useState } from 'react'
import {
  entrar, enlace, historial,
  type ResultadoEntrar, type ResultadoEnlace, type ResultadoHistorial, type Publicada,
} from './api'
import { idDeAparato } from './aparato'

/*
 * ---------------------------------------------------------------------
 * El estado inicial: pura, inyectable, probada sin React.
 * ---------------------------------------------------------------------
 */

export type EstadoInicial =
  | { modo: 'editar'; base: string | null; publicaciones: Publicada[] }
  | { modo: 'entrar' }
  | { modo: 'error'; problema: string }

/**
 * Decide entre «pedir la contraseña» y «editar» — la única regla de esta
 * tarea: un 401 de `historial` es «no hay sesión», y solo eso. Cualquier
 * otro fracaso (red caída, 502, 503) es un tercer estado, `error`, con la
 * frase que escribió el servidor: no hay que confundir «no tiene sesión»
 * con «no pudimos preguntar».
 *
 * El `base` que devuelve `historial` —la cabeza de `main` de HOY— viaja en
 * el estado `editar`: es la fuente oficial que la Tarea 4 va a necesitar
 * para publicar.
 */
export async function cargaInicial(
  pedirHistorial: () => Promise<ResultadoHistorial> = historial,
): Promise<EstadoInicial> {
  const r = await pedirHistorial()
  if (r.ok) return { modo: 'editar', base: r.base, publicaciones: r.publicaciones }
  if (r.status === 401) return { modo: 'entrar' }
  return { modo: 'error', problema: r.problema }
}

/**
 * Intenta entrar con correo y contraseña. El correo se recorta antes de
 * mandarlo (el servidor también lo hace — defensa en profundidad, no
 * redundancia inútil: un espacio de más tipeado en un celular no puede ser
 * la diferencia entre entrar y un 401 confuso). El `dispositivo` es
 * inyectable para que el test pueda fijarlo; en el navegador de verdad sale
 * de `idDeAparato()`.
 */
export async function intentaEntrar(
  args: { correo: string; clave: string; recuerdame: boolean },
  deps: { entrarFn?: (cuerpo: Parameters<typeof entrar>[0]) => Promise<ResultadoEntrar>; dispositivo?: string } = {},
): Promise<ResultadoEntrar> {
  const { entrarFn = entrar, dispositivo = idDeAparato() } = deps
  return entrarFn({ correo: args.correo.trim(), clave: args.clave, recuerdame: args.recuerdame, dispositivo })
}

/** Pide el enlace mágico de recuperación. Misma razón para recortar el correo que `intentaEntrar`. */
export async function pideEnlace(
  correo: string,
  enlaceFn: (cuerpo: { correo: string }) => Promise<ResultadoEnlace> = enlace,
): Promise<ResultadoEnlace> {
  return enlaceFn({ correo: correo.trim() })
}

/*
 * ---------------------------------------------------------------------
 * El componente
 * ---------------------------------------------------------------------
 */

type EstadoApp = { modo: 'cargando' } | EstadoInicial

export default function App() {
  const [estado, setEstado] = useState<EstadoApp>({ modo: 'cargando' })

  useEffect(() => {
    let vivo = true
    void cargaInicial().then((r) => {
      if (vivo) setEstado(r)
    })
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="panel-shell">
      {estado.modo === 'cargando' && (
        <p className="panel-aviso" role="status">
          Cargando…
        </p>
      )}
      {estado.modo === 'error' && (
        <PantallaError
          problema={estado.problema}
          onReintentar={() => {
            setEstado({ modo: 'cargando' })
            void cargaInicial().then(setEstado)
          }}
        />
      )}
      {estado.modo === 'entrar' && <PantallaEntrar onEntro={setEstado} />}
      {estado.modo === 'editar' && <PantallaEditando publicaciones={estado.publicaciones} />}
    </div>
  )
}

function PantallaError({ problema, onReintentar }: { problema: string; onReintentar: () => void }) {
  return (
    <>
      <p className="panel-error" role="alert">
        {problema}
      </p>
      <button type="button" className="panel-boton" onClick={onReintentar}>
        Reintentar
      </button>
    </>
  )
}

function PantallaEntrar({ onEntro }: { onEntro: (estado: EstadoInicial) => void }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [recuerdame, setRecuerdame] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const [avisoEnlace, setAvisoEnlace] = useState<string | null>(null)
  const [pidiendoEnlace, setPidiendoEnlace] = useState(false)

  async function alEnviar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setProblema(null)
    const r = await intentaEntrar({ correo, clave, recuerdame })
    if (!r.ok) {
      setEnviando(false)
      setProblema(r.problema)
      return
    }
    // Entró: la sesión ya está en la cookie. Se vuelve a pedir `historial`
    // para conseguir el `base` de verdad, en vez de asumir un estado —
    // misma llamada que arranca el panel, ahora con sesión.
    const siguiente = await cargaInicial()
    setEnviando(false)
    onEntro(siguiente)
  }

  async function alPedirEnlace() {
    setPidiendoEnlace(true)
    setProblema(null)
    const r = await pideEnlace(correo)
    setPidiendoEnlace(false)
    setAvisoEnlace(r.ok ? r.mensaje : r.problema)
  }

  return (
    <>
      <h1 className="panel-titulo">Entrar al panel</h1>
      <form className="panel-formulario" onSubmit={(e) => void alEnviar(e)}>
        <label className="panel-campo">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <label className="panel-campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>
        <label className="panel-recordar">
          <input type="checkbox" checked={recuerdame} onChange={(e) => setRecuerdame(e.target.checked)} />
          <span>Recordar este aparato</span>
        </label>
        {problema !== null && (
          <p className="panel-error" role="alert">
            {problema}
          </p>
        )}
        <button type="submit" className="panel-boton" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <button
        type="button"
        className="panel-enlace-discreto"
        onClick={() => void alPedirEnlace()}
        disabled={pidiendoEnlace}
      >
        No me acuerdo de mi contraseña
      </button>
      {avisoEnlace !== null && (
        <p className="panel-aviso" role="status">
          {avisoEnlace}
        </p>
      )}
    </>
  )
}

/**
 * El texto sobre cuántas publicaciones tiene, para la pantalla de editar.
 * Extraída de la plantilla a propósito [Ronda de arreglo, hallazgo 2]: el
 * guardián de jerga (`test/panel-app.test.ts`) miraba los LITERALES del
 * código fuente, y esta era la única frase que no aparece completa en
 * ninguna parte del archivo — se arma con una interpolación (`Tienes ${n}
 * publicación(es)…`). Como función pura, el test la llama con `n` real y
 * corre `jergaEn()` sobre el resultado ARMADO, no sobre un pedazo de
 * plantilla.
 */
export function textoPublicaciones(n: number): string {
  if (n === 0) return 'Todavía no hay ninguna publicación tuya.'
  return `Tienes ${n} ${n === 1 ? 'publicación' : 'publicaciones'} en tu historial.`
}

function PantallaEditando({ publicaciones }: { publicaciones: Publicada[] }) {
  return (
    <>
      <h1 className="panel-titulo">Tu panel</h1>
      <p>Ya entraste. Aquí vas a poder editar el contenido de tu sitio.</p>
      <p className="panel-aviso">{textoPublicaciones(publicaciones.length)}</p>
    </>
  )
}
