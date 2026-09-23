// @vitest-environment jsdom
/*
 * Los manejadores de `Sesion.tsx` — los doce que la fase 6 dejó sin
 * cobertura de comportamiento. Su test viejo (`panel-sesion.test.ts`) hacía
 * `readFileSync` + `toContain` sobre el propio archivo fuente: afirmaba que
 * un texto estaba escrito, no que la pantalla hiciera algo. Por ahí
 * entraron cinco defectos obligatorios, dos de ellos borrándole trabajo a
 * la clienta sin avisarle — los cinco quedan marcados acá abajo, con el
 * hallazgo (H1-H5) que cada uno corrigió.
 *
 * Este archivo es el primero de la fase 7 que usa un DOM de verdad
 * (`jsdom`, declarado con el comentario de la primera línea — el config
 * sigue en `environment: 'node'` para el resto de la suite): monta
 * `Sesion` entera y hace click/tipeo de verdad, en vez de armar el HTML a
 * mano. `src/panel/api.ts` se mockea en el borde de red — nunca `fetch`
 * suelto — para que cada test controle exactamente qué contesta el
 * servidor, sin depender de una red de verdad ni de temporizadores reales
 * salvo donde `vi.useFakeTimers()` los reemplaza a propósito.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import Sesion from '@/panel/Sesion'
import type { ResultadoBorradorLeer, ResultadoPublicar, ResultadoEstado, ResultadoDeshacer } from '@/panel/api'
import { PISO_GUARDADO_MS, RETARDO_GUARDADO_MS } from '@/panel/borrador'

vi.mock('@/panel/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/panel/api')>()
  return {
    ...real,
    borradorLeer: vi.fn(),
    borradorGuardar: vi.fn(),
    publicar: vi.fn(),
    estado: vi.fn(),
    deshacer: vi.fn(),
  }
})

import { borradorLeer, borradorGuardar, publicar, estado, deshacer } from '@/panel/api'

const BASE = 'a'.repeat(40)

/*
 * Sin borrador ajeno de por medio en ningún test de este archivo (esa
 * pantalla la cubre `trasLeerBorrador`, en `panel-borrador.test.ts`,
 * probada directo): el valor por omisión es «no había nada guardado», así
 * cada test entra derecho a la pantalla que le importa. `borradorGuardar`
 * también con un valor por omisión de éxito, para que anotar un cambio en
 * un test que no le interesa el guardado en sí no deje una promesa
 * colgada.
 */
beforeEach(() => {
  vi.mocked(borradorLeer).mockResolvedValue({ ok: true, borrador: null } satisfies ResultadoBorradorLeer)
  vi.mocked(borradorGuardar).mockResolvedValue({ ok: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Sesion — el DOM de verdad', () => {
  it('arranca buscando el borrador, no mostrando el editor', () => {
    render(createElement(Sesion, { base: BASE }))
    expect(screen.getByText(/Buscando si tienes cambios guardados/)).toBeTruthy()
    expect(screen.queryByText('Publicar')).toBeNull()
  })
})

/*
 * ---------------------------------------------------------------------
 * Punto de partida compartido: abre el editor (borrador vacío) y le hace
 * UN cambio de verdad — lo que hace falta para que «Publicar» deje de
 * estar deshabilitado (`revisionActual.cambios.length > 0`). Cada test de
 * acá abajo arranca desde acá y sigue por su propio camino.
 * ---------------------------------------------------------------------
 */
async function abreEditorYCambiaAlgo(): Promise<HTMLElement> {
  render(createElement(Sesion, { base: BASE }))
  const botonPublicar = await screen.findByRole('button', { name: 'Publicar' })
  expect((botonPublicar as HTMLButtonElement).disabled).toBe(true)
  const [primerCampo] = screen.getAllByRole('textbox')
  fireEvent.change(primerCampo, { target: { value: `${(primerCampo as HTMLInputElement).value} (editado)` } })
  await waitFor(() => expect((botonPublicar as HTMLButtonElement).disabled).toBe(false))
  return botonPublicar
}

const AVISOS_VACIOS = [] as const

describe('Publicar → «Reintentar» en error-publicar (H1)', () => {
  it('vuelve a intentar de verdad — antes de la ronda de arreglo, «Reintentar» llamaba a la MISMA función que «Confirmar y publicar» y esa guarda solo dejaba pasar la fase «revisando», así que el botón no hacía nada', async () => {
    const botonPublicar = await abreEditorYCambiaAlgo()
    fireEvent.click(botonPublicar)
    await screen.findByRole('button', { name: 'Confirmar y publicar' })

    vi.mocked(publicar).mockResolvedValueOnce({
      ok: false,
      status: 409,
      problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
    } satisfies ResultadoPublicar)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y publicar' }))

    await screen.findByText('Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.')
    const botonReintentar = screen.getByRole('button', { name: 'Reintentar' })

    vi.mocked(publicar).mockResolvedValueOnce({
      ok: true,
      sha: 'b'.repeat(40),
      resumen: 'cambia 1 texto',
      avisos: [...AVISOS_VACIOS],
    } satisfies ResultadoPublicar)
    vi.mocked(estado).mockResolvedValueOnce({
      ok: true,
      estado: 'listo',
      frase: 'Ya está en el sitio.',
      reintentarEn: null,
      url: null,
    } satisfies ResultadoEstado)
    fireEvent.click(botonReintentar)

    // Si «Reintentar» siguiera muerto, esto nunca aparece: `publicar()` no
    // se habría vuelto a llamar y la pantalla se quedaría en el mismo error.
    await screen.findByText('Ya está en el sitio.')
    expect(publicar).toHaveBeenCalledTimes(2)
  })
})

describe('«Ver mi sitio» — enlace real en pestaña nueva (H2)', () => {
  it('llega con `target="_blank"` y `rel="noopener noreferrer"` ya adentro del árbol real de Sesion — antes navegaba en la MISMA pestaña y se llevaba puesto el botón «Deshacer» al volver, porque `/panel/*` sirve `Cache-Control: no-store` y eso saca la página del bfcache', async () => {
    const botonPublicar = await abreEditorYCambiaAlgo()
    fireEvent.click(botonPublicar)
    await screen.findByRole('button', { name: 'Confirmar y publicar' })

    vi.mocked(publicar).mockResolvedValueOnce({
      ok: true,
      sha: 'c'.repeat(40),
      resumen: 'cambia 1 texto',
      avisos: [...AVISOS_VACIOS],
    } satisfies ResultadoPublicar)
    vi.mocked(estado).mockResolvedValueOnce({
      ok: true,
      estado: 'listo',
      frase: 'Ya está en el sitio.',
      reintentarEn: null,
      url: null,
    } satisfies ResultadoEstado)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y publicar' }))

    const enlace = (await screen.findByRole('link', { name: 'Ver mi sitio' })) as HTMLAnchorElement
    expect(enlace.target).toBe('_blank')
    expect(enlace.rel).toBe('noopener noreferrer')
    expect(enlace.getAttribute('href')).toMatch(/^\/\?t=\d+$/)
  })
})

describe('El autoguardado — el piso sobrevive a tipeo continuo (H3, cableado real)', () => {
  it('guarda a los 30 s aunque cada tecla reinicie el retardo de 10 s — la lógica pura ya se prueba en panel-borrador.test.ts; acá se prueba que Sesion.tsx la conecta de verdad a un campo real', async () => {
    // Los timers falsos tienen que estar activos DESDE ANTES del primer
    // render: `Autoguardado` (el `useRef` de `Sesion.tsx`) se construye una
    // sola vez, en el primer render, y guarda ahí mismo la referencia a
    // `setTimeout` que tenga en ese momento — armarlos después del render
    // deja a esa instancia agarrada al `setTimeout` REAL de siempre, y
    // `advanceTimersByTimeAsync` de acá abajo nunca lo toca.
    vi.useFakeTimers()
    try {
      render(createElement(Sesion, { base: BASE }))
      // `act()` async drena la cola del scheduler de React A MANO (no por
      // el `MessageChannel`/`setTimeout` reales de los que depende en
      // producción) — con timers falsos activos, es la única forma
      // confiable de dejar que la promesa ya resuelta de `borradorLeer()`
      // termine de propagarse a la pantalla antes de seguir.
      await act(async () => {})
      const botonPublicar = screen.getByRole('button', { name: 'Publicar' })
      const [primerCampo] = screen.getAllByRole('textbox')

      // Un paso bajo el retardo, para que cada cambio lo reinicie sin
      // dejarlo disparar solo. Cuatro pasos suman más que el piso: si el
      // piso no sobreviviera al reinicio del retardo, acá nunca se
      // guardaría nada — el bug exacto que describe H3 en `borrador.ts`.
      const PASO_MS = RETARDO_GUARDADO_MS - 2_000
      const PASOS = Math.ceil((PISO_GUARDADO_MS + 2_000) / PASO_MS)
      for (let i = 0; i < PASOS; i++) {
        fireEvent.change(primerCampo, { target: { value: `escribiendo sin pausas ${i}` } })
        await vi.advanceTimersByTimeAsync(PASO_MS)
      }
      // El guardado que disparó el piso resuelve su promesa (mockeada) y
      // recién AHÍ actualiza la pantalla — ese último tramo, igual que la
      // lectura inicial de más arriba, necesita su propio drenado a mano.
      await act(async () => {})

      expect((botonPublicar as HTMLButtonElement).disabled).toBe(false)
      expect(borradorGuardar).toHaveBeenCalled()
      expect(screen.getByText('Tu borrador está guardado.')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('El guardado de emergencia al cerrar la pestaña (H4)', () => {
  it('con algo sin guardar todavía, `pagehide` manda un beacon con el borrador pendiente — antes `destruye()` lo descartaba en silencio y hasta 30 s de trabajo (el piso) se perdían sin avisar', async () => {
    const sendBeacon = vi.fn((_url: string, _datos?: Blob) => true)
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true })

    // El `Blob` de jsdom no trae `.text()`/`.arrayBuffer()` (se probó a
    // mano: ninguno de los dos existe en este entorno) — así que en vez de
    // leer el contenido DESDE el Blob que arma `Sesion.tsx`, se intercepta
    // el constructor y se guarda la parte de texto tal cual se la pasaron.
    const partes: unknown[] = []
    const BlobReal = globalThis.Blob
    class BlobEspia extends BlobReal {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        partes.push(blobParts?.[0])
      }
    }
    vi.stubGlobal('Blob', BlobEspia)

    render(createElement(Sesion, { base: BASE }))
    await screen.findByRole('button', { name: 'Publicar' })
    const [primerCampo] = screen.getAllByRole('textbox')
    fireEvent.change(primerCampo, { target: { value: 'algo que todavía no se guardó' } })

    // Ni el retardo (10 s) ni el piso (30 s) llegaron a disparar: el cierre
    // agarra el trabajo A MEDIO CAMINO — el caso exacto que perdía trabajo.
    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url] = sendBeacon.mock.calls[0]
    expect(url).toBe('/api/panel?accion=borrador.guardar')
    const datos = JSON.parse(partes[0] as string) as { documentos: unknown; base: string }
    expect(datos.base).toBe(BASE)
  })

  it('sin nada pendiente, `pagehide` no manda ningún beacon — no hay nada que avisar', async () => {
    const sendBeacon = vi.fn(() => true)
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true })

    render(createElement(Sesion, { base: BASE }))
    await screen.findByRole('button', { name: 'Publicar' })
    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).not.toHaveBeenCalled()
  })
})

describe('«Volver a editar» tras deshacer — recarga el panel de verdad (H5)', () => {
  it('llama a `location.reload()` en vez de reconstruir el estado en memoria — dos publicaciones seguidas y un deshacer en la misma sesión ya dejaron una bandeja de revisión mintiendo sobre «1 cambio»', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
      writable: true,
    })

    const botonPublicar = await abreEditorYCambiaAlgo()
    fireEvent.click(botonPublicar)
    await screen.findByRole('button', { name: 'Confirmar y publicar' })

    vi.mocked(publicar).mockResolvedValueOnce({
      ok: true,
      sha: 'd'.repeat(40),
      resumen: 'cambia 1 texto',
      avisos: [...AVISOS_VACIOS],
    } satisfies ResultadoPublicar)
    vi.mocked(estado).mockResolvedValueOnce({
      ok: true,
      estado: 'listo',
      frase: 'Ya está en el sitio.',
      reintentarEn: null,
      url: null,
    } satisfies ResultadoEstado)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y publicar' }))

    const botonDeshacer = await screen.findByRole('button', { name: 'Deshacer esta publicación' })
    vi.mocked(deshacer).mockResolvedValueOnce({
      ok: true,
      sha: 'e'.repeat(40),
      resumen: 'Listo, lo dejé como estaba antes.',
    } satisfies ResultadoDeshacer)
    fireEvent.click(botonDeshacer)

    const botonVolver = await screen.findByRole('button', { name: 'Volver a editar' })
    expect(reload).not.toHaveBeenCalled()
    fireEvent.click(botonVolver)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
