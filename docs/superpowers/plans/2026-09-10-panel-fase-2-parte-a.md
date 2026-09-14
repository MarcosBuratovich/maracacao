# Panel del cliente · Fase 2, Parte A — El terreno antes de los doscientos atributos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el verificador que hace segura toda la fase 2, y cerrar las siete minas de `index.astro` que hoy hacen que un campo editable no llegue a la página — antes de tocar un solo `data-campo`.

**Architecture:** La fase 2 pone ~195 `data-campo` en un archivo de 1.940 líneas, y eso **cambia el HTML renderizado, no solo sus atributos**: hay siete lugares donde el campo no tiene elemento propio y hay que inventar un `<span>`. Verificar eso a ojo es imposible. Esta parte construye primero el **diff normalizado** —parsear el HTML de antes y de después, borrar los `data-campo*`, desenvolver los `<span data-campo>` sin otro atributo, y exigir que el resto sea idéntico byte a byte— y después lo ejercita sobre siete cambios chicos y reales de `index.astro`, cada uno con su propia razón de existir.

**Tech Stack:** Astro 7 estático, Vitest 4, TypeScript 6, `linkedom` (ya en devDependencies), Zod 4.4.3, pnpm 11.2.2.

**Spec:** `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` — secciones `3.1`, `3.2` y la entrada `FASE 2` del orden de trabajo.

**Base:** `main` en `4946322` (Fase 1 completa: partes A y B mergeadas, 879 tests verdes).

**Entrega de la Parte A:** el verificador existe y está probado; los siete campos que hoy la clienta puede editar sin que pase nada empiezan a pasar algo; y `index.astro` queda listo para que la Parte B le ponga los atributos.

---

## Por qué esta fase va en dos partes

La Parte B son ~195 atributos repartidos en 1.940 líneas, y siete de ellos obligan a inventar elementos que hoy no existen. **Escribirlos contra un verificador que todavía no se probó es exactamente el error que la fase 1 no cometió.**

Y hay una razón más, que salió de medir: los siete cambios de esta parte **son cambios de markup de verdad**, chicos y con consecuencias visibles. Son el mejor banco de pruebas posible para el verificador antes de confiarle 195.

La Parte B se planifica cuando la A cierre, con el verificador ya en pie.

---

## Lo que medí antes de escribir esto

No es contexto de color: cada número de acá abajo cambia una tarea.

**El inventario de campos**, corriendo `recorre()` sobre los tres documentos:

```
 156  cliente/texto        ← llevan data-campo
  28  cliente/parrafo      ← llevan data-campo
   7  cliente/medida       ← llevan data-campo
   4  cliente/precio       ← llevan data-campo
  32  marcos/oculto        ← NO
   4  marcos/derivado      ← NO (se dibujan en gris)
   2  marcos/texto         ← NO
 ---
 233 rutas en total → 195 necesitan data-campo, 15 de ellas en atributo,
                      20 con falla:['ninguno'] (no se miden nunca)
```

**Y los 195 contra el HTML construido de hoy:**

```
  aparecen 1 vez:    95
  aparecen 2+:       82   ← el mapeo UNO-A-MUCHOS del spec §3.1
  NO aparecen:        9   ← estos son las tareas de esta parte
```

**Los nueve que no aparecen, y por qué.** Es el hallazgo que ordena todo este plan:

| Campo | Por qué no aparece | Tarea |
|---|---|---|
| `nav.cerrar` | `marca.ts:118` tiene `'Cerrar menú'` escrito a mano | 4 |
| `nav.abrir` | ídem, misma línea | 4 |
| `contacto.copiado` | `marca.ts:301` tiene `'¡Copiado!'` escrito a mano | 4 |
| `contacto.formulario.enviando` | `marca.ts:355` tiene `'Enviando'` escrito a mano | 4 |
| `hero.titular.1` | `index.astro:146` le saca la coma con `.replace(/,$/,'')` | Parte B |
| `footer.legalesNota` | `index.astro:763` lo pinta con `.toLowerCase()` | Parte B |
| `minis.precio` | `precioMXN()` lo formatea: sale «$118», no «118» | Parte B |
| `sabores[].precio`, `gotas[].precio` | ídem | Parte B |
| `negocios.tabs.0.precio` | es `null` a propósito (el polvo no se vende) | — |

**Los cuatro primeros son una mina activa, no una curiosidad.** Hoy la clienta abre el panel, edita «¡Copiado!», guarda, publica — **y no pasa nada**, porque el script tiene el texto adentro. Es la peor clase de edición fallida: la que parece que funcionó.

**Los siete lugares donde el campo no tiene elemento propio** (líneas de hoy, verificadas):

```
:145-147  los tres renglones del <h1>, nodos de texto entre <br>
:216      <li><span>✓</span>{item}</li>
:305      {fichaEtiqueta} {d.orden} {contadorDe}
:317      {ingredientesEtiqueta}: {d.ingredientes}.
:342      {minis.titulo} · {precioMXN(minis.precio)}
:362      {gotas.notaPrecio}: {precioMXN(...)}
:538      {t.precio === null ? t.precioNota : `${t.precioNota} ${precioMXN(t.precio)}`}
```

**Dos cosas del spec que ya NO hay que hacer**, y las verifiqué:

- **El try/catch del visor 3D ya existe** (`src/scripts/marca.ts:277-283`, con su comentario: «Si el visor no carga, se queda la imagen. La página no se entera»). El spec lo lista como trabajo de la fase 2 y está viejo ahí.
- **Las 15 ilustraciones existen todas** en `public/sitio/marca/`. La ilustración condicional no arregla un hueco de hoy: prepara la fase 7, cuando la clienta pueda dar de alta un sabor que todavía no tenga dibujo. Se hace igual, pero por esa razón y no por la que uno supondría.

**Y la dirección postal está escrita dos veces**, con las mismas cinco verdades en dos formas:

```
copy    contacto.direccion[0]  «Malintzin s/n, Col. del Carmen»
copy    contacto.direccion[1]  «Coyoacán, C.P. 04100, CDMX»
copy    contacto.puestoTitulo  «Mercado de Coyoacán»
JSON-LD seo/esquema.ts:30-34   «Mercado de Coyoacán, Malintzin s/n, Col. del Carmen»
                               + Coyoacán / Ciudad de México / 04100
```

Si el puesto se muda, ella edita el copy y **Google sigue mostrando la dirección vieja** en su ficha de negocio. Es el mismo modo de falla que los precios derivados de la fase 1, sobre el dato que más caro sale tener mal.

---

## Global Constraints

Valen para toda tarea de este plan.

- **Ningún cambio puede alterar el HTML renderizado más allá de lo que el verificador permite.** Lo que permite: atributos `data-campo` y `data-campo-attr`, y `<span data-campo>` sin otro atributo. Todo lo demás tiene que salir **idéntico byte a byte**. Cuando una tarea cambia el HTML a propósito (Tareas 2, 5, 6 y 7), lo declara y explica qué cambió y por qué.
- **La línea base geométrica del CI se toma DESPUÉS de la fase 2, nunca antes.** Sobre un DOM que va a cambiar no se mide nada. Ninguna tarea de este plan la toma.
- **REGLA DURA DE LA CARPETA:** `src/contenido/**` no importa `node:*`, no importa Astro, y usa solo rutas relativas sin extensión. El guard es lista blanca desde la fase 1: permite `zod`, rutas relativas sin extensión, y `.json` bajo `datos/`. Nada más.
- **Las etiquetas y ayudas que ve la clienta van en español mexicano, sin jerga.** La ayuda dice DÓNDE VIVE el texto. Los comentarios del código van en español rioplatense y explican POR QUÉ.
- **Vocabulario prohibido de MARCA:** «mono», «chango», «changuito», «chispa(s)», «carrito», «pistachos», «cacahuete», «maní», «packaging», «snack», «smoothie».
- **Precios como número entero**, 1–99.999. **Colores solo desde tokens.** **El sitio queda 100% estático.**
- **Los invisibles se escriben como escape (`\u00a0`), nunca se pegan.** En la fase 1 esto mordió a cinco implementadores, en las dos direcciones. Después de tocar cualquier archivo con invisibles, verificalo:
  ```bash
  python3 -c "import io;print(io.open('<archivo>',encoding='utf-8').read().count(chr(0xa0)))"
  ```
- **Línea de base:** hoy `pnpm test` da **879 tests verdes** (32 archivos) y `pnpm typecheck` **0 errores, 0 warnings, 3 hints**. Ninguna tarea puede bajar el verde.
- **`pnpm build` es la compuerta:** construye el sitio, corre la suite y `astro check`.
- **Commits en español, imperativo,** terminando con:

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

### La regla de método, que en la fase 1 encontró once defectos del plan

> **Todo test que se escriba tiene que venir con su prueba de que falla.** No alcanza con verlo pasar. Hay que romper a propósito lo que el test dice cuidar, verlo dar **rojo**, restaurar, y pegar las dos salidas en el reporte.

En la fase 1 esa regla encontró, entre otras cosas: un test que probaba el tope de caracteres creyendo que probaba una coma; una aserción que decía proteger de un `</script` y nunca ejercitaba el caso; y un candado de conteos que **premiaba el error y castigaba la corrección**. Ninguno de los tres se veía leyendo el código.

Si un paso de este plan te hace escribir un test y **no** te dice cómo probar que falla, eso es un defecto del plan: paralo y decilo.

### Cómo se prueba el rojo de una aserción de TIPO

**Vitest no tipa.** Transpila con esbuild y tira los tipos, así que un test que afirma una forma de tipo pasa en verde desde antes de implementar nada, y `expectTypeOf()` se borra en runtime. El rojo existe pero vive en **`pnpm typecheck`** (que es `astro check`, y cubre `test/` porque el tsconfig no lo excluye).

> Donde un paso diga «FAIL en compilación», el comando es `pnpm typecheck`, no `vitest run`.

---

## File Structure

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `test/lib/html-normalizado.ts` | El normalizador: parsea, borra `data-campo*`, desenvuelve los `<span data-campo>` sin otro atributo, y devuelve HTML comparable. |
| `test/html-normalizado.test.ts` | Los tests del normalizador. Es una herramienta antes que un test, y se prueba como tal. |
| `scripts/captura-html.ts` | Captura el HTML de las páginas construidas a un archivo, para comparar antes/después. |
| `test/fixtures/html-antes-fase-2/` | La foto del HTML de hoy. Se captura UNA vez, antes de tocar markup. |
| `src/contenido/textos-ui.ts` | Los textos que el script pinta en runtime, extraídos del contenido para que el `<script id="textos-ui">` los publique. |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `src/pages/index.astro` | Siete cambios chicos, uno por tarea, cada uno declarado. |
| `src/scripts/marca.ts` | Deja de tener cuatro textos escritos a mano; los lee del `<script id="textos-ui">`. |
| `src/seo/esquema.ts` | La dirección postal sale del copy en vez de estar escrita ahí. |
| `src/contenido/esquema/sitio/producto.ts` | `anaquel.saborInicial` nuevo; `anaquel.contadorDe` pasa a derivado. |
| `src/contenido/derivados.ts` | El `contadorDe` se suma a la tabla. |
| `src/contenido/datos/sitio.json` | Lo reescribe el script, no vos. |
| `test/fixtures/contenido-2026-09-10.json` | Se actualiza **a mano y en el mismo commit** cuando el contenido cambie a propósito (Tareas 3 y 6). |
| `src/scripts/marca.ts`, `src/styles/marca.css` | El `'canela'` escrito a mano en tres lugares pasa a salir del dato. |

---

## Barrido previo de conflictos

| Qué revisé | Resultado |
|---|---|
| T1 (verificador) × T2–T7 | **Dependencia dura.** Ninguna tarea que toque markup puede verificarse sin él. T1 primera, y su fixture se captura **antes** de que T2 cambie una línea. |
| T3 (`saborInicial`) × T1 (fixture del HTML) | **Conflicto real.** T3 cambia el HTML a propósito (el `!` se va). El fixture de T1 es de ANTES; T3 declara su cambio y actualiza la línea base. Ruling A. |
| T3 × el certificado de la fase 1 | T3 agrega un campo al esquema y al JSON → el certificado da **rojo**. Es correcto y esperado: hay que actualizar el fixture de contenido en el mismo commit. Está escrito en la tarea. |
| T6 (`contadorDe` derivado) × el certificado | Mismo caso: sale del JSON, entra a la tabla de derivados. El fixture se actualiza en el mismo commit. |
| T4 (`textos-ui`) × T1 | T4 agrega un `<script>` nuevo al HTML. **El normalizador NO lo desenvuelve** — es un elemento con contenido, no un `<span data-campo>` pelado. T4 declara el cambio. |
| T5 (dirección al copy) × el HTML | El JSON-LD renderizado **cambia de contenido** si las cinco verdades no se reconstruyen idénticas. Es el riesgo central de esa tarea y tiene su propio test. |
| T2 (arreglos diferidos) × T1 | `{'chipPolvo' in r}` → `{r.chipPolvo}` **no cambia el HTML de hoy** (las tres recetas sin chip no tienen la clave). Es el mejor primer ejercicio del verificador: cambio de código, cero cambio de salida. |
| El plan contra el rubro de revisión | Ningún paso manda duplicar lógica ni escribir un test que no afirme. Los siete cambios de markup van en siete commits, uno por causa. |

**Rulings tomados antes de arrancar:**

**Ruling A — el fixture del HTML se captura una vez y se actualiza declarando el cambio.** Cuatro de las siete tareas cambian el HTML a propósito. La alternativa —recapturar en cada tarea— convertiría el verificador en un espejo: siempre verde, nunca útil. Así que la línea base se captura en T1 y **cada tarea que la cambie explica en su commit qué cambió y por qué**, con el diff normalizado pegado en el reporte. *Costo si me equivoco:* una actualización manual por tarea, que es justo la fricción que hace que alguien lea el diff.

**Ruling B — `contacto.copiado` no se borra, se conecta.** Es un campo del esquema sin ningún consumidor: la tentación es tratarlo como muerto. Pero el texto existe en el script, escrito a mano: no está muerto, está **desconectado**. Borrarlo le sacaría a la clienta un texto que la página sí muestra. *Costo si me equivoco:* un campo más en el panel, que es lo que ya declara el esquema.

**Ruling C — el visor 3D no se toca.** El spec lo lista, pero su try/catch ya existe desde antes de esta fase y hace exactamente lo que el spec pide. Lo verifiqué en `marca.ts:277-283`. Ejecutar un ítem del spec que ya está hecho es riesgo sin beneficio. *Costo si me equivoco:* una línea del spec que queda sin tachar, anotada acá.

**Ruling D — el `alt` del visor 3D (`'La barra en tres dimensiones; arrastra para girarla'`) NO entra en esta parte.** Es un quinto texto escrito a mano en el script, y a diferencia de los otros cuatro **no existe como campo del esquema**: conectarlo obliga a inventar un campo, decidir su sección, su etiqueta y su ayuda. Eso es trabajo de esquema, no de instrumentación, y se hace con la clienta en mente y no de apuro dentro de una tarea de script. Va a la lista de cierre de la Parte B. *Costo si me equivoco:* un texto que ella no puede editar todavía, igual que hoy.

**Ruling E — el normalizador desenvuelve TODO `<span>` sin atributos, y hoy eso es exacto.** La regla parece riesgosa: si el HTML de antes ya tuviera `<span>` pelados, el normalizador los borraría en los dos lados y quedaría ciego a que la fase 2 eliminara uno por error. **Lo medí sobre el `dist/` de hoy: de los 248 `<span>` de las tres páginas de contenido, los 248 tienen atributos. Cero pelados.** Así que la regla es exacta: cualquier `<span>` sin atributos que aparezca es necesariamente uno que creó la fase 2. La Tarea 1 clava ese supuesto con un test propio, para que el día que deje de ser cierto se entere alguien. *Costo si me equivoco:* un punto ciego que hoy no existe y que el test avisa si aparece.

---

## Tarea 1: El verificador de diff normalizado

**Nada de esta fase se puede confiar sin esto.** Va primera y no cambia una sola línea de markup.

**Files:**
- Create: `test/lib/html-normalizado.ts`
- Create: `test/html-normalizado.test.ts`
- Create: `scripts/captura-html.ts`
- Create: `test/fixtures/html-antes-fase-2/` (lo escribe el script)
- Modify: `package.json` — un script `captura:html`

**Interfaces:**
- Produce: `normaliza(html: string): string`, y `pnpm captura:html` que escribe las once páginas construidas al fixture.
- Consume: `parseHTML` de `linkedom`, que ya está en devDependencies y ya se usa en `test/svg-utils.ts:2`.

**Por qué el diff crudo no sirve.** La fase 2 pone ~195 atributos y, en siete lugares, **inventa elementos que hoy no existen** porque el campo comparte un nodo de texto con otra cosa. Un `diff` del HTML daría cientos de líneas de ruido legítimo, y auditarlas a ojo es exactamente lo que el spec §3.2 prohíbe.

- [ ] **Paso 1: El normalizador**

Create `test/lib/html-normalizado.ts`:

```ts
/*
 * Deja el HTML comparable entre un antes y un después de la fase 2.
 *
 * La fase 2 no agrega solo atributos: en siete lugares el campo no tiene
 * elemento propio —comparte un nodo de texto con otra cosa— y hay que
 * inventar un <span> para colgarle el `data-campo`. Eso CAMBIA el HTML
 * renderizado, así que un `diff` crudo da cientos de líneas de ruido
 * legítimo y la única auditoría posible sería a ojo, que es justo lo que
 * el spec §3.2 prohíbe.
 *
 * Este normalizador borra lo que la fase 2 TIENE PERMITIDO agregar y no
 * toca nada más. Si después de normalizar los dos lados no son idénticos,
 * la fase 2 cambió algo que no debía.
 */
import { parseHTML } from 'linkedom'

export function normaliza(html: string): string {
  const { document } = parseHTML(html)

  // 1. Los dos atributos que la fase 2 agrega.
  for (const el of document.querySelectorAll('[data-campo], [data-campo-attr]')) {
    el.removeAttribute('data-campo')
    el.removeAttribute('data-campo-attr')
  }

  // 2. Un <span> que quedó SIN NINGÚN atributo después del paso 1 es un
  //    span que solo existía para colgar el `data-campo`: se lo reemplaza
  //    por sus hijos. Uno que ya traía `class` u otra cosa NO se toca,
  //    aunque le hayan puesto data-campo encima — ese ya existía.
  //
  //    La regla es exacta y no una aproximación: [MEDIDO] de los 248
  //    <span> de las tres páginas de contenido de hoy, los 248 tienen
  //    atributos. Cero pelados. Así que cualquiera que aparezca sin
  //    atributos es necesariamente obra de la fase 2. El test
  //    «el HTML de antes no tiene ningún span pelado» clava ese supuesto.
  //
  //    El snapshot con el spread es a propósito: se muta el árbol mientras
  //    se recorre, y sin él el recorrido se saltea nodos.
  for (const span of [...document.querySelectorAll('span')]) {
    if (span.attributes.length > 0) continue
    span.replaceWith(...span.childNodes)
  }

  return document.toString()
}
```

- [ ] **Paso 2: Los cinco tests del normalizador, que hoy fallan**

Es una herramienta antes que un test, así que se prueba como herramienta: cada regla, en sus dos direcciones.

Create `test/html-normalizado.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { normaliza } from './lib/html-normalizado'

const env = (cuerpo: string) => `<html><head></head><body>${cuerpo}</body></html>`

describe('el normalizador de HTML de la fase 2', () => {
  it('borra data-campo y data-campo-attr, y deja el resto igual', () => {
    const antes = env('<p class="mono">Hola</p>')
    const despues = env('<p class="mono" data-campo="hero.sub">Hola</p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
  })

  it('desenvuelve el span que la fase 2 inventó', () => {
    // El caso de index.astro:317 — «Ingredientes: cacao.» es un solo nodo
    // de texto hoy, y marcar la etiqueta obliga a envolverla.
    const antes = env('<p>Ingredientes: cacao.</p>')
    const despues = env('<p><span data-campo="anaquel.ingredientesEtiqueta">Ingredientes</span>: cacao.</p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
  })

  it('NO desenvuelve un span que ya existía, aunque le pongan data-campo', () => {
    // Si lo desenvolviera, la fase 2 podría borrar un <span class="mono">
    // de verdad y el verificador no lo vería.
    const antes = env('<p><span class="mono">$108</span></p>')
    const despues = env('<p><span class="mono" data-campo="minis.precio">$108</span></p>')
    expect(normaliza(despues)).toBe(normaliza(antes))
    expect(normaliza(despues)).toContain('class="mono"')
  })

  it('ve un cambio de contenido de verdad', () => {
    // La razón de ser del verificador: que NO sea un espejo.
    const antes = env('<p>Hola</p>')
    const despues = env('<p data-campo="x">Chau</p>')
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })

  it('ve un elemento borrado, aunque le hayan puesto data-campo al vecino', () => {
    const antes = env('<p>Uno</p><p>Dos</p>')
    const despues = env('<p data-campo="a">Uno</p>')
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })
})

describe('el supuesto que hace exacta la regla del span', () => {
  it('el HTML de hoy no tiene ni un span sin atributos', () => {
    // Si esto deja de ser cierto, el normalizador se vuelve ciego a que la
    // fase 2 borre un span pelado preexistente — porque lo desenvolvería
    // en los dos lados. [MEDIDO hoy: 248 spans, los 248 con atributos.]
    const paginas = ['dist/index.html', 'dist/404.html', 'dist/fichas-tecnicas/index.html']
    if (!existsSync(paginas[0]) && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    for (const p of paginas) {
      const { document } = parseHTML(readFileSync(p, 'utf8'))
      const pelados = [...document.querySelectorAll('span')].filter((s) => s.attributes.length === 0)
      expect(pelados.map((s) => s.outerHTML), p).toEqual([])
    }
  })
})
```

- [ ] **Paso 3: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/html-normalizado.test.ts`
Expected: FAIL — `normaliza` no existe. Pegá la salida.

Después de escribir el normalizador, corré de nuevo: los seis en verde.

- [ ] **Paso 4: Probar que los tests tienen poder de detección**

Tres mutaciones, una por vez, restaurando entre cada una:

1. Sacá el `if (span.attributes.length > 0) continue` → el tercer test da **rojo** (desenvuelve el `<span class="mono">` que debía quedar).
2. Sacá el `removeAttribute('data-campo-attr')` → el primer test da **rojo**.
3. Sacá el spread de `[...document.querySelectorAll('span')]` y dejá el iterador vivo → probá con `<p><span data-campo="a"><span data-campo="b">x</span></span></p>`; si el recorrido se saltea el anidado, el resultado no coincide con el esperado. **Si esta mutación NO da rojo, decilo en el reporte**: significa que `linkedom` devuelve una lista estática y el spread es defensivo, no necesario — y eso es un dato que vale anotar en el comentario.

Pegá las salidas.

- [ ] **Paso 5: El script de captura**

Create `scripts/captura-html.ts`:

```ts
/*
 * Guarda el HTML de las páginas construidas para poder comparar un antes
 * y un después. Se corre UNA vez antes de que la fase 2 toque markup, y
 * después cada vez que una tarea cambie el HTML a propósito — declarando
 * qué cambió, que es lo que hace que alguien lea el diff.
 *
 * Este archivo NO está bajo src/contenido/, así que sí puede usar node:fs.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const DESTINO = 'test/fixtures/html-antes-fase-2'

const paginas = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? paginas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  )

const rutas = paginas('dist').sort()
if (rutas.length === 0) {
  console.error('No hay HTML en dist/. Corré `pnpm build:sitio` primero.')
  process.exit(1)
}

mkdirSync(DESTINO, { recursive: true })
for (const ruta of rutas) {
  const nombre = relative('dist', ruta).replace(/\//g, '__')
  writeFileSync(join(DESTINO, nombre), readFileSync(ruta, 'utf8'), 'utf8')
}
console.log(`capturadas ${rutas.length} páginas en ${DESTINO}`)
```

En `package.json`, después de `"migra"`:

```json
    "captura:html": "tsx scripts/captura-html.ts"
```

- [ ] **Paso 6: Capturar la línea base**

```bash
pnpm build:sitio && pnpm captura:html
```

Expected: `capturadas 11 páginas en test/fixtures/html-antes-fase-2`

Las once son las que el sitio construye hoy: la portada, el 404, las fichas técnicas, la presentación y las siete del manual. **Se capturan todas, no solo las tres de contenido**: si un cambio de la fase 2 tocara un layout compartido, aparecería en el manual y no en la portada.

- [ ] **Paso 7: El test permanente que compara**

En `test/html-normalizado.test.ts`, un bloque más:

```ts
describe('el HTML renderizado, contra la foto de antes de la fase 2', () => {
  // Es el verificador de toda la fase. Cada tarea que cambie el HTML a
  // propósito lo pone rojo, y ahí hay que leer el diff y recapturar en el
  // mismo commit, explicando qué cambió. Esa fricción es el punto: sin
  // ella, el verificador se vuelve un espejo.
  it('las once páginas son idénticas salvo lo que la fase 2 puede agregar', () => {
    const dir = 'test/fixtures/html-antes-fase-2'
    if (!existsSync('dist/index.html') && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    expect(existsSync('dist/index.html')).toBe(true)
    for (const archivo of readdirSync(dir).sort()) {
      const enDist = 'dist/' + archivo.replace(/__/g, '/')
      expect(existsSync(enDist), `${archivo} ya no se construye`).toBe(true)
      expect(normaliza(readFileSync(enDist, 'utf8')), archivo)
        .toBe(normaliza(readFileSync(join(dir, archivo), 'utf8')))
    }
  })
})
```

Los imports que faltan arriba: `readdirSync` de `node:fs` y `join` de `node:path`.

- [ ] **Paso 8: Probar que el comparador detecta**

Editá una palabra cualquiera de `src/contenido/datos/sitio.json` —por ejemplo el remate del anaquel—, corré `pnpm build:sitio` y después el test.
Expected: **rojo**, nombrando `index.html`.

Restaurá con `git checkout src/contenido/datos/sitio.json`, reconstruí, verde. Pegá las dos salidas.

**No restaures con `pnpm migra sitio`**: el script lee la fachada, que lee ese mismo JSON, así que regenerarlo reescribe la mutación en vez de deshacerla.

- [ ] **Paso 9: Compuerta y commit**

```bash
pnpm build
git add test/lib/html-normalizado.ts test/html-normalizado.test.ts scripts/captura-html.ts test/fixtures/html-antes-fase-2 package.json
git commit -m "$(cat <<'EOF'
test: el diff normalizado que hace segura la fase 2

La fase 2 no agrega solo atributos: en siete lugares el campo comparte un
nodo de texto con otra cosa y hay que inventar un span. Un diff crudo daría
cientos de líneas de ruido legítimo y la única auditoría posible sería a
ojo, que es lo que el spec prohíbe por nombre.

El normalizador borra lo que la fase 2 tiene permitido agregar y no toca
nada más. La regla del span es exacta y no una aproximación: de los 248
spans del sitio de hoy, los 248 tienen atributos, y un test clava ese
supuesto para que deje de ser cierto en voz alta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 2: Los dos arreglos que la fase 1 dejó en la puerta

**El primer cambio de `index.astro` de toda la fase, y es el mejor banco de pruebas posible del verificador: cambia el código y NO cambia la salida.**

**Files:**
- Modify: `src/pages/index.astro:448` y `:538`
- Test: `test/contenido-fachada.test.ts` (las aserciones 1 y 2 ya existen y tienen que seguir verdes)

**Interfaces:**
- Consume: el verificador de la Tarea 1.
- Produce: nada nuevo. Es el único cambio de la fase que no agrega superficie.

**Por qué existen estos dos arreglos.** La fase 1 los identificó y los difirió porque su regla era «cero `.astro` tocados». Los dos son la misma clase de defecto: una comparación que hoy funciona por casualidad y deja de funcionar cuando el panel escriba.

**`index.astro:448` — `{'chipPolvo' in r && …}`** pregunta si la **clave existe**, no si tiene contenido. Si el panel guardara `''` al vaciar el campo, se renderizaría `<p class="mono receta-chip"></p>`: una cajita amarilla vacía de 6×10 px con 12 px de margen, y como las cuatro tarjetas de receta se estiran a la más alta, **crecen las cuatro**.

Con lo que sabemos hoy, ese `''` no puede llegar a publicarse —`texto()` rechaza el string vacío tras trim, así que `cargar()` revienta el build antes— pero el panel de la fase 6 no debería siquiera intentar guardarlo, y la expresión no debería depender de que algo más lo ataje.

**`index.astro:538` — `t.precio === null`** es estricto de más. `precioONada` produce `number | null`, así que hoy funciona; pero cualquier camino que devuelva `undefined` en vez de `null` renderizaría «$NaN». `== null` cubre los dos y no cubre nada más.

- [ ] **Paso 1: Los dos cambios**

En `src/pages/index.astro:448`:

```astro
            {r.chipPolvo && <p class="mono receta-chip">{r.chipPolvo}</p>}
```

En `src/pages/index.astro:538`:

```astro
                <span class="mono">{t.precio == null ? t.precioNota : `${t.precioNota} ${precioMXN(t.precio)}`}</span>
```

- [ ] **Paso 2: El verificador tiene que quedar VERDE, y ese es el punto**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS**. Las tres recetas sin chip no tienen la clave, así que `'chipPolvo' in r` y `r.chipPolvo` dan lo mismo hoy; y ningún `t.precio` es `undefined`, así que `===` y `==` dan lo mismo. **El HTML no cambia ni un byte.**

Si diera rojo, alguno de los dos supuestos es falso y hay algo que no sabemos: pará y pegá el diff.

- [ ] **Paso 3: Probar que los cambios hacen lo que dicen**

Los dos son sobre comportamiento futuro, así que el rojo no sale del HTML de hoy. Se prueban con un test que fabrica el caso que hoy no ocurre. En `test/contenido-fachada.test.ts`, al final del bloque de aserciones de forma:

```ts
  it('10 · el chip vacío no renderiza la cajita, y un precio ausente no renderiza $NaN', () => {
    // Los dos arreglos de index.astro:448 y :538 son sobre un caso que hoy
    // no puede ocurrir —`texto()` rechaza el vacío y `precioONada` da
    // `null`, no `undefined`— pero que el panel de la fase 6 puede provocar.
    // Se prueban con las mismas expresiones que usa la plantilla, sobre el
    // valor que hoy no llega.
    const chip = (r: { chipPolvo?: string }) => Boolean(r.chipPolvo)
    expect(chip({ chipPolvo: '' })).toBe(false)          // la vieja daba true
    expect(chip({ chipPolvo: 'USA EL POLVO' })).toBe(true)
    expect(chip({})).toBe(false)

    const nota = (t: { precio?: number | null }) => t.precio == null
    expect(nota({ precio: undefined })).toBe(true)        // la vieja daba false
    expect(nota({ precio: null })).toBe(true)
    expect(nota({ precio: 108 })).toBe(false)
  })
```

- [ ] **Paso 4: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido-fachada.test.ts`
Expected: PASS las doce.

Mutación: cambiá `Boolean(r.chipPolvo)` por `'chipPolvo' in r` y `t.precio == null` por `t.precio === null` en el test → **rojo** en las dos líneas marcadas con el comentario. Restaurá, verde. Pegá las dos salidas.

- [ ] **Paso 5: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/contenido-fachada.test.ts
git commit -m "$(cat <<'EOF'
fix: el chip mira su contenido y el precio ausente cubre los dos vacíos

Los dos arreglos que la fase 1 identificó y difirió por su regla de cero
.astro tocados.

`'chipPolvo' in r` pregunta si la clave existe, no si tiene contenido: con
un '' guardado renderizaba una cajita amarilla vacía de 6×10 px, y como las
cuatro tarjetas se estiran a la más alta, crecían las cuatro. Y
`t.precio === null` es estricto de más: un undefined renderizaría «$NaN».

El HTML no cambia ni un byte — los dos casos son sobre lo que el panel de
la fase 6 puede provocar, no sobre lo que hay hoy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 3: `anaquel.saborInicial` — el `'canela'` escrito a mano en tres lugares

**Files:**
- Modify: `src/contenido/esquema/sitio/producto.ts` — el campo nuevo
- Modify: `src/contenido/datos/sitio.json` — lo escribe el script
- Modify: `src/pages/index.astro:35`
- Modify: `src/scripts/marca.ts:221`
- Modify: `src/styles/marca.css:101`
- Modify: `test/fixtures/contenido-2026-09-10.json` — **a mano, en este mismo commit**
- Modify: `test/contenido-fachada.test.ts` — la aserción 7 pasa a leer el campo

**Interfaces:**
- Produce: `marca.anaquel.saborInicial`, un `claveSabor` que dice con qué barra abre el anaquel.
- Consume: `claveSabor` de `campos.ts`, que ya existe y produce `keyof typeof sabor`.

**El mismo dato, escrito a mano en tres archivos distintos:**

```
index.astro:35    const inicial = sabores.find((s) => s.slug === 'canela')!
marca.ts:221      ?? 'canela'
marca.css:101     --fondo: var(--mrc-sabor-canela);
```

El primero tiene un `!`: si ese slug dejara de existir, TypeScript no dice nada y la portada del anaquel se pinta con `undefined` — banda sin color y nombre vacío. La aserción 7 del certificado lo vigila desde la fase 1, pero vigila un valor escrito a mano, no una decisión declarada.

**Por qué importa más que la prolijidad:** en la fase 7 la clienta va a poder dar de baja un sabor. Si da de baja la canela, hoy el sitio se rompe en tres lugares distintos y ninguno se llama igual.

- [ ] **Paso 1: El campo**

En `src/contenido/esquema/sitio/producto.ts`, dentro del `grupo` de `anaquel`, después de `titulo`:

```ts
      // Con qué barra abre el anaquel antes de que la visitante elija.
      // Estaba escrito a mano en TRES lugares —index.astro, marca.ts y
      // marca.css— y ninguno se llamaba igual, así que dar de baja ese
      // sabor en la fase 7 rompía el sitio en tres puntos sin relación
      // aparente. `quien: 'marcos'` porque es una decisión de diseño del
      // anaquel, no copy: la clienta no la ve escrita en ningún lado.
      saborInicial: claveSabor({
        ...enSabores,
        etiqueta: 'Sabor con el que abre el anaquel',
        ayuda: 'La barra que se muestra al llegar a la sección, antes de que la visitante elija otra.',
      }),
```

- [ ] **Paso 2: El dato**

`serializa()` va a exigir la clave nueva. Agregala al JSON con el script, no a mano:

```bash
pnpm migra sitio
```

**Si truena diciendo que falta `saborInicial`, es porque el módulo del que lee no la tiene** — y a esta altura ese módulo es la fachada, que lee el mismo JSON. Así que este es el único campo de toda la fase 2 que **sí se escribe a mano en el JSON**: agregá `"saborInicial": "canela"` en el bloque `anaquel`, en la posición que el esquema declara, y después corré `pnpm migra sitio` para que el archivo quede en orden canónico. Verificá con `git diff` que el único cambio es esa línea.

- [ ] **Paso 3: El certificado va a dar ROJO, y hay que actualizarlo**

```bash
pnpm exec vitest run test/contenido-fachada.test.ts
```

Expected: **rojo** en «marca exporta el mismo objeto que antes de la migración», diciendo que apareció `anaquel.saborInicial`.

**Eso es correcto:** es un cambio de contenido deliberado y el certificado existe para detectarlo. Actualizá `test/fixtures/contenido-2026-09-10.json` **a mano**, agregando `"saborInicial": "canela"` en el mismo lugar del bloque `anaquel`, **en este mismo commit**. Pegá el diff del fixture en el reporte: son dos líneas y alguien tiene que leerlas.

- [ ] **Paso 4: Los tres consumidores**

`src/pages/index.astro:35`:

```astro
const inicial = sabores.find((s) => s.clave === marca.anaquel.saborInicial)!
```

`src/scripts/marca.ts:221` — el `?? 'canela'` sale de un `dataset`, así que el valor tiene que llegar por el HTML. **Ese es trabajo de la Tarea 4** (el `<script id="textos-ui">`): por ahora dejalo como está y anotalo en el reporte. Si lo tocás acá, estás adelantando una tarea que todavía no tiene su canal.

`src/styles/marca.css:101` — el `--mrc-sabor-canela` es una variable CSS: no puede leer del dato. Lo que sí puede es dejar de nombrar un sabor. Cambiá la regla para que tome el color de la banda que `index.astro` ya escribe en el `style` inline del elemento (`--fondo` / `--texto`, ver `index.astro:241`), y si eso no alcanza, **paralo y decilo**: puede ser que el CSS necesite un valor de arranque antes de que el inline exista, y en ese caso el arreglo correcto es otro y merece su propia decisión.

- [ ] **Paso 5: La aserción 7 del certificado pasa a leer el campo**

En `test/contenido-fachada.test.ts`, la aserción 7:

```ts
  it('7 · el sabor con el que abre el anaquel existe', () => {
    // index.astro:35 hace `sabores.find((s) => s.clave === marca.anaquel
    // .saborInicial)!` — con el `!` puesto. Si ese sabor dejara de existir,
    // TypeScript no dice nada y la portada del anaquel se pinta con
    // `undefined`: banda sin color y nombre vacío.
    expect(sabores.find((s) => s.clave === marca.anaquel.saborInicial)).toBeDefined()
  })
```

- [ ] **Paso 6: El verificador va a dar ROJO si el HTML cambió**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS**, si el sabor inicial sigue siendo la canela. El `find` cambia de criterio pero encuentra lo mismo.

**Si da rojo, leé el diff antes de recapturar.** Solo recapturá (`pnpm captura:html`) si el cambio es el que esperabas y podés explicarlo en el commit.

- [ ] **Paso 7: Probar que detecta**

Cambiá `"saborInicial"` a `"hierbabuena"` en el JSON, reconstruí y corré el verificador → **rojo**, mostrando que la portada del anaquel cambió de sabor. Restaurá con `git checkout src/contenido/datos/sitio.json`, reconstruí, verde. Pegá las dos salidas: es la prueba de que el campo de verdad manda.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/producto.ts src/contenido/datos/sitio.json src/pages/index.astro src/styles/marca.css test/fixtures/contenido-2026-09-10.json test/contenido-fachada.test.ts
git commit -m "$(cat <<'EOF'
feat: el sabor con el que abre el anaquel es un dato, no tres literales

El mismo 'canela' estaba escrito a mano en index.astro, en marca.ts y en
marca.css, y ninguno de los tres se llamaba igual. En la fase 7, cuando la
clienta pueda dar de baja un sabor, dar de baja ese rompía el sitio en tres
puntos sin relación aparente.

El fixture del certificado se actualiza en este mismo commit: es un cambio
de contenido deliberado y el diff son dos líneas que alguien tiene que leer.

El `?? 'canela'` de marca.ts queda para la tarea del script, que es la que
le abre el canal para recibirlo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 4: `<script id="textos-ui">` — los cuatro textos que la clienta edita y no pasa nada

**Es la mina activa de esta fase.** Hoy ella abre el panel, edita «¡Copiado!», guarda, publica — y no cambia nada, porque el texto está escrito adentro del script. La peor clase de edición fallida: la que parece que funcionó.

**Files:**
- Create: `src/contenido/textos-ui.ts`
- Modify: `src/pages/index.astro` — el `<script>` nuevo, al lado del de `datos-anaquel`
- Modify: `src/scripts/marca.ts:118, 221, 301, 355`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `TEXTOS_UI`, la lista de rutas que el script necesita en runtime, y `textosUi(marca)` que arma el objeto a publicar.
- Consume: `jsonParaHtml` de `@/lib/json-en-html` (el escape de la fase 0), y el patrón de lectura con chequeo de forma que `marca.ts:182-192` ya usa para `datos-anaquel`.

**Los cinco textos que el script tiene escritos a mano:**

| `marca.ts` | Literal | Campo editable |
|---|---|---|
| `:118` | `'Cerrar menú'` | `nav.cerrar` |
| `:118` | `'Abrir menú'` | `nav.abrir` |
| `:221` | `'canela'` | `anaquel.saborInicial` (Tarea 3) |
| `:301` | `'¡Copiado!'` | `contacto.copiado` |
| `:355` | `'Enviando'` | `contacto.formulario.enviando` |

**El sexto no entra, y es a propósito** (Ruling D): `'La barra en tres dimensiones; arrastra para girarla'` (`:278`) **no existe como campo del esquema**. Conectarlo obliga a inventar un campo, decidir su sección, su etiqueta y su ayuda — eso es trabajo de esquema hecho con la clienta en mente, no un apuro dentro de una tarea de script. Va a la lista de cierre de la Parte B.

- [ ] **Paso 1: El módulo que declara qué necesita el runtime**

Create `src/contenido/textos-ui.ts`:

```ts
/*
 * Los textos que el script pinta en runtime, y que por eso no pueden salir
 * del HTML renderizado.
 *
 * El problema que resuelve: `marca.ts` los tenía escritos adentro. La
 * clienta los edita en el panel, guarda, publica — y no cambia nada,
 * porque el string vive en el JavaScript. Es la peor clase de edición
 * fallida, la que parece que funcionó.
 *
 * Esta lista es la única declaración de qué textos cruzan esa frontera.
 * Un campo que el script pinte y no esté acá vuelve a ser un literal
 * escondido, así que agregar uno es agregarlo ACÁ primero.
 *
 * Vive en src/contenido/ y respeta la regla de la carpeta: sin node:*, sin
 * Astro, solo rutas relativas. Lo van a importar `index.astro` para
 * publicarlo y el panel de la fase 6 para saber qué previsualizar.
 */

/** Las claves que el script busca, con la ruta del campo de la que salen. */
export const TEXTOS_UI = {
  navAbrir: 'nav.abrir',
  navCerrar: 'nav.cerrar',
  copiado: 'contacto.copiado',
  enviando: 'contacto.formulario.enviando',
  saborInicial: 'anaquel.saborInicial',
} as const

export type ClaveTextoUi = keyof typeof TEXTOS_UI

/**
 * Arma el objeto que viaja al HTML. Recibe el contenido ya cargado en vez
 * de importarlo: así este módulo no depende de la fachada y el panel puede
 * llamarlo sobre un borrador sin publicar.
 */
export function textosUi(marca: Record<string, unknown>): Record<ClaveTextoUi, string> {
  const enRuta = (ruta: string): string => {
    let v: unknown = marca
    for (const parte of ruta.split('.')) v = (v as Record<string, unknown>)?.[parte]
    if (typeof v !== 'string') {
      // Tirar y no devolver '' : un texto de UI vacío se ve como un botón
      // sin palabras, y averiguar por qué cuesta una tarde.
      throw new Error(`textosUi(): la ruta «${ruta}» no da un texto.`)
    }
    return v
  }
  const salida = {} as Record<ClaveTextoUi, string>
  for (const [clave, ruta] of Object.entries(TEXTOS_UI)) {
    salida[clave as ClaveTextoUi] = enRuta(ruta)
  }
  return salida
}
```

- [ ] **Paso 2: Los tres tests, que hoy fallan**

En `test/contenido.test.ts`:

```ts
describe('los textos que el script pinta en runtime', () => {
  it('arma el objeto con los cinco textos, sacados del contenido', () => {
    const t = textosUi(fixture.marca as never)
    expect(Object.keys(t).sort()).toEqual(['copiado', 'enviando', 'navAbrir', 'navCerrar', 'saborInicial'])
    expect(t.copiado).toBe(fixture.marca.contacto.copiado)
    expect(t.navCerrar).toBe(fixture.marca.nav.cerrar)
  })

  it('truena si una ruta declarada no da un texto', () => {
    // Un texto de UI vacío se ve como un botón sin palabras, y averiguar
    // por qué cuesta una tarde. Mejor que reviente el build.
    const roto = JSON.parse(JSON.stringify(fixture.marca))
    delete roto.contacto.copiado
    expect(() => textosUi(roto)).toThrow(/contacto\.copiado/)
  })

  it('ninguna ruta de TEXTOS_UI está inventada: todas existen en el esquema', () => {
    // El modo de falla que este test ataja: alguien renombra un campo del
    // esquema y esta lista queda apuntando a una ruta muerta. El build no
    // se entera hasta que el botón sale sin texto en producción.
    const delEsquema = new Set<string>()
    recorre(esquemaSitio, (ruta) => delEsquema.add(ruta))
    for (const ruta of Object.values(TEXTOS_UI)) {
      expect(delEsquema.has(ruta), `«${ruta}» no existe en el esquema del sitio`).toBe(true)
    }
  })
})
```

- [ ] **Paso 3: Correrlos, verlos fallar, implementar, verde**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'textos que el script pinta'`
Expected: FAIL — `textosUi` no existe. Pegá la salida.

- [ ] **Paso 4: Publicarlos en el HTML**

En `src/pages/index.astro`, al lado del `<script type="application/json" id="datos-anaquel" …>` de la línea 777:

```astro
  <script type="application/json" id="textos-ui" set:html={jsonParaHtml(textosUi(marca))} />
```

Y el import arriba: `import { textosUi } from '@/contenido/textos-ui'`.

**`jsonParaHtml` y no `JSON.stringify`**, por la mina de la fase 0: un `</script` en cualquier campo cerraría el `<script>` del HTML y mataría todo el JS de la página.

- [ ] **Paso 5: El script los lee**

En `src/scripts/marca.ts`, **copiá la forma que el archivo ya usa** para `datos-anaquel` (líneas 182-192): leer el `textContent`, parsear con try/catch, y **chequear la forma** — no alcanza con que parsee.

Y después reemplazá los cuatro literales:

```
:118  'Cerrar menú' / 'Abrir menú'  →  textos.navCerrar / textos.navAbrir
:221  ?? 'canela'                   →  ?? textos.saborInicial
:301  '¡Copiado!'                   →  textos.copiado
:355  'Enviando'                    →  textos.enviando
```

**Si el JSON viniera roto o incompleto, el script tiene que seguir vivo con los textos de hoy como respaldo** — igual que el anaquel se queda en su estado sin-JS. Un menú que no dice «Cerrar» es molesto; un módulo muerto deja los seis pasos de «Cómo catar» invisibles para siempre.

- [ ] **Paso 6: El verificador va a dar ROJO, y está bien**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **rojo**. El `<script id="textos-ui">` es un elemento nuevo con contenido, y el normalizador **no lo desenvuelve** — solo desenvuelve `<span>` sin atributos.

Leé el diff, confirmá que el único cambio es ese `<script>`, recapturá con `pnpm captura:html` y **explicá el cambio en el mensaje del commit**. Pegá el diff en el reporte antes de recapturar.

- [ ] **Paso 7: Probar que el canal funciona de verdad**

Es el punto entero de la tarea, así que no alcanza con que el build pase.

Cambiá `"copiado"` en `src/contenido/datos/sitio.json` a `"¡Listo!"`, reconstruí, y verificá que el HTML construido lo trae:

```bash
pnpm build:sitio && grep -c '¡Listo!' dist/index.html
```

Expected: **1 o más**. Antes de esta tarea daba **0** — ese es el bug que se está arreglando.

Restaurá con `git checkout src/contenido/datos/sitio.json`, reconstruí. Pegá las dos salidas.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/contenido/textos-ui.ts src/pages/index.astro src/scripts/marca.ts test/contenido.test.ts test/fixtures/html-antes-fase-2
git commit -m "$(cat <<'EOF'
feat: los textos que el script pinta salen del contenido, no de literales

Cuatro campos que la clienta puede editar en el panel y que no llegaban a
la página: «Abrir menú», «Cerrar menú», «¡Copiado!» y «Enviando» estaban
escritos adentro de marca.ts. Ella los editaba, guardaba, publicaba — y no
pasaba nada. La peor clase de edición fallida: la que parece que funcionó.

Viajan en un <script id="textos-ui"> escapado con jsonParaHtml, y el script
los lee con chequeo de forma y respaldo: si el JSON viniera roto, el menú
queda con su texto de hoy en vez de morir y llevarse los seis pasos de
«Cómo catar» con él.

El HTML cambia a propósito: hay un <script> nuevo. Línea base recapturada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 5: La dirección postal sale del copy

**Files:**
- Modify: `src/seo/esquema.ts:29-35`
- Test: `test/seo.test.ts`

**Interfaces:**
- Consume: `marca.contacto.direccion`, `marca.contacto.puestoTitulo`.
- Produce: nada nuevo. El JSON-LD deja de tener cinco literales.

**Las mismas cinco verdades, escritas dos veces:**

```
copy    contacto.puestoTitulo   «Mercado de» + «Coyoacán»
copy    contacto.direccion[0]   «Malintzin s/n, Col. del Carmen»
copy    contacto.direccion[1]   «Coyoacán, C.P. 04100, CDMX»

seo/esquema.ts:30  streetAddress   «Mercado de Coyoacán, Malintzin s/n, Col. del Carmen»
seo/esquema.ts:31  addressLocality «Coyoacán»
seo/esquema.ts:32  addressRegion   «Ciudad de México»
seo/esquema.ts:33  postalCode      «04100»
```

Si el puesto se muda, ella edita el copy y **Google sigue mostrando la dirección vieja** en la ficha de negocio. Es el mismo modo de falla que los precios de la fase 1, sobre el dato que más caro sale tener mal: el que le dice a la gente adónde ir.

**El riesgo de esta tarea, y es real:** el JSON-LD renderizado tiene que quedar **idéntico**. Las cinco verdades hay que reconstruirlas del copy, y el copy las tiene en otra forma. `addressRegion` es «Ciudad de México» y el copy dice «CDMX»; `postalCode` es «04100» y el copy lo trae adentro de «Coyoacán, C.P. 04100, CDMX».

**No inventes un parser de la línea de dirección.** Extraer «04100» de un texto libre con un regex es frágil y la clienta puede reescribir esa línea mañana. Si los cinco valores no se pueden reconstruir del copy sin adivinar, **la respuesta correcta es agregar los campos que faltan al esquema** —con su etiqueta y su ayuda, en la sección `contacto`— y que el JSON-LD los lea. Decidí vos cuál de los dos caminos aplica, **y si agregás campos, el certificado va a dar rojo: actualizá el fixture en el mismo commit y pegá el diff.**

- [ ] **Paso 1: El test que exige que el JSON-LD no cambie**

En `test/seo.test.ts`:

```ts
it('la dirección del JSON-LD sale del copy y no de literales', () => {
  // El mismo dato estaba escrito en dos lugares: si el puesto se muda,
  // ella edita el copy y Google sigue mostrando la dirección vieja en su
  // ficha de negocio. Este test exige las dos cosas: que el JSON-LD siga
  // diciendo exactamente lo mismo que hoy, y que lo diga leyendo el copy.
  const ld = origenCanonico()
  expect(ld.address.addressLocality).toBe('Coyoacán')
  expect(ld.address.postalCode).toBe('04100')
  expect(ld.address.streetAddress).toContain(marca.contacto.direccion[0])
  expect(ld.address.streetAddress).toContain(marca.contacto.puestoTitulo.join(' '))
})
```

Ajustá los nombres al valor real que `origenCanonico()` devuelve — leé la función entera antes de escribir el test, no una ventana de grep.

- [ ] **Paso 2: El verificador es el juez**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS**. Si el JSON-LD renderizado no cambió, el HTML tampoco.

**Si da rojo, leé el diff: te va a decir exactamente qué carácter de la dirección se movió.** No recapturés para taparlo — el objetivo de esta tarea es que no cambie.

- [ ] **Paso 3: Probar que ahora sigue al copy**

Cambiá `contacto.direccion[0]` en el JSON, reconstruí, y verificá que el JSON-LD del HTML lo trae:

```bash
grep -o '"streetAddress":"[^"]*"' dist/index.html
```

Expected: la calle nueva. Antes de esta tarea, el literal viejo. Restaurá y reconstruí. Pegá las dos salidas.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/seo/esquema.ts test/seo.test.ts
git commit -m "$(cat <<'EOF'
fix: la dirección del JSON-LD sale del copy, no de cinco literales

Las mismas cinco verdades estaban escritas dos veces, en dos formas. Si el
puesto se muda, la clienta edita el copy y Google sigue mostrando la
dirección vieja en su ficha de negocio — el dato que más caro sale tener
mal, porque es el que le dice a la gente adónde ir.

El JSON-LD renderizado no cambia ni un byte: el verificador lo exige.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 6: El «de 15» se deriva

**Files:**
- Modify: `src/contenido/esquema/sitio/producto.ts` — `anaquel.contadorDe` pasa de `texto` a `derivado`
- Modify: `src/contenido/derivados.ts` — la quinta entrada de la tabla
- Modify: `src/contenido/datos/sitio.json` — sale del archivo
- Modify: `test/fixtures/contenido-2026-09-10.json` — **a mano, en este mismo commit**
- Modify: `test/contenido-fachada.test.ts` — la aserción 9

**El campo dice «de 15» y hoy es texto que alguien mantiene.** Se renderiza en `index.astro:305` como `{fichaEtiqueta} {d.orden} {contadorDe}` → «Barra n.º 3 de 15». Si la clienta agrega una barra, imprime **«n.º 16 de 15»** en la página publicada.

La fase 1 le puso una aserción de forma que lo vigila, y `quien: 'marcos'` para que ella no lo edite. Pero vigilar no es lo mismo que no poder estar mal: **la tabla de derivados existe exactamente para esto**, y este campo cumple su definición — un valor que no se edita porque se calcula.

**Por qué no lleva `cuenta` en vez de derivarse:** `cruzaConteo()` exige que el número sea vecino inmediato de un sustantivo, y acá no hay ninguno — la plantilla renderiza «n.º 3 **de 15**». Forzar la regla pediría inventar un sustantivo falso. Derivarlo es la respuesta correcta y además lo vuelve imposible de tener viejo.

- [ ] **Paso 1: El campo pasa a derivado**

En `src/contenido/esquema/sitio/producto.ts`, reemplazá el `texto(...)` de `contadorDe` por:

```ts
      // «de 15». No se edita: se calcula de cuántas barras hay.
      //
      // No lleva `cuenta` porque `cruzaConteo()` exige que el número sea
      // vecino inmediato de un sustantivo, y acá no hay ninguno — la
      // plantilla renderiza «n.º 3 de 15». Forzar esa regla pediría
      // inventar un sustantivo falso; derivarlo lo vuelve imposible de
      // tener viejo, que es mejor que vigilarlo.
      contadorDe: derivadoTexto({
        ...enSabores,
        etiqueta: 'Final del contador',
        ayuda: 'Lo que va después del número: «n.º 3 de 15». Sale solo de cuántas barras hay.',
        saleDe: 'la cantidad de barras del anaquel',
        maxCaracteres: 20,
      }),
```

**`derivado()` no sirve acá, y lo verifiqué antes de escribir esto.** Produce `z.int().min(1).max(99_999)` — solo enteros, porque nació para los precios. Este campo es texto («de 15»). Así que la tarea empieza por el constructor hermano.

En `src/contenido/campos.ts`, al lado de `derivado`:

```ts
/**
 * Un valor de TEXTO que no se edita porque se calcula. Hermano de
 * `derivado`, que solo admite enteros porque nació para los precios.
 *
 * Existe para «de 15»: una frase armada con un número que sale de una
 * lista. Comparte el `control: 'derivado'`, que es lo que hace que
 * `serializa()` no lo escriba al JSON y que el panel lo dibuje en gris.
 */
export const derivadoTexto = (meta: Base & { saleDe: string; maxCaracteres: number }) =>
  anota(
    z.string().trim().max(meta.maxCaracteres, mensajeMax(meta.maxCaracteres)),
    { control: 'derivado', quien: 'marcos', ...meta },
  )
```

**No reusa `reglasDeTexto()` a propósito:** esas reglas —no vacío, vocabulario de marca, sin `$` seguido de dígito— existen para texto que la clienta escribe. Este lo escribe el código, y hacerlo pasar por un filtro de copy sería teatro.

- [ ] **Paso 2: La entrada en la tabla**

En `src/contenido/derivados.ts`, sumá a `DERIVADOS_DEL_SITIO`:

```ts
  { ruta: 'anaquel.contadorDe', calcula: (f) => `de ${f.sabores.length}` },
```

**Y ensanchá el tipo de la tabla**, que hoy declara `calcula: (fuentes: FuentesDeDerivados) => number` (`derivados.ts:42`):

```ts
  calcula: (fuentes: FuentesDeDerivados) => number | string
```

`injerta()` escribe lo que `calcula` devuelva, así que no necesita cambiar. `FuentesDeDerivados` tampoco: `sabores: readonly { precio: number }[]` ya alcanza para leerle el largo.

**El candado que ya existe va a exigir que la tabla y el esquema digan lo mismo**, así que si te olvidás de una de las dos mitades, el test te lo dice con la ruta.

- [ ] **Paso 3: Sale del JSON, y el certificado da rojo**

```bash
pnpm migra sitio
pnpm exec vitest run test/contenido-fachada.test.ts
```

`serializa()` omite los derivados, así que `anaquel.contadorDe` **desaparece del JSON**. El certificado va a dar **rojo** diciendo que el objeto exportado ya no coincide con el fixture — pero ojo: el objeto exportado **sí** tiene el campo (la fachada lo injerta), así que el rojo debería ser solo si el valor calculado difiere del que estaba escrito.

**Verificá cuál de las dos cosas pasó antes de tocar el fixture:**
- Si el valor calculado es «de 15» y el fixture dice «de 15», **no debería dar rojo**. Si igual da, hay algo que no entendemos: pará y pegá el diff.
- Si da rojo por otra razón, leela antes de recapturar.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS**. El campo cambia de origen, no de valor: sigue diciendo «de 15» y el HTML no se entera.

- [ ] **Paso 5: La aserción 9 pasa a probar la derivación**

En `test/contenido-fachada.test.ts`, la aserción del contador:

```ts
  it('9 · el contador del anaquel sale de cuántas barras hay', () => {
    // index.astro:305 renderiza «{fichaEtiqueta} {orden} {contadorDe}» →
    // «Barra n.º 3 de 15». Cuando era texto a mano, agregar una barra
    // imprimía «n.º 16 de 15» en la página publicada.
    expect(marca.anaquel.contadorDe).toBe(`de ${sabores.length}`)
  })
```

- [ ] **Paso 6: Probar que de verdad se mueve**

Agregá una barra 16 al `sabores.json` —copiá una existente y cambiale `orden`, `slug` y `clave`— reconstruí y verificá:

```bash
pnpm build:sitio && grep -o 'de 16' dist/index.html | head -1
```

Expected: **«de 16»**. Antes de esta tarea decía «de 15» con dieciséis barras en la página.

Restaurá con `git checkout src/contenido/datos/sabores.json`, reconstruí. Pegá las dos salidas — es la prueba de que el campo dejó de poder estar viejo.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/producto.ts src/contenido/derivados.ts src/contenido/datos/sitio.json test/fixtures/contenido-2026-09-10.json test/contenido-fachada.test.ts
git commit -m "$(cat <<'EOF'
feat: el «de 15» del contador se calcula de cuántas barras hay

Era texto que alguien mantenía, y la plantilla lo renderiza pegado al
número de la barra: con dieciséis barras imprimía «n.º 16 de 15» en la
página publicada. La fase 1 le puso una aserción que lo vigilaba, pero
vigilar no es lo mismo que no poder estar mal.

No lleva `cuenta` porque cruzaConteo() exige un sustantivo pegado al número
y acá no hay ninguno. Derivarlo es la respuesta correcta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 7: La ilustración condicional

**Files:**
- Modify: `src/pages/index.astro:325-336`
- Test: `test/sitio.test.ts`

**Esto no arregla un hueco de hoy, y conviene decirlo:** verifiqué que las quince ilustraciones existen en `public/sitio/marca/`. Lo que prepara es la fase 7, cuando la clienta pueda dar de alta un sabor — y ese sabor no va a tener dibujo hasta que alguien lo haga.

Hoy el bloque renderiza sin preguntar:

```astro
<figure class="ficha-ilustracion">
  <img class="flota" src={`/sitio/marca/ilustracion-${inicial.slug}.webp`} … />
  <figcaption class="mano suave">{marca.anaquel.ilustracionCaption}</figcaption>
</figure>
```

Con un sabor sin dibujo, eso publica un `<img>` roto y un pie de foto sobre nada.

**El problema de diseño, que es tuyo resolver:** Astro construye en el servidor y tiene acceso al sistema de archivos, pero `src/contenido/**` no puede tocar `node:*`. Así que **la condición no puede vivir en el esquema.** Dos caminos, y los dos son defendibles:

1. **`index.astro` chequea la existencia del archivo** al construir. Simple, no agrega campos, y la verdad sale del disco — que es donde está.
2. **Un campo `ilustracion: boolean` en el sabor**, que alguien mantiene. Declarativo, pero es un dato que puede mentirle al disco, y esta fase entera existe para eliminar esa clase de dato.

**Elegí el 1 salvo que encuentres una razón concreta para el 2, y escribí la razón en el código.** Si el 1 no funciona —por ejemplo, porque el `public/` no es alcanzable desde el contexto de build— **paralo y decilo** en vez de caer al 2 por descarte.

- [ ] **Paso 1: El test, que hoy falla**

En `test/sitio.test.ts`:

```ts
it('la ilustración no se renderiza si el sabor no tiene dibujo', async () => {
  // Hoy los quince lo tienen, así que este test no protege de nada
  // todavía: protege de la fase 7, cuando la clienta pueda dar de alta un
  // sabor. Sin la condición, ese sabor publica un <img> roto y un pie de
  // foto sobre nada.
  //
  // Se prueba sobre el sabor de arranque real, que sí tiene dibujo: el
  // <figure> tiene que estar. La otra dirección se prueba con la mutación
  // del paso 3, porque no hay forma de fabricar un sabor sin archivo sin
  // borrar uno del repo.
  const html = await container.renderToString(Borrador)
  expect(html).toContain('ficha-ilustracion')
  expect(html).toMatch(/ilustracion-[a-z0-9-]+\.webp/)
})
```

- [ ] **Paso 2: La condición**

Implementá el camino que elegiste, con el comentario que explica por qué ese y no el otro.

- [ ] **Paso 3: Probar que la condición condiciona**

Renombrá temporalmente el archivo de la ilustración del sabor de arranque:

```bash
mv public/sitio/marca/ilustracion-canela.webp /tmp/
pnpm build:sitio && grep -c 'ficha-ilustracion' dist/index.html
```

Expected: **0** — el `<figure>` entero no se renderiza.

```bash
mv /tmp/ilustracion-canela.webp public/sitio/marca/
pnpm build:sitio && grep -c 'ficha-ilustracion' dist/index.html
```

Expected: **1**. Pegá las dos salidas.

**Si el primer comando da 1, la condición no condiciona** y el test del paso 1 estaba pasando por otra razón. Ese es el hallazgo, no el bug.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS** con los quince archivos en su lugar. La condición se cumple para todos, así que el HTML no cambia.

- [ ] **Paso 5: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/sitio.test.ts
git commit -m "$(cat <<'EOF'
feat: la ilustración se renderiza solo si el sabor tiene dibujo

No arregla nada de hoy: los quince sabores tienen su ilustración. Prepara
la fase 7, cuando la clienta pueda dar de alta un sabor — y ese sabor no va
a tener dibujo hasta que alguien lo haga. Sin la condición, publica un img
roto y un pie de foto sobre nada.

El HTML no cambia: la condición se cumple para los quince.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Cobertura del spec

| La entrada `FASE 2` del orden de trabajo pide | Dónde |
|---|---|
| Los ~200 `data-campo` | **Parte B** |
| Los `data-campo-attr` de alt y aria | **Parte B** |
| El `<script id="textos-ui">` | Tarea 4 |
| La dirección postal del JSON-LD sacada al copy | Tarea 5 |
| El `/15` derivado | Tarea 6 |
| `anaquel.saborInicial` reemplazando el `find(...)!`, el `?? 'canela'` y el `--mrc-sabor-canela` | Tarea 3 (los dos primeros) y Tarea 4 (el del script) |
| El try/catch del visor 3D | **Ya existe** — Ruling C |
| La ilustración condicional | Tarea 7 |
| VERIFICACIÓN: diff normalizado | Tarea 1 |
| Los dos arreglos que la fase 1 difirió | Tarea 2 |

**Lo que queda para la Parte B**, y se planifica cuando esta cierre:

- Los ~195 `data-campo`, repartidos por sección como se repartió el esquema en la fase 1.
- Los 15 `data-campo-attr`.
- Los siete lugares donde hay que inventar un `<span>` — con el verificador ya probado sobre siete cambios reales.
- **El test de biyección del spec §3.1, en los dos sentidos y por página**, con cardinalidad ≥1 y nunca «exactamente uno»: 82 de los 195 campos aparecen dos o más veces en el HTML.
- Los cuatro campos cuyo valor no aparece literal porque la plantilla lo transforma (`hero.titular.1`, `footer.legalesNota`, y los precios que `precioMXN` formatea).
- El `alt` del visor 3D, que necesita un campo de esquema que hoy no existe (Ruling D).
- `Insignia.astro` y `EtiquetaSabor.astro` reciben una prop `campo`, porque el nodo a marcar vive adentro de ellos. Están en `src/components/marca/`, no en `sitio/` como dice el spec.

---

## Cierre de la Parte A (2026-09-14)

Las siete tareas se ejecutaron con subagent-driven-development sobre la rama
`panel-fase-2-parte-a`. Cada una pasó su propia revisión; la revisión final de
toda la rama (opus) dio «ready to merge with fixes», con dos Critical que se
arreglaron acá y el resto anotado abajo. Estado al cerrar: **901 tests verdes
en 35 archivos, `astro check` 0 errores / 0 warnings / 4 hints.**

**Lo que la revisión final encontró y se arregló en esta rama:**

- **La regla del `<span>` del verificador nunca se disparaba.** Astro estampa
  `data-astro-cid-<hash>` en todo elemento de un componente con `<style>`, así
  que un `<span data-campo="x">` de la Parte B llega con ese atributo y la
  regla vieja —«¿quedó en cero atributos?»— no lo desenvolvía nunca: cada span
  inventado iba a aparecer como un cambio estructural. La regla nueva
  desenvuelve solo los `<span>` que TRAJERON `data-campo` y a los que, sacando
  el estampado de Astro, no les queda nada. (commits `f1109c7`, `8cdb402`)
- **Los tests del normalizador usaban HTML a mano sin ese estampado**, una
  forma que Astro no emite — por eso el defecto pasó cuatro revisiones.

**Lo que la Parte B tiene que absorber, además de la lista de arriba:**

- `src/layouts/Base.astro:96` — `og:site_name="Maracacao"` es un literal de
  `marca.marca.nombre`, que la clienta edita. La revisión barrió todas las
  hojas del esquema contra todos los accesos de `src/`: es el **último**
  huérfano de su clase. Cambia el HTML de las once páginas, así que va con su
  recaptura declarada.
- `index.astro:737` — `aria-label="Mapa del sitio"` no tiene campo de esquema:
  a la lista de cierre, al lado del `alt` del visor 3D (Ruling D).
- **El retiro del verificador**: la última tarea de la Parte B lo borra o lo
  saca del camino de deploy. Ver `docs/tests-que-congelan-contenido.md`.
- El candado cruzado de la dirección (`contacto.ts`) compara con `.includes()`
  sensible a acentos y mayúsculas: «Coyoacan» sin tilde le rompe el build a la
  clienta. Normalizar los dos lados antes de comparar.
- `contacto.direccionPostal.estado` no tiene candado — candidato a selector de
  los 32 estados en vez de texto libre.
- `src/scripts/marca.ts` — `datos.get('tipo') === 'negocio'` duplica
  `contacto.formulario.tipoOpciones.1.valor` (es `quien: 'marcos'`, así que no
  es el modo de falla de la clienta, pero es el mismo acoplamiento escondido).
- `src/scripts/marca.ts` — `d.ilustracion ?? true` es rama muerta y su
  comentario enseña un modelo equivocado: el HTML viejo siempre carga el JS
  viejo, así que un JSON cacheado sin la clave no puede pasar.
- `test/anaquel-ilustracion.test.ts` congela el slug `'canela'`: que salga del
  dato (`marca.anaquel.saborInicial`) en vez de estar clavado.
- `src/lib/ilustraciones.ts` — si algún día se agrega un adapter de servidor,
  `public/` no existe en tiempo de request, `tieneIlustracion` da `false` para
  los quince y las ilustraciones desaparecen sin que ningún test se entere.
  Falta una aserción de que al menos un sabor tiene dibujo.
- `test/fixtures/html-antes-fase-2/` ya no se llama como lo que es: se
  recapturó tres veces con cambios declarados. Renombrar o poner un README.
- El verificador recorre la carpeta de fixtures, no `dist/`: una página nueva
  se escapa de la verificación sin que nada avise.
- El test nuevo de `seo.test.ts` pasa igual si alguien vuelve a literales
  iguales a los de hoy. Con `test/plantilla-vacios.test.ts` como patrón, hay
  una respuesta barata: mockear el copy con otra dirección y re-renderizar.
- **Aparcado de la fase 1, sigue abierto:** en la fase 7 (baja de un sabor),
  `anaquel.saborInicial` puede quedar apuntando a un sabor que ya no está. El
  chequeo tiene que ser cruzado entre documentos y vivir en la carga, no en un
  test.
