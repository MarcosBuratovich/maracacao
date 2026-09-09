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

Tres destinos posibles:

- **BORRAR** — el valor pasa a ser editable; la verdad histórica queda en el
  fixture de la migración, que es el acta, no la ley.
- **A FORMA** — el assert se queda pero deja de mirar el valor.
- **QUEDA** — no congela contenido; no se toca.

Alcance: "contenido" acá es lo que la clienta va a poder tocar desde el panel
(`src/copy/sitio-marca.ts`, `src/copy/sabores.ts`, las fichas técnicas,
`docs/envolturas.json`). Los tokens de diseño (`@/tokens/*`), la geometría de
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
| `test/marca-copy.test.ts:55` | lee `docs/envolturas.json` | Ninguna | QUEDA (Fase 1 lo mueve a `datos/`) |
| `test/marca-copy.test.ts:61` | sabores `toHaveLength(15)` | Agregar un sabor | A FORMA en la **Fase 7**, no ahora |
| `test/marca-copy.test.ts:62-64` | `sabores.map(orden).sort()` `toEqual([1..15])` | Agregar/quitar un sabor (deja huecos en el orden) | A FORMA en la **Fase 7** — pasa a "1..sabores.length sin huecos" (§9 del spec) |
| `test/marca-copy.test.ts:91-92,99-100` | `impreso` `toBe('73%')`; `s.cacao` `toBe('Cacao 70%')` / `toBe('Chocolate blanco')` | Editar el % de cacao mostrado de mango/piña/chamoy/blanco | `:91` QUEDA (es el hecho impreso en la envoltura física, no copy del sitio) · `:92,99,100` BORRAR (Fase 1) — `s.cacao` es contenido de `sabores.ts`, el mismo tipo de valor que el precio |
| `test/marca-copy.test.ts:105-111` | `nombres` `toContain('Jengibre y naranja')`/`'Fresas y chile'`/`'Hierbabuena'`/`'Tamarindo con chile')` y sus `not.toContain` | **Renombrar un sabor** (ej. "Hierbabuena" → "Menta") | BORRAR (Fase 1) — es exactamente el caso "nombre" del criterio; la verdad de qué dice la envoltura impresa queda en el fixture, no en un test que se lee en vivo |
| `test/marca-copy.test.ts:118-129` | exige CINCO archivos por sabor | Alta de sabor con solo la foto de la barra | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:141` | precios `122` / `108` | Cambiar un precio | BORRAR (Fase 1) |
| `test/marca-copy.test.ts:149,152,154` | `sinProducto` (4 slugs hardcodeados) → `catalogo` `toBeNull()` / `toMatch(pulpos.shop)` | Dar de alta el producto de un sabor que hoy no tiene liga a catálogo | A FORMA en la **Fase 7** (§9 del spec: "catálogo null en 4 → null o URL de pulpos.shop") |
| `test/marca-copy.test.ts:162-163` | gotas `toHaveLength(6)`; precios `340`/`258` | `:162` agregar una gota; `:163` **cambiar el precio de las gotas** | `:162` A FORMA en la **Fase 7** · `:163` BORRAR (Fase 1) — mismo caso que `:141`, confirmado en §0.4/§9 del spec ("precios 122/108 y 340/258") |
| `test/marca-copy.test.ts:167` | polvo `toHaveLength(8)` | Agregar una etiqueta de polvo | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:176` | `marca.nav.items` `toContain('Nosotros')` | Renombrar ese ítem del menú | A FORMA (Fase 1) — mismo caso que el lema del pie (`:193`): cada ítem de nav no vacío, sin exigir el texto "Nosotros" |
| `test/marca-copy.test.ts:180` | `marca.preguntas.items` `toHaveLength(8)` | Agregar/quitar una pregunta | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:184` | `marca.recetas.lista` `toHaveLength(4)` | Agregar/quitar una receta | A FORMA en la **Fase 7** |
| `test/marca-copy.test.ts:193` | el lema del pie, string exacto | Editar el lema | A FORMA (Fase 1): min/max y no vacío |
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
| `test/seo.test.ts:71-73` | `t.toContain('chocolate'/'coyoacán'/'maracacao')` sobre `marca.titulo` | Reescribir el `<title>` del sitio sin esas palabras clave | BORRAR (Fase 1) — `marca.titulo` vive en `sitio-marca.ts` y pasa a ser editable; no hay una "forma" razonable para "debe mencionar estas tres palabras", así que el assert se va. Si Marcos quiere conservar la recomendación de SEO, va como sugerencia en el panel, no como test que rompe el build |
| `test/seo.test.ts:131` | `lista.itemListElement` `toHaveLength(15)` | Agregar/quitar un sabor | A FORMA en la **Fase 7** (§9 del spec: `sabores.length`) |
| `test/seo.test.ts:218` | `new RegExp(...${esc(s.nombre)}</h3>)` | Un nombre con `(`, `?`, `+`, `.` | APLICADO (Tarea 2): ya interpola con `esc()` |
| `test/seo.test.ts:116-117` | `negocio.address.streetAddress` `toContain('Mercado de Coyoacán')`, `postalCode` `toBe('04100')` | Cambiar la dirección del negocio | QUEDA por ahora — la dirección está hardcodeada en `src/seo/esquema.ts`, NO en `src/copy/sitio-marca.ts`: hoy la clienta no puede tocarla ni por error. El propio spec (Apéndice A) la lista como pendiente de "sacar al copy" en Fase 2 — cuando eso pase, este assert pasa a BORRAR |
| `test/sitio.test.ts:34` | `toMatch(/\$\s?108/)` (dentro de "renderiza el contenido real...") | **Cambiar el precio de las barras** | BORRAR (Fase 1) — es el caso de uso n.º 1 del panel. (La cita original de esta fila decía "Tarea 5"; eso era el otro `$108`, el de `src/copy/sitio.ts` — ver fila borrada más abajo. Este es un assert distinto, sobre el HTML que sí se sigue publicando) |
| `test/sitio.test.ts:35` | `toContain('Tabasco')` (misma prueba que la fila anterior) | Reescribir la sección "Nosotros" o el chip de origen sin mencionar Tabasco | BORRAR (Fase 1) — es contenido real de `marca.nosotros`/`marca.postura.chips` (texto libre), no un dato técnico; no hay forma razonable de exigir "debe decir Tabasco" |
| `test/sitio.test.ts:52,58-60` | `recetas.lista` `toHaveLength(4)`; `<details class="receta-completa">` `toHaveLength(4)`; `preguntas.items` `toHaveLength(8)`; `<details class="pregunta">` `toHaveLength(8)` | Agregar/quitar una receta o una pregunta | A FORMA en la **Fase 7** — pasan a `toHaveLength(marca.X.length)` (§9 del spec) |
| `test/sitio.test.ts:66-67` | `aria-label="Canela"`; `--fondo:#7D0303;--texto:#FFFFFF` | Reordenar los sabores o cambiar cuál abre el anaquel | A FORMA en la **Fase 2** — el propio spec (§8.5) ya identifica `sabores.find(slug === 'canela')!` en `index.astro:35` como una bomba de tiempo y planea reemplazarlo por `anaquel.saborInicial`; este test debería pasar a comparar contra ESE campo en vez de contra "Canela" a mano, pero no está en la lista de la §9 del spec — conviene sumarlo cuando se toque eso |
| `test/sitio.test.ts:165-167` | `new RegExp(...${esc(marca.marca.wordmark)}<)` × 3 (cabecera, hero, pie) | Un wordmark con metacaracteres; y asume texto pegado al `>` | APLICADO en parte (Tarea 2): ya interpola con `esc()` en las tres líneas · sigue pendiente aflojar el `<` (Fase 2) |
| `test/sitio.test.ts` — filas BORRADAS de esta auditoría | `productos.barras` `toHaveLength(15)`; `barras.map(nombre)` `toContain('Chocolate blanco con pistache')`; el describe entero de `_barras.astro` (incl. `data-salto=` `toHaveLength(15)`) | — | YA EJECUTADO: `src/copy/sitio.ts` (Tarea 5), `_barras.astro` y `catalogoBarras` (Fase 0 §0.3) se borraron enteros en esta rama, con sus describes. Estos tres asserts no existen más en el archivo — ninguna línea actual los reemplaza. (Ojo al leer el archivo viejo: lo que hoy vive en las líneas 215-247 de `sitio.test.ts` es el describe del formulario con honeypot, sin relación con esto — no confundir) |
| `test/svg-utils.test.ts` | (suite entera) | Nada — prueba los helpers de lectura de SVG (`hexUsados`, `padreDe`, `atributosDeTrazo`) contra fixtures propios | sin asserts de valor de contenido — QUEDA |
| `test/tokenize-svg.test.ts` | (suite entera) | Nada — prueba la función que tokeniza hex a `var()` en los SVG de marca | sin asserts de valor de contenido — QUEDA |
| `test/variantes-logo.test.ts` | (suite entera, incl. `toHaveLength(3)`/`toHaveLength(2)` de `<svg>` en L211/234) | Nada — composición de los componentes de logo/sello, no copy | sin asserts de valor de contenido — QUEDA |

## Notas de esta auditoría

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
