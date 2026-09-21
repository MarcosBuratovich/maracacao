/*
 * `src/panel/borrador.ts` (Tarea 3, fase 6): el auto-guardado del borrador y
 * la pantalla de conflicto cuando el que hay en el servidor es de otro
 * aparato.
 *
 * Mismo criterio de tortura que `test/panel-api.test.ts` fija para el
 * timeout: nada de esperar tiempo real — `vi.useFakeTimers()` +
 * `vi.advanceTimersByTimeAsync()` para el retardo y el piso duro del
 * auto-guardado.
 */
import { describe, it, expect, vi } from 'vitest'
import { jergaEn } from '@/servidor/estado'
import { contenidoPublicado, type Documentos } from '@/panel/campos'
import type { Borrador, OtroBorrador, ResultadoBorradorGuardar, ResultadoBorradorLeer } from '@/panel/api'
import {
  cuentaCambios, haceCuanto, resumenBorradorAjeno, resumenOtroBorrador,
  trasLeerBorrador, resuelveConflicto, trasGuardar, Autoguardado,
  RETARDO_GUARDADO_MS, PISO_GUARDADO_MS,
} from '@/panel/borrador'

const clon = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/*
 * ---------------------------------------------------------------------
 * Cuántos cambios trae un borrador, y desde cuándo
 * ---------------------------------------------------------------------
 */

describe('cuentaCambios', () => {
  it('sin cambios, cero', () => {
    const publicado = contenidoPublicado()
    expect(cuentaCambios(publicado, { sitio: clon(publicado.sitio) })).toBe(0)
  })

  it('cuenta un campo cambiado', () => {
    const publicado = contenidoPublicado()
    const sitio = clon(publicado.sitio) as { anaquel: { titulo: string } }
    sitio.anaquel.titulo = 'Otro título'
    expect(cuentaCambios(publicado, { sitio })).toBe(1)
  })

  it('cuenta dos campos cambiados', () => {
    const publicado = contenidoPublicado()
    const sitio = clon(publicado.sitio) as { anaquel: { titulo: string; kicker: string } }
    sitio.anaquel.titulo = 'Otro título'
    sitio.anaquel.kicker = 'Otro kicker'
    expect(cuentaCambios(publicado, { sitio })).toBe(2)
  })

  it('solo mira los documentos que vienen en `otros` — uno ausente no cuenta como "todo cambió"', () => {
    const publicado = contenidoPublicado()
    expect(cuentaCambios(publicado, {})).toBe(0)
  })
})

describe('haceCuanto', () => {
  it('menos de un minuto: "hace un momento"', () => {
    expect(haceCuanto(30_000)).toBe('hace un momento')
  })

  it('minutos, singular y plural', () => {
    expect(haceCuanto(60_000)).toBe('hace 1 minuto')
    expect(haceCuanto(5 * 60_000)).toBe('hace 5 minutos')
  })

  it('horas, singular y plural', () => {
    expect(haceCuanto(60 * 60_000)).toBe('hace 1 hora')
    expect(haceCuanto(3 * 60 * 60_000)).toBe('hace 3 horas')
  })

  it('días, singular y plural', () => {
    expect(haceCuanto(24 * 60 * 60_000)).toBe('hace 1 día')
    expect(haceCuanto(6 * 24 * 60 * 60_000)).toBe('hace 6 días')
  })

  it('nunca negativo, aunque el reloj del otro aparato esté adelantado', () => {
    expect(haceCuanto(-500)).toBe('hace un momento')
  })

  it('ninguna salida trae jerga, para ningún número', () => {
    for (const ms of [0, 500, 59_000, 60_000, 90_000, 3_600_000, 90_000_000, 999_000_000]) {
      const texto = haceCuanto(ms)
      expect(jergaEn(texto), texto).toBeNull()
    }
  })
})

describe('resumenBorradorAjeno', () => {
  it('cuenta y hace-cuánto, juntos', () => {
    const publicado = contenidoPublicado()
    const sitio = clon(publicado.sitio) as { anaquel: { titulo: string } }
    sitio.anaquel.titulo = 'Otro título'
    const borrador: Borrador = {
      documentos: { sitio },
      base: 'b'.repeat(40),
      dispositivo: 'aparato-hermana',
      autor: 'hermana@ejemplo.mx',
      hora: 1000,
    }
    const ahora = 1000 + 6 * 24 * 60 * 60_000
    expect(resumenBorradorAjeno(borrador, publicado, ahora)).toBe('otro aparato, hace 6 días, 1 cambio')
  })

  it('nunca nombra el tipo de aparato — solo "otro aparato" (aparato.ts: no hay forma de saber si es un celular)', () => {
    const publicado = contenidoPublicado()
    const borrador: Borrador = { documentos: {}, base: 'b'.repeat(40), dispositivo: 'x', autor: 'a@b.mx', hora: 0 }
    const texto = resumenBorradorAjeno(borrador, publicado, 0)
    expect(texto).not.toMatch(/celular|compu|tablet|teléfono/i)
    expect(jergaEn(texto), texto).toBeNull()
  })
})

describe('resumenOtroBorrador', () => {
  it('solo hace-cuánto — `OtroBorrador` no trae documentos que contar', () => {
    const otro: OtroBorrador = { dispositivo: 'aparato-hermana', hora: 1000 }
    expect(resumenOtroBorrador(otro, 1000 + 5 * 60_000)).toBe('otro aparato, hace 5 minutos')
  })

  it('sin jerga', () => {
    const otro: OtroBorrador = { dispositivo: 'x', hora: 0 }
    expect(jergaEn(resumenOtroBorrador(otro, 0))).toBeNull()
  })
})

/*
 * ---------------------------------------------------------------------
 * Al abrir: leer y decidir
 * ---------------------------------------------------------------------
 */

describe('trasLeerBorrador', () => {
  it('sin borrador: "listo", sin `horaLeida` ni `documentos`', () => {
    const r: ResultadoBorradorLeer = { ok: true, borrador: null }
    expect(trasLeerBorrador(r, 'aparato-mio')).toEqual({ fase: 'listo', horaLeida: undefined, documentos: undefined })
  })

  it('borrador del MISMO aparato: "listo", se retoma solo — nunca se pregunta', () => {
    const borrador: Borrador = {
      documentos: { sitio: { x: 1 } }, base: 'b'.repeat(40), dispositivo: 'aparato-mio', autor: 'a@b.mx', hora: 555,
    }
    const r: ResultadoBorradorLeer = { ok: true, borrador }
    expect(trasLeerBorrador(r, 'aparato-mio')).toEqual({ fase: 'listo', horaLeida: 555, documentos: { sitio: { x: 1 } } })
  })

  it('borrador de OTRO aparato: "conflicto" — hay que preguntar', () => {
    const borrador: Borrador = {
      documentos: { sitio: { x: 1 } }, base: 'b'.repeat(40), dispositivo: 'aparato-hermana', autor: 'a@b.mx', hora: 555,
    }
    const r: ResultadoBorradorLeer = { ok: true, borrador }
    expect(trasLeerBorrador(r, 'aparato-mio')).toEqual({ fase: 'conflicto', borrador })
  })

  it('la lectura falla: "error", con el `problema` del servidor tal cual', () => {
    const r: ResultadoBorradorLeer = {
      ok: false, status: 502, problema: 'No pudimos abrir tu borrador: prueba de nuevo en unos minutos.',
    }
    expect(trasLeerBorrador(r, 'aparato-mio')).toEqual({
      fase: 'error', problema: 'No pudimos abrir tu borrador: prueba de nuevo en unos minutos.',
    })
  })
})

describe('resuelveConflicto', () => {
  const borrador: Borrador = {
    documentos: { sitio: { x: 1 } }, base: 'b'.repeat(40), dispositivo: 'aparato-hermana', autor: 'a@b.mx', hora: 777,
  }

  it('abrir-otro: trae los documentos del borrador, y declara haberlo visto', () => {
    expect(resuelveConflicto('abrir-otro', borrador)).toEqual({ horaLeida: 777, documentos: { sitio: { x: 1 } } })
  })

  it('seguir-publicado: sin documentos, pero declara haberlo visto IGUAL — así el próximo guardado no vuelve a chocar', () => {
    expect(resuelveConflicto('seguir-publicado', borrador)).toEqual({ horaLeida: 777, documentos: undefined })
  })
})

/*
 * ---------------------------------------------------------------------
 * `borrador.guardar` — el 409 no se traga
 * ---------------------------------------------------------------------
 */

describe('trasGuardar', () => {
  it('éxito: "ok"', () => {
    expect(trasGuardar({ ok: true })).toEqual({ tipo: 'ok' })
  })

  it('409 hay-uno-mas-nuevo: "conflicto", con el `problema` Y el `otro` tal cual — no se traga', () => {
    const r: ResultadoBorradorGuardar = {
      ok: false, status: 409, problema: 'Alguien más guardó un cambio más reciente desde otro aparato.',
      motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'aparato-hermana', hora: 999 },
    }
    expect(trasGuardar(r)).toEqual({
      tipo: 'conflicto', problema: 'Alguien más guardó un cambio más reciente desde otro aparato.',
      otro: { dispositivo: 'aparato-hermana', hora: 999 },
    })
  })

  it('cualquier otra falla: "error", con el `problema` tal cual', () => {
    const r: ResultadoBorradorGuardar = {
      ok: false, status: 502, problema: 'No pudimos guardar tu borrador: prueba de nuevo en unos minutos.',
    }
    expect(trasGuardar(r)).toEqual({ tipo: 'error', problema: 'No pudimos guardar tu borrador: prueba de nuevo en unos minutos.' })
  })
})

/*
 * ---------------------------------------------------------------------
 * Autoguardado: retardo, piso duro, guardado a mano
 * ---------------------------------------------------------------------
 */

function doc(n: number): Documentos {
  return { sitio: { n }, sabores: {}, fichas: {} } as unknown as Documentos
}

describe('Autoguardado', () => {
  it('espera el retardo antes de guardar — no guarda apenas se anota', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    const a = new Autoguardado({ guardar: async (docs) => { llamados.push(docs); return { ok: true } }, onResultado: () => {} })
    a.anota(doc(1))
    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO_MS - 1)
    expect(llamados).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(llamados).toEqual([doc(1)])
    a.destruye()
    vi.useRealTimers()
  })

  it('reinicia el retardo con cada anotación — solo guarda cuando se queda quieta', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    const a = new Autoguardado({ guardar: async (docs) => { llamados.push(docs); return { ok: true } }, onResultado: () => {} })
    a.anota(doc(1))
    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO_MS - 1)
    a.anota(doc(2)) // reinicia el retardo — el primero nunca llega a guardarse
    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO_MS - 1)
    expect(llamados).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(llamados).toEqual([doc(2)])
    a.destruye()
    vi.useRealTimers()
  })

  it('el piso duro guarda a los 30s aunque re-anote cada 5s (spec §4.3)', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    const a = new Autoguardado({ guardar: async (docs) => { llamados.push(docs); return { ok: true } }, onResultado: () => {} })
    a.anota(doc(0))
    for (let i = 1; i <= 5; i++) {
      await vi.advanceTimersByTimeAsync(5_000)
      a.anota(doc(i))
    }
    expect(llamados).toHaveLength(0) // a los 25s: ni el retardo (se reinicia cada 5s) ni el piso (30s) dispararon
    await vi.advanceTimersByTimeAsync(5_000) // 30s: el piso dispara
    expect(llamados).toHaveLength(1)
    a.destruye()
    vi.useRealTimers()
  })

  it('guardaAhora() no espera el retardo', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    const a = new Autoguardado({ guardar: async (docs) => { llamados.push(docs); return { ok: true } }, onResultado: () => {} })
    a.guardaAhora(doc(1))
    expect(llamados).toEqual([doc(1)])
    a.destruye()
    vi.useRealTimers()
  })

  it('manda `horaLeida`/`pisar` tal cual se fijaron, y `pisar` se consume una sola vez', async () => {
    vi.useFakeTimers()
    const pedidos: Array<{ horaLeida: number | undefined; pisar: boolean }> = []
    const a = new Autoguardado({ guardar: async (_d, args) => { pedidos.push(args); return { ok: true } }, onResultado: () => {} })
    a.fijaHoraLeida(123)
    a.fuerzaProximoGuardado()
    a.guardaAhora(doc(1))
    expect(pedidos).toEqual([{ horaLeida: 123, pisar: true }])
    await vi.advanceTimersByTimeAsync(0) // deja que termine ESTE guardado antes de pedir el siguiente

    a.guardaAhora(doc(2))
    await vi.advanceTimersByTimeAsync(0)
    expect(pedidos[1]).toEqual({ horaLeida: 123, pisar: false })
    a.destruye()
    vi.useRealTimers()
  })

  it('lo anotado DURANTE un guardado en vuelo no se pierde: se reprograma al terminar', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    let resolver: ((r: ResultadoBorradorGuardar) => void) | undefined
    const a = new Autoguardado({
      guardar: (docs) => { llamados.push(docs); return new Promise((r) => { resolver = r }) },
      onResultado: () => {},
    })
    a.guardaAhora(doc(1))
    expect(llamados).toEqual([doc(1)])

    a.anota(doc(2)) // llega MIENTRAS el primero sigue en vuelo
    resolver?.({ ok: true })
    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO_MS)
    expect(llamados).toEqual([doc(1), doc(2)])
    a.destruye()
    vi.useRealTimers()
  })

  it('un 409 llega a `onResultado` como "conflicto", con `otro` intacto — no se traga', async () => {
    vi.useFakeTimers()
    const conflictoR: ResultadoBorradorGuardar = {
      ok: false, status: 409, problema: 'Alguien más guardó un cambio más reciente desde otro aparato.',
      motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'aparato-hermana', hora: 42 },
    }
    const resultados: unknown[] = []
    const a = new Autoguardado({ guardar: async () => conflictoR, onResultado: (r) => resultados.push(r) })
    a.guardaAhora(doc(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(resultados).toEqual([
      { tipo: 'conflicto', problema: conflictoR.problema, otro: { dispositivo: 'aparato-hermana', hora: 42 } },
    ])
    a.destruye()
    vi.useRealTimers()
  })

  it('destruye(): no guarda más después, ni el retardo ni el piso que ya estaban andando', async () => {
    vi.useFakeTimers()
    const llamados: Documentos[] = []
    const a = new Autoguardado({ guardar: async (docs) => { llamados.push(docs); return { ok: true } }, onResultado: () => {} })
    a.anota(doc(1))
    a.destruye()
    await vi.advanceTimersByTimeAsync(PISO_GUARDADO_MS + 1_000)
    expect(llamados).toHaveLength(0)
    vi.useRealTimers()
  })
})
