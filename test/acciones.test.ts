/*
 * El router de /api/panel. Es delgado a propósito: valida la sesión, revalida
 * el contenido y delega. Estos tests son los que cubren la compuerta, que es
 * la capa que de verdad decide si algo entra al sitio.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { maneja } from '../src/servidor/acciones'
import { hashDeClave, firmaSesion } from '../src/servidor/sesion'
import { serializa } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { fetchFalso } from './lib/github-falso'
import { marca } from '@/copy/sitio-marca'

// [C-1] 40 caracteres: por encima de LARGO_MIN_SECRETO (32), para que estos
// tests ejerciten el camino normal. El propio candado de C-1 se prueba
// aparte, con secretos deliberadamente cortos o ausentes.
const SECRETO = 'secreto-de-prueba-no-es-el-de-produccion'
const CLAVE = 'una contraseña larga de prueba'

/** Un `fetch` que tira si alguien lo llama: para los caminos que no tienen que tocar GitHub. */
function fetchQueNoSeUsa(): typeof fetch {
  return (async () => {
    throw new Error('fetchQueNoSeUsa(): no se esperaba que esto llamara a fetch.')
  }) as unknown as typeof fetch
}

/** Un `fetch` que cuenta cuántas veces se lo llamó, y devuelve un JSON vacío cada vez. */
function contando(usos: { n: number }): typeof fetch {
  return (async () => {
    usos.n++
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
}

const contextoBase = (fetch: typeof globalThis.fetch) => ({
  env: {
    PANEL_CLAVE_HASH: hashDeClave(CLAVE),
    PANEL_SECRETO: SECRETO,
    PANEL_CORREOS: 'clienta@ejemplo.mx,marcos@ejemplo.mx',
    PANEL_GITHUB_TOKEN: 'token',
    GITHUB_DUENIO: 'd', GITHUB_REPO: 'r',
  },
  fetch,
  ahora: () => Date.now(),
  ip: '1.2.3.4',
})

const cookieValida = (correo = 'clienta@ejemplo.mx') =>
  firmaSesion({ correo, vence: Date.now() + 86_400_000, dispositivo: 'test' }, SECRETO)

describe('entrar', () => {
  it('con la contraseña correcta devuelve una cookie firmada', async () => {
    const r = await maneja('entrar', { cuerpo: { clave: CLAVE, correo: 'clienta@ejemplo.mx' }, cookie: '' }, contextoBase(fetchQueNoSeUsa()))
    expect(r.status).toBe(200)
    expect(r.cookie).toMatch(/HttpOnly/)
  })

  it('con la contraseña equivocada no dice si el correo existe', async () => {
    const r = await maneja('entrar', { cuerpo: { clave: 'mala', correo: 'clienta@ejemplo.mx' }, cookie: '' }, contextoBase(fetchQueNoSeUsa()))
    expect(r.status).toBe(401)
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/correo|usuario|existe/i)
  })

  it('un correo fuera de la lista no entra ni con la contraseña correcta', async () => {
    const r = await maneja('entrar', { cuerpo: { clave: CLAVE, correo: 'ajeno@ejemplo.mx' }, cookie: '' }, contextoBase(fetchQueNoSeUsa()))
    expect(r.status).toBe(401)
  })

  // RULING T6-a: las tres combinaciones que fallan por credenciales —
  // contraseña mala con correo bueno, correo ajeno con contraseña buena,
  // correo ajeno con contraseña mala— tienen que dar la MISMA respuesta,
  // no solo el mismo status. IP propia para no compartir el contador de
  // intentos con los otros tests de este describe.
  it('las tres formas de fallar por credenciales dan la misma respuesta, byte a byte', async () => {
    const ctx = { ...contextoBase(fetchQueNoSeUsa()), ip: '10.10.10.10' }

    const contrasenaMala = await maneja('entrar', { cuerpo: { clave: 'mala', correo: 'clienta@ejemplo.mx' }, cookie: '' }, ctx)
    const correoAjenoConLaBuena = await maneja('entrar', { cuerpo: { clave: CLAVE, correo: 'ajeno@ejemplo.mx' }, cookie: '' }, ctx)
    const correoAjenoConLaMala = await maneja('entrar', { cuerpo: { clave: 'mala', correo: 'ajeno@ejemplo.mx' }, cookie: '' }, ctx)

    for (const r of [contrasenaMala, correoAjenoConLaBuena, correoAjenoConLaMala]) expect(r.status).toBe(401)

    const [a, b, c] = [contrasenaMala, correoAjenoConLaBuena, correoAjenoConLaMala].map((r) => JSON.stringify(r.cuerpo))
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  // RULING T6-a: el freno de intentos es una respuesta DISTINTA del 401
  // de credenciales — 429, y gana incluso cuando el sexto intento manda
  // la contraseña correcta (si no, el 401 de las credenciales enmascara
  // que el freno actuó).
  it('el sexto intento seguido desde la misma IP es 429, aunque la contraseña sea la correcta', async () => {
    const ctx = { ...contextoBase(fetchQueNoSeUsa()), ip: '9.9.9.9' }

    for (let i = 0; i < 5; i++) {
      await maneja('entrar', { cuerpo: { clave: 'mala', correo: 'clienta@ejemplo.mx' }, cookie: '' }, ctx)
    }
    const r = await maneja('entrar', { cuerpo: { clave: CLAVE, correo: 'clienta@ejemplo.mx' }, cookie: '' }, ctx)

    expect(r.status).toBe(429)
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/correo|contraseña|clave|usuario|existe/i)
  })

  // I-3: `correoOk && claveCorrecta(...)` cortaba camino apenas `correoOk`
  // daba falso, así que un correo no listado nunca corría el scrypt caro
  // de `claveCorrecta` — medido en la revisión: ~107 ms con un correo
  // listado contra ~0.03 ms con uno no listado, una diferencia visible
  // desde afuera con un solo pedido cronometrado. El arreglo hace que
  // `claveCorrecta` corra SIEMPRE, contra un hash señuelo cuando el
  // correo no está en la lista.
  //
  // Elegimos medir tiempo (y no espiar la llamada) porque un experimento
  // con `vi.spyOn` sobre `claveCorrecta` importado en `acciones.ts` NO
  // intercepta la llamada bajo este bundler de tests (Vite/Vitest liga el
  // import en el momento de transformar, no por una propiedad del módulo
  // que se pueda parchear) — se comprobó antes de escribir este test. El
  // tiempo es la señal disponible, así que se afirma un PISO absoluto muy
  // por debajo de lo que tarda un scrypt real (~100 ms, ver el comentario
  // de MAXMEM en sesion.ts) pero muy por encima del ~0.03 ms del camino
  // viejo (sin scrypt): más estable en CI que comparar una RAZÓN exacta
  // entre dos mediciones, que la carga de la máquina puede mover.
  it('I-3: claveCorrecta corre —y tarda lo mismo— con un correo listado que con uno que no lo está', async () => {
    const PISO_MS = 15

    const t0 = performance.now()
    await maneja(
      'entrar',
      { cuerpo: { clave: 'una clave mala cualquiera', correo: 'clienta@ejemplo.mx' }, cookie: '' },
      { ...contextoBase(fetchQueNoSeUsa()), ip: `i3-listado-${Math.random()}` },
    )
    const duracionListado = performance.now() - t0

    const t1 = performance.now()
    await maneja(
      'entrar',
      { cuerpo: { clave: 'una clave mala cualquiera', correo: 'nunca-estuvo-en-la-lista@ajeno.mx' }, cookie: '' },
      { ...contextoBase(fetchQueNoSeUsa()), ip: `i3-no-listado-${Math.random()}` },
    )
    const duracionNoListado = performance.now() - t1

    expect(duracionListado).toBeGreaterThan(PISO_MS)
    expect(duracionNoListado).toBeGreaterThan(PISO_MS)
  })
})

describe('publicar', () => {
  it('sin cookie, 401 y sin tocar GitHub', async () => {
    const usos = { n: 0 }
    const r = await maneja('publicar', { cuerpo: { documentos: {} }, cookie: '' }, contextoBase(contando(usos)))
    expect(r.status).toBe(401)
    expect(usos.n).toBe(0)
  })

  // I-4: la cookie dura hasta un año (E3), pero `PANEL_CORREOS` solo se
  // leía en `entrar`. Antes de este fix, sacarle el acceso a alguien no
  // revocaba nada hasta que su cookie venciera sola —o hasta rotar
  // PANEL_SECRETO, que de paso desloguea a todo el mundo—: esta cookie es
  // válida de verdad (firmada con el SECRETO real), para un correo que
  // contextoBase() ya no trae en PANEL_CORREOS (solo clienta@ejemplo.mx y
  // marcos@ejemplo.mx), como si a esa dirección le hubieran quitado el
  // acceso después de que ella ya había entrado.
  it('I-4: una cookie válida deja de servir para publicar en cuanto su correo sale de PANEL_CORREOS', async () => {
    const usos = { n: 0 }
    const cookieDeAccesoRevocado = cookieValida('ex-colaboradora@ejemplo.mx')
    const r = await maneja(
      'publicar',
      { cuerpo: { documentos: {} }, cookie: cookieDeAccesoRevocado },
      contextoBase(contando(usos)),
    )
    expect(r.status).toBe(401)
    expect(usos.n).toBe(0) // ni siquiera llega a tocar GitHub
  })

  it('con contenido inválido, 422 con el campo y sin tocar GitHub', async () => {
    const usos = { n: 0 }
    const roto = JSON.parse(JSON.stringify(marca))
    roto.anaquel.titulo = ''      // texto vacío: el esquema lo rechaza
    const r = await maneja('publicar', { cuerpo: { documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(contando(usos)))
    expect(r.status).toBe(422)
    expect(usos.n).toBe(0)
    expect((r.cuerpo as { campo?: string }).campo).toContain('anaquel.titulo')
  })

  it('el mensaje de un contenido inválido no habla como una computadora', async () => {
    const roto = JSON.parse(JSON.stringify(marca))
    roto.anaquel.titulo = ''
    const r = await maneja('publicar', { cuerpo: { documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
    const texto = String((r.cuerpo as { problema: string }).problema)
    expect(texto).not.toMatch(/zod|schema|422|undefined|parse/i)
  })

  it('un documento que no existe se rechaza antes de mirar su contenido', async () => {
    const r = await maneja('publicar', { cuerpo: { documentos: { inventado: {} } }, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
    expect(r.status).toBe(422)
  })

  // RULING T6-d — de la revisión: con sesión válida, un lote sin ningún
  // documento adentro no puede llegar a tocar GitHub (ids.length === 0 se
  // decide antes de armar el cliente de GitHub).
  it('con sesión válida y sin documentos, 400 y sin tocar GitHub', async () => {
    const r = await maneja('publicar', { cuerpo: { documentos: {} }, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
    expect(r.status).toBe(400)
  })

  // RULING T6-d — el bug de fondo: «lo actual» tiene que salir de GitHub,
  // no de la foto que quedó congelada en el bundle. Estos cuatro tests lo
  // fijan con un GitHub de mentira (`fetchFalso`, la misma ayudante de
  // `test/github.test.ts` y `test/publicar.test.ts`).
  describe('contra el contenido vivo, no contra el que quedó en el paquete (RULING T6-d)', () => {
    it('deshacer: si lo vivo ya cambió, publica lo que mandó aunque sea igual a la vieja foto del bundle', async () => {
      // "enviado" es lo que la clienta manda: A, la misma foto que un
      // `import` estático habría congelado en el paquete. "vivo" es lo
      // que GitHub tiene AHORA: B, distinto — como si alguien hubiera
      // publicado un cambio después del último `pnpm bundle:api`.
      const enviado = JSON.parse(JSON.stringify(marca))
      const vivo = JSON.parse(JSON.stringify(marca))
      vivo.anaquel.titulo = 'Un título que ya cambió en vivo'
      const textoEnviado = serializa(esquemaSitio, enviado)
      const textoVivo = serializa(esquemaSitio, vivo)
      expect(textoEnviado).not.toBe(textoVivo) // guardia: si esto fallara, el test no prueba nada

      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (router, base del lote)
        { cuerpo: { content: Buffer.from(textoVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef (router, lo vivo)
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-nuevo' } }, // creaBlob
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja('publicar', { cuerpo: { documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(200)
      expect((r.cuerpo as { ok: boolean; sha: string | null }).ok).toBe(true)
      expect((r.cuerpo as { sha: string | null }).sha).toBe('commit-nuevo')
      // El commit lleva el archivo con los bytes que la clienta mandó.
      const blob = pedidos.find((p) => p.metodo === 'POST' && (p.cuerpo as { encoding?: string })?.encoding === 'base64')
      expect(blob?.cuerpo).toEqual({ content: Buffer.from(textoEnviado).toString('base64'), encoding: 'base64' })
    })

    it('bytes idénticos a lo vivo: no publica nada, cero pedidos de escritura, y avisa que no cambió nada', async () => {
      const enviado = JSON.parse(JSON.stringify(marca))
      const textoEnviado = serializa(esquemaSitio, enviado)

      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref
        { cuerpo: { content: Buffer.from(textoEnviado).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef: igual a lo enviado
      ])

      const r = await maneja('publicar', { cuerpo: { documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(200)
      const cuerpo = r.cuerpo as { ok: boolean; sha: string | null; resumen: string }
      expect(cuerpo.ok).toBe(true)
      expect(cuerpo.sha).toBeNull()
      expect(cuerpo.resumen).toMatch(/no había nada que publicar/i)
      expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
    })

    it('si GitHub no contesta al leer lo vivo, no publica nada y nunca dice que salió bien', async () => {
      const enviado = JSON.parse(JSON.stringify(marca))

      const { f, pedidos } = fetchFalso([{ status: 500, cuerpo: { message: 'ups, caído' } }]) // gh.ref falla

      const r = await maneja('publicar', { cuerpo: { documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(502)
      const cuerpo = r.cuerpo as { ok: boolean; problema: string }
      expect(cuerpo.ok).toBe(false)
      expect(cuerpo.problema).toMatch(/prueba de nuevo|intenta/i)
      expect(cuerpo.problema).not.toMatch(/500|ups|fetch|github/i)
      expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
    })
  })
})

describe('salud', () => {
  it('dice qué falta sin filtrar el valor de nada', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    delete (ctx.env as Record<string, string>).PANEL_GITHUB_TOKEN
    const r = await maneja('salud', { cuerpo: {}, cookie: cookieValida() }, ctx)
    const texto = JSON.stringify(r.cuerpo)
    expect(texto).toContain('PANEL_GITHUB_TOKEN')
    expect(texto).not.toContain('token')
    expect(texto).not.toContain(SECRETO)
  })

  // I-6: `salud` sin sesión y sin freno era un amplificador — cualquiera
  // podía hacerle disparar un pedido AUTENTICADO de verdad a GitHub en
  // cada `curl`, gastando la misma cuota horaria del PAT que necesita
  // `publicar`. Estos dos tests prueban las DOS mitades del arreglo.
  it('I-6: con el freno de esa IP ya gastado, no toca GitHub y avisa que la conexión no se revisó', async () => {
    const usos = { n: 0 }
    const ctx = { ...contextoBase(contando(usos)), ip: `i6-salud-freno-${Math.random()}` }

    for (let i = 0; i < 5; i++) await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)
    expect(usos.n).toBe(5) // los cinco primeros sí tocaron GitHub

    const r = await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)

    expect(usos.n).toBe(5) // el sexto no gastó un pedido más del PAT
    expect(r.status).toBe(200)
    const cuerpo = r.cuerpo as { ok: boolean; faltan: string[]; github: boolean | null; problema?: string }
    expect(cuerpo.ok).toBe(true)
    expect(cuerpo.faltan).toEqual([])
    expect(cuerpo.github).toBeNull()
    expect(cuerpo.problema).toMatch(/no revisamos la conexión/i)
  })

  it('I-6: la mitad de variables sigue abierta y anónima aunque el freno de esa IP ya esté gastado', async () => {
    const ip = `i6-salud-vars-${Math.random()}`
    // Gasta el freno con intentos de "entrar" fallidos, desde la MISMA IP
    // — el freno es compartido por IP, no por acción.
    for (let i = 0; i < 5; i++) {
      await maneja('entrar', { cuerpo: { clave: 'mala', correo: 'clienta@ejemplo.mx' }, cookie: '' }, { ...contextoBase(fetchQueNoSeUsa()), ip })
    }

    const ctx = { ...contextoBase(fetchQueNoSeUsa()), ip }
    delete (ctx.env as Record<string, string | undefined>).GITHUB_REPO
    // fetchQueNoSeUsa() tiraría si esto llegara a intentar tocar GitHub:
    // con una variable faltante, `salud` tiene que contestar ANTES de
    // mirar el freno.
    const r = await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)

    expect(r.status).toBe(503)
    expect((r.cuerpo as { faltan: string[] }).faltan).toContain('GITHUB_REPO')
  })
})

// C-1: hoy, en producción, el token de GitHub está cargado y
// PANEL_SECRETO no — la reviewer lo demostró forjando su propia cookie
// firmada con la clave vacía que `contexto.env.PANEL_SECRETO ?? ''`
// producía. Estos tests fijan que la ausencia (o un secreto demasiado
// corto) falla CERRADO: 503 franco, nunca el 401 de credenciales (que
// culparía a la contraseña de la clienta) ni el 500 genérico del
// catch-all de `maneja()` (que no le avisa a Marcos cuál variable falta).
describe('C-1: PANEL_SECRETO ausente o corto falla cerrado, nunca abierto', () => {
  it('entrar: 503 si PANEL_SECRETO falta', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    delete (ctx.env as Record<string, string | undefined>).PANEL_SECRETO
    const r = await maneja(
      'entrar',
      { cuerpo: { clave: CLAVE, correo: 'clienta@ejemplo.mx' }, cookie: '' },
      { ...ctx, ip: `c1-entrar-ausente-${Math.random()}` },
    )
    expect(r.status).toBe(503)
    expect(r.cookie).toBeUndefined()
  })

  it('entrar: 503 si PANEL_SECRETO mide menos de 32 caracteres', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_SECRETO = 'corto'
    const r = await maneja(
      'entrar',
      { cuerpo: { clave: CLAVE, correo: 'clienta@ejemplo.mx' }, cookie: '' },
      { ...ctx, ip: `c1-entrar-corto-${Math.random()}` },
    )
    expect(r.status).toBe(503)
    expect(r.cookie).toBeUndefined()
  })

  it('publicar: 503 si PANEL_SECRETO falta — el ataque de verdad: una cookie forjada a mano con la clave vacía ya no pasa', async () => {
    // Forjada exactamente como lo haría alguien que sabe que
    // `PANEL_SECRETO` falta: firmar con la clave vacía, la MISMA que
    // `verificaSesion` usaría si el código todavía hiciera `?? ''`. Antes
    // de este fix, esta cookie pasaba `verificaSesion` sin problema.
    const cuerpoCookie = Buffer.from(
      JSON.stringify({ correo: 'atacante@ajeno.mx', vence: Date.now() + 365 * 86_400_000, dispositivo: 'x' }),
    ).toString('base64url')
    const firmaConClaveVacia = createHmac('sha256', '').update(cuerpoCookie).digest('base64url')
    const cookieForjada = `${cuerpoCookie}.${firmaConClaveVacia}`

    const usos = { n: 0 }
    const ctx = contextoBase(contando(usos))
    delete (ctx.env as Record<string, string | undefined>).PANEL_SECRETO

    const r = await maneja('publicar', { cuerpo: { documentos: {} }, cookie: cookieForjada }, ctx)

    expect(r.status).toBe(503)
    expect(usos.n).toBe(0) // ni siquiera llega a tocar GitHub
  })

  it('salud: sigue funcionando cuando PANEL_SECRETO falta — es el día en que más hace falta que conteste', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    delete (ctx.env as Record<string, string | undefined>).PANEL_SECRETO
    const r = await maneja('salud', { cuerpo: {}, cookie: '' }, { ...ctx, ip: `c1-salud-${Math.random()}` })
    expect(r.status).toBe(503)
    expect((r.cuerpo as { faltan: string[] }).faltan).toContain('PANEL_SECRETO')
  })
})

describe('las acciones que todavía no existen', () => {
  it('devuelven 404, no 500', async () => {
    for (const accion of ['borrador', 'historial', 'revertir', 'estado']) {
      const r = await maneja(accion, { cuerpo: {}, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
      expect(r.status).toBe(404)
    }
  })
})
