/*
 * `src/panel/publicacion.ts` (Tarea 4, fase 6): la bandeja de revisión, el
 * sondeo que obedece `reintentarEn`, y el botón «Deshacer» durante 30
 * minutos.
 *
 * El punto central del sondeo: `sondea()` NUNCA inventa una cadencia
 * propia. Se prueba con `vi.useFakeTimers()` y un `espera` real
 * (`setTimeout`) para verificar, al milisegundo, que espera EXACTAMENTE lo
 * que pidió el servidor — mismo criterio que ya usa `test/panel-api.test.ts`
 * para el timeout de `llama()`.
 */
import { describe, it, expect, vi } from 'vitest'
import { jergaEn } from '@/servidor/estado'
import { contenidoPublicado, type Documentos } from '@/panel/campos'
import type { ResultadoPublicar, ResultadoEstado, ResultadoDeshacer } from '@/panel/api'
import {
  preparaRevision, etiquetaDeCambio, trasPublicar, trasEstado, trasDeshacer, siguienteBase,
  puedeDeshacer, hrefVerSitio, sondea, puedeConfirmarPublicar, VENTANA_DESHACER_MS, FRASE_PUBLICANDO,
  type EstadoPublicacion, type DatosSondeo,
} from '@/panel/publicacion'

const clon = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/*
 * ---------------------------------------------------------------------
 * La bandeja de revisión
 * ---------------------------------------------------------------------
 */

describe('preparaRevision', () => {
  it('junta cambios de los documentos, y arma la frase con `frase()`', () => {
    const originales = contenidoPublicado()
    const documentos = { ...originales, sitio: clon(originales.sitio) } as Documentos
    ;(documentos.sitio as { anaquel: { titulo: string } }).anaquel.titulo = 'Nuevo título'
    const r = preparaRevision(documentos, originales)
    expect(r.cambios).toHaveLength(1)
    expect(r.cambios[0].campo).toBe('anaquel.titulo')
    expect(r.fraseCorta).toMatch(/cambia/i)
    expect(jergaEn(r.fraseCorta), r.fraseCorta).toBeNull()
  })

  it('sin cambios: lista vacía y frase vacía', () => {
    const originales = contenidoPublicado()
    const documentos = { ...originales, sitio: clon(originales.sitio) } as Documentos
    const r = preparaRevision(documentos, originales)
    expect(r.cambios).toEqual([])
    expect(r.fraseCorta).toBe('')
  })

  it('varios documentos a la vez: los cambios de los dos aparecen', () => {
    const originales = contenidoPublicado()
    const documentos = {
      ...originales,
      sitio: clon(originales.sitio),
      sabores: clon(originales.sabores),
    } as Documentos
    ;(documentos.sitio as { anaquel: { titulo: string } }).anaquel.titulo = 'Otro'
    const conSabor = documentos.sabores as { sabores: Array<{ nombre: string }> }
    conSabor.sabores[0].nombre = conSabor.sabores[0].nombre + ' (editado)'
    const r = preparaRevision(documentos, originales)
    expect(r.cambios.length).toBeGreaterThanOrEqual(2)
  })
})

describe('etiquetaDeCambio', () => {
  it('cambio: solo la etiqueta', () => {
    expect(etiquetaDeCambio({ campo: 'x', etiqueta: 'Título', antes: 'a', despues: 'b', tipo: 'cambio' })).toBe('Título')
  })

  it('alta: "(agregado)"', () => {
    expect(etiquetaDeCambio({ campo: 'x', etiqueta: 'Preguntas', antes: 3, despues: 4, tipo: 'alta' })).toBe('Preguntas (agregado)')
  })

  it('baja: "(quitado)"', () => {
    expect(etiquetaDeCambio({ campo: 'x', etiqueta: 'Preguntas', antes: 4, despues: 3, tipo: 'baja' })).toBe('Preguntas (quitado)')
  })

  it('sin jerga, para ningún tipo', () => {
    for (const tipo of ['cambio', 'alta', 'baja'] as const) {
      const texto = etiquetaDeCambio({ campo: 'x', etiqueta: 'Un campo cualquiera', antes: 1, despues: 2, tipo })
      expect(jergaEn(texto), texto).toBeNull()
    }
  })
})

/*
 * ---------------------------------------------------------------------
 * Las transiciones: publicar, sondear, deshacer
 * ---------------------------------------------------------------------
 */

describe('FRASE_PUBLICANDO', () => {
  it('sin jerga', () => {
    expect(jergaEn(FRASE_PUBLICANDO)).toBeNull()
  })
})

/*
 * [H1, ronda de arreglo] `Sesion.tsx:422` llamaba a `alConfirmarPublicar()`
 * desde el botón «Reintentar» de la pantalla de error, pero esa función
 * exigía `fase === 'revisando'` — en `'error-publicar'` salía por el
 * primer `if` sin hacer nada, un botón muerto justo en el 409, el error
 * más probable. Cada caso de acá abajo, roto a mano uno por uno (sacar
 * `'error-publicar'` del `||`, no aceptar `null`), tumba un test propio.
 */
describe('puedeConfirmarPublicar', () => {
  const cambios: EstadoPublicacion = { fase: 'revisando', cambios: [], fraseCorta: 'cambia 1 texto' }
  const errorPublicar: EstadoPublicacion = { fase: 'error-publicar', problema: 'x', cambios: [], fraseCorta: 'y' }
  const publicando: EstadoPublicacion = { fase: 'publicando', cambios: [], fraseCorta: 'y' }
  const sinCambios: EstadoPublicacion = { fase: 'sin-cambios', frase: 'x' }

  it('"revisando": sí — el botón «Confirmar y publicar»', () => {
    expect(puedeConfirmarPublicar(cambios)).toBe(true)
  })

  it('"error-publicar": sí — el botón «Reintentar» (el hallazgo H1: antes esto daba `false`)', () => {
    expect(puedeConfirmarPublicar(errorPublicar)).toBe(true)
  })

  it('`null`: no', () => {
    expect(puedeConfirmarPublicar(null)).toBe(false)
  })

  it('cualquier otra fase: no — nunca se publica dos veces por accidente', () => {
    expect(puedeConfirmarPublicar(publicando)).toBe(false)
    expect(puedeConfirmarPublicar(sinCambios)).toBe(false)
  })
})

describe('trasPublicar', () => {
  const previo = { cambios: [], fraseCorta: 'cambia 1 texto' }

  it('éxito con sha: "sondeando", con `datos` completos y los avisos intactos — no bloquean', () => {
    const r: ResultadoPublicar = {
      ok: true, sha: 'a'.repeat(40), resumen: 'cambia 1 texto', avisos: [{ campo: 'x', titulo: 'Dice 15 sabores' }],
    }
    expect(trasPublicar(r, 1000, previo)).toEqual({
      fase: 'sondeando', frase: FRASE_PUBLICANDO,
      datos: { sha: 'a'.repeat(40), publicadoEn: 1000, avisos: [{ campo: 'x', titulo: 'Dice 15 sabores' }] },
    })
  })

  it('éxito sin cambios (sha null): "sin-cambios", con la frase del servidor', () => {
    const r: ResultadoPublicar = {
      ok: true, sha: null, resumen: 'No había nada que publicar: no cambiaste ningún dato del sitio.', avisos: [],
    }
    expect(trasPublicar(r, 1000, previo)).toEqual({ fase: 'sin-cambios', frase: r.resumen })
  })

  it('409 (pisada): "error-publicar", con el `problema` del servidor tal cual — no se traga', () => {
    const r: ResultadoPublicar = {
      ok: false, status: 409, problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
    }
    expect(trasPublicar(r, 1000, previo)).toEqual({ fase: 'error-publicar', problema: r.problema, ...previo })
  })

  it('400 (sin base): mismo tratamiento, el `problema` tal cual', () => {
    const r: ResultadoPublicar = { ok: false, status: 400, problema: 'No pudimos publicar: vuelve a abrir el panel y hazlo de nuevo.' }
    expect(trasPublicar(r, 1000, previo)).toEqual({ fase: 'error-publicar', problema: r.problema, ...previo })
  })
})

describe('trasEstado', () => {
  const datos: DatosSondeo = { sha: 'a'.repeat(40), publicadoEn: 1000, avisos: [] }

  it('`reintentarEn` con número: sigue sondeando, con la frase del servidor', () => {
    const r: ResultadoEstado = { ok: true, estado: 'enCurso', frase: 'Estamos subiendo tu cambio al sitio.', reintentarEn: 3000, url: null }
    expect(trasEstado(r, datos)).toEqual({ fase: 'sondeando', frase: r.frase, datos })
  })

  it('`reintentarEn: null` con `estado: "listo"`: termina', () => {
    const r: ResultadoEstado = { ok: true, estado: 'listo', frase: 'Tu cambio ya está en el sitio.', reintentarEn: null, url: 'https://x' }
    expect(trasEstado(r, datos)).toEqual({ fase: 'terminado', frase: r.frase, datos })
  })

  it('`reintentarEn: null` SIN `estado: "listo"` (el caso de hoy, spec §4.5): también termina — nunca deja el sondeo colgado', () => {
    const r: ResultadoEstado = {
      ok: true, estado: 'enCurso',
      frase: 'Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.',
      reintentarEn: null, url: null,
    }
    expect(trasEstado(r, datos)).toEqual({ fase: 'terminado', frase: r.frase, datos })
  })

  it('una falla de red: "error-sondeo", con `datos` intactos — la pantalla no se queda sin salida', () => {
    const r: ResultadoEstado = { ok: false, status: 502, problema: 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.' }
    expect(trasEstado(r, datos)).toEqual({ fase: 'error-sondeo', problema: r.problema, datos })
  })
})

describe('trasDeshacer', () => {
  const datos: DatosSondeo = { sha: 'a'.repeat(40), publicadoEn: 1000, avisos: [] }

  it('éxito: "deshecho", con el resumen del servidor', () => {
    const r: ResultadoDeshacer = { ok: true, sha: 'c'.repeat(40), resumen: 'Listo, lo dejé como estaba antes.' }
    expect(trasDeshacer(r, datos)).toEqual({ fase: 'deshecho', resumen: r.resumen })
  })

  it('409 (ventana vencida): "error-deshacer", con `datos` — la pantalla no se queda sin salida', () => {
    const r: ResultadoDeshacer = { ok: false, status: 409, problema: 'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.' }
    expect(trasDeshacer(r, datos)).toEqual({ fase: 'error-deshacer', problema: r.problema, datos })
  })
})

describe('siguienteBase', () => {
  it('con un sha nuevo, ese es el que sigue', () => {
    expect(siguienteBase('a'.repeat(40), 'b'.repeat(40))).toBe('b'.repeat(40))
  })

  it('con `sha: null` (sin cambios), se queda con el que ya había', () => {
    expect(siguienteBase('a'.repeat(40), null)).toBe('a'.repeat(40))
  })
})

/*
 * ---------------------------------------------------------------------
 * El botón «Deshacer», durante 30 minutos — aparece y desaparece
 * ---------------------------------------------------------------------
 */

describe('puedeDeshacer', () => {
  it('recién publicado: sí', () => {
    expect(puedeDeshacer(1000, 1000)).toBe(true)
  })

  it('a los 30:00.000 exactos: todavía sí (mismo borde que el servidor, `>` no `>=`)', () => {
    expect(puedeDeshacer(0, VENTANA_DESHACER_MS)).toBe(true)
  })

  it('un milisegundo después de los 30 minutos: no — el botón desaparece', () => {
    expect(puedeDeshacer(0, VENTANA_DESHACER_MS + 1)).toBe(false)
  })

  it('mucho después: no', () => {
    expect(puedeDeshacer(0, VENTANA_DESHACER_MS * 3)).toBe(false)
  })
})

describe('hrefVerSitio', () => {
  it('la home, con un parámetro anticaché', () => {
    expect(hrefVerSitio(12345)).toBe('/?t=12345')
  })
})

/*
 * ---------------------------------------------------------------------
 * El sondeo: obedece `reintentarEn`, para con `null` — nunca un intervalo propio
 * ---------------------------------------------------------------------
 */

describe('sondea', () => {
  it('espera EXACTAMENTE lo que pidió el servidor entre pedidos, y para cuando viene `null`', async () => {
    vi.useFakeTimers()
    const secuencia = [
      { ok: true as const, estado: 'enCurso' as const, frase: 'a', reintentarEn: 3000, url: null },
      { ok: true as const, estado: 'enCurso' as const, frase: 'b', reintentarEn: 6000, url: null },
      { ok: true as const, estado: 'listo' as const, frase: 'c', reintentarEn: null, url: 'https://x' },
    ]
    let i = 0
    const llamadas: number[] = []
    const resultados: string[] = []

    sondea(
      { sha: 'a'.repeat(40), publicadoEn: 0 },
      {
        estado: async () => { llamadas.push(Date.now()); return secuencia[i++] },
        espera: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onResultado: (r) => { if (r.ok) resultados.push(r.frase) },
      },
    )

    await vi.advanceTimersByTimeAsync(0) // la primera llamada, inmediata
    expect(llamadas).toHaveLength(1)
    expect(resultados).toEqual(['a'])

    await vi.advanceTimersByTimeAsync(2999)
    expect(llamadas).toHaveLength(1) // todavía no pasaron los 3000ms que pidió
    await vi.advanceTimersByTimeAsync(1)
    expect(llamadas).toHaveLength(2)
    expect(resultados).toEqual(['a', 'b'])

    await vi.advanceTimersByTimeAsync(5999)
    expect(llamadas).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(llamadas).toHaveLength(3)
    expect(resultados).toEqual(['a', 'b', 'c'])

    // `reintentarEn: null` en la tercera: nunca hay una cuarta, por mucho que pase.
    await vi.advanceTimersByTimeAsync(600_000)
    expect(llamadas).toHaveLength(3)
    vi.useRealTimers()
  })

  it('una falla de red corta el ciclo — nunca reintenta sola, nunca inventa una cadencia', async () => {
    vi.useFakeTimers()
    let llamadas = 0
    const esperas: number[] = []
    const resultados: unknown[] = []
    sondea(
      { sha: 'a'.repeat(40), publicadoEn: 0 },
      {
        estado: async () => {
          llamadas++
          return { ok: false as const, status: 0, problema: 'Esto está tardando demasiado. Revisa tu conexión e intenta de nuevo.' }
        },
        espera: (ms) => { esperas.push(ms); return new Promise((resolve) => setTimeout(resolve, ms)) },
        onResultado: (r) => resultados.push(r),
      },
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(llamadas).toBe(1)
    expect(esperas).toEqual([])
    await vi.advanceTimersByTimeAsync(600_000)
    expect(llamadas).toBe(1) // ni una llamada de más: no reintentó sola
    expect(resultados).toHaveLength(1)
    vi.useRealTimers()
  })

  it('detente() corta el ciclo — nunca más vuelve a llamar a `estado()`', async () => {
    const llamados: unknown[] = []
    let liberaEspera: (() => void) | undefined
    const controlador = sondea(
      { sha: 'a'.repeat(40), publicadoEn: 0 },
      {
        estado: async (cuerpo) => {
          llamados.push(cuerpo)
          return { ok: true as const, estado: 'enCurso' as const, frase: 'x', reintentarEn: 1000, url: null }
        },
        espera: () => new Promise<void>((resolve) => { liberaEspera = resolve }),
        onResultado: () => {},
      },
    )
    expect(llamados).toHaveLength(1) // la primera llamada es síncrona hasta el primer `await`

    await Promise.resolve()
    await Promise.resolve()
    controlador.detente()
    liberaEspera?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(llamados).toHaveLength(1)
  })
})
