# Tests que congelan contenido

Qué assert se rompe con qué edición de la clienta, y qué se hace con él.
Insumo de la Fase 1 del panel (`docs/superpowers/specs/2026-09-08-panel-cliente-design.md`).

> **Estado (corregido 2026-09-09, revisión final de `rediseno-marca`):**
> los números de línea de abajo se verificaron contra el árbol de trabajo
> de esa fecha (682 tests, antes de sumar el guard de `vercel.json`) —
> no contra el árbol del día en que se escribió esta auditoría. La rama
> movió y borró código entre medio; estas son las filas que cambiaron:
>
> - **Ya ejecutado, marcado como "APLICADO" en su fila:** `css-tokens.test.ts`
>   (Tarea 9: ya lee `dist/`, no hay `execSync`), la interpolación
>   escapada con `esc()` en `fichas.test.ts` (:61, :80), `seo.test.ts`
>   (:218) y `sitio.test.ts` (:165-167 — la parte del `<` de Fase 2 sigue
>   sin aflojarse), y el borrado completo de `src/copy/sitio.ts` +
>   `_barras.astro` + `catalogoBarras` (Tarea 5 / Fase 0 §0.3 — ver filas
>   de `sitio.test.ts` reescritas más abajo).
> - **Todas las demás filas de `marca-copy.test.ts`, `sitio.test.ts`,
>   `seo.test.ts` y `fichas.test.ts`** se corrieron de línea (el archivo
>   creció o se reordenó) pero su assert y su destino siguen vigentes tal
>   cual estaban.
> - No se volvió a auditar contenido nuevo (por ejemplo, la página
>   `/fichas-tecnicas` agregada después de esta auditoría): esta pasada
>   solo corrige referencias, no amplía el alcance.

Criterio: un assert **congela contenido** si compara contra un valor concreto
que alguien podría querer cambiar. Si compara contra una forma —que sea un
número, que no esté vacío, que entre en el ancho— no congela nada y se queda.

Tres destinos posibles, y un cuarto estado que no es un destino sino el
registro de haberlo ejecutado:

- **BORRAR** — el valor pasa a ser editable; la verdad histórica queda en el
  fixture de la migración, que es el acta, no la ley.
- **A FORMA** — el assert se queda pero deja de mirar el valor. Una forma que
  repite lo que el esquema ya garantiza (no vacío, largo mínimo) NO es una
  forma: da la impresión de proteger algo sin proteger nada, y el destino
  correcto en ese caso es BORRAR — pasó con el lema del pie (`:193`).
- **QUEDA** — no congela contenido; no se toca.
- **BORRADA / TRANSFORMADA** — no es un destino a decidir: es la fila ya
  ejecutada, con fecha y con el motivo de lo que se hizo. Este estado se
  agregó a la leyenda en la ola final del 2026-09-10, cuando ya había filas
  usándolo sin estar declarado.

Alcance: "contenido" acá es lo que la clienta va a poder tocar desde el panel
(`src/copy/sitio-marca.ts`, `src/copy/sabores.ts`, las fichas técnicas,
`src/contenido/datos/envolturas.json`). Los tokens de diseño (`@/tokens/*`), la geometría de
los SVG de marca y el copy de `/presentacion` y `/manual` (candado puesto,
usan `src/copy/marca.ts` y `src/copy/landing.ts`, que el panel no toca) NO
son contenido en ese sentido aunque sus tests comparen contra valores
concretos — por eso quedan QUEDA con nota, no listados assert por assert.

| Archivo:línea | Assert | Qué edición lo rompe | Destino |
|---|---|---|---|
| `test/aceptacion.test.ts` | (suite entera) | Ninguna — el propio archivo declara que deriva todo de `JERARQUIA`/`paresAprobados`/`todosLosColores()`, cero conteos a mano | sin asserts de valor de contenido — QUEDA |
| `test/ambiental.test.ts` | (suite entera) | Ninguna — CSS de animación de la mascota (keyframes, duraciones, easing) | sin asserts de valor de contenido — QUEDA |
| `test/color.test.ts` | `toBe`/`toHaveLength`/`toMatchInlineSnapshot` sobre hex y roles de la paleta (p. ej. `verde[500]).toBe('#5B744B')` en :26, `todos.toHaveLength(36)` en :82, snapshot completo de las rampas en :30-77) | Nada que la clienta edite — son los tokens de diseño (paleta), no copy | sin asserts de valor de contenido — QUEDA |
| `test/contrast.test.ts` | (suite entera) | Ninguna — matemática pura de contraste (`relativeLuminance`, `contrastRatio`, `nivelWcag`) | sin asserts de valor de contenido — QUEDA |
| `test/css-tokens.test.ts:84` | `it.skipIf(...)('todas las propiedades --mrc-* llegan al CSS compilado...')`, lee `dist/index.html` | Ninguna — pero hace imposible la compuerta si vuelve a construir desde acá | APLICADO (Tarea 9, ya en esta rama, 2026-09-08): el `execSync('pnpm build')` que esta fila describía ya no existe — el test lee `dist/`, no lo construye |
| `test/css-tokens.test.ts` (resto) | `toBe`/`toContain` sobre custom properties, duraciones de movimiento, tamaños de tipografía (`escala`, `ejesFraunces`, `easings`) | Nada editable por la clienta — son tokens de diseño, no copy | sin asserts de valor de contenido — QUEDA |
| `test/fichas.test.ts:24` | `fichasBase` `toHaveLength(4)` | Alta de una ficha nueva | A FORMA en la **Fase 7** (§7 del spec: fichas pasan a `datos/fichas.json`) |
| `test/fichas.test.ts:61` | `new RegExp(<h2[^>]*>${esc(f.producto)}</h2>)` | Un producto con metacaracteres | APLICADO (Tarea 2): ya interpola con `esc()` |
| `test/fichas.test.ts:65-66` | `toContain('Contiene soya...')`, `toContain('Contenido energético')` | Corregir un alérgeno o la tabla nutrimental | QUEDA por ahora — el spec (§7) dice explícitamente que la tabla nutrimental y los alérgenos **nunca se editan como texto libre**; pasan a un control regulado en Fase 7, no a texto BORRAR-able |
| `test/fichas.test.ts:80-81` | regex armada con `esc(marca.fichasTecnicas.ruta)` para contar enlaces; `enlaces.length` `toBeGreaterThanOrEqual(5)` | Agregar/quitar un tab de negocios | :80 APLICADO (Tarea 2): ya interpola con `esc()` · :81 sigue A FORMA en la **Fase 7** (`tabs.length + 2`) — hoy es un `toBeGreaterThanOrEqual(5)`, no exacto |
| `test/fuentes.test.ts` | (suite entera) | Ninguna — nombres de familia tipográfica, rutas de `.woff2`, reglas `@font-face` | sin asserts de valor de contenido — QUEDA |
| `test/landing.test.ts` | (suite entera, incl. `toHaveLength(1)`/`toBe('Chocolate blanco y pistaches')` en L74-75, `toHaveLength(18/1/2)` en L176-178, `toHaveLength(8)` en L205) | Nada que la clienta pueda tocar desde el panel — todo el copy de este archivo (`@/copy/landing`, `@/copy/marca`) alimenta `/presentacion` y `/manual`, las dos con candado y fuera del alcance del panel (fases 0-6 solo cubren `sitio-marca`/`sabores`/fichas/envolturas) | QUEDA — copy privado, fuera del panel |
| `test/lettering.test.ts` | conteo de letras por archivo (9/9/17, vía `toHaveLength(letras)`), `toBe('path')` por tag | Nada — es geometría de los SVG de marca (logotipo/descriptor), no copy | sin asserts de valor de contenido — QUEDA |
| `test/manual.test.ts` | (suite entera) | Nada — cubre `/manual`, página con candado que consume `src/copy/marca.ts`, fuera del panel; el resto son guards estructurales (rutas, hex a mano) | QUEDA — copy privado, fuera del panel |
| `test/marca-copy.test.ts:55` | lee `src/contenido/datos/envolturas.json` | Ninguna | QUEDA (movido en la fase 1 parte B) |
| `test/marca-copy.test.ts:61` | sabores `toHaveLength(15)` | Agregar un sabor | A FORMA en la **Fase 7**, no ahora |
| `test/marca-copy.test.ts:62-64` | `sabores.map(orden).sort()` `toEqual([1..15])` | Agregar/quitar un sabor (deja huecos en el orden) | A FORMA en la **Fase 7** — pasa a "1..sabores.length sin huecos" (§9 del spec) |
| `test/marca-copy.test.ts:91-92,99-100` | `impreso` `toBe('73%')`; `s.cacao` `toBe('Cacao 70%')` / `toBe('Chocolate blanco')` | Editar el % de cacao mostrado de mango/piña/chamoy/blanco | `:91` QUEDA (es el hecho impreso en la envoltura física, no copy del sitio) · `:92,99,100` **BORRADAS (ola final, 2026-09-10):** `s.cacao` es contenido de `sabores.ts`, el mismo tipo de valor que el precio. Cayeron las tres líneas, no el test: sigue en pie `:91` y sigue en pie la comparación contra lo impreso (`Cacao ${impreso}`), que NO es un valor congelado sino una regla entre dos cosas editables (el sitio y `envolturas.json`) |
| `test/marca-copy.test.ts:105-111` | `nombres` `toContain('Jengibre y naranja')`/`'Fresas y chile'`/`'Hierbabuena'`/`'Tamarindo con chile')` y sus `not.toContain` | **Renombrar un sabor** (ej. "Hierbabuena" → "Menta") | **BORRADA (ola final, 2026-09-10):** el test entero cayó. Era exactamente el caso "nombre" del criterio; la verdad de qué dice la envoltura impresa queda en el fixture de la migración, no en un test que se lee en vivo |
| `test/marca-copy.test.ts:118-129` | exige CINCO archivos por sabor | Alta de sabor con solo la foto de la barra | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:141` | precios `122` / `108` | Cambiar un precio | **BORRADA (Tarea 17, 2026-09-10):** el test entero cayó, no se aflojó. El esquema garantiza entero 1–99.999, y los derivados garantizan que los tres lugares donde el precio queda escrito no se separen |
| `test/marca-copy.test.ts:149,152,154` | `sinProducto` (4 slugs hardcodeados) → `catalogo` `toBeNull()` / `toMatch(pulpos.shop)` | Dar de alta el producto de un sabor que hoy no tiene liga a catálogo | A FORMA en la **Fase 7** (§9 del spec: "catálogo null en 4 → null o URL de pulpos.shop") |
| `test/marca-copy.test.ts:162-163` | gotas `toHaveLength(6)`; precios `340`/`258` | `:162` agregar una gota; `:163` **cambiar el precio de las gotas** | `:162` A FORMA en la **Fase 7**, sigue en pie · `:163` **BORRADA (ola final, 2026-09-10):** cayó la línea de los precios y el nombre del test dejó de prometer «jengibre y naranja a 340». Mismo caso que `:141`, confirmado en §0.4/§9 del spec ("precios 122/108 y 340/258"); el brief de la Tarea 17 se había quedado corto de alcance |
| `test/marca-copy.test.ts:167` | polvo `toHaveLength(8)` | Agregar una etiqueta de polvo | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:176` | `marca.nav.items` `toContain('Nosotros')` | Renombrar ese ítem del menú | **TRANSFORMADA A FORMA (ola final, 2026-09-10):** ya no exige el texto "Nosotros". La forma que quedó NO es "cada ítem no vacío" —eso ya lo garantiza el esquema, y un assert que repite al esquema da la impresión de proteger sin proteger, que es justo por lo que el lema del pie (`:193`) terminó BORRADO en vez de aflojado—: es que ninguna entrada del menú repita su ancla ni su nombre. Eso el esquema no lo puede ver, porque valida cada ítem por separado, y dos entradas al mismo lugar es el error plausible del día que la clienta reordena el menú. La otra mitad —que cada ancla tenga una sección viva— la cubre el candado 8 |
| `test/marca-copy.test.ts:180` | `marca.preguntas.items` `toHaveLength(8)` | Agregar/quitar una pregunta | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:184` | `marca.recetas.lista` `toHaveLength(4)` | Agregar/quitar una receta | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:193` | el lema del pie, string exacto | Editar el lema | **BORRADA (Tarea 17, 2026-09-10):** cayó entera, no se aflojó a forma como se había previsto — el esquema ya exige no vacío y ≤110 caracteres, así que un `toBeGreaterThan(10)` no hubiera protegido nada que el esquema no proteja ya. La frase de hoy queda congelada en el fixture de la migración |
| `test/marca-tokens.test.ts` | (suite entera) | Nada — tokens de tinta por sabor, contraste, custom properties de fuente | sin asserts de valor de contenido — QUEDA |
| `test/mascota-cabeza.test.ts` | (suite entera) | Nada — geometría/paleta del SVG de la mascota | sin asserts de valor de contenido — QUEDA |
| `test/mascota-completa.test.ts:23` | granos en órbita `toHaveLength(14)` | Nada que la clienta edite — es arte de la mascota, no un ítem de catálogo | sin asserts de valor de contenido — QUEDA |
| `test/mascota-completa.test.ts` (resto) | geometría/paleta/invariantes | Nada — arte de marca | sin asserts de valor de contenido — QUEDA |
| `test/mascota-estructura.test.ts` | (suite entera) | Nada — jerarquía y paleta del SVG de la mascota | sin asserts de valor de contenido — QUEDA |
| `test/mascota-reducida.test.ts` | (suite entera) | Nada — geometría del isotipo reducido | sin asserts de valor de contenido — QUEDA |
| `test/mascota-rig.test.ts` | (suite entera) | Nada — batería de rotación del rig, geometría de arcos | sin asserts de valor de contenido — QUEDA |
| `test/mascota-torso.test.ts` | (suite entera) | Nada — geometría/paleta del torso y brazos | sin asserts de valor de contenido — QUEDA |
| `test/render.test.ts` | (suite entera) | Nada — prueba el script `render-svg.mjs` (rasterizado), no copy | sin asserts de valor de contenido — QUEDA |
| `test/rive.test.ts` | (suite entera) | Nada — `docs/rig-spec.md` es documentación técnica para el rigger, no contenido del sitio | sin asserts de valor de contenido — QUEDA |
| `test/scaffold.test.ts` | `toContain("defaultLocale: 'es-MX'")`, `toContain('lang="es-MX"')` | Nada — configuración de locale del sitio, no un campo editable | sin asserts de valor de contenido — QUEDA |
| `test/seo.test.ts:71-73` | `t.toContain('chocolate'/'coyoacán'/'maracacao')` sobre `marca.titulo` | Reescribir el `<title>` del sitio sin esas palabras clave | **BORRADAS (ola final, 2026-09-10):** cayeron las tres líneas; el test sigue con los topes que Google impone de verdad (≤60 y ≤155) y con el guard anti-maqueta de «construcción». No hay una "forma" razonable para "debe mencionar estas tres palabras". Si Marcos quiere conservar la recomendación de SEO, va como sugerencia en el panel, no como test que rompe el build de la clienta |
| `test/seo.test.ts:131` | `lista.itemListElement` `toHaveLength(15)` | Agregar/quitar un sabor | A FORMA en la **Fase 7** (§9 del spec: `sabores.length`) |
| `test/seo.test.ts:219` | `new RegExp(...${esc(s.nombre)}</h3>)` | Un nombre con `(`, `?`, `+`, `.` | APLICADO (Tarea 2): ya interpola con `esc()` |
| `test/seo.test.ts:116-117` | `negocio.address.streetAddress` `toContain('Mercado de Coyoacán')`, `postalCode` `toBe('04100')` | Cambiar la dirección del negocio | QUEDA por ahora — la dirección está hardcodeada en `src/seo/esquema.ts`, NO en `src/copy/sitio-marca.ts`: hoy la clienta no puede tocarla ni por error. El propio spec (Apéndice A) la lista como pendiente de "sacar al copy" en Fase 2 — cuando eso pase, este assert pasa a BORRAR |
| `test/sitio.test.ts:34` | `toMatch(/\$\s?108/)` (dentro de "renderiza el contenido real...") | **Cambiar el precio de las barras** | **BORRADA (Tarea 17, 2026-09-10):** solo cayó esa línea; las otras cinco aserciones del test se quedan y el nombre del test se actualizó porque ya no enumera "precios". Lo reemplaza el certificado (Tarea 14, detecta cualquier cambio de contenido mostrando cuál) y el candado 4 (Tarea 16, valida el contenido); la aserción de forma 2 del certificado prueba que los precios se siguen renderizando |
| `test/sitio.test.ts:35` | `toContain('Tabasco')` (misma prueba que la fila anterior) | Reescribir la sección "Nosotros" o el chip de origen sin mencionar Tabasco | **BORRADA (ola final, 2026-09-10):** cayó la línea y el nombre del test dejó de enumerar "Tabasco". Es contenido real de `marca.nosotros`/`marca.postura.chips` (texto libre), no un dato técnico; no hay forma razonable de exigir "debe decir Tabasco". Lo que queda del test son los campos leídos del copy, que siguen la edición solos |
| `test/sitio.test.ts:52,58-60` | `recetas.lista` `toHaveLength(4)`; `<details class="receta-completa">` `toHaveLength(4)`; `preguntas.items` `toHaveLength(8)`; `<details class="pregunta">` `toHaveLength(8)` | Agregar/quitar una receta o una pregunta | A FORMA en la **Fase 7** — pasan a `toHaveLength(marca.X.length)` (§9 del spec) |
| `test/sitio.test.ts:66-67` | `aria-label="Canela"`; `--fondo:#7D0303;--texto:#FFFFFF` | Reordenar los sabores o cambiar cuál abre el anaquel | A FORMA en la **Fase 2** — el propio spec (§8.5) ya identifica `sabores.find(slug === 'canela')!` en `index.astro:35` como una bomba de tiempo y planea reemplazarlo por `anaquel.saborInicial`; este test debería pasar a comparar contra ESE campo en vez de contra "Canela" a mano, pero no está en la lista de la §9 del spec — conviene sumarlo cuando se toque eso |
| `test/sitio.test.ts:165-167` | `new RegExp(...${esc(marca.marca.wordmark)}<)` × 3 (cabecera, hero, pie) | Un wordmark con metacaracteres; y asume texto pegado al `>` | APLICADO en parte (Tarea 2): ya interpola con `esc()` en las tres líneas · sigue pendiente aflojar el `<` (Fase 2) |
| `test/sitio.test.ts` — filas BORRADAS de esta auditoría | `productos.barras` `toHaveLength(15)`; `barras.map(nombre)` `toContain('Chocolate blanco con pistache')`; el describe entero de `_barras.astro` (incl. `data-salto=` `toHaveLength(15)`) | — | YA EJECUTADO: `src/copy/sitio.ts` (Tarea 5), `_barras.astro` y `catalogoBarras` (Fase 0 §0.3) se borraron enteros en esta rama, con sus describes. Estos tres asserts no existen más en el archivo — ninguna línea actual los reemplaza. (Ojo al leer el archivo viejo: lo que hoy vive en las líneas 215-247 de `sitio.test.ts` es el describe del formulario con honeypot, sin relación con esto — no confundir) |
| `test/svg-utils.test.ts` | (suite entera) | Nada — prueba los helpers de lectura de SVG (`hexUsados`, `padreDe`, `atributosDeTrazo`) contra fixtures propios | sin asserts de valor de contenido — QUEDA |
| `test/tokenize-svg.test.ts` | (suite entera) | Nada — prueba la función que tokeniza hex a `var()` en los SVG de marca | sin asserts de valor de contenido — QUEDA |
| `test/variantes-logo.test.ts` | (suite entera, incl. `toHaveLength(3)`/`toHaveLength(2)` de `<svg>` en L211/234) | Nada — composición de los componentes de logo/sello, no copy | sin asserts de valor de contenido — QUEDA |

## Notas de esta auditoría

- **La Fase 1 tenía SEIS filas, no tres (corregido 2026-09-10, ola final).**
  La Tarea 17 ejecutó tres —`marca-copy:141`, `marca-copy:193` y
  `sitio.test.ts:34`— porque su brief decía «son tres». El spec (línea 242)
  nombra los CUATRO precios («precios 122/108 **y 340/258**») y esta misma
  tabla ya asignaba a la Fase 1 seis filas vivas: `marca-copy:92,99,100`,
  `marca-copy:105-111`, `marca-copy:163`, `marca-copy:176`, `seo:71-73` y
  `sitio:35`. Las seis quedaron ejecutadas en la ola final; cada fila dice
  qué se hizo con ella. Dos eran A FORMA y no BORRAR — `marca-copy:176` y la
  mitad `:91` de la fila del cacao—, y eso se respetó.

- **Hallazgo más importante, ya en el mensaje del commit:** `sitio.test.ts:34`
  (antes `:77`, corrido de línea — ver el encabezado de estado) congela el
  precio de las barras en un SEGUNDO lugar (`$108` dentro del HTML
  renderizado), aparte del `marca-copy.test.ts:141`. Es el caso de uso n.º 1
  del panel — cambiar el precio de las barras — y hoy rompe el build en dos
  archivos distintos si no se tocan los dos.
- **Precio de las gotas, mismo problema, un archivo más:**
  `marca-copy.test.ts:163` congela `340`/`258` igual que `:141` congela
  `122`/`108`. El spec (§0.4 y §9) ya lo tenía anotado, pero no estaba en las
  once filas verificadas — vale la pena que la Fase 1 lo borre junto con el
  otro precio, no como un caso aparte.
- **Nombres de sabor congelados en texto exacto:**
  `marca-copy.test.ts:105-111` fija los cuatro nombres "decididos" (Jengibre
  y naranja, Fresas y chile, Hierbabuena, Tamarindo con chile) como
  `toContain`/`not.toContain`. No estaba en la lista del spec y es el mismo
  tipo de congelación que un precio: si la clienta renombra un sabor, esto
  revienta.
- **El sabor inicial del anaquel ("Canela") vive en un test, no solo en
  `index.astro`:** `sitio.test.ts:66-67` es el espejo de la bomba de tiempo
  que el spec ya documentó en §8.5 (`sabores.find(s => s.slug === 'canela')!`
  en `index.astro:35`, con el hex `#7D0303`/`#FFFFFF` de `tintaSabor.canela`
  hardcodeado también acá). El spec planea resolverlo en Fase 2 con
  `anaquel.saborInicial`, pero no menciona este test en su lista de la §9 —
  cuando se haga ese cambio, este assert también se tiene que tocar.
- **Contradicción entre dos partes del spec — RESUELTA (2026-09-08, en esta
  rama):** §0.3 decía que `_barras.astro` y `catalogoBarras` se borran en la
  Fase 0. §9 listaba `sitio.test.ts:235` (dentro de esa misma describe) como
  un conteo que sobrevivía hasta la Fase 7. Ganó §0.3: el archivo, el
  describe y `catalogoBarras` se borraron enteros en la Fase 0 de esta rama
  (ver la fila "BORRADAS" más arriba). El propio spec ya lo anota en su
  lista de la §9: `sitio:235 → ... Fila anulada (auditoría 2026-09-08)`. No
  queda nada pendiente de que Marcos resuelva acá.
- **La dirección del negocio (`seo.test.ts:116-117`, antes `:115-116`) no es
  contenido del panel — todavía.** Está hardcodeada en `src/seo/esquema.ts`,
  no en `src/copy/sitio-marca.ts`, así que hoy ninguna edición de la clienta
  la puede romper. El propio spec (Apéndice A) la anota como pendiente de
  mover al copy en Fase 2 — ahí es cuando este assert pasa de QUEDA a
  BORRAR, no antes.
- **Dos archivos enteros están fuera del panel por alcance, no por
  casualidad:** `landing.test.ts` y `manual.test.ts` cubren `/presentacion` y
  `/manual`, las dos páginas privadas (candado, noindex) que consumen
  `src/copy/landing.ts` y `src/copy/marca.ts` — módulos que el panel nunca
  expone (las fases 0-6 solo tocan `sitio-marca.ts`, `sabores.ts`, fichas y
  envolturas). Sus `toBe`/`toContain`/`toHaveLength` son reales pero
  irrelevantes para esta auditoría: ninguna edición de la clienta los toca
  porque la clienta nunca va a poder editar esas páginas.

---

## Actualización 2026-09-14 — Fase 2, Parte A (rama `panel-fase-2-parte-a`)

- **La fila de la dirección del negocio quedó EJECUTADA.** `seo.test.ts:116-117`
  congelaba «Mercado de Coyoacán» y «04100» porque la dirección vivía
  hardcodeada en `src/seo/esquema.ts`. La Tarea 5 la movió al copy: la calle se
  reconstruye de `contacto.puestoTitulo` + `contacto.direccion[0]`, y la
  localidad, el estado y el código postal son campos nuevos
  (`contacto.direccionPostal`). El assert pasó de QUEDA a **A FORMA**: ahora
  compara el JSON-LD contra el copy, no contra literales. Lo que garantiza que
  el valor de hoy no cambió es el verificador de HTML, no el test.
- **Hay un test nuevo que congela TODO el contenido renderizado, a propósito y
  con fecha de vencimiento:** `test/html-normalizado.test.ts` compara las once
  páginas construidas contra `test/fixtures/html-antes-fase-2/`, byte a byte
  salvo los atributos `data-campo`/`data-campo-attr` y los `<span>` que la fase
  2 inventa. Existe para que los ~200 atributos de la Parte B no puedan mover
  la visual sin que se note.
  **Corre en el camino de deploy** (`vercel.json` → `pnpm build` → vitest), así
  que mientras exista, cualquier edición de contenido deja el build en rojo
  hasta que alguien recapture la línea base con `pnpm captura:html`. Hoy eso es
  tolerable porque solo Marcos edita. **La última tarea de la Parte B tiene que
  borrarlo** —el verificador, `test/lib/html-normalizado.ts`,
  `scripts/captura-html.ts`, la carpeta de fixtures y la línea `@source not` de
  `global.css`— o sacarlo del camino de Vercel. No puede seguir ahí el día que
  la clienta entre al panel.

## Actualización 2026-09-15 — Fase 2, Parte B, Tarea 14 (cierre)

- **BORRADO, como estaba prometido arriba.** El commit «feat: la biyección
  campo ↔ HTML está completa, y el verificador se retira» borra
  `test/html-normalizado.test.ts`, `test/lib/html-normalizado.ts`,
  `scripts/captura-html.ts`, `test/fixtures/html-antes-fase-2/`, el script
  `captura:html` de `package.json` y la línea `@source not` (con su
  comentario) de `global.css`. Las catorce tareas de la Parte B pasaron por
  él en verde sin recapturar ni una vez; su reemplazo es el medidor
  diferencial de la fase 4 — hasta que exista, lo que protege la visual son
  los topes de caracteres del esquema, puestos desde la fase 1.

## Actualización 2026-09-15 — revisión final de `panel-fase-2-parte-b` (fix)

- **`test/panel.test.ts` entra a esta tabla.** No congela un VALOR de
  contenido —eso lo dejó BORRADO la fila de arriba, a propósito—, congela
  la FORMA de la biyección campo ↔ HTML (spec §3.1), y es lo que reemplazó
  de verdad al verificador retirado arriba para SU clase de regresión: «el
  nodo marcado dejó de mostrar lo que el campo dice». Contra las tres
  páginas construidas (`dist/index.html`, `dist/404.html`,
  `dist/fichas-tecnicas/index.html`) mide tres cosas: **(a)** que todo
  campo editable tenga al menos un nodo en ALGUNA de las tres —no por
  página: un campo se da por marcado si aparece en cualquiera de las
  páginas donde vive, porque desde ahí lo puede editar la clienta—;
  **(b)** que todo `data-campo`/`data-campo-attr`/`data-campo-alterno` del
  HTML apunte a un campo que existe en el esquema y resuelve a texto o
  número; y **(c)** —agregada en esta revisión (hallazgo I-1)— que el
  nodo muestre el valor CRUDO del campo, salvo que la plantilla lo
  transforme a propósito (lista `TRANSFORMADOS` del propio archivo, D5).
  (c) es la que de verdad reemplaza al verificador para esta clase de
  regresión: donde el verificador comparaba contra una CAPTURA byte a
  byte y se ponía rojo con cualquier copy nuevo, (c) compara contra el
  CONTENIDO de hoy, así que una edición legítima de la clienta no lo toca.
- **(b) puede ponerse rojo con una edición legítima, y hay que saber
  leerlo.** Si la clienta vacía un campo OPCIONAL (deja en `null` un
  precio, por ejemplo) y el nodo de ESE campo está marcado SIN
  condición —no adentro de un `if`/ternario que lo salte cuando el valor
  falta—, la plantilla lo sigue renderizando, pero ahora con un valor que
  ya no resuelve a texto ni a número, y (b) lo rechaza con «no resuelve a
  un texto ni a un número». No es un bug de (b): es que ese nodo tenía que
  nacer CONDICIONADO al valor desde el principio. `sitio:negocios.tabs.0.precio`
  en `src/pages/index.astro` es el patrón a copiar —`i === 0 ? <span
  data-campo="…">{precioMXN(t.precio)}</span> : precioMXN(t.precio)}`,
  adentro de la rama que ya exige `t.precio != null`— y mientras el valor
  falte, la ruta vive en `SIN_NODO`, no en el HTML.
- **`SIN_NODO` bajó de seis a CINCO excepciones en esta revisión**
  (hallazgo I-3): `sabores:gotas[].precio`; las tres del JSON-LD
  (`sitio:contacto.direccionPostal.{localidad,estado,codigoPostal}`); y
  `sitio:negocios.tabs.0.precio`. Cada una vive en el propio
  `test/panel.test.ts`, con su razón en el comentario de al lado — no se
  repite acá para no tener dos listas que se puedan desincronizar.
  `sitio:contacto.formulario.asuntoNegocio` salió de la lista: `data-campo-attr`
  ahora acepta más de una referencia separada por espacio en el mismo
  atributo, así que el `<form>` de contacto marca `asuntoPersonal` Y
  `asuntoNegocio` a la vez sin competir por el único atributo HTML que
  tenía antes.

---

## Actualización 2026-09-17 — la compuerta deja de congelar contenido (rama `compuerta-no-congela`)

**Por qué ahora.** La primera prueba de humo en producción terminó con el
panel publicando bien (commit `e51ca6b`, autor `Panel Maracacao
<panel@maracacao.mx>`) y el deploy de Vercel en rojo: `vercel.json` corre
`pnpm build` = `astro build && vitest run && astro check`, así que **cualquier
test que compare contra un valor de contenido le bloquea la publicación a la
clienta**. Era el pendiente que esta misma auditoría venía anotando fase tras
fase; hoy se ejecutó.

**Cómo se buscó, para que se pueda repetir.** No a ojo: se escribió un script
temporal que recorre los tres esquemas (`recorre()`), se queda con los campos
que la clienta edita (`quien !== 'marcos'`, control `texto`/`parrafo`/`medida`/
`precio`/`renglones`), instancia cada patrón contra el JSON real —incluidas
las tablas `filas[][]`— y **edita todos**, descartando la edición cuando el
esquema la rechaza. Dos pasadas, porque una sola no alcanza: con el sufijo
(`«…ç»`) un `toContain('Contiene soya…')` sigue pasando, y solo cae con el
prefijo (`«ç…»`). Después, `pnpm build` completo. Medido: **647 campos
editados, 4 rechazados por el esquema** (el esquema los rechaza en el panel,
que es donde tiene que pasar). A eso se sumaron los tres casos de campo
opcional, que ningún reemplazo de texto encuentra: agregarle el chip de polvo
a otra receta, sacárselo a la única que lo tiene, y ponerle precio al tab del
polvo.

**Resultado antes del arreglo:** 31 tests en rojo en 3 archivos, por cinco
causas; más 3 rojos por los casos de campo opcional. **Después:** los cinco
escenarios pasan la compuerta entera en verde, y el contenido sin tocar sigue
en 1000 tests verdes + `astro check` limpio.

| Assert | Qué edición lo rompía | Destino |
|---|---|---|
| `test/contenido-fachada.test.ts` — **el certificado** (3 `toEqual` contra `test/fixtures/contenido-2026-09-10.json`) | CUALQUIERA. Es lo que rompió el deploy de la prueba de humo | **BORRADO.** Era el destino que esta tabla ya le tenía escrito a esta clase de assert. El fixture QUEDA (es el acta, y lo siguen usando `contenido.test.ts` y `contenido-mutaciones.test.ts` como dato de entrada). Lo que lo reemplaza para su trabajo real —«que el contenido no cambie sin que nadie se entere»— es el diff que el panel le muestra a la clienta antes de publicar (`src/contenido/diff.ts` → `frase()`) y que queda escrito en el mensaje del commit |
| `contenido-fachada.test.ts` — aserción de forma **4** (`puestoTitulo.join(' ')` `toBe('Mercado de Coyoacán')`) | Mudar el puesto, o renombrarlo | **BORRADA.** No era una forma: era el valor. Lo que sí importa —que el `streetAddress` del JSON-LD salga de ese join y no de una copia a mano— ya lo mide `test/seo.test.ts:138` contra el copy |
| `contenido-fachada.test.ts` — aserción de forma **8** (`toContain(' ')` en ocho campos, y NUEVE espacios duros en total) | Escribir un título sin medida («Polvo de cacao»), o dejar una sola medida donde hay dos | **BORRADA.** La regla de verdad —«si hay cifra seguida de unidad, el espacio del medio es duro»— la exige el esquema (`medida` / `MEDIDA_MAL_ESCRITA`) en el panel, antes de publicar. Medido: el esquema acepta «Polvo de cacao» y este test lo rechazaba |
| `contenido-fachada.test.ts` — aserción **1** (`conChip` `toHaveLength(1)`) | Agregarle el chip de polvo a otra receta, o sacárselo a la única que lo tiene | **A FORMA.** Queda «la receta que trae chip lo trae con texto, nunca vacío», que es la regresión real (un `''` pinta una cajita amarilla de 6×10 px). Cuántas lo traen es decisión de la clienta |
| `contenido-fachada.test.ts` — aserción **2** («el precio es null exactamente en el tab del polvo») | Ponerle precio de lista al polvo | **A FORMA.** Queda «null o entero, nunca undefined», que es lo que evita el «$NaN». Cuál de los tres está en null es contenido |
| `test/sitio.test.ts` — `aria-label="Canela"` y `--fondo:#7D0303;--texto:#FFFFFF` | Reordenar el anaquel, renombrar el sabor inicial, o cambiar cuál abre | **A FORMA**, como esta tabla preveía desde la fase 0: el assert sale de `marca.anaquel.saborInicial` + los tokens de color, sin un solo literal |
| `test/marca-copy.test.ts` — `ingredientes` y `cacao` contra `src/contenido/datos/envolturas.json` (26 tests) | Corregirle una coma a los ingredientes, o tocar el «Cacao 70%» | **EL TEST QUEDA; los dos campos pasan a `quien: 'marcos'`.** Es la única fila que se resolvió del otro lado, y a propósito: los ingredientes son información de alérgenos y `cacao` es lo que dice el empaque físico. Dejarlos editables no era «más libertad»: era permitir que el sitio contradiga a la envoltura impresa. El camino correcto va al revés —se reimprime, Marcos actualiza `envolturas.json`, y de ahí baja al sitio—. Se les sacó el `data-campo` de `index.astro` (348 y 353), porque el panel no resalta lo que no edita |
| `test/panel.test.ts` — `SIN_NODO` con `sitio:negocios.tabs.0.precio`, y el test de «excepciones no podridas» | Ponerle precio al polvo: aparece el nodo y la excepción queda «ya hecha» | **BORRADA la excepción**, reemplazada por una regla general: (a) saltea el campo que HOY no tiene valor mostrable (`tieneValorHoy`), porque un `null` no puede tener nodo. No afloja nada: un campo con valor y sin nodo sigue siendo huérfano. Las excepciones bajaron de cinco a CUATRO |
| `test/panel.test.ts` — el test de `TRANSFORMADOS` podridos | Ponerle precio al polvo: el nodo aparece mostrando «$90» donde el campo dice `90` | **Entrada nueva** (`sitio:negocios.tabs.0.precio` → `precioMXN()`), y el chequeo de podredumbre ahora distingue **dormida** de **podrida**: una entrada sin ningún nodo hoy está esperando, no mintiendo |

**Lo que NO se tocó, y por qué.** Los `toHaveLength` de la fase 7 (15 sabores,
4 recetas, 8 preguntas, 6 gotas, 8 etiquetas de polvo, 4 fichas) siguen en
pie: el panel de hoy edita HOJAS, no da de alta ni de baja elementos de lista,
así que ninguna edición que la clienta pueda hacer los rompe. Cuando la fase 7
le dé de alta un sabor, se ejecutan las filas que esta tabla ya les tiene
asignadas.

**Cómo mantenerlo.** La regla es la misma de siempre y ahora tiene una prueba
barata: antes de sumar un assert que mire contenido, preguntarse si la clienta
puede escribir ese valor desde el panel. Si puede, el assert no va en
`pnpm verifica` — va como regla del esquema (que le avisa a ella antes de
publicar) o no va.

---

## Pendiente abierto (2026-09-18, cierre de la fase 5B) — el aviso que no bloquea contra el test que sí

**El servidor le promete a la clienta que un aviso de conteo NUNCA bloquea una
publicación. El build dice que sí.** Las dos piezas son de este repo, las dos
son defendibles por separado, y juntas producen el peor modo de falla que tiene
el proyecto.

- `src/servidor/acciones.ts` (`publicarAccion`) calcula los avisos **después**
  de escribir, a propósito y documentado: «un aviso, por definición, no puede
  bloquear una publicación». Hay un test dedicado a eso.
- `test/contenido.test.ts:2199` —**preexistente**, no lo trajo la fase 5B— se
  pone **rojo** si el contenido publicado tiene un texto cuyo conteo no coincide
  con la lista real. Y `vercel.json` corre los tests en el deploy.

O sea: si ella publica «LOS 16 SABORES» con quince en la lista, el servidor le
contesta 200 con un aviso amable, el commit sale, **el build se cae**, la
reversión automática le deshace el cambio, y recibe «No salió; lo dejé como
estaba». Una edición legítima que se deshace sola, sin ninguna pista de por qué.

El aviso existe porque es **su** decisión arreglarlo después —puede estar por
dar de alta el sabor dieciséis y querer dejar el texto listo—. El test existe
porque un sitio que miente sobre cuántos sabores tiene es un sitio roto.

**Las tres salidas, para que Marcos elija una:**

1. **El aviso pasa a impedir.** Coherente, pero le quita el «lo arreglo
   después» y contradice al spec.
2. **El test deja de ser un test y pasa a ser un correo** a Marcos — la capa 4
   (`.github/workflows/verifica.yml`) que el spec §4.4 describe como «juez
   posterior que le avisa a Marcos, no compuerta». El build no se cae, ella
   publica, y alguien se entera igual.
3. **El test se afloja a la forma y no al valor.** Coherente con el criterio de
   este documento, pero pierde la única red que hoy atrapa un sitio que miente
   sobre sí mismo.

La lectura de quien lo encontró —y la comparto— es que la **(2)** respeta las
dos promesas y es la que la arquitectura ya tenía prevista. Pero es una decisión
de producto, no de implementación, y por eso queda acá y no resuelta.
