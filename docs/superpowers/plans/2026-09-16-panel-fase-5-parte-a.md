# Fase 5, Parte A — el canal de escritura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un cambio de contenido pueda entrar al sitio por HTTP —con contraseña, validado dos veces y en un solo commit atómico— sin que nadie toque la computadora de Marcos.

**Architecture:** una sola función serverless (`/api/panel?accion=…`) que no contiene lógica: todo vive en `src/servidor/**`, en módulos puros que reciben `fetch` y las variables de entorno por parámetro, para que la suite los pruebe sin red y sin secretos. El experimento del spec §4 ya se corrió y salió mal: un import de afuera de `api/` construye pero no arranca, así que la Tarea 1 elige y prueba en producción el mecanismo de empaquetado antes de que nada dependa de él.

**Tech Stack:** Vercel Functions (Node 22), esbuild, TypeScript 6, Zod 4.4.3, Vitest 4, API REST de GitHub (Git Data), pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` — §4 (publicación) entero, §4.1 (acceso), §4.2 (escritura), §4.4 (la compuerta de cuatro capas), y el «RESUELTO 2026-09-16» del riesgo de tracing.

**Lo que esta parte NO hace, y queda para la Parte B:** el enlace mágico de recuperación, el borrador en `refs/panel/borrador`, el estado del deploy y `version.json`, la reversión automática, el historial, los avisos por correo y la vigilancia del PAT. Todo eso necesita que el canal de escritura exista primero.

## Global Constraints

Valen para toda tarea de este plan.

- **Ningún secreto entra al repo. Nunca.** Ni en código, ni en tests, ni en fixtures, ni en un comentario. Las variables viven en el panel de Vercel (solo entorno Production). Los tests usan valores de prueba generados en el propio test.
- **`src/servidor/entradas/**` es el BORDE y `src/servidor/**` es puro e inyectable:** el borde —un archivo por función, y nada más que eso— es el único que lee `process.env` y toma `fetch` del global: arma el contexto y lo pasa hacia adentro. Todo el resto (`sesion`, `github`, `publicar`, `acciones`, `rutas-permitidas`) recibe lo que necesita por parámetro, incluido el reloj. Es lo que hace que la suite los pruebe sin red y sin secretos.
- **`src/contenido/**` sigue con su regla dura:** no importa `node:*`, no importa Astro, y usa solo rutas relativas sin extensión. El guard es lista blanca desde la fase 1. `src/servidor/**` SÍ puede importar `node:crypto` y `src/contenido/**`.
- **Lo que le habla a la clienta va en español mexicano, sin jerga y sin nombrar tecnologías.** «No pude publicar: revisa tu conexión», nunca «HTTP 502 del upstream». Los comentarios del código y los mensajes para Marcos van en español rioplatense y explican POR QUÉ.
- **Vocabulario prohibido de MARCA:** «mono», «chango», «changuito», «chispa(s)», «carrito», «pistachos», «cacahuete», «maní», «packaging», «snack», «smoothie».
- **La función nunca escribe sin revalidar.** `validar()` corre de nuevo en el servidor sobre el documento completo, aunque el navegador ya lo haya validado. La capa del navegador es comodidad; esta es la que cuenta.
- **Un solo commit por publicación**, con `force: false`. Nunca `force: true`, nunca dos commits.
- **Los invisibles se escriben como escape (`\u00a0`), nunca se pegan.** Después de tocar cualquier archivo con invisibles, verificalo:
  ```bash
  python3 -c "import io;print(io.open('<archivo>',encoding='utf-8').read().count(chr(0xa0)))"
  ```
- **Línea base:** hoy `pnpm test` da **914 tests verdes (38 archivos)** y `pnpm typecheck` **0 errores, 0 warnings, 3 hints**. Ninguna tarea puede bajar el verde.
- **`pnpm build` es la compuerta:** construye el sitio, corre la suite y `astro check`. Ningún test invoca `pnpm build` (`test/meta.test.ts` lo prohíbe: es una bomba de recursión).
- **Commits en español, imperativo,** terminando con:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
  ```

---

## Decisiones de esta parte (leelas antes de la Tarea 1)

**E1 · El empaquetado se elige por experimento, no por lectura.** [MEDIDO 2026-09-16, en
producción] `api/contacto.ts` importando `../src/servidor/origen` construye y
devuelve `FUNCTION_INVOCATION_FAILED` al invocarse. La Tarea 1 prueba los
candidatos EN ESE ORDEN y se queda con el primero que funcione en producción:

1. **Artefacto commiteado:** `scripts/bundle-api.ts` (esbuild) genera
   `api/<nombre>.js` autocontenido, que se commitea, y un test exige que esté
   al día con sus fuentes. Es el más simple y el que no depende de en qué
   momento Vercel mira `api/`.
2. **Generado en el build:** el `buildCommand` corre el bundle antes de
   `astro build`. Más limpio en el repo, pero hay que verificar que Vercel
   detecte funciones creadas durante el build.
3. **Build Output API** (`.vercel/output/`): la forma soportada y la más
   invasiva — cambia cómo se sirve TODO el sitio, no solo las funciones.

El conejillo de indias es `api/contacto.ts`, otra vez: es la única función que
existe, tiene respaldo (el formulario cae al correo cuando el servidor no
contesta) y ya sabemos exactamente cómo se ve rota.

**E2 · La contraseña es la puerta principal y vive hasheada en una variable.**
`PANEL_CLAVE_HASH` guarda `scrypt$<N>$<r>$<p>$<sal en base64>$<hash en base64>`.
La función deriva con los mismos parámetros y compara con
`crypto.timingSafeEqual`. La contraseña en claro no existe en ningún lado más
que en el llavero del teléfono de la clienta: ni Marcos la sabe.

**E3 · La cookie de sesión es un HMAC, no un identificador.** No hay base de
datos donde guardar sesiones, así que la cookie ES la sesión:
`<cuerpo en base64url>.<firma>` donde el cuerpo dice correo, vencimiento y
dispositivo, y la firma es HMAC-SHA256 con `PANEL_SECRETO`. Se emite con
`HttpOnly; Secure; SameSite=Lax; Path=/`. Un año si el dispositivo se marcó
como propio, treinta días si no.

**E4 · El límite de intentos es de memoria del proceso, y hay que decirlo.**
Cinco intentos por IP cada quince minutos, contados en un `Map` del módulo. Las
funciones serverless son efímeras y concurrentes: un atacante paciente o
distribuido se lo saltea. **No es la defensa principal** —esa es una contraseña
larga— sino el freno al intento casual y al script tonto. Queda anotado en el
código y en el runbook; si algún día hace falta de verdad, se hace con un
almacén externo, que hoy no existe.

**E5 · El commit lo firma el panel y dice quién lo pidió.** Autor
`Panel Maracacao <panel@maracacao.mx>`, y en el cuerpo los trailers `Panel: sí`
y `Panel-Autor: <correo>`. El asunto ES el resumen que la clienta vio antes de
publicar, y sale de `src/contenido/diff.ts` — la misma función que va a pintar
la bandeja y el historial en la fase 6. El día que la hermana también publique,
el historial dice cuál de las dos fue.

**E6 · La lista blanca de escritura es una lista de expresiones, no un prefijo.**
```
/^src\/contenido\/datos\/[a-z0-9-]+\.json$/
/^public\/sitio\/(marca|envoltura)\/[a-z0-9-]+\.webp$/
/^public\/sitio\/etiqueta-[a-z0-9-]+\.webp$/
```
Con `TOPE_ARCHIVOS = 40` y `TOPE_CUERPO = 3.5 MB` medido sobre el CUERPO del
pedido (la API de blobs exige base64, así que 3.5 MB de cuerpo son ~2.6 MB de
binario). Un pedido que toque `.github/workflows/**` no llega ni a GitHub: lo
para la lista. Y aunque llegara, el PAT no tiene permiso de Workflows.

**E7 · Los errores tienen dos caras.** Lo que vuelve por HTTP a la clienta es
`{ ok: false, problema: '<en español mexicano>', campo?: '<ruta>' }` — sin
códigos, sin nombres de servicios. Lo que se escribe en el log del servidor es
para Marcos y lleva todo: status, cuerpo del upstream, sha, ruta.

**E8 · Las acciones de esta parte son tres**, y el router las acota:
`entrar` (POST, contraseña → cookie), `publicar` (POST, documento → commit) y
`salud` (GET, ¿están las variables?, ¿responde GitHub?). Todo lo demás es de la
Parte B y devuelve 404 hasta que exista.

---

## Mapa de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `scripts/bundle-api.ts` | esbuild: fuente de función → `api/<nombre>.js` autocontenido |
| `src/servidor/sesion.ts` | contraseña (scrypt + tiempo constante), cookie firmada, límite de intentos |
| `src/servidor/github.ts` | cliente REST mínimo de la Git Data API, con `fetch` inyectado |
| `src/servidor/rutas-permitidas.ts` | la lista blanca de escritura y los topes |
| `src/servidor/publicar.ts` | blobs → tree → commit → PATCH ref, atómico |
| `src/servidor/acciones.ts` | el router de `?accion=`, sin lógica de negocio |
| `src/contenido/diff.ts` | `resume(antes, después) → Cambio[]` y `frase(Cambio[])` |
| `api/panel.ts` (o su fuente, según E1) | el borde: lee env, arma el contexto, delega |
| `docs/panel-operacion.md` | el runbook: qué variable es qué, cómo se rota, qué hacer si main queda roto |

**Se modifican:** `vercel.json` (`maxDuration` de la función nueva), `package.json`
(el script del bundle y `esbuild` como devDependency), `api/contacto.ts` (pasa a
usar el mecanismo que elija la Tarea 1).

---

### Tarea 1: El empaquetado — elegirlo probándolo, no leyéndolo

**Nada de esta fase existe hasta que una función pueda importar código de `src/`. Ya sabemos que la forma obvia no anda; esta tarea encuentra la que sí.**

**Files:**
- Create: `scripts/bundle-api.ts`
- Modify: `package.json` (script `bundle:api` + `esbuild` en devDependencies)
- Modify: `api/contacto.ts` (el conejillo de indias)
- Test: `test/bundle-api.test.ts`

**Interfaces:**
- Produce: el mecanismo que las Tareas 6 y 7 usan para que `api/panel.*` importe `src/servidor/**`. La tarea termina con una regla escrita: «una función se escribe en `<tal lugar>` y se empaqueta así».

- [ ] **Paso 1: El bundler**

Create `scripts/bundle-api.ts`:

```ts
/*
 * Empaqueta una función serverless en UN archivo autocontenido.
 *
 * Por qué existe: [MEDIDO 2026-09-16, en producción] una función de Vercel
 * que importa un archivo de afuera de `api/` CONSTRUYE y después muere al
 * invocarse (FUNCTION_INVOCATION_FAILED). El tracer no se lleva el archivo
 * al paquete. Sin esto, todo `src/servidor/**` es inalcanzable desde la
 * función, que es donde tiene que correr.
 *
 * esbuild resuelve los imports y escribe un solo archivo. `packages: 'bundle'`
 * mete TODO adentro —incluido zod— porque el paquete de la función no tiene
 * node_modules; `platform: 'node'` deja los `node:*` como externos, que sí
 * existen en el runtime.
 */
import { build } from 'esbuild'

export interface Empaque {
  entrada: string
  salida: string
}

export async function empaqueta({ entrada, salida }: Empaque): Promise<void> {
  await build({
    entryPoints: [entrada],
    outfile: salida,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    packages: 'bundle',
    // Las funciones de Vercel corren con el runtime de Node, no en el navegador:
    // `node:*` se resuelve allá y meterlo al bundle rompería.
    external: ['node:*'],
    banner: { js: '/* GENERADO por scripts/bundle-api.ts — no editar a mano. */' },
    logLevel: 'warning',
  })
}

const FUNCIONES: Empaque[] = [
  { entrada: 'src/servidor/entradas/contacto.ts', salida: 'api/contacto.js' },
]

if (import.meta.url === `file://${process.argv[1]}`) {
  await Promise.all(FUNCIONES.map(empaqueta))
  console.log(`Empaquetadas ${FUNCIONES.length} función(es).`)
}
```

En `package.json`: `"bundle:api": "tsx scripts/bundle-api.ts"` y `esbuild` en
devDependencies (`pnpm add -D esbuild`).

- [ ] **Paso 2: Mover la función de contacto a su fuente**

`git mv api/contacto.ts src/servidor/entradas/contacto.ts`, y ahí sí importar
la lista compartida:

```ts
import { origenPermitido } from '../origen'
```

borrando la copia local de `ORIGENES_PERMITIDOS` y el regex duplicado. El test
de sincronía de `test/origen-servidor.test.ts` (que hoy exige que las dos
listas digan lo mismo) **se borra en esta tarea**: deja de tener sentido cuando
hay una sola lista. Decilo en el reporte.

Y `test/sitio.test.ts` tiene un guard que lee `api/contacto.ts` para exigir sus
cuatro capas anti-bots: apuntalo a la ruta nueva. **No lo ablandes**: las cuatro
capas tienen que seguir clavadas.

- [ ] **Paso 3: El test de que el bundle está al día**

Create `test/bundle-api.test.ts`:

```ts
/*
 * El artefacto `api/contacto.js` se commitea, así que puede quedar viejo: la
 * fuente cambia, nadie corre el bundle, y Vercel despliega la versión anterior
 * sin que nada se queje. Este test lo impide: reconstruye en memoria y compara.
 *
 * Si se pone rojo, corré `pnpm bundle:api` y commiteá el resultado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { build } from 'esbuild'

const FUENTE = 'src/servidor/entradas/contacto.ts'
const ARTEFACTO = 'api/contacto.js'

describe('el paquete de la función de contacto', () => {
  it('existe y no tiene imports de afuera: es autocontenido', () => {
    expect(existsSync(ARTEFACTO)).toBe(true)
    const js = readFileSync(ARTEFACTO, 'utf8')
    // Lo único que puede quedar afuera es el runtime de Node.
    const imports = [...js.matchAll(/^import .* from ['"](.+)['"]/gm)].map((m) => m[1])
    for (const ruta of imports) expect(ruta.startsWith('node:')).toBe(true)
  })

  it('está al día con su fuente', async () => {
    const { outputFiles } = await build({
      entryPoints: [FUENTE],
      bundle: true, platform: 'node', target: 'node22', format: 'esm',
      packages: 'bundle', external: ['node:*'], write: false,
      banner: { js: '/* GENERADO por scripts/bundle-api.ts — no editar a mano. */' },
      logLevel: 'silent',
    })
    expect(outputFiles[0].text).toBe(readFileSync(ARTEFACTO, 'utf8'))
  })
})
```

- [ ] **Paso 4: Probar el candidato 1 en producción**

Corré `pnpm bundle:api`, commiteá `api/contacto.js`, y verificá ANTES de
publicar que el artefacto responde localmente lo que tiene que responder:

```bash
node -e "import('./api/contacto.js').then(m => console.log(typeof m.default))"
```

Expected: `function`.

**Este paso pide una publicación a producción, que es una decisión del humano:
paralo acá, reportá que el candidato 1 está listo para probarse, y esperá.** El
controlador lo lleva a producción y te devuelve el resultado de:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.maracacao.mx/api/contacto \
  -H 'Content-Type: application/json' -H 'Origin: https://malo.com' -d '{"nombre":"x"}'
```

Expected: **403** (la función arrancó y rechazó el origen). Un **500** significa
que el candidato 1 tampoco sirve y hay que ir al 2.

- [ ] **Paso 5: Escribir la regla que quedó**

En `docs/panel-operacion.md` (crealo si no existe), la sección «Cómo se escribe
una función»: dónde va la fuente, qué comando la empaqueta, qué se commitea,
qué test lo vigila y qué pasa si alguien edita el artefacto a mano. Tres
párrafos, en rioplatense, para el Marcos de dentro de seis meses.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add -A
git commit -m "$(cat <<'EOF'
feat: las funciones se empaquetan con esbuild, que es la única forma que arranca

El import de afuera de api/ construye y no arranca —medido en producción el
2026-09-16—, así que la fuente de cada función se muda a src/servidor/entradas/
y esbuild la deja autocontenida en api/. El artefacto se commitea y un test
exige que esté al día con su fuente: si se separan, Vercel despliega la
versión vieja sin que nada se queje.

La función de contacto es el conejillo de indias: es la única que existe y
tiene respaldo, así que si el mecanismo falla se ve enseguida y sin costo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 2: La sesión — contraseña, cookie y freno a la fuerza bruta

**Files:**
- Create: `src/servidor/sesion.ts`
- Test: `test/sesion.test.ts`

**Interfaces:**
- Produce:
  ```ts
  export interface Sesion { correo: string; vence: number; dispositivo: string }
  export function hashDeClave(clave: string, sal?: Buffer): string
  export function claveCorrecta(clave: string, guardado: string): boolean
  export function firmaSesion(sesion: Sesion, secreto: string): string
  export function verificaSesion(cookie: string, secreto: string, ahora?: number): Sesion | null
  export function cookieDeSesion(valor: string, dias: number): string
  export function intentoPermitido(ip: string, ahora?: number): boolean
  ```
  Las usan la acción `entrar` (Tarea 6) y el guard de `publicar`.

- [ ] **Paso 1: Los tests, que hoy fallan**

Create `test/sesion.test.ts`:

```ts
/*
 * La puerta del panel. No hay base de datos: la cookie ES la sesión, firmada
 * con HMAC, y la contraseña vive hasheada en una variable de entorno.
 *
 * Ningún secreto real aparece acá: cada test genera el suyo.
 */
import { describe, it, expect } from 'vitest'
import {
  hashDeClave, claveCorrecta, firmaSesion, verificaSesion, cookieDeSesion, intentoPermitido,
} from '../src/servidor/sesion'

const SECRETO = 'secreto-de-prueba-no-es-el-de-produccion'

describe('la contraseña', () => {
  it('acepta la correcta y rechaza la equivocada', () => {
    const guardado = hashDeClave('caballo correcto batería grapa')
    expect(claveCorrecta('caballo correcto batería grapa', guardado)).toBe(true)
    expect(claveCorrecta('caballo correcto batería grapo', guardado)).toBe(false)
  })

  it('dos hashes de la misma contraseña son distintos: la sal no se repite', () => {
    expect(hashDeClave('la misma')).not.toBe(hashDeClave('la misma'))
  })

  it('no explota con un hash guardado con otra forma: devuelve false', () => {
    // El modo de falla: alguien pega en la variable un valor de otro formato y
    // la función tira una excepción en vez de decir «contraseña incorrecta».
    expect(claveCorrecta('lo que sea', 'basura')).toBe(false)
    expect(claveCorrecta('lo que sea', '')).toBe(false)
    expect(claveCorrecta('lo que sea', 'scrypt$x$y$z$no$base64')).toBe(false)
  })
})

describe('la cookie de sesión', () => {
  const sesion = { correo: 'clienta@ejemplo.mx', vence: Date.now() + 86_400_000, dispositivo: 'celu' }

  it('vuelve a leer lo que firmó', () => {
    expect(verificaSesion(firmaSesion(sesion, SECRETO), SECRETO)).toEqual(sesion)
  })

  it('rechaza una firma hecha con otro secreto', () => {
    expect(verificaSesion(firmaSesion(sesion, 'otro'), SECRETO)).toBeNull()
  })

  it('rechaza un cuerpo manipulado aunque la firma venga del original', () => {
    // El ataque directo: cambiar el correo de la cookie por otro de la lista.
    const firmada = firmaSesion(sesion, SECRETO)
    const [cuerpo, firma] = firmada.split('.')
    const otro = Buffer.from(JSON.stringify({ ...sesion, correo: 'otra@ejemplo.mx' }))
      .toString('base64url')
    expect(verificaSesion(`${otro}.${firma}`, SECRETO)).toBeNull()
    expect(cuerpo).not.toBe(otro)
  })

  it('rechaza una sesión vencida', () => {
    const vieja = { ...sesion, vence: Date.now() - 1 }
    expect(verificaSesion(firmaSesion(vieja, SECRETO), SECRETO)).toBeNull()
  })

  it('rechaza basura sin tirar', () => {
    for (const mala of ['', 'sinpunto', 'a.b.c', '.', 'x.']) {
      expect(verificaSesion(mala, SECRETO)).toBeNull()
    }
  })

  it('la cookie sale con las banderas que la protegen', () => {
    const c = cookieDeSesion('loquesea', 365)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    expect(c).toMatch(/Max-Age=\d+/)
  })
})

describe('el freno a la fuerza bruta', () => {
  it('deja pasar cinco intentos y frena el sexto', () => {
    const ip = `prueba-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(intentoPermitido(ip)).toBe(true)
    expect(intentoPermitido(ip)).toBe(false)
  })

  it('se olvida después de quince minutos', () => {
    const ip = `prueba-${Math.random()}`
    const t0 = Date.now()
    for (let i = 0; i < 5; i++) intentoPermitido(ip, t0)
    expect(intentoPermitido(ip, t0)).toBe(false)
    expect(intentoPermitido(ip, t0 + 15 * 60_000 + 1)).toBe(true)
  })

  it('cuenta por IP, no en total', () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`
    for (let i = 0; i < 5; i++) intentoPermitido(a)
    expect(intentoPermitido(a)).toBe(false)
    expect(intentoPermitido(b)).toBe(true)
  })
})
```

- [ ] **Paso 2: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/sesion.test.ts`
Expected: **FAIL** — el módulo no existe. Pegá la salida.

- [ ] **Paso 3: El módulo**

Create `src/servidor/sesion.ts`. Las piezas, con sus porqués:

- `hashDeClave`: `scryptSync(clave, sal, 64, { N: 16384, r: 8, p: 1 })`, sal de
  16 bytes de `randomBytes`, y se guarda todo junto como
  `scrypt$16384$8$1$<sal b64>$<hash b64>` para que el día que suban los
  parámetros los hashes viejos se sigan leyendo.
- `claveCorrecta`: parsea el guardado, deriva con ESOS parámetros y compara con
  `timingSafeEqual` sobre buffers del mismo largo. **Todo adentro de un
  try/catch que devuelve `false`**: un formato raro en la variable no puede
  tirar la función, tiene que ser «contraseña incorrecta».
- `firmaSesion`/`verificaSesion`: `<JSON en base64url>.<HMAC-SHA256 en base64url>`,
  comparación de firma también con `timingSafeEqual`, y el vencimiento se
  chequea DESPUÉS de verificar la firma (si no, un cuerpo falso decide cuándo
  vence).
- `intentoPermitido`: `Map<string, number[]>` con las marcas de tiempo de los
  últimos quince minutos. Arriba, un comentario que diga lo que dice la E4: es
  memoria de proceso, las funciones son efímeras, esto frena al script tonto y
  no a un atacante distribuido; la defensa real es una contraseña larga.

- [ ] **Paso 4: Verde**

Run: `pnpm exec vitest run test/sesion.test.ts`
Expected: **PASS los quince.**

- [ ] **Paso 5: Probar que los tests detectan**

Tres mutaciones, una por vez, restaurando después. Pegá las tres salidas.

1. Cambiá `timingSafeEqual` por `===` en `claveCorrecta` → los tests siguen
   verdes (la comparación de tiempo constante no se puede probar con una
   aserción). **Ese es el hallazgo, y va en el reporte:** esta propiedad la
   sostiene la revisión de código, no la suite. Restaurá.
2. Sacá el chequeo de vencimiento → rojo en «rechaza una sesión vencida».
3. Verificá el vencimiento ANTES de la firma → rojo en «rechaza un cuerpo
   manipulado…» solo si el cuerpo falso vence antes; si queda verde, decilo:
   el test no cubre ese orden y hay que agregar el caso.

- [ ] **Paso 6: La herramienta para generar el hash**

En `docs/panel-operacion.md`, la sección «Cómo se cambia la contraseña del
panel», con el comando exacto que Marcos va a correr:

```bash
pnpm exec tsx -e "import {hashDeClave} from './src/servidor/sesion.ts'; console.log(hashDeClave(process.argv[1]))" 'la contraseña que eligió la clienta'
```

y la advertencia de que el resultado va a `PANEL_CLAVE_HASH` en Vercel
(Production), que la contraseña en claro no se guarda en ningún lado, y que
cambiarla no cierra las sesiones abiertas —eso lo hace rotar `PANEL_SECRETO`.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/servidor/sesion.ts test/sesion.test.ts docs/panel-operacion.md
git commit -m "$(cat <<'EOF'
feat: la puerta del panel — contraseña con scrypt y cookie firmada

No hay base de datos donde guardar sesiones, así que la cookie ES la sesión:
cuerpo y HMAC, verificado en tiempo constante, con el vencimiento chequeado
DESPUÉS de la firma para que un cuerpo falso no decida cuándo vence.

La contraseña vive hasheada en una variable de entorno; en claro no existe
en ningún lado más que en el llavero del teléfono de la clienta.

El freno de cinco intentos por IP es memoria de proceso y está dicho en el
código: para un atacante distribuido no sirve. La defensa es la contraseña
larga; esto frena al script tonto.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 3: El cliente de GitHub y la lista blanca

**Files:**
- Create: `src/servidor/github.ts`
- Create: `src/servidor/rutas-permitidas.ts`
- Test: `test/github.test.ts`, `test/rutas-permitidas.test.ts`

**Interfaces:**
- Produce:
  ```ts
  // github.ts — todo recibe el contexto, nada lee del ambiente.
  export interface Credenciales { token: string; duenio: string; repo: string; fetch: typeof globalThis.fetch }
  export function cliente(c: Credenciales): {
    ref(nombre: string): Promise<{ sha: string }>
    commit(sha: string): Promise<{ sha: string; tree: string; message: string; author: { date: string } }>
    contenido(sha: string): Promise<string>          // un blob, como texto
    creaBlob(contenido: string): Promise<string>     // → sha
    creaArbol(base: string, entradas: EntradaArbol[]): Promise<string>
    creaCommit(datos: DatosCommit): Promise<string>
    mueveRef(nombre: string, sha: string, forzar?: boolean): Promise<void>
  }
  export interface EntradaArbol { path: string; sha: string | null }  // null = borrar
  export interface DatosCommit { mensaje: string; arbol: string; padre: string; autor: { name: string; email: string } }

  // rutas-permitidas.ts
  export const TOPE_ARCHIVOS = 40
  export const TOPE_CUERPO = 3.5 * 1024 * 1024
  export function rutaPermitida(ruta: string): boolean
  export function revisaLote(rutas: string[], bytesDelCuerpo: number): { ok: true } | { ok: false; problema: string }
  ```
  Las usan `publicar.ts` (Tarea 5) y la compuerta (Tarea 6).

- [ ] **Paso 1: Los tests de la lista blanca, que hoy fallan**

Create `test/rutas-permitidas.test.ts`:

```ts
/*
 * La lista blanca de escritura. Defensa en profundidad: el PAT ya no tiene
 * permiso de Workflows, así que GitHub rechazaría solo un push a
 * .github/workflows/**. Esto lo para antes, y para además todo lo que el PAT
 * SÍ podría escribir y el panel no tiene por qué tocar.
 */
import { describe, it, expect } from 'vitest'
import { rutaPermitida, revisaLote, TOPE_ARCHIVOS, TOPE_CUERPO } from '../src/servidor/rutas-permitidas'

describe('qué rutas puede escribir el panel', () => {
  it('acepta los cuatro documentos de contenido', () => {
    for (const r of ['sitio', 'sabores', 'fichas', 'envolturas']) {
      expect(rutaPermitida(`src/contenido/datos/${r}.json`)).toBe(true)
    }
  })

  it('acepta las fotos de producto donde viven', () => {
    expect(rutaPermitida('public/sitio/marca/barra-canela.webp')).toBe(true)
    expect(rutaPermitida('public/sitio/envoltura/canela-frente.webp')).toBe(true)
    expect(rutaPermitida('public/sitio/etiqueta-morado.webp')).toBe(true)
  })

  it('rechaza lo que rompería el sitio o la compuerta', () => {
    for (const r of [
      '.github/workflows/verifica.yml',
      'package.json',
      'src/pages/index.astro',
      'api/panel.js',
      'src/contenido/esquema/sitio.ts',
      'vercel.json',
    ]) {
      expect(rutaPermitida(r)).toBe(false)
    }
  })

  it('rechaza las escapadas de directorio y los nombres raros', () => {
    for (const r of [
      'src/contenido/datos/../../../etc/passwd',
      'src/contenido/datos/Sitio.json',          // mayúscula: el repo es todo minúsculas
      'src/contenido/datos/sitio.json.bak',
      '/src/contenido/datos/sitio.json',          // absoluta
      'src/contenido/datos/sub/sitio.json',
      'public/sitio/marca/../../../package.json',
    ]) {
      expect(rutaPermitida(r)).toBe(false)
    }
  })
})

describe('los topes del lote', () => {
  it('acepta un lote normal', () => {
    expect(revisaLote(['src/contenido/datos/sitio.json'], 40_000)).toEqual({ ok: true })
  })

  it('rechaza demasiados archivos, con un mensaje que la clienta entiende', () => {
    const muchas = Array.from({ length: TOPE_ARCHIVOS + 1 }, (_, i) => `public/sitio/marca/barra-${i}.webp`)
    const r = revisaLote(muchas, 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problema).toMatch(/demasiad/i)
      expect(r.problema).not.toMatch(/TOPE_ARCHIVOS|array|payload/i)
    }
  })

  it('rechaza un cuerpo más grande que el tope', () => {
    const r = revisaLote(['src/contenido/datos/sitio.json'], TOPE_CUERPO + 1)
    expect(r.ok).toBe(false)
  })

  it('rechaza el lote entero si UNA ruta no está permitida', () => {
    const r = revisaLote(['src/contenido/datos/sitio.json', 'package.json'], 1000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problema).toContain('package.json')
  })
})
```

- [ ] **Paso 2: Correr, ver fallar, implementar, verde**

Run: `pnpm exec vitest run test/rutas-permitidas.test.ts` → **FAIL** (no existe).
Implementá `src/servidor/rutas-permitidas.ts` con las tres expresiones de la E6
y los topes. Los mensajes van en español mexicano y sin jerga: «Son demasiadas
fotos para una sola publicación: mandá hasta 40 por vez.»
Run de nuevo → **PASS los ocho.**

- [ ] **Paso 3: Los tests del cliente de GitHub, que hoy fallan**

Create `test/github.test.ts`. El cliente recibe `fetch` por parámetro, así que
los tests le pasan uno falso y verifican QUÉ pide, no que la red ande:

```ts
/*
 * El cliente de la Git Data API. Recibe `fetch` por parámetro: estos tests le
 * pasan uno de mentira y revisan el pedido que arma. Nunca sale a la red, y no
 * hace falta ningún token para correrlos.
 */
import { describe, it, expect } from 'vitest'
import { cliente } from '../src/servidor/github'

function fetchFalso(respuestas: Array<{ status?: number; cuerpo: unknown }>) {
  const pedidos: Array<{ url: string; metodo: string; cuerpo: unknown; cabeceras: Record<string, string> }> = []
  let i = 0
  const f = async (url: string | URL, init?: RequestInit) => {
    const r = respuestas[Math.min(i++, respuestas.length - 1)]
    pedidos.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      cabeceras: (init?.headers ?? {}) as Record<string, string>,
    })
    return new Response(JSON.stringify(r.cuerpo), { status: r.status ?? 200 })
  }
  return { f: f as unknown as typeof globalThis.fetch, pedidos }
}

const creds = (f: typeof globalThis.fetch) => ({
  token: 'token-de-prueba', duenio: 'MarcosBuratovich', repo: 'maracacao', fetch: f,
})

describe('el cliente de GitHub', () => {
  it('manda el token y la versión de la API en cada pedido', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { object: { sha: 'abc' } } }])
    await cliente(creds(f)).ref('heads/main')
    expect(pedidos[0].cabeceras.Authorization).toBe('Bearer token-de-prueba')
    expect(pedidos[0].cabeceras['X-GitHub-Api-Version']).toBeTruthy()
    expect(pedidos[0].url).toContain('/repos/MarcosBuratovich/maracacao/git/ref/heads/main')
  })

  it('crea un blob con el contenido en base64', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { sha: 'blob1' } }])
    const sha = await cliente(creds(f)).creaBlob('hola')
    expect(sha).toBe('blob1')
    expect(pedidos[0].metodo).toBe('POST')
    expect(pedidos[0].cuerpo).toEqual({ content: Buffer.from('hola').toString('base64'), encoding: 'base64' })
  })

  it('un borrado viaja como sha null, que es como la API borra', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { sha: 'arbol1' } }])
    await cliente(creds(f)).creaArbol('base', [{ path: 'a.json', sha: null }])
    const cuerpo = pedidos[0].cuerpo as { tree: Array<Record<string, unknown>> }
    expect(cuerpo.tree[0]).toMatchObject({ path: 'a.json', sha: null, mode: '100644', type: 'blob' })
  })

  it('mueve el ref sin forzar, salvo que se lo pidan', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: {} }, { cuerpo: {} }])
    const c = cliente(creds(f))
    await c.mueveRef('heads/main', 'nuevo')
    expect(pedidos[0].cuerpo).toEqual({ sha: 'nuevo', force: false })
    await c.mueveRef('heads/main', 'nuevo', true)
    expect(pedidos[1].cuerpo).toEqual({ sha: 'nuevo', force: true })
  })

  it('un error de GitHub llega como excepción con el status adentro', async () => {
    const { f } = fetchFalso([{ status: 422, cuerpo: { message: 'Update is not a fast forward' } }])
    await expect(cliente(creds(f)).mueveRef('heads/main', 'x')).rejects.toThrow(/422/)
  })

  it('el error trae el mensaje de GitHub, que es lo que Marcos necesita en el log', async () => {
    const { f } = fetchFalso([{ status: 409, cuerpo: { message: 'Conflicto raro' } }])
    await expect(cliente(creds(f)).ref('heads/main')).rejects.toThrow(/Conflicto raro/)
  })
})
```

- [ ] **Paso 4: Correr, ver fallar, implementar, verde**

Run: `pnpm exec vitest run test/github.test.ts` → **FAIL**.
Implementá `src/servidor/github.ts`: un `pedir()` interno que arma la URL,
pone las cabeceras (`Authorization: Bearer`, `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`, `User-Agent: panel-maracacao`), y si el
status no es 2xx tira un `Error` con status y el `message` del cuerpo.
Run de nuevo → **PASS los seis.**

- [ ] **Paso 5: Probar que los tests detectan**

Mutación: cambiá `force: false` por `force: true` en `mueveRef` → **rojo** en
«mueve el ref sin forzar». Restaurá, verde. Pegá las dos salidas. Esta es la
mutación que importa: `force: true` es exactamente cómo el panel se comería un
commit de Marcos sin avisar.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add src/servidor/github.ts src/servidor/rutas-permitidas.ts test/github.test.ts test/rutas-permitidas.test.ts
git commit -m "$(cat <<'EOF'
feat: el cliente de GitHub y la lista blanca de lo que el panel puede escribir

El cliente recibe `fetch` por parámetro, así que la suite prueba qué pedido
arma sin salir a la red y sin ningún token. La lista blanca es defensa en
profundidad: el PAT ya no puede tocar workflows, y esto para además todo lo
que sí podría escribir y el panel no tiene por qué tocar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 4: `diff.ts` — el resumen que la clienta lee antes de publicar

**Files:**
- Create: `src/contenido/diff.ts`
- Test: `test/diff.test.ts`

**Interfaces:**
- Produce:
  ```ts
  export interface Cambio { campo: string; etiqueta: string; antes: unknown; despues: unknown; tipo: 'cambio' | 'alta' | 'baja' }
  export function resume(antes: unknown, despues: unknown, esquema: z.ZodType): Cambio[]
  export function frase(cambios: Cambio[]): string
  ```
  `frase()` es el asunto del commit (Tarea 5) y va a ser el resumen de la
  bandeja y del historial en la fase 6. Una sola función para los tres, o los
  tres dicen cosas distintas de lo mismo.

**Regla de la carpeta:** esto vive en `src/contenido/`, así que **no importa
`node:*` ni Astro** — lo van a importar el navegador (la bandeja), la función
(el asunto del commit) y la suite.

- [ ] **Paso 1: Los tests, que hoy fallan**

Create `test/diff.test.ts`:

```ts
/*
 * El resumen de qué cambió. Lo lee la clienta antes de publicar, es el asunto
 * del commit y es lo que el historial muestra. Si miente, miente en los tres
 * lugares a la vez.
 */
import { describe, it, expect } from 'vitest'
import { resume, frase } from '../src/contenido/diff'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { marca } from '@/copy/sitio-marca'

const clon = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe('el resumen de cambios', () => {
  it('sin cambios, no dice nada', () => {
    expect(resume(marca, clon(marca), esquemaSitio)).toEqual([])
  })

  it('un texto cambiado sale con su etiqueta del esquema, no con su ruta', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'Elegí tu barra'
    const cambios = resume(marca, despues, esquemaSitio)
    expect(cambios).toHaveLength(1)
    expect(cambios[0].campo).toBe('anaquel.titulo')
    // La etiqueta es lo que la clienta ve en el panel, y es lo que tiene que
    // leer en el resumen: «Título del anaquel», no «anaquel.titulo».
    expect(cambios[0].etiqueta).not.toContain('.')
    expect(cambios[0].antes).toBe(marca.anaquel.titulo)
    expect(cambios[0].despues).toBe('Elegí tu barra')
  })

  it('un elemento agregado a una lista es un alta, no un cambio', () => {
    const despues = clon(marca)
    despues.preguntas.items.push({ p: '¿Hacen envíos?', r: 'Todavía no.' })
    const cambios = resume(marca, despues, esquemaSitio)
    expect(cambios.some((c) => c.tipo === 'alta')).toBe(true)
  })

  it('un elemento borrado es una baja', () => {
    const despues = clon(marca)
    despues.preguntas.items.pop()
    expect(resume(marca, despues, esquemaSitio).some((c) => c.tipo === 'baja')).toBe(true)
  })

  it('no reporta los derivados: no se editan', () => {
    const despues = clon(marca)
    despues.anaquel.contadorDe = 'de 99'
    expect(resume(marca, despues, esquemaSitio)).toEqual([])
  })
})

describe('la frase', () => {
  it('con un solo cambio nombra el campo', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'Otro'
    expect(frase(resume(marca, despues, esquemaSitio))).toMatch(/cambi/i)
  })

  it('con varios cambios cuenta, y no lista quince cosas', () => {
    const despues = clon(marca)
    despues.anaquel.titulo = 'A'
    despues.anaquel.kicker = 'B'
    despues.polvo.titulo = 'C'
    const f = frase(resume(marca, despues, esquemaSitio))
    expect(f).toMatch(/3/)
    expect(f.length).toBeLessThan(72)   // el asunto de un commit
  })

  it('sin cambios no inventa una frase', () => {
    expect(frase([])).toBe('')
  })

  it('la frase pasa el filtro de vocabulario de la marca', async () => {
    const { palabraProhibida } = await import('../src/contenido/vocabulario')
    const despues = clon(marca)
    despues.anaquel.titulo = 'Otro'
    expect(palabraProhibida(frase(resume(marca, despues, esquemaSitio)))).toBeNull()
  })
})
```

- [ ] **Paso 2: Correr, ver fallar**

Run: `pnpm exec vitest run test/diff.test.ts` → **FAIL** (no existe el módulo).

- [ ] **Paso 3: Implementar**

`resume()` recorre el esquema con `recorre()` —la misma función que usan el
panel y la biyección— y para cada hoja compara el valor de antes con el de
después, saltando lo que tenga `control: 'derivado'` u `oculto`. La etiqueta
sale del metadato (`meta.etiqueta`). Para las listas, compara por índice y
reporta alta/baja cuando cambia el largo.

`frase()` arma el asunto: con un cambio, `«cambia <etiqueta>»`; con varios,
`«cambia <n> textos»` o `«cambia <n> textos y <m> precios»` si conviene. Tope
duro de 72 caracteres, que es lo que entra en el asunto de un commit sin que
git lo corte feo.

Run de nuevo → **PASS los nueve.**

- [ ] **Paso 4: Probar que detecta**

Mutación: hacé que `resume()` NO saltee los derivados → **rojo** en «no reporta
los derivados». Restaurá, verde. Pegá las dos salidas: es la que evita que cada
publicación diga «cambiaste el contador» porque el número de barras se
recalculó solo.

- [ ] **Paso 5: Compuerta y commit**

```bash
pnpm build
git add src/contenido/diff.ts test/diff.test.ts
git commit -m "$(cat <<'EOF'
feat: el resumen de qué cambió, que es el mismo en los tres lugares

Lo lee la clienta antes de publicar, es el asunto del commit y va a ser el
historial. Una sola función para los tres: si cada uno lo calculara por su
lado, tres resúmenes de lo mismo terminan diciendo cosas distintas.

Sale del esquema, así que habla con las etiquetas que la clienta ve —«Título
del anaquel», no «anaquel.titulo»— y se saltea los derivados, que no se
editan y ensuciarían cada publicación.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 5: `publicar.ts` — un commit atómico, o nada

**Files:**
- Create: `src/servidor/publicar.ts`
- Test: `test/publicar.test.ts`

**Interfaces:**
- Consume: `cliente()` de `github.ts`, `resume`/`frase` de `diff.ts`, `revisaLote` de `rutas-permitidas.ts`.
- Produce:
  ```ts
  export interface Archivo { ruta: string; contenido: string }   // contenido ya serializado
  export interface Publicacion { archivos: Archivo[]; autor: string; ramaSha?: string }
  export type Resultado =
    | { ok: true; sha: string; resumen: string }
    | { ok: false; codigo: 409 | 422 | 502; problema: string }
  export async function publica(gh: ReturnType<typeof cliente>, p: Publicacion): Promise<Resultado>
  ```

- [ ] **Paso 1: Los tests, que hoy fallan**

Create `test/publicar.test.ts`. Usan el mismo `fetch` falso de
`test/github.test.ts` —copialo o extraelo a `test/lib/github-falso.ts`, tu
decisión, pero si lo extraés actualizá también el test de la Tarea 3:

```ts
/*
 * Una publicación es UN commit. Los tests recorren el camino entero con un
 * GitHub de mentira y verifican la secuencia, porque el modo de falla que
 * importa no es «no publicó» sino «publicó a medias»: dos JSON escritos y el
 * tercero no, con el sitio en un estado que nadie escribió nunca.
 */
import { describe, it, expect } from 'vitest'
import { cliente } from '../src/servidor/github'
import { publica } from '../src/servidor/publicar'

// (mismo ayudante `fetchFalso` de test/github.test.ts)

describe('publicar', () => {
  it('hace blobs, árbol, commit y mueve el ref, en ese orden', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main-viejo' } } },   // ref
      { cuerpo: { sha: 'commit-viejo', tree: { sha: 'arbol-viejo' } } }, // commit padre
      { cuerpo: { sha: 'blob-nuevo' } },               // blob
      { cuerpo: { sha: 'arbol-nuevo' } },              // tree
      { cuerpo: { sha: 'commit-nuevo' } },             // commit
      { cuerpo: {} },                                  // patch ref
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'clienta@ejemplo.mx',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sha).toBe('commit-nuevo')
    expect(pedidos.map((p) => p.metodo)).toEqual(['GET', 'GET', 'POST', 'POST', 'POST', 'PATCH'])
  })

  it('el commit lleva el autor del panel y el trailer con quién publicó', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } }, { cuerpo: {} },
    ])
    await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'clienta@ejemplo.mx',
    })
    const commit = pedidos[4].cuerpo as { message: string; author: { name: string; email: string } }
    expect(commit.author).toEqual({ name: 'Panel Maracacao', email: 'panel@maracacao.mx' })
    expect(commit.message).toContain('Panel: sí')
    expect(commit.message).toContain('Panel-Autor: clienta@ejemplo.mx')
  })

  it('si el ref se movió mientras tanto, reintenta UNA vez', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'main-1' } } }, { cuerpo: { sha: 'c1', tree: { sha: 'a1' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } },
      { status: 422, cuerpo: { message: 'Update is not a fast forward' } },  // el PATCH falla
      { cuerpo: { object: { sha: 'main-2' } } }, { cuerpo: { sha: 'c3', tree: { sha: 'a3' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a4' } }, { cuerpo: { sha: 'c4' } }, { cuerpo: {} },
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
      autor: 'x@y.mx',
    })
    expect(r.ok).toBe(true)
    expect(pedidos.filter((p) => p.metodo === 'PATCH')).toHaveLength(2)
  })

  it('si el segundo intento también choca, es 409 y se lo dice en castellano', async () => {
    const choque = { status: 422, cuerpo: { message: 'Update is not a fast forward' } }
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: 'm' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a2' } }, { cuerpo: { sha: 'c2' } }, choque,
      { cuerpo: { object: { sha: 'm2' } } }, { cuerpo: { sha: 'c3', tree: { sha: 'a3' } } },
      { cuerpo: { sha: 'b' } }, { cuerpo: { sha: 'a4' } }, { cuerpo: { sha: 'c4' } }, choque,
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe(409)
      expect(r.problema).toMatch(/Marcos/)          // le dice quién tocó el sitio
      expect(r.problema).not.toMatch(/fast forward|422|ref/i)
    }
  })

  it('una ruta prohibida no llega ni al primer pedido', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: {} }])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: '.github/workflows/verifica.yml', contenido: 'malo' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    expect(pedidos).toHaveLength(0)
  })

  it('si GitHub se cae a mitad, no queda medio publicado: el ref no se movió', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'm' } } }, { cuerpo: { sha: 'c', tree: { sha: 'a' } } },
      { cuerpo: { sha: 'b' } }, { status: 502, cuerpo: { message: 'Bad gateway' } },
    ])
    const r = await publica(cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f }), {
      archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }], autor: 'x@y.mx',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe(502)
    expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(false)
  })
})
```

- [ ] **Paso 2: Correr, ver fallar, implementar, verde**

Run: `pnpm exec vitest run test/publicar.test.ts` → **FAIL**.

`publica()` en orden: `revisaLote` primero (no gasta ni un pedido si hay una
ruta prohibida) → leer el ref y su commit → crear los blobs que falten, **en
paralelo con concurrencia 4** → crear el árbol sobre `base_tree` → crear el
commit con el asunto de `frase()` y los trailers → `PATCH` del ref con
`force: false`. Si el PATCH falla por no ser fast-forward, se reintenta UNA vez
desde el principio (el árbol tiene que armarse sobre el commit nuevo, no sobre
el viejo). Si vuelve a fallar: 409 con el mensaje en castellano.

Run de nuevo → **PASS los seis.**

- [ ] **Paso 3: Probar que detecta la atomicidad**

Mutación: mové el `PATCH` del ref ANTES de crear el commit (o hacé dos PATCH,
uno por archivo) → **rojo** en «si GitHub se cae a mitad…». Restaurá, verde.
Pegá las dos salidas. Es la mutación que representa el modo de falla real: el
sitio en un estado que nadie escribió.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/servidor/publicar.ts test/publicar.test.ts
git commit -m "$(cat <<'EOF'
feat: publicar es un commit o no es nada

Blobs, árbol, commit y recién ahí el ref, con force:false. Si algo se cae en
el medio, el ref no se movió y el sitio sigue como estaba: el modo de falla
que hay que evitar no es «no publicó» sino «publicó a medias», con dos
documentos escritos y el tercero no.

Si Marcos tocó el sitio mientras la clienta editaba, se reintenta una vez y
si vuelve a chocar se lo dice con nombre y apellido, sin hablar de refs ni
de fast-forward.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 6: La función — el router, la compuerta y las tres acciones

**Files:**
- Create: `src/servidor/acciones.ts`
- Create: `src/servidor/entradas/panel.ts` (la fuente; el artefacto es `api/panel.js`)
- Modify: `scripts/bundle-api.ts` (sumar la función nueva), `vercel.json`, `test/bundle-api.test.ts`
- Test: `test/acciones.test.ts`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: `/api/panel?accion=entrar|publicar|salud`.

- [ ] **Paso 1: Los tests del router, que hoy fallan**

Create `test/acciones.test.ts`. El router recibe un contexto con TODO inyectado
—las variables, `fetch`, el reloj— así que los tests lo ejercen entero sin red:

```ts
/*
 * El router de /api/panel. Es delgado a propósito: valida la sesión, revalida
 * el contenido y delega. Estos tests son los que cubren la compuerta, que es
 * la capa que de verdad decide si algo entra al sitio.
 */
import { describe, it, expect } from 'vitest'
import { maneja } from '../src/servidor/acciones'
import { hashDeClave, firmaSesion } from '../src/servidor/sesion'
import { marca } from '@/copy/sitio-marca'

const SECRETO = 'secreto-de-prueba'
const CLAVE = 'una contraseña larga de prueba'

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
})

describe('publicar', () => {
  it('sin cookie, 401 y sin tocar GitHub', async () => {
    const usos = { n: 0 }
    const r = await maneja('publicar', { cuerpo: { documentos: {} }, cookie: '' }, contextoBase(contando(usos)))
    expect(r.status).toBe(401)
    expect(usos.n).toBe(0)
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
})

describe('las acciones que todavía no existen', () => {
  it('devuelven 404, no 500', async () => {
    for (const accion of ['borrador', 'historial', 'revertir', 'estado']) {
      const r = await maneja(accion, { cuerpo: {}, cookie: cookieValida() }, contextoBase(fetchQueNoSeUsa()))
      expect(r.status).toBe(404)
    }
  })
})
```

(`fetchQueNoSeUsa()` tira si alguien lo llama; `contando(usos)` cuenta
llamadas y devuelve respuestas vacías. Escribilos arriba del archivo.)

- [ ] **Paso 2: Correr, ver fallar, implementar, verde**

Run: `pnpm exec vitest run test/acciones.test.ts` → **FAIL**.

`maneja(accion, pedido, contexto)` hace, en este orden:
1. `entrar`: chequea `intentoPermitido(ip)`, que el correo esté en
   `PANEL_CORREOS`, y `claveCorrecta`. Todo lo que falle devuelve el MISMO 401
   con el mismo texto — no se le dice a un atacante cuál de las tres falló.
2. `publicar`: verifica la cookie; para cada documento del cuerpo, revalida con
   `validar()` (el esquema completo, no solo los campos que cambiaron);
   serializa con `serializa()` para que los bytes sean los canónicos; arma los
   `Archivo[]` y llama a `publica()`.
3. `salud`: lista qué variables faltan (por NOMBRE, nunca por valor).
4. Cualquier otra: 404.

Run de nuevo → **PASS los diez.**

- [ ] **Paso 3: El borde**

Create `src/servidor/entradas/panel.ts`: lee `process.env`, arma el contexto,
llama a `maneja()` y traduce el resultado a la respuesta HTTP. Nada más — si
tiene un `if` de negocio, está en el archivo equivocado.

Sumalo a `FUNCIONES` en `scripts/bundle-api.ts` (salida `api/panel.js`) y al
test de frescura. En `vercel.json`:

```json
"functions": { "api/panel.js": { "maxDuration": 60 } }
```

**El porqué del 60:** una publicación son ~7 llamadas a GitHub más el tiempo de
las imágenes; el default de 10 s alcanza para un texto y no para una foto.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add -A
git commit -m "$(cat <<'EOF'
feat: la función del panel — entrar, publicar y salud

El router es delgado a propósito: valida la sesión, revalida el contenido
completo con el mismo `validar()` que corre en el navegador y en la suite, y
delega. La revalidación del servidor no es redundante: es la única capa que
no se puede saltear desde el otro lado.

Las acciones que todavía no existen contestan 404 y no 500, así que el panel
de la fase 6 puede preguntar sin romperse.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 7: La prueba de humo real, y el runbook

**Esta tarea necesita los tokens cargados en Vercel. Si no están, se para acá y se avisa: no se inventa una prueba con datos falsos que después nadie repite.**

**Files:**
- Modify: `docs/panel-operacion.md`
- Test: manual, documentado en el reporte

- [ ] **Paso 1: Confirmar que las variables están**

```bash
curl -s https://www.maracacao.mx/api/panel?accion=salud | head -c 400
```

Expected: un JSON que diga que no falta ninguna variable. Si falta alguna, el
nombre aparece ahí — pedíselas al controlador y pará.

- [ ] **Paso 2: Entrar de verdad**

Con la contraseña que Marcos cargó (el controlador te la pasa por el canal que
él elija, NUNCA por el repo):

```bash
curl -s -i -X POST 'https://www.maracacao.mx/api/panel?accion=entrar' \
  -H 'Content-Type: application/json' -H 'Origin: https://www.maracacao.mx' \
  -d '{"correo":"<el de Marcos>","clave":"<la contraseña>"}' | head -20
```

Expected: 200 y una cabecera `Set-Cookie` con `HttpOnly; Secure; SameSite=Lax`.

Y la prueba que importa: **la contraseña equivocada tiene que dar 401**, y al
sexto intento seguido, 429.

- [ ] **Paso 3: Publicar un cambio de verdad, y volverlo atrás**

El cambio más chico y más reversible que existe: un espacio al final de un
texto que no se ve. Tomá `src/contenido/datos/sitio.json`, cambiá UN texto de
forma visible pero inocua (por ejemplo `footer.derechos`), y publicá:

```bash
curl -s -X POST 'https://www.maracacao.mx/api/panel?accion=publicar' \
  -H 'Content-Type: application/json' -H 'Origin: https://www.maracacao.mx' \
  -H 'Cookie: <la cookie del paso 2>' \
  -d @/tmp/publicacion.json | head -c 400
```

Expected: `{"ok":true,"sha":"…","resumen":"cambia …"}`.

Y después, en orden:
1. `git fetch && git log origin/main -1 --format='%an <%ae>%n%s%n%b'` → el autor
   tiene que ser `Panel Maracacao` y el cuerpo tiene que traer `Panel-Autor`.
2. Esperar el deploy y verificar que el sitio en vivo muestra el texto nuevo.
3. **Dejar el sitio como estaba**: publicá el valor original por el mismo
   camino. No con `git revert` desde la computadora: la vuelta tiene que
   probar el mismo canal.

Pegá en el reporte las tres salidas y el sha de las dos publicaciones.

- [ ] **Paso 4: El runbook**

Completá `docs/panel-operacion.md` con lo que hoy falta, en rioplatense y para
el Marcos de dentro de seis meses:

- Qué es cada variable y dónde se carga (Vercel → Settings → Environment
  Variables → Production).
- **Cómo rotar el PAT de GitHub en cinco minutos**, que es lo que hay que hacer
  si se filtra: revocar en GitHub, generar uno nuevo con los mismos permisos,
  pegarlo en Vercel, redeploy. Con los clics, no «rotá el token».
- Cómo cerrar TODAS las sesiones abiertas: cambiar `PANEL_SECRETO`.
- Cómo cambiar la contraseña de la clienta.
- **Qué hacer si `main` queda roto**: el sitio sigue sirviendo el último deploy
  bueno, así que no hay apuro; se arregla con un commit normal desde la
  computadora.
- Qué NO puede hacer el panel aunque quisiera (tocar workflows, tocar código,
  escribir fuera de la lista blanca) y por qué.

- [ ] **Paso 5: Commit**

```bash
git add docs/panel-operacion.md
git commit -m "$(cat <<'EOF'
docs: el runbook del panel — rotar el token, cerrar sesiones, main roto

Lo que hay que saber cuando algo sale mal y no hay tiempo de leer el spec de
mil ochocientas líneas. Con los clics, no con verbos: «revocá en Settings →
Developer settings → …», no «rotá el token».

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

## Cobertura del spec

| Lo que pide el spec (§4) | Dónde |
|---|---|
| El experimento del tracing y su plan B | Tarea 1 (y ya resuelto antes del plan) |
| Contraseña scrypt, tiempo constante, tope de intentos (§4.1) | Tarea 2 |
| Cookie de sesión de un año / 30 días (§4.1) | Tarea 2 |
| Lista blanca `PANEL_CORREOS` releída en cada pedido (§4.1) | Tarea 6 |
| PAT fine-grained sin Workflows (§4.2) | Tarea 7 (el token lo crea Marcos) + la lista blanca en Tarea 3 |
| Un commit atómico, `force: false`, reintento único (§4.2) | Tarea 5 |
| Lista blanca de rutas y topes (§4.2) | Tarea 3 |
| Autor y trailers del commit; el asunto sale del diff (§4.2) | Tareas 4 y 5 |
| La capa 2 de la compuerta: revalidación en la función (§4.4) | Tarea 6 |
| `maxDuration: 60` (§4) | Tarea 6 |
| El runbook (fase 8 del orden de trabajo, adelantado) | Tareas 1, 2 y 7 |

**Lo que queda para la Parte B**, y se planifica cuando esta cierre: el enlace
mágico de recuperación (§4.1), el borrador en `refs/panel/borrador` (§4.3), el
estado del deploy con la API de Vercel y `version.json` (§4.5), la reversión
automática y el deshacer de 30 minutos (§4.6), el historial, los avisos por
correo y la vigilancia del vencimiento del PAT.

**Lo que este plan NO resuelve y hay que saber:**

- **El límite de intentos es de memoria de proceso** (E4). Si algún día hace
  falta de verdad, necesita un almacén externo que hoy no existe.
- **La prueba de humo depende de tokens que carga Marcos.** Sin ellos la Tarea 7
  se para; las seis anteriores corren igual, porque todo se prueba con `fetch`
  inyectado.
- **El panel todavía no existe**: al terminar esta parte se publica con `curl`.
  La pantalla es la fase 6.
