# Fase 5, Parte B — todo lo que pasa alrededor de la escritura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la clienta pueda publicar sin que nadie la acompañe: que sepa si su cambio llegó al sitio, que pueda deshacerlo con una mano, que el sitio se arregle solo si el deploy falla, que pueda entrar aunque olvide la contraseña, y que ninguna de esas cosas dependa de que Marcos esté mirando.

**Architecture:** la Parte A dejó el canal de escritura (`/api/panel?accion=entrar|publicar|salud`). Esta parte le agrega las acciones que lo rodean —`estado`, `deshacer`, `historial`, `borrador`, `enlace`— más dos clientes nuevos, puros e inyectables como todo `src/servidor/**`: uno para la API de Vercel (¿terminó el deploy?) y otro para Resend (avisarle por correo). La verdad de «ya está en el sitio» la dicen DOS fuentes que tienen que coincidir: la API de Vercel dice que el deploy terminó, y `version.json` —una página estática nueva, servida por el CDN— dice qué commit se está sirviendo de verdad.

**Tech Stack:** Vercel Functions (Node 22), esbuild, TypeScript 6, Zod 4.4.3, Vitest 4, API REST de GitHub (Git Data + Contents), API REST de Vercel, Resend, Astro 7 (endpoint estático), pnpm 11.2.2.

**Spec:** `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` — §4.1 (enlace mágico, vigilancia del PAT), §4.2 (escritura, base sha), §4.3 (borrador de dos capas — la capa 2), §4.4 (la compuerta), §4.5 (feedback: `version.json` manda), §4.6 (vuelta atrás).

**De dónde sale la lista de tareas:** de la sección «Lo que la Parte B tiene que resolver» del cierre de `docs/superpowers/plans/2026-09-16-panel-fase-5-parte-a.md`, más las cinco secciones del spec de arriba. Las cinco herencias del cierre están cubiertas: la pérdida silenciosa (Tarea 2), la revocación de sesiones (Tarea 3), los avisos de conteo (Tarea 14), `archivoEnRef`/`TOPE_CUERPO` (Tarea 1) y las correcciones al spec (Tarea 15).

**Lo que esta parte NO hace, y queda para la fase 6:** ninguna pantalla del panel. La única página que esta parte agrega es `/panel/entrar`, y es HTML estático de veinte líneas con un botón —es la puerta de recuperación, y tiene que funcionar ANTES de que exista el panel, porque es justamente cómo se entra cuando no se puede entrar. La capa 1 del borrador (IndexedDB, cada tecla) también es de la fase 6: acá se construye solo la capa 2, el ref del servidor.

## Global Constraints

Valen para toda tarea de este plan.

- **Ningún secreto entra al repo. Nunca.** Ni en código, ni en tests, ni en fixtures, ni en un comentario. Las variables viven en el panel de Vercel (solo entorno Production). Los tests usan valores de prueba generados en el propio test.
- **`src/servidor/entradas/**` es el BORDE y `src/servidor/**` es puro e inyectable:** el borde —un archivo por función, y nada más que eso— es el único que lee `process.env` y toma `fetch` del global: arma el contexto y lo pasa hacia adentro. Todo el resto (`sesion`, `github`, `publicar`, `acciones`, `rutas-permitidas`, y los dos módulos nuevos de esta parte) recibe lo que necesita por parámetro, incluido el reloj. Es lo que hace que la suite los pruebe sin red y sin secretos.
- **`src/contenido/**` sigue con su regla dura:** no importa `node:*`, no importa Astro, y usa solo rutas relativas sin extensión. El guard es lista blanca desde la fase 1. `src/servidor/**` SÍ puede importar `node:crypto` y `src/contenido/**`.
- **Lo que le habla a la clienta va en español mexicano, sin jerga y sin nombrar tecnologías.** «No pude publicar: revisa tu conexión», nunca «HTTP 502 del upstream». Nunca «Vercel», «GitHub», «commit», «deploy», «ref». Los comentarios del código y los mensajes para Marcos van en español rioplatense y explican POR QUÉ.
- **Vocabulario prohibido de MARCA:** «mono», «chango», «changuito», «chispa(s)», «carrito», «pistachos», «cacahuete», «maní», «packaging», «snack», «smoothie».
- **La función nunca escribe sin revalidar.** `validarContra()` corre de nuevo en el servidor sobre el documento completo, aunque el navegador ya lo haya validado. Eso vale también para lo que escriben las acciones NUEVAS: `deshacer` y el revert automático publican contenido viejo, y el contenido viejo puede no pasar las reglas de hoy.
- **Un solo commit por publicación**, con `force: false` sobre `refs/heads/main`. Nunca `force: true` sobre main, nunca dos commits. (El ref de borrador es la excepción declarada: ver la decisión **B5**.)
- **Toda acción nueva que escriba o lea algo privado exige sesión**, y la sesión se valida con `sesionVigente()` (Tarea 3), nunca con `verificaSesion()` a secas.
- **Los invisibles se escriben como escape (` `), nunca se pegan.** Después de tocar cualquier archivo con invisibles, verificalo:
  ```bash
  python3 -c "import io;print(io.open('<archivo>',encoding='utf-8').read().count(chr(0xa0)))"
  ```
- **Tocás `src/servidor/**`, corrés `pnpm bundle:api` y commiteás `api/panel.js` en el MISMO commit.** `test/bundle-api.test.ts` no deja que se separen, y ese test corre en el camino de deploy: si se separan, Vercel no despliega.
- **Línea base:** hoy `pnpm test` da **1000 tests verdes (47 archivos)** y `pnpm typecheck` **0 errores, 0 warnings, 3 hints**. Ninguna tarea puede bajar el verde.
- **`pnpm build` es la compuerta:** construye el sitio, corre la suite y `astro check`. Ningún test invoca `pnpm build` (`test/meta.test.ts` lo prohíbe: es una bomba de recursión).
- **Ningún test nuevo puede congelar contenido.** `docs/tests-que-congelan-contenido.md` (actualización 2026-09-17) es la regla: antes de escribir un assert que mire contenido, preguntate si la clienta puede escribir ese valor desde el panel. Si puede, el assert no va en `pnpm verifica` — va como regla del esquema, o no va.
- **Commits en español, imperativo,** terminando con:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
  ```

---

## Decisiones de esta parte (leelas antes de la Tarea 1)

**B1 · La función NO sondea: sondea el panel, y la función decide.** El spec §4.6
dice «la función —que ya está sondeando— arma un commit de reversión», y §4.5
dice que «el polling lo dicta el servidor (3 s el primer minuto, 6 s después,
tope 5 minutos)». Las dos cosas juntas no se pueden implementar como están
escritas: `maxDuration` de una función de Vercel es 60 s (hoy, en
`vercel.json`) y un deploy tarda más que eso. Se resuelve así, y esto es lo que
hay que implementar:

- El panel llama a `accion=estado&sha=…` cada tantos segundos. **La respuesta
  dice cuándo volver a preguntar** (`reintentarEn`, en milisegundos) y cuándo
  dejar de preguntar (`reintentarEn: null`). El reloj del servidor es el que
  manda; el panel solo obedece. Con eso, «3 s el primer minuto, 6 s después,
  tope 5 minutos» se cumple tal cual lo pide el spec.
- **La reversión automática la hace la invocación de `estado` que ve el
  fracaso**, no un proceso que sondea. Es la primera que observa
  `estado: 'falló'` y, en esa misma invocación, publica el commit de reversión
  y manda los dos correos.
- **Si ella cierra el panel antes de que el deploy falle, el revert igual
  pasa**: la próxima invocación de CUALQUIER acción autenticada
  (`estado`, `historial`, `publicar`) empieza chequeando si la cabeza de `main`
  es un commit del panel cuyo deploy falló, y si lo es, revierte antes de hacer
  lo suyo. *Costo si me equivoco:* si nadie vuelve a abrir el panel nunca, el
  commit malo se queda en `main` — pero el sitio sigue sirviendo el último
  deploy bueno (capa 3 de la compuerta), y a Marcos ya le llegó el correo.

**B2 · «Listo» exige DOS fuentes, y la segunda es la que manda.** La API de
Vercel dice que el deploy TERMINÓ. `version.json` —estático, servido por el
CDN, `Cache-Control: no-store`— dice qué commit se está sirviendo AHORA. El
`estado: 'listo'` necesita las dos: Vercel en `READY` **y** `version.json.sha`
igual al sha publicado. Sin la segunda, el panel dice «listo» mientras el CDN
sigue sirviendo lo viejo, ella abre el sitio, ve el precio viejo, y es
exactamente el pánico que el spec §4.5 nombra.

**B3 · `PANEL_VERCEL_TOKEN` es obligatorio; el correo, no.** Sin el token de
Vercel no hay forma de saber si el deploy terminó ni de revertir solo, así que
`salud` lo reporta como faltante y la fase 6 apaga el botón Publicar (spec
§4.5). El correo es distinto: `RESEND_API_KEY` y `PANEL_REMITENTE` pueden faltar
—verificar el dominio en Resend es un trámite de DNS, no código (spec §4.1)— y
todo lo que depende de ellas **degrada sin romper**: el aviso no se manda, queda
en `console.warn` para Marcos, y la acción que lo iba a mandar sigue su camino.
La única acción que no puede degradar es `enlace` (el enlace mágico), que sin
correo contesta un 503 con frase en español: no hay enlace mágico que mandar.

**B4 · El sha base viaja en el cuerpo de la publicación, y sin él se rechaza.**
Es la herencia n.º 1 del cierre de la Parte A: el panel escribe documentos
ENTEROS, así que si el contenido vivo cambió entre que ella abrió el editor y
apretó publicar, su documento pisa el cambio de Marcos con un fast-forward
limpio, sin conflicto y sin log. El cuerpo de `publicar` pasa a llevar
`base: '<sha del commit que ella leyó>'`; el router compara ese sha contra la
cabeza de `main` y, si no coinciden, mira si lo que cambió en el medio toca
alguno de los documentos del lote. Si toca: 409 con «Marcos cambió algo del
sitio mientras editabas». Si no toca (Marcos cambió código, no contenido):
sigue. **Un `publicar` sin `base` se rechaza con 400**, nunca se acepta «por
compatibilidad»: aceptar la publicación ciega es exactamente el bug.

**B5 · El borrador vive en `refs/panel/borrador`, fuera de `refs/heads/`, y ESE
ref sí se mueve con `force: true`.** Es la única excepción a la regla de
`force: false`, y es correcta: el borrador no tiene historia que preservar —es
«lo último que ella escribió»— y Vercel no mira refs fuera de `refs/heads/`, así
que no dispara deploys ni ensucia la lista de ramas (spec §4.3). La lista
blanca de escritura de `main` NO aplica a este ref: tiene la suya, de una sola
ruta (`panel/borrador.json`), en la misma constante que la otra para que se lean
juntas.

**B6 · La revocación de sesión son tres candados, no uno.** La Parte A ya releía
`PANEL_CORREOS` en cada publicación, que revoca a una PERSONA. Falta revocar una
SESIÓN: el celular perdido de alguien que sigue teniendo acceso. Se agregan dos
variables y un campo:
- `Sesion` gana `emitida: number` (cuándo se firmó).
- `PANEL_SESIONES_DESDE` (un ISO 8601): toda sesión emitida antes de esa fecha
  deja de valer. Es el «cerrar sesión en todos lados» — sin rotar
  `PANEL_SECRETO`, que además invalidaría los enlaces mágicos en vuelo.
- `PANEL_DISPOSITIVOS_REVOCADOS` (lista separada por comas de ids de
  dispositivo): la revocación quirúrgica de un solo aparato.

**B7 · El enlace mágico lleva el propósito ADENTRO del HMAC.** `'entrar'` para
el enlace, `'sesion'` para la cookie (spec §4.1). Sin eso, una cookie de sesión
robada sirve como enlace y viceversa. Y se consume con **POST, nunca con GET**:
Gmail, Outlook y los antivirus abren los enlaces para escanearlos, y un GET
gastaría el enlace en el datacenter de Google antes de que ella lo toque. La
página `/panel/entrar` es HTML estático con un botón que hace el POST, hace
`history.replaceState` para sacar el token de la barra, y vive detrás de
`Referrer-Policy: no-referrer` + `X-Robots-Tag: noindex` puestos en
`vercel.json`.

**B8 · El deshacer de 30 minutos solo deshace la CABEZA.** Si el commit que ella
quiere deshacer ya no es la cabeza de `main`, `deshacer` contesta que no se
puede y la manda al historial. Es una restricción deliberada: deshacer un commit
del medio significa resolver un merge de contenido, y el spec (§4.6) es
explícito en que este botón es el camino del arrepentimiento INMEDIATO —«un
`1300` en vez de `130`, se ve a los veinte segundos»—, no el del historial.
*Costo si me equivoco:* en el caso raro de dos publicaciones seguidas en menos
de 30 minutos, la primera solo se puede volver atrás desde el historial, que es
lo que el historial existe para hacer.

**B9 · La forma de la API de Vercel se MIDE antes de escribir el módulo.** Es la
misma regla que resolvió el riesgo de tracing en la Parte A: el primer paso de
la Tarea 5 es un `curl` real con el token de Marcos, y el módulo se escribe
contra lo que ESA respuesta trae, no contra lo que este plan supone. El plan
escribe la forma documentada (`GET /v6/deployments`, `state` en
`READY|ERROR|BUILDING|QUEUED|INITIALIZING|CANCELED`) y nombra el lugar exacto
donde corregirla si la medición dice otra cosa. **Un estado desconocido se lee
como `'enCurso'`**, nunca como `'listo'` ni como `'falló'`: equivocarse hacia
«seguí esperando» es barato; equivocarse hacia «listo» le miente, y hacia
«falló» dispara una reversión que nadie pidió.

**B10 · Lo que la clienta ve del deploy son TRES palabras, y ninguna es
técnica.** `'enCurso'` → «Estamos subiendo tu cambio»; `'listo'` → «Tu cambio ya
está en el sitio»; `'falló'` → «No salió; lo dejé como estaba y ya le avisé a
Marcos». Los nombres internos del código son esos tres; la prosa vive en una
sola constante por estado, y un test exige que ninguna de las tres frases
contenga «Vercel», «deploy», «commit», «build» ni «GitHub».

---

## Mapa de archivos

### Se crean

| Archivo | Responsabilidad |
|---|---|
| `src/servidor/vercel.ts` | Cliente de la API de Vercel: «¿en qué estado está el deploy de este sha?». Puro e inyectable (`fetch`, token y proyecto por parámetro). Traduce el estado crudo a `'enCurso' \| 'listo' \| 'falló'` y nunca tira por un estado que no conoce. |
| `src/servidor/correo.ts` | Cliente de Resend: `manda({ a, asunto, texto })`. Puro e inyectable. Si falta la clave o el remitente, devuelve `{ ok: false, motivo: 'sin-configurar' }` — no tira. |
| `src/servidor/estado.ts` | La lógica de «¿ya está en el sitio?»: cruza el estado de Vercel con `version.json`, decide el `reintentarEn` y devuelve la frase para la clienta. Sin red propia: recibe las dos respuestas ya leídas. |
| `src/servidor/revertir.ts` | Arma y publica el commit de reversión de un sha: lee los archivos de contenido que ese commit tocó, los vuelve a su versión anterior, revalida y publica. Lo usan el revert automático y `deshacer`. |
| `src/servidor/historial.ts` | Lee los últimos commits del panel de `main` y los traduce a la lista que ve la clienta (qué cambió, cuándo, quién). |
| `src/servidor/borrador.ts` | Leer y escribir `panel/borrador.json` en `refs/panel/borrador`, con `dispositivo` y `hora` para el conflicto de borrador. |
| `src/servidor/enlace.ts` | El token del enlace mágico: firmarlo con propósito `'entrar'` y verificarlo. Mismo HMAC que la sesión, distinto propósito. |
| `src/pages/version.json.ts` | Endpoint estático que emite `{ sha, construido }` con el sha del commit que construyó ESTE deploy. |
| `src/pages/panel/entrar.astro` | La página del enlace mágico: un botón que hace POST del token. Sin React, sin isla, sin el `candado` de Base.astro. |
| `test/vercel-servidor.test.ts` | El cliente de Vercel, con `fetchFalso`. |
| `test/correo.test.ts` | El cliente de Resend, con `fetchFalso`. |
| `test/estado.test.ts` | El cruce de las dos fuentes y la cadencia del sondeo. |
| `test/revertir.test.ts` | La reversión: qué commit arma, qué valida, cuándo se niega. |
| `test/historial.test.ts` | La traducción de commits a lista para la clienta. |
| `test/borrador.test.ts` | El ref de borrador y el conflicto entre dispositivos. |
| `test/enlace.test.ts` | El token del enlace mágico y la separación de propósitos. |
| `test/version-json.test.ts` | Que el endpoint emita el sha y que `vercel.json` le ponga `no-store`. |

### Se modifican

| Archivo | Qué cambia |
|---|---|
| `src/servidor/github.ts` | `archivoEnRef` deja de romperse con archivos de más de 1 MB; se suma `creaRef`, `comparaRefs` y `listaCommits`. |
| `src/servidor/sesion.ts` | `Sesion` gana `emitida`; el propósito entra al cuerpo firmado. |
| `src/servidor/rutas-permitidas.ts` | La lista blanca del ref de borrador, al lado de la de `main`. |
| `src/servidor/publicar.ts` | `Publicacion` gana `ref` (default `heads/main`) y `forzar` (default `false`); los trailers del commit se vuelven una lista extensible (`Panel-Revierte:`). |
| `src/servidor/acciones.ts` | `sesionVigente()`, el chequeo de `base`, los avisos de conteo, y las cinco acciones nuevas en el router. |
| `src/servidor/entradas/panel.ts` | Las variables nuevas, y el tamaño real del cuerpo del pedido. |
| `vercel.json` | Cabeceras de `/version.json` y de `/panel/:camino*`. |
| `api/panel.js` | Reempaquetado en cada tarea que toque `src/servidor/**`. |
| `docs/panel-operacion.md` | Las variables nuevas, cómo revocar una sesión, cómo renovar el PAT, qué hacer si el revert automático falla. |
| `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` | Las dos correcciones de §4.2 y §4.4 (Tarea 15). |

---

### Task 1: los dos límites que la Parte A dejó mal medidos

Herencia n.º 4 del cierre de la Parte A. Son dos cosas chicas y sin relación
entre sí salvo que las dos son mediciones equivocadas, las dos viven en el
camino de escritura, y las dos se vuelven un bug de verdad recién cuando
lleguen las imágenes (fase 7) — que es justo cuando nadie va a estar mirando
acá. Van juntas en una tarea porque cada una es un test y cinco líneas.

**(a) `archivoEnRef` no sirve para archivos de más de 1 MB.** La API de
Contents de GitHub, para un archivo de entre 1 MB y 100 MB, contesta
`{ "content": "", "encoding": "none", "sha": "…" }` — o sea, contesta 200 con
el contenido VACÍO. Hoy `archivoEnRef` hace `Buffer.from(content, 'base64')`
sobre esa cadena vacía y devuelve `''` sin quejarse. El router compara ese
`''` contra los bytes nuevos, ve que son distintos, y publica. Con los JSON de
hoy (el más grande, `sitio.json`, pesa 24 KB) no pasa nunca; con una foto de
producto, pasa siempre. La salida documentada es pedir el blob por su sha,
que sí viene en base64 hasta 100 MB.

**(b) `TOPE_CUERPO` se mide contra los archivos, no contra el cuerpo del
pedido.** La constante existe para no pasarse del tope de 4.5 MB de cuerpo de
request que impone Vercel — o sea, es un límite sobre lo que ENTRA a la
función, no sobre lo que sale hacia GitHub. Hoy se mide sumando los archivos ya
serializados, que es otra cantidad. El borde es el único que sabe cuánto pesó
el pedido de verdad, así que lo mide él y lo pasa por `Contexto`.

**Files:**
- Modify: `src/servidor/github.ts` (`archivoEnRef`)
- Modify: `src/servidor/publicar.ts` (`Publicacion`, `publica`)
- Modify: `src/servidor/acciones.ts` (`Contexto`, `publicarAccion`)
- Modify: `src/servidor/entradas/panel.ts` (medir el cuerpo)
- Test: `test/github.test.ts`, `test/publicar.test.ts`, `test/panel-entrada.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `fetchFalso` de `test/lib/github-falso.ts`.
- Produces:
  - `Contexto` gana `bytesDelCuerpo?: number` — cuántos bytes pesó el cuerpo
    del pedido HTTP, o `undefined` cuando el borde no lo pudo medir. **Nunca un
    `0` centinela** (ruling T1-1).
  - `Publicacion` gana `bytesDelCuerpo?: number` — si viene, es lo que se
    compara contra `TOPE_CUERPO`; si no viene, se cae a la suma de los archivos
    en base64, que es lo que hacía antes.

- [ ] **Step 1: Escribí el test que falla — `archivoEnRef` con `encoding: 'none'`**

En `test/github.test.ts`, adentro del describe que ya cubre el cliente:

```ts
it('M-8: un archivo grande viene con encoding "none" y se resuelve pidiendo el blob', async () => {
  // La API de Contents, para un archivo de entre 1 MB y 100 MB, contesta 200
  // con el contenido VACÍO y `encoding: "none"`. Sin este camino, el llamador
  // recibe '' —no un error— y cree que el archivo está vacío.
  const { f, pedidos } = fetchFalso([
    { cuerpo: { content: '', encoding: 'none', sha: 'blob123' } },
    { cuerpo: { content: Buffer.from('contenido grande').toString('base64'), encoding: 'base64' } },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

  expect(await gh.archivoEnRef('public/sitio/marca/barra-canela.webp', 'abc')).toBe('contenido grande')
  expect(pedidos[1].url).toContain('/git/blobs/blob123')
})

it('M-8: un archivo chico sigue resolviéndose con UN solo pedido', async () => {
  const { f, pedidos } = fetchFalso([
    { cuerpo: { content: Buffer.from('{"a":1}').toString('base64'), encoding: 'base64', sha: 'blobchico' } },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

  expect(await gh.archivoEnRef('src/contenido/datos/sitio.json', 'abc')).toBe('{"a":1}')
  expect(pedidos).toHaveLength(1)
})
```

- [ ] **Step 2: Corré los dos y verificá que el primero falla**

Run: `pnpm vitest run test/github.test.ts`
Expected: FAIL en el primero — `expected '' to be 'contenido grande'`. El
segundo pasa desde ya (es el candado de que el arreglo no agrega un pedido de
más al caso normal).

- [ ] **Step 3: Arreglá `archivoEnRef`**

En `src/servidor/github.ts`, reemplazá el cuerpo de `archivoEnRef`:

```ts
    /**
     * El contenido de un ARCHIVO por su ruta, en un ref dado (rama, tag o
     * sha) — la API de Contents, no la de blobs: esta resuelve ruta+ref
     * directo, sin que quien llama tenga que ir a buscar el sha del blob
     * primero. La usa el router (`acciones.ts`) para leer el contenido VIVO
     * de un documento antes de compararlo contra lo que la clienta mandó.
     *
     * [M-8] Arriba de 1 MB, la API de Contents contesta 200 con
     * `content: ""` y `encoding: "none"` — o sea, te miente por omisión: no
     * es un error, es un cuerpo vacío que parece un archivo vacío. Ahí se
     * pide el blob por el sha que la MISMA respuesta trae, que sí viene en
     * base64 hasta 100 MB. Con los JSON de hoy (el más grande son 24 KB)
     * esta rama no corre nunca; con las fotos de producto de la fase 7 corre
     * siempre, y el modo de falla sin esto es publicar creyendo que el
     * archivo vivo estaba vacío.
     */
    async archivoEnRef(ruta: string, ref: string): Promise<string> {
      const cuerpo = await pedir(`/contents/${codificaRuta(ruta)}?ref=${encodeURIComponent(ref)}`) as {
        content: string
        encoding: string
        sha: string
      }
      if (cuerpo.encoding !== 'base64') {
        const blob = await pedir(`/git/blobs/${cuerpo.sha}`) as { content: string; encoding: string }
        return Buffer.from(blob.content, 'base64').toString('utf8')
      }
      return Buffer.from(cuerpo.content, 'base64').toString('utf8')
    },
```

- [ ] **Step 4: Corré los tests y verificá que pasan**

Run: `pnpm vitest run test/github.test.ts`
Expected: PASS los dos.

- [ ] **Step 5: Escribí el test que falla — el tope se mide contra el cuerpo del pedido**

En `test/publicar.test.ts`:

```ts
it('M-9: el tope de cuerpo se mide contra el PEDIDO, no contra los archivos', async () => {
  // El tope existe para no pasarse del límite de cuerpo de request que
  // impone la plataforma: es un límite sobre lo que ENTRA a la función. Un
  // documento chico que llegó adentro de un pedido enorme (varias fotos en
  // el mismo lote) tiene que rebotar, aunque el archivo pese nada.
  const { f } = fetchFalso([])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

  const r = await publica(gh, {
    archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
    autor: 'quien@ejemplo.mx',
    bytesDelCuerpo: TOPE_CUERPO + 1,
  })

  expect(r).toEqual({
    ok: false,
    codigo: 422,
    problema: 'Es demasiado contenido para una sola publicación: manda menos fotos, o de menor tamaño.',
  })
})

it('M-9: sin la medida del pedido se cae a la suma de los archivos, como antes', async () => {
  // El borde puede no tener cómo medir el cuerpo (sin Content-Length). Ahí
  // la cuenta vieja es mejor que ninguna: es una cota inferior de lo que
  // pesó el pedido, así que sigue frenando el lote descomunal.
  const { f } = fetchFalso([])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

  const enorme = 'x'.repeat(TOPE_CUERPO)
  const r = await publica(gh, {
    archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: enorme }],
    autor: 'quien@ejemplo.mx',
  })

  expect(r.ok).toBe(false)
})
```

Acordate de sumar `TOPE_CUERPO` al import de `../src/servidor/rutas-permitidas`
que ya existe en ese archivo (o crearlo si no está).

- [ ] **Step 6: Corré el test y verificá que el primero falla**

Run: `pnpm vitest run test/publicar.test.ts`
Expected: FAIL — `bytesDelCuerpo` no existe en `Publicacion`, así que TypeScript
se queja y, aun ignorándolo, el lote pasa el chequeo y `fetchFalso` tira por un
pedido que nadie programó.

- [ ] **Step 7: Sumá `bytesDelCuerpo` a `Publicacion` y usalo en `publica`**

En `src/servidor/publicar.ts`, dentro de `export interface Publicacion`, después
de `cambios?: Cambio[]`:

```ts
  /**
   * Cuánto pesó el CUERPO del pedido HTTP que trajo esta publicación. Es lo
   * que `TOPE_CUERPO` quiere limitar de verdad —el tope de 4.5 MB de cuerpo
   * de request que impone la plataforma—, y solo el borde lo sabe. Cuando no
   * viene (el borde no pudo medirlo), se cae a la suma de los archivos en
   * base64: es una cota INFERIOR del cuerpo real, así que sigue sirviendo
   * para frenar un lote descomunal, nomás que con menos margen.
   */
  bytesDelCuerpo?: number
```

Y en `publica()`, la primera línea del chequeo:

```ts
  const chequeo = revisaLote(rutas, p.bytesDelCuerpo ?? bytesDelCuerpo(p.archivos))
```

- [ ] **Step 8: Corré los tests y verificá que pasan**

Run: `pnpm vitest run test/publicar.test.ts`
Expected: PASS.

- [ ] **Step 9: Pasá la medida desde el borde**

En `src/servidor/acciones.ts`, dentro de `export interface Contexto`, después de `ip`:

```ts
  /**
   * Cuántos bytes pesó el CUERPO del pedido HTTP, o `undefined` cuando el
   * borde no lo pudo medir (sin `Content-Length` legible). Vive en el
   * contexto y no en el `Pedido` porque no es un dato del pedido de la
   * clienta —ella no lo manda—: es una medición del transporte, del mismo
   * tipo que la IP.
   *
   * [RULING T1-1] `undefined` y NO un `0` centinela. Con `0`, «no lo sé» y
   * «midió cero» son el mismo valor, y `p.bytesDelCuerpo ?? suma(...)` en
   * `publica()` se queda con el `0` —`??` solo cae ante `null`/`undefined`—,
   * así que el tope de cuerpo queda desactivado justo en el caso que el
   * fallback existía para cubrir. Que el tipo diga la verdad mata la clase
   * entera de bug; un `||` o un spread condicional solo la tapan en este
   * llamador y dejan la trampa armada para el siguiente.
   */
  bytesDelCuerpo?: number
```

En `publicarAccion`, la llamada a `publica()` suma el campo:

```ts
  const resultado = await publica(gh, {
    archivos,
    autor: sesion.correo,
    bytesDelCuerpo: contexto.bytesDelCuerpo,
    ...(cambios.length > 0 ? { cambios } : {}),
  })
```

En `src/servidor/entradas/panel.ts`, al armar el contexto:

```ts
  const contexto: Contexto = {
    env: entorno(),
    fetch: globalThis.fetch,
    ahora: () => Date.now(),
    ip: ipDelPedido(req.headers),
    bytesDelCuerpo: bytesDeCuerpo(req.headers),
  }
```

y arriba, al lado de `cookieDePanel`:

```ts
/**
 * Cuánto pesó el cuerpo del pedido, según `Content-Length`. Devuelve
 * `undefined` cuando la cabecera no vino o no es un número — «no lo sé», que
 * es distinto de «midió cero»— y con eso `publica()` se cae a la suma de los
 * archivos. No se mide serializando `req.body` de nuevo —eso sería medir la
 * reconstrucción, no el pedido— ni se confía en que el número sea honesto: es
 * un tope de comodidad contra el límite de la plataforma, no un control de
 * seguridad.
 */
function bytesDeCuerpo(headers: Record<string, string | string[] | undefined>): number | undefined {
  const crudo = valorUnico(headers['content-length'])
  const n = Number.parseInt(crudo, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
```

- [ ] **Step 10: Sumá el test del borde**

En `test/panel-entrada.test.ts`:

```ts
it('el borde mide el cuerpo por Content-Length, y 0 cuando no vino', async () => {
  const visto: number[] = []
  // El borde llama a `maneja()`; lo que este test mira es el contexto que le
  // arma, así que alcanza con una acción que no existe (404) para no tener
  // que montar media sesión.
  for (const headers of [{ 'content-length': '4096' }, {}, { 'content-length': 'quién sabe' }]) {
    const res = respuestaFalsa()
    await handler({ method: 'GET', headers, query: { accion: 'no-existe' } } as never, res as never)
    visto.push(res.contexto?.bytesDelCuerpo)
  }
  expect(visto).toEqual([4096, undefined, undefined])
})
```

**Ojo:** `test/panel-entrada.test.ts` ya tiene su forma de espiar el contexto
(mockea `../src/servidor/acciones` con `vi.mock`, que en vitest es por archivo).
Usá la que ya está en ese archivo en vez de inventar `respuestaFalsa`/
`res.contexto`; el assert que importa es el `toEqual([4096, undefined, undefined])`.

- [ ] **Step 10b: El test que prueba que el fallback de verdad se dispara**

Los dos tests del Step 5 prueban el tope con un número explícito y con el campo
ausente, pero ninguno prueba el camino REAL de «no se pudo medir»: el pedido
llega sin `Content-Length`, el borde no mide, y el lote enorme tiene que rebotar
igual. Sin este test, el fallback puede estar roto y los 1005 tests siguen
verdes — que es exactamente lo que pasó la primera vez.

En `test/acciones.test.ts`:

```ts
it('M-9: sin Content-Length medible, el lote enorme rebota igual — el fallback se dispara', async () => {
  // El camino completo: el borde no pudo medir, así que `Contexto` trae
  // `undefined` (no un 0), `publica()` cae a la suma de los archivos, y el
  // tope sigue frenando. Con un 0 centinela esto pasaba de largo y se iba a
  // la red con un lote de cualquier tamaño.
  const { f, pedidos } = fetchFalso([])
  const r = await maneja(
    'publicar',
    { cuerpo: { documentos: { sabores: saboresEnormes() } }, cookie: cookieValida() },
    contextoDePrueba({ fetch: f, bytesDelCuerpo: undefined }),
  )
  expect(r.status).toBe(422)
  expect((r.cuerpo as { problema: string }).problema).toContain('demasiado contenido')
  expect(pedidos, 'no se gastó un solo pedido: el tope frena antes de la red').toHaveLength(0)
})
```

`saboresEnormes()` es un documento válido cuyo serializado pasa `TOPE_CUERPO`
(por ejemplo, el `sabores.json` real con un campo de texto largo repetido hasta
pasarse). Si armarlo válido cuesta más de lo que vale, usá el documento real con
un `ingredientes` inflado: lo único que importa es que `serializa()` devuelva
más de 3.5 MB.

- [ ] **Step 11: Corré la suite entera**

Run: `pnpm vitest run`
Expected: PASS, 1000 + 5 tests.

- [ ] **Step 12: Reempaquetá y commiteá**

```bash
pnpm bundle:api
git add src/servidor/github.ts src/servidor/publicar.ts src/servidor/acciones.ts src/servidor/entradas/panel.ts api/panel.js test/github.test.ts test/publicar.test.ts test/panel-entrada.test.ts
git commit -m "fix: los dos límites de escritura se miden contra lo que de verdad limitan"
```

---

### Task 2: el sha base — que una edición concurrente no se pierda en silencio

Herencia n.º 1 del cierre de la Parte A, y la más importante de todo este plan.
El panel escribe documentos ENTEROS: si el contenido vivo cambió entre que la
clienta abrió el editor y apretó publicar, su documento pisa el cambio de Marcos
con un fast-forward perfectamente limpio — sin conflicto, sin log, y con el
resumen del commit atribuyéndole a ella lo que escribió él. El spec §4.2 lo
preveía («si falla por no ser fast-forward, se reintenta UNA vez comparando qué
cambió en el medio») y la Parte A lo perdió: hoy el reintento vuelve a armar el
árbol sobre la cabeza nueva sin mirar qué había en el medio, que es exactamente
cómo se pisa un cambio ajeno.

Hoy hay una sola persona con acceso, así que no está pasando. Deja de ser
aceptable el día que entre la segunda — y ese día no va a haber ningún síntoma:
el trabajo de alguien simplemente no va a estar.

La regla, en una línea: **el panel declara contra qué versión del sitio estuvo
editando, y el servidor se niega a publicar a ciegas.**

**Files:**
- Modify: `src/servidor/github.ts` (`comparaRefs`)
- Modify: `src/servidor/acciones.ts` (`publicarAccion`)
- Test: `test/github.test.ts`, `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `gh.ref`, `gh.archivoEnRef` (Tarea 1).
- Produces:
  - `gh.comparaRefs(base: string, cabeza: string): Promise<{ archivos: string[] }>` —
    las rutas que cambiaron entre dos shas. Lista vacía si no cambió nada.
  - El cuerpo de `publicar` pasa a exigir `base: string` (el sha contra el que
    ella editó). Sin él, 400.

- [ ] **Step 1: Escribí el test que falla — `comparaRefs`**

En `test/github.test.ts`:

```ts
it('comparaRefs devuelve las rutas que cambiaron entre dos shas', async () => {
  const { f, pedidos } = fetchFalso([
    {
      cuerpo: {
        files: [
          { filename: 'src/contenido/datos/sitio.json', status: 'modified' },
          { filename: 'src/pages/index.astro', status: 'modified' },
        ],
      },
    },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })

  expect(await gh.comparaRefs('viejo', 'nuevo')).toEqual({
    archivos: ['src/contenido/datos/sitio.json', 'src/pages/index.astro'],
  })
  expect(pedidos[0].url).toContain('/compare/viejo...nuevo')
})

it('comparaRefs no explota si GitHub no manda `files`', async () => {
  // La comparación de dos shas idénticos viene sin la clave.
  const { f } = fetchFalso([{ cuerpo: { status: 'identical' } }])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  expect(await gh.comparaRefs('a', 'a')).toEqual({ archivos: [] })
})
```

- [ ] **Step 2: Corré y verificá que falla**

Run: `pnpm vitest run test/github.test.ts`
Expected: FAIL — `gh.comparaRefs is not a function`.

- [ ] **Step 3: Implementá `comparaRefs`**

En `src/servidor/github.ts`, adentro del objeto que devuelve `cliente()`,
después de `archivoEnRef`:

```ts
    /**
     * Qué RUTAS cambiaron entre dos shas. Es la pregunta que el router
     * necesita para distinguir las dos formas de «alguien publicó mientras
     * ella editaba»: si lo que cambió en el medio son documentos de
     * contenido, la publicación de ella los pisaría y hay que frenarla; si
     * es código del sitio (Marcos arreglando una plantilla), no se tocan y
     * puede seguir.
     *
     * Devuelve solo los nombres, no el diff: el router no tiene nada que
     * hacer con el contenido del cambio ajeno, y traerlo sería traer texto
     * arbitrario a una función que después lo podría loguear.
     *
     * `files` no viene cuando los dos shas son el mismo, así que se lee con
     * un default en vez de asumir que está.
     */
    async comparaRefs(base: string, cabeza: string): Promise<{ archivos: string[] }> {
      const cuerpo = await pedir(
        `/compare/${encodeURIComponent(base)}...${encodeURIComponent(cabeza)}`,
      ) as { files?: Array<{ filename: string }> }
      return { archivos: (cuerpo.files ?? []).map((f) => f.filename) }
    },
```

- [ ] **Step 4: Corré y verificá que pasa**

Run: `pnpm vitest run test/github.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribí los tres tests que fallan, en `test/acciones.test.ts`**

```ts
describe('publicar exige declarar contra qué versión se editó', () => {
  it('sin `base` en el cuerpo, 400 y ni un pedido a GitHub', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja(
      'publicar',
      { cuerpo: { documentos: { sabores: saboresValidos() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
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
      { cuerpo: { base: 'loQueEllaLeyo', documentos: { sabores: saboresValidos() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
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
      contextoDePrueba({ fetch: f }),
    )
    expect(r.status).toBe(200)
  })
})
```

`saboresValidos()`, `cookieValida()`, `contextoDePrueba()` y
`respuestasDeUnaPublicacionCompleta()` son los ayudantes que ese archivo YA
tiene (con los nombres que tengan ahí): no inventes ayudantes nuevos, usá los
que están. Si alguno no existe con ese nombre exacto, adaptá la llamada — lo
que no se adapta son los tres asserts.

- [ ] **Step 6: Corré y verificá que fallan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: FAIL los tres — hoy `base` se ignora, así que el primero publica en
vez de rebotar y los otros dos piden respuestas que nadie programó.

- [ ] **Step 7: Implementá el chequeo en `publicarAccion`**

En `src/servidor/acciones.ts`, arriba con las otras constantes de prosa:

```ts
// Una publicación sin `base` no es un pedido viejo que se pueda atender con
// buena voluntad: es un pedido que no declara contra qué versión del sitio se
// escribió, y atenderlo es justamente cómo se pisa el trabajo de otro sin que
// nadie se entere. A la clienta no se le explica nada de esto —no es su
// problema ni su vocabulario—: se le dice que vuelva a abrir el panel, que es
// lo que de verdad lo arregla (el panel nuevo manda `base`).
const PROBLEMA_SIN_BASE = 'No pudimos publicar: vuelve a abrir el panel y hazlo de nuevo.'

// La MISMA frase que devuelve `publica()` cuando el `PATCH` del ref choca dos
// veces (publicar.ts). Es el mismo hecho contado dos veces —«alguien movió el
// sitio mientras editabas»— y tiene que sonar igual, se detecte antes (acá,
// comparando shas) o después (allá, al chocar el ref).
const PROBLEMA_PISARIA = 'Marcos cambió algo del sitio mientras editabas: vuelve a intentar la publicación.'
```

En `publicarAccion`, justo después de validar la sesión y ANTES de mirar los
documentos (para no gastar validación en un lote que ya está condenado):

```ts
  const cuerpo = (pedido.cuerpo ?? {}) as { documentos?: unknown; base?: unknown }
  if (typeof cuerpo.base !== 'string' || cuerpo.base === '') {
    console.error('publicar: el cuerpo llegó sin `base` — el panel que lo mandó es de antes del sha base.')
    return error(400, PROBLEMA_SIN_BASE)
  }
```

Y en la Fase 2, apenas se resuelve el sha base real, antes del `for` que lee lo
vivo de cada documento:

```ts
    base ??= await gh.ref('heads/main')

    // [B4] El sha contra el que ella editó vs. la cabeza de hoy. Si son el
    // mismo, no hay nada que mirar. Si no, la pregunta no es «¿avanzó main?»
    // —avanza todo el tiempo, Marcos publica código— sino «¿avanzó sobre
    // ALGO QUE ESTE LOTE ESCRIBE?». Solo eso se pisaría.
    if (cuerpo.base !== base.sha) {
      const { archivos: movidos } = await gh.comparaRefs(cuerpo.base, base.sha)
      const delLote = new Set(idsConocidos.map(RUTA_DEL_DOCUMENTO))
      const pisados = movidos.filter((ruta) => delLote.has(ruta))
      if (pisados.length > 0) {
        console.error(
          `publicar: rechazado por pisada (autor: ${sesion.correo}) — editó contra ${cuerpo.base}, ` +
            `la cabeza es ${base.sha}, y en el medio cambiaron: ${pisados.join(', ')}`,
        )
        return error(409, PROBLEMA_PISARIA)
      }
    }
```

**Importante:** la declaración `const cuerpo = …` ya existe más abajo en la
función; movela arriba (donde la pusiste en el chequeo de `base`) en vez de
declararla dos veces, y sacá la línea vieja.

- [ ] **Step 8: Corré y verificá que pasan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: PASS.

- [ ] **Step 8b: El candado de la frase duplicada**

`PROBLEMA_PISARIA` repite letra por letra el 409 que devuelve `publica()` en
`publicar.ts`. **Está duplicada a propósito** —es el MISMO hecho detectado en
dos lugares distintos (acá comparando shas, allá al chocar el ref) y tiene que
sonar igual desde donde la clienta lo lee—, y extraerla a un módulo compartido
acoplaría `publicar.ts` con el router por una cadena de texto. Lo que sí hace
falta es que no se puedan desincronizar:

```ts
it('las dos formas de detectar una pisada le dicen a la clienta exactamente lo mismo', async () => {
  // El router la detecta ANTES (comparando shas) y `publicar.ts` la detecta
  // DESPUÉS (al chocar el ref). Son dos caminos para el mismo hecho, y desde
  // donde ella lo lee tienen que ser una sola frase. Están duplicadas a
  // propósito —compartirlas acoplaría los dos módulos por un string— así que
  // este test es lo que evita que se separen.
  const { f } = fetchFalso([
    { cuerpo: { object: { sha: 'cabezaNueva' } } },
    { cuerpo: { files: [{ filename: 'src/contenido/datos/sabores.json' }] } },
  ])
  const porElRouter = await maneja(
    'publicar',
    { cuerpo: { base: 'viejo', documentos: { sabores: saboresValidos() } }, cookie: cookieValida() },
    contextoDePrueba({ fetch: f }),
  )

  const { f: f2 } = fetchFalso([...respuestasDeDosChoquesDeRef()])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f2 })
  const porElRef = await publica(gh, {
    archivos: [{ ruta: 'src/contenido/datos/sabores.json', contenido: '{}' }],
    autor: 'ella@ejemplo.mx',
  })

  expect((porElRouter.cuerpo as { problema: string }).problema).toBe((porElRef as { problema: string }).problema)
})
```

`respuestasDeDosChoquesDeRef()` scriptea dos intentos completos cuyo `PATCH`
falla con 422 «not a fast forward», que es lo que hace que `publica()` agote su
reintento y devuelva el 409.

- [ ] **Step 9: Actualizá el ensayo de humo**

`scripts/humo-panel.sh` publica sin `base` y a partir de ahora va a recibir un
400. Antes de publicar, el script tiene que leer la cabeza de `main` y mandarla:

```bash
# El sha contra el que se "editó": para el ensayo es, sencillamente, la cabeza
# de main en este momento. El panel de la fase 6 va a mandar el sha que leyó al
# abrir el editor, que es la misma idea con más tiempo en el medio.
BASE=$(curl -fsS "https://api.github.com/repos/$DUENIO/$REPO/git/ref/heads/main" | python3 -c 'import json,sys;print(json.load(sys.stdin)["object"]["sha"])')
```

y el JSON del `publicar` pasa a llevar `"base": "'"$BASE"'"` junto a
`"documentos"`. Sumá además un paso nuevo al ensayo, después del que publica:

```
=== 4c) Publicar con una base vieja tiene que rebotar con 409 ===
```

**[CORREGIDO 2026-09-17, ruling T2-1]** La primera versión de este paso usaba un
sha inventado (`000…0`) esperando un 409, y eso **no puede funcionar**: ese
objeto no existe en el repo, así que la comparación de GitHub devuelve 404, el
`catch` de la Fase 2 lo convierte en 502 «no pudimos revisar el contenido
actual», y el paso afirmaría un resultado que el código no produce. Un ensayo
que afirma lo imposible es peor que no tenerlo: el día que falle de verdad,
nadie le va a creer.

El paso correcto usa un sha que SÍ existe y contra el que SÍ hubo un cambio de
contenido en el medio — que es exactamente la situación que el 409 describe.
Aprovecha que el paso anterior acaba de publicar:

```bash
# ANTES de publicar el cambio de prueba, guardá la cabeza:
ANTES=$(curl -fsS "https://api.github.com/repos/$DUENIO/$REPO/git/ref/heads/main"   | python3 -c 'import json,sys;print(json.load(sys.stdin)["object"]["sha"])')

# …se publica el cambio de prueba (paso anterior), que mueve la cabeza…

# Y ahora se publica OTRA VEZ declarando la base vieja: en el medio cambió
# `sitio.json`, que es justo el documento del lote, así que tiene que rebotar.
# Es la pisada de verdad, no una simulada.
```

y exige **409** con la frase «Marcos cambió algo del sitio mientras editabas».
Es el freno de mano de esta tarea, probado contra producción: si algún día
alguien lo saca, el ensayo lo encuentra.

Sumá además un paso hermano que prueba el otro lado de la regla —que un cambio
ajeno que NO toca el lote **no** frena—: no se puede armar con un `curl` sin
tocar el repo, así que va como comentario en el script explicando por qué ese
caso lo cubren los tests y no el ensayo.

- [ ] **Step 10: Corré la suite entera**

Run: `pnpm vitest run`
Expected: PASS.

- [ ] **Step 11: Reempaquetá y commiteá**

```bash
pnpm bundle:api
git add src/servidor/github.ts src/servidor/acciones.ts api/panel.js test/github.test.ts test/acciones.test.ts scripts/humo-panel.sh
git commit -m "fix: publicar declara contra qué versión se editó, y el servidor se niega a publicar a ciegas"
```

---

### Task 3: revocar una sesión sin rotar la llave, y separar los propósitos del HMAC

Herencia n.º 2 del cierre de la Parte A. La Parte A ya relee `PANEL_CORREOS` en
cada publicación, así que sacar a una PERSONA de la lista la corta enseguida.
Lo que falta es cortar una SESIÓN: el celular perdido de alguien que sigue
teniendo acceso. Hoy la única forma es rotar `PANEL_SECRETO`, que además
desloguea a todo el mundo y —a partir de la Tarea 12— invalida los enlaces
mágicos que estén en vuelo.

Esta tarea toca el cuerpo firmado de la cookie, así que **invalida las sesiones
que existan hoy**: quien esté adentro vuelve a entrar con su contraseña, una vez.
Es barato y pasa una sola vez; agrupar acá los DOS cambios que tocan ese cuerpo
—el campo nuevo y la separación de propósitos que necesita la Tarea 12— es
justamente para que pase una sola vez y no dos.

**Files:**
- Modify: `src/servidor/sesion.ts` (`Sesion`, `firmaSesion`, `verificaSesion`)
- Modify: `src/servidor/acciones.ts` (`Entorno`, `sesionVigente`, `entrar`, `publicarAccion`)
- Test: `test/sesion.test.ts`, `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado), `docs/panel-operacion.md`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `Sesion` gana `emitida: number` (epoch ms de cuándo se firmó).
  - `firmaSesion(sesion, secreto)` / `verificaSesion(cookie, secreto, ahora)` —
    misma firma, pero el HMAC ahora se calcula sobre `sesion|<cuerpo>`.
  - `DOMINIO_SESION = 'sesion'` exportado de `sesion.ts`, para que `enlace.ts`
    (Tarea 12) sepa contra qué NO tiene que colisionar.
  - `sesionVigente(cookie: string, env: Entorno, ahora: number): Sesion | null`
    en `acciones.ts` — la única puerta que usan TODAS las acciones
    autenticadas de acá en adelante.
  - `Entorno` gana `PANEL_SESIONES_DESDE?: string` y
    `PANEL_DISPOSITIVOS_REVOCADOS?: string`.

- [ ] **Step 1: Escribí los tests que fallan en `test/sesion.test.ts`**

```ts
it('la sesión firmada dice cuándo se emitió', () => {
  const secreto = 'x'.repeat(40)
  const cookie = firmaSesion(
    { correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu', emitida: 1_000_000 },
    secreto,
  )
  expect(verificaSesion(cookie, secreto, 1_500_000)?.emitida).toBe(1_000_000)
})

it('una cookie sin `emitida` no vale, aunque la firma sea buena', () => {
  // No es paranoia: es lo que hace que el candado de `PANEL_SESIONES_DESDE`
  // no se pueda saltear mandando una cookie vieja a la que le falta el campo.
  const secreto = 'x'.repeat(40)
  const cuerpo = Buffer.from(JSON.stringify({ correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu' })).toString('base64url')
  const firma = createHmac('sha256', secreto).update(`sesion|${cuerpo}`).digest('base64url')
  expect(verificaSesion(`${cuerpo}.${firma}`, secreto, 1_500_000)).toBeNull()
})

it('C-2: la firma lleva el propósito adentro, así que un token de otro propósito no sirve de cookie', () => {
  // Sin esto, cualquier cosa que este mismo secreto firme —el enlace mágico
  // de la Tarea 12— serviría como cookie de sesión y al revés. El propósito
  // va ADENTRO de lo que se firma (spec §4.1), no al lado.
  const secreto = 'x'.repeat(40)
  const cuerpo = Buffer.from(JSON.stringify({ correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu', emitida: 1 })).toString('base64url')
  const firmaDeOtroProposito = createHmac('sha256', secreto).update(`entrar|${cuerpo}`).digest('base64url')
  expect(verificaSesion(`${cuerpo}.${firmaDeOtroProposito}`, secreto, 1_500_000)).toBeNull()
})
```

Sumá `import { createHmac } from 'node:crypto'` al archivo si no está.

- [ ] **Step 2: Corré y verificá que fallan**

Run: `pnpm vitest run test/sesion.test.ts`
Expected: FAIL los tres.

- [ ] **Step 3: Implementá en `src/servidor/sesion.ts`**

En la interfaz:

```ts
/** El cuerpo de la cookie: quién es, hasta cuándo vale, desde qué aparato, desde cuándo. */
export interface Sesion {
  correo: string
  vence: number
  dispositivo: string
  /**
   * Cuándo se firmó, en epoch ms. No es lo mismo que `vence` y no se puede
   * derivar de él: `vence` depende de si el aparato se marcó como propio (un
   * año) o no (treinta días), así que dos sesiones que vencen el mismo día
   * pueden haberse emitido con once meses de diferencia. Esto es lo que hace
   * posible «cerrar sesión en todos lados» sin rotar el secreto: se corre una
   * fecha (`PANEL_SESIONES_DESDE`) y todo lo firmado antes deja de valer.
   */
  emitida: number
}
```

Arriba de `firmaSesion`:

```ts
/**
 * El propósito de un token firmado con `PANEL_SECRETO`, metido ADENTRO de lo
 * que se firma. El mismo secreto va a firmar dos cosas distintas —la cookie
 * de sesión y el enlace mágico de recuperación (spec §4.1)— y sin esto, un
 * token de uno sirve de token del otro: quien tenga un enlace mágico
 * interceptado en su bandeja de entrada lo pega como cookie y ya está
 * adentro, sin que el enlace se «consuma» nunca.
 *
 * Va como prefijo del mensaje y no como campo del JSON a propósito: un campo
 * del JSON también funcionaría, pero solo si TODOS los verificadores se
 * acuerdan de mirarlo. Como prefijo, olvidarse no es una opción — la firma
 * directamente no da.
 */
export const DOMINIO_SESION = 'sesion'

/** Lo que se le pasa al HMAC: el propósito, una barra, y el cuerpo. */
export const mensajeFirmado = (dominio: string, cuerpo: string): string => `${dominio}|${cuerpo}`
```

En `firmaSesion`, la línea del HMAC:

```ts
  const firma = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_SESION, cuerpo)).digest('base64url')
```

En `verificaSesion`, la línea de la firma esperada y el chequeo de forma:

```ts
    const firmaEsperada = createHmac('sha256', secreto).update(mensajeFirmado(DOMINIO_SESION, cuerpo)).digest()
```

```ts
    if (
      typeof sesion.correo !== 'string' ||
      typeof sesion.vence !== 'number' ||
      typeof sesion.dispositivo !== 'string' ||
      typeof sesion.emitida !== 'number'
    ) {
      return null
    }
```

- [ ] **Step 4: Corré y verificá que pasan**

Run: `pnpm vitest run test/sesion.test.ts`
Expected: PASS los tres. Los tests viejos de ese archivo que arman una `Sesion`
a mano ahora necesitan `emitida`: agregáselo, no lo hagas opcional.

- [ ] **Step 5: Escribí los tests que fallan en `test/acciones.test.ts`**

```ts
describe('revocar una sesión sin rotar la llave', () => {
  it('una sesión emitida antes de PANEL_SESIONES_DESDE deja de valer', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-01T00:00:00Z') },
      contextoDePrueba({ env: { PANEL_SESIONES_DESDE: '2026-09-10T00:00:00Z' } }),
    )
    expect(r.status).toBe(401)
    expect((r.cuerpo as { problema: string }).problema).toBe('Tu sesión no es válida: vuelve a entrar.')
  })

  it('una sesión emitida DESPUÉS de esa fecha sigue valiendo', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
      contextoDePrueba({ env: { PANEL_SESIONES_DESDE: '2026-09-10T00:00:00Z' } }),
    )
    // 400 (sin documentos), no 401: la sesión pasó.
    expect(r.status).toBe(400)
  })

  it('un dispositivo revocado no publica, aunque su correo siga en la lista', async () => {
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieDeDispositivo('celu-perdido') },
      contextoDePrueba({ env: { PANEL_DISPOSITIVOS_REVOCADOS: 'otro, celu-perdido ,tercero' } }),
    )
    expect(r.status).toBe(401)
  })

  it('una fecha ilegible en PANEL_SESIONES_DESDE no abre la puerta: la cierra', async () => {
    // Si el candado no se puede leer, la única respuesta segura es no dejar
    // pasar. Un typo en una variable de entorno no puede ser la forma de
    // desactivar una revocación.
    const r = await maneja(
      'publicar',
      { cuerpo: { base: 'x', documentos: {} }, cookie: cookieEmitidaEn('2026-09-11T00:00:00Z') },
      contextoDePrueba({ env: { PANEL_SESIONES_DESDE: 'el martes' } }),
    )
    expect(r.status).toBe(401)
  })
})
```

`cookieEmitidaEn()` y `cookieDeDispositivo()` son ayudantes nuevos de ese
archivo: los dos firman una sesión con el secreto de prueba que el archivo ya
usa, cambiando solo `emitida` o `dispositivo`.

- [ ] **Step 6: Corré y verificá que fallan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: FAIL — hoy nada mira `emitida` ni el dispositivo.

- [ ] **Step 7: Implementá `sesionVigente` en `src/servidor/acciones.ts`**

Sumá las dos variables a `Entorno`:

```ts
  /**
   * ISO 8601. Toda sesión emitida ANTES de esta fecha deja de valer: es el
   * «cerrar sesión en todos lados» sin rotar `PANEL_SECRETO` —que además de
   * desloguear a todo el mundo invalidaría los enlaces mágicos en vuelo—.
   * Ausente = no hay revocación por fecha.
   */
  PANEL_SESIONES_DESDE?: string
  /**
   * Ids de dispositivo separados por comas. La revocación quirúrgica: el
   * celular perdido de alguien que sigue teniendo acceso.
   */
  PANEL_DISPOSITIVOS_REVOCADOS?: string
```

Y la función, arriba de `publicarAccion` (la van a usar todas las acciones
autenticadas de este plan):

```ts
/**
 * La única puerta de las acciones autenticadas. Cuatro candados, en este
 * orden y por esta razón:
 *
 *   1. La FIRMA y el vencimiento (`verificaSesion`): sin eso, todo lo demás
 *      estaría decidiendo sobre datos que escribió quien sea.
 *   2. `PANEL_CORREOS` de HOY: revoca a una PERSONA. Ya estaba en la Parte A
 *      —una cookie firmada hace un año no puede seguir publicando solo
 *      porque la firma es válida—; acá se centraliza para que no haya que
 *      acordarse de copiarlo en cada acción nueva.
 *   3. `PANEL_SESIONES_DESDE`: revoca TODAS las sesiones anteriores a una
 *      fecha. Es el botón de pánico.
 *   4. `PANEL_DISPOSITIVOS_REVOCADOS`: revoca UN aparato.
 *
 * Una fecha que no parsea se trata como «revocá todo», no como «no hay
 * revocación»: un typo en una variable de entorno no puede ser la forma
 * accidental de desactivar el botón de pánico. Marcos lo ve enseguida
 * —nadie puede entrar— y lo arregla; al revés no lo vería nunca.
 */
function sesionVigente(cookie: string, env: Entorno & { PANEL_SECRETO: string }, ahora: number): Sesion | null {
  const sesion = verificaSesion(cookie, env.PANEL_SECRETO, ahora)
  if (!sesion) return null
  if (!correoEnLista(sesion.correo, env.PANEL_CORREOS)) return null

  if (env.PANEL_SESIONES_DESDE) {
    const desde = Date.parse(env.PANEL_SESIONES_DESDE)
    if (!Number.isFinite(desde)) {
      console.error(
        `sesión: PANEL_SESIONES_DESDE no es una fecha que se pueda leer («${env.PANEL_SESIONES_DESDE}») — ` +
          'se rechaza toda sesión hasta que se corrija.',
      )
      return null
    }
    if (sesion.emitida < desde) return null
  }

  if (listaTiene(env.PANEL_DISPOSITIVOS_REVOCADOS, sesion.dispositivo)) return null

  return sesion
}

/** ¿Está `valor` en una lista separada por comas, ignorando espacios alrededor? */
function listaTiene(lista: string | undefined, valor: string): boolean {
  if (!lista) return false
  return lista.split(',').some((x) => x.trim() === valor)
}
```

Sumá `Sesion` al import de `./sesion`.

En `publicarAccion`, reemplazá las dos líneas de sesión por una:

```ts
  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)
```

Y en `entrar`, al armar la sesión, sumá `emitida: contexto.ahora()` **y
normalizá el id de dispositivo**:

```ts
/**
 * [RULING T3-1] El id de dispositivo llega del navegador y hoy es texto
 * libre: el panel manda lo que quiera. Eso choca de frente con
 * `PANEL_DISPOSITIVOS_REVOCADOS`, que es una lista separada por comas — un
 * id con una coma adentro («iPhone 15, de Marcos») se parte al leer la
 * lista, ninguno de los dos pedazos coincide con el id entero que viaja en
 * la cookie, y **la revocación falla en silencio justo cuando Marcos cree
 * haberla hecho bien**. Está medido: con ese id, `publicar` sigue pasando.
 *
 * Se arregla en el ORIGEN y no en el lector: acá, donde el id entra al
 * sistema por primera vez, se lo normaliza a un alfabeto que no puede
 * romper ninguna lista. Arreglarlo del lado de `listaTiene` —escapando, o
 * cambiando el separador— dejaría el id crudo dando vueltas por el resto
 * del sistema para que el próximo lugar que lo use se vuelva a tropezar.
 *
 * Que dos aparatos con nombres parecidos colapsen al mismo id es un costo
 * aceptable hoy: el id de hoy lo elige el navegador y no identifica nada
 * por sí solo. La fase 6, cuando dibuje la pantalla de «¿desde qué aparato
 * estás editando?», va a querer separar las dos cosas —un id opaco que
 * genera el servidor para revocar, y una etiqueta legible para mostrar— y
 * ese es el momento de hacerlo, con la pantalla delante.
 */
const idDeDispositivo = (crudo: unknown): string => {
  const texto = typeof crudo === 'string' ? crudo : ''
  const limpio = texto.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
  return limpio === '' ? 'sin-nombre' : limpio
}
```

Con su test:

```ts
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
  const r = await maneja(
    'publicar',
    { cuerpo: { base: 'x', documentos: {} }, cookie: cookieDeDispositivo('iPhone-15-de-Marcos') },
    contextoDePrueba({ env: { PANEL_DISPOSITIVOS_REVOCADOS: 'otro, iPhone-15-de-Marcos' } }),
  )
  expect(r.status).toBe(401)
})
```

- [ ] **Step 8: Corré y verificá que pasan**

Run: `pnpm vitest run test/acciones.test.ts test/sesion.test.ts`
Expected: PASS.

- [ ] **Step 9: Documentá las dos variables en el runbook**

En `docs/panel-operacion.md`, en la sección de variables, dos filas nuevas y una
sección corta «Cómo cortar una sesión»:

```markdown
### Cómo cortar una sesión (celular perdido, alguien que se va)

Tres botones, del más chico al más grande. **Ninguno de los tres pide rotar
`PANEL_SECRETO`** — rotarlo desloguea a todo el mundo y además mata los enlaces
mágicos que estén en vuelo.

1. **Un aparato:** agregá su id a `PANEL_DISPOSITIVOS_REVOCADOS` (lista separada
   por comas). El id sale del historial de la persona o del log de `entrar`.
2. **Todas las sesiones de todo el mundo:** poné en `PANEL_SESIONES_DESDE` la
   fecha y hora de ahora, en ISO 8601 (`2026-09-17T15:30:00Z`). Todos vuelven a
   entrar con su contraseña. **Ojo:** si la fecha no se puede leer, NADIE entra
   —está hecho así a propósito— así que revisá que quede bien escrita.
3. **Sacar a una persona para siempre:** quitá su dirección de `PANEL_CORREOS`.
   Se relee en cada pedido, así que corta enseguida.
```

**[RULING T3-2] Y hay que CORREGIR la sección vieja, no solo agregar esta.**
`docs/panel-operacion.md` ya trae «Cómo cerrar TODAS las sesiones abiertas»,
que dice —textual— que «la única forma de invalidar TODAS las cookies ya
emitidas, de una sola vez, es cambiar `PANEL_SECRETO`». Desde esta tarea eso es
**falso**, y es falso de la peor manera posible: el título de la sección vieja
es el que coincide con lo que alguien busca a las dos de la mañana, aparece
primero en el documento, y contesta con seguridad la opción más cara —rotar el
secreto desloguea a todo el mundo y, desde la Tarea 12, mata los enlaces
mágicos en vuelo—. Un runbook con dos respuestas a la misma pregunta, donde la
más fácil de encontrar es la peor, es peor que un runbook incompleto.

Reescribí esa sección para que diga la verdad de hoy: que ahora hay tres
botones, cuál es el barato, y que rotar `PANEL_SECRETO` queda como el último
recurso —el de «se filtró el secreto», no el de «se perdió un celular»—.
Corregí también la misma afirmación repetida en el bloque «Dos advertencias».

- [ ] **Step 10: Corré la suite entera**

Run: `pnpm vitest run`
Expected: PASS.

- [ ] **Step 11: Reempaquetá y commiteá**

```bash
pnpm bundle:api
git add src/servidor/sesion.ts src/servidor/acciones.ts api/panel.js test/sesion.test.ts test/acciones.test.ts docs/panel-operacion.md
git commit -m "feat: cortar una sesión sin rotar la llave, y el propósito adentro de la firma"
```

**Después de mergear esto, avisale a Marcos que su sesión del ensayo dejó de
valer y tiene que volver a entrar una vez.** No es un bug: es el costo, único,
de que el cuerpo de la cookie haya cambiado.

---

### Task 4: `version.json` — la única fuente que sabe qué está sirviendo el CDN

Spec §4.5. La API de Vercel sabe que el deploy TERMINÓ; eso no es lo mismo que
«el CDN ya está sirviendo ese commit». La diferencia entre las dos cosas es la
distancia entre «listo» y el pánico que el spec describe: ella toca «Ver mi
sitio», le sale el precio viejo por caché, y llama.

`version.json` es una página estática que el propio build escribe con el sha del
commit que lo construyó. Si el CDN te devuelve ese sha, el CDN está sirviendo
ese commit. No hay forma más barata ni más honesta de saberlo.

**Files:**
- Create: `src/pages/version.json.ts`
- Create: `test/version-json.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: nada.
- Produces: `GET https://www.maracacao.mx/version.json` →
  `{ "sha": "<40 hex>" | null, "construido": "<ISO 8601>" }`, con
  `Cache-Control: no-store`.

- [ ] **Step 1: Escribí el test que falla**

Crear `test/version-json.test.ts`:

```ts
/*
 * `version.json` es la segunda de las dos fuentes que deciden si un cambio
 * «ya está en el sitio» (spec §4.5): la API de Vercel dice que el deploy
 * terminó, y esto dice qué commit está sirviendo el CDN AHORA. Sin la
 * segunda, el panel canta «listo» mientras el CDN sigue entregando lo
 * viejo — y ella abre el sitio, ve el precio de antes, y llama.
 *
 * El test lee `dist/`, no construye: construir desde un test es la bomba de
 * recursión que `test/meta.test.ts` prohíbe. Sin `dist/` avisa y se salta,
 * salvo en CI, donde faltarlo SÍ es un error.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..')
const ARCHIVO = resolve(RAIZ, 'dist/version.json')

describe('version.json', () => {
  const sinDist = !existsSync(ARCHIVO)
  const enCI = Boolean(process.env.CI || process.env.VERCEL)
  if (sinDist && !enCI) {
    console.warn('test/version-json.test.ts: no hay dist/ — corré `pnpm build:sitio` para que este test mida algo.')
  }

  it('el build lo escribe (en CI es obligatorio)', () => {
    if (sinDist && !enCI) return
    expect(existsSync(ARCHIVO)).toBe(true)
  })

  it('trae el sha del commit que construyó, o null cuando se construye fuera de la plataforma', () => {
    if (sinDist && !enCI) return
    const v = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as { sha: unknown; construido: unknown }
    // Cuarenta hexadecimales, o `null` — nunca `undefined`, nunca `''`: el
    // panel compara este valor contra el sha que publicó, y un `''` que se
    // compara distinto de todo es lo mismo que un `null`, pero sin decirlo.
    expect(v.sha === null || (typeof v.sha === 'string' && /^[0-9a-f]{40}$/.test(v.sha))).toBe(true)
    expect(typeof v.construido).toBe('string')
    expect(Number.isFinite(Date.parse(v.construido as string))).toBe(true)
  })

  it('la plataforma lo sirve sin caché: si se cachea, deja de significar algo', () => {
    // Un `version.json` cacheado te dice qué commit se servía CUANDO SE
    // CACHEÓ. Es exactamente la mentira que este archivo existe para no
    // contar, así que la cabecera no es un detalle de performance: es la
    // mitad del mecanismo.
    const vercel = JSON.parse(readFileSync(resolve(RAIZ, 'vercel.json'), 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    const regla = vercel.headers.find((h) => h.source === '/version.json')
    expect(regla, 'vercel.json no tiene una regla de cabeceras para /version.json').toBeDefined()
    expect(regla!.headers.find((h) => h.key === 'Cache-Control')?.value).toBe('no-store')
  })
})
```

- [ ] **Step 2: Corré y verificá que falla**

Run: `pnpm build:sitio && pnpm vitest run test/version-json.test.ts`
Expected: FAIL los tres — no existe `dist/version.json` ni la regla en
`vercel.json`.

- [ ] **Step 3: Escribí el endpoint**

Crear `src/pages/version.json.ts`:

```ts
/*
 * Qué commit está sirviendo el CDN AHORA MISMO.
 *
 * El panel lo usa para la mitad más importante de «ya está en el sitio»
 * (spec §4.5): la API de la plataforma dice que el deploy TERMINÓ, y esto
 * dice que el borde de la red ya está entregando ESE commit. Las dos cosas
 * no pasan en el mismo instante, y la distancia entre ellas es la distancia
 * entre cantar «listo» y que ella abra el sitio y vea el precio viejo.
 *
 * Es estático: se escribe una vez, en el build, con el sha de ESE build. No
 * hay nada que calcular en cada pedido —el archivo ES la respuesta—, y por
 * eso funciona incluso si todas las funciones están caídas.
 *
 * `VERCEL_GIT_COMMIT_SHA` la inyecta la plataforma en todo deploy. Fuera de
 * ella (una construcción local) no existe, y el sha sale `null`: es
 * honesto, y el panel sabe leerlo como «esto no se construyó en el sitio de
 * verdad» en vez de comparar contra una cadena vacía que no es igual a nada.
 */
export const prerender = true

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  return new Response(JSON.stringify({ sha, construido: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Sumá la regla de cabeceras a `vercel.json`**

Adentro de `"headers"`, como PRIMERA entrada (antes que las reglas de caché
largo, para que se lea junto con lo que significa):

```json
    {
      "source": "/version.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    },
```

- [ ] **Step 5: Construí y corré el test**

Run: `pnpm build:sitio && pnpm vitest run test/version-json.test.ts`
Expected: PASS los tres.

- [ ] **Step 6: Verificá a mano que el JSON es el que esperás**

```bash
cat dist/version.json; echo
```
Expected: `{"sha":null,"construido":"2026-…"}` — `null` porque estás
construyendo local, que es exactamente lo que el segundo test acepta.

- [ ] **Step 7: Corré la suite entera y commiteá**

```bash
pnpm vitest run
git add src/pages/version.json.ts vercel.json test/version-json.test.ts
git commit -m "feat: version.json dice qué commit está sirviendo el sitio"
```

**Nota para quien revise:** esta tarea no toca `src/servidor/**`, así que NO
hace falta `pnpm bundle:api`.

---

### Task 5: el cliente de la API de Vercel — ¿terminó el deploy?

Spec §4.5: `PANEL_VERCEL_TOKEN` es obligatorio, porque publicar a ciegas es peor
que no publicar. Este es el módulo que lo usa.

**Antes de escribir una línea, se mide.** Es la misma regla que resolvió el
riesgo de tracing en la Parte A: la forma exacta de esta API se confirma con un
pedido real, no con lo que este plan supone. El Paso 1 es esa medición, y el
módulo se escribe contra lo que ELLA devuelva.

**Files:**
- Create: `src/servidor/vercel.ts`
- Create: `test/vercel-servidor.test.ts`
- Modify: `src/servidor/acciones.ts` (`Entorno`: dos variables nuevas), `docs/panel-operacion.md`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `fetchFalso` de `test/lib/github-falso.ts`.
- Produces:
  - `type EstadoDeDespliegue = 'enCurso' | 'listo' | 'falló' | 'desconocido'`
  - `interface CredencialesVercel { token: string; proyecto: string; fetch: typeof globalThis.fetch }`
  - `clienteVercel(c: CredencialesVercel)` con
    `despliegueDe(sha: string): Promise<{ estado: EstadoDeDespliegue; url: string | null }>`
  - `Entorno` gana `PANEL_VERCEL_TOKEN?: string` y `PANEL_VERCEL_PROYECTO?: string`.

- [ ] **Step 1: La medición se difiere — leé esto antes de escribir nada**

**[RULING T5-1]** Este paso pedía correr un `curl` contra la API real con el
token de Marcos, y confirmar tres cosas antes de escribir el módulo: cómo se
filtra por commit, en qué clave viene el estado y qué valores toma, y si el
proyecto se nombra con `app=` o con `projectId=`.

**No se puede hacer ahora.** El token no existe en el repo ni puede existir
—ningún secreto entra acá— y pedírselo a Marcos para pegarlo en una terminal
parada esta tarea hasta que él esté disponible. Así que la medición se difiere
al lugar donde ya iba a ocurrir de todas formas: el **paso 7 del ensayo de humo
(Tarea 15)**, que sondea el estado de una publicación real contra producción.
Ese paso ES la medición, nada más que unos días después.

Lo que hacés vos, entonces:

1. Escribí el módulo contra la forma documentada que el Paso 4 te da.
2. Dejá en el docstring un bloque **`PENDIENTE DE MEDICIÓN`** que nombre las
   tres preguntas de arriba, para que quien corra el ensayo sepa exactamente
   qué mirar y dónde corregir.
3. **No adivines de más.** Todo lo que el módulo no entienda se lee como
   `'enCurso'` — nunca como `'listo'` ni como `'falló'`. Esa asimetría es lo
   que hace que diferir la medición sea barato: si le erramos, el panel dice
   «seguí esperando» hasta que alguien lo corrija, en vez de mentirle a la
   clienta o disparar una reversión que nadie pidió.

*Costo si me equivoco:* el panel se queda diciendo «estamos subiendo tu cambio»
para siempre, y el ensayo de la Tarea 15 lo encuentra antes de que la clienta
lo vea nunca.

- [ ] **Step 2: Escribí los tests que fallan**

Crear `test/vercel-servidor.test.ts`:

```ts
/*
 * El cliente de la API de la plataforma: la mitad de «¿ya está en el sitio?»
 * que sabe si el deploy TERMINÓ (la otra mitad es `version.json`).
 *
 * Como el resto de `src/servidor/**`, es puro e inyectable: el token, el
 * proyecto y el `fetch` llegan por parámetro, así que esto se prueba entero
 * sin red y sin ningún token real.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { clienteVercel } from '../src/servidor/vercel'

const deV = (fetch: typeof globalThis.fetch) => clienteVercel({ token: 't', proyecto: 'maracacao', fetch })

describe('el estado del despliegue de un commit', () => {
  it('READY es «listo», y trae la dirección del despliegue', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { deployments: [{ state: 'READY', url: 'maracacao-abc.vercel.app' }] } },
    ])
    expect(await deV(f).despliegueDe('a'.repeat(40))).toEqual({ estado: 'listo', url: 'https://maracacao-abc.vercel.app' })
    expect(pedidos[0].cabeceras.Authorization).toBe('Bearer t')
  })

  it('ERROR y CANCELED son «falló»: los dos terminan sin sitio nuevo', async () => {
    for (const state of ['ERROR', 'CANCELED']) {
      const { f } = fetchFalso([{ cuerpo: { deployments: [{ state, url: null }] } }])
      expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('falló')
    }
  })

  it('BUILDING, QUEUED e INITIALIZING son «enCurso»', async () => {
    for (const state of ['BUILDING', 'QUEUED', 'INITIALIZING']) {
      const { f } = fetchFalso([{ cuerpo: { deployments: [{ state, url: null }] } }])
      expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('enCurso')
    }
  })

  it('B9: un estado que no conocemos se lee como «enCurso», nunca como listo ni como falló', async () => {
    // Equivocarse hacia «seguí esperando» cuesta unos segundos de espera.
    // Equivocarse hacia «listo» le miente a la clienta; hacia «falló»
    // dispara una reversión que nadie pidió. La asimetría es el argumento.
    const { f } = fetchFalso([{ cuerpo: { deployments: [{ state: 'ALGO_NUEVO', url: null }] } }])
    expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('enCurso')
  })

  it('sin ningún despliegue para ese commit, «desconocido» — que no es lo mismo que en curso', async () => {
    // Todavía no apareció: puede ser que la plataforma no lo haya visto aún,
    // o que nunca lo vaya a ver. El que decide qué hacer con eso es
    // `estado.ts`, mirando cuánto hace que se publicó — no este módulo.
    const { f } = fetchFalso([{ cuerpo: { deployments: [] } }])
    expect(await deV(f).despliegueDe('a'.repeat(40))).toEqual({ estado: 'desconocido', url: null })
  })

  it('si la plataforma contesta un error, tira — no inventa un estado', async () => {
    const { f } = fetchFalso([{ status: 403, cuerpo: { error: { message: 'Not authorized' } } }])
    await expect(deV(f).despliegueDe('a'.repeat(40))).rejects.toThrow(/403/)
  })

  it('T5-2: un 200 con un cuerpo ilegible también tira — «desconocido» sería mentir', async () => {
    // Una página de mantenimiento servida con 200, o una respuesta truncada
    // por timeout. Sin este camino, el módulo contestaba `'desconocido'` —que
    // significa «todavía no vio este commit»— y no dejaba nada en el log: el
    // único caso en que este archivo fallaba callado.
    const f = (async () =>
      new Response('<html>mantenimiento</html>', { status: 200 })) as unknown as typeof globalThis.fetch
    await expect(deV(f).despliegueDe('a'.repeat(40))).rejects.toThrow(/no se pudo leer/)
  })

  it('T5-2: y «desconocido» queda SOLO para el cuerpo bien formado sin despliegues', async () => {
    // El candado del test de arriba: que la excepción nueva no se haya comido
    // el caso legítimo, que es el normal en los primeros segundos tras publicar.
    const { f } = fetchFalso([{ cuerpo: { deployments: [] } }])
    expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('desconocido')
  })
})
```

- [ ] **Step 3: Corré y verificá que fallan**

Run: `pnpm vitest run test/vercel-servidor.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 4: Escribí `src/servidor/vercel.ts`**

```ts
/*
 * ¿Terminó el deploy de este commit?
 *
 * Es la primera de las dos fuentes que deciden «ya está en el sitio»
 * (spec §4.5). La segunda es `version.json`, que dice qué commit está
 * sirviendo el CDN. Las dos tienen que coincidir para cantar «listo»: esta
 * sola diría que sí cuando el borde de la red todavía entrega lo viejo.
 *
 * Puro e inyectable (regla de `src/servidor/**`): el token, el proyecto y el
 * `fetch` llegan por parámetro. Nada acá lee `process.env`.
 *
 * [MEDIDO <fecha>, contra la API real con el token de Marcos] — anotá acá qué
 * devolvió el `curl` del Paso 1 de la Tarea 5: con qué parámetro se filtra por
 * commit, en qué clave viene el estado y qué valores toma. Si contradice lo de
 * abajo, gana la medición y este comentario dice cuál era la suposición.
 *
 * Los errores de este módulo llevan el status: son para el log de Marcos, no
 * para la clienta. La traducción a español la hace `estado.ts`.
 */

export type EstadoDeDespliegue = 'enCurso' | 'listo' | 'falló' | 'desconocido'

export interface CredencialesVercel {
  token: string
  /** El nombre del proyecto en la plataforma. */
  proyecto: string
  fetch: typeof globalThis.fetch
}

/**
 * De los estados crudos a los tres que le importan al panel.
 *
 * [B9] Lo que NO está acá se lee como `'enCurso'`. La lista de estados de una
 * plataforma cambia sin avisar, y la pregunta no es «¿cómo se llama este
 * estado?» sino «¿qué es lo barato de creer si me equivoco?». Creer «todavía
 * está trabajando» cuesta unos segundos de espera de más. Creer «listo» le
 * miente a la clienta y la manda a mirar un sitio que no cambió. Creer
 * «falló» dispara una reversión automática que nadie pidió. La asimetría
 * decide, no la completitud de la lista.
 */
const TERMINADOS: Record<string, EstadoDeDespliegue> = {
  READY: 'listo',
  ERROR: 'falló',
  CANCELED: 'falló',
}

export function clienteVercel(c: CredencialesVercel) {
  return {
    /**
     * El estado del despliegue de un commit, y la dirección donde quedó
     * servido. `'desconocido'` cuando la plataforma todavía no tiene ningún
     * despliegue para ese commit — que NO es lo mismo que «en curso»: puede
     * ser que el webhook no haya llegado aún, o que no vaya a llegar nunca.
     * Qué hacer con esa diferencia lo decide `estado.ts`, que es el que sabe
     * cuánto hace que se publicó.
     */
    async despliegueDe(sha: string): Promise<{ estado: EstadoDeDespliegue; url: string | null }> {
      const url =
        `https://api.vercel.com/v6/deployments` +
        `?app=${encodeURIComponent(c.proyecto)}&sha=${encodeURIComponent(sha)}&limit=1`

      const respuesta = await c.fetch(url, {
        headers: { Authorization: `Bearer ${c.token}`, 'User-Agent': 'panel-maracacao' },
      })
      const cuerpo: unknown = await respuesta.json().catch(() => undefined)

      if (!respuesta.ok) {
        const mensaje = (cuerpo as { error?: { message?: unknown } } | undefined)?.error?.message
        throw new Error(
          `La plataforma respondió ${respuesta.status}: ${typeof mensaje === 'string' ? mensaje : 'sin mensaje'}`,
        )
      }

      // [RULING T5-2] Un 200 con un cuerpo que no se puede leer también es un
      // error, y hay que tratarlo como tal. Sin esta línea, el `.catch()` de
      // arriba lo dejaba en `undefined`, el `?? []` de abajo lo volvía «no hay
      // despliegues» y el módulo contestaba `'desconocido'` — que significa
      // «la plataforma todavía no vio este commit», una afirmación FALSA
      // cuando lo que pasó es que contestó basura. Y en silencio: sin
      // excepción no hay nada en el log de Marcos, contra lo que promete el
      // docstring de este archivo. Pasa de verdad: una página de
      // mantenimiento servida con 200, una respuesta truncada por timeout.
      //
      // `json()` sobre un cuerpo válido nunca devuelve `undefined` —un `null`
      // literal parsea a `null`— así que `undefined` acá significa
      // exactamente una cosa: no se pudo leer.
      if (cuerpo === undefined) {
        throw new Error(`La plataforma respondió ${respuesta.status} con un cuerpo que no se pudo leer.`)
      }

      const despliegues = (cuerpo as { deployments?: Array<{ state?: string; url?: string | null }> } | undefined)?.deployments ?? []
      const primero = despliegues[0]
      if (!primero) return { estado: 'desconocido', url: null }

      return {
        estado: TERMINADOS[primero.state ?? ''] ?? 'enCurso',
        // La API devuelve el host pelado («maracacao-abc.vercel.app»); lo que
        // el panel necesita es algo que se pueda abrir.
        url: primero.url ? `https://${primero.url}` : null,
      }
    },
  }
}
```

- [ ] **Step 5: Corré y verificá que pasan**

Run: `pnpm vitest run test/vercel-servidor.test.ts`
Expected: PASS los seis.

- [ ] **Step 6: Sumá las dos variables a `Entorno` y a `salud`**

En `src/servidor/acciones.ts`, en `Entorno`:

```ts
  /**
   * Token de la API de la plataforma. Es OBLIGATORIO (spec §4.5): sin él no
   * se puede saber si el deploy terminó ni revertir solo, y publicar a
   * ciegas es peor que no publicar — ella cree que publicó, vende al precio
   * nuevo, y el cliente le muestra el celular con el precio viejo.
   */
  PANEL_VERCEL_TOKEN?: string
  /** El nombre del proyecto en la plataforma. Por defecto, el del repo. */
  PANEL_VERCEL_PROYECTO?: string
```

En `VARIABLES_REQUERIDAS`, sumá `'PANEL_VERCEL_TOKEN'` — es requerida, así que
`salud` tiene que decir que falta.

En `src/servidor/entradas/panel.ts`, en `entorno()`:

```ts
    PANEL_VERCEL_TOKEN: process.env.PANEL_VERCEL_TOKEN,
    PANEL_VERCEL_PROYECTO: process.env.PANEL_VERCEL_PROYECTO ?? process.env.VERCEL_GIT_REPO_SLUG ?? 'maracacao',
```

- [ ] **Step 7: Documentá las dos variables**

En `docs/panel-operacion.md`, en la tabla de variables:

```markdown
| `PANEL_VERCEL_TOKEN` | Sí | Token de la API de la plataforma, con lectura de despliegues del proyecto. Sin él, el panel no puede decir si un cambio llegó al sitio ni revertir solo un deploy fallido — y la fase 6 apaga el botón Publicar. |
| `PANEL_VERCEL_PROYECTO` | No | El nombre del proyecto. Por defecto sale del repo (`maracacao`). Solo hace falta si algún día el proyecto se llama distinto del repo. |
```

- [ ] **Step 8: Avisale a Marcos ANTES de que esto se despliegue**

[RULING P-2 del preflight] Sumar `PANEL_VERCEL_TOKEN` a `VARIABLES_REQUERIDAS`
tiene una consecuencia en producción que hay que decir en voz alta: **desde que
esto mergee, `GET /api/panel?accion=salud` contesta 503 hasta que la variable
esté cargada.** Es información correcta —falta una variable obligatoria (spec
§4.5)— y es justo lo que la fase 6 necesita para apagar el botón Publicar. Pero
si nadie avisa, se lee como «rompimos algo».

Dejalo escrito en tu reporte, con estas palabras: *«Marcos tiene que crear un
token de la API de Vercel con lectura de despliegues del proyecto y cargarlo
como `PANEL_VERCEL_TOKEN` en el entorno Production ANTES de que esta rama
mergee. Mientras no esté, `salud` contesta 503; publicar sigue funcionando.»*
No lo cargues vos ni le pidas el token: no entra al repo ni al chat.

- [ ] **Step 9: Corré la suite entera, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/vercel.ts src/servidor/acciones.ts src/servidor/entradas/panel.ts api/panel.js test/vercel-servidor.test.ts docs/panel-operacion.md
git commit -m "feat: saber si el despliegue de un commit terminó, falló o sigue"
```

---

### Task 6: el correo — el aviso que llega cuando ella ya guardó el teléfono

Spec §4.5: «ella va a guardar el teléfono y atender tres clientes — nadie mira un
reloj tres minutos parada en un mercado». El aviso por correo no es un extra: es
lo que hace que publicar no la obligue a quedarse mirando.

**El correo degrada, no rompe** (decisión B3). Verificar `maracacao.mx` en Resend
es SPF+DKIM en el DNS: un trámite con tiempos de propagación, no una tarea de
código (spec §4.1). Si `RESEND_API_KEY` o `PANEL_REMITENTE` no están, este módulo
devuelve `{ ok: false, motivo: 'sin-configurar' }` y quien lo llamó sigue su
camino con un `console.warn`. Lo único que no puede degradar es el enlace mágico
(Tarea 12), porque ahí el correo ES el producto.

**Files:**
- Create: `src/servidor/correo.ts`
- Create: `test/correo.test.ts`
- Modify: `src/servidor/acciones.ts` (`Entorno`, `Contexto`), `src/servidor/entradas/panel.ts`, `docs/panel-operacion.md`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `fetchFalso`.
- Produces:
  - `interface Carta { a: string[]; asunto: string; texto: string }`
  - `interface CredencialesCorreo { clave?: string; remitente?: string; fetch: typeof globalThis.fetch }`
  - `manda(c: CredencialesCorreo, carta: Carta): Promise<{ ok: true } | { ok: false; motivo: 'sin-configurar' | 'rechazado' | 'sin-destino' }>`
  - `Entorno` gana `RESEND_API_KEY?`, `PANEL_REMITENTE?`, `PANEL_AVISOS_A?`.
  - `Contexto` gana `correo: (carta: Carta) => Promise<…>` — ya atado a las
    credenciales por el borde, para que las acciones no tengan que conocerlas.

- [ ] **Step 1: Escribí los tests que fallan**

Crear `test/correo.test.ts`:

```ts
/*
 * El aviso por correo. Puro e inyectable: la clave, el remitente y el `fetch`
 * llegan por parámetro, así que esto se prueba sin red y sin ninguna clave
 * real.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { manda } from '../src/servidor/correo'

describe('mandar un aviso', () => {
  it('manda el correo con el remitente configurado', async () => {
    const { f, pedidos } = fetchFalso([{ cuerpo: { id: 'abc' } }])
    const r = await manda(
      { clave: 'k', remitente: 'Panel Maracacao <panel@maracacao.mx>', fetch: f },
      { a: ['ella@ejemplo.mx'], asunto: 'Tu cambio ya está en el sitio', texto: 'Listo.' },
    )
    expect(r).toEqual({ ok: true })
    expect(pedidos[0].url).toBe('https://api.resend.com/emails')
    expect(pedidos[0].cuerpo).toEqual({
      from: 'Panel Maracacao <panel@maracacao.mx>',
      to: ['ella@ejemplo.mx'],
      subject: 'Tu cambio ya está en el sitio',
      text: 'Listo.',
    })
  })

  it('B3: sin clave o sin remitente NO tira: dice que no está configurado y no toca la red', async () => {
    // Verificar el dominio en el proveedor es un trámite de DNS con días de
    // propagación (spec §4.1). Mientras no esté, publicar tiene que seguir
    // funcionando: lo que se pierde es el aviso, no la publicación.
    const { f, pedidos } = fetchFalso([])
    const carta = { a: ['ella@ejemplo.mx'], asunto: 'x', texto: 'y' }

    expect(await manda({ remitente: 'r', fetch: f }, carta)).toEqual({ ok: false, motivo: 'sin-configurar' })
    expect(await manda({ clave: 'k', fetch: f }, carta)).toEqual({ ok: false, motivo: 'sin-configurar' })
    expect(pedidos).toHaveLength(0)
  })

  it('sin ningún destinatario tampoco toca la red', async () => {
    const { f, pedidos } = fetchFalso([])
    expect(await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: [], asunto: 'x', texto: 'y' })).toEqual({
      ok: false,
      motivo: 'sin-destino',
    })
    expect(pedidos).toHaveLength(0)
  })

  it('si el proveedor rechaza, devuelve `rechazado` — nunca tira hacia afuera', async () => {
    // Quien llama a esto está en medio de publicar o de revertir. Una
    // excepción acá abortaría algo importante por culpa de algo que no lo es.
    const { f } = fetchFalso([{ status: 422, cuerpo: { message: 'domain not verified' } }])
    expect(
      await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: ['x@y.mx'], asunto: 'x', texto: 'y' }),
    ).toEqual({ ok: false, motivo: 'rechazado' })
  })

  it('si la red se cae, tampoco tira', async () => {
    const f = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof globalThis.fetch
    expect(
      await manda({ clave: 'k', remitente: 'r', fetch: f }, { a: ['x@y.mx'], asunto: 'x', texto: 'y' }),
    ).toEqual({ ok: false, motivo: 'rechazado' })
  })

  it('T6-2: NINGUNA forma de carta rota lo hace tirar', async () => {
    // La promesa de este módulo es absoluta, así que el test tiene que serlo
    // también. Verificado en la revisión: con `a` ausente, `a` en `null` o la
    // carta entera ausente, la versión anterior tiraba un `TypeError` — y se
    // llevaba puesto el flujo de publicar o revertir, que es lo único que
    // esta promesa existe para proteger.
    const { f } = fetchFalso([])
    const cred = { clave: 'k', remitente: 'r', fetch: f }
    const rotas = [
      undefined,
      null,
      {},
      { asunto: 'x', texto: 'y' },
      { a: undefined, asunto: 'x', texto: 'y' },
      { a: null, asunto: 'x', texto: 'y' },
      { a: [], asunto: 'x', texto: 'y' },
    ]
    for (const carta of rotas) {
      await expect(manda(cred, carta as never)).resolves.toEqual({ ok: false, motivo: 'sin-destino' })
    }
  })

  it('T6-2: y unas credenciales rotas tampoco', async () => {
    const carta = { a: ['x@y.mx'], asunto: 'x', texto: 'y' }
    for (const cred of [undefined, null, {}]) {
      await expect(manda(cred as never, carta)).resolves.toEqual({ ok: false, motivo: 'sin-configurar' })
    }
  })
})
```

- [ ] **Step 2: Corré y verificá que fallan**

Run: `pnpm vitest run test/correo.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Escribí `src/servidor/correo.ts`**

```ts
/*
 * El aviso por correo.
 *
 * Existe por una razón concreta del spec (§4.5): «ella va a guardar el
 * teléfono y atender tres clientes — nadie mira un reloj tres minutos parada
 * en un mercado». Sin el correo, publicar la obliga a quedarse mirando la
 * pantalla; con él, publica y sigue trabajando.
 *
 * [B3] ESTE MÓDULO NUNCA TIRA. Todo lo que lo llama está en medio de algo que
 * importa más que el aviso —publicando, revirtiendo un deploy roto—, así que
 * una excepción acá abortaría lo importante por culpa de lo accesorio. Todas
 * las formas de fallar (sin configurar, rechazado, sin red) vuelven como un
 * `{ ok: false, motivo }` que quien llama loguea y sigue.
 *
 * Y por eso mismo la falta de configuración es un resultado, no un error:
 * verificar el dominio en el proveedor es SPF+DKIM en el DNS, un trámite con
 * días de propagación (spec §4.1). Mientras no esté, el panel publica igual.
 *
 * Puro e inyectable (regla de `src/servidor/**`): la clave, el remitente y el
 * `fetch` llegan por parámetro. Nada acá lee `process.env`.
 */

export interface Carta {
  a: string[]
  asunto: string
  /** Texto plano. El panel no manda HTML: nada de lo que avisa lo necesita. */
  texto: string
}

export interface CredencialesCorreo {
  clave?: string
  /** `Nombre <dirección>` verificado en el proveedor. */
  remitente?: string
  fetch: typeof globalThis.fetch
}

export type ResultadoCorreo =
  | { ok: true }
  | { ok: false; motivo: 'sin-configurar' | 'rechazado' | 'sin-destino' }

export async function manda(c: CredencialesCorreo, carta: Carta): Promise<ResultadoCorreo> {
  // [RULING T6-2] El `try` abarca la función ENTERA, chequeos incluidos, y los
  // chequeos son a prueba de nulos. La primera versión dejaba
  // `carta.a.length === 0` afuera del `try`, así que una `Carta` con `a` en
  // `undefined` tiraba un `TypeError` y se llevaba puesto el flujo que llama
  // —publicar, revertir—, que es exactamente lo que la promesa de este módulo
  // («nunca tira») existe para impedir. Verificado ejecutando: tiraba con `a`
  // ausente, con `a` en `null`, y con la carta entera ausente.
  //
  // Una promesa absoluta se sostiene con una estructura absoluta, no
  // recordándose de envolver cada línea nueva. El costo de esto es real y va
  // dicho: un bug adentro de esta función sale como `'rechazado'` en vez de
  // explotar. Se acepta porque quien llama ya está en medio de algo más
  // importante que el aviso, y porque el aviso que no sale se nota (no llega
  // el correo), mientras que la publicación que se aborta por culpa del aviso
  // no se nota hasta que la clienta pregunta por qué no se publicó.
  try {
    if (!c?.clave || !c?.remitente) return { ok: false, motivo: 'sin-configurar' }
    if (!carta?.a?.length) return { ok: false, motivo: 'sin-destino' }

    const respuesta = await c.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: c.remitente, to: carta.a, subject: carta.asunto, text: carta.texto }),
    })
    return respuesta.ok ? { ok: true } : { ok: false, motivo: 'rechazado' }
  } catch {
    // La red se cayó, o el proveedor no contestó. Mismo tratamiento: quien
    // llama sigue su camino. El detalle no se loguea acá —este módulo no sabe
    // en qué contexto lo llamaron— sino en el llamador, que sí lo sabe.
    return { ok: false, motivo: 'rechazado' }
  }
}
```

- [ ] **Step 4: Corré y verificá que pasan**

Run: `pnpm vitest run test/correo.test.ts`
Expected: PASS los cinco.

- [ ] **Step 5: Atalo al contexto desde el borde**

En `src/servidor/acciones.ts`, en `Entorno`:

```ts
  /** La clave del proveedor de correo. Ausente = los avisos no se mandan (B3). */
  RESEND_API_KEY?: string
  /** `Panel Maracacao <panel@maracacao.mx>`, verificado en el proveedor. */
  PANEL_REMITENTE?: string
  /**
   * A quién avisarle cuando algo sale MAL (el deploy falló, el token está por
   * vencer). Es la dirección de Marcos, no la de la clienta: a ella se le
   * avisa a su propio correo de sesión, que el panel ya conoce.
   */
  PANEL_AVISOS_A?: string
```

En `Contexto`:

```ts
  /**
   * Mandar un aviso, ya atado a las credenciales por el borde. Las acciones
   * no conocen la clave ni el remitente: piden «mandá esto» y listo. Así, un
   * test le pasa una función que anota las cartas en una lista y verifica
   * QUÉ se avisa sin tocar la red ni ninguna clave.
   */
  correo: (carta: Carta) => Promise<ResultadoCorreo>
```

En `src/servidor/entradas/panel.ts`, al armar el contexto:

```ts
    correo: (carta) => manda({ clave: process.env.RESEND_API_KEY, remitente: process.env.PANEL_REMITENTE, fetch: globalThis.fetch }, carta),
```

con su import, y sumá las tres variables a `entorno()`.

- [ ] **Step 6: Documentá las tres variables**

En `docs/panel-operacion.md`:

**[CORREGIDO 2026-09-17, ruling T6-1]** La tabla real de `docs/panel-operacion.md`
tiene las columnas **`Variable | Qué es | Si falta`**, no las `Variable | Sí/No |
descripción` que este plan venía escribiendo. Pegar filas con la forma
equivocada deja una tabla donde la segunda columna significa una cosa en unas
filas y otra en otras — y esa tabla es lo que Marcos va a leer apurado el día
que algo no ande. Van con la forma real:

```markdown
| `RESEND_API_KEY` | La clave del proveedor de correo. | No es una de las obligatorias: el panel publica igual. Lo que se pierde son los avisos, y el enlace mágico deja de estar disponible. |
| `PANEL_REMITENTE` | La dirección desde la que salen los avisos: `Panel Maracacao <panel@maracacao.mx>`. Tiene que ser de un dominio verificado en el proveedor (SPF+DKIM en el DNS). | Igual que la anterior: sin avisos y sin enlace mágico. Y mientras `maracacao.mx` no esté verificado, los avisos solo llegan a la casilla del dueño de la cuenta del proveedor. |
| `PANEL_AVISOS_A` | A quién avisarle cuando algo sale mal: un despliegue que falló, el token por vencer. Es la dirección de Marcos; a la clienta se le avisa al correo con el que entró. | Los avisos para Marcos no salen. Los de la clienta sí. |
```

- [ ] **Step 7: Corré la suite entera, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/correo.ts src/servidor/acciones.ts src/servidor/entradas/panel.ts api/panel.js test/correo.test.ts docs/panel-operacion.md
git commit -m "feat: el aviso por correo, que degrada sin romper si no está configurado"
```

---

### Task 7: `accion=estado` — ¿ya está en el sitio?

Spec §4.5. Las dos fuentes de la Tarea 4 y la Tarea 5 se cruzan acá, y el
servidor es el que dicta cada cuánto volver a preguntar (decisión B1): «3 s el
primer minuto, 6 s después, tope 5 minutos», y NUNCA gira infinito.

La lógica de decidir vive en un módulo puro y sin red (`estado.ts`) que recibe
las dos respuestas ya leídas. Así se prueban las once combinaciones sin montar
un servidor falso, y la acción del router queda siendo lo que tiene que ser:
dos lecturas y una llamada.

**Files:**
- Create: `src/servidor/estado.ts`
- Create: `test/estado.test.ts`
- Modify: `src/servidor/acciones.ts` (acción `estado` + router)
- Test: `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `EstadoDeDespliegue` y `clienteVercel` (Tarea 5); `version.json` (Tarea 4); `sesionVigente` (Tarea 3).
- Produces:
  - `const SITIO = 'https://www.maracacao.mx'` exportado de `estado.ts`.
  - `interface Veredicto { estado: 'enCurso' | 'listo' | 'falló'; frase: string; reintentarEn: number | null; url: string | null }`
  - `decide(e: { despliegue: EstadoDeDespliegue; url: string | null; shaServido: string | null; shaPublicado: string; desdeHaceMs: number }): Veredicto`
  - `POST /api/panel?accion=estado` con cuerpo `{ sha, publicadoEn }` → `Veredicto`.

- [ ] **Step 1: Escribí los tests que fallan**

Crear `test/estado.test.ts`:

```ts
/*
 * «¿Ya está en el sitio?» son DOS preguntas, no una (spec §4.5): la
 * plataforma dice que el deploy TERMINÓ, y `version.json` dice qué commit
 * está sirviendo el CDN. Cantar «listo» con la primera sola es mandarla a
 * mirar un sitio que todavía entrega lo viejo.
 *
 * Este módulo no tiene red: recibe las dos respuestas ya leídas y decide.
 * Por eso las once combinaciones se prueban acá, en milisegundos.
 */
import { describe, it, expect } from 'vitest'
import { decide, JERGA_PROHIBIDA } from '../src/servidor/estado'

const SHA = 'a'.repeat(40)
const base = { despliegue: 'enCurso' as const, url: null, shaServido: null, shaPublicado: SHA, desdeHaceMs: 5_000 }

describe('el veredicto', () => {
  it('B2: listo exige las DOS fuentes — la plataforma terminó Y el CDN ya sirve ese commit', () => {
    const v = decide({ ...base, despliegue: 'listo', url: 'https://x.vercel.app', shaServido: SHA })
    expect(v.estado).toBe('listo')
    expect(v.reintentarEn).toBeNull()
    expect(v.frase).toBe('Tu cambio ya está en el sitio.')
  })

  it('B2: la plataforma terminó pero el CDN sigue con lo viejo: todavía NO está listo', () => {
    // Es la ventana exacta en la que el panel mentía si mirara una sola
    // fuente. Dura segundos, y en esos segundos ella abre el sitio y ve el
    // precio de antes.
    const v = decide({ ...base, despliegue: 'listo', shaServido: 'b'.repeat(40) })
    expect(v.estado).toBe('enCurso')
    expect(v.reintentarEn).toBe(3_000)
  })

  it('falló es definitivo: no se vuelve a preguntar', () => {
    const v = decide({ ...base, despliegue: 'falló' })
    expect(v.estado).toBe('falló')
    expect(v.reintentarEn).toBeNull()
    expect(v.frase).toBe('No salió; lo dejé como estaba y ya le avisé a Marcos.')
  })

  it('la cadencia la dicta el servidor: 3 s el primer minuto, 6 s después', () => {
    expect(decide({ ...base, desdeHaceMs: 0 }).reintentarEn).toBe(3_000)
    expect(decide({ ...base, desdeHaceMs: 59_000 }).reintentarEn).toBe(3_000)
    expect(decide({ ...base, desdeHaceMs: 60_001 }).reintentarEn).toBe(6_000)
    expect(decide({ ...base, desdeHaceMs: 250_000 }).reintentarEn).toBe(6_000)
  })

  it('a los cinco minutos deja de preguntar, y lo dice sin mentir', () => {
    // «NUNCA gira infinito» (spec §4.5). Y el texto no puede prometer un
    // aviso que nadie va a mandar: si ella cerró el panel, no hay quien
    // sondee. Se le dice que vuelva a mirar, que es lo único cierto.
    const v = decide({ ...base, desdeHaceMs: 300_001 })
    expect(v.reintentarEn).toBeNull()
    expect(v.estado).toBe('enCurso')
    expect(v.frase).toBe('Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.')
  })

  it('«desconocido» no es «falló»: se sigue esperando', () => {
    // La plataforma todavía no vio el commit. Tratarlo como fracaso
    // dispararía una reversión automática por un webhook que tardó.
    const v = decide({ ...base, despliegue: 'desconocido' })
    expect(v.estado).toBe('enCurso')
  })

  it('B10: ninguna de las cuatro frases nombra una tecnología', () => {
    const frases = [
      decide({ ...base, despliegue: 'listo', shaServido: SHA }).frase,
      decide({ ...base }).frase,
      decide({ ...base, despliegue: 'falló' }).frase,
      decide({ ...base, desdeHaceMs: 300_001 }).frase,
    ]
    for (const f of frases) {
      for (const jerga of JERGA_PROHIBIDA) {
        expect(f.toLowerCase(), f).not.toContain(jerga.toLowerCase())
      }
    }
  })
})
```

- [ ] **Step 2: Corré y verificá que fallan**

Run: `pnpm vitest run test/estado.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Escribí `src/servidor/estado.ts`**

```ts
/*
 * «¿Ya está en el sitio?».
 *
 * Son DOS preguntas y las dos tienen que dar que sí (spec §4.5, decisión B2):
 *   1. La plataforma dice que el despliegue TERMINÓ.
 *   2. `version.json` —servido por el CDN, sin caché— dice que el commit que
 *      está entregando es ESE.
 * Entre una y otra hay una ventana de segundos. Es corta, y es exactamente
 * cuando ella toca «Ver mi sitio» y ve el precio viejo.
 *
 * Sin red a propósito: recibe las dos respuestas ya leídas. Así las once
 * combinaciones se prueban en milisegundos, y la acción del router queda
 * siendo dos lecturas y una llamada.
 *
 * Puro e inyectable (regla de `src/servidor/**`): ni `process.env` ni `fetch`.
 * Ni siquiera el reloj — quien llama pasa `desdeHaceMs`.
 */
import type { EstadoDeDespliegue } from './vercel'

/** El sitio de verdad. De acá sale `version.json`, que es lo que el CDN sirve. */
export const SITIO = 'https://www.maracacao.mx'

/** Cada cuánto volver a preguntar, y hasta cuándo (spec §4.5). */
const CADENCIA_RAPIDA_MS = 3_000
const CADENCIA_LENTA_MS = 6_000
const CAMBIA_DE_CADENCIA_MS = 60_000
const DEJA_DE_PREGUNTAR_MS = 300_000

/**
 * [B10] Las cuatro frases. Viven acá, juntas, para que se lean una al lado de
 * la otra: son lo único de este módulo que la clienta ve, y un test exige que
 * ninguna nombre una tecnología.
 */
const FRASE_LISTO = 'Tu cambio ya está en el sitio.'
const FRASE_EN_CURSO = 'Estamos subiendo tu cambio al sitio.'
// Esta frase promete DOS cosas que este módulo no hace: que algo se dejó como
// estaba, y que se le avisó a Marcos. Las dos las cumple `revierteYAvisa()` en
// `acciones.ts` (Tarea 8), en la MISMA invocación que devuelve este veredicto
// —la que ve el fracaso revierte y manda los dos correos antes de contestar—.
// Si algún día esa reversión deja de correr ahí, esta frase pasa a ser mentira
// y hay que cambiarla: es una promesa que este archivo hace y otro paga.
const FRASE_FALLO = 'No salió; lo dejé como estaba y ya le avisé a Marcos.'
const FRASE_TARDA =
  'Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.'

/**
 * Las palabras que NUNCA pueden aparecer en algo que lea la clienta.
 *
 * Vive exportada y no suelta adentro de un test porque el guardián tiene que
 * poder correr sobre TODAS las frases que una acción puede devolver, no solo
 * sobre las que produce este archivo: `estadoAccion` también contesta con las
 * frases compartidas del router (sesión inválida, «algo salió mal», «no
 * pudimos revisar el contenido»), y esas las puede editar mañana alguien que
 * está tocando otra acción y no se acuerda de que esta también las usa.
 */
export const JERGA_PROHIBIDA = ['Vercel', 'deploy', 'commit', 'build', 'GitHub', 'CDN', 'sha'] as const

export interface Veredicto {
  estado: 'enCurso' | 'listo' | 'falló'
  frase: string
  /** Milisegundos hasta la próxima pregunta, o `null` para dejar de preguntar. */
  reintentarEn: number | null
  /** La dirección donde quedó el despliegue, cuando la hay. */
  url: string | null
}

export function decide(e: {
  despliegue: EstadoDeDespliegue
  url: string | null
  /** El sha que `version.json` dice que el CDN está sirviendo, o `null`. */
  shaServido: string | null
  /** El sha que ella publicó. */
  shaPublicado: string
  /** Cuánto hace que se publicó. */
  desdeHaceMs: number
}): Veredicto {
  if (e.despliegue === 'falló') {
    return { estado: 'falló', frase: FRASE_FALLO, reintentarEn: null, url: e.url }
  }

  // [B2] Las dos fuentes. `shaServido` puede ser `null` construyendo fuera de
  // la plataforma; ahí no coincide con nada, que es lo correcto.
  if (e.despliegue === 'listo' && e.shaServido === e.shaPublicado) {
    return { estado: 'listo', frase: FRASE_LISTO, reintentarEn: null, url: e.url }
  }

  // «NUNCA gira infinito» (spec §4.5). Y la frase no promete un aviso: si ella
  // cerró el panel, no hay nadie sondeando que pueda mandarlo.
  if (e.desdeHaceMs > DEJA_DE_PREGUNTAR_MS) {
    return { estado: 'enCurso', frase: FRASE_TARDA, reintentarEn: null, url: e.url }
  }

  return {
    estado: 'enCurso',
    frase: FRASE_EN_CURSO,
    reintentarEn: e.desdeHaceMs > CAMBIA_DE_CADENCIA_MS ? CADENCIA_LENTA_MS : CADENCIA_RAPIDA_MS,
    url: e.url,
  }
}
```

- [ ] **Step 4: Corré y verificá que pasan**

Run: `pnpm vitest run test/estado.test.ts`
Expected: PASS los siete.

- [ ] **Step 5: Escribí los tests de la acción, en `test/acciones.test.ts`**

```ts
describe('accion=estado', () => {
  it('sin sesión, 401 y ni un pedido', async () => {
    const { f, pedidos } = fetchFalso([])
    const r = await maneja('estado', { cuerpo: { sha: 'a'.repeat(40), publicadoEn: 1_000 }, cookie: '' }, contextoDePrueba({ fetch: f }))
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
      contextoDePrueba({ fetch: f, ahora: () => 6_000 }),
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
      contextoDePrueba({ fetch: f, ahora: () => 6_000 }),
    )
    expect((r.cuerpo as { estado: string }).estado).toBe('enCurso')
  })

  it('sin PANEL_VERCEL_TOKEN, 503 con frase — no un estado inventado', async () => {
    const r = await maneja(
      'estado',
      { cuerpo: { sha: 'a'.repeat(40), publicadoEn: 1_000 }, cookie: cookieValida() },
      contextoDePrueba({ env: { PANEL_VERCEL_TOKEN: undefined } }),
    )
    expect(r.status).toBe(503)
  })
})
```

- [ ] **Step 6: Corré y verificá que fallan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: FAIL — `estado` cae en el `default` del router y contesta 404.

- [ ] **Step 7: Implementá la acción en `src/servidor/acciones.ts`**

```ts
/*
 * ---------------------------------------------------------------------
 * estado
 * ---------------------------------------------------------------------
 */

/**
 * `estado`: ¿el cambio que publicó ya está en el sitio? (spec §4.5).
 *
 * [B1] El panel pregunta; el servidor dice cada cuánto volver a preguntar y
 * cuándo parar. El sondeo NO vive en la función: una función de la plataforma
 * muere a los 60 s y un despliegue tarda más, así que «la función sondea»
 * —como lo escribió el spec— no se puede implementar. Lo que sí se puede, y
 * es lo mismo desde donde ella lo mira, es que cada respuesta traiga su
 * `reintentarEn`.
 *
 * Las dos lecturas van en este orden porque la primera es la que puede
 * ahorrar la segunda: si el despliegue falló, no hace falta preguntarle nada
 * al CDN.
 *
 * Si `version.json` no contesta, NO se asume nada: se sigue con
 * `shaServido: null`, que nunca coincide, así que el veredicto es «en curso».
 * Una de las dos fuentes caída no puede volverse un «sí» por omisión.
 */
async function estadoAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('estado: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  if (!env.PANEL_VERCEL_TOKEN) {
    console.error('estado: PANEL_VERCEL_TOKEN no está cargada — no hay forma de saber si el despliegue terminó.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const cuerpo = (pedido.cuerpo ?? {}) as { sha?: unknown; publicadoEn?: unknown }
  if (typeof cuerpo.sha !== 'string' || !/^[0-9a-f]{40}$/.test(cuerpo.sha)) {
    return error(400, PROBLEMA_INESPERADO)
  }
  const publicadoEn = typeof cuerpo.publicadoEn === 'number' ? cuerpo.publicadoEn : contexto.ahora()

  const vercel = clienteVercel({
    token: env.PANEL_VERCEL_TOKEN,
    proyecto: env.PANEL_VERCEL_PROYECTO ?? 'maracacao',
    fetch: contexto.fetch,
  })

  let despliegue: { estado: EstadoDeDespliegue; url: string | null }
  try {
    despliegue = await vercel.despliegueDe(cuerpo.sha)
  } catch (e) {
    console.error('estado: la plataforma no contestó por el despliegue —', e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  const shaServido = despliegue.estado === 'listo' ? await shaQueSirveElCdn(contexto) : null

  const veredicto = decide({
    despliegue: despliegue.estado,
    url: despliegue.url,
    shaServido,
    shaPublicado: cuerpo.sha,
    desdeHaceMs: contexto.ahora() - publicadoEn,
  })

  return ok({ ok: true, ...veredicto })
}

/**
 * Qué commit está sirviendo el CDN, según `version.json` (Tarea 4).
 *
 * El `?t=` es obligatorio y no es paranoia: aunque `vercel.json` le ponga
 * `no-store`, entre esta función y el archivo puede haber un caché que no
 * conocemos. Un `version.json` cacheado dice qué se servía CUANDO SE CACHEÓ,
 * que es justo la mentira que este archivo existe para no contar.
 *
 * Devuelve `null` ante cualquier problema: eso nunca coincide con el sha
 * publicado, así que el veredicto queda en «en curso». Una fuente caída no
 * puede convertirse en un «ya está» por omisión.
 */
async function shaQueSirveElCdn(contexto: Contexto): Promise<string | null> {
  try {
    const r = await contexto.fetch(`${SITIO}/version.json?t=${contexto.ahora()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json()) as { sha?: unknown }
    return typeof v.sha === 'string' ? v.sha : null
  } catch (e) {
    console.error('estado: no se pudo leer version.json del sitio —', e)
    return null
  }
}
```

Y en el `switch` de `maneja()`:

```ts
      case 'estado':
        return await estadoAccion(pedido, contexto)
```

Sumá los imports: `clienteVercel`, `type EstadoDeDespliegue` de `./vercel`, y
`decide`, `SITIO` de `./estado`.

- [ ] **Step 7b: El guardián de jerga tiene que cubrir TODO lo que la acción puede decir**

El test de arriba cubre las cuatro frases de `decide()`. Pero `estadoAccion`
también contesta, sin pasar por `decide()`, con las frases COMPARTIDAS del
router: la de sesión inválida, la genérica de «algo salió mal» (503 y 400) y la
de «no pudimos revisar el contenido» (502). Hoy las tres están limpias
—verificado— pero nada las ata a la lista: el día que alguien las retoque
ajustando otra acción, `accion=estado` empieza a hablarle a la clienta con
jerga y ningún test lo caza.

En `test/acciones.test.ts`:

```ts
it('B10: NINGUNA respuesta de `estado` le habla a la clienta con jerga, ni las frases compartidas', async () => {
  // Las frases del router las comparten varias acciones, así que se pueden
  // editar desde cualquier lado. Este test recorre TODAS las salidas posibles
  // de `estado` —no solo las que produce `decide()`— y las pasa por la misma
  // lista. Es el único lugar donde esas tres cadenas quedan atadas a la regla.
  const salidas: string[] = []
  for (const armar of [
    () => maneja('estado', { cuerpo: {}, cookie: '' }, contextoBase()),                        // 401
    () => maneja('estado', { cuerpo: { sha: 'no-es-un-sha' }, cookie: cookieValida() }, contextoBase()), // 400
    () => maneja('estado', { cuerpo: { sha: SHA }, cookie: cookieValida() }, sinTokenDePlataforma()),    // 503
    () => maneja('estado', { cuerpo: { sha: SHA }, cookie: cookieValida() }, conPlataformaCaida()),      // 502
  ]) {
    const r = await armar()
    const c = r.cuerpo as { problema?: string; frase?: string }
    salidas.push(c.problema ?? c.frase ?? '')
  }

  expect(salidas.filter((s) => s !== '')).toHaveLength(4)
  for (const frase of salidas) {
    for (const jerga of JERGA_PROHIBIDA) {
      expect(frase.toLowerCase(), frase).not.toContain(jerga.toLowerCase())
    }
  }
})
```

Adaptá los cuatro armadores a los ayudantes que el archivo tenga. El assert de
`toHaveLength(4)` no es decorativo: sin él, un cambio que haga que alguna de
esas ramas devuelva un cuerpo sin frase dejaría el test verde sobre una lista
vacía.

- [ ] **Step 7c: Y el nombre del proyecto no puede resolver a la cadena vacía en silencio**

`PANEL_VERCEL_TOKEN` corta con 503 si falta, y nombra la variable en el log.
El nombre del proyecto no tiene esa guardia: si tanto `PANEL_VERCEL_PROYECTO`
como `GITHUB_REPO` faltaran, el código sigue con `proyecto: ''` y le pregunta a
la plataforma por un proyecto sin nombre. Lo más probable es que la API rechace
el pedido y termine en un 502 —seguro, pero mudo—: Marcos ve «no pudimos
conectarnos» cuando lo que pasa es que falta una variable, que es un
diagnóstico completamente distinto.

Misma guardia que el token, justo al lado:

```ts
  const proyecto = env.PANEL_VERCEL_PROYECTO ?? env.GITHUB_REPO ?? ''
  if (proyecto === '') {
    console.error('estado: ni PANEL_VERCEL_PROYECTO ni GITHUB_REPO están cargadas — no sé por qué proyecto preguntar.')
    return error(503, PROBLEMA_INESPERADO)
  }
```

- [ ] **Step 8: Corré y verificá que pasan**

Run: `pnpm vitest run test/acciones.test.ts test/estado.test.ts`
Expected: PASS.

- [ ] **Step 9: Corré la suite entera, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/estado.ts src/servidor/acciones.ts api/panel.js test/estado.test.ts test/acciones.test.ts
git commit -m "feat: estado cruza las dos fuentes y dicta cada cuánto preguntar"
```

---

### Task 8: la reversión automática — el sitio se arregla solo

Spec §4.6, y el escenario no es hipotético: la primera prueba de humo en
producción terminó con un commit del panel en `main` y el deploy en rojo.
Sin esta tarea, ese commit se queda ahí, **la próxima publicación también falla
—ahora sin que ella haya cambiado nada—** y termina en el WhatsApp que el panel
viene a matar.

La reversión es un commit NUEVO con los blobs VIEJOS (spec §4.6): cero subidas,
funciona igual para las imágenes, y pasa por la misma validación que cualquier
publicación — porque el contenido viejo puede no pasar las reglas de hoy.

**Files:**
- Modify: `src/servidor/github.ts` (`commit` devuelve los padres)
- Modify: `src/servidor/publicar.ts` (`Publicacion.trailers`)
- Create: `src/servidor/revertir.ts`
- Create: `test/revertir.test.ts`
- Modify: `src/servidor/acciones.ts` (`estadoAccion` revierte y avisa)
- Test: `test/github.test.ts`, `test/publicar.test.ts`, `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `publica` (Tareas 1 y 2), `gh.comparaRefs` (Tarea 2), `gh.archivoEnRef` (Tarea 1), `contexto.correo` (Tarea 6).
- Produces:
  - `gh.commit(sha)` suma `padres: string[]` y `mensaje` (ya devolvía `message`; se deja el nombre en inglés como está hoy y se suma `padres`).
  - `Publicacion` gana `trailers?: Record<string, string>` — líneas extra del cuerpo del commit, después de `Panel: sí` y `Panel-Autor:`.
  - `revierte(gh, { sha, autor, bytesDelCuerpo? }): Promise<ResultadoReversion>` en `revertir.ts`, donde
    `type ResultadoReversion = { ok: true; sha: string | null; revirtio: string } | { ok: false; motivo: 'no-es-del-panel' | 'no-es-la-cabeza' | 'ya-revertido' | 'no-valida' | 'falló'; detalle: string }`.
  - `TRAILER_REVIERTE = 'Panel-Revierte'` exportado de `revertir.ts`.

- [ ] **Step 1: `gh.commit` tiene que devolver los padres**

Test, en `test/github.test.ts`:

```ts
it('commit devuelve su árbol, su mensaje y sus padres', async () => {
  const { f } = fetchFalso([
    {
      cuerpo: {
        sha: 'c1',
        tree: { sha: 't1' },
        message: 'cambia Línea de cierre\n\nPanel: sí',
        author: { date: '2026-09-17T12:00:00Z' },
        parents: [{ sha: 'p1' }],
      },
    },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  const c = await gh.commit('c1')
  expect(c.padres).toEqual(['p1'])
  expect(c.message).toContain('Panel: sí')
})
```

Implementación, en `src/servidor/github.ts`, en `commit`:

```ts
    /**
     * Los datos de un commit: su árbol, su mensaje, cuándo lo hizo su autor y
     * de quién viene. Los PADRES los necesita la reversión (`revertir.ts`):
     * volver atrás un commit es publicar lo que decían sus archivos en el
     * padre, así que sin el padre no hay a qué volver.
     */
    async commit(sha: string): Promise<{
      sha: string
      tree: string
      message: string
      author: { date: string }
      padres: string[]
    }> {
      const cuerpo = await pedir(`/git/commits/${sha}`) as {
        sha: string
        tree: { sha: string }
        message: string
        author: { date: string }
        parents?: Array<{ sha: string }>
      }
      return {
        sha: cuerpo.sha,
        tree: cuerpo.tree.sha,
        message: cuerpo.message,
        author: cuerpo.author,
        padres: (cuerpo.parents ?? []).map((p) => p.sha),
      }
    },
```

Run: `pnpm vitest run test/github.test.ts` → PASS.

- [ ] **Step 2: `Publicacion` acepta trailers extra**

Test, en `test/publicar.test.ts`:

```ts
it('los trailers extra salen después de los dos de siempre, uno por línea', async () => {
  const { f, pedidos } = fetchFalso([...respuestasDeUnaPublicacionCompleta()])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  await publica(gh, {
    archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }],
    autor: 'ella@ejemplo.mx',
    trailers: { 'Panel-Revierte': 'abc123' },
  })
  const creaCommit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
  expect((creaCommit.cuerpo as { message: string }).message).toBe(
    'Actualiza contenido del panel\n\nPanel: sí\nPanel-Autor: ella@ejemplo.mx\nPanel-Revierte: abc123',
  )
})
```

Implementación, en `src/servidor/publicar.ts`. En la interfaz:

```ts
  /**
   * Líneas extra del cuerpo del commit, después de `Panel: sí` y
   * `Panel-Autor:`. Hoy la usa una sola cosa —`Panel-Revierte: <sha>`, que es
   * cómo la reversión automática se reconoce a sí misma para no revertir dos
   * veces el mismo commit— y por eso vive acá y no como un campo con nombre
   * propio: el próximo trailer no debería pedir tocar esta interfaz otra vez.
   */
  trailers?: Record<string, string>
```

Y donde se arma el mensaje:

```ts
  const extras = Object.entries(p.trailers ?? {}).map(([k, v]) => `${k}: ${v}`)
  const mensaje = [`${asunto}`, '', 'Panel: sí', `Panel-Autor: ${p.autor}`, ...extras].join('\n')
```

Run: `pnpm vitest run test/publicar.test.ts` → PASS.

- [ ] **Step 3: Escribí los tests de `revertir.ts`**

Crear `test/revertir.test.ts`:

```ts
/*
 * Volver atrás un commit del panel.
 *
 * Es un commit NUEVO con el contenido VIEJO (spec §4.6), nunca un `reset` ni
 * un `force`: la historia no se reescribe. Lo usan dos cosas con la misma
 * mecánica y distinto disparador — la reversión automática cuando el deploy
 * falla, y el botón «Deshacer» de los 30 minutos.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { cliente } from '../src/servidor/github'
import { revierte, TRAILER_REVIERTE } from '../src/servidor/revertir'

const gh = (f: typeof globalThis.fetch) => cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
const SHA = 'a'.repeat(40)

describe('revertir un commit del panel', () => {
  it('se niega si el commit NO es del panel', async () => {
    // Revertir un commit de Marcos desde acá sería que el panel deshaga
    // trabajo que no publicó. Nunca.
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'fix: algo a mano', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'p' }] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: false, motivo: 'no-es-del-panel', detalle: expect.any(String) })
    expect(pedidos.every((p) => p.metodo === 'GET')).toBe(true)
  })

  it('B8: se niega si el commit ya no es la cabeza', async () => {
    const { f } = fetchFalso([{ cuerpo: { object: { sha: 'otraCabeza' } } }])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect((r as { motivo: string }).motivo).toBe('no-es-la-cabeza')
  })

  it('es idempotente: si la cabeza ya revierte ese sha, no hace nada', async () => {
    // Dos invocaciones de `estado` en paralelo pueden ver el mismo fracaso.
    // Sin esto, las dos revierten y la segunda deshace la reversión de la
    // primera — o sea, vuelve a dejar el commit malo.
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'cabezaQueYaRevirtio' } } },
      {
        cuerpo: {
          sha: 'cabezaQueYaRevirtio',
          tree: { sha: 't' },
          message: `Deshace un cambio\n\nPanel: sí\nPanel-Autor: x\n${TRAILER_REVIERTE}: ${SHA}`,
          author: { date: '2026-09-17T12:00:00Z' },
          parents: [{ sha: SHA }],
        },
      },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect((r as { motivo: string }).motivo).toBe('ya-revertido')
    expect(pedidos.every((p) => p.metodo === 'GET')).toBe(true)
  })

  it('publica el contenido del padre y marca el commit con el trailer', async () => {
    const viejo = '{"footer":{"derechos":"lo de antes"}}'
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },                                                         // ref
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'cambia Línea de cierre\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [{ filename: 'src/contenido/datos/sitio.json' }] } },                      // comparaRefs padre..sha
      { cuerpo: { content: Buffer.from(viejo).toString('base64'), encoding: 'base64', sha: 'b' } }, // archivoEnRef en el padre
      ...respuestasDeUnaPublicacionCompleta(),
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r.ok).toBe(true)
    const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
    expect(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8')).toBe(viejo)
    const commit = pedidos.find((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')!
    expect((commit.cuerpo as { message: string }).message).toContain(`${TRAILER_REVIERTE}: ${SHA}`)
  })

  it('un commit del panel que no tocó contenido no tiene nada que revertir', async () => {
    const { f } = fetchFalso([
      { cuerpo: { object: { sha: SHA } } },
      { cuerpo: { sha: SHA, tree: { sha: 't' }, message: 'algo\n\nPanel: sí', author: { date: '2026-09-17T12:00:00Z' }, parents: [{ sha: 'padre' }] } },
      { cuerpo: { files: [] } },
    ])
    const r = await revierte(gh(f), { sha: SHA, autor: 'ella@ejemplo.mx' })
    expect(r).toEqual({ ok: true, sha: null, revirtio: SHA })
  })
})
```

`respuestasDeUnaPublicacionCompleta()` es el ayudante de `test/publicar.test.ts`;
si no está exportado, copiá su forma o movelo a `test/lib/github-falso.ts` — pero
movelo, no lo dupliques.

- [ ] **Step 4: Corré y verificá que fallan**

Run: `pnpm vitest run test/revertir.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 5: Escribí `src/servidor/revertir.ts`**

```ts
/*
 * Volver atrás un commit del panel.
 *
 * Es un commit NUEVO con los blobs VIEJOS (spec §4.6). Nunca un `reset`,
 * nunca un `force`, nunca reescribir la historia: el historial tiene que
 * poder contar que hubo un cambio y que se deshizo, porque eso es justamente
 * lo que la clienta va a querer entender después.
 *
 * Dos cosas lo usan, con la misma mecánica y distinto disparador:
 *   - la reversión AUTOMÁTICA, cuando el despliegue del commit falla;
 *   - el botón «Deshacer esta publicación» de los 30 minutos.
 *
 * Y las dos pasan por la misma validación que cualquier publicación: el
 * contenido viejo puede no pasar las reglas de HOY (el esquema cambió, un
 * campo nuevo se volvió obligatorio). Por eso no se toma ningún atajo del
 * tipo «como ya estuvo publicado, es válido».
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe el cliente ya armado.
 */
import { cliente } from './github'
import { publica, type Archivo } from './publicar'
import { validarContra } from '../contenido/validacion'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'

/**
 * La marca que deja un commit de reversión en su propio cuerpo. Es lo que
 * hace que revertir sea IDEMPOTENTE sin guardar estado en ningún lado: dos
 * invocaciones que ven el mismo fracaso al mismo tiempo miran la cabeza, la
 * segunda encuentra esta línea, y se va sin hacer nada. Sin esto, la segunda
 * revertiría la reversión — o sea, volvería a dejar el commit malo.
 */
export const TRAILER_REVIERTE = 'Panel-Revierte'

/** La marca que el panel le pone a todo lo que publica (`publicar.ts`). */
const TRAILER_PANEL = 'Panel: sí'

export type ResultadoReversion =
  | { ok: true; sha: string | null; revirtio: string }
  | { ok: false; motivo: 'no-es-del-panel' | 'no-es-la-cabeza' | 'ya-revertido' | 'no-valida' | 'falló'; detalle: string }

const RUTA_DEL_DOCUMENTO = (id: IdDocumento): string => `src/contenido/datos/${id}.json`
const DOCUMENTO_DE_RUTA = new Map<string, IdDocumento>(
  (Object.keys(DOCUMENTOS) as IdDocumento[]).map((id) => [RUTA_DEL_DOCUMENTO(id), id]),
)

export async function revierte(
  gh: ReturnType<typeof cliente>,
  p: { sha: string; autor: string; bytesDelCuerpo?: number },
): Promise<ResultadoReversion> {
  const cabeza = await gh.ref('heads/main')

  // [B8] Solo se deshace la CABEZA. Deshacer un commit del medio es resolver
  // un merge de contenido, y este camino es el del arrepentimiento inmediato
  // («un 1300 en vez de 130, se ve a los veinte segundos»), no el del
  // historial. Se chequea ANTES de leer nada más: si no es la cabeza, no hay
  // razón para gastar un pedido.
  if (cabeza.sha !== p.sha) {
    const cabezaCommit = await gh.commit(cabeza.sha)
    // …salvo que la cabeza SEA la reversión de este mismo sha. Ahí no es un
    // error: es que alguien ya lo hizo, y la respuesta correcta es «listo»,
    // no «no se puede».
    if (cabezaCommit.message.includes(`${TRAILER_REVIERTE}: ${p.sha}`)) {
      return { ok: false, motivo: 'ya-revertido', detalle: `${cabeza.sha} ya revierte ${p.sha}` }
    }
    return { ok: false, motivo: 'no-es-la-cabeza', detalle: `la cabeza es ${cabeza.sha}` }
  }

  const commit = await gh.commit(p.sha)

  // El panel no deshace lo que no publicó. Un commit de Marcos, hecho a mano,
  // no se toca desde acá ni aunque el despliegue haya fallado por su culpa.
  if (!commit.message.includes(TRAILER_PANEL)) {
    return { ok: false, motivo: 'no-es-del-panel', detalle: `${p.sha} no lleva «${TRAILER_PANEL}»` }
  }

  const padre = commit.padres[0]
  if (!padre) {
    return { ok: false, motivo: 'falló', detalle: `${p.sha} no tiene padre` }
  }

  // Qué rutas tocó ESE commit. Solo se revierten las de contenido: si alguna
  // vez un commit del panel tocara otra cosa, revertirla sería tocar código
  // desde acá, que es exactamente lo que la lista blanca existe para impedir.
  const { archivos: tocadas } = await gh.comparaRefs(padre, p.sha)
  const documentos = tocadas.flatMap((ruta) => {
    const id = DOCUMENTO_DE_RUTA.get(ruta)
    return id ? [{ ruta, id }] : []
  })

  if (documentos.length === 0) {
    return { ok: true, sha: null, revirtio: p.sha }
  }

  const archivos: Archivo[] = []
  for (const { ruta, id } of documentos) {
    const viejo = await gh.archivoEnRef(ruta, padre)
    // Misma revalidación que cualquier publicación: el contenido de ayer
    // puede no pasar las reglas de hoy. Si no pasa, no se publica a la
    // fuerza — quien llamó decide qué hacer (el spec §4.6 dice que el panel
    // se lo ofrece como borrador).
    const problemas = validarContra(DOCUMENTOS[id], JSON.parse(viejo))
    if (problemas.length > 0) {
      return { ok: false, motivo: 'no-valida', detalle: `${ruta}: ${problemas[0].titulo}` }
    }
    archivos.push({ ruta, contenido: viejo })
  }

  const resultado = await publica(gh, {
    archivos,
    autor: p.autor,
    trailers: { [TRAILER_REVIERTE]: p.sha },
    ...(p.bytesDelCuerpo !== undefined ? { bytesDelCuerpo: p.bytesDelCuerpo } : {}),
  })

  if (!resultado.ok) return { ok: false, motivo: 'falló', detalle: resultado.problema }
  return { ok: true, sha: resultado.sha, revirtio: p.sha }
}
```

**Ojo con la validación de `sitio`:** ese documento tiene cinco campos
derivados que `serializa()` no escribe, así que validarlo crudo lo rechaza —
es el bug que encontró el humo de producción. Acá **no hace falta injertarlos**
porque el texto que se lee del padre es el archivo tal cual, y `validarContra`
sobre él fallaría igual. Antes de dar el paso por terminado, **corré el caso
real**: revertí a mano un commit de prueba que toque `sitio.json` en un test que
lea el archivo de verdad del repo, y si falla, injertá igual que hace
`publicarAccion` (con `fuentesDeSabores` del `sabores.json` del mismo padre).
Este párrafo está acá justamente porque el mismo error ya pasó una vez.

- [ ] **Step 6: Corré y verificá que pasan**

Run: `pnpm vitest run test/revertir.test.ts`
Expected: PASS los cinco.

- [ ] **Step 7: Enganchá la reversión automática en `estadoAccion`**

Test, en `test/acciones.test.ts`:

```ts
it('cuando el despliegue falla, revierte y avisa a las dos personas', async () => {
  const cartas: Array<{ a: string[]; asunto: string }> = []
  const sha = 'a'.repeat(40)
  const { f } = fetchFalso([
    { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
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
  // Uno a ella, con su frase; uno a Marcos, con el detalle.
  expect(cartas).toHaveLength(2)
  expect(cartas[0].a).toEqual(['quien@ejemplo.mx'])   // el correo de la sesión de prueba
  expect(cartas[1].a).toEqual(['marcos@ejemplo.mx'])
})

it('si el correo no está configurado, la reversión igual pasa', async () => {
  // B3: el aviso degrada, la reversión no. Lo importante es que el sitio
  // quede sano; el correo es para que ella se entere sin estar mirando.
  const sha = 'a'.repeat(40)
  const { f } = fetchFalso([
    { cuerpo: { deployments: [{ state: 'ERROR', url: null }] } },
    ...respuestasDeUnaReversionCompleta(sha),
  ])
  const r = await maneja(
    'estado',
    { cuerpo: { sha, publicadoEn: 1_000 }, cookie: cookieValida() },
    contextoDePrueba({ fetch: f, ahora: () => 6_000, correo: async () => ({ ok: false, motivo: 'sin-configurar' as const }) }),
  )
  expect((r.cuerpo as { estado: string }).estado).toBe('falló')
})
```

Implementación: en `estadoAccion`, después de calcular el veredicto y antes de
devolverlo:

```ts
  // [B1] La reversión automática la hace la invocación que VE el fracaso. No
  // hay ningún proceso sondeando: una función de la plataforma muere a los
  // 60 s y un despliegue tarda más. Si ella cerró el panel antes de que
  // fallara, esto no corre acá — corre en la próxima acción autenticada que
  // pase por `revisaLaCabeza()`.
  if (veredicto.estado === 'falló') {
    await revierteYAvisa(cuerpo.sha, sesion.correo, contexto)
  }
```

Y la función, al lado:

```ts
/**
 * Deshace un commit cuyo despliegue falló y avisa a las dos personas.
 *
 * Es `void` a propósito: lo que sale por HTTP es el veredicto —«no salió; lo
 * dejé como estaba»—, que ya es verdad haya podido revertir o no (el sitio
 * sigue sirviendo el último despliegue bueno; esa es la capa 3 de la
 * compuerta). Si la reversión falla, eso es un problema de Marcos, no de
 * ella: va entero al log y al correo de él.
 *
 * [B3] El correo degrada: que no esté configurado no puede impedir que el
 * repo vuelva a estar sano.
 */
async function revierteYAvisa(sha: string, correoDeElla: string, contexto: Contexto): Promise<void> {
  const gh = cliente({
    token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
    duenio: contexto.env.GITHUB_DUENIO ?? '',
    repo: contexto.env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  let resumen: string
  try {
    const r = await revierte(gh, { sha, autor: correoDeElla })
    resumen = r.ok ? `revertido (commit ${r.sha ?? 'sin cambios'})` : `NO se pudo revertir: ${r.motivo} — ${r.detalle}`
    if (!r.ok) console.error(`estado: la reversión automática de ${sha} no se pudo hacer — ${r.motivo}: ${r.detalle}`)
  } catch (e) {
    resumen = `NO se pudo revertir: ${e instanceof Error ? e.message : String(e)}`
    console.error(`estado: la reversión automática de ${sha} reventó —`, e)
  }

  // A ella: la misma frase que ve en pantalla, para que el correo y el panel
  // no cuenten dos historias distintas. Nada técnico (B10).
  await contexto.correo({
    a: [correoDeElla],
    asunto: 'Tu cambio no se pudo publicar',
    texto: 'No salió; lo dejé como estaba y ya le avisé a Marcos.\n\nPuedes volver a intentarlo cuando quieras.',
  })

  // A Marcos: todo. El sha, qué pasó con la reversión, y a dónde mirar.
  const paraMarcos = contexto.env.PANEL_AVISOS_A
  if (paraMarcos) {
    await contexto.correo({
      a: [paraMarcos],
      asunto: `[panel] El deploy de ${sha.slice(0, 7)} falló`,
      texto: [
        `El commit ${sha} publicado por ${correoDeElla} no construyó.`,
        `Reversión automática: ${resumen}.`,
        '',
        'El sitio sigue sirviendo el último deploy bueno.',
      ].join('\n'),
    })
  }
}
```

Sumá los imports de `revierte` y `TRAILER_REVIERTE` (de `./revertir`), `cliente`
(de `./github`), y `Carta`/`ResultadoCorreo` (de `./correo`) si todavía no están.

- [ ] **Step 8: Corré y verificá que pasan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: PASS.

- [ ] **Step 9: La red de seguridad — revertir aunque ella haya cerrado el panel**

Test:

```ts
it('B1: cualquier acción autenticada revierte primero una cabeza rota que quedó colgada', async () => {
  // Ella publicó, cerró el panel, y el deploy falló diez minutos después.
  // Nadie sondeó. La próxima vez que ALGUIEN entre, lo primero que pasa es
  // que el sitio se arregla.
  ...
})
```

Implementación: una función `revisaLaCabeza(contexto)` que corre al principio de
`estadoAccion`, `historialAccion` (Tarea 10) y `publicarAccion`:

```ts
/**
 * [B1] La red de seguridad del revert automático.
 *
 * `estadoAccion` revierte cuando VE el fracaso, pero eso exige que alguien
 * esté mirando. Si ella publicó y guardó el teléfono —que es lo que el spec
 * §4.5 dice que va a hacer, y tiene razón—, el fracaso ocurre con el panel
 * cerrado y nadie lo ve. Entonces lo primero que hace cualquier acción
 * autenticada es preguntar si la cabeza de `main` es un commit del panel cuyo
 * despliegue falló, y si lo es, arreglarlo ANTES de hacer lo suyo.
 *
 * El costo de estar equivocado es un pedido de más a la plataforma por acción.
 * El costo de no tenerlo es que el commit malo se quede en `main` y la próxima
 * publicación falle sin que ella haya tocado nada — el WhatsApp que el panel
 * viene a matar.
 */
async function revisaLaCabeza(contexto: Contexto, correoDeQuienPide: string): Promise<void> {
  // Todo lo de acá adentro es "mejor esfuerzo": si algo falla, se loguea y se
  // sigue. Esta función NUNCA puede hacer fallar la acción que la llamó — sería
  // impedirle publicar por culpa de una limpieza que ni pidió.
  try {
    if (!contexto.env.PANEL_VERCEL_TOKEN) return

    const gh = cliente({
      token: contexto.env.PANEL_GITHUB_TOKEN ?? '',
      duenio: contexto.env.GITHUB_DUENIO ?? '',
      repo: contexto.env.GITHUB_REPO ?? '',
      fetch: contexto.fetch,
    })

    const cabeza = await gh.ref('heads/main')
    const commit = await gh.commit(cabeza.sha)

    // Solo los commits del panel, y solo los que no son ya una reversión: sin
    // el segundo chequeo, un revert cuyo propio deploy falla se revertiría a sí
    // mismo, y así para siempre.
    if (!commit.message.includes('Panel: sí')) return
    if (commit.message.includes(`${TRAILER_REVIERTE}: `)) return

    const vercel = clienteVercel({
      token: contexto.env.PANEL_VERCEL_TOKEN,
      proyecto: contexto.env.PANEL_VERCEL_PROYECTO ?? 'maracacao',
      fetch: contexto.fetch,
    })
    const { estado } = await vercel.despliegueDe(cabeza.sha)
    if (estado !== 'falló') return

    console.error(`revisaLaCabeza: ${cabeza.sha} es un commit del panel cuyo despliegue falló — revirtiendo.`)
    await revierteYAvisa(cabeza.sha, correoDeQuienPide, contexto)
  } catch (e) {
    console.error('revisaLaCabeza: no se pudo revisar la cabeza de main —', e)
  }
}
```

**Dónde se llama:** como PRIMERA cosa de `estadoAccion`, `historialAccion`
(Tarea 10) y `publicarAccion`, después de validar la sesión y antes de hacer
nada más. En `publicarAccion` tiene que correr **antes** del chequeo de `base`
(Tarea 2): si la cabeza está rota y se revierte, la cabeza cambia, y comparar
contra la vieja daría un 409 por un commit que acaba de dejar de existir.

- [ ] **Step 9b: Los once arreglos que salieron de la revisión**

La revisión de esta tarea la hizo un modelo capaz contra un GitHub de mentira
**con estado** —grafo de commits, árboles reales, un `PATCH` que aplica
fast-forward de verdad— y encontró once cosas. Casi todas son defectos del
diseño de este brief, no de la transcripción. Van todas en una ronda, agrupadas
por lo que de verdad arreglan.

**A · La guardia que vivía en el lugar equivocado (Critical).**
`revierte()` no se niega a revertir **una reversión**: esa guardia existe solo
en el llamador. Medido: con la cabeza siendo una reversión de `MALO`,
`revierte()` devuelve `ok` y **resucita el `sitio.json` malo**, en un commit
nuevo que además lleva su propio trailer — así que nadie lo va a volver a
revertir. Hoy no es alcanzable desde la UI, pero las Tareas 9 y 10 le van a
pasar más shas a esta función.

Mové el chequeo adentro de `revierte()`, justo después de la guardia de
«¿es del panel?»:

```ts
  // Una reversión no se revierte: eso republica exactamente el contenido que
  // se acaba de declarar roto, y encima en un commit que lleva su propio
  // trailer, así que la red de seguridad no lo va a tocar nunca más. La
  // guardia vive ACÁ y no solo en el llamador: una invariante que depende de
  // que todos los llamadores se acuerden no es una invariante, y esta función
  // va a tener llamadores nuevos en las dos tareas siguientes.
  if (commit.message.includes(`${TRAILER_REVIERTE}: `)) {
    return { ok: false, motivo: 'ya-revertido', detalle: `${p.sha} ya es una reversión` }
  }
```

**B · Los avisos: quién le habla a quién (3 Important juntos).**
Medido: en el camino **normal** —ella publica, su commit es la cabeza, el panel
sondea por ese sha— salen **cuatro** correos, dos idénticos a ella. Con tres
reintentos sobre una cabeza que no se puede arreglar, **seis**. Y peor: la red
de seguridad le manda «Tu cambio no se pudo publicar» **a quien entró al
panel**, no a quien publicó — si Marcos entra, recibe un correo diciéndole que
su cambio falló, por un cambio de ella, con un texto técnico que le atribuye el
commit a él.

No se arregla deduplicando sino repartiendo el trabajo:

- **`revisaLaCabeza()` le avisa SOLO a Marcos.** Es la red de seguridad: limpia
  algo que quedó colgado de antes, y eso es asunto de él. Nadie está mirando.
- **`estadoAccion` es el único que le habla a ella**, porque es el único momento
  en que ella está esperando el resultado de SU publicación.
- **El autor real sale del trailer `Panel-Autor:`** del commit, que
  `revisaLaCabeza()` ya leyó dos líneas antes — nunca de quién hizo el pedido.

`revieteYAvisa` se parte en dos: `revierteYAvisaAMarcos(sha, contexto)` (la que
usa la red de seguridad, que saca el autor del trailer) y el camino de
`estadoAccion`, que además le escribe a ella. Y `revisaLaCabeza()` devuelve el
sha que atendió, para que `estadoAccion` no vuelva a revertir ni a avisar por el
mismo:

```ts
async function revisaLaCabeza(contexto: Contexto): Promise<string | null>
```

**C · La red de seguridad corría demasiado temprano (Important).**
Medido: el test «con sesión válida y sin documentos, 400 **sin tocar GitHub**»
ahora SÍ toca GitHub, y sigue verde solo porque `revisaLaCabeza()` se traga el
error del `fetch` que el test puso justamente para que nadie lo llamara. Un test
que ya no puede ver lo que promete.

`revisaLaCabeza()` pasa a correr **después** de las validaciones baratas y
sincrónicas —lote vacío, documento desconocido, `base` ausente— y **antes** de
la comparación de `base` (que tiene que ver la cabeza ya arreglada). No cuesta
nada y devuelve al test su capacidad de fallar.

**D · Un «revertido» que no revirtió nada (Important).**
Un commit del panel que no tocó documentos de contenido devuelve
`{ ok: true, sha: null }`, y a Marcos le llega «Reversión automática:
**revertido**» mientras `main` sigue con el commit roto. Hoy no es alcanzable;
cuando la fase 7 publique imágenes, sí. Agregá un motivo propio
(`'nada-que-revertir'`) y que el correo lo diga con esas palabras.

**E · El reintento de `publica()` se come un commit ajeno (Important).**
Medido: si Marcos publica a mano entre que la reversión lee el ref y mueve el
ref, el `PATCH` rebota, el reintento rearma el árbol **sobre el commit de él,
con los bytes viejos**, y su cambio desaparece sin 409 y sin log. En
`publicarAccion` eso lo cubre el chequeo de `base`; `revierte()` no tiene
equivalente, y ahora corre sin que nadie lo pida.

`Publicacion` gana `reintentar?: boolean` (default `true`, así nada cambia para
quien ya la usa) y `revierte()` pasa `reintentar: false`. Si el ref se movió,
devuelve `no-es-la-cabeza` y la próxima acción reevalúa desde cero — que es lo
correcto para algo idempotente, y mucho más seguro que insistir a ciegas.

**F · Y seis cosas chicas, todas de una línea:**

1. **El literal del proyecto.** `revisaLaCabeza()` resuelve el nombre con
   `'maracacao'` a mano mientras la acción vecina usa
   `PANEL_VERCEL_PROYECTO ?? GITHUB_REPO` con guardia. No es cosmético: si
   alguna vez divergen, la plataforma contesta «no hay despliegues», el código
   sale por `estado !== 'falló'`, y **la reversión automática deja de existir
   sin una sola línea de log**. Misma expresión que el vecino, más un
   `console.error` si queda vacía.
2. **Los dos `await contexto.correo(...)` de la reversión están fuera del
   `try`.** Hoy `manda()` no tira (ruling T6-2), pero eso es una promesa de otro
   módulo sosteniendo la de éste. El mismo `try` de una línea sale gratis.
3. **`JSON.parse(viejo)` sin guardia**: un documento viejo ilegible hace que
   `revierte()` TIRE en vez de devolver `{ ok: false, motivo: 'falló' }`, que es
   lo que su propio tipo promete.
4. **Los trailers se buscan como substring, no como línea.** Un commit escrito a
   mano que cite «Panel: sí» en su cuerpo pasa por commit del panel. Anclalos
   por línea.
5. **La copia nueva para la clienta no tiene test contra `JERGA_PROHIBIDA`**, a
   diferencia de las frases de `estado`. El texto de hoy está bien; nada protege
   a la próxima edición.
6. **Cada arreglo de arriba va con su test.** Los de A, B, D y E son los que más
   importan: son comportamiento, no forma.

- [ ] **Step 9c: Lo que la re-revisión encontró abierto**

Los once arreglos del paso anterior quedaron verificados —con mutación de
control incluida— pero aparecieron cinco cosas más, dos de ellas serias.

**1 (Important) · El arreglo del Grupo C se aplicó a una sola de las dos
acciones.** `publicarAccion` ahora corre `revisaLaCabeza()` después de sus
validaciones baratas; `estadoAccion` no. Su comentario afirma que «no tiene
ningún chequeo sincrónico previo» y es **falso**: tiene el 400 por `sha` mal
formado, el 503 por token ausente y el 503 por proyecto sin nombre. Medido: un
`sha` mal formado gasta **un pedido real a GitHub** antes de contestar 400.

Y hay algo peor, que cierra un círculo: el test `T7-2` —el que exigí en la
tarea anterior justamente para que la guardia del proyecto no quedara sin
candado— **pasa hoy por la misma razón podrida que el ruling T7-5**:
`fetchFalso([])` tira, `revisaLaCabeza()` se traga la excepción en su propio
`try`, y el pedido nunca se registra. Mismo arreglo que en `publicarAccion`:
mover `revisaLaCabeza(contexto)` debajo del bloque de validaciones sincrónicas
de `estadoAccion`, y corregir ese comentario.

**2 (Important) · El envío protegido atrapa el fracaso imposible y deja mudo el
real.** `mandaProtegido()` envuelve el envío en un `try` —que atrapa que
`manda()` tire, cosa que el ruling T6-2 volvió imposible— y **descarta el
resultado**. `manda()` documenta explícitamente que el detalle lo loguea quien
llama, «que sí lo sabe», y quien llama no lo loguea. O sea: `sin-configurar` y
`rechazado` pasan sin dejar rastro. Cuando el despliegue falla con nadie
mirando, ese correo es la única señal que tiene Marcos.

```ts
  const r = await contexto.correo(carta)
  if (!r.ok) {
    console.error(`aviso: no se pudo mandar «${carta.asunto}» a ${carta.a.join(', ')} — ${r.motivo}`)
  }
```

**3 (Minor) · El otro camino de aviso sigue atribuyendo mal.** `revierteYAvisa()`
usa `sesion.correo` como `Panel-Autor:` del commit de reversión y como el
«publicado por X» del correo. Es el mismo error que B-3 arregló en la red de
seguridad, en el camino de al lado, y el trailer ya está leído dos líneas antes.

**4 (Minor) · `'Panel: sí'` está escrito dos veces.** `revertir.ts` tiene
`TRAILER_PANEL` sin exportar y `acciones.ts` repite el literal — justo en la
guardia que decide si el panel puede escribir en `main`. Exportala y usala en
los dos lados.

**5 (Minor) · El test de tres líneas del fallback de autor.** Y corregí la
afirmación de que el caso es «hoy inalcanzable»: no lo es. Desde que los
trailers se anclan por línea, un commit escrito a mano cuyo cuerpo contenga la
línea `Panel: sí` —copiar el mensaje de un commit del panel, un cherry-pick—
pasa la guardia sin traer `Panel-Autor:`. `autorDelCommit` es pura y exportada,
así que el test cuesta tres líneas.

**Lo que NO se arregla, y queda anotado:** con la cabeza irrecuperable, un
recargue manual de la pestaña vuelve a disparar el par de correos. El diseño ya
decidió repartir en vez de deduplicar, y `reintentarEn: null` evita que el panel
insista solo. Se acepta.

- [ ] **Step 10: Corré la suite entera, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/github.ts src/servidor/publicar.ts src/servidor/revertir.ts src/servidor/acciones.ts api/panel.js test/github.test.ts test/publicar.test.ts test/revertir.test.ts test/acciones.test.ts
git commit -m "feat: si el despliegue falla, el sitio se arregla solo y los dos se enteran"
```

---

### Task 9: `accion=deshacer` — treinta minutos para arrepentirse con una mano

Spec §4.6: «un `1300` en vez de `130` es un número perfectamente válido, se ve a
los veinte segundos, y hay que poder volver con una mano, parada». El esquema no
lo puede atajar —`1300` pasa todas las reglas— y el medidor tampoco. Lo único
que lo ataja es que ella lo vea y pueda deshacerlo sin pensar.

La mecánica ya existe (Tarea 8): esto es la puerta HTTP, la ventana de tiempo y
las frases.

**Files:**
- Modify: `src/servidor/acciones.ts` (acción `deshacer` + router)
- Test: `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Consumes: `revierte` (Tarea 8), `sesionVigente` (Tarea 3).
- Produces: `POST /api/panel?accion=deshacer` con cuerpo `{ sha }` →
  `{ ok: true, sha, resumen }` o un error con frase.
- `VENTANA_DESHACER_MS = 30 * 60_000` exportado de `acciones.ts` (la fase 6 lo
  necesita para saber cuándo esconder el botón).

- [ ] **Step 0: Arreglá `fetchFalso` para que «cero pedidos» signifique algo**

[RULING T7-5] Varios tests de este plan —incluidos los de esta tarea— afirman
«no se gastó ni un pedido» con `expect(pedidos).toHaveLength(0)`. **Ese assert
hoy no prueba nada**, y está medido: `fetchFalso([])` tira su error de «se pidió
una respuesta de más» ANTES de hacer `pedidos.push(...)`, así que la lista queda
en cero tanto si el código frenó antes de la red como si la intentó. Parece un
candado y es decoración.

Se arregla en la raíz, en `test/lib/github-falso.ts`: registrar el intento
**antes** de decidir si hay respuesta programada.

```ts
  const f = async (url: string | URL, init?: RequestInit) => {
    // El intento se registra ANTES de mirar si hay respuesta programada: si se
    // registrara después, un pedido que cae en el error de «scripteó de menos»
    // quedaría sin rastro, y todos los `expect(pedidos).toHaveLength(0)` de la
    // suite darían cero tanto si el código frenó antes de la red como si la
    // intentó. Parecerían candados y serían decoración.
    pedidos.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      cabeceras: (init?.headers ?? {}) as Record<string, string>,
    })

    if (i >= respuestas.length) {
      throw new Error(
        `fetchFalso(): se pidió una respuesta más de las ${respuestas.length} programadas ` +
          `(pedido #${i + 1}, ${init?.method ?? 'GET'} ${String(url)}) — el test scripteó de menos.`,
      )
    }
    const r = respuestas[i++]
    return new Response(JSON.stringify(r.cuerpo), { status: r.status ?? 200 })
  }
```

**Corré la suite entera después de este cambio, antes de seguir.** Es un ayudante
compartido: si algún test existente contaba pedidos y ahora cuenta uno más, ese
test estaba midiendo lo que no creía y hay que mirarlo de verdad, no acomodar el
número. Si aparece alguno así, decilo en el reporte con su nombre.

- [ ] **Step 1: Escribí los tests que fallan**

```ts
describe('accion=deshacer', () => {
  it('deshace la última publicación y devuelve el resumen', async () => {
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([...respuestasDeUnaReversionCompleta(sha, { hace: 60_000 })])
    const r = await maneja('deshacer', { cuerpo: { sha }, cookie: cookieValida() }, contextoDePrueba({ fetch: f }))
    expect(r.status).toBe(200)
    expect((r.cuerpo as { resumen: string }).resumen).toBe('Listo, lo dejé como estaba antes.')
  })

  it('pasados los 30 minutos, ya no se puede: manda al historial', async () => {
    // No es una limitación técnica —el commit sigue ahí— sino la línea entre
    // «me equivoqué recién» y «quiero volver a una versión vieja», que son
    // dos gestos distintos con dos pantallas distintas (spec §4.6).
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([...respuestasDeUnaReversionCompleta(sha, { hace: 31 * 60_000 })])
    const r = await maneja('deshacer', { cuerpo: { sha }, cookie: cookieValida() }, contextoDePrueba({ fetch: f }))
    expect(r.status).toBe(409)
    expect((r.cuerpo as { problema: string }).problema).toBe(
      'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.',
    )
  })

  it('B8: si ya publicó otra cosa encima, tampoco: manda al historial', async () => {
    const { f } = fetchFalso([{ cuerpo: { object: { sha: 'otraCabeza' } } }, { cuerpo: commitCualquiera() }])
    const r = await maneja('deshacer', { cuerpo: { sha: 'a'.repeat(40) }, cookie: cookieValida() }, contextoDePrueba({ fetch: f }))
    expect(r.status).toBe(409)
  })

  it('si el contenido viejo ya no pasa las reglas de hoy, lo dice y ofrece el borrador', async () => {
    // El esquema pudo haber cambiado entre medio. Publicar a la fuerza
    // rompería el sitio; callarse dejaría a la clienta apretando un botón
    // que no hace nada.
    const sha = 'a'.repeat(40)
    const { f } = fetchFalso([...respuestasDeUnaReversionQueNoValida(sha)])
    const r = await maneja('deshacer', { cuerpo: { sha }, cookie: cookieValida() }, contextoDePrueba({ fetch: f }))
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
})
```

- [ ] **Step 2: Corré y verificá que fallan**

Run: `pnpm vitest run test/acciones.test.ts`
Expected: FAIL — `deshacer` contesta 404.

- [ ] **Step 3: Implementá la acción**

```ts
/**
 * Cuánto dura el botón «Deshacer esta publicación» (spec §4.6).
 *
 * No es una limitación técnica: el commit sigue ahí para siempre y el
 * historial lo puede revertir cuando sea. Es la línea entre dos gestos
 * distintos —«me equivoqué recién, sacalo» y «quiero volver a una versión
 * vieja»— que merecen dos pantallas distintas, porque el primero se hace con
 * una mano, parada en un mercado, y el segundo se hace sentada y mirando.
 *
 * Exportada porque la fase 6 la necesita para saber cuándo dejar de dibujar
 * el botón: el servidor y la pantalla tienen que estar de acuerdo en cuándo
 * se apaga, o ella lo va a apretar y va a recibir un error.
 */
export const VENTANA_DESHACER_MS = 30 * 60_000

const RESUMEN_DESHECHO = 'Listo, lo dejé como estaba antes.'
const PROBLEMA_TARDE = 'Ya pasó mucho tiempo para deshacer esto desde aquí. Búscalo en el historial de cambios.'
const PROBLEMA_NO_VALIDA = 'Ese contenido ya no cumple con las reglas de hoy. Puedo abrírtelo como borrador para que lo ajustes.'
const PROBLEMA_NO_ES_TUYO = 'Ese cambio no se publicó desde aquí, así que no lo puedo deshacer.'

/**
 * `deshacer`: volver atrás la última publicación (spec §4.6).
 *
 * La mecánica entera vive en `revertir.ts`; lo que agrega esta función es la
 * VENTANA de tiempo y las frases. La ventana se chequea acá y no allá a
 * propósito: media hora es una regla de producto —dónde termina «me equivoqué
 * recién» y empieza «quiero volver a una versión vieja»— y `revertir.ts`, que
 * también sirve al revert automático, no tiene por qué conocerla.
 */
async function deshacerAccion(pedido: Pedido, contexto: Contexto): Promise<Respuesta> {
  const env = contexto.env
  if (!secretoUtilizable(env)) {
    console.error('deshacer: PANEL_SECRETO falta o mide menos de 32 caracteres.')
    return error(503, PROBLEMA_INESPERADO)
  }

  const sesion = sesionVigente(pedido.cookie, env, contexto.ahora())
  if (!sesion) return error(401, PROBLEMA_SESION)

  const cuerpo = (pedido.cuerpo ?? {}) as { sha?: unknown }
  if (typeof cuerpo.sha !== 'string' || !/^[0-9a-f]{40}$/.test(cuerpo.sha)) {
    return error(400, PROBLEMA_INESPERADO)
  }

  const gh = cliente({
    token: env.PANEL_GITHUB_TOKEN ?? '',
    duenio: env.GITHUB_DUENIO ?? '',
    repo: env.GITHUB_REPO ?? '',
    fetch: contexto.fetch,
  })

  // La ventana, antes de tocar nada más: si ya pasó, no hay razón para leer el
  // contenido viejo ni para armar nada.
  let publicadoEn: number
  try {
    const commit = await gh.commit(cuerpo.sha)
    publicadoEn = Date.parse(commit.author.date)
  } catch (e) {
    console.error(`deshacer: no se pudo leer el commit ${cuerpo.sha} —`, e)
    return error(502, PROBLEMA_NO_SE_PUDO_LEER)
  }

  if (!Number.isFinite(publicadoEn) || contexto.ahora() - publicadoEn > VENTANA_DESHACER_MS) {
    return error(409, PROBLEMA_TARDE)
  }

  const r = await revierte(gh, {
    sha: cuerpo.sha,
    autor: sesion.correo,
    bytesDelCuerpo: contexto.bytesDelCuerpo,
  })

  if (r.ok) return ok({ ok: true, sha: r.sha, resumen: RESUMEN_DESHECHO })

  switch (r.motivo) {
    // Desde donde ella lo mira, «ya publicaste otra cosa encima» y «pasó
    // mucho tiempo» son el mismo hecho: no se puede desde acá, andá al
    // historial. Dos frases distintas para eso serían dos formas de decir lo
    // mismo con más palabras.
    case 'no-es-la-cabeza':
      return error(409, PROBLEMA_TARDE)
    // Ya está deshecho. Decirle que falló sería mentirle sobre el estado del
    // sitio, que es lo único que ella quería saber.
    case 'ya-revertido':
      return ok({ ok: true, sha: null, resumen: RESUMEN_DESHECHO })
    case 'no-es-del-panel':
      return error(403, PROBLEMA_NO_ES_TUYO)
    case 'no-valida':
      console.error(`deshacer: el contenido viejo de ${cuerpo.sha} no pasa las reglas de hoy — ${r.detalle}`)
      return error(422, PROBLEMA_NO_VALIDA)
    default:
      console.error(`deshacer: falló la reversión de ${cuerpo.sha} — ${r.detalle}`)
      return error(502, 'No pudimos publicar: hubo un problema para conectarnos con el sitio. Prueba de nuevo en unos minutos.')
  }
}

Y en el `switch`: `case 'deshacer': return await deshacerAccion(pedido, contexto)`.

- [ ] **Step 3b: Lo que salió de la revisión**

**1 (Important) · `nada-que-revertir` cae en la frase equivocada.** Hoy ese
motivo y `falló` terminan los dos en «No pudimos publicar: hubo un problema para
conectarnos con el sitio. Prueba de nuevo en unos minutos». Para `falló` está
bien. Para el otro es **engañosa**: «no tocó ningún documento de contenido» es
un hecho permanente de ese commit, no una falla de conexión — reintentar no lo
va a arreglar nunca, y va a dar el mismo error para siempre.

Escenario, cuando la fase 7 publique imágenes: ella publica una foto, aprieta
«Deshacer» adentro de la ventana, recibe «hubo un problema para conectarnos»,
reintenta tres veces con el mismo resultado, y termina escribiéndole a Marcos
convencida de que el sitio está caído. El camino interno del revert automático
ya trata este motivo como un tercer resultado con su propia frase; el botón
tiene que hacer lo mismo:

```ts
const PROBLEMA_NADA_QUE_DESHACER =
  'Esa publicación no cambió ningún dato del sitio, así que no hay nada que deshacer.'
```

con su propio caso en el `switch` (409, no 502: no es un error nuestro).

**2 (Important) · La guardia contra una fecha ilegible no tiene test.**
Verificado por mutación: sacando el `!Number.isFinite(publicadoEn) ||`, **los 65
tests siguen verdes**. El código de hoy es correcto, pero nada impide que un
refactor reintroduzca el bug clásico de JavaScript: `NaN > VENTANA` es `false`,
así que sin esa guardia una fecha ilegible **pasa la ventana como si estuviera
adentro** — o sea que se podría deshacer cualquier cosa, de cualquier fecha.

```ts
it('una fecha que no se puede leer NO cae del lado permisivo', async () => {
  // `NaN > VENTANA_DESHACER_MS` es `false`: sin la guardia explícita, un commit
  // con fecha ilegible se trata como «recién publicado» y se puede deshacer
  // siempre. Es el bug de JavaScript que más veces se reintrodujo en la
  // historia del lenguaje, y acá abre la ventana de media hora para siempre.
  for (const fecha of ['no-es-una-fecha', '']) {
    const r = await maneja('deshacer', { cuerpo: { sha: SHA }, cookie: cookieValida() }, …)
    expect(r.status, `fecha «${fecha}»`).toBe(409)
  }
})
```

**3 (Minor) · El borde exacto de los 30:00.000 no tiene test.** Verificado por
mutación: cambiando `>` por `>=`, los 65 tests siguen verdes. La elección actual
(a los 30:00.000 todavía se puede) es defendible; lo que no puede es quedar sin
que nadie la haya decidido. Un test la fija.

**4 (Minor) · La frase de error está tipeada dos veces**, acá y en
`publicar.ts`, y encima `revierte()` puede devolver ese mismo texto adentro de
su `detalle`. Compartí la constante.

**5 (Minor, arreglo de raíz) · El guardián de jerga tiene un falso positivo, y
es en la palabra del botón de esta tarea.** `JERGA_PROHIBIDA` incluye `'sha'`, y
`'deshacer'.includes('sha')` da **verdadero** (de-**sha**-cer). Los tres
consumidores que hacen el `includes` a mano rechazan una palabra del castellano
que el panel necesita. El revisor encontró además **«deshabilitar»**, que es
copy de panel completamente plausible.

Un guardián con falsos positivos se desactiva solo: el próximo que escriba
«deshacer» va a aflojar el test en vez de entenderlo. Se arregla al lado de la
constante, y los tres consumidores pasan a usarlo:

```ts
/**
 * ¿Esta frase le habla a la clienta con jerga?
 *
 * Por límites de palabra y no por substring, porque `'sha'` —la única entrada
 * de tres letras de la lista— vive adentro de «deshacer» y de «deshabilitar»,
 * que son exactamente el vocabulario de un panel de publicación. Un guardián
 * que rechaza la palabra del botón principal no se corrige: se afloja, y a la
 * tercera vez que alguien lo pelea, deja de proteger.
 *
 * Se normalizan los acentos antes de comparar para que «commit» no se cuele
 * escrito como «cómmit».
 */
export function jergaEn(frase: string): string | null
```

con sus propios casos: que «deshacer» y «deshabilitar» pasen, que «el sha del
commit» NO pase, y que «hubo un problema con el Deploy» no pase por estar en
mayúscula.

- [ ] **Step 4: Corré, verificá que pasan, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/acciones.ts api/panel.js test/acciones.test.ts
git commit -m "feat: deshacer la última publicación durante media hora"
```

---

### Task 10: `accion=historial` — qué se publicó, cuándo y quién

Spec §4.6 («el historial completo sigue existiendo») y §4.5 («lo primero que ve
al reabrir el panel es el resultado de su última publicación, no un tablero
limpio»). Las dos cosas salen del mismo lugar: la lista de commits del panel en
`main`.

No hay base de datos y no hace falta: git ya guarda quién, cuándo y qué. El
asunto del commit **es** el resumen que ella vio antes de publicar (`frase()`),
así que el historial se lee en sus palabras sin traducir nada.

**Files:**
- Modify: `src/servidor/github.ts` (`listaCommits`)
- Create: `src/servidor/historial.ts`
- Create: `test/historial.test.ts`
- Modify: `src/servidor/acciones.ts` (acción `historial` + router)
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Produces:
  - `gh.listaCommits(ref: string, cuantos: number): Promise<Array<{ sha: string; mensaje: string; fecha: string }>>`
  - `interface Publicada { sha: string; resumen: string; autor: string | null; cuando: string; revierteA: string | null }`
  - `lee(commits, ahora): Publicada[]` en `historial.ts`
  - `POST /api/panel?accion=historial` → `{ ok: true, publicaciones: Publicada[] }`

- [ ] **Step 1: `listaCommits`, con su test**

```ts
it('listaCommits trae los últimos commits de un ref', async () => {
  const { f, pedidos } = fetchFalso([
    { cuerpo: [{ sha: 'c1', commit: { message: 'cambia X\n\nPanel: sí\nPanel-Autor: e@x.mx', author: { date: '2026-09-17T12:00:00Z' } } }] },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  expect(await gh.listaCommits('heads/main', 20)).toEqual([
    { sha: 'c1', mensaje: 'cambia X\n\nPanel: sí\nPanel-Autor: e@x.mx', fecha: '2026-09-17T12:00:00Z' },
  ])
  expect(pedidos[0].url).toContain('/commits?sha=main&per_page=20')
})
```

Implementación (la API de listado usa `/commits?sha=<rama>`, con el nombre de la
rama pelado, no `heads/main` — dejalo anotado en el docstring porque es una
inconsistencia de la API que se presta a un bug silencioso: con `heads/main`
contesta 404 y una lista vacía es indistinguible de «no hay commits»).

- [ ] **Step 2: `historial.ts`, con sus tests**

Crear `test/historial.test.ts`:

```ts
/*
 * El historial es git leído en las palabras de la clienta: el asunto de cada
 * commit ES el resumen que ella vio antes de publicar (`frase()`), así que
 * acá no se traduce nada — se filtra, se parte y se ordena.
 */
import { describe, it, expect } from 'vitest'
import { lee } from '../src/servidor/historial'

const commit = (sha: string, mensaje: string, fecha = '2026-09-17T12:00:00Z') => ({ sha, mensaje, fecha })

describe('el historial que ve la clienta', () => {
  it('solo trae lo que publicó el panel: lo de Marcos no es su historial', () => {
    const r = lee([
      commit('c1', 'cambia Línea de cierre\n\nPanel: sí\nPanel-Autor: ella@x.mx'),
      commit('c2', 'fix: acomoda el hero en el celular'),
    ], 0)
    expect(r.map((p) => p.sha)).toEqual(['c1'])
  })

  it('el resumen es el asunto, y el autor sale del trailer', () => {
    const [p] = lee([commit('c1', 'cambia Línea de cierre\n\nPanel: sí\nPanel-Autor: ella@x.mx')], 0)
    expect(p.resumen).toBe('cambia Línea de cierre')
    expect(p.autor).toBe('ella@x.mx')
  })

  it('una reversión se ve como tal, y dice a qué revirtió', () => {
    // Si el historial no lo dijera, «cambia Línea de cierre» y su deshacer se
    // verían como dos cambios distintos del mismo campo, que es confuso justo
    // en el momento en que ella está tratando de entender qué pasó.
    const [p] = lee([commit('c1', 'Deshace un cambio\n\nPanel: sí\nPanel-Autor: ella@x.mx\nPanel-Revierte: abc')], 0)
    expect(p.revierteA).toBe('abc')
  })

  it('un commit del panel sin trailer de autor no rompe: el autor queda en null', () => {
    const [p] = lee([commit('c1', 'algo\n\nPanel: sí')], 0)
    expect(p.autor).toBeNull()
  })
})
```

Y el módulo: filtra por `Panel: sí`, parte el mensaje en asunto (primera línea)
y trailers, y devuelve la lista en el orden en que vino (la API ya los da del
más nuevo al más viejo).

- [ ] **Step 3: La acción, con su test**

`POST /api/panel?accion=historial` exige sesión, corre `revisaLaCabeza()`
(Tarea 8), pide los últimos 20 commits y devuelve la lista. El test verifica
sesión obligatoria, que filtre lo de Marcos y que el orden sea del más nuevo al
más viejo.

- [ ] **Step 4: Corré, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/github.ts src/servidor/historial.ts src/servidor/acciones.ts api/panel.js test/github.test.ts test/historial.test.ts test/acciones.test.ts
git commit -m "feat: el historial de publicaciones, leído de git en las palabras de la clienta"
```

---

### Task 11: el borrador del servidor — `refs/panel/borrador`

Spec §4.3, capa 2. La capa 1 (IndexedDB, cada tecla) es de la fase 6; esta es la
que hace que el borrador sobreviva a cambiar de aparato, y la que permite el
aviso de «tu hermana está editando desde hace diez minutos».

**Por qué un ref fuera de `refs/heads/`** (decisión B5, y el spec es explícito):
la plataforma no mira refs que no sean ramas, así que guardar el borrador no
dispara deploys, no ensucia la lista de ramas, y no hay nada que configurar en
ningún tablero. Es la decisión que borró una pregunta abierta entera del spec.

**Files:**
- Modify: `src/servidor/github.ts` (`creaRef`, y `mueveRef` ya acepta `forzar`)
- Modify: `src/servidor/rutas-permitidas.ts` (la lista blanca del borrador)
- Modify: `src/servidor/publicar.ts` (`Publicacion.ref` y `Publicacion.forzar`)
- Create: `src/servidor/borrador.ts`
- Create: `test/borrador.test.ts`
- Modify: `src/servidor/acciones.ts` (acciones `borrador.guardar` y `borrador.leer`)
- Modify: `api/panel.js` (regenerado), `test/rutas-permitidas.test.ts`, `test/publicar.test.ts`

**Interfaces:**
- Produces:
  - `REF_BORRADOR = 'panel/borrador'` y `RUTA_BORRADOR = 'panel/borrador.json'` en `borrador.ts`.
  - `rutaDeBorradorPermitida(ruta: string): boolean` en `rutas-permitidas.ts`.
  - `Publicacion` gana `ref?: string` (default `'heads/main'`) y `forzar?: boolean` (default `false`).
  - `guarda(gh, { documentos, dispositivo, autor, ahora })` y `leeBorrador(gh)` en `borrador.ts`.
  - `POST /api/panel?accion=borrador.guardar` y `?accion=borrador.leer`.

- [ ] **Step 1: La lista blanca del borrador**

Test en `test/rutas-permitidas.test.ts`:

```ts
describe('la lista blanca del borrador es OTRA lista', () => {
  it('el borrador solo puede escribir su propio archivo', () => {
    expect(rutaDeBorradorPermitida('panel/borrador.json')).toBe(true)
    for (const r of ['src/contenido/datos/sitio.json', 'panel/otro.json', 'panel/borrador.json.bak', '../panel/borrador.json']) {
      expect(rutaDeBorradorPermitida(r), r).toBe(false)
    }
  })

  it('y la de main no acepta el archivo del borrador', () => {
    // Las dos listas son disjuntas a propósito: el borrador nunca tiene que
    // poder aparecer en el sitio publicado, ni al revés.
    expect(rutaPermitida('panel/borrador.json')).toBe(false)
  })
})
```

Implementación: una constante `/^panel\/borrador\.json$/` y su función, al lado
de la otra lista y con un comentario que explique por qué son dos y no una con
más entradas (una lista sola haría que un bug en el router pudiera escribir el
borrador en `main`, o un documento de contenido en el ref de borrador).

- [ ] **Step 2: `publica()` acepta otro ref y, solo ahí, `force`**

Test en `test/publicar.test.ts`:

```ts
it('B5: el ref de borrador se mueve con force; main NUNCA', async () => {
  const { f, pedidos } = fetchFalso([...respuestasDeUnaPublicacionCompleta()])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  await publica(gh, {
    archivos: [{ ruta: 'panel/borrador.json', contenido: '{}' }],
    autor: 'ella@x.mx',
    ref: 'panel/borrador',
    forzar: true,
  })
  const patch = pedidos.find((p) => p.metodo === 'PATCH')!
  expect(patch.url).toContain('/git/refs/panel/borrador')
  expect((patch.cuerpo as { force: boolean }).force).toBe(true)
})

it('la lista blanca que se aplica depende del ref', async () => {
  // Un archivo de contenido mandado al ref de borrador se rechaza, y el
  // archivo del borrador mandado a main también. Si una sola lista valiera
  // para los dos, un bug del router podría publicar el borrador en el sitio.
  const { f } = fetchFalso([])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  expect((await publica(gh, { archivos: [{ ruta: 'src/contenido/datos/sitio.json', contenido: '{}' }], autor: 'a@b.mx', ref: 'panel/borrador', forzar: true })).ok).toBe(false)
  expect((await publica(gh, { archivos: [{ ruta: 'panel/borrador.json', contenido: '{}' }], autor: 'a@b.mx' })).ok).toBe(false)
})
```

Implementación: `REF` deja de ser una constante del módulo y pasa a salir de
`p.ref ?? 'heads/main'`; el chequeo de lista blanca elige la lista según el ref;
`mueveRef` recibe `p.forzar ?? false`. **El default de `forzar` es `false` y el
de `ref` es `main`**, así que todo lo que ya existe sigue exactamente igual —y
un `forzar: true` sobre `heads/main` se rechaza con un `throw` del propio
`publica()`, porque esa combinación no es una opción legítima sino un error de
programación.

- [ ] **Step 3: `borrador.ts`, con sus tests**

Crear `test/borrador.test.ts`. Lo que tiene que probar:

```ts
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { cliente } from '../src/servidor/github'
import { guarda, leeBorrador, RUTA_BORRADOR, REF_BORRADOR } from '../src/servidor/borrador'

const gh = (f: typeof globalThis.fetch) => cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
const UN_BORRADOR = {
  documentos: { sitio: { footer: { derechos: 'a medio escribir' } } },
  base: 'a'.repeat(40),
  dispositivo: 'celu',
  autor: 'ella@ejemplo.mx',
}

describe('el borrador del servidor', () => {
  it('guarda quién lo escribió, desde qué aparato, de qué versión partió y cuándo', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },        // ref del borrador: ya existe
      { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64', sha: 'b' } },
      ...respuestasDeUnaPublicacionCompleta(),
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1_700_000_000_000 })
    expect(r.ok).toBe(true)

    const blob = pedidos.find((p) => p.url.endsWith('/git/blobs') && p.metodo === 'POST')!
    const escrito = JSON.parse(Buffer.from((blob.cuerpo as { content: string }).content, 'base64').toString('utf8'))
    expect(escrito).toEqual({
      documentos: UN_BORRADOR.documentos,
      base: UN_BORRADOR.base,
      dispositivo: 'celu',
      autor: 'ella@ejemplo.mx',
      hora: 1_700_000_000_000,
    })
  })

  it('la primera vez CREA el ref; las siguientes lo mueve', async () => {
    // El ref no existe hasta que alguien guarda por primera vez. Sin este
    // camino, el primer borrador de la vida del panel muere con un 404 que no
    // le dice nada a nadie — y es el primer borrador, o sea el peor momento.
    const { f, pedidos } = fetchFalso([
      { status: 404, cuerpo: { message: 'Not Found' } },   // el ref todavía no existe
      ...respuestasDeUnBlobYUnArbol(),
      { cuerpo: { ref: `refs/${REF_BORRADOR}` } },         // POST /git/refs
    ])
    const r = await guarda(gh(f), { ...UN_BORRADOR, ahora: 1 })
    expect(r.ok).toBe(true)
    const creado = pedidos.find((p) => p.url.endsWith('/git/refs') && p.metodo === 'POST')!
    expect((creado.cuerpo as { ref: string }).ref).toBe(`refs/${REF_BORRADOR}`)
  })

  it('leer sin ref devuelve «no hay borrador», no un error', async () => {
    // Es el estado normal de un panel recién estrenado. Si esto tirara, la
    // primera pantalla que ella ve en su vida sería un error.
    const { f } = fetchFalso([{ status: 404, cuerpo: { message: 'Not Found' } }])
    expect(await leeBorrador(gh(f))).toBeNull()
  })

  it('escribe en SU ruta y en SU ref, nunca en los del sitio', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from('{}').toString('base64'), encoding: 'base64', sha: 'b' } },
      ...respuestasDeUnaPublicacionCompleta(),
    ])
    await guarda(gh(f), { ...UN_BORRADOR, ahora: 1 })
    const arbol = pedidos.find((p) => p.url.endsWith('/git/trees') && p.metodo === 'POST')!
    expect((arbol.cuerpo as { tree: Array<{ path: string }> }).tree.map((e) => e.path)).toEqual([RUTA_BORRADOR])
    const patch = pedidos.find((p) => p.metodo === 'PATCH')!
    expect(patch.url).toContain(`/git/refs/${REF_BORRADOR}`)
  })

  it('no pisa un borrador más nuevo de OTRO aparato salvo que se lo pidan', async () => {
    // Mismo bug que la Tarea 2 arregla para publicar, un nivel más abajo: dos
    // aparatos editando a la vez se borran el trabajo en silencio. Acá el
    // costo es menor (es un borrador) pero el silencio es el mismo.
    const yaGuardado = JSON.stringify({ ...UN_BORRADOR, dispositivo: 'la-compu', hora: 2_000 })
    const respuestas = [
      { cuerpo: { object: { sha: 'refViejo' } } },
      { cuerpo: { content: Buffer.from(yaGuardado).toString('base64'), encoding: 'base64', sha: 'b' } },
    ]

    const { f } = fetchFalso([...respuestas])
    const r = await guarda(gh(f), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000 })
    expect(r).toEqual({ ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: 'la-compu', hora: 2_000 } })

    // Con `pisar` explícito, sí.
    const { f: f2 } = fetchFalso([...respuestas, ...respuestasDeUnaPublicacionCompleta()])
    expect((await guarda(gh(f2), { ...UN_BORRADOR, dispositivo: 'celu', ahora: 1_000, pisar: true })).ok).toBe(true)
  })
})
```

`respuestasDeUnBlobYUnArbol()` es el prefijo de `respuestasDeUnaPublicacionCompleta()`
sin el `PATCH` final: cuando el ref no existe, se crea con un `POST` en vez de
moverse con un `PATCH`. Los dos ayudantes viven en `test/lib/github-falso.ts`.

Y el módulo guarda un JSON con esta forma, que es lo que la fase 6 va a leer:

```ts
export interface Borrador {
  /** Los documentos a medio editar, con la misma forma que `publicar`. */
  documentos: Record<string, unknown>
  /** El sha del sitio contra el que se escribió. */
  base: string
  /** Qué aparato lo escribió, para el aviso de conflicto (spec §4.3). */
  dispositivo: string
  /** Quién, para «tu hermana está editando desde hace diez minutos». */
  autor: string
  /** Epoch ms. */
  hora: number
}
```

- [ ] **Step 4: Las dos acciones**

`borrador.guardar` (POST, sesión obligatoria) y `borrador.leer` (POST, sesión
obligatoria). **`borrador.leer` no compara nada con el borrador local**: devuelve
el del servidor tal cual y la fase 6 decide qué preguntarle a la clienta — el
spec §4.3 describe una pantalla («celular, ayer 11:04, 3 cambios» / «esta compu,
hace 6 días, 1 cambio») y las pantallas son de la fase 6.

Lo que SÍ hace el servidor: **`borrador.guardar` rechaza pisar un borrador más
nuevo de OTRO dispositivo** salvo que el pedido traiga `pisar: true`. Sin eso,
dos aparatos editando a la vez se borran el trabajo en silencio, que es el mismo
bug que la Tarea 2 arregla para publicar, un nivel más abajo.

- [ ] **Step 4b: Los once arreglos de la revisión**

La revisión **confirmó la divergencia**: apartarse de lo que este brief
ilustraba era obligatorio. Con el diseño original, el primer guardado andaba,
la primera LECTURA devolvía 404 → `null` —o sea, **el borrador desaparecía en
silencio**— y desde ahí cada guardado reintentaba el arranque y moría con
`Reference already exists`, para siempre. Y encontró el argumento decisivo por
el commit huérfano, que vale la pena dejar escrito en el código: **un commit
raíz no tiene ancestro común con `main`, así que git se niega a mergearlo**
(«refusing to merge unrelated histories»). Las dos listas blancas son un candado
de software; el huérfano es un candado de matemática.

**A (Important) · El candado anti-pisada se apoya en un dato del cliente.**
`dispositivo` sale del cuerpo del pedido, teniendo `sesion.dispositivo`
—firmado— a mano. Y `idDeDispositivo(undefined)` devuelve `'sin-nombre'`, nunca
falla: si la fase 6 arma el pedido sin ese campo, los dos aparatos son
`'sin-nombre'`, el candado no dispara nunca, y la hermana pisa el borrador de la
clienta en silencio — literalmente el bug que esta tarea vino a arreglar.
Ningún test lo pesca porque todos pasan el campo explícito. **Sale de la
sesión**, como ya salen `autor` y el reloj. Y va el test del pedido sin campo.

**B (Important) · Un borrador corrupto deja el panel en estado terminal.**
Un `JSON.parse` que falla sube intacto y las DOS acciones dan 502 — y no hay
salida, porque para escribir un borrador nuevo hay que leer el corrupto primero.
Sólo se arregla a mano en git. El diseño ya decidió que «no puedo leer el
borrador» no le rompe la pantalla (el 404 da `null`); un JSON corrupto es el
mismo estado desde el lado de ella. Se trata igual, con `console.error` para
Marcos. **Lo mismo con el ref que existe sin su archivo**, que hoy cae en el
mismo bucle de 422.

**C (Important) · La guardia del `force` mira el valor equivocado.**
Tanto la guardia como la elección de lista blanca son «todo lo que no sea
exactamente `heads/main`». Medido: un ref tercero con `forzar: true` pasa. Si
ese ref cayera adentro de `refs/heads/` —un typo como `'heads/borrador'`— el
borrador a medio escribir aterriza en una **rama**, que la plataforma sí mira, y
se despliega: justo la pregunta que el ref fuera de `refs/heads/` vino a cerrar.

Pasa a ser un **mapa explícito** de refs conocidos a su lista blanca, con
`throw` para el desconocido, y el `force` permitido **solo** en la entrada del
borrador. Una regla positiva («este ref permite forzar») en vez de una
prohibición sobre un único valor.

**D (Important) · El arranque no pasa por ningún tope.**
`borradorGuardarAccion` nunca pasa `contexto.bytesDelCuerpo` —a diferencia de
las otras dos acciones que escriben— y el camino de arranque va directo a
`creaBlob()` sin pasar por `revisaLote()`: ni lista blanca ni tope de cuerpo.
Los dos caminos tienen que pasar por las mismas barreras.

**E (Minor) · Y siete cosas chicas:**

1. **`ARBOL_VACIO` es el único paso que ningún test puede cubrir.** En vez de
   dejarlo y mandar a alguien a verificarlo con un `curl` que se va a olvidar,
   `creaArbol()` pasa a **omitir** `base_tree` cuando no hay base — que es la
   forma documentada de «un árbol de cero». Elimina el riesgo en vez de
   diferirlo.
2. **El centinela `padre: ''`** pasa a `string | null`. `''` es justo el valor
   que una variable `string` toma por accidente (`padre: sha ?? ''`), así que
   hoy «no tengo padre» y «perdí el padre» son el mismo valor y el modo de falla
   es silencioso por construcción.
3. **Cualquier 404 se lee como «no hay borrador»** — incluido un token sin
   permiso o un repo mal escrito. Ella ve «no hay borrador» y su trabajo parece
   perdido cuando el panel está mal configurado. Va un `console.error` que lo
   distinga.
4. **El conflicto usa `>` y no `>=`**: dos guardados del mismo milisegundo desde
   aparatos distintos y el segundo pisa sin avisar.
5. **Un borrador sin `hora` se pisa sin avisar** (`undefined > 1000` es `false`).
   El trato es el correcto —mejor escribir que bloquear— pero tiene que estar
   declarado y con test, no ser un accidente del operador.
6. **Los commits del ref del borrador no se parecen entre sí:** el raíz dice
   «Borrador» y los siguientes usan el asunto genérico de publicar, con los
   trailers del panel. Nada los lee, pero si Marcos mira ese ref ve commits que
   parecen publicaciones del sitio.
7. **Cada arreglo va con su test.** Los de A, B, C y D sobre todo.

- [ ] **Step 4c: Los tres que quedaron abiertos**

**1 · El hallazgo B quedó a medias, y la raíz es una sola.** El estado terminal
se eliminó en todos los casos menos uno: un archivo cuyo contenido es
exactamente `null`. Ahí `JSON.parse` **no falla** —`null` es JSON válido— así
que la lectura se declara «ok» con un borrador nulo, y el guardado revienta al
mirarle el `dispositivo`: 502. Y como leer traduce eso a «no hay borrador», el
panel nunca va a mandar `pisar: true`: **sin salida por la interfaz**, que es
exactamente lo que B vino a matar.

La misma raíz cubre cuatro casos más que hoy pasan silenciosamente: `[]`, `42`,
`"hola"`, `true`. En todos ellos `borrador.leer` le entrega a la fase 6 un valor
que **no es un `Borrador`** pero está tipado como si lo fuera, porque
`JSON.parse(texto) as Borrador` no valida nada. Un `as` no es una validación: es
una promesa que el archivo del repo no tiene por qué cumplir.

```ts
  // `JSON.parse` no falla con `null`, `[]`, `42` ni `"hola"`: todos son JSON
  // válido. El `as Borrador` de acá abajo es una promesa que este archivo no
  // tiene por qué cumplir —lo escribe el panel, pero también lo puede tocar
  // una mano—, así que la forma se mira de verdad. Sin esto, un archivo con
  // `null` adentro deja el panel sin salida: leer dice «no hay borrador»,
  // guardar revienta, y como la pantalla cree que no hay nada, nunca manda el
  // `pisar` que lo destrabaría.
  const crudo: unknown = JSON.parse(texto)
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return { estado: 'ilegible', sha }
  }
```

**2 · Rotura nueva (Minor, latente): el mapa de refs acepta claves heredadas.**
`REFS_CONOCIDOS` es un objeto literal y la búsqueda es `REFS_CONOCIDOS[ref]`, así
que `__proto__`, `constructor`, `toString` y `valueOf` **no tiran** con
`forzar: false`: la búsqueda devuelve algo heredado y truthy, `permiteRuta` sale
`undefined`, y al caer en el default del parámetro **se aplica la lista blanca de
`main`** — y publica de verdad.

No es alcanzable hoy desde un pedido HTTP (el ref nunca sale de datos del
cliente) y el `force` sigue siendo imposible fuera del borrador, así que no es
grave. Pero contradice por escrito la invariante que el arreglo C fijó: `throw`
para el desconocido. `Object.hasOwn(REFS_CONOCIDOS, ref)` —o un `Map`, o
`Object.create(null)`— lo cierra, y `permiteRuta` pasa a pasarse siempre
explícito en vez de depender de un default.

**3 · El log nuevo grita en el caso más común.** Quedó en nivel `error` y
dispara en el camino **normal**: cada lectura y cada guardado de un panel que
todavía no tiene borrador. Con el mismo texto que tendría el 404 de un token
vencido, así que no distingue los dos casos —que era lo que ese log venía a
hacer— y de paso llena de «error» el estado más común de un panel recién
estrenado. Bajalo de nivel y que el texto diga las dos posibilidades.

- [ ] **Step 5: Corré, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/github.ts src/servidor/rutas-permitidas.ts src/servidor/publicar.ts src/servidor/borrador.ts src/servidor/acciones.ts api/panel.js test/
git commit -m "feat: el borrador vive en un ref que la plataforma no mira"
```

---

### Task 12: el enlace mágico — la puerta de recuperación

Spec §4.1. **No es la puerta principal** —esa es la contraseña larga en el
llavero del teléfono, y funciona desde la Parte A— sino la de recuperación: la
que se usa el día que el llavero se perdió con el teléfono.

Tres cosas que el spec pide con nombre y apellido, y que son el 90% de esta
tarea:

1. **El propósito va ADENTRO del HMAC.** Ya está hecho (Tarea 3): la cookie
   firma sobre `sesion|…` y el enlace va a firmar sobre `entrar|…`.
2. **Se consume con POST, nunca con GET.** Gmail, Outlook y los antivirus abren
   los enlaces para escanearlos: con GET, el enlace se gasta en el datacenter de
   Google antes de que ella lo toque.
3. **Quince minutos**, y `Referrer-Policy: no-referrer` para que el token no se
   filtre en la cabecera de la primera navegación que salga de la página.

**Files:**
- Create: `src/servidor/enlace.ts`, `test/enlace.test.ts`
- Create: `src/pages/panel/entrar.astro`
- Modify: `src/servidor/acciones.ts` (acciones `enlace` y `entrar-con-enlace`)
- Modify: `vercel.json` (cabeceras de `/panel/:camino*`)
- Modify: `api/panel.js` (regenerado), `docs/panel-operacion.md`

**Interfaces:**
- Consumes: `mensajeFirmado`, `DOMINIO_SESION` (Tarea 3); `contexto.correo` (Tarea 6).
- Produces:
  - `DOMINIO_ENLACE = 'entrar'`
  - `firmaEnlace(correo: string, vence: number, secreto: string): string`
  - `verificaEnlace(token: string, secreto: string, ahora: number): { correo: string } | null`
  - `POST ?accion=enlace` con `{ correo }` → 200 SIEMPRE (ver abajo).
  - `POST ?accion=entrar-con-enlace` con `{ token }` → cookie de sesión.

- [ ] **Step 1: `enlace.ts` y sus tests**

```ts
import { describe, it, expect } from 'vitest'
import { firmaEnlace, verificaEnlace } from '../src/servidor/enlace'
import { firmaSesion, verificaSesion } from '../src/servidor/sesion'

const SECRETO = 'x'.repeat(40)
const QUINCE_MIN = 15 * 60_000

describe('el enlace de recuperación', () => {
  it('vale hasta su vencimiento y trae el correo', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaEnlace(t, SECRETO, 1_000)).toEqual({ correo: 'ella@ejemplo.mx' })
  })

  it('a los quince minutos deja de valer', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaEnlace(t, SECRETO, 1_000 + QUINCE_MIN + 1)).toBeNull()
  })

  it('B7: un token de enlace NO sirve como cookie de sesión', () => {
    // El mismo secreto firma las dos cosas. Sin el propósito ADENTRO de lo
    // que se firma, un enlace interceptado en una bandeja de entrada se pega
    // como cookie y ya está adentro — sin consumir el enlace, sin dejar
    // rastro, y para todo lo que dure la sesión, no quince minutos.
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    expect(verificaSesion(t, SECRETO, 1_000)).toBeNull()
  })

  it('B7: y una cookie de sesión no sirve como enlace', () => {
    const cookie = firmaSesion(
      { correo: 'ella@ejemplo.mx', vence: 9_000_000, dispositivo: 'celu', emitida: 1 },
      SECRETO,
    )
    expect(verificaEnlace(cookie, SECRETO, 1_000)).toBeNull()
  })

  it('un token con la firma cambiada no vale, aunque el correo sea el correcto', () => {
    const t = firmaEnlace('ella@ejemplo.mx', 1_000 + QUINCE_MIN, SECRETO)
    const [cuerpo] = t.split('.')
    expect(verificaEnlace(`${cuerpo}.firmaInventada`, SECRETO, 1_000)).toBeNull()
  })

  it('un secreto corto no firma ni verifica nada', () => {
    // Mismo candado que la sesión (C-1 de la Parte A): para HMAC, una clave
    // corta o vacía es indistinguible de no tener firma.
    expect(() => firmaEnlace('ella@ejemplo.mx', 1, 'corto')).toThrow()
    expect(verificaEnlace('lo.que.sea', 'corto', 1)).toBeNull()
  })
})
```

- [ ] **Step 2: La acción `enlace` — y el detalle que importa**

```ts
/**
 * Pedir un enlace de recuperación.
 *
 * SIEMPRE contesta 200 con la misma frase, exista o no la dirección en
 * `PANEL_CORREOS`. Si contestara distinto, este endpoint —que es público, sin
 * sesión— sería una forma de averiguar qué direcciones tienen acceso al
 * panel, probando una por una. Es la misma razón por la que `entrar` no dice
 * si falló el correo o la contraseña (Parte A).
 *
 * El freno por IP de `entrar` (E4) se aplica igual: sin él, esto es una forma
 * de mandarle correo a alguien desde nuestro remitente, todas las veces que
 * uno quiera.
 *
 * [B3] Es la ÚNICA acción que no puede degradar sin correo configurado: acá
 * el correo ES el producto. Sin `RESEND_API_KEY` o `PANEL_REMITENTE`,
 * contesta 503 con frase en español —«Ahora mismo no puedo mandarte el
 * enlace. Escríbele a Marcos.»— en vez de decir «te lo mandé» y no mandarlo.
 */
```

La frase única del 200: `'Si esa dirección tiene acceso, te llegó un correo con el enlace.'`

- [ ] **Step 3: La página `/panel/entrar`**

`src/pages/panel/entrar.astro`. Requisitos, todos verificables:

- **NO usa el `candado` de `Base.astro`.** El spec es explícito y el propio
  código del candado dice que es «una tranca, NO seguridad real» (compara un
  SHA-256 en el navegador). Poné un comentario arriba diciendo exactamente eso,
  porque la próxima persona va a querer «protegerla».
- Un `<button>` que hace `fetch('/api/panel?accion=entrar-con-enlace', { method: 'POST', … })`
  con el token sacado de `location.search`.
- `history.replaceState` apenas carga, para sacar el token de la barra de
  direcciones (y del historial del navegador, y de lo que sea que ella comparta
  después por captura de pantalla).
- Sin React, sin islas, sin dependencias: veinte líneas de script inline.
- Un test en `test/` que renderice la página con `experimental_AstroContainer` y
  exija: que NO diga `data-candado`, que tenga el botón, y que el script llame a
  `history.replaceState`.

- [ ] **Step 4: Las cabeceras**

En `vercel.json`, una regla nueva para `/panel/:camino*`:

```json
    {
      "source": "/panel/:camino*",
      "headers": [
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Cache-Control", "value": "no-store" }
      ]
    },
```

Y un test que lo exija, con el mismo patrón que el de `/version.json` (Tarea 4):
las tres cabeceras son parte del mecanismo, no decoración. `no-referrer` es lo
que impide que el token se filtre en la primera navegación que salga de la
página; `no-store` es lo que impide que una página con token quede en un caché
compartido.

- [ ] **Step 4b: Los nueve hallazgos de la revisión**

La revisión atacó la puerta con ocho forjas distintas y **las ocho rebotaron**:
la criptografía de este enlace está bien hecha —el dominio adentro del mensaje
firmado, el largo comparado antes del `timingSafeEqual`, la frontera del
vencimiento exacta— y no hay un segundo bypass de clave vacía acá. Lo que
encontró está alrededor.

**A (Critical) · La puerta no funciona nunca.** `history.replaceState` corre
**antes** de leer `location.search`, y reescribe el URL de forma síncrona: para
cuando el código lee el token, ya no está. `token` es siempre `''`, el botón no
aparece nunca, y la página siempre dice «Este enlace no funciona. Pide uno
nuevo.» Verificado en un Chromium de verdad.

Invertir las dos líneas lo arregla, y **no** reintroduce el token en la barra:
medido, el URL queda igual de limpio.

Y el motivo por el que 1179 tests verdes no lo vieron es lo que hay que arreglar
de fondo: **los seis tests de esa página miran el TEXTO del archivo**, no su
comportamiento. Uno exige que la cadena `history.replaceState` aparezca en el
HTML — y aparece, en el orden equivocado. `linkedom` ya es dependencia del
repo: un test que ejecute el script y verifique que el botón queda visible con
un token en la URL habría cazado esto solo.

**B (Critical) · Pedir un enlace filtra qué direcciones tienen acceso, por el
reloj.** El cuerpo y el código son idénticos en las dos ramas —eso está
perfecto— pero la rama de la dirección listada hace una llamada HTTP al
proveedor de correo y la otra no hace nada. Medido:

```
listado    = 150.46 ms
no listado =   0.03 ms      ← ~5000×
```

Un endpoint público, sin sesión, y un solo pedido alcanza para saber si una
dirección tiene acceso al panel. Es exactamente el oráculo que este brief
declara no negociable, abierto por el otro lado.

**Y este proyecto ya resolvió esta misma clase de bug en la puerta de al lado:**
`entrar` tiene un hash señuelo (I-3) para que las dos ramas tarden lo mismo, con
su test de piso. Medido: `entrar` da 105.7 ms en las dos ramas; `enlace` da
150.5 contra 0.03. La acción nueva no heredó el criterio. Igualá el reloj —un
envío señuelo, o un piso fijo antes de contestar— y poné el test con el mismo
patrón del que ya existe.

**C (Important) · El enlace se puede reusar sin límite.** Los quince minutos son
el único techo. Medido: el mismo token se cambió por sesión **ocho veces en
paralelo desde ocho IPs distintas**, ocho sesiones de treinta días. Un token de
quince minutos se convierte en un pie adentro de un mes, replicable, y **ella no
se entera**: consumirlo no invalida nada ni deja rastro.

No hace falta un almacén compartido para acotarlo, y hay dos cosas que no
cuestan infraestructura:

1. **La sesión que emite esta vía dura 24 horas, no treinta días.** Es una
   puerta de recuperación: sirve para volver a entrar, no para quedarse. La
   fase 6 va a poder ofrecer «recordar este aparato» desde adentro.
2. **Cada vez que se consume un enlace, le llega un correo a ella.** Es la única
   señal que puede tener de que alguien más entró con su enlace.

**D (Important) · No hay freno en el consumo, y el argumento que lo justifica se
contradice.** Medido: veinte tokens basura seguidos desde la misma IP, veinte
401, ni un 429. La premisa del razonamiento —que un HMAC no se adivina— es
cierta y quedó verificada. Pero el freno acá no protege contra adivinar la
firma: protege contra **reusar un token válido**, que es el hallazgo C y hoy no
tiene ningún techo. Y la razón que se dio para no ponerlo («alguien podría
gastarle los intentos a otro») **ya pasa** en la acción de al lado, por la
puerta que sí se eligió compartir.

**E (Minor) · El contador compartido se vuelve en contra el día que más
importa.** Medido: cinco pedidos de enlace desde una IP y después `entrar` con
la contraseña **correcta** devuelve 429. O sea: la clienta que perdió el
teléfono pide el enlace cinco veces porque no le llega, y se queda además sin
poder usar su contraseña por quince minutos — justo el día de la recuperación.
Contadores separados por acción lo arreglan, y de paso desarman la
contradicción del hallazgo D.

**F (Minor) · Sin tope por destinatario.** El freno es por IP. Medido: veinte
IPs distintas, **cien correos** a la bandeja de ella, todos desde el remitente
del proyecto. Un tope por dirección (tres enlaces cada quince minutos) protege
su bandeja y la reputación del remitente.

**G (Minor) · La página no tiene su propio `<meta name="robots">`.** Las otras
dos páginas privadas del proyecto tienen **las dos** señales: el meta en el HTML
y la cabecera. Acá el `noindex` cuelga de un solo hilo. Cuatro palabras.

**H (Minor) · El correo se firma con las mayúsculas que tipeó quien lo pidió**, y
esa forma cruda termina como autor de los commits. Normalizalo contra la entrada
de la lista al firmar.

- [ ] **Step 4c: Las dos consecuencias de los arreglos**

Los nueve quedaron cerrados y cada arreglo probado por mutación. Pero dos de
ellos trajeron cola, y las dos hay que ajustarlas antes de que esto corra con
una clave de correo real.

**1 · El señuelo manda correo de verdad, sin techo, a una casilla que no
existe.** Medido: veinte pedidos desde veinte IPs con veinte direcciones
inventadas → **veinte correos**, todos a `senuelo@descarte.maracacao.mx`, y cada
uno con **un token de enlace válido adentro**. El tope por destinatario no lo
frena, porque su clave es la dirección que mandó quien pide, no el señuelo. Y
`maracacao.mx` **no tiene registros MX**: cada uno de esos envíos es un rebote
duro contra la reputación del remitente.

O sea: el arreglo del oráculo abrió un generador ilimitado de rebotes — justo lo
que el tope por destinatario fue a proteger. Y no está documentado en ningún
lado, así que Marcos vería rebotes en Resend sin ninguna explicación.

**Se reemplaza por un piso de tiempo fijo.** Cierra el oráculo igual —las dos
ramas tardan lo mismo— y no manda nada:

```ts
/**
 * El piso de tiempo de `enlace`.
 *
 * Las dos ramas —dirección listada y no listada— tienen que tardar lo mismo, o
 * el endpoint se vuelve una forma de averiguar quién tiene acceso al panel
 * probando direcciones una por una. La primera versión de este arreglo igualaba
 * el reloj MANDANDO un correo señuelo, y eso cerraba el oráculo pero abría algo
 * peor: veinte pedidos desde veinte IPs eran veinte rebotes duros contra la
 * reputación del remitente, cada uno con un token válido adentro.
 *
 * Esperar es más barato y no le escribe a nadie. El número tiene que ser
 * cómodamente mayor que lo que tarda el proveedor de correo —si queda corto, la
 * rama que manda de verdad se pasa del piso y el oráculo vuelve—, y el test de
 * abajo lo vigila con el mismo criterio que el de la puerta de contraseña.
 */
const PISO_ENLACE_MS = 400
```

con su test de piso, el mismo patrón del que ya existe para la contraseña: las
dos ramas medidas, y la diferencia por debajo de un umbral chico.

**2 · El tope por destinatario es una negación de servicio contra la puerta de
recuperación.** Medido: un extraño desde **tres IPs cualesquiera** pide el
enlace de ella tres veces; cuando **ella** lo pide desde su propia IP, recibe
429. Tres pedidos alcanzan para dejarla afuera de su única puerta de emergencia
—el día que perdió el teléfono— y no hace falta saber nada, porque el chequeo
corre antes de saber si la dirección está en la lista.

El tope era real y se queda, pero **tres es un número muy bajo para la puerta
que tiene que funcionar el peor día**. Sube a **diez cada quince minutos**, con
un `console.error` fuerte cuando se dispara. Diez es bajo para proteger su
bandeja (frente a los cien que había) y alto para que dejarla afuera exija
hostigarla a propósito — y si eso pasa, el log se lo dice a Marcos, que puede
hacer algo. Dejalo escrito en el runbook, con el residuo declarado: **este tope
no se puede subir hasta desaparecer sin devolverle el problema a su bandeja**.

**3 · Y una imprecisión de redacción:** el runbook dice «las tres puertas de
esta sección» y el paréntesis enumera dos.

- [ ] **Step 4d: La alarma del piso**

Medido en la re-revisión: con el proveedor a 800 ms contra un piso de 400, las
dos ramas vuelven a diferir 400 ms. **El oráculo se reabre cada vez que el
proveedor tenga un mal día.**

El revisor propone un timeout duro sobre el envío para que el total no dependa
nunca del proveedor. **No se hace, y la razón es de producto:** abandonar el
envío en una función serverless puede matarlo —la plataforma congela el proceso
después de responder— y ésta es la puerta de RECUPERACIÓN. Que el correo no
salga el día que ella perdió el teléfono es peor que una señal de tiempo
intermitente, que además solo aparece mientras el proveedor está lento y no es
reproducible a voluntad por quien ataca. Lo que se gana con el timeout no paga
lo que se arriesga.

Lo que sí falta es que **no pase en silencio**. Hoy el código solo actúa cuando
FALTA tiempo para llegar al piso, y nunca cuando sobra:

```ts
  const transcurrido = Date.now() - arranque
  if (transcurrido > PISO_ENLACE_MS) {
    // El proveedor tardó más que el piso, así que esta rama —la que SÍ manda—
    // acaba de tardar más que la que no manda nada: por esta ventana, el
    // tiempo de respuesta vuelve a decir si la dirección tiene acceso. No se
    // corta el envío para evitarlo (ver el ruling T12-K: abandonar el pedido
    // en una función serverless puede matar el correo, y ésta es la puerta que
    // tiene que funcionar el peor día). Lo que sí se hace es avisar, para que
    // esto no sea invisible: si aparece seguido, hay que subir el piso.
    console.error(
      `enlace: el envío tardó ${transcurrido} ms, más que el piso de ${PISO_ENLACE_MS} ms — ` +
        'mientras eso pase, el tiempo de respuesta distingue una dirección con acceso de una sin acceso.',
    )
  }
```

con su test, y el residuo escrito en el runbook junto al del tope: **el piso
protege mientras el proveedor sea más rápido que él, y la alarma es cómo se
sabe que dejó de serlo.**

- [ ] **Step 5: Corré, reempaquetá y commiteá**

```bash
pnpm vitest run && pnpm build:sitio
pnpm bundle:api
git add src/servidor/enlace.ts src/servidor/acciones.ts src/pages/panel/entrar.astro vercel.json api/panel.js test/ docs/panel-operacion.md
git commit -m "feat: el enlace mágico de recuperación, que se consume con POST"
```

---

### Task 13: la vigilancia del PAT — avisar 30 días antes, no el día que rompe

Spec §4.1: «el modo de falla sin esto es "la clienta publica y recibe un 401
incomprensible"». Un token fine-grained de GitHub tiene fecha de vencimiento
obligatoria, y el día que vence, el panel deja de funcionar sin que nada haya
cambiado.

**Files:**
- Modify: `src/servidor/github.ts` (leer el vencimiento), `src/servidor/acciones.ts` (`salud`)
- Test: `test/github.test.ts`, `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado), `docs/panel-operacion.md`

**Interfaces:**
- Produces: `gh.vencimientoDelToken(): string | null` — **sincrónica**: devuelve
  lo que vino en la cabecera `github-authentication-token-expiration` del
  ÚLTIMO pedido que hizo este cliente, o `null` si no vino ninguna. No hace un
  pedido propio, a propósito: la cabecera llega arriba de cualquier respuesta
  autenticada, así que la vigilancia no cuesta ni una llamada más al PAT — que
  es justo lo que el freno de la Parte A (I-6) existe para cuidar.

- [ ] **Step 1: Leer el vencimiento**

GitHub manda esa cabecera en las respuestas a pedidos autenticados con un PAT
fine-grained. Como es una CABECERA y `pedir()` hoy solo devuelve el cuerpo, hace
falta exponerla. El test:

```ts
it('lee la fecha de vencimiento del token de la cabecera que GitHub manda', async () => {
  const { f } = fetchFalso([
    {
      cuerpo: { object: { sha: 'abc' } },
      cabeceras: { 'github-authentication-token-expiration': '2026-12-01 00:00:00 UTC' },
    },
  ])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  await gh.ref('heads/main')
  expect(gh.vencimientoDelToken()).toBe('2026-12-01 00:00:00 UTC')
})

it('si la cabecera no vino, devuelve null — no inventa una fecha', async () => {
  // Un token clásico, o una configuración distinta, no la manda. Inventar
  // «vence en un año» sería peor que no saber: haría que la vigilancia
  // callara justo cuando no puede ver.
  const { f } = fetchFalso([{ cuerpo: { object: { sha: 'abc' } } }])
  const gh = cliente({ token: 't', duenio: 'd', repo: 'r', fetch: f })
  await gh.ref('heads/main')
  expect(gh.vencimientoDelToken()).toBeNull()
})
```

**Ojo con la forma:** `vencimientoDelToken()` es sincrónica y devuelve lo que
vio en el ÚLTIMO pedido, porque la cabecera llega de arriba de cualquier
respuesta autenticada. No hace un pedido propio — si lo hiciera, la vigilancia
costaría una llamada al PAT cada vez que alguien toca `salud`, que es
exactamente lo que el freno de la Parte A (I-6) existe para evitar.

**`fetchFalso` hoy no permite programar cabeceras de respuesta**: agregale un
campo `cabeceras?: Record<string, string>` que se pase al `Response`. Es un
cambio de dos líneas en `test/lib/github-falso.ts` y lo van a necesitar los
tests de esta tarea.

- [ ] **Step 2: `salud` reporta el vencimiento y avisa**

`salud` ya pide `gh.ref('heads/main')` detrás del freno por IP. Esa misma
respuesta trae la cabecera, así que la vigilancia **no cuesta un pedido más**.
Lo que se agrega:

- El cuerpo de `salud` suma `tokenVence: string | null` y `diasParaVencer: number | null`.
- Si faltan 30 días o menos, se le manda un correo a `PANEL_AVISOS_A`.
- **Con freno, no en cada llamada.** `salud` se puede llamar sin sesión: sin un
  freno, cualquiera con `curl` le manda a Marcos un correo por segundo. El
  freno: se avisa como mucho una vez cada 24 h por proceso, con el mismo tipo de
  `Map` en memoria que usa `intentoPermitido` — y con el mismo comentario
  honesto de que las funciones son efímeras, así que el tope real es «una vez
  por día por instancia viva», no «una vez por día».

Los tests: que avise a los 30 días, que NO avise a los 31, que no avise dos
veces seguidas, y que un `tokenVence: null` no dispare nada.

- [ ] **Step 3: El runbook**

En `docs/panel-operacion.md`, una sección «Renovar el token de GitHub» con los
pasos exactos (qué permisos: Contents RW + Metadata R, **sin Workflows**), y la
advertencia de que renovarlo es cargar la variable de nuevo en Production y
**redesplegar**, porque las variables se leen al arrancar la función.

- [ ] **Step 4: Corré, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/github.ts src/servidor/acciones.ts api/panel.js test/ docs/panel-operacion.md
git commit -m "feat: avisar treinta días antes de que venza el token, no el día que rompe"
```

---

### Task 14: los avisos de conteo vuelven a la respuesta de publicar

Herencia n.º 3 del cierre de la Parte A: `conteosDe` salió del router porque
exige leer documentos que el lote no escribe, y no había pantalla que mostrara
los avisos. Ahora sí la va a haber (fase 6), y el dato ya está casi pago: la
Tarea 2 dejó el `sabores.json` vivo leído para calcular los derivados de `sitio`.

**Qué es un aviso de conteo:** el sitio tiene textos que mencionan cuántos hay
(«LOS 15 SABORES», «Seis sabores de gotas»). `cruzaConteo()` los compara contra
la lista real y, si no coinciden, devuelve un `Problema` con
`gravedad: 'avisa'`. **Nunca bloquea una publicación** —es una comodidad, no una
regla— pero hoy se pierde en silencio, y el modo de falla es que el sitio diga
«los 15 sabores» abajo de una lista de dieciséis.

**Files:**
- Modify: `src/servidor/acciones.ts` (`publicarAccion`)
- Test: `test/acciones.test.ts`
- Modify: `api/panel.js` (regenerado)

**Interfaces:**
- Produces: la respuesta de `publicar` suma
  `avisos: Array<{ campo: string; titulo: string }>` — siempre presente, vacía
  cuando no hay.

- [ ] **Step 1: El test que falla**

```ts
describe('los avisos de conteo en la respuesta de publicar', () => {
  it('avisa cuando un texto menciona una cantidad que ya no coincide', async () => {
    // Ella agrega el sabor 16 y el texto del anaquel sigue diciendo «LOS 15
    // SABORES». Publicar NO se bloquea —es su decisión, y puede ser que lo
    // arregle después— pero tiene que enterarse, porque desde su pantalla el
    // texto se ve perfecto: lo que está mal es la relación entre dos cosas
    // que no se ven juntas.
    const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores()])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_BASE, documentos: { sabores: conDieciseisSabores() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
    )
    expect(r.status).toBe(200)
    const avisos = (r.cuerpo as { avisos: Array<{ campo: string }> }).avisos
    expect(avisos.map((a) => a.campo)).toContain('anaquel.kicker')
  })

  it('un aviso NUNCA bloquea: el commit se hizo igual', async () => {
    const { f, pedidos } = fetchFalso([...respuestasDeUnaPublicacionDeSabores()])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_BASE, documentos: { sabores: conDieciseisSabores() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
    )
    expect((r.cuerpo as { sha: string | null }).sha).not.toBeNull()
    expect(pedidos.some((p) => p.url.endsWith('/git/commits') && p.metodo === 'POST')).toBe(true)
  })

  it('sin nada que avisar, la lista viene VACÍA, nunca ausente', async () => {
    // Que el campo exista siempre es lo que le permite a la fase 6 escribir
    // `avisos.length` sin un `?.` que esconda un bug de la respuesta el día
    // que este código deje de calcularlos.
    const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores()])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_BASE, documentos: { sabores: saboresConUnPrecioDistinto() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
    )
    expect((r.cuerpo as { avisos: unknown[] }).avisos).toEqual([])
  })

  it('si calcular los avisos revienta, la publicación ya está hecha y la respuesta lo dice', async () => {
    // El orden no es un detalle: los avisos se calculan DESPUÉS de escribir.
    // Si se calcularan antes, un aviso —que por definición no bloquea—
    // habría bloqueado una publicación al fallar.
    const { f } = fetchFalso([...respuestasDeUnaPublicacionDeSabores()])
    const r = await maneja(
      'publicar',
      { cuerpo: { base: SHA_BASE, documentos: { sabores: saboresQueRompenElConteo() } }, cookie: cookieValida() },
      contextoDePrueba({ fetch: f }),
    )
    expect(r.status).toBe(200)
    expect((r.cuerpo as { sha: string | null }).sha).not.toBeNull()
    expect((r.cuerpo as { avisos: unknown[] }).avisos).toEqual([])
  })
})
```

`conDieciseisSabores()` es el documento real de `src/contenido/datos/sabores.json`
con un sabor más (leído del disco, no escrito a mano: un fixture a mano se
desincroniza del esquema y el test empieza a probar otra cosa).
`saboresQueRompenElConteo()` es lo que haga fallar a `conteosDe()` —hoy, un
documento sin la lista que la tabla de conteos dice contar—; si al escribir el
test resulta que `conteosDe()` no puede fallar con un documento que ya pasó el
esquema, **borrá ese cuarto test y dejá escrito en el archivo por qué**: un test
que no puede fallar es peor que ninguno.

- [ ] **Step 2: La implementación**

En `publicarAccion`, después de escribir y antes de devolver: calcular los
conteos con `conteosDe()` sobre los documentos del lote —completados con lo vivo
que ya se leyó, sin pedidos nuevos— y correr `validar()` (la que sí toma
conteos, no `validarContra`) sobre el documento de `sitio`, quedándose solo con
los `gravedad: 'avisa'`.

**El orden importa y hay que respetarlo:** los avisos se calculan DESPUÉS de
publicar, no antes. Si se calcularan antes y algo fallara ahí, un aviso —que por
definición no bloquea— habría bloqueado una publicación.

- [ ] **Step 3: Corré, reempaquetá y commiteá**

```bash
pnpm vitest run
pnpm bundle:api
git add src/servidor/acciones.ts api/panel.js test/acciones.test.ts
git commit -m "feat: publicar devuelve los avisos de conteo, que informan sin bloquear"
```

---

### Task 15: corregir el spec, cerrar el runbook y probar todo el canal contra producción

Herencia n.º 5 del cierre de la Parte A, más el ensayo que cierra la fase.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` (§4.2 y §4.4)
- Modify: `docs/panel-operacion.md`
- Modify: `scripts/humo-panel.sh`
- Modify: este plan (sección «Cierre»)

- [ ] **Step 1: Corregí §4.2 — la aritmética del tope está al revés**

Hoy el spec dice:

> TOPE_CUERPO 3.5 MB (por debajo del tope de 4.5 MB de cuerpo de request de
> Vercel, y contando que la API de blobs exige base64: 3.5 MB de binario son
> ~4.7 MB de cuerpo, así que el tope real se aplica sobre el CUERPO, no sobre
> el binario).

La frase se contradice sola: si 3.5 MB de binario son 4.7 MB de cuerpo, entonces
3.5 MB **no** está «por debajo de 4.5 MB» — lo pasa. Lo que el código hace bien
(y la Tarea 1 terminó de arreglar) es aplicar el tope sobre el CUERPO DEL PEDIDO.
Reescribila así:

> TOPE_ARCHIVOS 40 · TOPE_CUERPO 3.5 MB, medido sobre el CUERPO DEL PEDIDO que
> llega a la función —no sobre los binarios—, porque el límite que hay que no
> pasar es el de 4.5 MB de cuerpo de request de la plataforma. Como la API de
> blobs exige base64 (≈4/3 del original), 3.5 MB de cuerpo son ~2.6 MB de
> binario real: ese, y no 3.5 MB, es el tamaño de foto que entra.
> [CORREGIDO 2026-09-17, fase 5B tarea 1: la versión anterior de este párrafo
> decía «3.5 MB de binario son ~4.7 MB de cuerpo», que se pasa del tope que el
> mismo párrafo dice respetar.]

- [ ] **Step 2: Corregí §4.4 — «antes de tocar GitHub» no es del todo cierto**

Hoy la capa 2 dice «EN LA FUNCIÓN, antes de tocar GitHub: revalidación completa
+ lista blanca de rutas + cabeceras WebP». Después de la Parte A eso vale para
la mitad del esquema y no para la otra: validar `sitio` **exige** leer
`sabores.json` vivo, porque sus cinco campos derivados no están en el archivo y
el esquema los pide igual. Agregá la aclaración:

> [CORREGIDO 2026-09-17, fase 5B] «Antes de tocar GitHub» hay que leerlo como
> «antes de ESCRIBIR en GitHub». Validar el documento del sitio exige leer
> `sabores.json` vivo para injertarle los cinco derivados que `serializa()` no
> escribe (ver `acciones.ts`, fase 5A): sin eso, el esquema rechaza cualquier
> publicación real con «el campo quedó vacío». Esa lectura es la única llamada
> que la capa 2 hace, corre después de todo lo que SÍ se puede validar sin red,
> y no escribe nada.

- [ ] **Step 3: Cerrá el runbook**

`docs/panel-operacion.md` tiene que quedar con **la tabla completa de variables**
(las seis de la Parte A más `PANEL_VERCEL_TOKEN`, `PANEL_VERCEL_PROYECTO`,
`RESEND_API_KEY`, `PANEL_REMITENTE`, `PANEL_AVISOS_A`, `PANEL_SESIONES_DESDE`,
`PANEL_DISPOSITIVOS_REVOCADOS`), y estas secciones:

- **«Se cayó el sitio después de una publicación»** — qué hace el revert
  automático solo, y qué hacer a mano si no lo hizo (el comando de `git revert`
  exacto, y por qué NO se usa `--force`).
- **«La clienta dice que publicó y no ve el cambio»** — el árbol de decisión:
  `curl https://www.maracacao.mx/version.json`, compararlo con `git rev-parse
  origin/main`, y qué significa cada combinación.
- **«No le llegan los correos»** — que los avisos degradan a propósito (B3), cómo
  verificar el dominio en el proveedor, y que hasta que eso pase solo llegan a la
  casilla del dueño de la cuenta.
- **«Cómo cortar una sesión»** — ya escrita en la Tarea 3.
- **«Renovar el token de GitHub»** — ya escrita en la Tarea 13.

- [ ] **Step 4: El ensayo completo contra producción**

`scripts/humo-panel.sh` crece con los pasos nuevos. El ensayo entero, en orden:

1. `salud` sin sesión → 200, sin variables faltantes.
2. `entrar` con la contraseña → cookie.
3. `entrar` con la contraseña mal → 401, y cinco veces seguidas → 429.
4. `publicar` sin `base` → **400** (Tarea 2).
5. `publicar` con una `base` vieja → **409** (Tarea 2).
6. `publicar` un cambio de prueba en `footer.derechos` → 200 con sha.
7. `estado` con ese sha → sondear hasta `listo`, obedeciendo `reintentarEn`.
   **Este paso es el que prueba de verdad la Tarea 5**: es la primera vez que la
   API de la plataforma se toca desde la función en producción.
8. `historial` → la publicación del paso 6, arriba de todo.
9. `deshacer` con ese sha → 200, y `estado` del sha nuevo hasta `listo`.
10. `curl https://www.maracacao.mx/version.json` → el sha del deshacer.
11. Verificar que el texto en vivo volvió a ser el original.
12. **La prueba del freno**, al final y siempre: `publicar` con una ruta que no
    está en la lista blanca → 422 sin escribir nada.

El script tiene que dejar el sitio **exactamente como lo encontró** y decirlo en
la última línea, con el sha antes y después.

- [ ] **Step 5: Escribí el cierre de la Parte B**

Al final de este archivo, una sección «Cierre de la Parte B» con: qué se
ejecutó, qué encontraron las revisiones, qué quedó pendiente y **qué hereda la
fase 6**. Como mínimo, la fase 6 tiene que enterarse de:

- La forma exacta de cada respuesta nueva (`Veredicto`, `Publicada`, `Borrador`,
  `avisos`), porque son el contrato de las pantallas.
- `VENTANA_DESHACER_MS`, para saber cuándo esconder el botón.
- Que `borrador.leer` no resuelve el conflicto: devuelve el del servidor y la
  pantalla decide (spec §4.3 describe esa pantalla).
- Que el 422 de un documento desconocido devuelve texto del pedido, que hay que
  escapar antes de pintarlo (herencia viva de la Parte A, todavía sin resolver).
- Qué pasa con `estado` cuando ella cierra el panel: el revert igual ocurre, pero
  en la siguiente acción autenticada (B1), así que la primera pantalla al
  reabrir tiene que estar preparada para encontrarse con que lo que publicó ya
  fue deshecho.

- [ ] **Step 6: Commit final**

```bash
git add docs/superpowers/specs/2026-09-08-panel-cliente-design.md docs/panel-operacion.md docs/superpowers/plans/2026-09-17-panel-fase-5-parte-b.md scripts/humo-panel.sh
git commit -m "docs: corrige el spec donde el código lo desmintió, y cierra la fase 5"
```

---

## Orden y dependencias

```
1 (límites)  ──┐
2 (sha base) ──┼──> 8 (revert automático) ──> 9 (deshacer)
3 (sesiones) ──┘         ▲
                         │
4 (version.json) ──> 7 (estado) ──> 10 (historial)
5 (vercel) ────────────┘ ▲
6 (correo) ──────────────┴──> 12 (enlace) · 13 (PAT)

11 (borrador)  — independiente, necesita 1
14 (conteos)   — independiente, necesita 2
15 (docs)      — al final, necesita todo
```

**Las tres primeras van primero y en ese orden** porque son correcciones de algo
que ya está en producción, no funciones nuevas: cuanto antes entren, menos
tiempo pasa el canal con el agujero abierto. La Tarea 2 en particular es la
única de todo el plan cuya ausencia puede hacer desaparecer el trabajo de una
persona sin dejar rastro.

## Self-review

**Cobertura del spec §4:**

| Sección | Tarea |
|---|---|
| §4.1 enlace mágico | 12 |
| §4.1 vigilancia del PAT | 13 |
| §4.2 commit atómico, base sha | 2 |
| §4.2 topes | 1 |
| §4.3 borrador capa 2 | 11 |
| §4.3 conflicto de borrador | 11 (el servidor), fase 6 (la pantalla) |
| §4.4 las cuatro capas | 14 (los avisos), 15 (la corrección del texto) |
| §4.5 `version.json` | 4 |
| §4.5 API de la plataforma obligatoria | 5 |
| §4.5 cadencia del sondeo | 7 |
| §4.5 aviso por correo | 6, 8 |
| §4.6 revert automático | 8 |
| §4.6 deshacer de 30 minutos | 9 |
| §4.6 historial | 10 |

**Lo que el spec pide y esta fase NO hace, con su razón:**

- **§4.3 capa 1 (IndexedDB, cada tecla)** — es navegador, fase 6.
- **§4.5 el botón «Ver mi sitio» con el parámetro que saltea el caché** — es
  navegador, fase 6. El dato que necesita (`url`) ya viaja en el `Veredicto`.
- **§4.3 imágenes a `pendientes/<hash>.webp`** — fase 7 (fotos). El ref de
  borrador que las va a alojar queda hecho en la Tarea 11.
- **§4.4 capa 4 (`.github/workflows/verifica.yml`)** — no existe todavía; es un
  juez posterior que le avisa a Marcos, no una compuerta, y el PAT del panel no
  puede tocarlo por diseño. Queda anotado como pendiente de Marcos.

**Riesgo declarado, el más grande del plan:** la Tarea 5 escribe un módulo
contra una API externa cuya forma exacta este plan no pudo medir. Por eso su
Paso 1 es la medición y por eso el default de un estado desconocido es
«seguí esperando». Si la medición contradice al plan, **gana la medición** y el
docstring del módulo lo deja escrito con fecha, igual que se hizo con el
experimento de tracing en la Parte A.

## Cierre de la Parte B

### Qué se ejecutó

Las quince tareas de este plan corrieron completas, en el orden que fija
«Orden y dependencias» de arriba. Cada una terminó con `pnpm vitest run`
y `pnpm typecheck` en verde antes de commitear — el detalle tarea por tarea
está en el `git log` de la rama, no repetido acá. Al cerrar esta Parte B,
`pnpm vitest run` da **1203 tests verdes en 57 archivos** y `pnpm typecheck`
da **0 errores, 0 warnings, 3 hints**; la Tarea 15 (esta) es solo
documentación y script, así que no tenía que mover ese número, y no lo movió.

**Lo único que sigue sin ejecutarse es la medición real de la Tarea 5**
(`src/servidor/vercel.ts`, RULING T5-1): el módulo se escribió contra la
forma DOCUMENTADA de la API de Vercel, sin un `curl` real, porque el token
no existe en este entorno y no se le puede pedir a nadie (restricción
global del plan). El Paso 5 del ensayo (`scripts/humo-panel.sh`) es la
medición — pero el ensayo se EDITA acá, no se CORRE: alguien con las
credenciales reales (Marcos) tiene que correrlo a mano contra producción
para que ese riesgo quede cerrado de verdad. Si esa corrida contradice
alguna de las tres suposiciones que el docstring de `vercel.ts` declara
(el parámetro `sha=`, la clave `deployments[0].state`, `app=` para el
proyecto), **gana la medición** y hay que corregir el módulo con fecha,
como pide su propio docstring.

### Qué encontraron las revisiones

Tres hallazgos que le importan a quien siga tocando este código, más allá
del detalle de cada tarea:

- **El freno de intentos pasó de un contador por IP a uno por
  `<acción>:IP`** (Ronda 1 de la Tarea 12) después de que la Ronda 1
  encontrara que compartirlo entre `entrar`/`salud`/`enlace`/
  `entrar-con-enlace` dejaba a la clienta sin poder usar su contraseña
  si había pedido el enlace de recuperación varias veces — el freno que
  protege una puerta le comía el presupuesto a otra. La lección para
  cualquier freno nuevo: si dos puertas distintas van a compartir un
  contador, medí primero si una legítimamente ocupada puede dejar a la
  otra sin margen.
- **El enlace mágico tuvo tres rondas de revisión sobre el MISMO problema**
  (el oráculo de tiempo entre una dirección listada y una que no lo está,
  `src/servidor/acciones.ts`, `enlaceAccion`): la Ronda 1 lo cerró
  mandando un correo señuelo siempre, lo que abrió un generador de rebotes
  duros contra la reputación del remitente; la Ronda 2 lo reemplazó por un
  piso de tiempo fijo (`PISO_ENLACE_MS`); la Ronda 3 encontró que ese piso
  solo protege MIENTRAS el proveedor sea más rápido que él, y decidió
  declarar el residuo en vez de perseguirlo con un timeout (cortar el
  envío en una función serverless puede matar el correo a mitad de
  camino). Para la fase 6: cualquier pantalla que toque el flujo de
  recuperación no puede mostrar un estado de carga distinto según si el
  correo existe o no — reintroduciría el mismo oráculo del otro lado.
- **El bug del propio ensayo de humo, encontrado recién en esta tarea**: el
  paso que prueba la Tarea 2 (`publicar` con una `base` vieja → 409) usaba
  un sha inventado (`000…0`) desde que se escribió (Tarea 2, commit
  `a7caefb`) — el plan ya tenía la corrección escrita en su propia sección
  de la Tarea 2 (ruling T2-1, más arriba en este archivo) pero el script
  nunca se actualizó para aplicarla. Con un sha que no existe, GitHub no
  puede comparar y el router cae en el `catch` de la Fase 2 (502), nunca
  en el chequeo de `base` (409): el ensayo afirmaba un resultado que el
  código no produce. Corregido acá reusando la cabeza real de ANTES de
  publicar el cambio de prueba, que queda vieja de verdad en cuanto el
  paso siguiente mueve `main`. Se los menciona para que quede claro que
  **este plan no se leyó sin verificar**: el código y el ensayo se
  compararon línea por línea contra lo que hay hoy, no contra lo que el
  brief de la Tarea 15 decía que había.

### Qué quedó pendiente

- **Fase 6 (el panel de verdad):** capa 1 del borrador (IndexedDB, cada
  tecla), la pantalla de conflicto de borrador (dos resúmenes en español,
  spec §4.3), el botón «Ver mi sitio» con el parámetro que saltea el
  caché, y las pantallas para `entrar`/`estado`/`historial`/`deshacer`
  sobre el contrato que se detalla abajo.
- **Fase 7 (fotos):** subir a `pendientes/<hash>.webp` en el ref de
  borrador; el ref ya existe (Tarea 11), pero nada sube nada todavía.
- **`.github/workflows/verifica.yml` (capa 4 de la compuerta, spec §4.4):**
  no existe. Es un juez POSTERIOR que le avisa a Marcos por correo, no una
  compuerta —el PAT del panel no tiene permiso de `Actions`, así que ni
  con el peor bug podría tocarlo—, y queda anotado como pendiente de
  Marcos, no de ninguna fase del panel.
- **El 422 de un documento desconocido no escapa el texto del pedido**
  (herencia viva de la Parte A, `acciones.ts`, `publicarAccion`: el `id`
  que llega en `Object.keys(documentos)` se interpola directo en
  `titulo` — `No se puede publicar «${id}»: no es un documento que el
  panel conozca.`). Si la fase 6 pinta `problema` como HTML en vez de
  como texto de un nodo, esto es una inyección esperando un `id` como
  `<img src=x onerror=...>`. Sigue sin resolverse: no lo tocó ninguna
  tarea de esta Parte B, y la fase 6 es quien decide cómo pinta esa
  cadena — la forma más simple es tratar `problema` (y `titulo`, y
  `detalle`) como texto SIEMPRE, nunca como `innerHTML`.
- **Residuos declarados, no bugs:** el freno de intentos vive en memoria
  de una sola instancia serverless (E4, sección «Lo que todavía NO está
  cubierto» del runbook); el piso de tiempo del enlace mágico protege
  mientras el proveedor de correo sea más rápido que él (arriba); el
  tope de diez pedidos por destinatario en `enlace` es un balance
  deliberado, no un número final.

### Qué hereda la fase 6

El contrato exacto que las pantallas nuevas tienen que respetar — esto es
lo que de verdad ahorra tiempo, más que cualquier resumen de tareas:

**1. La forma exacta de cada respuesta nueva.**

`estado` (`POST /api/panel?accion=estado`, cuerpo `{ sha, publicadoEn? }`)
devuelve `{ ok: true, estado, frase, reintentarEn, url }` — el
`Veredicto` de `src/servidor/estado.ts`:
```ts
interface Veredicto {
  estado: 'enCurso' | 'listo' | 'falló'
  frase: string            // ya en español, sin jerga — para pintar directo
  reintentarEn: number | null   // ms hasta la próxima pregunta; null = dejá de preguntar
  url: string | null       // dónde quedó el despliegue, cuando la hay
}
```
**`publicadoEn` es opcional en el cuerpo, pero si la pantalla no lo manda,
el sondeo se comporta distinto de lo esperado**: el servidor cae a
`contexto.ahora()` (o sea, «se publicó ahora mismo») en cada pedido, así
que `desdeHaceMs` nunca crece — la cadencia lenta (después de un minuto) y
el corte a los cinco minutos («nunca gira infinito», spec §4.5) NUNCA se
disparan. La pantalla tiene que guardar el epoch ms de cuando `publicar`
contestó y mandarlo en cada pedido de `estado` para ese sha —
`scripts/humo-panel.sh` (Tarea 15) tuvo que resolver exactamente este
mismo punto para sondear de verdad.

`historial` (`POST /api/panel?accion=historial`, sin cuerpo) devuelve
`{ ok: true, publicaciones: Publicada[] }` — del más nuevo al más viejo,
`src/servidor/historial.ts`:
```ts
interface Publicada {
  sha: string
  resumen: string          // el asunto del commit, tal cual ella lo vio antes de publicar
  autor: string | null     // null si el commit no lleva el trailer (no debería pasar nunca en la práctica)
  cuando: string           // ISO 8601, tal cual lo dio GitHub
  revierteA: string | null // el sha al que revierte, si esta publicación ES una reversión
}
```

`borrador.leer` devuelve `{ ok: true, borrador: Borrador | null }` (`null`
= no hay ninguno guardado todavía, el estado normal de un panel recién
estrenado) — `src/servidor/borrador.ts`:
```ts
interface Borrador {
  documentos: Record<string, unknown>
  base: string        // el sha contra el que se escribió
  dispositivo: string // de `sesion.dispositivo`, nunca del cuerpo del pedido
  autor: string
  hora: number         // epoch ms
}
```
`borrador.guardar` (cuerpo `{ documentos, base, horaLeida?, pisar? }`)
devuelve `{ ok: true }` si guardó, o **409** con
`{ ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo, hora }, problema }`
si hay uno de OTRO aparato que este pedido no declaró haber leído y no se
mandó `pisar: true` — el único campo que distingue este 409 de cualquier
otro error es `motivo`.

**`horaLeida` es el campo que la fase 6 tiene que empezar a mandar**
(agregado en la ola de arreglos de la revisión final, grupo 2). Es el token
de concurrencia del borrador: la `hora` del `Borrador` que ESTE aparato
recibió de `borrador.leer`, tal cual. Es la misma idea que el `base` de
publicar, un nivel más abajo — el pedido declara contra qué estado se
escribió, y el servidor compara contra eso.

- **Se manda `horaLeida` cuando `borrador.leer` devolvió un borrador**, y se
  omite cuando devolvió `null`. Después de un `borrador.guardar` exitoso, el
  aparato NO conoce la `hora` nueva (se la pone el servidor): no hace falta
  que la conozca, porque un borrador del MISMO dispositivo nunca se rechaza
  a sí mismo — la autoguardada tecla-a-tecla sigue funcionando sin mandar
  nada.
- **Omitirlo no es un 400**, a diferencia del `base` de publicar: omitirlo
  significa «no leí ninguno», que es la rama conservadora (409 con salida
  por `pisar: true`). Una pantalla que se olvide del campo no rompe, pero le
  va a preguntar de más a la segunda persona que edite.
- **Por qué existe:** el candado que había antes comparaba
  `borrador.hora >= ahora` —la hora de un guardado anterior contra el `ahora`
  de este pedido— y el reloj del servidor siempre avanza, así que era
  siempre falso. Medido: la hermana guarda 11:00 desde la compu, la clienta
  guarda 11:05 desde el celular, `{ ok: true }`, y el trabajo de la hermana
  se pisa en silencio.

`publicar` exitoso siempre trae `avisos` — un array, **nunca ausente,
vacío si no hay nada que avisar** (`acciones.ts`: «para que la pantalla
pueda leer `avisos.length` sin preguntarse primero si el campo vino»).

**[Achicado en la ola de arreglos de la revisión final, grupo 7]** Viajaba
el `Problema` completo de `src/contenido/validacion.ts`; ahora viaja
`AvisoPublicado` (`acciones.ts`), que es lo que la pantalla necesita y nada
más:
```ts
interface AvisoPublicado {
  campo: string         // la ruta del campo, para resaltarlo
  titulo: string        // lo que ella lee. Sin jerga — pintar directo, pero NUNCA como HTML (ver más abajo)
  detalle?: string      // por qué importa, cuando hace falta decirlo. Sin jerga.
}
```
Qué se fue y por qué: **`gravedad`**, porque este array ya viene filtrado a
`'avisa'` (los de `'impide'` bloquearon la publicación mucho antes de llegar
acá), así que era siempre el mismo valor y una pantalla que filtrara por él
se rompería en silencio; y **`arreglo`**, porque `avisosDeConteo()` no lo
produce nunca y su `valor: unknown` es contenido de la clienta viajando sin
forma — si algún día hay un «arreglalo por mí», es una decisión de producto
con la pantalla delante, no algo que se hereda por descuido. **`detalle` se
quedó**: no es metadato, es la segunda oración que ella lee.

**Un gotcha de forma que no está en ningún lado más que acá:** `salud`
tiene TRES formas de cuerpo distintas según la rama, y la del error más
común —variables faltantes— es la más angosta de las tres.
`{ ok: false, faltan, github: null }` (503, faltan variables) **no trae
`tokenVence` ni `diasParaVencer`** — los otros dos caminos (freno
omitido, o la lectura de GitHub completa) sí los traen siempre, aunque
sea en `null`. Una pantalla que lea `tokenVence` sin primero chequear que
existe se cae justo en el caso que más necesita mostrar algo claro (le
faltan variables a Marcos).

**2. `VENTANA_DESHACER_MS`** (`src/servidor/acciones.ts`) **= 30 minutos.**
Es el techo de cuándo el botón «Deshacer esta publicación» puede seguir
mostrándose: pasada la ventana, `deshacer` contesta 409 con «Ya pasó mucho
tiempo para deshacer esto desde aquí. Búscalo en el historial de
cambios.» — la pantalla tiene que esconder el botón ANTES de que eso
pase, calculando contra `Publicada.cuando` del historial (o contra el
`publicadoEn` que ya venía guardando para `estado`), no esperar a que el
servidor lo rechace para enterarse.

**3. `borrador.leer` no resuelve el conflicto.** Devuelve el borrador del
servidor tal cual, sin comparar nada contra lo que el aparato que
pregunta tenga guardado en IndexedDB — la decisión de qué mostrarle a
ella («celular, ayer 11:04, 3 cambios» / «esta compu, hace 6 días, 1
cambio», spec §4.3) es exclusivamente de la pantalla. El servidor solo
sabe frenar la escritura silenciosa (`borrador.guardar` con
`hay-uno-mas-nuevo`); no sabe, y no le corresponde saber, cuál de los dos
borradores ELLA prefiere.

**4. El 422 de un documento desconocido no viene escapado** (ver «Qué
quedó pendiente», arriba) — tratá `problema`/`titulo`/`detalle` de
CUALQUIER respuesta como texto plano, nunca como HTML, en toda la fase 6:
no es solo este caso, es la postura correcta para cualquier string que
el servidor arma interpolando algo que vino del pedido.

**5. Qué pasa con `estado` cuando ella cierra el panel — la más importante
de las cinco.** No hay ningún proceso sondeando en segundo plano: la
reversión automática (`revisaLaCabeza()`, Tarea 8) SOLO corre cuando algo
autenticado hace un pedido nuevo. Si ella publica, ve el veredicto
«enCurso» y cierra el teléfono, y el despliegue FALLA después, nadie lo
revierte hasta que alguien —ella reabriendo el panel, Marcos entrando,
cualquier acción autenticada— dispare `revisaLaCabeza()` de nuevo. Eso
significa que **la primera pantalla que ve al reabrir el panel tiene que
estar preparada para encontrarse con que lo que publicó ya fue deshecho**:
si esa primera acción es `historial` o `estado` de otra cosa,
`revisaLaCabeza()` corre ahí, revierte en silencio (para ella: no hay
nadie sondeando ESE sha en ESE instante) y le manda el correo recién en
ese momento — la pantalla no puede asumir que «lo publiqué y no vi el
resultado» significa «probablemente salió bien». El primer chequeo al
abrir el panel debería ser un `historial` (o un `estado` del último sha
publicado, si se guardó) para confirmar el estado real antes de mostrar
cualquier cosa que dé por sentado que la última publicación sigue en pie.
