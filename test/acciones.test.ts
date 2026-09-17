/*
 * El router de /api/panel. Es delgado a propósito: valida la sesión, revalida
 * el contenido y delega. Estos tests son los que cubren la compuerta, que es
 * la capa que de verdad decide si algo entra al sitio.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { maneja, idDeDispositivo } from '../src/servidor/acciones'
import { hashDeClave, firmaSesion } from '../src/servidor/sesion'
import { cliente } from '../src/servidor/github'
import { publica } from '../src/servidor/publicar'
import { serializa } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { TOPE_CUERPO } from '../src/servidor/rutas-permitidas'
import { fetchFalso } from './lib/github-falso'
import { marca } from '@/copy/sitio-marca'

// El JSON tal cual vive en el repo, SIN pasar por la fachada: es
// exactamente lo que `scripts/humo-panel.sh` publica de verdad (lee el
// archivo vivo, le cambia `footer.derechos` y manda el documento entero) y
// exactamente lo que NO tiene ninguno de los cinco campos derivados —
// `serializa()` nunca los escribe (carga.ts:390-395; ver derivados.ts). Un
// router que valide esto tal cual llega, sin injertarlos antes, rechaza
// CUALQUIER publicación real con «el campo quedó vacío».
const sitioCrudoDeDisco = () => JSON.parse(readFileSync('src/contenido/datos/sitio.json', 'utf8'))

// Lo mismo para `sabores`: la fuente de la que `sitio` saca sus cinco
// derivados. `sabores` no tiene NINGÚN campo derivado propio (esquema
// sabores.ts — ningún `derivado`/`derivadoTexto`), así que su versión
// «vivo» es sencillamente el archivo del repo, serializado. Una función y
// no una constante: los tests que arman un lote con `sabores` editado
// necesitan su PROPIA copia para mutar, no la que ya usó otro test.
const saboresCrudoDeDisco = () => JSON.parse(readFileSync('src/contenido/datos/sabores.json', 'utf8'))
const textoSaboresVivo = serializa(esquemaSabores, saboresCrudoDeDisco())

/**
 * Las dos respuestas que el router necesita para calcular los derivados de
 * `sitio` cuando el lote no trae `sabores`: el sha base del lote y lo vivo
 * de `sabores` en ese sha. Un helper porque de acá en más CASI todo test
 * de `publicar` que mande `sitio` sin `sabores` las necesita — repetirlas
 * a mano en cada test es la clase de copia que se desincroniza sola.
 */
const respuestasFuentesDeSitio = (sha = 'main-1') => [
  { cuerpo: { object: { sha } } }, // gh.ref (router: sha base del lote, y fuente de los derivados de sitio)
  { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef: lo vivo de sabores
]

/**
 * Las siete respuestas que hacen falta para que la Fase 2 TERMINE de
 * publicar un solo documento, una vez que el chequeo de la base ya pasó:
 * leer lo vivo de ese documento, y las seis de siempre de `publica()` (ref,
 * commit padre, blob, árbol, commit, mover el ref). `vivo` por defecto es
 * `textoSaboresVivo` —el archivo de disco, sin editar— así que un lote que
 * mande `sabores` con algo cambiado sí encuentra una diferencia y escribe.
 */
const respuestasDeUnaPublicacionCompleta = (vivo = textoSaboresVivo) => [
  { cuerpo: { content: Buffer.from(vivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef: lo vivo del documento
  { cuerpo: { object: { sha: 'main-2' } } },                            // gh.ref (dentro de publica())
  { cuerpo: { sha: 'commit-viejo2', tree: { sha: 'arbol-viejo2' } } },  // gh.commit
  { cuerpo: { sha: 'blob-nuevo2' } },                                    // creaBlob
  { cuerpo: { sha: 'arbol-nuevo2' } },                                   // creaArbol
  { cuerpo: { sha: 'commit-nuevo2' } },                                  // creaCommit
  { cuerpo: {} },                                                        // mueveRef
]

/**
 * Un `sabores` válido, pero con un precio distinto del que vive hoy en el
 * repo: sirve para forzar que la Fase 2 encuentre una diferencia real
 * contra `textoSaboresVivo` y escriba de verdad, en vez de tomar el atajo
 * de «bytes idénticos, no hay nada que publicar».
 */
const saboresConUnPrecioDistinto = () => {
  const doc = saboresCrudoDeDisco()
  doc.sabores[0].precio = doc.sabores[0].precio + 1
  return doc
}

/**
 * Dos intentos completos cuyo `PATCH` final falla con 422 «not a fast
 * forward» las dos veces — lo que hace que `publica()` agote su reintento
 * (ver publicar.ts) y devuelva el 409 de PROBLEMA_PISARIA. La usa el test
 * del Paso 8b para comparar esa frase contra la que arma el router.
 */
const respuestasDeDosChoquesDeRef = () => {
  const choque = { status: 422, cuerpo: { message: 'Update is not a fast forward' } }
  return [
    { cuerpo: { object: { sha: 'm' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
    { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } }, choque,
    { cuerpo: { object: { sha: 'm2' } } }, { cuerpo: { sha: 'c3', tree: { sha: 'a3' } } },
    { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a4' } }, { cuerpo: { sha: 'c4' } }, choque,
  ]
}

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
    // Tarea 5: séptima variable de VARIABLES_REQUERIDAS. Ningún test de
    // este archivo ejercita `clienteVercel` (eso lo cubre
    // test/vercel-servidor.test.ts, con `fetchFalso`) — está acá solo para
    // que `salud` siga viendo las siete completas, como ya hacía con las
    // seis antes de esta tarea.
    PANEL_VERCEL_TOKEN: 'token-vercel-de-prueba',
  },
  fetch,
  ahora: () => Date.now(),
  ip: '1.2.3.4',
  // [RULING T1-1] Sin `bytesDelCuerpo`, a propósito: queda `undefined`, que
  // es justo lo que arma el borde cuando el pedido no trae `Content-Length`
  // legible — nunca un `0`, que confundiría «no lo sé» con «midió cero» y
  // desactivaría el tope de cuerpo en `publica()` (ver el test M-9 más
  // abajo, que prueba exactamente ese camino).
  //
  // Tarea 6: ninguna acción de este router llama todavía a `correo()` — el
  // aviso lo dispara una tarea posterior. Acá alcanza con un stub que nunca
  // se ejercita; el comportamiento real de `manda()` (sin red, degradando
  // sin tirar) lo prueba `test/correo.test.ts`.
  correo: async () => ({ ok: true as const }),
})

const cookieValida = (correo = 'clienta@ejemplo.mx') =>
  firmaSesion({ correo, vence: Date.now() + 86_400_000, dispositivo: 'test', emitida: Date.now() }, SECRETO)

/** Una cookie válida cuya `emitida` es la fecha (ISO 8601) que se le pase, para ejercitar `PANEL_SESIONES_DESDE`. */
const cookieEmitidaEn = (fecha: string, correo = 'clienta@ejemplo.mx') =>
  firmaSesion({ correo, vence: Date.now() + 86_400_000, dispositivo: 'test', emitida: Date.parse(fecha) }, SECRETO)

/** Una cookie válida firmada desde el `dispositivo` que se le pase, para ejercitar `PANEL_DISPOSITIVOS_REVOCADOS`. */
const cookieDeDispositivo = (dispositivo: string, correo = 'clienta@ejemplo.mx') =>
  firmaSesion({ correo, vence: Date.now() + 86_400_000, dispositivo, emitida: Date.now() }, SECRETO)

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

  // `sitio` no puede validarse sin sus cinco derivados injertados (ver
  // derivados.ts), y como este lote no manda `sabores`, el router tiene
  // que leerlo vivo de GitHub para calcularlos ANTES de poder decidir que
  // el problema de verdad es `anaquel.titulo` — así que esto SÍ toca
  // GitHub (dos lecturas: el sha base y lo vivo de sabores), lo que no
  // hace es ESCRIBIR nada.
  it('con contenido inválido, 422 con el campo y sin escribir nada en GitHub', async () => {
    const roto = JSON.parse(JSON.stringify(marca))
    roto.anaquel.titulo = ''      // texto vacío: el esquema lo rechaza
    const { f, pedidos } = fetchFalso(respuestasFuentesDeSitio())
    const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(422)
    expect((r.cuerpo as { campo?: string }).campo).toContain('anaquel.titulo')
    expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
  })

  it('el mensaje de un contenido inválido no habla como una computadora', async () => {
    const roto = JSON.parse(JSON.stringify(marca))
    roto.anaquel.titulo = ''
    const { f } = fetchFalso(respuestasFuentesDeSitio())
    const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(f))
    const texto = String((r.cuerpo as { problema: string }).problema)
    expect(texto).not.toMatch(/zod|schema|422|undefined|parse/i)
  })

  it('un documento que no existe se rechaza antes de mirar su contenido', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'main-1', documentos: { inventado: {} } }, cookie: cookieValida() },
      contextoBase(fetchQueNoSeUsa()),
    )
    expect(r.status).toBe(422)
  })

  // `injerta()` tira cuando al documento le falta un CONTENEDOR entero
  // (`gotas`, no solo `gotas.precioDesde`): ahí no sabe dónde escribir el
  // derivado. Eso no puede escapar como un 500 genérico — Zod sabe decir
  // exactamente qué falta, igual que con cualquier otro campo ausente.
  it('un documento de sitio al que le falta un bloque entero da 422, nunca un 500', async () => {
    const sinGotas = JSON.parse(JSON.stringify(marca))
    delete sinGotas.gotas
    const { f, pedidos } = fetchFalso(respuestasFuentesDeSitio())
    const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: sinGotas } }, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(422)
    expect((r.cuerpo as { campo?: string }).campo).toContain('gotas')
    expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
  })

  // RULING T6-d — de la revisión: con sesión válida, un lote sin ningún
  // documento adentro no puede llegar a tocar GitHub (ids.length === 0 se
  // decide antes de armar el cliente de GitHub).
  it('con sesión válida y sin documentos, 400 y sin tocar GitHub', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'main-1', documentos: {} }, cookie: cookieValida() },
      contextoBase(fetchQueNoSeUsa()),
    )
    expect(r.status).toBe(400)
  })

  // [RULING T1-1] El test que faltaba: los dos de `publicar.test.ts`
  // prueban el tope con un número explícito y con el campo ausente, pero
  // ninguno prueba el camino REAL de «no se pudo medir» a través del
  // router entero. Acá el pedido no trae `Content-Length` —`contextoBase()`
  // no pone `bytesDelCuerpo`, así que llega `undefined`, tal cual lo arma
  // el borde cuando la cabecera no vino—, así que `publica()` tiene que
  // caerse a la suma de los archivos y frenar igual. Con el `0` centinela
  // del bug original esto pasaba de largo: `0 ?? suma(...)` se quedaba con
  // el `0`, y el lote se iba a la red sin que nada lo frenara.
  //
  // Para que el lote pese de verdad más de `TOPE_CUERPO` sin dejar de ser
  // un documento válido —hoy ningún JSON real pasa de 24 KB, así que
  // inflar un campo con tope de caracteres no alcanza, ver el comentario
  // de «techo de cordura» en sabores.ts— se aprovecha que `catalogo` es
  // una URL sin tope de longitud (`z.url()`, campos.ts): una sola query
  // string larga alcanza para pasar el tope sin tocar ningún otro campo.
  //
  // Ojo con lo que este test NO prueba: acá el `Contexto` se arma a mano
  // (`contextoBase()`), así que `bytesDelCuerpo` llega `undefined` porque
  // el test lo dejó afuera, no porque el borde haya medido un
  // `Content-Length` ausente de verdad. Esto cubre el camino del ROUTER
  // —que un lote enorme rebota con 422 antes de escribir—; quien guarda el
  // fix de fondo del BORDE (que el `Content-Length` ilegible de verdad
  // produzca ese mismo `undefined`) es el M-9 de `test/panel-entrada.test.ts`.
  it('M-9: sin Content-Length medible, el lote enorme rebota igual — el fallback se dispara de verdad', async () => {
    const saboresEnorme = saboresCrudoDeDisco()
    saboresEnorme.sabores[0].catalogo = 'https://catalogo.maracacao.mx/?x=' + 'a'.repeat(3_000_000)
    const textoEnorme = serializa(esquemaSabores, saboresEnorme)
    expect(Buffer.from(textoEnorme, 'utf8').toString('base64').length).toBeGreaterThan(TOPE_CUERPO) // guardia

    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (Fase 2: el sha base del lote)
      { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): lo vivo, para el diff
    ])

    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'main-1', documentos: { sabores: saboresEnorme } }, cookie: cookieValida() },
      contextoBase(f),
    )

    expect(r.status).toBe(422)
    expect((r.cuerpo as { problema: string }).problema).toContain('demasiado contenido')
    // Los dos pedidos de arriba son de LECTURA (hacen falta para saber si
    // el documento cambió antes de decidir si hay algo que publicar); el
    // tope frena adentro de `publica()` ANTES de que esta escriba nada —
    // ni un blob, ni un árbol, ni un commit.
    expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
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
        ...respuestasFuentesDeSitio(), // gh.ref (router, base del lote — también sirve de fuente de derivados) + gh.archivoEnRef(sabores)
        { cuerpo: { content: Buffer.from(textoVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef (router, lo vivo de sitio)
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-nuevo' } }, // creaBlob
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

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
        ...respuestasFuentesDeSitio(), // gh.ref (base + fuente de derivados) + gh.archivoEnRef(sabores)
        { cuerpo: { content: Buffer.from(textoEnviado).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef(sitio): igual a lo enviado
      ])

      const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

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

      const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(502)
      const cuerpo = r.cuerpo as { ok: boolean; problema: string }
      expect(cuerpo.ok).toBe(false)
      expect(cuerpo.problema).toMatch(/prueba de nuevo|intenta/i)
      expect(cuerpo.problema).not.toMatch(/500|ups|fetch|github/i)
      expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
    })
  })

  // El humo de producción (`scripts/humo-panel.sh`) publicó el documento
  // TAL CUAL lo trae el repo —sin pasar por la fachada, que es la única
  // que hoy injerta los derivados— y el router lo rechazó con «el campo
  // quedó vacío» sobre `anaquel.contadorDe`: NINGUNA publicación real
  // podía pasar nunca. Este describe reproduce EXACTAMENTE ese camino.
  describe('publicar el documento tal cual está en el repo (el bug que encontró el humo)', () => {
    it('un documento crudo, leído de disco y con un campo editado, se publica — no rebota por los derivados que le faltan', async () => {
      const crudo = sitioCrudoDeDisco()
      // El mismo campo, y el mismo tipo de edición, que
      // `scripts/humo-panel.sh` prueba en producción (paso 4a).
      crudo.footer.derechos = 'Prueba del humo — arreglo de derivados'
      // Ninguno de los cinco derivados está en el archivo: serializa() los
      // omite siempre (carga.ts:390-395). Si esto no fuera cierto, el
      // resto del test no probaría nada.
      expect(crudo.anaquel.contadorDe).toBeUndefined()
      expect(crudo.gotas.precioDesde).toBeUndefined()

      const { f, pedidos } = fetchFalso([
        ...respuestasFuentesDeSitio(), // fuentes de los derivados: sabores no viene en el lote
        { cuerpo: { content: Buffer.from(serializa(esquemaSitio, marca)).toString('base64'), encoding: 'base64' } }, // lo vivo de sitio
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-nuevo' } }, // creaBlob
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: crudo } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(200)
      const cuerpo = r.cuerpo as { ok: boolean; sha: string | null }
      expect(cuerpo.ok).toBe(true)
      expect(cuerpo.sha).toBe('commit-nuevo')
      // Y esa lectura de `sabores` fue de VERDAD, no salteada: si la Fase
      // 1b tuviera las dos ramas cambiadas —tratar «`sabores` no vino en
      // el lote» como si hubiera venido— habría llamado
      // `fuentesDeSabores(documentos.sabores)` con `undefined`, sin tocar
      // GitHub, y `injerta()` hubiera reventado en `precioDesde([])` mucho
      // antes de llegar a un 200.
      expect(pedidos.filter((p) => p.metodo === 'GET' && p.url.includes('sabores'))).toHaveLength(1)
      // Y lo que se escribió tampoco lleva los derivados: siguen sin
      // pertenecer al archivo, injertados o no (serializa() los omite
      // siempre — ver el test de bytes idénticos más abajo).
      const blob = pedidos.find((p) => p.metodo === 'POST' && (p.cuerpo as { encoding?: string })?.encoding === 'base64')
      const escrito = Buffer.from((blob?.cuerpo as { content: string }).content, 'base64').toString('utf8')
      expect(JSON.parse(escrito).anaquel.contadorDe).toBeUndefined()
    })

    // La prueba directa de la regla 3: los bytes que se escriben no
    // dependen de si el documento que llegó traía los derivados
    // injertados o no — `injerta()` overwrites, así que el mismo campo
    // editado sobre las DOS formas de entrada (el archivo crudo, y lo que
    // va a tener en memoria el panel de la fase 6, que sí los trae) tiene
    // que producir el MISMO commit.
    it('el mismo documento, con o sin los derivados ya injertados, publica bytes idénticos', async () => {
      const crudo = sitioCrudoDeDisco()
      crudo.footer.derechos = 'Prueba del humo — arreglo de derivados'

      const yaInjertado = JSON.parse(JSON.stringify(marca))
      yaInjertado.footer.derechos = 'Prueba del humo — arreglo de derivados'
      // Deliberadamente con un valor DISTINTO del que calcularía injerta():
      // si el router escribiera lo que injertó en vez de descartarlo, este
      // valor absurdo terminaría en el archivo.
      yaInjertado.anaquel.contadorDe = 'de 999'

      const contextoParaOtroLote = () => {
        const { f, pedidos } = fetchFalso([
          ...respuestasFuentesDeSitio(),
          { cuerpo: { content: Buffer.from(serializa(esquemaSitio, marca)).toString('base64'), encoding: 'base64' } },
          { cuerpo: { object: { sha: 'main-1' } } },
          { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } },
          { cuerpo: { sha: 'blob-nuevo' } },
          { cuerpo: { sha: 'arbol-nuevo' } },
          { cuerpo: { sha: 'commit-nuevo' } },
          { cuerpo: {} },
        ])
        return { ctx: contextoBase(f), pedidos }
      }

      const a = contextoParaOtroLote()
      const rCrudo = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: crudo } }, cookie: cookieValida() }, a.ctx)

      const b = contextoParaOtroLote()
      const rInjertado = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: yaInjertado } }, cookie: cookieValida() }, b.ctx)

      expect(rCrudo.status).toBe(200)
      expect(rInjertado.status).toBe(200)

      const blobDe = (pedidos: typeof a.pedidos) => {
        const blob = pedidos.find((p) => p.metodo === 'POST' && (p.cuerpo as { encoding?: string })?.encoding === 'base64')
        return (blob?.cuerpo as { content: string }).content
      }
      expect(blobDe(a.pedidos)).toBe(blobDe(b.pedidos))
    })
  })

  // El punto 2 de la tarea: de dónde salen las fuentes de los derivados de
  // `sitio` cuando el lote también trae `sabores`. Ningún test de arriba
  // manda los dos documentos juntos — todos mandan `sitio` solo — así que
  // ninguno ejercita la rama `fuentesDeSabores(documentos.sabores)` de
  // `acciones.ts`; solo la rama de lo vivo. Estos tests cubren esa rama y
  // su espejo.
  //
  // Nota sobre el mecanismo: ninguno de los cinco campos derivados tiene
  // un chequeo de VALOR exacto en el esquema —`derivado()` es
  // `z.int().min(1).max(99_999)`, `derivadoTexto()` es
  // `z.string().trim().max(maxCaracteres)` (campos.ts:490-509)— así que un
  // texto que «dijera 16» en vez de «15» no lo rechaza ningún esquema: la
  // única gravedad que compara un texto contra una cantidad es
  // `avisosDeConteo()` (validacion.ts), que da `gravedad: 'avisa'` y que
  // el router NUNCA calcula (usa `validarContra`, no `validar` — ver el
  // docstring de `publicarAccion`). El punto donde `sitio` SÍ depende de
  // el CONTENIDO real de `sabores`, no solo de su tipo, es
  // `gotas.precioJengibre`: `precioDe(f.gotas, 'jengibreYNaranja')`
  // (derivados.ts:62) tira si esa bolsa no está en la lista que se le
  // pasó. Eso es lo que estos dos tests usan para demostrar, de forma
  // determinística, CUÁL de las dos fuentes usó el router — con las
  // dos posibles fuentes con un contenido que un bug de rama cambiada
  // ("swapped branch") no podría producir por accidente.
  describe('de dónde salen las fuentes de los derivados cuando el lote trae sabores (punto 2 de la tarea)', () => {
    it('sitio y sabores en el mismo lote: sitio se valida y se escribe contra los sabores DEL LOTE — nunca se lee nada vivo de sabores', async () => {
      const saboresConUnoNuevo = saboresCrudoDeDisco()
      const nuevo = JSON.parse(JSON.stringify(saboresConUnoNuevo.sabores[0]))
      nuevo.orden = 16
      nuevo.slug = 'sabor-prueba-16'
      nuevo.nombre = 'Sabor de prueba n.º 16'
      saboresConUnoNuevo.sabores.push(nuevo)
      const textoSaboresConNuevo = serializa(esquemaSabores, saboresConUnoNuevo)
      expect(textoSaboresConNuevo).not.toBe(textoSaboresVivo) // guardia

      const sitioConCambio = JSON.parse(JSON.stringify(marca))
      sitioConCambio.footer.derechos = 'Ahora somos 16 sabores'
      const textoSitioConCambio = serializa(esquemaSitio, sitioConCambio)
      const textoSitioVivo = serializa(esquemaSitio, marca)
      expect(textoSitioConCambio).not.toBe(textoSitioVivo) // guardia

      // Ni una respuesta de más que las que hacen falta para ESCRIBIR los
      // dos documentos: si el router leyera `sabores` vivo además de
      // usar el del lote, pediría una respuesta de más que las 10
      // programadas y `fetchFalso` lo denuncia (M-11).
      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (Fase 2 — la Fase 1b no tocó GitHub: sabores vino en el lote)
        { cuerpo: { content: Buffer.from(textoSitioVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sitio)
        { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): 15, distinto del lote
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-a' } }, // creaBlob (uno de los dos archivos; el orden de llegada no importa)
        { cuerpo: { sha: 'blob-b' } }, // creaBlob (el otro)
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja(
        'publicar',
        { cuerpo: { base: 'main-1', documentos: { sitio: sitioConCambio, sabores: saboresConUnoNuevo } }, cookie: cookieValida() },
        contextoBase(f),
      )

      expect(r.status).toBe(200)
      expect((r.cuerpo as { ok: boolean; sha: string | null }).sha).toBe('commit-nuevo')

      const blobsEscritos = pedidos.filter(
        (p) => p.metodo === 'POST' && (p.cuerpo as { encoding?: string })?.encoding === 'base64',
      )
      expect(blobsEscritos).toHaveLength(2)
      const textos = blobsEscritos.map((b) => Buffer.from((b.cuerpo as { content: string }).content, 'base64').toString('utf8'))
      const escritoSabores = textos.find((t) => t.includes('Sabor de prueba n.º 16'))
      expect(escritoSabores).toBeDefined()
      expect(JSON.parse(escritoSabores as string).sabores).toHaveLength(16)
    })

    it('al sabores del lote le falta lo que sitio necesita: se valida contra ESO (422), no contra lo vivo, que sí lo tiene', async () => {
      const saboresSinJengibre = saboresCrudoDeDisco()
      saboresSinJengibre.gotas = saboresSinJengibre.gotas.filter((g: { clave: string }) => g.clave !== 'jengibreYNaranja')
      const crudo = sitioCrudoDeDisco() // sin ningún derivado: si injerta() no corre, no hay «de dónde» sacarlos

      // CERO respuestas programadas: si esto llegara a tocar GitHub —el
      // «swapped branch» que este test existe para atrapar, usando lo
      // vivo en vez del lote— `fetchFalso` tira por pedir una respuesta
      // que no programó, y el 502 de «no pudimos leer» delata el bug
      // (en vez del 422 que sigue).
      const { f, pedidos } = fetchFalso([])

      const r = await maneja(
        'publicar',
        { cuerpo: { base: 'main-1', documentos: { sitio: crudo, sabores: saboresSinJengibre } }, cookie: cookieValida() },
        contextoBase(f),
      )

      expect(pedidos).toHaveLength(0)
      expect(r.status).toBe(422)
      // `anaquel.contadorDe` es el primer derivado que el esquema declara
      // (cabecera.ts → producto.ts: `anaquel` antes que `gotas`) — el
      // mismo campo que reportó el humo de producción.
      expect((r.cuerpo as { campo?: string }).campo).toBe('sitio.anaquel.contadorDe')
    })

    // El espejo del test anterior: `sitio` SOLO (sin `sabores` en el lote)
    // tiene que validarse contra lo VIVO de verdad —no saltarse la lectura
    // ni usar un valor vacío/inventado—, así que si a lo vivo también le
    // falta lo que `sitio` necesita, el resultado tiene que ser el MISMO
    // 422, y la prueba de que de verdad leyó lo vivo (y no un lote que no
    // existe) son los DOS pedidos de red.
    it('sitio solo, sin sabores en el lote: se valida contra lo vivo — si a lo vivo también le falta lo que sitio necesita, 422 y no un 200 con datos inventados', async () => {
      const saboresVivoSinJengibre = saboresCrudoDeDisco()
      saboresVivoSinJengibre.gotas = saboresVivoSinJengibre.gotas.filter((g: { clave: string }) => g.clave !== 'jengibreYNaranja')
      const textoSaboresVivoSinJengibre = serializa(esquemaSabores, saboresVivoSinJengibre)
      const crudo = sitioCrudoDeDisco()

      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'main-1' } } }, // gh.ref (Fase 1b)
        { cuerpo: { content: Buffer.from(textoSaboresVivoSinJengibre).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): lo vivo, sin jengibreYNaranja
      ])

      const r = await maneja('publicar', { cuerpo: { base: 'main-1', documentos: { sitio: crudo } }, cookie: cookieValida() }, contextoBase(f))

      // Dos pedidos, ni uno más ni uno menos: de verdad leyó lo vivo. Un
      // «swapped branch» que tratara «sabores no vino» como si hubiera
      // venido habría llamado `fuentesDeSabores(undefined)` SIN tocar
      // GitHub — cero pedidos, no dos.
      expect(pedidos).toHaveLength(2)
      expect(r.status).toBe(422)
      expect((r.cuerpo as { campo?: string }).campo).toBe('sitio.anaquel.contadorDe')
    })
  })

  // Tarea 2 de la Parte B: el sha base. Hasta acá, `publicar` ignoraba
  // contra qué versión del sitio editó la clienta, así que un reintento
  // limpio (fast-forward) podía pisar en silencio lo que Marcos acababa de
  // cambiar. Estos tres tests fijan la regla: sin `base` no se publica, y
  // con `base` vieja se compara qué cambió en el medio ANTES de escribir.
  describe('publicar exige declarar contra qué versión se editó', () => {
    it('sin `base` en el cuerpo, 400 y ni un pedido a GitHub', async () => {
      const { f, pedidos } = fetchFalso([])
      const r = await maneja(
        'publicar',
        { cuerpo: { documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(400)
      expect((r.cuerpo as { problema: string }).problema).toBe(
        'No pudimos publicar: vuelve a abrir el panel y hazlo de nuevo.',
      )
      expect(pedidos).toHaveLength(0)
    })

    it('si alguien tocó un documento del lote en el medio, 409 y CERO escrituras', async () => {
      // La cabeza de main avanzó desde el sha contra el que ella editó, y lo
      // que cambió incluye el documento que ella está publicando: publicar
      // ahora es pisar ese cambio sin conflicto y sin log. Es el bug.
      const { f, pedidos } = fetchFalso([
        { cuerpo: { object: { sha: 'cabezaNueva' } } },                                  // gh.ref
        { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },        // gh.comparaRefs
      ])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: 'loQueEllaLeyo', documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(409)
      expect((r.cuerpo as { problema: string }).problema).toBe(
        'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
      )
      // Lo único que se pidió fue leer y comparar. Nada de blobs, árboles ni refs.
      expect(pedidos.map((p) => p.metodo)).toEqual(['GET', 'GET'])
    })

    it('si lo que cambió en el medio NO es contenido, la publicación sigue', async () => {
      // Marcos arregló una plantilla. Eso no toca ningún documento del lote,
      // así que frenarla sería pedirle que reintente por nada.
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'cabezaNueva' } } },                    // gh.ref
        { cuerpo: { files: [{ filename: 'src/pages/index.astro' }] } },    // gh.comparaRefs
        ...respuestasDeUnaPublicacionCompleta(),
      ])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: 'loQueEllaLeyo', documentos: { sabores: saboresConUnPrecioDistinto() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(200)
    })

    // Paso 8b: `PROBLEMA_PISARIA` (acciones.ts) repite letra por letra el
    // 409 que devuelve `publica()` (publicar.ts) cuando el PATCH del ref
    // choca dos veces. Es el MISMO hecho contado dos veces —acá detectado
    // ANTES, comparando shas; allá detectado DESPUÉS, al chocar el ref— y
    // están duplicadas a propósito: compartirlas acoplaría el router con
    // `publicar.ts` por una cadena de texto. Este test es lo que evita que
    // las dos frases se desincronicen sin que nadie lo note.
    it('las dos formas de detectar una pisada le dicen a la clienta exactamente lo mismo', async () => {
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'cabezaNueva' } } },
        { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },
      ])
      const porElRouter = await maneja(
        'publicar',
        { cuerpo: { base: 'viejo', documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
        contextoBase(f),
      )

      const { f: f2 } = fetchFalso([...respuestasDeDosChoquesDeRef()])
      const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f2 })
      const porElRef = await publica(gh, {
        archivos: [{ ruta: 'src/contenido/datos/sabores.json', contenido: '{}' }],
        autor: 'ella@ejemplo.mx',
      })

      expect((porElRouter.cuerpo as { problema: string }).problema).toBe((porElRef as { problema: string }).problema)
    })
  })
})

// Tarea 3 de la Parte B: cortar UNA sesión sin rotar `PANEL_SECRETO` — el
// celular perdido de alguien que sigue teniendo acceso. `sesionVigente()`
// centraliza esto para todas las acciones autenticadas; acá se ejercita a
// través de `publicar`, que hoy es la única que existe.
describe('revocar una sesión sin rotar la llave', () => {
  it('una sesión emitida antes de PANEL_SESIONES_DESDE deja de valer', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_SESIONES_DESDE = '2026-09-10T00:00:00Z'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-01T00:00:00Z') },
      ctx,
    )
    expect(r.status).toBe(401)
    expect((r.cuerpo as { problema: string }).problema).toBe('Tu sesión no es válida: vuelve a entrar.')
  })

  it('una sesión emitida DESPUÉS de esa fecha sigue valiendo', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_SESIONES_DESDE = '2026-09-10T00:00:00Z'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
      ctx,
    )
    // 400 (sin documentos), no 401: la sesión pasó.
    expect(r.status).toBe(400)
  })

  it('un dispositivo revocado no publica, aunque su correo siga en la lista', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_DISPOSITIVOS_REVOCADOS = 'otro, celu-perdido ,tercero'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieDeDispositivo('celu-perdido') },
      ctx,
    )
    expect(r.status).toBe(401)
  })

  it('una fecha ilegible en PANEL_SESIONES_DESDE no abre la puerta: la cierra', async () => {
    // Si el candado no se puede leer, la única respuesta segura es no dejar
    // pasar. Un typo en una variable de entorno no puede ser la forma de
    // desactivar una revocación.
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_SESIONES_DESDE = 'el martes'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
      ctx,
    )
    expect(r.status).toBe(401)
  })

  it('C-2: un id de dispositivo con coma no puede anular su propia revocación', () => {
    // Medido en la revisión de esta tarea: con el id crudo, poner ESE MISMO id
    // en la lista de revocados no revocaba nada —la coma partía la lista— y
    // `publicar` seguía pasando. El id se normaliza al entrar, así que la coma
    // no llega nunca a la cookie.
    expect(idDeDispositivo('iPhone 15, de Marcos')).toBe('iPhone-15-de-Marcos')
    expect(idDeDispositivo('iPhone 15, de Marcos')).not.toContain(',')
    expect(idDeDispositivo('')).toBe('sin-nombre')
    expect(idDeDispositivo(undefined)).toBe('sin-nombre')
    expect(idDeDispositivo(',,,')).toBe('sin-nombre')
    expect(idDeDispositivo('x'.repeat(200))).toHaveLength(64)
  })

  it('C-2: y revocarlo funciona de punta a punta', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_DISPOSITIVOS_REVOCADOS = 'otro, iPhone-15-de-Marcos'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieDeDispositivo('iPhone-15-de-Marcos') },
      ctx,
    )
    expect(r.status).toBe(401)
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
    for (const accion of ['borrador', 'historial', 'revertir']) {
      const r = await maneja(accion, { cuerpo: {}, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
      expect(r.status).toBe(404)
    }
  })
})

// Tarea 7: «¿ya está en el sitio?» (spec §4.5). Cruza dos fuentes — la
// plataforma dice que el despliegue TERMINÓ, `version.json` dice qué commit
// está sirviendo el CDN AHORA — y por eso el `fetchFalso` de cada test que
// llega a tocar red programa DOS respuestas, en ese orden. El cálculo del
// veredicto en sí (las once combinaciones) lo cubre `test/estado.test.ts`;
// acá solo se prueba que el router lee las dos fuentes correctas, en el
// orden correcto, y con las mismas cuatro capas (secreto, sesión, luego lo
// suyo) que ya tienen `entrar` y `publicarAccion`.
describe('accion=estado', () => {
  it('sin sesión, 401 y ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja(
      'estado',
      { cuerpo: { sha: 'a'.repeat(40), publicadoEn: 1_000 }, cookie: '' },
      contextoBase(f),
    )
    expect(r.status).toBe(401)
    expect(pedidos).toHaveLength(0)
  })

  it('cruza las dos fuentes y devuelve el veredicto', async () => {
    const sha = 'a'.repeat(40)
    const { f, pedidos } = fetchFalso([
      { cuerpo: { deployments: [{ state: 'READY', url: 'maracacao-abc.vercel.app' }] } },
      { cuerpo: { sha, construido: '2026-09-17T12:00:00.000Z' } },
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      { ...contextoBase(f), ahora: () => 6_000 },
    )
    expect(r.status).toBe(200)
    expect(r.cuerpo).toEqual({
      ok: true,
      estado: 'listo',
      frase: 'Tu cambio ya está en el sitio.',
      reintentarEn: null,
      url: 'https://maracacao-abc.vercel.app',
    })
    // La segunda lectura tiene que saltear el caché: si `version.json` viene
    // de un caché intermedio, deja de decir qué está sirviendo AHORA.
    expect(pedidos[1].url).toContain('/version.json?')
  })

  it('si version.json no contesta, no se canta «listo»: se sigue esperando', async () => {
    // Una de las dos fuentes caída no puede convertirse en un «sí» por
    // omisión. La respuesta correcta es «todavía no sé», que es enCurso.
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      { cuerpo: { deployments: [{ state: 'READY', url: 'x.vercel.app' }] } },
      { status: 500, cuerpo: {} },
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      { ...contextoBase(f), ahora: () => 6_000 },
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('enCurso')
  })

  it('sin PANEL_VERCEL_TOKEN, 503 con frase — no un estado inventado', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    delete (ctx.env as Record<string, string | undefined>).PANEL_VERCEL_TOKEN
    const r = await maneja(
      'estado',
      { cuerpo: { sha: 'a'.repeat(40), publicadoEn: 1_000 }, cookie: cookieValida() },
      ctx,
    )
    expect(r.status).toBe(503)
  })
})
