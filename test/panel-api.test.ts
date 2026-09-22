/*
 * `src/panel/api.ts`: el cliente de las ocho acciones de `/api/panel`.
 *
 * El punto central de esta suite es el mismo que `correo.ts` («manda()
 * nunca tira») trasladado al otro lado del cable: NINGUNA de las ocho
 * funciones puede tirar, pase lo que pase con la red o con lo que
 * conteste el servidor. Por eso, además de un `describe` por acción (su
 * forma de éxito, sus fracasos con `campo`, etc.), hay un bloque de
 * «torturas» compartido que corre las mismas formas patológicas de fallar
 * contra las ocho — reusando `fetchFalso` de `test/lib/github-falso.ts`,
 * como pide la tarea, más fakes propios para lo que ese helper no cubre:
 * la red caída (un `fetch` que RECHAZA), un cuerpo que no es JSON
 * (`fetchFalso` siempre contesta JSON válido), y un `fetch` que se CUELGA
 * (ni resuelve ni rechaza — el wifi de mercado que no cae, tarda) para
 * probar el timeout de `AbortController` sin esperar el tiempo real:
 * `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`.
 *
 * [Ronda de arreglo] Las tres frases propias de `api.ts`
 * (`PROBLEMA_SIN_RED`/`PROBLEMA_TARDO`/`PROBLEMA_RESPUESTA_INESPERADA`) no
 * están importadas — no hace falta duplicarlas acá: las torturas ya
 * producen el `problema` de VERDAD que sale de cada una, y `jergaEn()` se
 * corre sobre ESE resultado. Es más honesto que reimportar/reescribir las
 * constantes en el test (eso solo probaría que el test está de acuerdo
 * consigo mismo).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { jergaEn } from '@/servidor/estado'
import {
  entrar, enlace, publicar, estado, deshacer, historial, borradorGuardar, borradorLeer,
} from '@/panel/api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Un `fetch` que jamás contesta: la red se cayó antes de que hubiera cualquier respuesta. */
function fetchQueRechaza(): typeof fetch {
  return (() => Promise.reject(new Error('la red se cayó'))) as unknown as typeof fetch
}

/** Un `fetch` que contesta, pero con un cuerpo que no es JSON — `.json()` tira. */
function fetchConCuerpoIlegible(status = 200): { f: typeof fetch; pedidos: Array<{ url: string; init: RequestInit }> } {
  const pedidos: Array<{ url: string; init: RequestInit }> = []
  const f = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init })
    return new Response('esto no es JSON', { status })
  }) as unknown as typeof fetch
  return { f, pedidos }
}

/**
 * Un `fetch` que nunca contesta —ni éxito ni error— salvo que se aborte:
 * el wifi que se CUELGA, no el que se cae. Sigue el contrato real de
 * `fetch` + `AbortController` (MDN): si el `signal` que se le pasó se
 * aborta, la promesa RECHAZA con un `AbortError` — sin esto, el fake no
 * probaría nada del `AbortController` de `llama()`, solo un `fetch` lento
 * cualquiera.
 */
function fetchQueSeCuelga(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('canceled', 'AbortError')))
    })) as unknown as typeof fetch
}

/** Instala `respuestas` como el `fetch` global y devuelve los pedidos que se registraron. */
function instala(respuestas: Array<{ status?: number; cuerpo: unknown }>) {
  const { f, pedidos } = fetchFalso(respuestas)
  vi.stubGlobal('fetch', f)
  return pedidos
}

describe('entrar', () => {
  it('éxito: 200 vuelve { ok: true }, con la acción, el método y las credenciales correctas', async () => {
    const pedidos = instala([{ cuerpo: { ok: true } }])
    const r = await entrar({ correo: 'a@b.mx', clave: 'x', recuerdame: true, dispositivo: 'aparato-1' })

    expect(r).toEqual({ ok: true })
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0].url).toBe('/api/panel?accion=entrar')
    expect(pedidos[0].metodo).toBe('POST')
    expect(pedidos[0].cuerpo).toEqual({ correo: 'a@b.mx', clave: 'x', recuerdame: true, dispositivo: 'aparato-1' })
  })

  it('la cookie de sesión viaja con `credentials: "same-origin"` — nunca leída ni guardada acá', async () => {
    const capturados: RequestInit[] = []
    vi.stubGlobal(
      'fetch',
      (async (_url: string, init: RequestInit) => {
        capturados.push(init)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as unknown as typeof fetch,
    )
    await entrar({ correo: 'a@b.mx', clave: 'x' })
    expect(capturados).toHaveLength(1)
    expect(capturados[0].credentials).toBe('same-origin')
  })

  it('401: el `problema` del servidor llega intacto, letra por letra', async () => {
    instala([{ status: 401, cuerpo: { ok: false, problema: 'No se pudo entrar: revisa tus datos y vuelve a intentar.' } }])
    const r = await entrar({ correo: 'a@b.mx', clave: 'mala' })
    expect(r).toEqual({ ok: false, status: 401, problema: 'No se pudo entrar: revisa tus datos y vuelve a intentar.' })
  })

  it('429: el mismo trato — status y problema tal cual', async () => {
    instala([{ status: 429, cuerpo: { ok: false, problema: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' } }])
    const r = await entrar({ correo: 'a@b.mx', clave: 'x' })
    expect(r).toEqual({ ok: false, status: 429, problema: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' })
  })
})

describe('enlace', () => {
  it('éxito: el `mensaje` del servidor llega tal cual', async () => {
    const pedidos = instala([{ cuerpo: { ok: true, mensaje: 'Si esa dirección tiene acceso, te llegó un correo con el enlace.' } }])
    const r = await enlace({ correo: 'a@b.mx' })
    expect(r).toEqual({ ok: true, mensaje: 'Si esa dirección tiene acceso, te llegó un correo con el enlace.' })
    expect(pedidos[0].url).toBe('/api/panel?accion=enlace')
  })

  it('200 sin `mensaje` (cuerpo roto): no se inventa un texto — cae en la frase propia', async () => {
    instala([{ cuerpo: { ok: true } }])
    const r = await enlace({ correo: 'a@b.mx' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problema).toBe('Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.')
  })

  it('503: problema tal cual', async () => {
    instala([{ status: 503, cuerpo: { ok: false, problema: 'Ahora mismo no puedo mandarte el enlace. Escríbele a Marcos.' } }])
    const r = await enlace({ correo: 'a@b.mx' })
    expect(r).toEqual({ ok: false, status: 503, problema: 'Ahora mismo no puedo mandarte el enlace. Escríbele a Marcos.' })
  })
})

describe('publicar', () => {
  it('éxito con cambios: sha, resumen y avisos llegan completos', async () => {
    const pedidos = instala([
      {
        cuerpo: {
          ok: true,
          sha: 'a'.repeat(40),
          resumen: 'cambia sabores',
          avisos: [{ campo: 'sitio.anaquel.titulo', titulo: 'Dice «15 sabores»', detalle: 'Hoy hay 14.' }],
        },
      },
    ])
    const r = await publicar({ documentos: { sabores: {} }, base: 'b'.repeat(40) })
    expect(r).toEqual({
      ok: true,
      sha: 'a'.repeat(40),
      resumen: 'cambia sabores',
      avisos: [{ campo: 'sitio.anaquel.titulo', titulo: 'Dice «15 sabores»', detalle: 'Hoy hay 14.' }],
    })
    expect(pedidos[0].url).toBe('/api/panel?accion=publicar')
  })

  it('éxito sin cambios: sha null, avisos vacíos', async () => {
    instala([{ cuerpo: { ok: true, sha: null, resumen: 'No había nada que publicar: no cambiaste ningún dato del sitio.', avisos: [] } }])
    const r = await publicar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r).toEqual({ ok: true, sha: null, resumen: 'No había nada que publicar: no cambiaste ningún dato del sitio.', avisos: [] })
  })

  it('un aviso sin `detalle` no inventa el campo: queda ausente, no `undefined` explícito', async () => {
    instala([{ cuerpo: { ok: true, sha: null, resumen: 'r', avisos: [{ campo: 'x', titulo: 't' }] } }])
    const r = await publicar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.avisos).toEqual([{ campo: 'x', titulo: 't' }])
      expect('detalle' in r.avisos[0]).toBe(false)
    }
  })

  it('un aviso sin `titulo` se descarta, sin tirar y sin ensuciar el resto', async () => {
    instala([{ cuerpo: { ok: true, sha: null, resumen: 'r', avisos: [{ campo: 'roto' }, { campo: 'y', titulo: 'bien' }] } }])
    const r = await publicar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.avisos).toEqual([{ campo: 'y', titulo: 'bien' }])
  })

  it('422 con `campo`: viaja para que la pantalla pueda resaltarlo', async () => {
    instala([{ status: 422, cuerpo: { ok: false, problema: 'No se puede publicar «rara»: no es un documento que el panel conozca.', campo: 'rara' } }])
    const r = await publicar({ documentos: { rara: {} }, base: 'b'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 422, problema: 'No se puede publicar «rara»: no es un documento que el panel conozca.', campo: 'rara' })
  })

  it('409 (pisada): problema tal cual, sin campo', async () => {
    instala([{ status: 409, cuerpo: { ok: false, problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.' } }])
    const r = await publicar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 409, problema: 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.' })
    expect('campo' in r).toBe(false)
  })
})

describe('estado', () => {
  it('éxito: las cuatro claves del veredicto llegan completas', async () => {
    const pedidos = instala([{ cuerpo: { ok: true, estado: 'enCurso', frase: 'Estamos subiendo tu cambio al sitio.', reintentarEn: 3000, url: 'https://www.maracacao.mx' } }])
    const r = await estado({ sha: 'a'.repeat(40), publicadoEn: 1000 })
    expect(r).toEqual({ ok: true, estado: 'enCurso', frase: 'Estamos subiendo tu cambio al sitio.', reintentarEn: 3000, url: 'https://www.maracacao.mx' })
    expect(pedidos[0].url).toBe('/api/panel?accion=estado')
  })

  it('«listo»: `reintentarEn` en `null` significa parar de sondear — no se inventa un número', async () => {
    instala([{ cuerpo: { ok: true, estado: 'listo', frase: 'Tu cambio ya está en el sitio.', reintentarEn: null, url: null } }])
    const r = await estado({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: true, estado: 'listo', frase: 'Tu cambio ya está en el sitio.', reintentarEn: null, url: null })
  })

  it('un `estado` con un valor que no es ninguno de los tres: no se confía en él, cae en la falla genérica', async () => {
    instala([{ cuerpo: { ok: true, estado: 'algo-raro', frase: 'x', reintentarEn: null, url: null } }])
    const r = await estado({ sha: 'a'.repeat(40) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problema).toBe('Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.')
  })

  it('502: problema tal cual', async () => {
    instala([{ status: 502, cuerpo: { ok: false, problema: 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.' } }])
    const r = await estado({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 502, problema: 'No pudimos revisar el contenido actual del sitio: prueba de nuevo en unos minutos.' })
  })
})

describe('deshacer', () => {
  it('éxito: sha y resumen tal cual', async () => {
    const pedidos = instala([{ cuerpo: { ok: true, sha: 'c'.repeat(40), resumen: 'Listo, lo dejé como estaba antes.' } }])
    const r = await deshacer({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: true, sha: 'c'.repeat(40), resumen: 'Listo, lo dejé como estaba antes.' })
    expect(pedidos[0].url).toBe('/api/panel?accion=deshacer')
  })

  it('«ya estaba deshecho»: sha en null, mismo resumen', async () => {
    instala([{ cuerpo: { ok: true, sha: null, resumen: 'Listo, lo dejé como estaba antes.' } }])
    const r = await deshacer({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: true, sha: null, resumen: 'Listo, lo dejé como estaba antes.' })
  })

  it('409 (ventana vencida): problema tal cual', async () => {
    instala([{ status: 409, cuerpo: { ok: false, problema: 'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.' } }])
    const r = await deshacer({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 409, problema: 'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.' })
  })

  it('403 (no es tuyo): problema tal cual', async () => {
    instala([{ status: 403, cuerpo: { ok: false, problema: 'Ese cambio no se publicó desde aquí, así que no lo puedo deshacer.' } }])
    const r = await deshacer({ sha: 'a'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 403, problema: 'Ese cambio no se publicó desde aquí, así que no lo puedo deshacer.' })
  })
})

describe('historial', () => {
  it('éxito: `base` y `publicaciones` completos, en el mismo orden en que vinieron', async () => {
    const pedidos = instala([
      {
        cuerpo: {
          ok: true,
          base: 'a'.repeat(40),
          publicaciones: [
            { sha: 'c3', resumen: 'cambia precios', autor: 'clienta@ejemplo.mx', cuando: '2026-09-17T12:00:00Z', revierteA: null },
            { sha: 'c1', resumen: 'Listo, lo dejé como estaba antes.', autor: null, cuando: '2026-09-16T09:00:00Z', revierteA: 'c0' },
          ],
        },
      },
    ])
    const r = await historial()
    expect(r).toEqual({
      ok: true,
      base: 'a'.repeat(40),
      publicaciones: [
        { sha: 'c3', resumen: 'cambia precios', autor: 'clienta@ejemplo.mx', cuando: '2026-09-17T12:00:00Z', revierteA: null },
        { sha: 'c1', resumen: 'Listo, lo dejé como estaba antes.', autor: null, cuando: '2026-09-16T09:00:00Z', revierteA: 'c0' },
      ],
    })
    expect(pedidos[0].url).toBe('/api/panel?accion=historial')
  })

  it('lista vacía: `base` puede ser `null` sin que eso sea un error', async () => {
    instala([{ cuerpo: { ok: true, base: null, publicaciones: [] } }])
    const r = await historial()
    expect(r).toEqual({ ok: true, base: null, publicaciones: [] })
  })

  it('una entrada sin `sha` se descarta en vez de colar un `undefined` a la pantalla', async () => {
    instala([{ cuerpo: { ok: true, base: 'a'.repeat(40), publicaciones: [{ resumen: 'rota' }, { sha: 'c1', resumen: 'ok', autor: null, cuando: 'x', revierteA: null }] } }])
    const r = await historial()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.publicaciones).toEqual([{ sha: 'c1', resumen: 'ok', autor: null, cuando: 'x', revierteA: null }])
  })

  it('401 sin sesión: problema tal cual — esto es lo que decide la pantalla de entrada', async () => {
    instala([{ status: 401, cuerpo: { ok: false, problema: 'Tu sesión no es válida: vuelve a entrar.' } }])
    const r = await historial()
    expect(r).toEqual({ ok: false, status: 401, problema: 'Tu sesión no es válida: vuelve a entrar.' })
  })
})

describe('borrador.guardar', () => {
  it('éxito: { ok: true }, y manda `horaLeida`/`pisar` tal cual se los pasaron', async () => {
    const pedidos = instala([{ cuerpo: { ok: true } }])
    const r = await borradorGuardar({ documentos: { sitio: {} }, base: 'b'.repeat(40), horaLeida: 123, pisar: false })
    expect(r).toEqual({ ok: true })
    expect(pedidos[0].url).toBe('/api/panel?accion=borrador.guardar')
    expect(pedidos[0].cuerpo).toEqual({ documentos: { sitio: {} }, base: 'b'.repeat(40), horaLeida: 123, pisar: false })
  })

  it('409 «hay-uno-mas-nuevo»: motivo, problema Y el `otro` (dispositivo/hora) llegan completos', async () => {
    instala([
      {
        status: 409,
        cuerpo: {
          ok: false,
          motivo: 'hay-uno-mas-nuevo',
          otro: { dispositivo: 'aparato-hermana', hora: 1700000000000 },
          problema: 'Alguien más guardó un cambio más reciente desde otro aparato.',
        },
      },
    ])
    const r = await borradorGuardar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r).toEqual({
      ok: false,
      status: 409,
      problema: 'Alguien más guardó un cambio más reciente desde otro aparato.',
      motivo: 'hay-uno-mas-nuevo',
      otro: { dispositivo: 'aparato-hermana', hora: 1700000000000 },
    })
  })

  it('409 «hay-uno-mas-nuevo» con `otro` roto: no se inventa un dispositivo/hora — cae en la falla simple', async () => {
    instala([{ status: 409, cuerpo: { ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'x' }, problema: 'p' } }])
    const r = await borradorGuardar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 409, problema: 'p' })
    expect('otro' in r).toBe(false)
  })

  it('502: problema tal cual, sin motivo', async () => {
    instala([{ status: 502, cuerpo: { ok: false, problema: 'No pudimos guardar tu borrador: prueba de nuevo en unos minutos.' } }])
    const r = await borradorGuardar({ documentos: {}, base: 'b'.repeat(40) })
    expect(r).toEqual({ ok: false, status: 502, problema: 'No pudimos guardar tu borrador: prueba de nuevo en unos minutos.' })
  })

  it('la cookie de sesión viaja con `credentials: "same-origin"` también en este camino (no pasa por `pide()`)', async () => {
    const capturados: RequestInit[] = []
    vi.stubGlobal(
      'fetch',
      (async (_url: string, init: RequestInit) => {
        capturados.push(init)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as unknown as typeof fetch,
    )
    await borradorGuardar({ documentos: {}, base: 'b'.repeat(40) })
    expect(capturados[0].credentials).toBe('same-origin')
  })
})

describe('borrador.leer', () => {
  it('éxito con borrador: los cinco campos llegan completos', async () => {
    const pedidos = instala([
      { cuerpo: { ok: true, borrador: { documentos: { sitio: { x: 1 } }, base: 'b'.repeat(40), dispositivo: 'aparato-1', autor: 'a@b.mx', hora: 1700000000000 } } },
    ])
    const r = await borradorLeer()
    expect(r).toEqual({
      ok: true,
      borrador: { documentos: { sitio: { x: 1 } }, base: 'b'.repeat(40), dispositivo: 'aparato-1', autor: 'a@b.mx', hora: 1700000000000 },
    })
    expect(pedidos[0].url).toBe('/api/panel?accion=borrador.leer')
  })

  it('sin borrador: `borrador: null`, no un error', async () => {
    instala([{ cuerpo: { ok: true, borrador: null } }])
    const r = await borradorLeer()
    expect(r).toEqual({ ok: true, borrador: null })
  })

  it('un borrador con forma rota (le falta `hora`) se trata como si no hubiera — nunca se inventa un valor', async () => {
    instala([{ cuerpo: { ok: true, borrador: { documentos: {}, base: 'b'.repeat(40), dispositivo: 'a', autor: 'x' } } }])
    const r = await borradorLeer()
    expect(r).toEqual({ ok: true, borrador: null })
  })

  it('502: problema tal cual', async () => {
    instala([{ status: 502, cuerpo: { ok: false, problema: 'No pudimos abrir tu borrador: prueba de nuevo en unos minutos.' } }])
    const r = await borradorLeer()
    expect(r).toEqual({ ok: false, status: 502, problema: 'No pudimos abrir tu borrador: prueba de nuevo en unos minutos.' })
  })
})

/*
 * ---------------------------------------------------------------------
 * Torturas compartidas: ninguna de las ocho puede tirar, pase lo que pase.
 * ---------------------------------------------------------------------
 */
describe('ninguna de las ocho tira, ante ninguna forma de fallar', () => {
  const llamados: Record<string, () => Promise<unknown>> = {
    entrar: () => entrar({ correo: 'a@b.mx', clave: 'x' }),
    enlace: () => enlace({ correo: 'a@b.mx' }),
    publicar: () => publicar({ documentos: {}, base: 'b'.repeat(40) }),
    estado: () => estado({ sha: 'a'.repeat(40) }),
    deshacer: () => deshacer({ sha: 'a'.repeat(40) }),
    historial: () => historial(),
    'borrador.guardar': () => borradorGuardar({ documentos: {}, base: 'b'.repeat(40) }),
    'borrador.leer': () => borradorLeer(),
  }

  describe('la red caída (fetch rechaza) vuelve como resultado, con la frase propia — nunca una excepción', () => {
    for (const [nombre, llama] of Object.entries(llamados)) {
      it(nombre, async () => {
        vi.stubGlobal('fetch', fetchQueRechaza())
        const r = (await llama()) as { ok: boolean; status: number; problema: string }
        expect(r.ok).toBe(false)
        expect(r.status).toBe(0)
        expect(r.problema).toBe('No se pudo conectar. Intenta de nuevo.')
        // [Ronda de arreglo, hallazgo 2] Esta frase es propia de api.ts —
        // no la escribió el servidor—, así que nadie más la vigila. La
        // corre `jergaEn()` sobre el `problema` de VERDAD que devolvió la
        // función, no sobre una copia de la constante.
        expect(jergaEn(r.problema)).toBeNull()
      })
    }
  })

  describe('un cuerpo que no es JSON vuelve como resultado, con el status real y sin inventar un `problema` del servidor', () => {
    for (const [nombre, llama] of Object.entries(llamados)) {
      it(nombre, async () => {
        const { f } = fetchConCuerpoIlegible(200)
        vi.stubGlobal('fetch', f)
        const r = (await llama()) as { ok: boolean; status: number; problema: string }
        expect(r.ok).toBe(false)
        expect(r.status).toBe(200)
        expect(r.problema).toBe('Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.')
        expect(jergaEn(r.problema)).toBeNull()
      })
    }
  })

  describe('un 500 con un cuerpo sin `problema` (o directamente vacío) no inventa ningún texto propio del servidor', () => {
    for (const [nombre, llama] of Object.entries(llamados)) {
      it(nombre, async () => {
        vi.stubGlobal('fetch', fetchFalso([{ status: 500, cuerpo: {} }]).f)
        const r = (await llama()) as { ok: boolean; status: number; problema: string }
        expect(r.ok).toBe(false)
        expect(r.status).toBe(500)
        expect(r.problema).toBe('Algo salió mal de nuestro lado. Intenta de nuevo en unos minutos.')
        expect(jergaEn(r.problema)).toBeNull()
      })
    }
  })

  /*
   * [Ronda de arreglo, hallazgo 1] Un `fetch` que ni resuelve ni rechaza
   * —el wifi de mercado que se CUELGA, no el que se cae— antes de este
   * arreglo dejaba la promesa sin resolver PARA SIEMPRE: no tiraba (la
   * promesa de este archivo se cumplía) pero tampoco volvía nunca (la
   * rompía igual, de otra forma). `vi.useFakeTimers()` +
   * `vi.advanceTimersByTimeAsync()` adelantan el reloj sin esperar el
   * tiempo real — sin esto, cada test de acá abajo tardaría de verdad los
   * 15 o 45 segundos del timeout.
   */
  describe('un fetch que se cuelga (ni resuelve ni rechaza) vuelve como resultado después del tiempo de espera — nunca se queda esperando para siempre', () => {
    for (const [nombre, llama] of Object.entries(llamados)) {
      it(nombre, async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', fetchQueSeCuelga())
        const promesa = llama()
        // 46s cubre las dos franjas (15s de lectura, 45s de escritura):
        // no hace falta saber acá cuál le toca a cada acción, alcanza con
        // que NINGUNA quede sin resolver más allá de la más larga.
        await vi.advanceTimersByTimeAsync(46_000)
        const r = (await promesa) as { ok: boolean; status: number; problema: string }
        expect(r.ok).toBe(false)
        expect(r.status).toBe(0)
        expect(r.problema).toBe('Esto está tardando demasiado. Revisa tu conexión e intenta de nuevo.')
        expect(jergaEn(r.problema)).toBeNull()
      })
    }
  })
})

/*
 * ---------------------------------------------------------------------
 * El timeout en sí: los dos presupuestos (lectura vs. escritura), al
 * milisegundo — el bloque de arriba prueba que las ocho SE CORTAN; esto
 * prueba CUÁNDO, con `historial` (lectura) y `publicar` (escritura) como
 * representantes de cada franja.
 * ---------------------------------------------------------------------
 */
describe('el tiempo de espera tiene dos presupuestos: quince segundos para leer, cuarenta y cinco para escribir', () => {
  it('una lectura, un instante ANTES de los 15s: todavía no cortó — no se corta antes de tiempo', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchQueSeCuelga())
    let resuelto = false
    void historial().then(() => {
      resuelto = true
    })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(resuelto).toBe(false)
  })

  it('una lectura, a los 15s exactos: corta y vuelve como resultado', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchQueSeCuelga())
    const promesa = historial()
    await vi.advanceTimersByTimeAsync(15_000)
    const r = await promesa
    expect(r).toEqual({ ok: false, status: 0, problema: 'Esto está tardando demasiado. Revisa tu conexión e intenta de nuevo.' })
  })

  it('una escritura (publicar): a los 15s —lo que ya cortó una lectura— TODAVÍA no cortó', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchQueSeCuelga())
    let resuelto = false
    void publicar({ documentos: {}, base: 'b'.repeat(40) }).then(() => {
      resuelto = true
    })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(resuelto).toBe(false)
  })

  // Sin este par (instante antes / exacto), «a los 45s corta» solo prueba
  // que corta A MÁS TARDAR a los 45s — un timeout de escritura MÁS CORTO
  // (20s, por ejemplo) pasaría este test igual, porque para cuando el
  // reloj llega a 45s la promesa YA se resolvió. El par de abajo es lo que
  // de verdad fija el número, igual que el de la lectura, arriba.
  it('una escritura (publicar), un instante ANTES de los 45s: todavía no cortó', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchQueSeCuelga())
    let resuelto = false
    void publicar({ documentos: {}, base: 'b'.repeat(40) }).then(() => {
      resuelto = true
    })
    await vi.advanceTimersByTimeAsync(44_999)
    expect(resuelto).toBe(false)
  })

  it('una escritura (publicar), a los 45s exactos: corta y vuelve como resultado', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchQueSeCuelga())
    const promesa = publicar({ documentos: {}, base: 'b'.repeat(40) })
    await vi.advanceTimersByTimeAsync(45_000)
    const r = await promesa
    expect(r).toEqual({ ok: false, status: 0, problema: 'Esto está tardando demasiado. Revisa tu conexión e intenta de nuevo.' })
  })
})
