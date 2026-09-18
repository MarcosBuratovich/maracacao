/*
 * El router de /api/panel. Es delgado a propósito: valida la sesión, revalida
 * el contenido y delega. Estos tests son los que cubren la compuerta, que es
 * la capa que de verdad decide si algo entra al sitio.
 */
import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { maneja, idDeDispositivo, VENTANA_DESHACER_MS, type Entorno } from '../src/servidor/acciones'
import type { Carta, ResultadoCorreo } from '../src/servidor/correo'
import { hashDeClave, firmaSesion, verificaSesion } from '../src/servidor/sesion'
import { firmaEnlace, verificaEnlace } from '../src/servidor/enlace'
import { cliente } from '../src/servidor/github'
import { publica } from '../src/servidor/publicar'
import { serializa } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { TOPE_CUERPO } from '../src/servidor/rutas-permitidas'
import {
  fetchFalso, respuestasDeUnaPublicacionCompleta, respuestasDeUnaPublicacionDirecta, respuestasDeUnBlobArbolYCommit,
} from './lib/github-falso'
import { marca } from '@/copy/sitio-marca'
import { jergaEn } from '../src/servidor/estado'

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
const respuestasFuentesDeSitio = (sha = SHA_MAIN) => [
  { cuerpo: { object: { sha } } }, // gh.ref (router: sha base del lote, y fuente de los derivados de sitio)
  { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef: lo vivo de sabores
]

// `respuestasDeUnaPublicacionCompleta()` (Fase 2 completa: lo vivo del
// documento + las seis de `publica()`) vive en `test/lib/github-falso.ts`
// desde la Tarea 8 — la usan también `test/publicar.test.ts` y
// `test/revertir.test.ts`, y dos copias del mismo array de mentira son la
// forma en que dos suites terminan creyendo cosas distintas del mismo cable.

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

/**
 * Las DOS respuestas que `revisaLaCabeza()` (Tarea 8, paso 9) gasta antes de
 * irse sin hacer nada: lee la cabeza de main, lee su commit, ve que el
 * mensaje no lleva `Panel: sí` y se va. Desde la Tarea 8, `publicarAccion` y
 * `estadoAccion` corren esto como lo PRIMERO que hacen con una sesión válida
 * —antes que cualquier otra cosa—, así que todo test de esas dos acciones
 * que llegue con sesión y un `fetch` de mentira que cuenta pedidos tiene que
 * pagar este costo fijo al principio de su lote. Los tests que prueban el
 * mecanismo en sí (más abajo, «B1: la red de seguridad») arman su propio
 * escenario; este ayudante es para los que no quieren ejercitarlo, solo no
 * chocar con él.
 */
const respuestasDeNingunaReversionPendiente = () => [
  { cuerpo: { object: { sha: 'cabeza-sin-revertir' } } }, // gh.ref (dentro de revisaLaCabeza)
  {
    cuerpo: {
      sha: 'cabeza-sin-revertir',
      tree: { sha: 't' },
      message: 'algo cualquiera, no es del panel',
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha: 'p' }],
    },
  }, // gh.commit: sin «Panel: sí», revisaLaCabeza se va acá
]

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

/** Un `contexto.correo` que tira si alguien lo llama: para los caminos que no tienen que mandar nada. */
function correoQueNoSeUsa(): (carta: Carta) => Promise<ResultadoCorreo> {
  return async () => {
    throw new Error('correoQueNoSeUsa(): no se esperaba que esto mandara ningún correo.')
  }
}

/** Un `contexto.correo` que anota cada carta en `cartas` y siempre contesta `{ ok: true }`. */
function correoQueAnota(cartas: Carta[]): (carta: Carta) => Promise<ResultadoCorreo> {
  return async (c) => {
    cartas.push(c)
    return { ok: true }
  }
}

/**
 * Un reloj monótono de mentira, con su espera. Arranca en cero y SOLO
 * avanza cuando algo lo empuja: `espera(ms)` lo empuja esos ms sin dormir
 * de verdad, y `avanza(ms)` lo empuja a mano (para simular un proveedor de
 * correo lento sin un `setTimeout` real).
 *
 * [Revisión final de la rama, C2] Es el par que reemplaza al `Date.now()` +
 * `setTimeout` que `enlaceAccion()` tomaba del global. Antes de esto, los
 * quince tests que llegan al piso de `PISO_ENLACE_MS` dormían 400 ms cada
 * uno DE VERDAD: 17,1 s de los 28,5 s que tardaba este archivo, en el
 * camino crítico del deploy. Y los que medían el piso lo hacían con un
 * cronómetro (`performance.now()`), o sea contra la carga de la máquina;
 * ahora lo miden contra el número exacto que el código pidió esperar, que
 * es lo que de verdad hay que afirmar.
 */
function relojDeMentira() {
  let t = 0
  const esperas: number[] = []
  return {
    monotono: () => t,
    espera: async (ms: number) => {
      esperas.push(ms)
      t += ms
    },
    /** Lo que el código pidió esperar, en orden. */
    esperas,
    /** Empujar el reloj sin que nadie haya esperado: un proveedor que tardó. */
    avanza: (ms: number) => {
      t += ms
    },
    /** Cuánto marca el reloj ahora. */
    marca: () => t,
  }
}

/*
 * [Revisión final de la rama] Los shas de prueba tienen la FORMA de un sha:
 * cuarenta hexadecimales. Antes eran etiquetas («main-1», «viejo»,
 * «loQueEllaLeyo») y por eso ningún test veía que `publicar` y
 * `borrador.guardar` aceptaban cualquier cadena como `base` mientras `estado`
 * y `deshacer` exigían los cuarenta hexadecimales para el mismo dato. Se
 * eligieron palabras escritas en hexadecimal para que sigan siendo legibles
 * en un mensaje de error.
 */
const SHA_MAIN = 'facade01'.repeat(5)
const SHA_VIEJO = 'de1e7ed0'.repeat(5)
const SHA_QUE_ELLA_LEYO = '0cea0bad'.repeat(5)

/**
 * [Inversión de precedencia] `estadoAccion` consulta `version.json` SIEMPRE
 * ahora, ya no solo cuando la plataforma dice `'listo'` — así que todo test
 * de `accion=estado` cuyo despliegue llega a `'falló'` tiene que programarle
 * a `fetchFalso` una respuesta más, o le roba la que le tocaba al siguiente
 * pedido real (el autor del commit, el primer paso de la reversión) y la
 * suite se desalinea en silencio. Acá el CDN sigue sirviendo `SHA_VIEJO`, no
 * el sha que se está probando: ni entra en el «listo» ni contradice el
 * «falló» — exactamente lo que pasa de verdad cuando un despliegue falla y
 * el borde de la red se queda con lo de antes.
 */
const cdnSirviendoLoViejo = () => ({ cuerpo: { sha: SHA_VIEJO, construido: '2026-09-17T12:00:00.000Z' } })

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
  // Un reloj monótono propio por contexto, y una espera que no duerme (ver
  // `relojDeMentira()`, arriba). Los tests que necesitan MIRAR lo que se
  // esperó arman el suyo y lo pisan; a los demás les alcanza con que el
  // piso del enlace mágico no cueste 400 ms de reloj real.
  ...(() => {
    const r = relojDeMentira()
    return { monotono: r.monotono, espera: r.espera }
  })(),
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

/**
 * `contextoBase()` sin ningún nombre de proyecto para preguntarle a la
 * plataforma: `PANEL_VERCEL_PROYECTO` (que `contextoBase()` nunca carga) ni
 * `GITHUB_REPO` (que sí, y acá se borra a mano). Para T7-2: la guardia que
 * evita que `estado` le pregunte a la plataforma por un proyecto sin
 * nombre.
 */
const sinNombreDeProyecto = (fetch: typeof globalThis.fetch) => {
  const ctx = contextoBase(fetch)
  delete (ctx.env as Record<string, string | undefined>).PANEL_VERCEL_PROYECTO
  delete (ctx.env as Record<string, string | undefined>).GITHUB_REPO
  return ctx
}

/**
 * `contextoBase()`, pero para los tests de la reversión automática (Tarea
 * 8): permite fijar el reloj, capturar (o hacer fallar) el correo, y sumar
 * variables de entorno POR ENCIMA de las que ya arma `contextoBase()` — sin
 * perder las que hacen falta para que `secretoUtilizable`, `sesionVigente` y
 * las guardias de `estado` sigan pasando.
 */
const contextoDePrueba = (p: {
  fetch: typeof globalThis.fetch
  ahora?: () => number
  correo?: (carta: Carta) => Promise<ResultadoCorreo>
  env?: Partial<Entorno>
  /** El reloj monótono + espera de este contexto, cuando el test necesita mirarlos (`relojDeMentira()`). */
  reloj?: { monotono: () => number; espera: (ms: number) => Promise<void> }
}) => {
  const base = contextoBase(p.fetch)
  return {
    ...base,
    ...(p.ahora ? { ahora: p.ahora } : {}),
    ...(p.correo ? { correo: p.correo } : {}),
    ...(p.reloj ? { monotono: p.reloj.monotono, espera: p.reloj.espera } : {}),
    env: { ...base.env, ...(p.env ?? {}) },
  }
}

/**
 * Las tres respuestas que hacen falta para que `revierte()` (Tarea 8) TERMINE
 * contra un commit que es la cabeza, es del panel, y no tocó ningún
 * documento de contenido: `gh.ref` (la cabeza es el propio `sha`), `gh.commit`
 * (con el trailer del panel y un padre) y `gh.comparaRefs` (sin archivos).
 *
 * [Ronda 2, Grupo D] Ese camino ya NO es `ok: true`: `revierte()` devuelve
 * `{ ok: false, motivo: 'nada-que-revertir' }`, porque main sigue con el
 * commit roto. Sigue alcanzando para probar que `revierteYAvisa*()` corre y
 * avisa —el resumen que arma dice «no había nada que revertir», no
 * «revertido»—; el mecanismo de la reversión en sí —qué pasa cuando SÍ hay
 * contenido que revertir, y la revalidación de `sitio`— lo prueba
 * `test/revertir.test.ts`.
 */
const respuestasDeUnaReversionCompleta = (sha: string) => [
  { cuerpo: { object: { sha } } }, // gh.ref (dentro de revierte())
  {
    cuerpo: {
      sha,
      tree: { sha: 't' },
      message: 'cambia algo\n\nPanel: sí',
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha: 'padre' }],
    },
  }, // gh.commit
  { cuerpo: { files: [] } }, // gh.comparaRefs: no tocó contenido
]

/**
 * [Ronda 3, Grupo 3] La respuesta de `gh.commit(sha)` que `revierteYAvisa()`
 * lee ANTES de llamar a `revierte()` —igual que `revisaLaCabeza()` ya hacía
 * en el camino de al lado—, para sacar el autor real del trailer
 * `Panel-Autor:` en vez de usar el correo de quien está sondeando `estado`.
 * Un pedido de más que paga cualquier test que ejercite `revierteYAvisa()`
 * (no `revierteYAvisaAMarcos()`, que ya recibe el autor listo).
 */
const respuestaDelCommitParaElAutor = (sha: string, autor = 'clienta@ejemplo.mx') => ({
  cuerpo: {
    sha,
    tree: { sha: 't' },
    message: `cambia algo\n\nPanel: sí\nPanel-Autor: ${autor}`,
    author: { date: '2026-09-17T12:00:00Z' },
    parents: [{ sha: 'padre' }],
  },
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

// Tarea 12 (spec §4.1): el enlace mágico de recuperación. `contextoBase()`
// NO carga `RESEND_API_KEY`/`PANEL_REMITENTE` a propósito (ningún test de
// las otras acciones los necesita), así que acá representa exactamente el
// estado «correo sin configurar» — el único 503 que esta acción, a
// diferencia de todas las demás, no puede evitar (B3). Los tests del
// camino feliz usan `contextoDePrueba()` con esas dos variables sumadas.
//
// [Ronda 1 de revisión] Cada test que llega a mandar un correo usa su
// PROPIO correo listado (`env.PANEL_CORREOS` sobreescrito) además de su
// propia IP: desde esta ronda, `enlace` frena por DESTINATARIO además de
// por IP (hallazgo F; tope 10 cada 15 minutos desde la Ronda 2 — empezó en
// 3, ver el test F más abajo) — compartir 'clienta@ejemplo.mx' entre
// muchos tests haría que unos le comieran el presupuesto a otros.
// `CORREO_REMITENTE` vive a nivel de archivo porque lo usan los dos
// describes de esta tarea, no solo este.
//
// [Ronda 2 de revisión] `enlaceAccion()` espera hasta `PISO_ENLACE_MS`
// (400 ms) antes de contestar, exista o no la dirección (hallazgo B de la
// Ronda 1, reemplazado en la Ronda 2 — ver el docstring de `PISO_ENLACE_MS`
// en acciones.ts).
//
// [Revisión final de la rama, C2] Esa espera ya NO cuesta 400 ms de reloj
// real por test: viene inyectada en el contexto (`relojDeMentira()`, arriba
// en este archivo), así que se simula. Los tests de este describe que hacen
// cinco o diez pedidos seguidos (E4, F) llevaban por eso un timeout propio
// de 5 s y 8 s; ya no lo necesitan, y volvieron al default de vitest — que
// ahora, además, vuelve a ser un guardián útil en vez de un techo que el
// sueño de mentira consumía entero.
const CORREO_REMITENTE = { RESEND_API_KEY: 'clave-de-prueba', PANEL_REMITENTE: 'Panel <panel@ejemplo.mx>' }

describe('accion=enlace', () => {

  it('B3: sin RESEND_API_KEY/PANEL_REMITENTE, 503 con la frase para Marcos — ni siquiera mira si el correo está en la lista', async () => {
    const r = await maneja(
      'enlace',
      { cuerpo: { correo: 'clienta@ejemplo.mx' }, cookie: '' },
      { ...contextoBase(fetchQueNoSeUsa()), correo: correoQueNoSeUsa(), ip: `enlace-sin-correo-${Math.random()}` },
    )
    expect(r.status).toBe(503)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Ahora mismo no puedo mandarte el enlace. Escríbele a Marcos.',
    )
  })

  it('con un correo que SÍ está en la lista: manda el enlace y contesta la frase única', async () => {
    const correo = `listado-${Math.random()}@ejemplo.mx`
    const cartas: Carta[] = []
    const r = await maneja(
      'enlace',
      { cuerpo: { correo }, cookie: '' },
      {
        ...contextoDePrueba({
          fetch: fetchQueNoSeUsa(),
          correo: correoQueAnota(cartas),
          env: { ...CORREO_REMITENTE, PANEL_CORREOS: correo },
        }),
        ip: `enlace-listado-${Math.random()}`,
      },
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { mensaje: string }).mensaje).toBe(
      'Si esa dirección tiene acceso, te llegó un correo con el enlace.',
    )
    expect(cartas).toHaveLength(1)
    expect(cartas[0].a).toEqual([correo])
    expect(cartas[0].texto).toMatch(/panel\/entrar\?token=/)
  })

  it('con un correo que NO está en la lista: la MISMA respuesta, byte a byte, y no manda nada', async () => {
    const correoListado = `cmp-listado-${Math.random()}@ejemplo.mx`
    const correoAjeno = `cmp-ajeno-${Math.random()}@fuera.mx`
    const cartasListado: Carta[] = []
    const cartasNoListado: Carta[] = []
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correoListado }

    const conListado = await maneja(
      'enlace',
      { cuerpo: { correo: correoListado }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartasListado), env }), ip: `enlace-cmp-listado-${Math.random()}` },
    )
    const sinListado = await maneja(
      'enlace',
      { cuerpo: { correo: correoAjeno }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartasNoListado), env }), ip: `enlace-cmp-nolistado-${Math.random()}` },
    )

    expect(conListado.status).toBe(sinListado.status)
    expect(JSON.stringify(conListado.cuerpo)).toBe(JSON.stringify(sinListado.cuerpo))
    expect(cartasListado).toHaveLength(1) // sí mandó
    // [Ronda 2] Ya no hay ningún señuelo a quien escribirle: la rama sin
    // acceso no manda NADA — el piso de tiempo (abajo) es lo que iguala el
    // reloj, no un envío de más.
    expect(cartasNoListado).toHaveLength(0)
  })

  // [B, Critical — Ronda 1; reemplazado en la Ronda 2 de revisión] La
  // Ronda 1 cerraba el oráculo de tiempo mandando SIEMPRE un correo —real
  // si la dirección estaba en la lista, a un señuelo si no—. La Ronda 2 lo
  // encontró: eso convertía el endpoint en un generador ilimitado de
  // rebotes duros contra un dominio sin registros MX, con un token válido
  // adentro de cada uno. El arreglo de la Ronda 2 —`PISO_ENLACE_MS`— cierra
  // el mismo oráculo ESPERANDO en vez de mandando: este test mide las dos
  // ramas, mismo patrón que I-3 (`entrar()`, más arriba en este archivo).
  it('B: piso de tiempo — las dos ramas tardan lo mismo, y solo la listada manda algo', async () => {
    const correoListado = `piso-listado-${Math.random()}@ejemplo.mx`
    const correoAjeno = `piso-ajeno-${Math.random()}@fuera.mx`
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correoListado }
    const cartasListado: Carta[] = []
    const cartasNoListado: Carta[] = []

    // [Revisión final, C2] Antes esto se medía con un cronómetro
    // (`performance.now()`) alrededor de cada rama, y por eso cada corrida
    // dormía 400 ms de verdad, dos veces. Ahora el reloj y la espera vienen
    // inyectados, así que se afirma algo MÁS fuerte y gratis: las dos ramas
    // terminan en la MISMA marca del reloj monótono, y esa marca es
    // exactamente el piso. Un cronómetro solo podía decir «tardaron
    // parecido», y su cota de 100 ms de diferencia dependía de la carga de
    // la máquina.
    const relojListado = relojDeMentira()
    const relojNoListado = relojDeMentira()

    await maneja(
      'enlace',
      { cuerpo: { correo: correoListado }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartasListado), env, reloj: relojListado }), ip: `enlace-piso-listado-${Math.random()}` },
    )

    await maneja(
      'enlace',
      { cuerpo: { correo: correoAjeno }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartasNoListado), env, reloj: relojNoListado }), ip: `enlace-piso-nolistado-${Math.random()}` },
    )

    // Las dos ramas esperaron, y esperaron lo mismo: el piso entero, porque
    // el proveedor de mentira de este test no tarda nada.
    expect(relojListado.esperas).toEqual([400])
    expect(relojNoListado.esperas).toEqual([400])
    expect(relojListado.marca()).toBe(relojNoListado.marca())

    expect(cartasListado).toHaveLength(1)
    expect(cartasNoListado).toHaveLength(0) // nunca manda nada a quien no tiene acceso
  })

  // [Ronda 3 de revisión] Medido por la revisión: con el proveedor a 800 ms
  // contra un piso de 400, las dos ramas vuelven a diferir 400 ms — el
  // oráculo se reabre cada vez que el proveedor tiene un mal día. No se
  // corta el envío con un timeout (ruling T12-K: abandonar el pedido en
  // una función serverless puede matar el correo, y ésta es la puerta de
  // RECUPERACIÓN) — lo que sí tiene que pasar es que quede logueado.
  // OJO acá: el proveedor de este test tarda MÁS que `PISO_ENLACE_MS`
  // (400 ms) a propósito — con uno rápido (como el resto de los tests de
  // este describe) esta rama nunca se ejercita, y el test no podría fallar
  // nunca aunque el `console.error` desapareciera del código.
  it('la alarma del piso: si el proveedor tarda más que el piso, un console.error avisa', async () => {
    const correo = `piso-lento-${Math.random()}@ejemplo.mx`
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correo }
    // [Revisión final, C2] El proveedor «lento» ya no duerme 500 ms de
    // verdad: empuja el reloj monótono inyectado esos 500 ms, que es lo
    // ÚNICO que el código mira para decidir si la alarma sale. Sigue siendo
    // > PISO_ENLACE_MS (400), que es lo que hace que esta rama se ejercite
    // de verdad — con un proveedor rápido este test no podría fallar nunca
    // aunque el `console.error` desapareciera del código.
    const reloj = relojDeMentira()
    const correoLento = async (): Promise<ResultadoCorreo> => {
      reloj.avanza(500)
      return { ok: true }
    }
    const errorEspia = vi.spyOn(console, 'error').mockImplementation(() => {})

    const r = await maneja(
      'enlace',
      { cuerpo: { correo }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoLento, env, reloj }), ip: `enlace-piso-lento-${Math.random()}` },
    )

    // Contesta bien igual — no se corta el envío ni se le miente a quien pidió.
    expect(r.status).toBe(200)
    expect((r.cuerpo as { mensaje: string }).mensaje).toBe(
      'Si esa dirección tiene acceso, te llegó un correo con el enlace.',
    )
    expect(errorEspia).toHaveBeenCalledWith(expect.stringContaining('el envío tardó'))
    expect(errorEspia).toHaveBeenCalledWith(expect.stringContaining('más que el piso de 400 ms'))
    // Y no esperó NADA de más encima de los 500 que ya había tardado: el
    // piso es un piso, no un peaje que se suma.
    expect(reloj.esperas).toEqual([])
    errorEspia.mockRestore()
  })

  it('E4: el freno por IP se aplica igual que en `entrar` — el sexto pedido seguido es 429', async () => {
    // Un correo DISTINTO en cada intento: así se ejercita el freno por IP
    // (E4) sin chocar con el freno por destinatario (F, tope 10) que
    // pisaría este test antes de llegar al sexto pedido.
    const ip = `enlace-freno-ip-${Math.random()}`
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: Array.from({ length: 6 }, (_, i) => `freno-ip-${i}-${Math.random()}@ejemplo.mx`).join(',') }
    const correos = env.PANEL_CORREOS.split(',')
    const cartas: Carta[] = []
    const ctx = { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartas), env }), ip }

    for (let i = 0; i < 5; i++) {
      const r = await maneja('enlace', { cuerpo: { correo: correos[i] }, cookie: '' }, ctx)
      expect(r.status).toBe(200)
    }
    const r = await maneja('enlace', { cuerpo: { correo: correos[5] }, cookie: '' }, ctx)

    expect(r.status).toBe(429)
    expect(cartas).toHaveLength(5) // los primeros cinco sí mandaron; el sexto, frenado, no
  })

  // [F, Minor — Ronda 1; tope subido en la Ronda 2 de revisión] El freno de
  // arriba es por IP; este es por DESTINATARIO — sin él, veinte IPs
  // distintas pueden mandarle a la MISMA dirección cien correos desde
  // nuestro remitente (medido). IPs distintas en cada intento para
  // aislarlo del freno por IP (E4).
  //
  // [Ronda 2] El tope empezó en tres (Ronda 1) y subió a diez: medido, tres
  // alcanzaba para que un extraño —desde tres IPs cualquiera, sin saber si
  // esa dirección tiene acceso siquiera— dejara a ELLA afuera de su propia
  // puerta de emergencia con solo pedir su enlace tres veces. Diez sigue
  // protegiendo su bandeja (frente a los cien que había sin ningún tope) y
  // hace falta hostigarla a propósito para dejarla afuera — y si eso pasa,
  // un `console.error` con la dirección avisa a Marcos (test de abajo).
  it('F: tope por destinatario (diez) — el onceavo pedido para el MISMO correo, desde IPs distintas, es 429', async () => {
    const correo = `destino-${Math.random()}@ejemplo.mx`
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correo }
    const cartas: Carta[] = []
    const ctxDesde = (ip: string) => ({ ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartas), env }), ip })

    for (let i = 0; i < 10; i++) {
      const r = await maneja('enlace', { cuerpo: { correo }, cookie: '' }, ctxDesde(`enlace-f-${i}-${Math.random()}`))
      expect(r.status).toBe(200)
    }
    const errorEspia = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r11 = await maneja('enlace', { cuerpo: { correo }, cookie: '' }, ctxDesde(`enlace-f-10-${Math.random()}`))

    expect(r11.status).toBe(429)
    expect(cartas).toHaveLength(10) // el onceavo no mandó nada
    // El `console.error` fuerte que pide el hallazgo F de la Ronda 2: se
    // dispara con la dirección adentro, para que Marcos pueda distinguir
    // «alguien la está hostigando» de cualquier otro 429. La aserción va
    // ANTES de `mockRestore()`: restaurar el espía también limpia su
    // historial de llamadas (mismo efecto que `mockReset()`), así que
    // preguntarle después siempre daría cero.
    expect(errorEspia).toHaveBeenCalledWith(expect.stringContaining(correo))
    errorEspia.mockRestore()
  })

  it('C-1: PANEL_SECRETO ausente o corto, 503 antes de tocar nada — ni siquiera el correo', async () => {
    for (const secreto of [undefined, 'corto']) {
      const ctx = {
        ...contextoDePrueba({
          fetch: fetchQueNoSeUsa(),
          correo: correoQueNoSeUsa(),
          env: { PANEL_SECRETO: secreto, ...CORREO_REMITENTE },
        }),
        ip: `enlace-c1-${Math.random()}`,
      }
      const r = await maneja('enlace', { cuerpo: { correo: 'clienta@ejemplo.mx' }, cookie: '' }, ctx)
      expect(r.status).toBe(503)
    }
  })

  it('ninguna de sus frases usa jerga técnica', async () => {
    const correo = `jerga-${Math.random()}@ejemplo.mx`
    const cartas: Carta[] = []
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correo }
    const r = await maneja(
      'enlace',
      { cuerpo: { correo }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartas), env }), ip: `enlace-jerga-${Math.random()}` },
    )
    expect(jergaEn((r.cuerpo as { mensaje: string }).mensaje)).toBeNull()
    expect(cartas).toHaveLength(1)
    expect(jergaEn(`${cartas[0].asunto} ${cartas[0].texto}`)).toBeNull()

    const sinCorreo = await maneja(
      'enlace',
      { cuerpo: { correo: 'clienta@ejemplo.mx' }, cookie: '' },
      { ...contextoBase(fetchQueNoSeUsa()), correo: correoQueNoSeUsa(), ip: `enlace-jerga-sincorreo-${Math.random()}` },
    )
    expect(jergaEn((sinCorreo.cuerpo as { problema: string }).problema)).toBeNull()
  })

  // [H, Minor — Ronda 1 de revisión] Sin esto, alguien que escribe su
  // propio correo con otras mayúsculas termina con una sesión —y después
  // commits— a nombre de esa forma cruda en vez de la que Marcos escribió
  // en `PANEL_CORREOS`.
  it('H: firma la forma CANÓNICA de PANEL_CORREOS, no la que tipeó quien pidió el enlace', async () => {
    const correoCanonico = `Clienta.Canonica.${Math.floor(Math.random() * 1e9)}@Ejemplo.MX`
    const cartas: Carta[] = []
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: correoCanonico }
    const r = await maneja(
      'enlace',
      { cuerpo: { correo: correoCanonico.toLowerCase() } , cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartas), env }), ip: `enlace-h-${Math.random()}` },
    )
    expect(r.status).toBe(200)
    expect(cartas).toHaveLength(1)
    const token = decodeURIComponent(cartas[0].texto.match(/token=(\S+)/)![1])
    const verificado = verificaEnlace(token, SECRETO, Date.now())
    expect(verificado?.correo).toBe(correoCanonico) // no `correoCanonico.toLowerCase()`
  })
})

describe('accion=entrar-con-enlace', () => {
  const enlaceValido = (correo = 'clienta@ejemplo.mx', vence = Date.now() + 10 * 60_000) =>
    firmaEnlace(correo, vence, SECRETO)

  // [Ronda 1 de revisión, hallazgo D] `entrar-con-enlace` ahora frena por
  // IP, así que —a diferencia de la ronda anterior— cada test necesita su
  // propia IP: `contextoBase()` por sí sola siempre trae la misma
  // ('1.2.3.4'), y compartirla entre los ocho tests de este describe
  // agotaría el freno bastante antes del test que lo prueba a propósito.
  const ctx = (ip = `entrar-con-enlace-${Math.random()}`) => ({ ...contextoBase(fetchQueNoSeUsa()), ip })

  it('con un enlace válido, entra: la misma cookie firmada que `entrar`', async () => {
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: enlaceValido() }, cookie: '' }, ctx())
    expect(r.status).toBe(200)
    expect(r.cookie).toMatch(/HttpOnly/)
    expect(r.cookie).toMatch(/panel_sesion=/)
  })

  it('un token vencido no entra', async () => {
    const vencido = firmaEnlace('clienta@ejemplo.mx', Date.now() - 1_000, SECRETO)
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: vencido }, cookie: '' }, ctx())
    expect(r.status).toBe(401)
    expect(r.cookie).toBeUndefined()
  })

  it('un token con la firma cambiada no entra', async () => {
    const [cuerpo] = enlaceValido().split('.')
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: `${cuerpo}.firmaInventada` }, cookie: '' }, ctx())
    expect(r.status).toBe(401)
  })

  it('sin token en el cuerpo, 401 — no revienta', async () => {
    const r = await maneja('entrar-con-enlace', { cuerpo: {}, cookie: '' }, ctx())
    expect(r.status).toBe(401)
  })

  it('I-4: un correo que ya no está en PANEL_CORREOS no entra, aunque el enlace en sí sea válido', async () => {
    const t = firmaEnlace('salio-de-la-lista@ejemplo.mx', Date.now() + 10 * 60_000, SECRETO)
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: t }, cookie: '' }, ctx())
    expect(r.status).toBe(401)
  })

  it('B7: una cookie de sesión normal no sirve como enlace tampoco desde el router', async () => {
    const cookie = cookieValida()
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: cookie }, cookie: '' }, ctx())
    expect(r.status).toBe(401)
  })

  it('C-1: PANEL_SECRETO ausente o corto, 503', async () => {
    const c = ctx()
    delete (c.env as Record<string, string | undefined>).PANEL_SECRETO
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: enlaceValido() }, cookie: '' }, c)
    expect(r.status).toBe(503)
  })

  it('sin dispositivo en el cuerpo, la sesión queda con "sin-nombre" — nunca revienta', async () => {
    // El servidor nunca falla por esto, y eso está bien. Lo que NO puede
    // pasar es que la página de recuperación caiga siempre acá: ver el
    // test de abajo, y el describe I7 de `test/entrar-astro.test.ts`.
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: enlaceValido() }, cookie: '' }, ctx())
    expect(r.status).toBe(200)
    const valorCookie = r.cookie!.split(';')[0].split('=')[1]
    const sesion = verificaSesion(valorCookie, SECRETO)
    expect(sesion?.correo).toBe('clienta@ejemplo.mx')
    expect(sesion?.dispositivo).toBe('sin-nombre')
  })

  it('I7: el `dispositivo` del cuerpo llega FIRMADO a la cookie, normalizado', async () => {
    // La otra punta del arreglo del grupo 4: la página manda un id propio de
    // cada navegador, y tiene que llegar entero hasta la cookie para que
    // `PANEL_DISPOSITIVOS_REVOCADOS` pueda revocar ESA sesión y no todas.
    const r = await maneja(
      'entrar-con-enlace',
      { cuerpo: { token: enlaceValido(), dispositivo: 'aparato-7f3c, de la vecina' }, cookie: '' },
      ctx(),
    )
    expect(r.status).toBe(200)
    const sesion = verificaSesion(r.cookie!.split(';')[0].split('=')[1], SECRETO)
    expect(sesion?.dispositivo).toBe('aparato-7f3c-de-la-vecina')
    expect(sesion?.dispositivo).not.toBe('sin-nombre')
  })

  // [C, Important — Ronda 1 de revisión] Sin almacén de tokens usados, el
  // reuso dentro de los quince minutos no tiene ningún techo — así que la
  // sesión que emite esta vía dura un día, no treinta: acota cuánto vale
  // el "pie adentro" que deja un token reusado.
  it('C: la sesión que emite dura UN DÍA (24 horas), no treinta', async () => {
    const ahora = 1_000_000
    const r = await maneja(
      'entrar-con-enlace',
      { cuerpo: { token: enlaceValido() }, cookie: '' },
      { ...ctx(), ahora: () => ahora },
    )
    expect(r.status).toBe(200)
    const valorCookie = r.cookie!.split(';')[0].split('=')[1]
    const sesion = verificaSesion(valorCookie, SECRETO, ahora)
    expect(sesion).not.toBeNull()
    expect(sesion!.vence - sesion!.emitida).toBe(86_400_000) // exactamente un día, ni treinta
  })

  it('C: cada consumo le manda un correo A ELLA — la única señal de que alguien más entró', async () => {
    const cartas: Carta[] = []
    const r = await maneja(
      'entrar-con-enlace',
      { cuerpo: { token: enlaceValido() }, cookie: '' },
      { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota(cartas) }), ip: `entrar-con-enlace-c-${Math.random()}` },
    )
    expect(r.status).toBe(200)
    expect(cartas).toHaveLength(1)
    expect(cartas[0].a).toEqual(['clienta@ejemplo.mx'])
    expect(jergaEn(`${cartas[0].asunto} ${cartas[0].texto}`)).toBeNull()
  })

  it('C: si el aviso de consumo falla o no está configurado, el login NO se cae — es mejor esfuerzo', async () => {
    const r = await maneja(
      'entrar-con-enlace',
      { cuerpo: { token: enlaceValido() }, cookie: '' },
      {
        ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: async () => ({ ok: false, motivo: 'sin-configurar' }) }),
        ip: `entrar-con-enlace-c-degradado-${Math.random()}`,
      },
    )
    expect(r.status).toBe(200)
    expect(r.cookie).toMatch(/HttpOnly/)
  })

  // [D, Important — Ronda 1 de revisión] El freno acá NO protege contra
  // adivinar la firma (un HMAC de este largo no se adivina probando, y
  // eso sigue siendo cierto) — protege contra REUSAR un token válido, que
  // no tenía ningún techo: medido, el mismo token cambiado por sesión ocho
  // veces en paralelo desde ocho IPs dio ocho sesiones. Acá, veinte
  // tokens basura seguidos desde la MISMA IP daban veinte 401 y ni un
  // 429 — el freno tiene que aparecer igual, sea cual sea el token.
  it('D: el freno de intentos se aplica en el consumo — el sexto pedido seguido desde la misma IP es 429', async () => {
    const ip = `entrar-con-enlace-freno-${Math.random()}`
    const c = ctx(ip)
    for (let i = 0; i < 5; i++) {
      const r = await maneja('entrar-con-enlace', { cuerpo: { token: 'token-basura-que-no-vale' }, cookie: '' }, c)
      expect(r.status).toBe(401) // ninguno de los cinco es 429 todavía
    }
    const r = await maneja('entrar-con-enlace', { cuerpo: { token: 'token-basura-que-no-vale' }, cookie: '' }, c)
    expect(r.status).toBe(429)
  })

  // [E, Minor — Ronda 1 de revisión] Y el motivo por el que hace falta: el
  // presupuesto es POR ACCIÓN, no compartido. Antes, agotar el freno
  // pidiendo `enlace` cinco veces desde una IP dejaba a esa misma IP sin
  // poder `entrar` con la contraseña —justo el día que más hace falta,
  // porque el enlace no le llegó—. Ahora, agotar `enlace` no le toca ni un
  // intento a `entrar` ni a `entrar-con-enlace` en la misma IP.
  it('E: el presupuesto de `enlace` no le come el de `entrar` ni el de `entrar-con-enlace`, en la misma IP', async () => {
    const ip = `e-independencia-${Math.random()}`
    const env = { ...CORREO_REMITENTE, PANEL_CORREOS: `e-correo-${Math.random()}@ejemplo.mx` }
    const cCorreo = { ...contextoDePrueba({ fetch: fetchQueNoSeUsa(), correo: correoQueAnota([]), env }), ip }

    // Agota el freno de `enlace` en esta IP: cinco pedidos.
    for (let i = 0; i < 5; i++) {
      await maneja('enlace', { cuerpo: { correo: env.PANEL_CORREOS }, cookie: '' }, cCorreo)
    }
    const enlaceFrenado = await maneja('enlace', { cuerpo: { correo: env.PANEL_CORREOS }, cookie: '' }, cCorreo)
    expect(enlaceFrenado.status).toBe(429) // confirma que SÍ se agotó

    // `entrar`, en la MISMA ip, con la contraseña correcta: nada que ver.
    const cEntrar = { ...contextoBase(fetchQueNoSeUsa()), ip }
    const entrarOk = await maneja('entrar', { cuerpo: { clave: CLAVE, correo: 'clienta@ejemplo.mx' }, cookie: '' }, cEntrar)
    expect(entrarOk.status).toBe(200)

    // `entrar-con-enlace`, en la MISMA ip, con un token válido: tampoco.
    const consumoOk = await maneja('entrar-con-enlace', { cuerpo: { token: enlaceValido() }, cookie: '' }, { ...contextoBase(fetchQueNoSeUsa()), ip })
    expect(consumoOk.status).toBe(200)
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
    const { f, pedidos } = fetchFalso([...respuestasDeNingunaReversionPendiente(), ...respuestasFuentesDeSitio()])
    const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(422)
    expect((r.cuerpo as { campo?: string }).campo).toContain('anaquel.titulo')
    expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
  })

  it('el mensaje de un contenido inválido no habla como una computadora', async () => {
    const roto = JSON.parse(JSON.stringify(marca))
    roto.anaquel.titulo = ''
    const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), ...respuestasFuentesDeSitio()])
    const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: roto } }, cookie: cookieValida() }, contextoBase(f))
    const texto = String((r.cuerpo as { problema: string }).problema)
    expect(texto).not.toMatch(/zod|schema|422|undefined|parse/i)
  })

  it('un documento que no existe se rechaza antes de mirar su contenido', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: { inventado: {} } }, cookie: cookieValida() },
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
    const { f, pedidos } = fetchFalso([...respuestasDeNingunaReversionPendiente(), ...respuestasFuentesDeSitio()])
    const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: sinGotas } }, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(422)
    expect((r.cuerpo as { campo?: string }).campo).toContain('gotas')
    expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
  })

  // RULING T6-d — de la revisión: con sesión válida, un lote sin ningún
  // documento adentro no puede llegar a tocar GitHub (ids.length === 0 se
  // decide antes de armar el cliente de GitHub).
  it('con sesión válida y sin documentos, 400 y sin tocar GitHub', async () => {
    // [Ronda 2, Grupo C] Antes de la reordenación, este test «pasaba» solo
    // porque `revisaLaCabeza()` se tragaba el error de `fetchQueNoSeUsa()` en
    // su propio `try` — el título prometía «sin tocar GitHub» pero nada lo
    // comprobaba. `contando()` cierra el hueco: ahora si algo llega a tocar
    // `fetch`, el test lo ve.
    const usos = { n: 0 }
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieValida() },
      contextoBase(contando(usos)),
    )
    expect(r.status).toBe(400)
    expect(usos.n).toBe(0)
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
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (Fase 2: el sha base del lote)
      { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): lo vivo, para el diff
    ])

    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: { sabores: saboresEnorme } }, cookie: cookieValida() },
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
        ...respuestasDeNingunaReversionPendiente(),
        ...respuestasFuentesDeSitio(), // gh.ref (router, base del lote — también sirve de fuente de derivados) + gh.archivoEnRef(sabores)
        { cuerpo: { content: Buffer.from(textoVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef (router, lo vivo de sitio)
        { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-nuevo' } }, // creaBlob
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

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
        ...respuestasDeNingunaReversionPendiente(),
        ...respuestasFuentesDeSitio(), // gh.ref (base + fuente de derivados) + gh.archivoEnRef(sabores)
        { cuerpo: { content: Buffer.from(textoEnviado).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef(sitio): igual a lo enviado
      ])

      const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

      expect(r.status).toBe(200)
      const cuerpo = r.cuerpo as { ok: boolean; sha: string | null; resumen: string }
      expect(cuerpo.ok).toBe(true)
      expect(cuerpo.sha).toBeNull()
      expect(cuerpo.resumen).toMatch(/no había nada que publicar/i)
      expect(pedidos.filter((p) => p.metodo === 'POST' || p.metodo === 'PATCH')).toHaveLength(0)
    })

    it('si GitHub no contesta al leer lo vivo, no publica nada y nunca dice que salió bien', async () => {
      const enviado = JSON.parse(JSON.stringify(marca))

      const { f, pedidos } = fetchFalso([
        ...respuestasDeNingunaReversionPendiente(),
        { status: 500, cuerpo: { message: 'ups, caído' } }, // gh.ref falla
      ])

      const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: enviado } }, cookie: cookieValida() }, contextoBase(f))

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
        ...respuestasDeNingunaReversionPendiente(),
        ...respuestasFuentesDeSitio(), // fuentes de los derivados: sabores no viene en el lote
        { cuerpo: { content: Buffer.from(serializa(esquemaSitio, marca)).toString('base64'), encoding: 'base64' } }, // lo vivo de sitio
        { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-nuevo' } }, // creaBlob
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: crudo } }, cookie: cookieValida() }, contextoBase(f))

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
          ...respuestasDeNingunaReversionPendiente(),
          ...respuestasFuentesDeSitio(),
          { cuerpo: { content: Buffer.from(serializa(esquemaSitio, marca)).toString('base64'), encoding: 'base64' } },
          { cuerpo: { object: { sha: SHA_MAIN } } },
          { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } },
          { cuerpo: { sha: 'blob-nuevo' } },
          { cuerpo: { sha: 'arbol-nuevo' } },
          { cuerpo: { sha: 'commit-nuevo' } },
          { cuerpo: {} },
        ])
        return { ctx: contextoBase(f), pedidos }
      }

      const a = contextoParaOtroLote()
      const rCrudo = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: crudo } }, cookie: cookieValida() }, a.ctx)

      const b = contextoParaOtroLote()
      const rInjertado = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: yaInjertado } }, cookie: cookieValida() }, b.ctx)

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
      // usar el del lote, pediría una respuesta de más que las programadas
      // y `fetchFalso` lo denuncia (M-11). Las dos primeras son el costo
      // fijo de `revisaLaCabeza()` (Tarea 8, paso 9), que corre antes que
      // cualquier otra cosa.
      const { f, pedidos } = fetchFalso([
        ...respuestasDeNingunaReversionPendiente(),
        { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (Fase 2 — la Fase 1b no tocó GitHub: sabores vino en el lote)
        { cuerpo: { content: Buffer.from(textoSitioVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sitio)
        { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): 15, distinto del lote
        { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (dentro de publica())
        { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // gh.commit
        { cuerpo: { sha: 'blob-a' } }, // creaBlob (uno de los dos archivos; el orden de llegada no importa)
        { cuerpo: { sha: 'blob-b' } }, // creaBlob (el otro)
        { cuerpo: { sha: 'arbol-nuevo' } }, // creaArbol
        { cuerpo: { sha: 'commit-nuevo' } }, // creaCommit
        { cuerpo: {} }, // mueveRef
      ])

      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_MAIN, documentos: { sitio: sitioConCambio, sabores: saboresConUnoNuevo } }, cookie: cookieValida() },
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

      // [RULING T7-5] Solo las DOS respuestas del costo fijo de
      // `revisaLaCabeza()` (corre antes que la Fase 1b, siempre — ver su
      // docstring en acciones.ts) — nunca una tercera: si la Fase 1b
      // llegara a tocar GitHub —el «swapped branch» que este test existe
      // para atrapar, usando lo vivo en vez del lote— `fetchFalso` tira por
      // pedir una respuesta que no programó, y el 502 de «no pudimos leer»
      // delata el bug (en vez del 422 que sigue). Antes decía «CERO
      // respuestas programadas»: eso medía mal — el intento de
      // `revisaLaCabeza()` existía igual, solo que `fetchFalso([])` tiraba
      // su error ANTES de anotarlo en `pedidos`, así que la lista quedaba en
      // cero por casualidad, no porque no se hubiera tocado la red.
      const { f, pedidos } = fetchFalso([...respuestasDeNingunaReversionPendiente()])

      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_MAIN, documentos: { sitio: crudo, sabores: saboresSinJengibre } }, cookie: cookieValida() },
        contextoBase(f),
      )

      expect(pedidos).toHaveLength(2)
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
        ...respuestasDeNingunaReversionPendiente(), // costo fijo de revisaLaCabeza() (Tarea 8, paso 9)
        { cuerpo: { object: { sha: SHA_MAIN } } }, // gh.ref (Fase 1b)
        { cuerpo: { content: Buffer.from(textoSaboresVivoSinJengibre).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): lo vivo, sin jengibreYNaranja
      ])

      const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { sitio: crudo } }, cookie: cookieValida() }, contextoBase(f))

      // Cuatro pedidos, ni uno más ni uno menos: los dos primeros son
      // `revisaLaCabeza()`, los otros dos son la Fase 1b leyendo lo vivo de
      // verdad. Un «swapped branch» que tratara «sabores no vino» como si
      // hubiera venido habría llamado `fuentesDeSabores(undefined)` SIN
      // tocar GitHub para esa parte — dos pedidos, no cuatro.
      expect(pedidos).toHaveLength(4)
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
        ...respuestasDeNingunaReversionPendiente(),                                      // revisaLaCabeza()
        { cuerpo: { object: { sha: 'cabezaNueva' } } },                                  // gh.ref
        { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },        // gh.comparaRefs
      ])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_QUE_ELLA_LEYO, documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(409)
      expect((r.cuerpo as { problema: string }).problema).toBe(
        'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.',
      )
      // Lo único que se pidió fue leer y comparar (más el costo fijo de
      // `revisaLaCabeza()`). Nada de blobs, árboles ni refs que se muevan.
      expect(pedidos.map((p) => p.metodo)).toEqual(['GET', 'GET', 'GET', 'GET'])
    })

    it('si lo que cambió en el medio NO es contenido, la publicación sigue', async () => {
      // Marcos arregló una plantilla. Eso no toca ningún documento del lote,
      // así que frenarla sería pedirle que reintente por nada.
      const { f } = fetchFalso([
        ...respuestasDeNingunaReversionPendiente(),                        // revisaLaCabeza()
        { cuerpo: { object: { sha: 'cabezaNueva' } } },                    // gh.ref
        { cuerpo: { files: [{ filename: 'src/pages/index.astro' }] } },    // gh.comparaRefs
        ...respuestasDeUnaPublicacionCompleta(),
      ])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_QUE_ELLA_LEYO, documentos: { sabores: saboresConUnPrecioDistinto() } }, cookie: cookieValida() },
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
        ...respuestasDeNingunaReversionPendiente(),
        { cuerpo: { object: { sha: 'cabezaNueva' } } },
        { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },
      ])
      const porElRouter = await maneja(
        'publicar',
        { cuerpo: { base: SHA_VIEJO, documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
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

  // Tarea 14: los avisos de conteo (`gravedad: 'avisa'`, `avisosDeConteo()`
  // en validacion.ts) vuelven a la respuesta de publicar. El aviso NUNCA
  // bloquea —por eso se calcula DESPUÉS de escribir, nunca antes: si se
  // calculara antes y algo fallara ahí, un aviso habría bloqueado una
  // publicación— pero hasta esta tarea se perdía en silencio: el sitio
  // podía decir «LOS 15 SABORES» arriba de una lista de dieciséis y nada
  // se enteraba.
  describe('los avisos de conteo en la respuesta de publicar (Tarea 14)', () => {
    // La cabeza de `main` en estos tests: coincide con `cuerpo.base`, así
    // que la Fase 2 nunca entra a la rama de «pisada» (`gh.comparaRefs`) —
    // un pedido menos que programar en cada caso.
    const SHA_BASE = SHA_MAIN

    // El documento real de `sabores.json`, leído del disco, con un sabor
    // más — nunca a mano (un fixture a mano se desincroniza del esquema y
    // el test empieza a probar otra cosa sin que nadie se entere), sino
    // clonando un elemento real y dándole una identidad propia: el mismo
    // truco que ya usa «de dónde salen las fuentes…», más arriba, para su
    // `saboresConUnoNuevo`.
    const conDieciseisSabores = () => {
      const doc = saboresCrudoDeDisco()
      const nuevo = JSON.parse(JSON.stringify(doc.sabores[0]))
      nuevo.orden = 16
      nuevo.slug = 'sabor-prueba-16'
      nuevo.nombre = 'Sabor de prueba n.º 16'
      doc.sabores.push(nuevo)
      return doc
    }

    // Lo vivo de `sitio` que el router va a leer para calcular los avisos
    // cuando `sitio` no vino en el lote (ver `publicarAccion`, el bloque de
    // avisos, después de `publica()`) — con el `anaquel.kicker` FABRICADO
    // acá, nunca el que diga hoy `src/contenido/datos/sitio.json`.
    //
    // [Revisión final de la rama, C1] Antes esto era el archivo del repo
    // tal cual y el primer test de abajo se apoyaba en que ese archivo
    // dijera «LOS 15 SABORES». Eso es un test que CONGELA contenido
    // editable, lo que `docs/tests-que-congelan-contenido.md` prohíbe con
    // todas las letras porque EL DEPLOY CORRE LOS TESTS: medido, con el
    // kicker renombrado a «NUESTROS SABORES» —una edición perfectamente
    // legítima de la clienta, sin ningún conflicto de conteo— este archivo
    // era el ÚNICO de los 57 que se ponía rojo; en producción eso es el
    // deploy fallando, la reversión automática deshaciéndole el cambio y
    // «No salió; lo dejé como estaba», una y otra vez, sin ninguna pista de
    // por qué. El desfase que estos tests necesitan se FABRICA en el
    // documento de prueba que se les pasa; lo que el repo diga hoy dejó de
    // importar.
    const sitioConKicker = (kicker: string) => {
      const doc = sitioCrudoDeDisco()
      doc.anaquel.kicker = kicker
      return serializa(esquemaSitio, doc)
    }

    /** Un `sitio` que dice quince cuando el lote publica dieciséis: el desfase que el aviso tiene que ver. */
    const SITIO_QUE_DICE_QUINCE = sitioConKicker('LOS 15 SABORES')
    /** Un `sitio` cuyo antetítulo no menciona ninguna cantidad: no hay nada que avisar sobre él. */
    const SITIO_SIN_CONTEO = sitioConKicker('NUESTROS SABORES')

    /**
     * Las respuestas que hacen falta para publicar `sabores` SOLO (sin
     * `sitio` en el lote) de punta a punta: el costo fijo de
     * `revisaLaCabeza()`, el sha base de la Fase 2, lo vivo de `sabores`
     * para el diff, las seis de `publica()` — y, recién DESPUÉS de esas
     * seis (el commit ya hecho), lo vivo de `sitio` que pide el cálculo de
     * avisos. El orden de esta lista es el orden real de los pedidos; si
     * el router alguna vez leyera `sitio` ANTES de escribir, `fetchFalso`
     * lo serviría igual (no valida orden por URL) pero el test 2 de abajo
     * —que exige el commit hecho aunque el cálculo de avisos reviente— es
     * el que de verdad vigila que el orden sea el correcto.
     *
     * `textoSitio` es el documento de `sitio` que el fetch falso va a
     * servir como «lo vivo»: cada test elige el suyo, y ninguno depende de
     * lo que el archivo del repo diga hoy (ver `sitioConKicker`, arriba).
     */
    const respuestasDeUnaPublicacionDeSabores = (textoSitio: string) => [
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { object: { sha: SHA_BASE } } }, // gh.ref (Fase 2: el sha base del lote)
      { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sabores): lo vivo, para el diff
      ...respuestasDeUnaPublicacionDirecta(), // las seis de publica()
      { cuerpo: { content: Buffer.from(textoSitio).toString('base64'), encoding: 'base64' } }, // archivoEnRef(sitio): DESPUÉS de escribir, para los avisos
    ]

    it('avisa cuando un texto menciona una cantidad que ya no coincide', async () => {
      // Ella agrega el sabor 16 y el texto del anaquel sigue diciendo «LOS
      // 15 SABORES». Publicar NO se bloquea —es su decisión, y puede ser
      // que lo arregle después— pero tiene que enterarse, porque desde su
      // pantalla el texto se ve perfecto: lo que está mal es la relación
      // entre dos cosas que no se ven juntas.
      const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores(SITIO_QUE_DICE_QUINCE)])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_BASE, documentos: { sabores: conDieciseisSabores() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(200)
      const avisos = (r.cuerpo as { avisos: Array<{ campo: string; titulo: string; detalle?: string }> }).avisos
      expect(avisos.map((a) => a.campo)).toContain('anaquel.kicker')
      // El texto de cada aviso es lo que ella lee (fase 6): sin jerga,
      // igual que cualquier otro texto de esta respuesta.
      for (const a of avisos) {
        expect(jergaEn(a.titulo), a.titulo).toBeNull()
        if (a.detalle) expect(jergaEn(a.detalle), a.detalle).toBeNull()
      }
    })

    it('un aviso NUNCA bloquea: el commit se hizo igual', async () => {
      const { f, pedidos } = fetchFalso([...respuestasDeUnaPublicacionDeSabores(SITIO_QUE_DICE_QUINCE)])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_BASE, documentos: { sabores: conDieciseisSabores() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect((r.cuerpo as { sha: string | null }).sha).not.toBeNull()
      expect(pedidos.some((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')).toBe(true)
    })

    it('cada aviso trae SOLO lo que la pantalla necesita: campo, título y detalle', async () => {
      // [Revisión final de la rama] La respuesta devolvía el `Problema`
      // completo de `validacion.ts`. `gravedad` es siempre `'avisa'` acá (los
      // de `'impide'` bloquearon la publicación mucho antes) y `arreglo`
      // nunca se produce: dos campos que la fase 6 iba a cablear sin que
      // signifiquen nada, y achicar un contrato después de eso es un cambio
      // incompatible. `detalle` se queda: es la segunda oración que ella LEE.
      const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores(SITIO_QUE_DICE_QUINCE)])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_BASE, documentos: { sabores: conDieciseisSabores() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      const avisos = (r.cuerpo as { avisos: Array<Record<string, unknown>> }).avisos
      expect(avisos.length).toBeGreaterThan(0)
      for (const a of avisos) {
        expect(Object.keys(a).sort()).toEqual(['campo', 'detalle', 'titulo'])
      }
    })

    it('sin nada que avisar, la lista viene VACÍA, nunca ausente', async () => {
      // Que el campo exista siempre es lo que le permite a la fase 6
      // escribir `avisos.length` sin un `?.` que esconda un bug de la
      // respuesta el día que este código deje de calcularlos.
      const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores(SITIO_SIN_CONTEO)])
      const r = await maneja(
        'publicar',
        { cuerpo: { base: SHA_BASE, documentos: { sabores: saboresConUnPrecioDistinto() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status).toBe(200)
      expect((r.cuerpo as { avisos: unknown[] }).avisos).toEqual([])
    })

    // El cuarto test que pide el brief («si calcular los avisos revienta,
    // la publicación ya está hecha») queda documentado acá en vez de
    // escrito. Se intentó construir un `sabores` que pasara
    // `validarContra(esquemaSabores, ...)` —condición obligatoria para que
    // el lote llegue a escribirse: si no pasa, el 422 sale ANTES, sin
    // commit, y un test así no probaría el orden que le importa a esta
    // tarea— y que a la vez le faltara a `conteosDe()` alguna de las
    // listas que la tabla de conteos (conteos.ts, `DONDE`) dice contar de
    // `sabores`: `sabores`, `gotas` y `polvo`. No hay forma: las tres son
    // listas con `minItems: 1` en el esquema (sabores.ts) — comprobado a
    // mano, borrando o vaciando cada una por separado, o cambiándole el
    // tipo: las tres formas de dejar a `conteosDe()` sin esa lista rompen
    // primero el ESQUEMA, con un 422 antes de escribir nada. Un `sabores`
    // que ya pasó su propio esquema no le puede faltar a `conteosDe()`
    // ninguna de las tres listas que lee de él.
    //
    // Un test que no puede fallar es peor que ninguno: ocupa lugar, da
    // falsa confianza, y el próximo que lo lea va a creer que ese camino
    // está cubierto. El `try/catch` que protege el cálculo de avisos
    // (`acciones.ts`, el bloque después de `publica()`) sigue ahí igual —
    // cubre el caso real de esta tarea, que es de RED: la lectura de
    // `sitio` o `sabores` vivo que hace falta para los avisos cuando
    // ninguno de los dos vino en el lote puede fallar (GitHub no
    // contesta), y esa falla tiene que dejar el `sha` de la respuesta sin
    // tocar— aunque ningún test la dispare con un documento inválido a
    // propósito, porque no existe ese documento.
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
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieEmitidaEn('2026-09-01T00:00:00Z') },
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
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
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
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieDeDispositivo('celu-perdido') },
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
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
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

  /*
   * [Revisión final de la rama] El normalizador tiene que ser IDEMPOTENTE:
   * `f(f(x)) === f(x)`. No lo era, y el borde estaba en el corte de los 64
   * caracteres, que puede caer justo después de un guion y dejarlo colgando —
   * algo que una segunda pasada sí sacaría.
   *
   * No es un detalle estético: el id viaja FIRMADO en la cookie, y Marcos lo
   * copia de un log a `PANEL_DISPOSITIVOS_REVOCADOS` a mano. Dos formas del
   * mismo id es exactamente cómo una revocación falla en silencio — el bug
   * que este normalizador existe para cerrar.
   */
  describe('idDeDispositivo es idempotente: normalizar dos veces da lo mismo que una', () => {
    // El caso del borde: 63 caracteres buenos, y el carácter 64 es el guion
    // que salió de normalizar un espacio. Sin el arreglo, la primera pasada
    // devuelve «aaa…a-» y la segunda «aaa…a»: dos ids distintos para el
    // mismo aparato.
    const JUSTO_EN_EL_CORTE = `${'a'.repeat(63)} b`

    it('el id que corta justo después de un guion no se lo queda colgando', () => {
      expect(idDeDispositivo(JUSTO_EN_EL_CORTE)).toBe('a'.repeat(63))
      expect(idDeDispositivo(JUSTO_EN_EL_CORTE).endsWith('-')).toBe(false)
    })

    it('una segunda pasada no cambia nada, para cualquier entrada rara', () => {
      const entradas = [
        JUSTO_EN_EL_CORTE,
        'iPhone 15, de Marcos',
        `${'a'.repeat(60)}    ${'b'.repeat(10)}`,
        'x'.repeat(200),
        `${'-'.repeat(70)}abc`,
        '   ',
        ',,,',
        '',
      ]
      for (const entrada of entradas) {
        const una = idDeDispositivo(entrada)
        expect(idDeDispositivo(una), JSON.stringify(entrada)).toBe(una)
      }
    })

    it('un nombre que empieza con muchos guiones NO colapsa a `sin-nombre`', () => {
      // `sin-nombre` es el id COMPARTIDO: cualquier aparato que caiga ahí
      // deja de poder revocarse por separado. Recortar los extremos solo
      // después del corte habría mandado este caso justo ahí.
      expect(idDeDispositivo(`${'-'.repeat(70)}abc`)).toBe('abc')
    })
  })

  it('C-2: y revocarlo funciona de punta a punta', async () => {
    const ctx = contextoBase(fetchQueNoSeUsa())
    ;(ctx.env as Record<string, string>).PANEL_DISPOSITIVOS_REVOCADOS = 'otro, iPhone-15-de-Marcos'
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieDeDispositivo('iPhone-15-de-Marcos') },
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

  it('I-6: la mitad de variables sigue abierta y anónima aunque el freno de `salud` en esa IP ya esté gastado', async () => {
    const ip = `i6-salud-vars-${Math.random()}`
    // Gasta el freno de `salud` (no el de `entrar`): [Ronda 1, Tarea 12,
    // hallazgo E] los contadores pasan a ser por ACCIÓN, así que desde
    // esta ronda ya no alcanza con gastarlo desde `entrar` — cada uno
    // tiene su propio presupuesto de cinco cada quince minutos.
    for (let i = 0; i < 5; i++) {
      await maneja('salud', { cuerpo: {}, cookie: '' }, { ...contextoBase(fetchQueNoSeUsa()), ip })
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

  // [Tarea 13] La vigilancia del vencimiento del PAT: la MISMA respuesta de
  // `gh.ref('heads/main')` que ya pedía `github` trae la cabecera del
  // vencimiento (github.ts), así que avisar no cuesta un pedido más. Como
  // `salud` no tiene sesión, el aviso lleva su PROPIO freno —una vez cada
  // 24 h por instancia—, aparte del freno por IP de I-6 que protege el
  // pedido a GitHub en sí.
  describe('Tarea 13: el aviso de vencimiento del token', () => {
    /** La cabecera de GitHub para un token que vence dentro de `dias` días desde `ahora`. */
    const cabeceraVence = (dias: number, ahora: number) => ({
      'github-authentication-token-expiration': new Date(ahora + dias * 86_400_000).toISOString(),
    })

    it('a treinta días o menos, INFORMA la fecha y los días que faltan', async () => {
      // [Revisión final de la rama, I6] Informa, y ya no manda el correo:
      // `salud` es la única puerta sin sesión, y su freno de una-vez-cada-24-h
      // vive en la memoria de UNA instancia. Durante los últimos treinta días
      // del token, cualquiera con un bucle de `curl` en paralelo provoca
      // instancias frías y cada una manda su propio correo a Marcos y gasta
      // su propio pedido del PAT. El correo pasó a `clienteDeGitHub()`, o sea
      // a toda acción AUTENTICADA (ver el describe I5, más abajo): más
      // cobertura y sin amplificador anónimo. Lo que `salud` sigue
      // contestando es lo que lee el `curl` del runbook.
      const ahora = 5_000_000_000_000
      // Se ANOTAN las cartas en vez de tirar desde el `correo` de prueba:
      // `mandaProtegido()` se traga cualquier excepción por diseño, así que
      // un correo que revienta pasaría inadvertido y este test no podría
      // fallar nunca. Lo que se afirma es la lista vacía.
      const cartas: Carta[] = []
      const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } }, cabeceras: cabeceraVence(30, ahora) }])
      const ctx = {
        ...contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
        ip: `t13-avisa-30-${Math.random()}`,
      }

      const r = await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)

      expect(r.status).toBe(200)
      const cuerpo = r.cuerpo as { tokenVence: string | null; diasParaVencer: number | null }
      expect(cuerpo.diasParaVencer).toBe(30)
      expect(cuerpo.tokenVence).toBeTruthy()
      expect(cartas).toEqual([]) // ni una carta desde la puerta sin sesión
    })

    it('I6: ni con el token vencido HOY `salud` le escribe a Marcos — es la puerta sin sesión', async () => {
      // El día del vencimiento es justo cuando el aviso más hace falta, así
      // que si alguna vez vuelve a mandarse desde acá, va a ser por este
      // camino: el test tiene que verlo.
      const ahora = 5_100_000_000_000
      const cartas: Carta[] = []
      const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } }, cabeceras: cabeceraVence(0, ahora) }])
      const r = await maneja(
        'salud',
        { cuerpo: {}, cookie: '' },
        {
          ...contextoDePrueba({
            fetch: f,
            ahora: () => ahora,
            correo: correoQueAnota(cartas),
            env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
          }),
          ip: `t13-vencido-hoy-${Math.random()}`,
        },
      )
      expect((r.cuerpo as { diasParaVencer: number | null }).diasParaVencer).toBe(0)
      expect(cartas).toEqual([])
    })

    it('I6: con el freno por IP gastado, `salud` no gasta ni un pedido del PAT', async () => {
      // El otro brazo del mismo hallazgo: el pedido a GitHub —lo que le cuesta
      // cuota al PAT, la misma que `publicar` necesita— tiene que quedar
      // detrás del freno por IP, no solo el correo. `fetchQueNoSeUsa()` es la
      // afirmación: si `salud` llegara a tocar la red, revienta.
      const ip = `i6-freno-pat-${Math.random()}`
      for (let i = 0; i < 5; i++) {
        const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } } }])
        await maneja('salud', { cuerpo: {}, cookie: '' }, { ...contextoBase(f), ip })
      }
      const r = await maneja('salud', { cuerpo: {}, cookie: '' }, { ...contextoBase(fetchQueNoSeUsa()), ip })
      expect(r.status).toBe(200)
      expect((r.cuerpo as { github: boolean | null }).github).toBeNull()
      expect((r.cuerpo as { problema?: string }).problema).toBeTruthy()
    })

    it('a treinta y un días, NO avisa', async () => {
      const cartas: Carta[] = []
      const ahora = 5_500_000_000_000 // más de 24 h del test anterior
      const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } }, cabeceras: cabeceraVence(31, ahora) }])
      const ctx = {
        ...contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
        ip: `t13-no-avisa-31-${Math.random()}`,
      }

      const r = await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)

      expect((r.cuerpo as { diasParaVencer: number | null }).diasParaVencer).toBe(31)
      expect(cartas).toHaveLength(0)
    })

    it('no avisa dos veces seguidas: una vez cada 24 h por instancia', async () => {
      // [I5/I6] El freno de 24 h sigue existiendo y sigue importando —más que
      // antes: ahora la vigilancia cuelga de CADA respuesta de GitHub, y una
      // sola publicación hace media docena de pedidos—, así que se mide donde
      // ahora vive: en una acción autenticada.
      const cartas: Carta[] = []
      const ahora = 9_000_000_000_000 // más de 24 h de los tests de arriba
      const cookieViva = firmaSesion(
        { correo: 'clienta@ejemplo.mx', vence: ahora + 86_400_000, dispositivo: 'test', emitida: ahora },
        SECRETO,
      )

      // Un `borrador.leer` que hace DOS pedidos a GitHub, los dos con la
      // cabecera: sin el freno serían dos correos por una sola acción.
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refBorrador' } }, cabeceras: cabeceraVence(10, ahora) },
        {
          cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64' },
          cabeceras: cabeceraVence(10, ahora),
        },
      ])
      await maneja(
        'borrador.leer',
        { cuerpo: {}, cookie: cookieViva },
        contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      expect(cartas).toHaveLength(1) // uno solo, no uno por pedido

      // Un minuto después, otra acción entera: el correo no se repite.
      const masTarde = ahora + 60_000
      const { f: f2 } = fetchFalso([
        { cuerpo: { object: { sha: 'refBorrador' } }, cabeceras: cabeceraVence(10, masTarde) },
        { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64' } },
      ])
      await maneja(
        'borrador.leer',
        { cuerpo: {}, cookie: cookieViva },
        contextoDePrueba({
          fetch: f2,
          ahora: () => masTarde,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      expect(cartas).toHaveLength(1) // sigue en uno: el freno de 24 h lo bloqueó
    })

    it('tokenVence: null (la cabecera no vino) no dispara ningún correo', async () => {
      const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } } }]) // sin `cabeceras`
      const ctx = {
        ...contextoDePrueba({
          fetch: f,
          correo: correoQueNoSeUsa(),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
        ip: `t13-sin-cabecera-${Math.random()}`,
      }

      const r = await maneja('salud', { cuerpo: {}, cookie: '' }, ctx)

      const cuerpo = r.cuerpo as { tokenVence: string | null; diasParaVencer: number | null }
      expect(cuerpo.tokenVence).toBeNull()
      expect(cuerpo.diasParaVencer).toBeNull()
    })
  })

  /*
   * [Revisión final de la rama, I5] La vigilancia ya no cuelga de `salud`.
   *
   * `salud` es la única acción que ningún flujo automático llama: el
   * escenario medido era que el token vence en cuarenta días, ella publica
   * todos los días, Marcos no corre el `curl` del runbook porque nada se lo
   * recuerda, y el aviso de los treinta días no sale NUNCA — el día D ella
   * recibe un 502 incomprensible, que es el modo de falla que la Tarea 13
   * existía para evitar. Ahora la vigilancia va colgada de `alResponder`
   * (github.ts), que `clienteDeGitHub()` le pone a toda acción autenticada.
   *
   * `borrador.leer` es la acción más barata para probarlo: un solo pedido a
   * GitHub, sin `revisaLaCabeza()` de por medio.
   */
  describe('I5: cualquier acción autenticada dispara la vigilancia, no solo `salud`', () => {
    const cabeceraVence = (dias: number, ahora: number) => ({
      'github-authentication-token-expiration': new Date(ahora + dias * 86_400_000).toISOString(),
    })

    // Los `ahora` de estos tests están lejísimos en el futuro —el freno del
    // aviso es una clave GLOBAL de 24 h que comparte todo el archivo— así
    // que la cookie tiene que estar viva EN ESE instante, no en el de hoy.
    const cookieVivaEn = (ahora: number) =>
      firmaSesion({ correo: 'clienta@ejemplo.mx', vence: ahora + 86_400_000, dispositivo: 'test', emitida: ahora }, SECRETO)

    it('`borrador.leer` avisa a Marcos cuando faltan treinta días o menos', async () => {
      const cartas: Carta[] = []
      // Lejos de los `ahora` de los tests de arriba: el freno del aviso es
      // una clave GLOBAL de 24 h, compartida por todo el archivo.
      const ahora = 12_000_000_000_000
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refBorrador' } }, cabeceras: cabeceraVence(12, ahora) },
        { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64' } },
      ])
      const r = await maneja(
        'borrador.leer',
        { cuerpo: {}, cookie: cookieVivaEn(ahora) },
        contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )

      expect(r.status).toBe(200)
      expect(cartas).toHaveLength(1)
      expect(cartas[0].a).toEqual(['marcos@ejemplo.mx'])
      expect(cartas[0].asunto).toContain('12')
    })

    it('avisa aunque el pedido a GitHub haya FALLADO: es el día en que más hace falta', async () => {
      // El 401 del token ya vencido sigue trayendo la cabecera. Si la
      // vigilancia corriera solo después de una respuesta buena, el aviso
      // se apagaría exactamente el día que el token muere.
      const cartas: Carta[] = []
      const ahora = 13_000_000_000_000
      const { f } = fetchFalso([
        { status: 401, cuerpo: { message: 'Bad credentials' }, cabeceras: cabeceraVence(0, ahora) },
      ])
      const r = await maneja(
        'borrador.leer',
        { cuerpo: {}, cookie: cookieVivaEn(ahora) },
        contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )

      expect(r.status).toBe(502) // el pedido falló, y eso se le contesta igual
      expect(cartas).toHaveLength(1)
    })

    it('a treinta y un días, ninguna acción autenticada avisa', async () => {
      const ahora = 14_000_000_000_000
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refBorrador' } }, cabeceras: cabeceraVence(31, ahora) },
        { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64' } },
      ])
      const r = await maneja(
        'borrador.leer',
        { cuerpo: {}, cookie: cookieVivaEn(ahora) },
        contextoDePrueba({
          fetch: f,
          ahora: () => ahora,
          correo: correoQueNoSeUsa(),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      expect(r.status).toBe(200)
    })

    it('`salud` sigue SIN la vigilancia colgada: es la única puerta sin sesión', async () => {
      // `clienteDeGitHub()` le cuelga el aviso a cada respuesta; `salud`
      // arma su cliente a mano justamente para no darle a cualquiera con un
      // `curl` una forma de hacer que el panel le escriba a Marcos. Lo que
      // sí manda es su propio aviso, una vez cada 24 h por instancia — y
      // este test corre con el freno de 24 h ya gastado por los de arriba,
      // así que lo que mide es que NO salga un correo por pedido.
      const ahora = 14_000_000_100_000 // dentro de las 24 h del test anterior
      const { f } = fetchFalso([{ cuerpo: { object: { sha: 'x' } }, cabeceras: cabeceraVence(5, ahora) }])
      const cartas: Carta[] = []
      const r = await maneja(
        'salud',
        { cuerpo: {}, cookie: '' },
        {
          ...contextoDePrueba({
            fetch: f,
            ahora: () => ahora,
            correo: correoQueAnota(cartas),
            env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
          }),
          ip: `i5-salud-${Math.random()}`,
        },
      )
      expect(r.status).toBe(200)
      expect((r.cuerpo as { diasParaVencer: number | null }).diasParaVencer).toBe(5)
      expect(cartas).toEqual([])
    })
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
    for (const accion of ['borrador', 'revertir']) {
      const r = await maneja(accion, { cuerpo: {}, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
      expect(r.status).toBe(404)
    }
  })
})

// Tarea 7: «¿ya está en el sitio?» (spec §4.5). Cruza dos fuentes — la
// plataforma dice qué pasó con el despliegue, `version.json` dice qué
// commit está sirviendo el CDN AHORA — y desde la inversión de precedencia
// las dos se leen SIEMPRE, no una condicionada a la otra: el `fetchFalso`
// de cada test que llega a tocar red programa DOS respuestas para esa
// acción, en ese orden, sin importar qué haya contestado la primera (ver
// `cdnSirviendoLoViejo()`, arriba, para los que ejercitan un despliegue
// `'falló'`). El cálculo del veredicto en sí lo cubre `test/estado.test.ts`;
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
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(), primero que nada
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
    // de un caché intermedio, deja de decir qué está sirviendo AHORA. Índice
    // 3: los dos primeros pedidos son el costo fijo de `revisaLaCabeza()`.
    expect(pedidos[3].url).toContain('/version.json?')
  })

  it('si version.json no contesta, no se canta «listo»: se sigue esperando', async () => {
    // Una de las dos fuentes caída no puede convertirse en un «sí» por
    // omisión. La respuesta correcta es «todavía no sé», que es enCurso.
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(), primero que nada
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

  it('T7-2: sin ningún nombre de proyecto, 503 y ni un pedido a la red', async () => {
    // Sin esta guardia el código seguía en silencio y le preguntaba a la
    // plataforma por un proyecto sin nombre: terminaba en un 502 seguro pero
    // MUDO, que le dice a Marcos «no pudimos conectarnos» cuando lo que pasa
    // es que falta una variable. Son dos diagnósticos distintos y él
    // necesita el segundo. Una guardia sin test es una intención, no un
    // candado —ya pasó una vez en este panel con `PANEL_SECRETO` ausente—.
    //
    // [Ronda 3, Grupo 1] Antes, esta misma guardia «pasaba» por la razón
    // podrida: `fetchFalso([])` tira apenas se lo llama, `revisaLaCabeza()`
    // se traga esa excepción en su propio `try`, y el pedido nunca se
    // registra — el test no podía distinguir «nunca se llamó a `fetch`» de
    // «se llamó y falló en silencio». `contando()` (no `fetchFalso`) cierra
    // ese hueco: cuenta cada llamada de verdad, la deje pasar quien la deje
    // pasar.
    const sha = 'a'.repeat(40)
    const usos = { n: 0 }
    const r = await maneja('estado', { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() }, sinNombreDeProyecto(contando(usos)))
    expect(r.status).toBe(503)
    expect(usos.n, 'la guardia corta antes de gastar un pedido').toBe(0)
  })

  // Ronda 3, Grupo 1: `revisaLaCabeza()` corre en `estadoAccion` DESPUÉS de
  // sus tres validaciones baratas y sincrónicas (token ausente, proyecto sin
  // nombre, `sha` mal formado) — el mismo criterio que `publicarAccion`
  // (Grupo C, ronda 2). Medido en la re-revisión: antes de este arreglo, un
  // `sha` mal formado gastaba un pedido REAL a GitHub antes de contestar 400.
  it('Ronda 3, Grupo 1: un `sha` mal formado no toca GitHub', async () => {
    const usos = { n: 0 }
    const r = await maneja(
      'estado',
      { cuerpo: { sha: 'no-es-un-sha', publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoBase(contando(usos)),
    )
    expect(r.status).toBe(400)
    expect(usos.n, 'la guardia corta antes de gastar un pedido').toBe(0)
  })

  it('B10: NINGUNA respuesta de `estado` le habla a la clienta con jerga, ni las frases compartidas', async () => {
    // Las frases del router (sesión inválida, «algo salió mal», «no pudimos
    // revisar el contenido») las comparten varias acciones, así que se
    // pueden editar desde cualquier lado. Este test recorre TODAS las
    // salidas posibles de `estado` —no solo las que produce `decide()`— y
    // las pasa por la misma lista. Es el único lugar donde esas frases
    // compartidas quedan atadas a la regla.
    const sha = 'a'.repeat(40)
    const salidas: string[] = []

    // 401: sin sesión.
    {
      const { f } = fetchFalso([])
      const r = await maneja('estado', { cuerpo: {}, cookie: '' }, contextoBase(f))
      const c = r.cuerpo as { problema?: string; frase?: string }
      salidas.push(c.problema ?? c.frase ?? '')
    }

    // 400: un sha que no matchea la forma de 40 hex.
    {
      const r = await maneja(
        'estado',
        { cuerpo: { sha: 'no-es-un-sha' }, cookie: cookieValida() },
        contextoBase(fetchQueNoSeUsa()),
      )
      const c = r.cuerpo as { problema?: string; frase?: string }
      salidas.push(c.problema ?? c.frase ?? '')
    }

    // 503: sin PANEL_VERCEL_TOKEN, no hay forma de preguntarle a la plataforma.
    {
      const ctx = contextoBase(fetchQueNoSeUsa())
      delete (ctx.env as Record<string, string | undefined>).PANEL_VERCEL_TOKEN
      const r = await maneja('estado', { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() }, ctx)
      const c = r.cuerpo as { problema?: string; frase?: string }
      salidas.push(c.problema ?? c.frase ?? '')
    }

    // 502: la plataforma no contesta al pedirle el despliegue.
    {
      const { f } = fetchFalso([{ status: 500, cuerpo: {} }])
      const r = await maneja(
        'estado',
        { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
        contextoBase(f),
      )
      const c = r.cuerpo as { problema?: string; frase?: string }
      salidas.push(c.problema ?? c.frase ?? '')
    }

    // El assert de longitud no es decorativo: sin él, una rama que empiece a
    // devolver un cuerpo sin frase dejaría este test verde sobre una lista
    // vacía.
    expect(salidas.filter((s) => s !== '')).toHaveLength(4)
    for (const frase of salidas) {
      expect(jergaEn(frase), frase).toBeNull()
    }
  })

  // Tarea 8 (spec §4.6): «el sitio se arregla solo y las dos personas se
  // enteran». `estadoAccion` es quien VE el fracaso —la primera de las dos
  // fuentes ya dice `falló`, así que ni se llega a preguntar por
  // `version.json`— y por eso es quien dispara la reversión automática.
  it('cuando el despliegue falla, revierte y avisa a las dos personas', async () => {
    const cartas: Array<{ a: string[]; asunto: string }> = []
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(), primero que nada
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      respuestaDelCommitParaElAutor(sha), // revierteYAvisa() lee el autor real ANTES de revierte()
      ...respuestasDeUnaReversionCompleta(sha),
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        ahora: () => 6_000,
        correo: async (c) => { cartas.push(c); return { ok: true } },
        env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
      }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('falló')
    // Uno a Marcos, con el detalle; uno a ella, con su frase.
    //
    // [Revisión final de la rama, I4] En ESE orden, que se invirtió a
    // propósito: la frase que ella lee promete «ya le avisé a Marcos», y eso
    // no se puede prometer antes de haberlo intentado.
    expect(cartas).toHaveLength(2)
    expect(cartas[0].a).toEqual(['marcos@ejemplo.mx'])
    expect(cartas[1].a).toEqual(['clienta@ejemplo.mx']) // el correo de la sesión de prueba (cookieValida())
  })

  it('si el correo no está configurado, la reversión igual pasa', async () => {
    // B3: el aviso degrada, la reversión no. Lo importante es que el sitio
    // quede sano; el correo es para que ella se entere sin estar mirando.
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      respuestaDelCommitParaElAutor(sha),
      ...respuestasDeUnaReversionCompleta(sha),
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: async () => ({ ok: false, motivo: 'sin-configurar' as const }) }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('falló')
  })

  // Ronda 2, Grupo B: el camino MEDIDO como normal por la revisión —ella
  // publica, su commit ES la cabeza, y el panel sondea por ese mismo sha—
  // antes mandaba CUATRO correos (dos idénticos a ella, uno de
  // `revisaLaCabeza()` y otro de `estadoAccion`). Con el trabajo repartido
  // —`revisaLaCabeza()` solo le habla a Marcos, `estadoAccion` no repite el
  // revert ni el aviso a Marcos cuando `revisaLaCabeza()` ya atendió ESE
  // sha— quedan dos: uno a cada quien.
  it('Ronda 2, Grupo B: cuando su propio commit es la cabeza rota, van dos correos, no cuatro', async () => {
    const cartas: Array<{ a: string[]; asunto: string; texto: string }> = []
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      { cuerpo: { object: { sha } } }, // gh.ref (revisaLaCabeza)
      {
        cuerpo: {
          sha,
          tree: { sha: 't' },
          message: 'cambia algo\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'padre' }],
        },
      }, // gh.commit (revisaLaCabeza)
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // vercel (revisaLaCabeza)
      cdnSirviendoLoViejo(), // version.json — revisaLaCabeza() también consulta al CDN antes de revertir (Ronda 3)
      ...respuestasDeUnaReversionCompleta(sha), // revierte() dentro de revierteYAvisaAMarcos()
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // vercel (la lectura propia de estadoAccion)
      cdnSirviendoLoViejo(), // version.json — la lectura propia de estadoAccion, SIEMPRE
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        ahora: () => 6_000,
        correo: async (c) => { cartas.push(c); return { ok: true } },
        env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
      }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('falló')
    expect(cartas).toHaveLength(2)
    // Primero Marcos —lo avisó `revisaLaCabeza()`, con el autor real del
    // trailer— y recién después ella, sin que nadie haya vuelto a tocar
    // GitHub por el mismo sha.
    expect(cartas[0].a).toEqual(['marcos@ejemplo.mx'])
    expect(cartas[0].texto).toContain('clienta@ejemplo.mx')
    expect(cartas[1].a).toEqual(['clienta@ejemplo.mx'])
  })

  /*
   * [Revisión final de la rama, I3] `ya-revertido` significaba cosas OPUESTAS
   * en los dos consumidores de `revierte()`: `deshacerAccion` lo trataba como
   * éxito, `intentaRevertir()` lo mandaba al `default` y reportaba «NO se
   * pudo revertir».
   *
   * Escenario medido: deploy fallido. Primer sondeo, la reversión corre bien
   * y a Marcos le llega «revertido (commit X)». Ella refresca la pestaña.
   * Segundo sondeo: la cabeza ya es la reversión, así que `revisaLaCabeza()`
   * se va sin hacer nada, pero `despliegueDe(shaViejo)` sigue diciendo
   * `falló` y sale un segundo correo diciéndole a Marcos que la reversión
   * FALLÓ — cuando funcionó. Marcos sale a arreglar a mano un repo sano.
   *
   * Esto estaba parqueado como «un recargue vuelve a disparar el par de
   * correos». Es peor que eso: es una falsa alarma que contradice al correo
   * anterior.
   */
  describe('I3: el segundo sondeo, después de que ella refresca la pestaña', () => {
    const sha = 'a'.repeat(40)
    const shaRevert = 'b'.repeat(40)
    const commitRevert = {
      sha: shaRevert,
      tree: { sha: 't' },
      message: `deshace un cambio\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx\nPanel-Revierte: ${sha}`,
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha }],
    }
    const commitRoto = {
      sha,
      tree: { sha: 't' },
      message: 'cambia algo\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx',
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha: 'padre' }],
    }
    const elSegundoSondeo = () => [
      { cuerpo: { object: { sha: shaRevert } } }, // revisaLaCabeza: gh.ref — la cabeza YA es la reversión
      { cuerpo: commitRevert }, // revisaLaCabeza: gh.commit → es una reversión, se va sin tocar nada
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // el deploy VIEJO sigue marcado como fallido
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      { cuerpo: commitRoto }, // revierteYAvisa: el autor real
      { cuerpo: { object: { sha: shaRevert } } }, // revierte(): gh.ref
      { cuerpo: commitRevert }, // revierte(): la cabeza ya revierte este sha → `ya-revertido`
    ]

    it('el correo a Marcos NO dice que la reversión falló: ya estaba hecha', async () => {
      const cartas: Carta[] = []
      const { f } = fetchFalso([...elSegundoSondeo()])
      await maneja(
        'estado',
        { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
        contextoDePrueba({
          fetch: f,
          ahora: () => 6_000,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      const aMarcos = cartas.find((c) => c.a.includes('marcos@ejemplo.mx'))!
      expect(aMarcos).toBeDefined()
      expect(aMarcos.texto).not.toContain('NO se pudo revertir')
      expect(aMarcos.texto).toContain('ya estaba revertido')
    })

    it('y a ella se le sigue diciendo que lo dejó como estaba, porque es verdad', async () => {
      const cartas: Carta[] = []
      const { f } = fetchFalso([...elSegundoSondeo()])
      const r = await maneja(
        'estado',
        { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
        contextoDePrueba({
          fetch: f,
          ahora: () => 6_000,
          correo: correoQueAnota(cartas),
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      expect((r.cuerpo as { frase: string }).frase).toBe('No salió; lo dejé como estaba y ya le avisé a Marcos.')
      const aElla = cartas.find((c) => c.a.includes('clienta@ejemplo.mx'))!
      expect(aElla.texto).toContain('lo dejé como estaba')
    })
  })

  /*
   * [Revisión final de la rama, I4] La otra mitad: la frase promete un correo
   * que puede no existir. El correo degrada por diseño —sin las variables,
   * `mandaProtegido()` loguea y sigue— y el escenario medido es que todavía
   * son un trámite de DNS: ella lee que Marcos ya sabe, Marcos no sabe nada,
   * y los dos esperan al otro.
   */
  describe('I4: la frase no promete un correo que no salió', () => {
    const sha = 'a'.repeat(40)
    const respuestas = () => [
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      respuestaDelCommitParaElAutor(sha),
      ...respuestasDeUnaReversionCompleta(sha),
    ]

    it('sin PANEL_AVISOS_A, la frase deja de decir «ya le avisé a Marcos»', async () => {
      const { f } = fetchFalso([...respuestas()])
      const r = await maneja(
        'estado',
        { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: async () => ({ ok: true as const }) }),
      )
      const frase = (r.cuerpo as { frase: string }).frase
      expect(frase).not.toContain('ya le avisé a Marcos')
      expect(frase).toContain('Avísale a Marcos')
      expect(jergaEn(frase), frase).toBeNull()
    })

    it('con el correo sin configurar (degrada), tampoco lo promete — y el correo a ella dice lo mismo', async () => {
      const cartas: Carta[] = []
      const { f } = fetchFalso([...respuestas()])
      const r = await maneja(
        'estado',
        { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
        contextoDePrueba({
          fetch: f,
          ahora: () => 6_000,
          correo: async (c) => {
            cartas.push(c)
            return { ok: false, motivo: 'sin-configurar' as const }
          },
          env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
        }),
      )
      const frase = (r.cuerpo as { frase: string }).frase
      expect(frase).not.toContain('ya le avisé a Marcos')
      // El correo a ella no sale tampoco (está sin configurar), pero si
      // saliera, diría exactamente lo mismo que la pantalla: es la misma
      // frase, no dos textos que se puedan desincronizar.
      const aElla = cartas.find((c) => c.a.includes('clienta@ejemplo.mx'))!
      expect(aElla.texto.startsWith(frase)).toBe(true)
    })
  })

  // Ronda 2, F-5: la copia nueva para ELLA —a diferencia de las frases de
  // `estado`, que ya pasan por `JERGA_PROHIBIDA` en el test B10— no tenía
  // ningún candado. El texto de hoy está bien; este test es el que protege
  // a la próxima edición.
  it('F5: el correo para ella nunca usa jerga técnica', async () => {
    const cartas: Array<{ a: string[]; asunto: string; texto: string }> = []
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      respuestaDelCommitParaElAutor(sha),
      ...respuestasDeUnaReversionCompleta(sha),
    ])
    await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: async (c) => { cartas.push(c); return { ok: true } } }),
    )
    const paraElla = cartas.find((c) => c.a.includes('clienta@ejemplo.mx'))
    expect(paraElla).toBeDefined()
    const texto = `${paraElla!.asunto} ${paraElla!.texto}`
    expect(jergaEn(texto), texto).toBeNull()
  })

  // Ronda 2, F-2: los `await contexto.correo(...)` de la reversión están
  // protegidos por su propio `try` (`mandaProtegido()`, acciones.ts) — no
  // dependen en silencio de la promesa de OTRO módulo («`manda()` nunca
  // tira»). Acá el `correo` de prueba rompe esa promesa a propósito
  // (revienta en vez de degradar) para probar que igual no se lleva puesta
  // la acción.
  it('F2: si el correo revienta en vez de degradar, la reversión y la acción igual terminan', async () => {
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(),
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
      cdnSirviendoLoViejo(), // version.json — SIEMPRE, ya no solo si el despliegue da 'listo'
      respuestaDelCommitParaElAutor(sha),
      ...respuestasDeUnaReversionCompleta(sha),
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        ahora: () => 6_000,
        correo: async () => { throw new Error('el proveedor de correo explotó') },
      }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('falló')
  })

  /*
   * Ronda 2 del arreglo de precedencia: el CDN manda sobre el reporte de la
   * plataforma incluso cuando lo que ese reporte dispara es un EFECTO
   * SECUNDARIO — revertir un commit. Si el CDN ya sirve el sha publicado,
   * `estadoAccion` no puede disparar `revierteYAvisa()`: estaría destruyendo
   * un cambio que está funcionando, servido de verdad, por un reporte de la
   * plataforma equivocado.
   *
   * OJO al verificar esto: desde la Ronda 1, `decide()` ya devuelve 'listo'
   * en cuanto `shaServido === shaPublicado`, sin mirar `despliegue` — así
   * que el veredicto por sí solo NO alcanza para probar que el revert no se
   * disparó (daría 'listo' de cualquier manera, revierta o no). Lo que
   * prueba que no se disparó es que no salió ningún pedido de más —ni el
   * del autor real, ni los de `revierte()`— y ninguna carta.
   */
  it('Ronda 2: si el CDN ya sirve el sha publicado, NO se revierte aunque la plataforma diga que falló', async () => {
    const cartas: Array<{ a: string[]; asunto: string }> = []
    const sha = 'a'.repeat(40)
    const { f, pedidos } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(), primero que nada
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // la plataforma dice que falló
      { cuerpo: { sha, construido: '2026-09-17T12:00:00.000Z' } }, // pero el CDN YA sirve el sha publicado
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        ahora: () => 6_000,
        correo: async (c) => { cartas.push(c); return { ok: true } },
        env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
      }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('listo')
    expect((r.cuerpo as { frase: string }).frase).toBe('Tu cambio ya está en el sitio.')
    // Los cuatro pedidos programados y ni uno más: si `revierteYAvisa()` se
    // hubiera disparado, habría pedido el autor real (un quinto pedido) que
    // nadie programó, y `fetchFalso` lo hubiera registrado igual (se anota
    // ANTES de tirar por quedarse sin respuestas).
    expect(pedidos).toHaveLength(4)
    expect(cartas).toHaveLength(0)
  })

  /*
   * Ronda 2, degradación: que la plataforma no conteste no puede tapar al
   * CDN. Antes, un error de red al preguntarle a la plataforma cortaba acá
   * mismo con 502 — sin mirar nunca `version.json`, que podía estar
   * confirmando el sha publicado en ese mismo instante.
   */
  it('Ronda 2: si la plataforma no contesta pero el CDN ya sirve el sha publicado, igual da "listo"', async () => {
    const sha = 'a'.repeat(40)
    const { f, pedidos } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(),
      { status: 500, cuerpo: {} }, // la plataforma no contesta
      { cuerpo: { sha, construido: '2026-09-17T12:00:00.000Z' } }, // el CDN sí
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: correoQueNoSeUsa() }),
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { estado: string }).estado).toBe('listo')
    expect((r.cuerpo as { frase: string }).frase).toBe('Tu cambio ya está en el sitio.')
    expect(pedidos).toHaveLength(4)
  })

  // El otro lado de la degradación de arriba: si el CDN TAMPOCO confirma
  // (o tampoco contesta), de verdad no sabemos nada — ahí sigue
  // correspondiendo el 502 de siempre, porque falta la única fuente que
  // distingue «falló» de «todavía va». Que una fuente caída no se
  // convierta en un «sí» por omisión sigue valiendo para las dos.
  it('Ronda 2: si ni la plataforma ni el CDN contestan, sigue siendo 502', async () => {
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(),
      { status: 500, cuerpo: {} }, // la plataforma no contesta
      { status: 500, cuerpo: {} }, // el CDN tampoco
    ])
    const r = await maneja(
      'estado',
      { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: correoQueNoSeUsa() }),
    )
    expect(r.status).toBe(502)
  })

  // Ronda 2, F-1: mismo candado que la acción vecina (`estadoAccion`, arriba
  // en este archivo): sin `PANEL_VERCEL_PROYECTO` ni `GITHUB_REPO`,
  // `revisaLaCabeza()` no puede seguir en silencio preguntándole a la
  // plataforma por un proyecto sin nombre. Sin este candado, la plataforma
  // contesta «no hay despliegues», `estado !== 'falló'`, y la reversión
  // automática deja de existir sin loguear nada — medido en la revisión.
  it('F1: revisaLaCabeza() no le pregunta a la plataforma por un proyecto sin nombre', async () => {
    const cabezaRota = 'c'.repeat(40)
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: cabezaRota } } },
      {
        cuerpo: {
          sha: cabezaRota,
          tree: { sha: 't' },
          message: 'algo\n\nPanel: sí\nPanel-Autor: x',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'p' }],
        },
      },
      // Esta respuesta solo se consumiría si el candado NO existiera: sería
      // la de `vercel.despliegueDe()`, preguntando por un proyecto vacío.
      { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
    ])
    const ctx = contextoDePrueba({ fetch: f })
    delete (ctx.env as Record<string, string | undefined>).PANEL_VERCEL_PROYECTO
    delete (ctx.env as Record<string, string | undefined>).GITHUB_REPO
    const r = await maneja('publicar', { cuerpo: { base: SHA_MAIN, documentos: { fichas: {} } }, cookie: cookieValida() }, ctx)
    expect(r.status).toBe(422) // fichas: {} sigue su curso normal después
    // Solo el ref y el commit: nunca llegó a preguntarle nada a la plataforma.
    expect(pedidos).toHaveLength(2)
  })

  // [B1] La red de seguridad: si ella publicó y cerró el panel, y el deploy
  // falló diez minutos después con nadie mirando, la reversión de arriba
  // nunca corre —no hay nadie preguntando `estado`—. La próxima vez que
  // CUALQUIERA entre —acá, ella misma intentando otra publicación— lo
  // primero que pasa es que la cabeza rota se arregla, antes de que la
  // acción que la disparó haga lo suyo.
  //
  // [Ronda 2, Grupo C] `revisaLaCabeza()` corre DESPUÉS de las validaciones
  // baratas de `publicarAccion` (lote vacío, documento desconocido, `base`
  // ausente), así que el cuerpo de este test tiene que pasarlas todas —`base`
  // presente, un documento reconocido y no vacío— para llegar a ejercitarla;
  // el 422 que sigue (Fase 1a, `fichas: {}` no es un documento válido) es
  // puramente sincrónico, así que no gasta ni un pedido de más.
  //
  // [Ronda 2, Grupo B] Un solo correo, y a Marcos: `revisaLaCabeza()` ya no le
  // habla a «quien pidió» la acción (acá, ella misma) — nadie estaba mirando
  // el panel cuando el commit se rompió, así que no hay a quién más avisarle
  // del lado de la clienta en este instante.
  it('B1: cualquier acción autenticada revierte primero una cabeza rota que quedó colgada', async () => {
    const cartas: Array<{ a: string[]; asunto: string; texto: string }> = []
    const cabezaRota = 'b'.repeat(40)
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: cabezaRota } } }, // gh.ref (revisaLaCabeza)
      {
        cuerpo: {
          sha: cabezaRota,
          tree: { sha: 't' },
          message: 'cambia algo\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'padre' }],
        },
      }, // gh.commit: es del panel, no es una reversión
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // vercel.despliegueDe: falló
      cdnSirviendoLoViejo(), // version.json — revisaLaCabeza() también consulta al CDN antes de revertir (Ronda 3)
      ...respuestasDeUnaReversionCompleta(cabezaRota), // adentro de revierteYAvisaAMarcos()
    ])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: { fichas: {} } }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        correo: async (c) => { cartas.push(c); return { ok: true } },
        env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
      }),
    )
    // La acción que la disparó sigue su camino normal DESPUÉS: `fichas: {}`
    // no pasa el esquema — la limpieza de la cabeza no le cambia el
    // resultado a quien pidió.
    expect(r.status).toBe(422)
    // Y la cabeza rota SÍ se revirtió (bueno: no tenía contenido que
    // revertir — el mensaje de `respuestasDeUnaReversionCompleta` no toca
    // ningún documento — así que el correo lo cuenta con esas palabras, no
    // como «revertido»), y Marcos —y SOLO Marcos— se enteró.
    expect(cartas).toHaveLength(1)
    expect(cartas[0].a).toEqual(['marcos@ejemplo.mx'])
    expect(cartas[0].texto).toContain(cabezaRota)
    expect(cartas[0].texto).toContain('clienta@ejemplo.mx') // el autor real, del trailer — no de quien pidió esta publicación
  })

  /*
   * Ronda 3: el mismo blindaje que B1, de arriba, pero para EL CAMINO SIN
   * NADIE MIRANDO — que es justo por qué esto importa más ahí. `estadoAccion`
   * ya tiene su propia guardia (Ronda 2) para cuando alguien está sondeando;
   * `revisaLaCabeza()` es la red de seguridad que corre SOLA, sin que nadie
   * la pida, desde CUALQUIER acción autenticada (acá, `publicar`, que no
   * tiene ninguna guardia propia contra esto — la única protección posible
   * es la de `revisaLaCabeza()` misma). Si el reporte de la plataforma
   * está mal, este es el camino donde el panel revertiría por su cuenta una
   * publicación sana sin que nadie se entere en el momento — el resultado
   * más caro que tiene este sistema.
   *
   * Misma advertencia que en la Ronda 2: no alcanza con mirar el status
   * HTTP (acá, 422 por `fichas: {}`, que no cambia se revierta o no) — hay
   * que verificar el EFECTO. Cuatro pedidos programados y ni uno más, y
   * ninguna carta: si `revierteYAvisaAMarcos()` se hubiera disparado,
   * habría pedido el autor real y los pasos de `revierte()`, que nadie
   * programó, y habría mandado el correo a Marcos que este test prueba que
   * NO sale.
   */
  it('Ronda 3: si el CDN ya sirve la cabeza rota, revisaLaCabeza() NO la revierte', async () => {
    const cartas: Array<{ a: string[]; asunto: string }> = []
    const cabezaRota = 'b'.repeat(40)
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: cabezaRota } } }, // gh.ref (revisaLaCabeza)
      {
        cuerpo: {
          sha: cabezaRota,
          tree: { sha: 't' },
          message: 'cambia algo\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: 'padre' }],
        },
      }, // gh.commit: es del panel, no es una reversión
      { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } }, // la plataforma dice que falló
      { cuerpo: { sha: cabezaRota, construido: '2026-09-17T12:00:00.000Z' } }, // pero el CDN YA sirve esa cabeza
    ])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_MAIN, documentos: { fichas: {} } }, cookie: cookieValida() },
      contextoDePrueba({
        fetch: f,
        correo: async (c) => { cartas.push(c); return { ok: true } },
        env: { PANEL_AVISOS_A: 'marcos@ejemplo.mx' },
      }),
    )
    // La acción sigue su curso normal: `fichas: {}` sigue sin pasar el
    // esquema — abstenerse de revertir no le cambia el resultado a quien
    // pidió la publicación.
    expect(r.status).toBe(422)
    expect(pedidos).toHaveLength(4)
    expect(cartas).toHaveLength(0)
  })
})

// Tarea 9 (spec §4.6): el botón «Deshacer esta publicación», con su ventana
// de treinta minutos. La mecánica de revertir en sí (Tarea 8) ya está
// probada en `test/revertir.test.ts`; lo que cubren estos tests es la
// VENTANA, las frases para ella, y que `deshacerAccion` paga el mismo costo
// fijo de `revisaLaCabeza()` que `publicarAccion`/`estadoAccion`, en el
// mismo lugar del flujo (después de las validaciones baratas y
// sincrónicas, antes de cualquier otra cosa).
describe('accion=deshacer', () => {
  // La misma fecha fija que usa el resto de este archivo para los commits
  // de prueba (`respuestasDeUnaReversionCompleta`,
  // `respuestasDeNingunaReversionPendiente`).
  const PUBLICADO_EN = Date.parse('2026-09-17T12:00:00Z')

  /**
   * Un commit DEL PANEL cualquiera («Panel: sí», con padre): lo mínimo para
   * pasar el chequeo de trailer de `revisaLaCabeza()`/`revierte()` y el de
   * la ventana. `padre` por defecto es literal `'padre'` — el mismo valor
   * que después se usa como `base` en `gh.archivoEnRef(ruta, padre)`.
   */
  const commitDelPanel = (sha: string, padre = 'padre') => ({
    cuerpo: {
      sha,
      tree: { sha: 't' },
      message: 'cambia sabores\n\nPanel: sí',
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha: padre }],
    },
  })

  /**
   * Un commit hecho A MANO, sin «Panel: sí»: lo que hace que
   * `revisaLaCabeza()` se vaya sin tocar la plataforma (no es del panel,
   * nada que autorrevertir) y que `revierte()` lo rechace con
   * `no-es-del-panel`.
   */
  const commitDeMarcos = (sha: string, padre = 'padre') => ({
    cuerpo: {
      sha,
      tree: { sha: 't' },
      message: 'fix: un ajuste a mano',
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha: padre }],
    },
  })

  /**
   * Un commit de REVERSIÓN de `sha` — la forma exacta que deja `publica()`
   * cuando `revierte()` lo escribe (Tarea 8): «Panel: sí» + `Panel-Revierte:`.
   */
  const commitDeReversion = (reversionSha: string, sha: string) => ({
    cuerpo: {
      sha: reversionSha,
      tree: { sha: 't' },
      message: `Deshace un cambio\n\nPanel: sí\nPanel-Autor: alguien\nPanel-Revierte: ${sha}`,
      author: { date: '2026-09-17T12:00:00Z' },
      parents: [{ sha }],
    },
  })

  /**
   * Las catorce respuestas del camino FELIZ completo: `revisaLaCabeza()`
   * (3, con el despliegue de `sha` en `READY` — nada que autorrevertir),
   * la lectura propia de `deshacerAccion` para la ventana (1), y
   * `revierte()` de punta a punta sobre `sabores.json` (3 + 1 +
   * `respuestasDeUnaPublicacionDirecta()`). La usan tanto el camino feliz
   * de siempre como el test del borde exacto de la ventana — extraída para
   * no repetir las catorce líneas dos veces.
   */
  const respuestasDeUnDeshacerExitoso = (sha: string) => {
    const c = commitDelPanel(sha)
    return [
      { cuerpo: { object: { sha } } }, // gh.ref (revisaLaCabeza)
      c, // gh.commit (revisaLaCabeza)
      { cuerpo: { deployments: [{ state: 'READY', url: 'maracacao-x.vercel.app' }] } }, // vercel.despliegueDe (revisaLaCabeza): el despliegue de ESTE commit salió bien, nada que autorrevertir
      c, // gh.commit (deshacerAccion: lee la fecha del commit, para la ventana)
      { cuerpo: { object: { sha } } }, // gh.ref (dentro de revierte())
      c, // gh.commit (dentro de revierte())
      { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } }, // gh.comparaRefs(padre, sha)
      { cuerpo: { content: Buffer.from(textoSaboresVivo).toString('base64'), encoding: 'base64' } }, // gh.archivoEnRef(sabores, padre): el contenido VIEJO
      ...respuestasDeUnaPublicacionDirecta(),
    ]
  }

  it('deshace la última publicación y devuelve el resumen', async () => {
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso(respuestasDeUnDeshacerExitoso(sha))
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }), // un minuto después: adentro de la ventana
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { ok: boolean; resumen: string }).ok).toBe(true)
    expect((r.cuerpo as { resumen: string }).resumen).toBe('Listo, lo dejé como estaba antes.')
  })

  it('[Revisión final] el tope de cuerpo NO se compara contra el pedido de deshacer', async () => {
    // El cuerpo de un deshacer son unos cincuenta bytes (`{ sha }`), así que
    // pasárselo a `revierte()` como cota de lo que se escribe comparaba el
    // tope de 3,5 MB contra el número equivocado: quedaba desactivado en ese
    // camino (inocuo hoy) y, al revés, un `Content-Length` inflado —que lo
    // elige quien manda el pedido— frenaba un deshacer perfectamente
    // legítimo. Lo que se escribe son los ARCHIVOS VIEJOS que se restauran, y
    // ésos los mide `publica()` sola.
    const sha = 'd'.repeat(40)
    const { f } = fetchFalso(respuestasDeUnDeshacerExitoso(sha))
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      {
        ...contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
        bytesDelCuerpo: TOPE_CUERPO + 1,
      },
    )
    expect(r.status).toBe(200)
  })

  it('pasados los 30 minutos, ya no se puede: manda al historial', async () => {
    // No es una limitación técnica —el commit sigue ahí— sino la línea entre
    // «me equivoqué recién» y «quiero volver a una versión vieja», que son
    // dos gestos distintos con dos pantallas distintas (spec §4.6).
    const sha = 'b'.repeat(40)
    const { f } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(): costo fijo, primero que nada — la cabeza de main no es este commit
      commitDelPanel(sha), // gh.commit (deshacerAccion: lee la fecha del commit, para la ventana)
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 31 * 60_000 }), // 31 minutos después: fuera de la ventana
    )
    expect(r.status).toBe(409)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.',
    )
  })

  it('B8: si ya publicó otra cosa encima, tampoco: manda al historial', async () => {
    // Dentro de la ventana, pero la cabeza de main ya no es este commit:
    // deshacerlo desde acá pisaría lo que sea que se publicó después.
    const sha = 'c'.repeat(40)
    const otraCabeza = commitDeMarcos('otraCabeza')
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'otraCabeza' } } }, // gh.ref (revisaLaCabeza): Marcos publicó algo después
      otraCabeza, // gh.commit (revisaLaCabeza): sin «Panel: sí», se va sin tocar la plataforma
      commitDelPanel(sha), // gh.commit (deshacerAccion: lee la fecha de SU commit, para la ventana — pasa)
      { cuerpo: { object: { sha: 'otraCabeza' } } }, // gh.ref (dentro de revierte()): la cabeza sigue siendo la de Marcos
      otraCabeza, // gh.commit (dentro de revierte()): ¿la cabeza revierte `sha`? no — es no-es-la-cabeza
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(409)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.',
    )
  })

  it('si el contenido viejo ya no pasa las reglas de hoy, lo dice y ofrece el borrador', async () => {
    // El esquema pudo haber cambiado entre medio. Publicar a la fuerza
    // rompería el sitio; callarse dejaría a la clienta apretando un botón
    // que no hace nada.
    const sha = 'd'.repeat(40)
    const c = commitDelPanel(sha)
    const saboresRotos = saboresCrudoDeDisco()
    delete saboresRotos.sabores[0].precio // le falta un campo que el esquema exige: no valida
    const { f } = fetchFalso([
      { cuerpo: { object: { sha } } },
      c,
      { cuerpo: { deployments: [{ state: 'READY', url: 'x.vercel.app' }] } },
      c,
      { cuerpo: { object: { sha } } },
      c,
      { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },
      { cuerpo: { content: Buffer.from(JSON.stringify(saboresRotos)).toString('base64'), encoding: 'base64' } },
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(422)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Ese contenido ya no cumple con las reglas de hoy. Puedo abrírtelo como borrador para que lo ajustes.',
    )
  })

  it('sin sesión, 401', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja('deshacer', { cuerpo: { sha: 'a'.repeat(40) }, cookie: '' }, contextoDePrueba({ fetch: f }))
    expect(r.status).toBe(401)
    expect(pedidos).toHaveLength(0)
  })

  it('un `sha` mal formado no toca GitHub', async () => {
    // Mismo criterio que `estadoAccion` (Ronda 3, Grupo 1): las
    // validaciones baratas y sincrónicas —acá, la forma del `sha`— corren
    // ANTES de `revisaLaCabeza()`, que es la primera en tocar la red.
    // `contando()` y no `fetchFalso`: mide cada llamada de verdad, la deje
    // pasar quien la deje pasar (ver el Paso 0 de esta tarea).
    const usos = { n: 0 }
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha: 'no-es-un-sha' }, cookie: cookieValida() },
      contextoDePrueba({ fetch: contando(usos) }),
    )
    expect(r.status).toBe(400)
    expect(usos.n, 'la guardia corta antes de gastar un pedido').toBe(0)
  })

  it('si ya está deshecho, la respuesta es éxito, no error: mentirle sobre el estado del sitio sería peor', async () => {
    // Puede pasar sola —la reversión automática ya lo arregló porque el
    // despliegue de ESTE commit falló, y `revisaLaCabeza()` corrió primero,
    // antes que el resto de `deshacerAccion` (ver su docstring)— o porque
    // alguien ya apretó el botón antes que ella. Desde donde ella lo mira,
    // el sitio está como quería: eso es un éxito, no un fracaso.
    const sha = 'e'.repeat(40)
    const reversionSha = 'f'.repeat(40)
    const reversion = commitDeReversion(reversionSha, sha)
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: reversionSha } } }, // gh.ref (revisaLaCabeza): la cabeza YA es la reversión
      reversion, // gh.commit (revisaLaCabeza): es del panel Y ya es una reversión — se va sin tocar la plataforma
      commitDelPanel(sha), // gh.commit (deshacerAccion: lee la fecha del commit que ella quiere deshacer, para la ventana)
      { cuerpo: { object: { sha: reversionSha } } }, // gh.ref (dentro de revierte())
      reversion, // gh.commit (dentro de revierte()): ¿la cabeza revierte `sha`? sí
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { ok: boolean; sha: string | null; resumen: string }).ok).toBe(true)
    expect((r.cuerpo as { resumen: string }).resumen).toBe('Listo, lo dejé como estaba antes.')
  })

  it('un commit que no es del panel no se puede deshacer desde acá', async () => {
    const sha = '1'.repeat(40)
    const c = commitDeMarcos(sha)
    const { f } = fetchFalso([
      { cuerpo: { object: { sha } } }, // gh.ref (revisaLaCabeza)
      c, // gh.commit (revisaLaCabeza): sin «Panel: sí», se va
      c, // gh.commit (deshacerAccion: lee la fecha, para la ventana — pasa igual; no es eso lo que lo frena)
      { cuerpo: { object: { sha } } }, // gh.ref (dentro de revierte())
      c, // gh.commit (dentro de revierte()): confirma que no es del panel
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(403)
    expect((r.cuerpo as { problema: string }).problema).toBe('Ese cambio no se publicó desde aquí, así que no lo puedo deshacer.')
  })

  it('un commit que no tocó contenido no tiene nada que revertir: no es un éxito, y no es «prueba de nuevo»', async () => {
    // [Ronda 1] `nada-que-revertir` es un hecho PERMANENTE de ese commit, no
    // una falla de red: reintentar da el mismo resultado siempre. Por eso es
    // 409 con su propia frase, no el 502 genérico de «no pudimos conectarnos»
    // (ese es para `falló`, que sí es un error de GitHub — ver el test de
    // abajo).
    const sha = '2'.repeat(40)
    const c = commitDelPanel(sha)
    const { f } = fetchFalso([
      { cuerpo: { object: { sha } } },
      c,
      { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
      c,
      { cuerpo: { object: { sha } } },
      c,
      { cuerpo: { files: [] } }, // no tocó ningún documento de contenido
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(409)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Esa publicación no cambió ningún dato del sitio, así que no hay nada que deshacer.',
    )
  })

  it('el motivo `falló` de verdad (no `nada-que-revertir`) da 502 con la MISMA frase que usa publicar.ts', async () => {
    // A diferencia de `nada-que-revertir` (arriba, permanente), este SÍ es
    // el motivo genérico de error del que vale la pena reintentar. Se llega
    // con un commit sin padre —el camino más corto hasta `falló` adentro de
    // `revierte()` (revertir.ts), sin necesitar que `publica()` falle de
    // verdad— y lo que importa acá no es CÓMO se llega, sino que el router
    // conteste con la frase compartida (`PROBLEMA_NO_SE_PUDO_PUBLICAR`) y no
    // con una copia suelta que se puede desincronizar.
    const sha = '3'.repeat(40)
    const c = {
      cuerpo: {
        sha,
        tree: { sha: 't' },
        message: 'cambia sabores\n\nPanel: sí',
        author: { date: '2026-09-17T12:00:00Z' },
        parents: [], // sin padre: revierte() no tiene a qué volver — motivo `falló`
      },
    }
    const { f } = fetchFalso([
      { cuerpo: { object: { sha } } },
      c,
      { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
      c,
      { cuerpo: { object: { sha } } },
      c,
    ])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
    )
    expect(r.status).toBe(502)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'No pudimos publicar: hubo un problema para conectarnos con el sitio. Prueba de nuevo en unos minutos.',
    )
  })

  it('una fecha que no se puede leer NO cae del lado permisivo', async () => {
    // [Ronda 1, Important] `NaN > VENTANA_DESHACER_MS` da `false`: sin la
    // guardia explícita de `Number.isFinite`, un commit con fecha ilegible
    // se trataría como «recién publicado» y se podría deshacer siempre. Es
    // el bug de JavaScript que más veces se reintrodujo en la historia del
    // lenguaje, y acá dejaría la ventana de media hora abierta para siempre.
    for (const fecha of ['no-es-una-fecha', '']) {
      const sha = '4'.repeat(40)
      const c = {
        cuerpo: {
          sha,
          tree: { sha: 't' },
          message: 'cambia sabores\n\nPanel: sí',
          author: { date: fecha },
          parents: [{ sha: 'padre' }],
        },
      }
      const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), c])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      expect(r.status, `fecha «${fecha}»`).toBe(409)
      expect((r.cuerpo as { problema: string }).problema, `fecha «${fecha}»`).toBe(
        'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.',
      )
    }
  })

  it('a los 30:00.000 exactos todavía se puede deshacer — es una elección, no un accidente', async () => {
    const sha = '5'.repeat(40)
    const { f } = fetchFalso(respuestasDeUnDeshacerExitoso(sha))
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + VENTANA_DESHACER_MS }), // exactamente 30 minutos
    )
    expect(r.status).toBe(200)
  })

  it('a los 30:00.001, un milisegundo de más ya cruzó la ventana', async () => {
    const sha = '6'.repeat(40)
    const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), commitDelPanel(sha)])
    const r = await maneja(
      'deshacer',
      { cuerpo: { sha }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + VENTANA_DESHACER_MS + 1 }),
    )
    expect(r.status).toBe(409)
  })

  it('VENTANA_DESHACER_MS son treinta minutos — la fase 6 apaga el botón con este mismo número', () => {
    expect(VENTANA_DESHACER_MS).toBe(30 * 60_000)
  })

  it('ninguna frase nueva de deshacer usa jerga técnica', async () => {
    const salidas: string[] = []

    // 409: la ventana venció.
    {
      const sha = 'b'.repeat(40)
      const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), commitDelPanel(sha)])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 31 * 60_000 }),
      )
      salidas.push((r.cuerpo as { problema: string }).problema)
    }

    // 422: el contenido viejo no valida.
    {
      const sha = 'd'.repeat(40)
      const c = commitDelPanel(sha)
      const saboresRotos = saboresCrudoDeDisco()
      delete saboresRotos.sabores[0].precio
      const { f } = fetchFalso([
        { cuerpo: { object: { sha } } },
        c,
        { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
        c,
        { cuerpo: { object: { sha } } },
        c,
        { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },
        { cuerpo: { content: Buffer.from(JSON.stringify(saboresRotos)).toString('base64'), encoding: 'base64' } },
      ])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      salidas.push((r.cuerpo as { problema: string }).problema)
    }

    // 403: no es del panel.
    {
      const sha = '1'.repeat(40)
      const c = commitDeMarcos(sha)
      const { f } = fetchFalso([{ cuerpo: { object: { sha } } }, c, c, { cuerpo: { object: { sha } } }, c])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      salidas.push((r.cuerpo as { problema: string }).problema)
    }

    // 409: nada que revertir (permanente, no una falla de conexión).
    {
      const sha = '2'.repeat(40)
      const c = commitDelPanel(sha)
      const { f } = fetchFalso([
        { cuerpo: { object: { sha } } },
        c,
        { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
        c,
        { cuerpo: { object: { sha } } },
        c,
        { cuerpo: { files: [] } },
      ])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      salidas.push((r.cuerpo as { problema: string }).problema)
    }

    // 502: falló de verdad (comparte la frase con publicar.ts).
    {
      const sha = '3'.repeat(40)
      const c = {
        cuerpo: {
          sha,
          tree: { sha: 't' },
          message: 'cambia sabores\n\nPanel: sí',
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [],
        },
      }
      const { f } = fetchFalso([
        { cuerpo: { object: { sha } } },
        c,
        { cuerpo: { deployments: [{ state: 'READY', url: 'x' }] } },
        c,
        { cuerpo: { object: { sha } } },
        c,
      ])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      salidas.push((r.cuerpo as { problema: string }).problema)
    }

    // 200: éxito (comparte la misma frase con `ya-revertido`).
    {
      const sha = 'e'.repeat(40)
      const reversionSha = 'f'.repeat(40)
      const reversion = commitDeReversion(reversionSha, sha)
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: reversionSha } } },
        reversion,
        commitDelPanel(sha),
        { cuerpo: { object: { sha: reversionSha } } },
        reversion,
      ])
      const r = await maneja(
        'deshacer',
        { cuerpo: { sha }, cookie: cookieValida() },
        contextoDePrueba({ fetch: f, ahora: () => PUBLICADO_EN + 60_000 }),
      )
      salidas.push((r.cuerpo as { resumen: string }).resumen)
    }

    expect(salidas.filter((s) => s !== '')).toHaveLength(6)

    // [Hallazgo, Tarea 9, Ronda 1 — arreglado de raíz] `JERGA_PROHIBIDA`
    // incluye «sha» —el hash corto de un commit—, y «deshacer» (el verbo que
    // le da nombre al botón) lo CONTIENE como fragmento sin ser jerga de
    // ninguna forma. `jergaEn()` (estado.ts) es el arreglo compartido: busca
    // cada palabra por LÍMITES, no por substring — se lo agregaron acá los
    // otros dos consumidores que antes comparaban a mano (el B10 de `estado`
    // y el F5 del correo, más arriba en este archivo).
    for (const frase of salidas) {
      expect(jergaEn(frase), frase).toBeNull()
    }
  })
})

// Tarea 10 (spec §4.6, §4.5): qué se publicó, cuándo y quién — leído de
// `main` con `gh.listaCommits()` y traducido con `lee()` (`historial.ts`).
// La traducción en sí —qué cuenta como «del panel», cómo se separan asunto
// y trailers, cómo se ve una reversión— la cubre `test/historial.test.ts`;
// acá solo se prueba el cableado del router: sesión obligatoria,
// `revisaLaCabeza()` como red de seguridad, y que lo que devuelve `lee()`
// llegue intacto (filtrado y en el orden en que vino).
/*
 * [Revisión final de la rama] El MISMO dato se validaba de tres formas:
 * `estado` y `deshacer` pedían los cuarenta hexadecimales para su `sha`, y
 * `publicar` y `borrador.guardar` se conformaban con «cadena no vacía»
 * para su `base`. La consecuencia no era teórica: un `base` basura pasaba
 * el chequeo, llegaba hasta `gh.comparaRefs()`, GitHub lo rechazaba, y ella
 * recibía un 502 con «no pudimos revisar el contenido actual del sitio:
 * prueba de nuevo en unos minutos» — un diagnóstico equivocado que la manda
 * a reintentar algo que nunca va a funcionar.
 */
describe('la forma del `base` se valida igual en todas las acciones', () => {
  const BASURA = ['', 'main', 'loQueSea', 'FACADE01'.repeat(5), `${SHA_MAIN}a`, SHA_MAIN.slice(0, 39), 42, null]

  it('publicar: un `base` sin forma de sha da 400 franco, no un 502 con el diagnóstico equivocado', async () => {
    for (const base of BASURA) {
      const { f, pedidos } = fetchFalso([])
      const r = await maneja(
        'publicar',
        { cuerpo: { base, documentos: { sabores: saboresCrudoDeDisco() } }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status, JSON.stringify(base)).toBe(400)
      expect((r.cuerpo as { problema: string }).problema).toBe(
        'No pudimos publicar: vuelve a abrir el panel y hazlo de nuevo.',
      )
      expect(pedidos, JSON.stringify(base)).toHaveLength(0) // ni un pedido a GitHub
    }
  })

  it('borrador.guardar: el mismo dato, la misma forma, el mismo 400', async () => {
    for (const base of BASURA) {
      const { f, pedidos } = fetchFalso([])
      const r = await maneja(
        'borrador.guardar',
        { cuerpo: { base, documentos: {} }, cookie: cookieValida() },
        contextoBase(f),
      )
      expect(r.status, JSON.stringify(base)).toBe(400)
      expect(pedidos, JSON.stringify(base)).toHaveLength(0)
    }
  })
})

describe('accion=historial', () => {
  /**
   * Un commit, en la forma que da la API de Commits que usa
   * `gh.listaCommits()` —anidado bajo `commit`, no plano como da `gh.commit()`
   * (la Git Data API que usa `revisaLaCabeza()`)— así que este ayudante es
   * DISTINTO de `commitDelPanel`/`commitDeMarcos` de `describe('accion=deshacer')`,
   * que arman la forma plana.
   */
  const commitDelPanelEnLista = (sha: string, fecha = '2026-09-17T12:00:00Z') => ({
    sha,
    commit: { message: `cambia sabores (${sha})\n\nPanel: sí\nPanel-Autor: clienta@ejemplo.mx`, author: { date: fecha } },
  })

  /** Un commit a mano de Marcos, en la misma forma anidada — no es del panel. */
  const commitDeMarcosEnLista = (sha: string) => ({
    sha,
    commit: { message: 'fix: un ajuste a mano', author: { date: '2026-09-17T11:00:00Z' } },
  })

  it('sin sesión, 401 — y no gasta ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja('historial', { cuerpo: {}, cookie: '' }, contextoBase(f))
    expect(r.status).toBe(401)
    expect(pedidos).toHaveLength(0)
  })

  it('corre revisaLaCabeza() y devuelve lo que publicó el panel, filtrado y en el orden en que vino', async () => {
    const { f, pedidos } = fetchFalso([
      ...respuestasDeNingunaReversionPendiente(), // revisaLaCabeza(): costo fijo, antes que nada
      {
        cuerpo: [
          commitDelPanelEnLista('c3'), // más nuevo
          commitDeMarcosEnLista('c2'), // de Marcos: no es su historial
          commitDelPanelEnLista('c1'), // más viejo
        ],
      },
    ])
    const r = await maneja('historial', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))

    expect(r.status).toBe(200)
    const { publicaciones } = r.cuerpo as { ok: true; publicaciones: Array<{ sha: string }> }
    expect(publicaciones.map((p) => p.sha)).toEqual(['c3', 'c1']) // filtrado (sin c2) y en el mismo orden en que vino

    // La lista se pide con el nombre de rama pelado (ver github.ts): el
    // router sigue pasando `heads/main`, y el pelado pasa adentro del
    // cliente — acá alcanza con confirmar que se pidió la rama correcta.
    expect(pedidos.at(-1)!.url).toContain('/commits?sha=main&per_page=20')
  })

  it('si GitHub no contesta al pedir la lista, un 502 franco — nunca una lista vacía que se confunda con «no hay historial»', async () => {
    const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), { status: 500, cuerpo: {} }])
    const r = await maneja('historial', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(502)
  })

  /*
   * [Revisión final de la rama, I9] `publicar` rechaza con 400 cualquier
   * cuerpo sin `base`, y NINGUNA acción entregaba la cabeza de `main`:
   * `salud` no la traía, `historial` filtraba por commits del panel, `estado`
   * la pide como ENTRADA y `borrador.leer` devuelve el `base` viejo del
   * borrador. La fase 6 se iba a encontrar con un 400 obligatorio y sin
   * fuente.
   */
  describe('I9: `historial` es la fuente del `base` que `publicar` exige', () => {
    it('devuelve el sha de la cabeza de main, aunque el último commit sea de Marcos', async () => {
      // El caso que importa, y el que la lista filtrada no puede cubrir: si
      // se tomara el `base` de `publicaciones[0]`, ahí diría `c1` —el último
      // del panel— y la publicación siguiente se rechazaría por pisada
      // contra un `main` que ya estaba en `c2`.
      const { f } = fetchFalso([
        ...respuestasDeNingunaReversionPendiente(),
        { cuerpo: [commitDeMarcosEnLista('c2'), commitDelPanelEnLista('c1')] },
      ])
      const r = await maneja('historial', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))

      const cuerpo = r.cuerpo as { base: string | null; publicaciones: Array<{ sha: string }> }
      expect(cuerpo.base).toBe('c2')
      expect(cuerpo.publicaciones.map((p) => p.sha)).toEqual(['c1'])
    })

    it('no cuesta ni un pedido de más: sale de la misma lista', async () => {
      const { f, pedidos } = fetchFalso([
        ...respuestasDeNingunaReversionPendiente(),
        { cuerpo: [commitDelPanelEnLista('c3')] },
      ])
      await maneja('historial', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
      // Los dos de `revisaLaCabeza()` más el de la lista, y nada más.
      expect(pedidos).toHaveLength(3)
    })

    it('con la lista vacía, `base` es null — nunca un sha inventado', async () => {
      const { f } = fetchFalso([...respuestasDeNingunaReversionPendiente(), { cuerpo: [] }])
      const r = await maneja('historial', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
      expect((r.cuerpo as { base: string | null }).base).toBeNull()
    })
  })
})

// Tarea 11 (spec §4.3, capa 2): el borrador del servidor. La mecánica de
// `guarda()`/`leeBorrador()` en sí —crear el ref la primera vez, moverlo
// después, el chequeo de conflicto entre aparatos— la cubre
// `test/borrador.test.ts`; acá solo el cableado del router: sesión
// obligatoria, que NO corre `revisaLaCabeza()` (no tiene nada que ver con
// el pipeline de `main`), y que el autor sale de la sesión, nunca del
// cuerpo.
describe('accion=borrador.guardar', () => {
  it('sin sesión, 401 — y no gasta ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja(
      'borrador.guardar',
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: '' },
      contextoBase(f),
    )
    expect(r.status).toBe(401)
    expect(pedidos).toHaveLength(0)
  })

  it('sin `base`, 400 — y no gasta ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja(
      'borrador.guardar',
      { cuerpo: { documentos: {} }, cookie: cookieValida() },
      contextoBase(f),
    )
    expect(r.status).toBe(400)
    expect(pedidos).toHaveLength(0)
  })

  it('NO corre revisaLaCabeza(): guardar un borrador no tiene nada que ver con el pipeline de main', async () => {
    // Si esto corriera revisaLaCabeza() primero, la primera respuesta
    // programada (el 404 del ref del borrador) se consumiría en el lugar
    // equivocado y el conteo de pedidos de abajo no cerraría. Exactamente
    // las cinco del bootstrap del borrador, ni una de más.
    const { f, pedidos } = fetchFalso([
      { status: 404, cuerpo: { message: 'Not Found' } },
      ...respuestasDeUnBlobArbolYCommit(),
      { cuerpo: { ref: 'refs/panel/borrador' } },
    ])
    const r = await maneja(
      'borrador.guardar',
      {
        cuerpo: { base: SHA_MAIN, documentos: { sitio: { footer: { derechos: 'x' } } }, dispositivo: 'celu' },
        cookie: cookieValida(),
      },
      contextoBase(f),
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { ok: boolean }).ok).toBe(true)
    expect(pedidos).toHaveLength(5)
  })

  it('el autor que se guarda es el de la SESIÓN, nunca lo que mande el cuerpo', async () => {
    const { f, pedidos } = fetchFalso([
      { status: 404, cuerpo: { message: 'Not Found' } },
      ...respuestasDeUnBlobArbolYCommit(),
      { cuerpo: { ref: 'refs/panel/borrador' } },
    ])
    await maneja(
      'borrador.guardar',
      {
        cuerpo: { base: SHA_MAIN, documentos: {}, dispositivo: 'celu', autor: 'quien-sea@otro.mx' },
        cookie: cookieValida('clienta@ejemplo.mx'),
      },
      contextoBase(f),
    )
    const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
    const escrito = JSON.parse(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8'))
    expect(escrito.autor).toBe('clienta@ejemplo.mx')
  })

  it('si hay un borrador más nuevo de OTRO aparato, 409 con el hecho crudo — no lo resuelve acá', async () => {
    const yaGuardado = JSON.stringify({
      documentos: {},
      base: SHA_MAIN,
      dispositivo: 'la-compu',
      autor: 'clienta@ejemplo.mx',
      hora: 2_000,
    })
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
    ])
    const r = await maneja(
      'borrador.guardar',
      { cuerpo: { base: SHA_MAIN, documentos: {}, dispositivo: 'celu' }, cookie: cookieValida() },
      { ...contextoBase(f), ahora: () => 1_000 },
    )
    expect(r.status).toBe(409)
    expect(r.cuerpo).toMatchObject({ ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'la-compu', hora: 2_000 } })
    expect(jergaEn((r.cuerpo as { problema: string }).problema)).toBeNull()
    expect(pedidos).toHaveLength(2) // el chequeo no escribió nada
  })

  // [Revisión final de la rama, I1] El token de concurrencia viaja en el
  // cuerpo (`horaLeida`) y llega hasta `guarda()`. Es el campo que la fase 6
  // tiene que empezar a mandar: sin él, el candado anti-pisada se cae
  // siempre del lado seguro (409 con salida por `pisar: true`), pero la
  // autoguardada de un segundo aparato pregunta de más.
  describe('I1: el token de concurrencia del borrador llega del cuerpo a `guarda()`', () => {
    const ONCE = Date.parse('2026-09-18T11:00:00Z')
    const ONCE_CINCO = Date.parse('2026-09-18T11:05:00Z')
    const deLaHermana = JSON.stringify({
      documentos: {}, base: SHA_MAIN, dispositivo: 'la-compu', autor: 'clienta@ejemplo.mx', hora: ONCE,
    })
    const elRefYElBorrador = () => [
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(deLaHermana).toString('base64'), encoding: 'base64', sha: 'b' } },
    ]

    it('sin `horaLeida`, un segundo aparato NO pisa el borrador de 11:00 aunque pida a las 11:05', async () => {
      // Con el candado viejo esto era 200 y el trabajo del otro aparato se
      // perdía: el orden temporal de la vida real —el guardado viejo es más
      // viejo— hacía que la condición nunca disparara.
      const { f, pedidos } = fetchFalso([...elRefYElBorrador()])
      const r = await maneja(
        'borrador.guardar',
        { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieDeDispositivo('celu') },
        { ...contextoBase(f), ahora: () => ONCE_CINCO },
      )
      expect(r.status).toBe(409)
      expect(r.cuerpo).toMatchObject({ motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'la-compu', hora: ONCE } })
      expect(pedidos).toHaveLength(2) // no escribió nada
    })

    it('con `horaLeida` igual a la del borrador que hay, escribe', async () => {
      const { f } = fetchFalso([...elRefYElBorrador(), ...respuestasDeUnaPublicacionDirecta()])
      const r = await maneja(
        'borrador.guardar',
        { cuerpo: { base: SHA_MAIN, documentos: {}, horaLeida: ONCE }, cookie: cookieDeDispositivo('celu') },
        { ...contextoBase(f), ahora: () => ONCE_CINCO },
      )
      expect(r.status).toBe(200)
    })

    it('un `horaLeida` que no es número se trata como ausente — nunca se cuela como token válido', async () => {
      // El cuerpo lo arma un navegador: que mande `"1700000000000"` (cadena)
      // o `null` no puede convertirse en «leí el borrador que hay».
      for (const basura of ['1700000000000', null, true, { hora: ONCE }]) {
        const { f } = fetchFalso([...elRefYElBorrador()])
        const r = await maneja(
          'borrador.guardar',
          { cuerpo: { base: SHA_MAIN, documentos: {}, horaLeida: basura }, cookie: cookieDeDispositivo('celu') },
          { ...contextoBase(f), ahora: () => ONCE_CINCO },
        )
        expect(r.status, JSON.stringify(basura)).toBe(409)
      }
    })
  })

  // [Ronda 1, hallazgo A] `dispositivo` sale de `sesion.dispositivo` —
  // FIRMADO al entrar—, nunca de lo que mande el cuerpo. Antes, un cuerpo
  // que se olvidara de mandar `dispositivo` hacía que CUALQUIER aparato
  // apareciera como `'sin-nombre'` (`idDeDispositivo(undefined)` nunca
  // falla), y el candado anti-pisada no tenía nada que comparar.
  describe('A: el dispositivo sale de la sesión firmada, nunca del cuerpo', () => {
    it('el cuerpo puede mandar `dispositivo` y se ignora: lo que se guarda es el de la cookie', async () => {
      const { f, pedidos } = fetchFalso([
        { status: 404, cuerpo: { message: 'Not Found' } },
        ...respuestasDeUnBlobArbolYCommit(),
        { cuerpo: { ref: 'refs/panel/borrador' } },
      ])
      await maneja(
        'borrador.guardar',
        {
          cuerpo: { base: SHA_MAIN, documentos: {}, dispositivo: 'lo-que-diga-el-cuerpo-no-cuenta' },
          cookie: cookieDeDispositivo('celu'),
        },
        contextoBase(f),
      )
      const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
      const escrito = JSON.parse(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8'))
      expect(escrito.dispositivo).toBe('celu')
    })

    it('sin NINGÚN campo `dispositivo` en el cuerpo, el candado anti-pisada sigue disparando entre DOS aparatos reales', async () => {
      // Es el escenario que reintroducía el bug que esta tarea vino a
      // arreglar: si `dispositivo` viniera del cuerpo y la fase 6 se
      // olvidara de mandarlo, los dos aparatos serían `'sin-nombre'` y este
      // 409 nunca pasaría. Con la sesión como fuente, el cuerpo ni siquiera
      // tiene la opción de mandarlo mal.
      const yaGuardado = JSON.stringify({
        documentos: {}, base: SHA_MAIN, dispositivo: 'celu', autor: 'clienta@ejemplo.mx', hora: 5_000,
      })
      const { f } = fetchFalso([
        { cuerpo: { object: { sha: 'refViejo' } } },
        { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
      ])
      const r = await maneja(
        'borrador.guardar',
        { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieDeDispositivo('la-hermana') },
        { ...contextoBase(f), ahora: () => 1_000 },
      )
      expect(r.status).toBe(409)
      expect(r.cuerpo).toMatchObject({ motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'celu', hora: 5_000 } })
    })
  })

  // [Ronda 1, hallazgo B] Un borrador corrupto no puede dejar el panel en un
  // 502 permanente: `guarda()` ya lo trata como «ref existe, hay que
  // mover», no «hay que crear» — acá se confirma que ESO llega intacto
  // hasta la respuesta HTTP (200, no 502) a través del router.
  it('B: un borrador con el JSON corrupto no rompe el guardado siguiente (200, no 502)', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from('{{{roto').toString('base64'), encoding: 'base64', sha: 'b' } },
      ...respuestasDeUnaPublicacionDirecta(),
    ])
    const r = await maneja(
      'borrador.guardar',
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieValida() },
      contextoBase(f),
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { ok: boolean }).ok).toBe(true)
  })

  // [Ronda 1, hallazgo D] `contexto.bytesDelCuerpo` tiene que llegar hasta
  // `guarda()` — antes esta acción nunca lo pasaba, así que el guardado del
  // borrador no podía chocar nunca con el tope real de cuerpo.
  it('D: un `bytesDelCuerpo` (del borde) que pasa el tope frena el guardado, sin escribir nada', async () => {
    const { f, pedidos } = fetchFalso([{ status: 404, cuerpo: { message: 'Not Found' } }])
    const r = await maneja(
      'borrador.guardar',
      { cuerpo: { base: SHA_MAIN, documentos: {} }, cookie: cookieValida() },
      { ...contextoBase(f), bytesDelCuerpo: TOPE_CUERPO + 1 },
    )
    expect(r.status).toBe(502)
    expect(pedidos.some((p) => p.url.endsWith('/git/blobs'))).toBe(false)
  })
})

describe('accion=borrador.leer', () => {
  it('sin sesión, 401 — y no gasta ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja('borrador.leer', { cuerpo: {}, cookie: '' }, contextoBase(f))
    expect(r.status).toBe(401)
    expect(pedidos).toHaveLength(0)
  })

  it('sin ningún borrador guardado, `borrador: null` — no un error', async () => {
    // Es el estado normal de un panel recién estrenado (o de cualquier
    // sesión antes del primer guardado). Un error acá sería la primera
    // pantalla que ella ve en su vida.
    const { f } = fetchFalso([{ status: 404, cuerpo: { message: 'Not Found' } }])
    const r = await maneja('borrador.leer', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(200)
    expect((r.cuerpo as { borrador: unknown }).borrador).toBeNull()
  })

  it('con un borrador guardado, lo devuelve tal cual — sin comparar ni decidir nada', async () => {
    const guardado = {
      documentos: { sitio: { footer: { derechos: 'x' } } },
      base: SHA_MAIN,
      dispositivo: 'celu',
      autor: 'clienta@ejemplo.mx',
      hora: 5_000,
    }
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'sha-borrador' } } },
      { cuerpo: { content: Buffer.from(JSON.stringify(guardado)).toString('base64'), encoding: 'base64', sha: 'b' } },
    ])
    const r = await maneja('borrador.leer', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(200)
    expect((r.cuerpo as { borrador: unknown }).borrador).toEqual(guardado)
  })

  it('si GitHub no contesta, 502 — nunca "no hay borrador" por una falla de red', async () => {
    const { f } = fetchFalso([{ status: 500, cuerpo: { message: 'boom' } }])
    const r = await maneja('borrador.leer', { cuerpo: {}, cookie: cookieValida() }, contextoBase(f))
    expect(r.status).toBe(502)
    expect(jergaEn((r.cuerpo as { problema: string }).problema)).toBeNull()
  })
})
