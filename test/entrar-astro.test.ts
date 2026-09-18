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

// Los siete textos que ella puede llegar a ver en esta pantalla, sacados a
// mano del script (no hay ningún `data-campo` acá: es una página fuera del
// sistema de copy, igual que el resto de `src/servidor/**`). Un cambio que
// meta jerga técnica en alguno de los siete tiene que hacer caer este test.
const TEXTOS_VISIBLES = [
  'Entrar al panel',
  'Un momento…',
  'Este enlace no funciona. Pide uno nuevo.',
  'Entrando…',
  'Listo, ya entraste.',
  'Ese enlace ya no sirve: pide uno nuevo.',
  'No se pudo conectar. Intenta de nuevo.',
]

/**
 * Construye la página, la parsea con `linkedom`, y CORRE su script contra
 * un `location`/`history`/`fetch` de mentira — el comportamiento real, no
 * el texto fuente. `fetchImpl` por defecto nunca se llama (los tests que
 * no hacen clic en el botón no deberían tocar la red).
 */
async function ejecutaPagina(url: string, fetchImpl: typeof fetch = fetchQueNoSeUsa()) {
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
  const ejecutar = new Function('document', 'location', 'history', 'fetch', scriptTexto)
  ejecutar(document, location, history, fetchImpl)

  return { document, location, llamadasReplaceState, Event: EventDeLinkedom }
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
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ token: 'el-token' })
    expect(aviso.textContent).toBe('Listo, ya entraste.')
  })
})
