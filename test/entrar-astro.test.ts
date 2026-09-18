/*
 * `/panel/entrar` (Tarea 12, spec §4.1): el enlace mágico de recuperación.
 *
 * [A, Critical — Ronda 1 de revisión] Los seis tests originales de este
 * archivo miraban el TEXTO del HTML construido, no lo que el script hace
 * de verdad — y así fue como `history.replaceState` corriendo ANTES de
 * leer `location.search` (token siempre `''`, botón que nunca aparece)
 * pasó desapercibido con los 1179 tests en verde: uno de ellos exigía que
 * la cadena `history.replaceState` apareciera en el HTML, y aparecía — en
 * el orden equivocado. `linkedom` (ya dependencia del repo, ver
 * `test/lib/campos-en-html.ts`) parsea el HTML construido a un DOM real;
 * como no ejecuta `<script>` por sí solo (no es un navegador, es DOM para
 * SSR), `ejecutaPagina()` de abajo saca el texto del script y lo corre a
 * mano con `location`/`history`/`fetch` de mentira, contra ESE DOM — así
 * se puede afirmar sobre el ESTADO resultante (¿el botón quedó visible?),
 * no sobre el código fuente.
 */
import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Entrar from '@/pages/panel/entrar.astro'
import { jergaEn } from '@/servidor/estado'

const container = await AstroContainer.create()

// Los textos que ella puede llegar a ver en esta pantalla, sacados a mano
// del script (no hay ningún `data-campo` acá: es una página fuera del
// sistema de copy, igual que el resto de `src/servidor/**`). Un cambio que
// meta jerga técnica en alguno tiene que hacer caer este test.
const TEXTOS_VISIBLES = [
  'Entrar al panel',
  'Un momento…',
  'Este enlace no funciona. Pide uno nuevo.',
  'Entrando…',
  'Listo, ya entraste.',
  'Ese enlace ya no sirve: pide uno nuevo.',
  // [Revisión final de la rama, I8] Las dos frases nuevas: el 429 y el 503
  // dejaron de aplastarse contra «ya no sirve» — ver el describe del final.
  'Demasiados intentos desde esta conexión. Espera unos minutos y vuelve a darle al botón: tu enlace sigue sirviendo.',
  'No pudimos entrar en este momento. Espera un poco y vuelve a darle al botón: tu enlace sigue sirviendo.',
  'No se pudo conectar. Intenta de nuevo.',
]

/**
 * Un `localStorage` de mentira, con la forma mínima que usa la página. El
 * `almacen` se puede compartir entre dos corridas para simular «el mismo
 * navegador, dos visitas»; `rompe: true` simula modo privado o
 * almacenamiento bloqueado, que es cuando el de verdad TIRA en vez de
 * devolver `null`.
 */
function almacenDeMentira(almacen: Map<string, string> = new Map(), rompe = false) {
  return {
    almacen,
    getItem: (k: string) => {
      if (rompe) throw new Error('almacenamiento bloqueado')
      return almacen.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (rompe) throw new Error('almacenamiento bloqueado')
      almacen.set(k, v)
    },
  }
}

/**
 * Construye la página, la parsea con `linkedom`, y CORRE su script contra
 * un `location`/`history`/`fetch`/`localStorage` de mentira — el
 * comportamiento real, no el texto fuente. `fetchImpl` por defecto nunca se
 * llama (los tests que no hacen clic en el botón no deberían tocar la red).
 */
async function ejecutaPagina(
  url: string,
  fetchImpl: typeof fetch = fetchQueNoSeUsa(),
  localStorage: ReturnType<typeof almacenDeMentira> = almacenDeMentira(),
) {
  const html = await container.renderToString(Entrar)
  const { document, Event: EventDeLinkedom } = parseHTML(html)
  const scriptTexto = [...document.querySelectorAll('script')].map((s) => s.textContent).join('\n')

  const u = new URL(url)
  const location = { search: u.search, pathname: u.pathname }
  const llamadasReplaceState: Array<{ url: string }> = []
  const history = {
    replaceState: (_estado: unknown, _titulo: string, nuevaUrl: string) => {
      llamadasReplaceState.push({ url: nuevaUrl })
      // Lo que hace un `history.replaceState` de verdad: la barra pasa a
      // ser justo lo que se le pasó — si el script leyera el token DESPUÉS
      // de este llamado, acá es donde ya no lo encontraría.
      location.pathname = nuevaUrl
      location.search = ''
    },
  }

  // eslint-disable-next-line no-new-func -- ejecutar el script de la página es el punto del test.
  const ejecutar = new Function('document', 'location', 'history', 'fetch', 'localStorage', scriptTexto)
  ejecutar(document, location, history, fetchImpl, localStorage)

  return { document, location, llamadasReplaceState, Event: EventDeLinkedom }
}

/** Un `fetch` que anota los pedidos y contesta con el status que se le pida. */
function fetchQueContesta(status: number, pedidos: Array<{ url: string; init: RequestInit }> = []) {
  const f = (async (url: string, init: RequestInit) => {
    pedidos.push({ url, init })
    return new Response('{}', { status })
  }) as unknown as typeof fetch
  return { f, pedidos }
}

/** Aprieta el botón y deja correr el microtask del `fetch` antes de mirar el resultado. */
async function apreta(document: Document, Event: typeof globalThis.Event) {
  const boton = document.getElementById('entrar') as unknown as EventTarget
  boton.dispatchEvent(new Event('click'))
  await new Promise((r) => setTimeout(r, 0))
}

function fetchQueNoSeUsa(): typeof fetch {
  return (async () => {
    throw new Error('fetchQueNoSeUsa(): no se esperaba ningún pedido de red en este test.')
  }) as unknown as typeof fetch
}

describe('la página /panel/entrar — HTML construido', () => {
  it('sin candado: no lleva `data-candado` en ningún lado', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).not.toContain('data-candado')
  })

  it('tiene un botón para entrar', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toMatch(/<button[^>]*id="entrar"[^>]*>/)
  })

  it('el botón consume el enlace con POST, nunca GET, contra la acción entrar-con-enlace', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toMatch(/method:\s*['"]POST['"]/)
    expect(html).toContain('accion=entrar-con-enlace')
  })

  it('sin React ni islas: ningún script con `client:`', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).not.toMatch(/client:(load|idle|visible|only|media)/)
  })

  it('[G] tiene su propio meta robots, además de la cabecera de vercel.json', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow"/)
  })

  it('todos los textos que puede ver están en la página, y ninguno usa jerga técnica', async () => {
    const html = await container.renderToString(Entrar)
    for (const texto of TEXTOS_VISIBLES) {
      expect(html, `no se encontró «${texto}» en la página`).toContain(texto)
      expect(jergaEn(texto), texto).toBeNull()
    }
  })
})

describe('la página /panel/entrar — comportamiento real (Ronda 1 de revisión, hallazgo A)', () => {
  it('con un token en la URL, el botón queda VISIBLE y el aviso se oculta', async () => {
    const { document } = await ejecutaPagina('https://x.mx/panel/entrar?token=abc123')
    const boton = document.getElementById('entrar') as unknown as { hidden: boolean }
    const aviso = document.getElementById('aviso') as unknown as { hidden: boolean }
    expect(boton.hidden).toBe(false)
    expect(aviso.hidden).toBe(true)
  })

  it('sin token en la URL, el botón queda oculto y el aviso dice que el enlace no funciona', async () => {
    const { document } = await ejecutaPagina('https://x.mx/panel/entrar')
    const boton = document.getElementById('entrar') as unknown as { hidden: boolean }
    const aviso = document.getElementById('aviso') as unknown as { textContent: string }
    expect(boton.hidden).toBe(true)
    expect(aviso.textContent).toBe('Este enlace no funciona. Pide uno nuevo.')
  })

  it('el token se lee ANTES de que `history.replaceState` reescriba la barra — no al revés', async () => {
    // Es EXACTAMENTE el bug de la Ronda 1: con el orden viejo, para cuando
    // se leía `location.search` ya estaba vacío. Este test falla con el
    // orden viejo y pasa con el nuevo — no mira el código, mira el botón.
    const { document, llamadasReplaceState } = await ejecutaPagina('https://x.mx/panel/entrar?token=el-token')
    expect(llamadasReplaceState).toHaveLength(1)
    expect(llamadasReplaceState[0].url).toBe('/panel/entrar') // sin el token: no vuelve a la barra
    const boton = document.getElementById('entrar') as unknown as { hidden: boolean }
    expect(boton.hidden).toBe(false) // y el botón SÍ vio el token antes de que se borrara
  })

  it('al hacer clic, manda el POST con el token y muestra el resultado', async () => {
    const pedidos: Array<{ url: string; init: RequestInit }> = []
    const fetchDeMentira = (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init })
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const { document, Event: EventDeLinkedom } = await ejecutaPagina('https://x.mx/panel/entrar?token=el-token', fetchDeMentira)
    const boton = document.getElementById('entrar') as unknown as EventTarget & { hidden: boolean }
    const aviso = document.getElementById('aviso') as unknown as { textContent: string }

    boton.dispatchEvent(new EventDeLinkedom('click'))
    // El `fetch` es async: dejar correr el microtask antes de mirar el resultado.
    await new Promise((r) => setTimeout(r, 0))

    expect(pedidos).toHaveLength(1)
    expect(pedidos[0].url).toBe('/api/panel?accion=entrar-con-enlace')
    expect(pedidos[0].init.method).toBe('POST')
    const enviado = JSON.parse(String(pedidos[0].init.body)) as { token: string; dispositivo: string }
    expect(enviado.token).toBe('el-token')
    expect(typeof enviado.dispositivo).toBe('string')
    expect(aviso.textContent).toBe('Listo, ya entraste.')
  })
})

/*
 * [Revisión final de la rama, I7] Toda sesión abierta con enlace nacía con
 * el MISMO id de aparato.
 *
 * La página mandaba solo `{ token }`, así que `idDeDispositivo(undefined)`
 * daba `'sin-nombre'` y eso quedaba FIRMADO en la cookie. Dos consecuencias:
 * revocar `sin-nombre` mataba las sesiones de recuperación de todo el mundo
 * a la vez —la revocación por dispositivo dejaba de ser quirúrgica— y el
 * candado anti-pisada del borrador, que compara aparatos, no tenía nada que
 * comparar entre dos personas que hubieran entrado las dos por enlace.
 */
describe('I7: cada navegador entra con su propio id de aparato', () => {
  it('el pedido lleva un `dispositivo`, y no es «sin-nombre»', async () => {
    const { f, pedidos } = fetchQueContesta(200)
    const { document, Event } = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f)
    await apreta(document, Event)

    const enviado = JSON.parse(String(pedidos[0].init.body)) as { dispositivo?: string }
    expect(enviado.dispositivo).toBeTruthy()
    expect(enviado.dispositivo).not.toBe('sin-nombre')
    // Alfabeto que `idDeDispositivo()` (acciones.ts) deja pasar intacto: si
    // acá se colara una coma, la revocación por lista se partiría en dos.
    expect(enviado.dispositivo).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('DOS navegadores distintos mandan ids DISTINTOS', async () => {
    // Es el punto entero: sin esto, la hermana y la clienta entrando las dos
    // por enlace vuelven a ser el mismo aparato para el servidor.
    const { f: f1, pedidos: p1 } = fetchQueContesta(200)
    const a = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f1, almacenDeMentira())
    await apreta(a.document, a.Event)

    const { f: f2, pedidos: p2 } = fetchQueContesta(200)
    const b = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f2, almacenDeMentira())
    await apreta(b.document, b.Event)

    const id1 = (JSON.parse(String(p1[0].init.body)) as { dispositivo: string }).dispositivo
    const id2 = (JSON.parse(String(p2[0].init.body)) as { dispositivo: string }).dispositivo
    expect(id1).not.toBe(id2)
  })

  it('el MISMO navegador, dos visitas, manda el MISMO id', async () => {
    // La estabilidad es lo que hace que el borrador no se pelee consigo
    // mismo: la autoguardada de la fase 6 tiene que reconocerse.
    const almacen = almacenDeMentira()
    const { f: f1, pedidos: p1 } = fetchQueContesta(200)
    const a = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f1, almacen)
    await apreta(a.document, a.Event)

    const { f: f2, pedidos: p2 } = fetchQueContesta(200)
    const b = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f2, almacen)
    await apreta(b.document, b.Event)

    const id1 = (JSON.parse(String(p1[0].init.body)) as { dispositivo: string }).dispositivo
    const id2 = (JSON.parse(String(p2[0].init.body)) as { dispositivo: string }).dispositivo
    expect(id1).toBe(id2)
  })

  it('con el almacenamiento bloqueado (modo privado) igual manda un id propio, no «sin-nombre»', async () => {
    // Perder la estabilidad es mucho menos grave que volver a compartir un
    // id con todo el mundo: el modo privado no puede reabrir el bug.
    const { f, pedidos } = fetchQueContesta(200)
    const { document, Event } = await ejecutaPagina(
      'https://x.mx/panel/entrar?token=t',
      f,
      almacenDeMentira(new Map(), true),
    )
    await apreta(document, Event)

    const enviado = JSON.parse(String(pedidos[0].init.body)) as { dispositivo: string }
    expect(enviado.dispositivo).toBeTruthy()
    expect(enviado.dispositivo).not.toBe('sin-nombre')
  })
})

/*
 * [Revisión final de la rama, I8] La página traducía 429 y 503 como «este
 * enlace ya no sirve».
 *
 * Escenario medido: ella perdió el teléfono y entra desde la tablet de una
 * vecina. Detrás de ese NAT ya se gastaron los cinco intentos de la ventana,
 * así que el servidor contesta 429. La página le decía que el enlace estaba
 * muerto; ella pedía otro, lo probaba, otro 429, pedía otro… y a los diez
 * pedidos se autobloqueaba la puerta de emergencia por quince minutos, con
 * un enlace perfectamente válido en la mano.
 *
 * El servidor ya distinguía los tres casos con status distintos. La página
 * tiene que distinguirlos también — y sobre todo NO mandarla a pedir otro
 * enlace cuando el que tiene sirve.
 */
describe('I8: los tres fracasos del enlace se cuentan distinto', () => {
  const avisoDe = (document: Document) =>
    (document.getElementById('aviso') as unknown as { textContent: string }).textContent
  const boton = (document: Document) =>
    document.getElementById('entrar') as unknown as { hidden: boolean; disabled: boolean }

  it('429: dice que espere, que el enlace SIGUE sirviendo, y deja el botón usable', async () => {
    const { f } = fetchQueContesta(429)
    const { document, Event } = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f)
    await apreta(document, Event)

    expect(avisoDe(document)).toContain('tu enlace sigue sirviendo')
    // Lo que NO puede decir: es lo que la mandaba a gastar los diez pedidos.
    expect(avisoDe(document)).not.toContain('pide uno nuevo')
    expect(boton(document).hidden).toBe(false)
    expect(boton(document).disabled).toBe(false)
  })

  it('503: tampoco la manda a pedir otro — el problema es nuestro, no del enlace', async () => {
    const { f } = fetchQueContesta(503)
    const { document, Event } = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f)
    await apreta(document, Event)

    expect(avisoDe(document)).toContain('tu enlace sigue sirviendo')
    expect(avisoDe(document)).not.toContain('pide uno nuevo')
    expect(boton(document).disabled).toBe(false)
  })

  it('401: ESE sí está muerto, y ahí sí corresponde pedir otro', async () => {
    const { f } = fetchQueContesta(401)
    const { document, Event } = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f)
    await apreta(document, Event)

    expect(avisoDe(document)).toBe('Ese enlace ya no sirve: pide uno nuevo.')
    expect(boton(document).hidden).toBe(true)
  })

  it('200: entró, y el botón desaparece', async () => {
    const { f } = fetchQueContesta(200)
    const { document, Event } = await ejecutaPagina('https://x.mx/panel/entrar?token=t', f)
    await apreta(document, Event)

    expect(avisoDe(document)).toBe('Listo, ya entraste.')
    expect(boton(document).hidden).toBe(true)
  })
})
