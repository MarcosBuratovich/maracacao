# Fase 2, Parte B — el HTML direccionable por ruta de campo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada texto editable del sitio lleve en el HTML la ruta del campo del que sale, para que el panel de la fase 6 pueda resaltarlo, previsualizarlo y medirlo sin adivinar.

**Architecture:** un atributo `data-campo="<documento>:<ruta>"` en el nodo que muestra el valor (y `data-campo-attr="<atributo>:<documento>:<ruta>"` cuando el valor vive en un atributo, no en un nodo de texto). Donde hoy el texto está mezclado con otro texto en el mismo nodo, hay que inventar un `<span>` — por eso esto es un cambio de MARKUP y no de atributos, y por eso existe el verificador de HTML de la Parte A: desenvuelve esos spans y exige que el resto salga idéntico byte a byte. Un test de biyección en los dos sentidos cierra el círculo, con una lista de pendientes que cada tarea achica.

**Tech Stack:** Astro 7 (static), Zod 4.4.3, Vitest 4 (+ `experimental_AstroContainer`), linkedom, TypeScript 6, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` (§1.7 campos que son atributo, §3.1 mapeo uno-a-muchos, §3.2 fase 2 es un cambio de markup).

**Parte A (ya en `main`):** `docs/superpowers/plans/2026-09-10-panel-fase-2-parte-a.md`. Su sección «Cierre de la Parte A» lista lo que esta parte hereda; está incorporado abajo, tarea por tarea.

## Global Constraints

Valen para toda tarea de este plan.

- **El verificador de HTML es la compuerta visual.** Después de cada tarea:
  `pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts` tiene que dar **verde sin recapturar**. Lo único que el normalizador perdona es: los atributos `data-campo`/`data-campo-attr`, y los `<span>` que TRAJERON `data-campo` y que, sacando el estampado `data-astro-cid-*` de Astro, no tienen ningún otro atributo. Todo lo demás tiene que salir idéntico byte a byte. Si da rojo, **leé el diff**: o inventaste un span con `class`, o moviste un espacio.
- **Un `<span>` inventado no lleva NADA más que `data-campo`.** Ni `class`, ni `style`, ni `aria-*`. Si necesita una clase, no es un span inventado: es un elemento nuevo, y entonces el verificador tiene razón en ponerse rojo.
- **`src/contenido/**` no importa `node:*`, no importa Astro, y usa solo rutas relativas sin extensión.** El guard es lista blanca desde la fase 1: permite `zod`, rutas relativas sin extensión, y `.json` bajo `datos/`.
- **Las etiquetas y ayudas que ve la clienta van en español mexicano, sin jerga** («revisa», «cambias», nunca «revisá»). La ayuda dice DÓNDE VIVE el texto. Los comentarios del código van en español rioplatense y explican POR QUÉ.
- **Vocabulario prohibido de MARCA:** «mono», «chango», «changuito», «chispa(s)», «carrito», «pistachos», «cacahuete», «maní», «packaging», «snack», «smoothie».
- **Precios como número entero**, 1–99.999. **Colores solo desde tokens.** **El sitio queda 100% estático.**
- **Los invisibles se escriben como escape (`\u00a0`), nunca se pegan.** Después de tocar cualquier archivo con invisibles, verificalo contra la base:
  ```bash
  python3 -c "import io;print(io.open('<archivo>',encoding='utf-8').read().count(chr(0xa0)))"
  git show <BASE>:<archivo> | python3 -c "import sys;print(sys.stdin.read().count(chr(0xa0)))"
  ```
- **La lista generada manda sobre las tablas de cada tarea.** Las tablas de
  campos de las tareas 3 a 13 se escribieron contra un inventario que resultó
  incompleto. Cada tarea marca TODAS las rutas de su sección que aparezcan en
  `PENDIENTES`, aunque su tabla no las nombre, y reporta cuáles agregó.
- **Los números de línea de `.astro` se mueven** en cuanto una tarea agrega atributos. **Ubicá el código por su texto exacto, no por número de línea.** Los números de este plan son del árbol en `main` al 2026-09-15 y están para orientar, no para saltar.
- **Línea base:** hoy `pnpm test` da **901 tests verdes (35 archivos)** y `pnpm typecheck` **0 errores, 0 warnings, 4 hints**. Ninguna tarea puede bajar el verde.
- **`pnpm build` es la compuerta:** construye el sitio, corre la suite y `astro check`. Ninguna tarea escribe un test que invoque `pnpm build` (`test/meta.test.ts` lo prohíbe: es una bomba de recursión).
- **Nunca restaures un JSON mutado con `pnpm migra`** (el script lee la fachada, que lee el JSON: te reescribe la mutación). Usá `git checkout <archivo>` si está commiteado, o editá el valor de vuelta si no.
- **Commits en español, imperativo,** terminando con:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
  ```

---

## Decisiones de esta parte (leelas antes de la Tarea 1)

**D1 · El atributo nombra el documento.** `data-campo="sitio:anaquel.titulo"`,
`data-campo="sabores:sabores.3.nombre"`, `data-campo="fichas:fichas.0.producto"`.
El prefijo NO es decorativo: `gotas` y `polvo` son claves de primer nivel en
**los dos** documentos (`sitio.json` y `sabores.json`), así que una ruta pelada
como `gotas.1.nombre` no dice de qué documento sale. Sin el prefijo, el
`inyecta.ts` de la fase 6 tendría que adivinar, y la fase 7 (altas de producto)
puede agregar choques nuevos.

**D2 · Para los atributos, el atributo va primero.**
`data-campo-attr="alt:sitio:anaquel.envolturaAltPrefijo"`. Se parte por el
PRIMER `:` (el nombre del atributo) y lo que queda es una referencia de campo
como la de D1, que se parte por su propio primer `:`. Un elemento puede llevar
los dos atributos a la vez (un `<img>` con `alt` editable dentro de una figura
cuyo pie también lo es, por ejemplo).

**D3 · Los índices de lista van concretos.** En el esquema, la ruta de un
elemento de lista se escribe `recetas.lista[].titulo`; en el HTML va con el
índice real: `sitio:recetas.lista.2.titulo`. El test de biyección colapsa los
segmentos numéricos a `[]` para comparar, y además exige que la ruta con índice
resuelva a un valor de verdad en el JSON (así un índice equivocado se cae).

**D4 · El valor puede repetirse; el atributo también.** Es un mapeo
UNO-A-MUCHOS y está medido: `anaquel.pesoInsignia` aparece 17 veces,
`footer.lema` 6. El test es «al menos un nodo en alguna página», **nunca
exactamente uno**.

**D5 · Los campos que la plantilla transforma igual se marcan.** Tres casos
medidos: `hero.titular.1` (la plantilla le saca la coma final),
`footer.legalesNota` (va dentro de un paréntesis) y los precios que
`precioMXN()` formatea. El nodo lleva su `data-campo` igual: el panel de la
fase 6 los va a previsualizar con la misma transformación, y el medidor los
mide como salen. Lo que NO se hace acá es inventar un mecanismo de
transformación declarativa: no hace falta todavía y el spec no lo pide.

**D6 · Lo que NO se marca.** Los campos con `quien: 'marcos'` o
`control: 'oculto' | 'derivado'` (slugs, claves de color, rutas, URLs del
catálogo, los cinco derivados). La clienta no los ve en el panel, así que no
hay nada que resaltar. El test de biyección solo exige nodos para lo que ella
edita.

**D7 · La lista de pendientes es el andamio.** La Tarea 1 escribe
`test/panel.test.ts` con una constante `PENDIENTES` que arranca con las 198
rutas editables. Cada tarea borra de esa lista las rutas que marcó. El test
falla de dos maneras: si una ruta que no está en `PENDIENTES` no tiene nodo
(regresión), y si una ruta de `PENDIENTES` ya no existe en el esquema (lista
podrida). La Tarea 14 la borra entera. Así la suite queda verde en cada commit
sin que el trabajo a medio hacer se disfrace de terminado.

**D8 · Las cuatro páginas que consumen copy** son `dist/index.html`,
`dist/404.html`, `dist/fichas-tecnicas/index.html` y el `<head>` que
`src/layouts/Base.astro` pone en las tres. Las páginas privadas
(`/presentacion`, `/manual`) NO entran: su copy vive en `src/copy/landing.ts` y
`src/copy/marca.ts`, que el panel nunca va a exponer.

---

## Mapa de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `test/lib/campos-en-html.ts` | Lee las páginas construidas y devuelve las referencias `documento:ruta` que encontró, con su página y su atributo si lo tiene. |
| `test/panel.test.ts` | La biyección en los dos sentidos (§3.1 del spec) y la lista de pendientes. |
| `test/componentes-campo.test.ts` | Que los componentes pongan el atributo en el nodo del texto y no en el envoltorio (Tarea 2). |

**Se modifican, en este orden:**

| Archivo | Qué recibe |
|---|---|
| `src/components/marca/Insignia.astro` | prop `campo` opcional → `data-campo` |
| `src/components/marca/EtiquetaSabor.astro` | prop `campo` opcional → `data-campo` en `.texto` |
| `src/components/marca/Marquesina.astro` | prop `campoAria` opcional → `data-campo-attr` del `aria-label` (Tarea 3) |
| `src/pages/index.astro` | el grueso: ~190 nodos, repartidos por sección en las Tareas 3 a 10 |
| `src/pages/404.astro` | los 3 textos de la página (Tarea 11) |
| `src/pages/fichas-tecnicas.astro` | el índice y los 4 documentos de ficha (Tarea 11) |
| `src/layouts/Base.astro` | `<title>`, `<meta name="description">` y `og:site_name` (Tarea 12) |
| `src/contenido/esquema/sitio/{paginas,producto}.ts` + `datos/sitio.json` + `test/fixtures/contenido-2026-09-10.json` | dos campos nuevos: el aria del mapa del sitio (Tarea 10) y el alt del visor 3D (Tarea 13) |
| `src/contenido/textos-ui.ts` + `src/scripts/marca.ts` | el alt del visor 3D pasa a leerse del contenido (Tarea 13) |

**Se borran en la Tarea 14:** `test/html-normalizado.test.ts`,
`test/lib/html-normalizado.ts`, `scripts/captura-html.ts`,
`test/fixtures/html-antes-fase-2/`, la línea `@source not` de
`src/styles/global.css` y el script `captura:html` de `package.json`.

---

### Tarea 1: El test de biyección y la lista de pendientes

**Es el andamio de toda la parte: sin esto, «marcar 200 campos» no tiene forma de terminar.**

**Files:**
- Create: `test/lib/campos-en-html.ts`
- Create: `test/panel.test.ts`
- Test: los dos archivos de arriba

**Interfaces:**
- Consume: `recorre()` de `src/contenido/carga.ts` (firma:
  `recorre(esquema: z.ZodType, visita: (ruta: string, meta: MetaCampo | undefined, hoja: z.ZodType) => void, prefijo?: string): void`),
  los tres esquemas (`esquemaSitio`, `esquemaSabores`, `esquemaFichas`) y las
  tres fachadas (`marca` de `@/copy/sitio-marca`; `sabores`, `gotas`, `polvo`,
  `urlCatalogoBarras` de `@/copy/sabores`; `fichasBase` de `@/fichas/base`).
- Produce: `Referencia`, `referenciasDe()`, `todasLasReferencias()`,
  `colapsaIndices()`, `hayPaginasConstruidas()` — los usan este test y,
  más adelante, el medidor de la fase 4.

- [ ] **Paso 1: El lector de referencias**

Create `test/lib/campos-en-html.ts`:

```ts
/*
 * Lee las páginas CONSTRUIDAS y devuelve qué campos dice el HTML que
 * muestra: cada `data-campo` y cada `data-campo-attr` que encuentra,
 * partido en documento + ruta.
 *
 * Vive en test/lib/ y no en src/ porque hoy lo usa solo la suite. Cuando
 * la fase 4 traiga el medidor, ese va a necesitar exactamente esto sobre
 * el DOM vivo del iframe: si pasa, se muda a src/anti-desborde/ y el
 * test lo importa de ahí. No al revés.
 */
import { readFileSync, existsSync } from 'node:fs'
import { parseHTML } from 'linkedom'

/** Las páginas que consumen copy de la clienta (spec §3.1). */
export const PAGINAS = {
  'index.html': 'dist/index.html',
  '404.html': 'dist/404.html',
  'fichas-tecnicas.html': 'dist/fichas-tecnicas/index.html',
} as const

export type Pagina = keyof typeof PAGINAS

export interface Referencia {
  pagina: Pagina
  /** 'sitio' | 'sabores' | 'fichas' — tal cual vino, sin validar. */
  documento: string
  /** La ruta con índices concretos: 'recetas.lista.2.titulo'. */
  ruta: string
  /** El atributo, cuando vino de `data-campo-attr`. Si no, null. */
  atributo: string | null
  /** El valor crudo del atributo, para que un error diga qué leyó. */
  crudo: string
}

export function hayPaginasConstruidas(): boolean {
  return Object.values(PAGINAS).every((ruta) => existsSync(ruta))
}

/**
 * Colapsa los índices de lista para poder comparar contra el esquema:
 * 'recetas.lista.2.titulo' → 'recetas.lista[].titulo'.
 *
 * El `[]` se le pega al segmento ANTERIOR porque así lo emite `recorre()`
 * (`lista[]`, no `lista.[]`). Ojo: las TUPLAS del esquema tienen índice
 * numérico propio y fijo (`hero.titular.0`), así que quien compare tiene
 * que probar primero la ruta tal cual y recién después la colapsada.
 */
export function colapsaIndices(ruta: string): string {
  const salida: string[] = []
  for (const parte of ruta.split('.')) {
    if (/^\d+$/.test(parte) && salida.length > 0) salida[salida.length - 1] += '[]'
    else salida.push(parte)
  }
  return salida.join('.')
}

const partiendoEnDosPuntos = (valor: string): [string, string] | null => {
  const corte = valor.indexOf(':')
  if (corte <= 0 || corte === valor.length - 1) return null
  return [valor.slice(0, corte), valor.slice(corte + 1)]
}

export function referenciasDe(pagina: Pagina): Referencia[] {
  const { document } = parseHTML(readFileSync(PAGINAS[pagina], 'utf8'))
  const salida: Referencia[] = []

  for (const el of document.querySelectorAll('[data-campo]')) {
    const crudo = el.getAttribute('data-campo') ?? ''
    const partes = partiendoEnDosPuntos(crudo)
    salida.push({
      pagina,
      documento: partes?.[0] ?? '',
      ruta: partes?.[1] ?? '',
      atributo: null,
      crudo,
    })
  }

  for (const el of document.querySelectorAll('[data-campo-attr]')) {
    const crudo = el.getAttribute('data-campo-attr') ?? ''
    // Se parte DOS veces: 'alt:sitio:anaquel.envolturaAltPrefijo' →
    // atributo 'alt', y el resto es una referencia como la de data-campo.
    const primero = partiendoEnDosPuntos(crudo)
    const segundo = primero ? partiendoEnDosPuntos(primero[1]) : null
    salida.push({
      pagina,
      documento: segundo?.[0] ?? '',
      ruta: segundo?.[1] ?? '',
      atributo: primero?.[0] ?? '',
      crudo,
    })
  }

  return salida
}

export function todasLasReferencias(): Referencia[] {
  return (Object.keys(PAGINAS) as Pagina[]).flatMap(referenciasDe)
}
```

- [ ] **Paso 2: El test, con la lista de pendientes vacía todavía**

Create `test/panel.test.ts`:

```ts
/*
 * LA BIYECCIÓN CAMPO ↔ HTML, en los dos sentidos y por página (spec §3.1).
 *
 * El panel de la fase 6 parchea `querySelectorAll('[data-campo="…"]')` y
 * mide el PEOR de los nodos que encuentra. Dos cosas lo rompen en
 * silencio: un campo editable que no tiene ningún nodo (la vista previa
 * no cambia nada y la clienta cree que su edición no funcionó), y un
 * `data-campo` que apunta a una ruta que ya no existe (parchea nada).
 * Este test es lo único que las ataja antes de producción.
 *
 * Nunca «exactamente un nodo»: está MEDIDO que el mapeo es uno-a-muchos
 * —`anaquel.pesoInsignia` sale 17 veces porque las quince fichas se
 * renderizan en build— y esa versión del test no puede pasar.
 */
import { describe, it, expect } from 'vitest'
import { recorre } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { esquemaFichas } from '../src/contenido/esquema/fichas'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '@/copy/sabores'
import { fichasBase } from '@/fichas/base'
import { todasLasReferencias, colapsaIndices, hayPaginasConstruidas } from './lib/campos-en-html'

/**
 * LO QUE FALTA MARCAR. Cada tarea de la fase 2 Parte B borra de acá las
 * rutas que marcó; la última tarea borra la lista entera y este archivo
 * pasa a exigir la biyección completa.
 *
 * El test falla de las dos maneras a propósito: una ruta editable sin
 * nodo que NO esté acá es una regresión, y una ruta que está acá pero ya
 * tiene nodo es una lista podrida que le miente al que la lee.
 */
const PENDIENTES = new Set<string>([
  // (Paso 3: acá va la lista generada)
])

const DOCUMENTOS = {
  sitio: { esquema: esquemaSitio, datos: marca as unknown },
  sabores: { esquema: esquemaSabores, datos: { sabores, gotas, polvo, urlCatalogoBarras } as unknown },
  fichas: { esquema: esquemaFichas, datos: { fichas: fichasBase } as unknown },
} as const

type IdDocumento = keyof typeof DOCUMENTOS

/** Saca la variante de las uniones discriminadas: `bloques[]<tipo=tabla>.filas[][]` → `bloques[].filas[][]`. */
const sinVariante = (ruta: string) => ruta.replace(/<[^>]*>/g, '')

/** Las rutas que la clienta edita: las que el panel tiene que poder resaltar. */
function rutasEditables(id: IdDocumento): string[] {
  const salida: string[] = []
  recorre(DOCUMENTOS[id].esquema as never, (ruta, meta) => {
    if (!meta) return
    const quien = meta.quien ?? 'cliente'
    const control = meta.control ?? 'texto'
    if (quien === 'marcos' || control === 'oculto' || control === 'derivado') return
    salida.push(sinVariante(ruta))
  })
  return salida
}

/** El valor que hay en esa ruta con índices concretos, o undefined. */
function valorEn(id: IdDocumento, ruta: string): unknown {
  let v: unknown = DOCUMENTOS[id].datos
  for (const parte of ruta.split('.')) {
    if (v == null || typeof v !== 'object') return undefined
    v = (v as Record<string, unknown>)[parte]
  }
  return v
}

const referencias = hayPaginasConstruidas() ? todasLasReferencias() : []

describe('la biyección campo ↔ data-campo (spec §3.1)', () => {
  // Mismo patrón que test/css-tokens.test.ts: sin `dist/` el test no
  // puede decir nada, pero en CI la ausencia de dist/ SÍ es un error.
  const sinDist = !hayPaginasConstruidas()
  const enCI = Boolean(process.env.CI || process.env.VERCEL)
  if (sinDist && !enCI) {
    console.warn('test/panel.test.ts: no hay dist/ — corré `pnpm build:sitio` para que este test mida algo.')
  }

  it('hay páginas construidas para medir (en CI es obligatorio)', () => {
    if (sinDist && !enCI) return
    expect(hayPaginasConstruidas()).toBe(true)
  })

  it('(a) todo campo que la clienta edita tiene al menos un nodo en alguna página', () => {
    if (sinDist && !enCI) return
    const marcadas = new Set(
      referencias.flatMap((r) => [
        `${r.documento}:${r.ruta}`,
        `${r.documento}:${colapsaIndices(r.ruta)}`,
      ]),
    )
    const huerfanas: string[] = []
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      for (const ruta of rutasEditables(id)) {
        const clave = `${id}:${ruta}`
        if (marcadas.has(clave)) continue
        if (PENDIENTES.has(clave)) continue
        huerfanas.push(clave)
      }
    }
    expect(huerfanas).toEqual([])
  })

  it('(b) todo data-campo del HTML existe en el esquema y resuelve a un valor', () => {
    if (sinDist && !enCI) return
    const editables = new Set(
      (Object.keys(DOCUMENTOS) as IdDocumento[]).flatMap((id) =>
        rutasEditables(id).map((ruta) => `${id}:${ruta}`),
      ),
    )
    const rotas: string[] = []
    for (const r of referencias) {
      if (!(r.documento in DOCUMENTOS)) {
        rotas.push(`${r.pagina}: documento desconocido en «${r.crudo}»`)
        continue
      }
      const id = r.documento as IdDocumento
      const enEsquema =
        editables.has(`${id}:${r.ruta}`) || editables.has(`${id}:${colapsaIndices(r.ruta)}`)
      if (!enEsquema) {
        rotas.push(`${r.pagina}: «${r.crudo}» no es un campo editable del esquema`)
        continue
      }
      const valor = valorEn(id, r.ruta)
      if (typeof valor !== 'string' && typeof valor !== 'number') {
        rotas.push(`${r.pagina}: «${r.crudo}» no resuelve a un texto ni a un número`)
      }
    }
    expect(rotas).toEqual([])
  })

  it('la lista de pendientes no está podrida: todo lo que dice existe y falta de verdad', () => {
    if (sinDist && !enCI) return
    const editables = new Set(
      (Object.keys(DOCUMENTOS) as IdDocumento[]).flatMap((id) =>
        rutasEditables(id).map((ruta) => `${id}:${ruta}`),
      ),
    )
    const marcadas = new Set(
      referencias.flatMap((r) => [
        `${r.documento}:${r.ruta}`,
        `${r.documento}:${colapsaIndices(r.ruta)}`,
      ]),
    )
    const inventadas = [...PENDIENTES].filter((clave) => !editables.has(clave))
    const yaHechas = [...PENDIENTES].filter((clave) => marcadas.has(clave))
    expect({ inventadas, yaHechas }).toEqual({ inventadas: [], yaHechas: [] })
  })
})
```

- [ ] **Paso 3: Generar la lista de pendientes con las rutas de verdad**

No se tipea a mano. Creá `scratchpad/pendientes.ts` con esto:

```ts
import { recorre } from '../src/contenido/carga'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { esquemaFichas } from '../src/contenido/esquema/fichas'

for (const [id, esquema] of Object.entries({ sitio: esquemaSitio, sabores: esquemaSabores, fichas: esquemaFichas })) {
  recorre(esquema as never, (ruta, meta) => {
    if (!meta) return
    const quien = meta.quien ?? 'cliente'
    const control = meta.control ?? 'texto'
    if (quien === 'marcos' || control === 'oculto' || control === 'derivado') return
    console.log(`  '${id}:${ruta.replace(/<[^>]*>/g, '')}',`)
  })
}
```

Run: `pnpm exec tsx scratchpad/pendientes.ts`
Pegá la salida adentro del `new Set<string>([...])` de `PENDIENTES`, y
borrá `scratchpad/pendientes.ts` (no se commitea: `scratchpad/` es
scratch, no fuente).

**Esperado: 198 rutas** — 182 de `sitio`, 7 de `sabores`, 9 de `fichas`.
[MEDIDO el 2026-09-15 contra el esquema: `recorre(esquemaSitio)` da 209 hojas,
de las que 182 son editables por la clienta.]
Si te da un número muy distinto, pará y decilo: alguien cambió el esquema.

- [ ] **Paso 4: Correr y ver que el test mide algo**

```bash
pnpm build:sitio && pnpm exec vitest run test/panel.test.ts
```

Expected: **PASS las cuatro**. Todavía no hay ningún `data-campo` en el
HTML, así que (a) pasa porque todo está en `PENDIENTES`, (b) pasa en
vacío, y la lista no está podrida.

- [ ] **Paso 5: Probar que los cuatro tests detectan**

Cada mutación, una por vez, restaurando después. Pegá las cuatro salidas.

1. **(a) detecta un huérfano:** borrá `'sitio:anaquel.titulo',` de
   `PENDIENTES` → rojo en (a) con esa ruta en la lista de huérfanas.
2. **(b) detecta un `data-campo` inventado:** en `src/pages/index.astro`,
   en el `<h2 class="titular">{marca.anaquel.titulo}</h2>` de la sección
   del anaquel, agregá `data-campo="sitio:anaquel.tituloQueNoExiste"`,
   `pnpm build:sitio`, corré → rojo en (b) con «no es un campo editable
   del esquema». Sacá el atributo y reconstruí.
3. **(b) detecta un índice que no resuelve:** lo mismo pero con
   `data-campo="sitio:recetas.lista.9.titulo"` (hay 4 recetas) → rojo con
   «no resuelve a un texto ni a un número».
4. **La lista podrida:** agregá `'sitio:campo.que.no.existe',` a
   `PENDIENTES` → rojo con esa ruta en `inventadas`.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add test/lib/campos-en-html.ts test/panel.test.ts
git commit -m "$(cat <<'EOF'
test: la biyección campo ↔ HTML, con la lista de lo que falta marcar

El panel parchea todos los nodos de un campo y mide el peor. Dos cosas lo
rompen en silencio: un campo editable sin ningún nodo —la clienta edita,
la vista previa no cambia, y ella cree que no funcionó— y un data-campo
que apunta a una ruta que ya no existe. Este test es lo único que las
ataja antes de producción.

La lista de pendientes arranca con las 198 rutas editables y cada tarea
de esta fase la achica. No es un TODO: el test falla si una ruta que dice
que falta ya está hecha, así que la lista no puede mentir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 2: Los dos componentes que reciben `campo`

**Files:**
- Modify: `src/components/marca/Insignia.astro`
- Modify: `src/components/marca/EtiquetaSabor.astro`
- Test: `test/componentes-campo.test.ts` (nuevo)

**Interfaces:**
- Produce: `<Insignia tono="cacao" campo="sitio:postura.chips.0">` y
  `<EtiquetaSabor texto={...} campo="sitio:postura.kicker" />`. Las tareas
  3 a 11 los usan así.

**Por qué existen estos dos y no más:** el nodo que muestra el texto vive
ADENTRO del componente, así que desde `index.astro` no se puede marcar. Los
otros componentes de `src/components/marca/` no tienen ese problema:
`BotonMarca` y `TicketPanel` reciben el texto por `<slot>` y el nodo marcable
es el que el llamador ya escribe; `Marquesina` recibe `aria` (se marca con
`data-campo-attr` en su propio elemento, Tarea 3); `ArcoTitulo` es
build-time y hoy no lo usa nadie con copy de la clienta.

- [ ] **Paso 1: Leer los dos componentes enteros antes de tocarlos**

```bash
cat src/components/marca/Insignia.astro src/components/marca/EtiquetaSabor.astro
```

`Insignia.astro` (22 líneas) renderiza `<span class="insignia {tono}"><slot /></span>`.
`EtiquetaSabor.astro` (47) renderiza una `<span class="etiqueta">` con una
`<span class="texto">{texto}</span>` adentro, más adornos. El `data-campo` va
en el nodo del TEXTO, no en el envoltorio: el panel parchea `textContent`.

- [ ] **Paso 2: El test, que hoy falla**

Create `test/componentes-campo.test.ts`:

```ts
/*
 * Los dos componentes cuyo nodo de texto vive adentro: desde la página no
 * se puede marcar, así que reciben la ruta por prop.
 *
 * Se renderizan de verdad (container de Astro), no se les lee el fuente:
 * lo que importa es en QUÉ nodo termina el atributo.
 */
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Insignia from '@/components/marca/Insignia.astro'
import EtiquetaSabor from '@/components/marca/EtiquetaSabor.astro'

const container = await AstroContainer.create()

describe('los componentes que reciben la ruta del campo', () => {
  it('Insignia pone data-campo en el span que muestra el texto', async () => {
    const html = await container.renderToString(Insignia, {
      props: { tono: 'cacao', campo: 'sitio:postura.chips.0' },
      slots: { default: 'SIN AZÚCAR REFINADA' },
    })
    expect(html).toMatch(/<span[^>]*data-campo="sitio:postura\.chips\.0"[^>]*>/)
    expect(html).toContain('SIN AZÚCAR REFINADA')
  })

  it('Insignia sin campo no agrega el atributo (el HTML de hoy no cambia)', async () => {
    const html = await container.renderToString(Insignia, {
      props: { tono: 'cacao' },
      slots: { default: 'SIN AZÚCAR REFINADA' },
    })
    expect(html).not.toContain('data-campo')
  })

  it('EtiquetaSabor pone data-campo en el span del texto, no en el envoltorio', async () => {
    const html = await container.renderToString(EtiquetaSabor, {
      props: { texto: 'LO QUE LLEVA', campo: 'sitio:postura.kicker' },
    })
    expect(html).toMatch(/<span class="texto"[^>]*data-campo="sitio:postura\.kicker"[^>]*>LO QUE LLEVA<\/span>/)
  })

  it('EtiquetaSabor sin campo no agrega el atributo', async () => {
    const html = await container.renderToString(EtiquetaSabor, { props: { texto: 'LO QUE LLEVA' } })
    expect(html).not.toContain('data-campo')
  })
})
```

- [ ] **Paso 3: Correr y verlo fallar**

Run: `pnpm exec vitest run test/componentes-campo.test.ts`
Expected: **FAIL** los dos tests que esperan el atributo (los dos «sin
campo» pasan desde el principio: hoy ningún componente lo pone).

- [ ] **Paso 4: La prop en los dos componentes**

En `src/components/marca/Insignia.astro`, sumá `campo` a las props y
pasalo al `<span>`:

```astro
interface Props {
  tono?: 'cacao' | 'rojo' | 'amarillo'
  /** Ruta del campo, «documento:ruta», para que el panel sepa qué texto es este. */
  campo?: string
}
const { tono = 'cacao', campo } = Astro.props
```

y en el elemento: `data-campo={campo}`.

**`data-campo={campo}` y no `data-campo={campo ?? ''}`:** con `undefined`,
Astro NO emite el atributo, que es exactamente lo que hace falta para que
el HTML de hoy no cambie donde todavía no se marcó nada. Con `''` lo
emitiría vacío y el test (b) de la Tarea 1 se pondría rojo.

En `src/components/marca/EtiquetaSabor.astro`, la misma prop, y el
atributo va en el `<span class="texto">`, NO en el envoltorio.

- [ ] **Paso 5: Verde, y el HTML de hoy intacto**

```bash
pnpm exec vitest run test/componentes-campo.test.ts
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: los cuatro PASS, y el verificador **verde sin recapturar** —
todavía ningún llamador pasa `campo`, así que el HTML sale igual.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add src/components/marca/Insignia.astro src/components/marca/EtiquetaSabor.astro test/componentes-campo.test.ts
git commit -m "$(cat <<'EOF'
feat: Insignia y EtiquetaSabor reciben la ruta de su campo

El nodo que muestra el texto vive adentro del componente, así que desde la
página no se puede marcar. Sin la prop, el atributo no se emite y el HTML
de hoy queda igual.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 3: Cabecera, menú y portada

**Files:**
- Modify: `src/pages/index.astro` — desde `<header class="cabecera"` hasta el cierre de `<section class="portada">`
- Test: `test/panel.test.ts` (solo la lista `PENDIENTES`)

**Interfaces:**
- Consume: `<EtiquetaSabor campo>` de la Tarea 2 (acá todavía no se usa), y el test de la Tarea 1.
- Produce: nada nuevo. Es el patrón que las tareas 4 a 11 repiten.

**Los campos de esta tarea (16 rutas en 14 filas):**

| Ruta | Dónde está hoy | Cómo se marca |
|---|---|---|
| `marca.wordmark` | `<span class="lockup-nombre">` (cabecera) y `<p class="portada-wordmark">` | `data-campo` en los dos (aparece 3 veces con el pie: el del pie va en la Tarea 10) |
| `marca.descriptor` | `<span class="lockup-descriptor mono">` | `data-campo` |
| `skipLink` | `<a href="#contenido" class="salto">` | `data-campo` |
| `nav.abrir` | `<span class="sr-only" data-menu-texto>` | `data-campo` |
| `nav.etiqueta` | `aria-label` del `<nav id="menu-principal">` | `data-campo-attr="aria-label:sitio:nav.etiqueta"` |
| `nav.items[].texto` | nodo de texto suelto adentro del `<a href={item.ancla}>` | **span inventado** |
| `nav.catalogo` | nodo de texto suelto antes del `<span class="sr-only">` | **span inventado** |
| `nav.pie.0`, `nav.pie.1` | `{marca.nav.pie.map((linea) => <span class="mono">{linea}</span>)}` | `data-campo` con el índice del `map` |
| `hero.titular.0`, `.1`, `.2` | los tres renglones del `<h1>`, nodos de texto entre `<br />` | **spans inventados** (ver Paso 2) |
| `hero.sub` | `<p class="portada-sub">` | `data-campo` |
| `hero.ctaSabores` | `<a class="enlace-sabores">` | `data-campo` |
| `hero.marquesinaAria` | prop `aria` de `<Marquesina>` | `data-campo-attr` en el elemento que la Marquesina pinta (ver Paso 3) |
| `hero.ctaCatalogo` | texto del `<slot>` de `<BotonMarca>` | **span inventado** adentro del slot |

`nav.abrir` y `nav.cerrar` son el MISMO nodo (el script lo reescribe). Se marca
con `nav.abrir`, que es el valor que sale del build; `nav.cerrar` queda
**pendiente a propósito** y se resuelve en la Tarea 13 junto con los otros
textos que el script pinta.

`hero.ctaCatalogo` va adentro de `<BotonMarca>`: el nodo marcable es el
`<slot>`, así que se envuelve el texto del slot en un span inventado.

- [ ] **Paso 1: Los marcados directos**

Agregá `data-campo="sitio:<ruta>"` a los elementos que ya existen. Ejemplos
exactos, con el código de hoy a la izquierda:

```astro
<a href="#contenido" class="salto" data-campo="sitio:skipLink">{marca.skipLink}</a>

<span class="lockup-nombre" data-campo="sitio:marca.wordmark">{marca.marca.wordmark}</span>
<span class="lockup-descriptor mono" data-campo="sitio:marca.descriptor">{marca.marca.descriptor}</span>

<span class="sr-only" data-menu-texto data-campo="sitio:nav.abrir">{marca.nav.abrir}</span>

<nav id="menu-principal" class="menu" aria-label={marca.nav.etiqueta} data-menu
     data-campo-attr="aria-label:sitio:nav.etiqueta">

<p class="portada-sub" data-campo="sitio:hero.sub">{marca.hero.sub}</p>
<a class="enlace-sabores" href="#sabores" data-campo="sitio:hero.ctaSabores">{marca.hero.ctaSabores}</a>
<p class="portada-wordmark" data-campo="sitio:marca.wordmark">{marca.marca.wordmark}</p>
```

Y el pie del menú, con el índice del `map`:

```astro
{marca.nav.pie.map((linea, i) => <span class="mono" data-campo={`sitio:nav.pie.${i}`}>{linea}</span>)}
```

- [ ] **Paso 2: Los spans inventados**

El `<h1>`, que hoy son tres nodos de texto entre `<br />`:

```astro
          <h1 class="portada-titular">
            <span data-campo="sitio:hero.titular.0">{marca.hero.titular[0]}</span><br />
            <span data-campo="sitio:hero.titular.1">{marca.hero.titular[1].replace(/,$/, '')}</span><span class="acento">,</span><br />
            <span class="acento" data-campo="sitio:hero.titular.2">{marca.hero.titular[2]}</span>
          </h1>
```

**Ojo con el renglón 2:** la plantilla le saca la coma final y la coma
visible la pone un `<span class="acento">` aparte. El `data-campo` va en el
span del TEXTO, no en el de la coma. El valor del campo (`«MEXICANO,»`, con
coma) no es igual al texto del nodo (`«MEXICANO»`): es uno de los tres campos
transformados de la D5 y está bien así.

**El renglón 3 ya tenía su propio `<span class="acento">`:** no se inventa uno
nuevo, se marca el que está. Si le pusieras un span adentro, el verificador
NO lo desenvuelve (tiene `class`) y se pone rojo, con razón.

Los enlaces del menú y el del catálogo:

```astro
            <a href={item.ancla} data-menu-enlace>
              <span class="menu-numero mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span data-campo={`sitio:nav.items.${i}.texto`}>{item.texto}</span>
            </a>
```

```astro
            <span class="menu-numero mano" aria-hidden="true">↗</span>
            <span data-campo="sitio:nav.catalogo">{marca.nav.catalogo}</span><span class="sr-only"> (se abre en pestaña nueva)</span>
```

Y el texto del botón del catálogo, que va por `<slot>`:

```astro
            <BotonMarca href={urlCatalogoBarras} externo><span data-campo="sitio:hero.ctaCatalogo">{marca.hero.ctaCatalogo}</span></BotonMarca>
```

- [ ] **Paso 3: El aria de la marquesina**

`<Marquesina>` recibe `aria` y lo pinta en su propio elemento. Leé
`src/components/marca/Marquesina.astro` entero y marcá ADENTRO del componente
el elemento que lleva el `aria-label`, con una prop nueva igual a la de la
Tarea 2:

```astro
interface Props {
  aria: string
  dur?: string
  rotacion?: number
  /** Ruta del campo del `aria`, «documento:ruta». */
  campoAria?: string
}
```

y en el elemento: `data-campo-attr={campoAria && `aria-label:${campoAria}`}`.

En `index.astro`: `<Marquesina aria={marca.hero.marquesinaAria} campoAria="sitio:hero.marquesinaAria" dur="140s" rotacion={-3}>`.

**Si `Marquesina.astro` duplica el `<slot>`** (lo hace: es el truco del bucle
sin costura), el `data-campo-attr` NO se duplica — va en el envoltorio, no en
el slot. Verificalo en el HTML construido con
`grep -c 'aria-label:sitio:hero.marquesinaAria' dist/index.html` → **1**.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar**. Los atributos se borran y los spans
inventados se desenvuelven: el HTML normalizado tiene que salir idéntico.

**Si da rojo, el diff te dice cuál de los dos errores hiciste:** o el span
inventado lleva algo más que `data-campo` (mirá si le pusiste `class`), o
moviste un espacio al partir un nodo de texto. Los espacios importan: entre
`{item.texto}` y el `<span>` que lo envuelve no puede quedar un salto de
línea nuevo que antes no estaba.

- [ ] **Paso 5: Achicar la lista de pendientes**

Borrá de `PENDIENTES` en `test/panel.test.ts` exactamente estas 13 líneas:

```
  'sitio:skipLink',
  'sitio:marca.wordmark',
  'sitio:marca.descriptor',
  'sitio:nav.abrir',
  'sitio:nav.etiqueta',
  'sitio:nav.items[].texto',
  'sitio:nav.catalogo',
  'sitio:nav.pie.0',
  'sitio:nav.pie.1',
  'sitio:hero.titular.0',
  'sitio:hero.titular.1',
  'sitio:hero.titular.2',
  'sitio:hero.sub',
  'sitio:hero.ctaSabores',
  'sitio:hero.ctaCatalogo',
  'sitio:hero.marquesinaAria',
```

(Son 16 líneas para 14 filas de la tabla: `hero.titular` son tres rutas —una
por renglón— y `nav.pie` son dos. `marca.wordmark` va una sola vez aunque
tenga dos nodos en esta tarea y un tercero en el pie.)

Run: `pnpm exec vitest run test/panel.test.ts`
Expected: **PASS las cuatro.** Si (a) se pone rojo, te faltó un nodo; si la
cuarta se pone roja con `yaHechas`, borraste de más en otra sección.

- [ ] **Paso 6: Probar que el test detecta**

Sacá el `data-campo="sitio:hero.sub"` del `<p class="portada-sub">`,
`pnpm build:sitio`, corré `pnpm exec vitest run test/panel.test.ts` →
**rojo** en (a) con `sitio:hero.sub` entre las huérfanas. Restauralo,
reconstruí, verde. Pegá las dos salidas.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro src/components/marca/Marquesina.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: la cabecera, el menú y la portada dicen de qué campo sale cada texto

Primera tanda de data-campo. Los tres renglones del titular, el texto de
cada enlace del menú y el del botón del catálogo necesitaban un <span>
inventado: eran nodos de texto sueltos mezclados con otros. El verificador
los desenvuelve y exige que el resto del HTML salga idéntico.

El renglón 2 del titular lleva su data-campo aunque la plantilla le saque
la coma: el panel lo previsualiza con la misma transformación.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 4: La postura (lo que lleva y lo que no)

**Files:**
- Modify: `src/pages/index.astro` — la `<section class="seccion" data-tono="calida">` que abre con `<EtiquetaSabor texto={marca.postura.kicker} />`
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Interfaces:**
- Consume: `<EtiquetaSabor campo>` e `<Insignia campo>` de la Tarea 2.
- Produce: nada nuevo.

**Los campos de esta tarea (9):** `postura.kicker`, `postura.titulo`,
`postura.intro`, `postura.chips[]`, `postura.tabSi`, `postura.tabNo`,
`postura.lleva[]`, `postura.llevaNota`, `postura.noLleva[]`,
`postura.noLlevaCierre`.

- [ ] **Paso 1: Los componentes y los marcados directos**

```astro
          <EtiquetaSabor texto={marca.postura.kicker} campo="sitio:postura.kicker" />
          <h2 class="titular" data-campo="sitio:postura.titulo">{marca.postura.titulo}</h2>
          <p class="postura-intro" data-campo="sitio:postura.intro">{marca.postura.intro}</p>
          {marca.postura.chips.map((chip, i) => (
            <Insignia tono="cacao" campo={`sitio:postura.chips.${i}`}>{chip}</Insignia>
          ))}
```

Los dos botones del conmutador ya son elementos propios:

```astro
            <button type="button" role="tab" id="tab-si" aria-selected="true" aria-controls="panel-si" data-tab data-campo="sitio:postura.tabSi">
            <button type="button" role="tab" id="tab-no" aria-selected="false" aria-controls="panel-no" data-tab data-campo="sitio:postura.tabNo">
```

**Ojo:** el `aria-label` del `<div class="conmutador" role="tablist">` repite
`marca.postura.titulo`. Marcalo también, con
`data-campo-attr="aria-label:sitio:postura.titulo"`: un campo puede tener
varios nodos, y el panel tiene que parchear los dos.

Las dos notas de los paneles:

```astro
            <p class="panel-nota mono" data-campo="sitio:postura.llevaNota">{marca.postura.llevaNota}</p>
            <p class="panel-cierre" data-campo="sitio:postura.noLlevaCierre">{marca.postura.noLlevaCierre}</p>
```

- [ ] **Paso 2: Las dos listas, con span inventado**

Hoy el texto del ítem es un nodo suelto al lado de la marca (`✓` / `✕`):

```astro
              {marca.postura.lleva.map((item, i) => (
                <li><span class="mano panel-marca" aria-hidden="true">✓</span><span data-campo={`sitio:postura.lleva.${i}`}>{item}</span></li>
              ))}
```

```astro
              {marca.postura.noLleva.map((item, i) => (
                <li><span class="mano panel-marca" aria-hidden="true">✕</span><s data-campo={`sitio:postura.noLleva.${i}`}>{item}</s></li>
              ))}
```

**La segunda NO inventa span:** el texto ya vive adentro de un `<s>`, que es
un elemento propio. Marcá el `<s>`. Inventar un span adentro de él sería un
elemento de más que el verificador desenvuelve igual, pero sumaría ruido sin
ganar nada.

- [ ] **Paso 3: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.**

- [ ] **Paso 4: Achicar la lista de pendientes**

Borrá de `PENDIENTES`:

```
  'sitio:postura.kicker',
  'sitio:postura.titulo',
  'sitio:postura.intro',
  'sitio:postura.chips[]',
  'sitio:postura.tabSi',
  'sitio:postura.tabNo',
  'sitio:postura.lleva[]',
  'sitio:postura.llevaNota',
  'sitio:postura.noLleva[]',
  'sitio:postura.noLlevaCierre',
```

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 5: Probar que el test detecta**

Sacá el `campo` del primer `<Insignia>` (el de `postura.chips`),
`pnpm build:sitio`, corré el test → **rojo** en (a) con
`sitio:postura.chips[]`. Restaurá, reconstruí, verde. Pegá las dos salidas.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: la sección de la postura dice de qué campo sale cada texto

Los ítems de «lo que lleva» eran nodos de texto al lado de la palomita:
van en un span inventado. Los de «lo que no lleva» ya viven adentro de un
<s>, así que se marca ese y no se inventa nada.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 5: El anaquel — la sección con más nodos de toda la página

**Las quince fichas se renderizan en el build (decisión de SEO del 2026-08-19), así que cada campo de ficha sale QUINCE veces. Es el caso que hace que la biyección sea uno-a-muchos y no uno-a-uno.**

**Files:**
- Modify: `src/pages/index.astro` — la `<section id="sabores">` entera
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Interfaces:**
- Consume: `<EtiquetaSabor campo>` e `<Insignia campo>` de la Tarea 2.
- Produce: las primeras referencias al documento `sabores`
  (`sabores:sabores.<i>.nombre`, `.cacao`, `.precio`, `.ingredientes`), que las
  tareas 6 y 11 vuelven a usar.

**Los campos de esta tarea:** del documento `sitio` — `anaquel.kicker`,
`anaquel.titulo`, `anaquel.grupoAria`, `anaquel.fichaEtiqueta`,
`anaquel.pesoInsignia`, `anaquel.manoInsignia`, `anaquel.ingredientesEtiqueta`,
`anaquel.cta`, `anaquel.remate`, `anaquel.ilustracionCaption`,
`anaquel.envolturaAltPrefijo`, `anaquel.ilustracionAltPrefijo`. Del documento
`sabores` — `sabores[].nombre`, `sabores[].cacao`, `sabores[].precio`,
`sabores[].ingredientes`.

- [ ] **Paso 1: El encabezado de la sección**

```astro
          <EtiquetaSabor texto={marca.anaquel.kicker} campo="sitio:anaquel.kicker" />
          <h2 class="titular" data-campo="sitio:anaquel.titulo">{marca.anaquel.titulo}</h2>
        <div class="anaquel-riel" role="radiogroup" aria-label={marca.anaquel.grupoAria} data-anaquel
             data-campo-attr="aria-label:sitio:anaquel.grupoAria">
```

- [ ] **Paso 2: Los quince radios y sus nombres**

Cada radio lleva `aria-label={s.nombre}`, que sale del documento `sabores`:

```astro
              aria-label={s.nombre}
              data-anaquel-radio={s.slug}
              data-campo-attr={`aria-label:sabores:sabores.${i}.nombre`}
```

**Necesitás el índice:** el `map` de los radios hoy es
`{sabores.map((s) => (` — pasalo a `{sabores.map((s, i) => (`. El índice del
`map` es el índice del JSON, que es lo que el panel necesita: **no uses
`s.orden`**, que es un número de presentación y puede no coincidir.

- [ ] **Paso 3: Las quince fichas**

La línea del contador mezcla tres cosas en un solo nodo:

```astro
                <p class="mono ficha-orden">
                  <span data-campo="sitio:anaquel.fichaEtiqueta">{marca.anaquel.fichaEtiqueta}</span> <span data-anaquel-contador>{d.orden}</span> <span data-campo="sitio:anaquel.contadorDe">{marca.anaquel.contadorDe}</span>
                </p>
```

**OJO, dos cosas:** (1) `anaquel.contadorDe` es DERIVADO (`control:
'derivado'`) desde la Parte A: el panel lo dibuja en gris y no se edita, así
que **no** hace falta marcarlo y el test no lo pide. Marcalo igual **solo si**
el nodo ya existe por otra razón; si no, dejalo como está. La versión de
arriba con `<span data-campo="sitio:anaquel.contadorDe">` haría fallar el test
(b), porque un derivado no es una ruta editable. **Usá esta:**

```astro
                <p class="mono ficha-orden">
                  <span data-campo="sitio:anaquel.fichaEtiqueta">{marca.anaquel.fichaEtiqueta}</span> {d.orden} {marca.anaquel.contadorDe}
                </p>
```

(2) `{d.orden}` tampoco se marca: es `quien: 'marcos'`, `control: 'oculto'`.

El nombre, el precio y las tres insignias:

```astro
                  <h3 class="ficha-nombre" data-campo={`sabores:sabores.${i}.nombre`}>{d.nombre}</h3>
                  <p class="ficha-precio" data-campo={`sabores:sabores.${i}.precio`}>{d.precio}</p>
                  <Insignia tono="rojo" campo={`sabores:sabores.${i}.cacao`}>{d.cacao}</Insignia>
                  <Insignia tono="cacao" campo="sitio:anaquel.pesoInsignia">{marca.anaquel.pesoInsignia}</Insignia>
                  <Insignia tono="amarillo" campo="sitio:anaquel.manoInsignia">{marca.anaquel.manoInsignia}</Insignia>
```

**El precio es un campo transformado (D5):** el nodo muestra `$122`, que sale
de `precioMXN(122)` en `datosAnaquel`. El `data-campo` apunta igual al número
del JSON; el panel de la fase 6 aplica el mismo formato en la vista previa.

La línea de ingredientes, que hoy es «etiqueta: valor.» en un solo nodo:

```astro
                  <span data-campo="sitio:anaquel.ingredientesEtiqueta">{marca.anaquel.ingredientesEtiqueta}</span>: <span data-campo={`sabores:sabores.${i}.ingredientes`}>{d.ingredientes}</span>.
```

**El punto final queda AFUERA del span**: es de la plantilla, no del campo.
Si lo metés adentro, el panel va a creer que el punto es parte del texto que
la clienta escribe y se lo va a mostrar en el editor.

El CTA (va por `<slot>`) y el remate:

```astro
                  <BotonMarca href={d.url} externo><span data-campo="sitio:anaquel.cta">{marca.anaquel.cta}</span></BotonMarca>
                  <p class="mano ficha-remate suave" data-campo="sitio:anaquel.remate">{marca.anaquel.remate}</p>
```

- [ ] **Paso 4: Los dos alt y el pie de la ilustración**

```astro
                alt={`${marca.anaquel.envolturaAltPrefijo} ${inicial.nombre}`}
                data-campo-attr="alt:sitio:anaquel.envolturaAltPrefijo"
```

```astro
                alt={`${marca.anaquel.ilustracionAltPrefijo} ${inicial.nombre}`}
                data-campo-attr="alt:sitio:anaquel.ilustracionAltPrefijo"
```

```astro
              <figcaption class="mano suave" data-campo="sitio:anaquel.ilustracionCaption">{marca.anaquel.ilustracionCaption}</figcaption>
```

**Los dos alt son PREFIJOS**, no el alt entero: el nombre del sabor se
concatena y el script lo reescribe al elegir otro sabor (Parte A, Tarea 4). El
`data-campo-attr` apunta al prefijo, que es lo único editable.

- [ ] **Paso 5: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.**

Y contá los nodos, que es la prueba de que las quince fichas se marcaron:

```bash
grep -o 'data-campo="sitio:anaquel.pesoInsignia"' dist/index.html | wc -l
```

Expected: **15**. Si da 1, marcaste el componente afuera del `map`.

- [ ] **Paso 6: Achicar la lista de pendientes**

Borrá de `PENDIENTES`:

```
  'sitio:anaquel.kicker',
  'sitio:anaquel.titulo',
  'sitio:anaquel.grupoAria',
  'sitio:anaquel.fichaEtiqueta',
  'sitio:anaquel.pesoInsignia',
  'sitio:anaquel.manoInsignia',
  'sitio:anaquel.ingredientesEtiqueta',
  'sitio:anaquel.cta',
  'sitio:anaquel.remate',
  'sitio:anaquel.ilustracionCaption',
  'sitio:anaquel.envolturaAltPrefijo',
  'sitio:anaquel.ilustracionAltPrefijo',
  'sabores:sabores[].nombre',
  'sabores:sabores[].cacao',
  'sabores:sabores[].precio',
  'sabores:sabores[].ingredientes',
```

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 7: Probar que el test detecta el índice equivocado**

Cambiá un `${i}` por `${i + 1}` en el `data-campo` del nombre,
`pnpm build:sitio`, corré el test → **rojo** en (b) con «no resuelve a un
texto ni a un número» (el sabor 15 no existe). Restaurá, reconstruí, verde.
Pegá las dos salidas: es la prueba de que los índices no son decorativos.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: el anaquel dice de qué campo sale cada texto, en las quince fichas

Es la sección que hace que el mapeo sea uno-a-muchos: las quince fichas se
renderizan en el build por SEO, así que anaquel.pesoInsignia sale quince
veces y el panel tiene que parchear los quince nodos.

Los dos alt son prefijos —el nombre del sabor se concatena y el script lo
reescribe al elegir otra barra—, así que el data-campo-attr apunta al
prefijo, que es lo único editable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 6: Polvo, minis, gotas y la tarjeta de polvo

**Files:**
- Modify: `src/pages/index.astro` — el bloque de `extra-carta` (minis, gotas, polvoCard) dentro de la sección del anaquel, y la `<section id="polvo">` entera
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea (16):** `minis.titulo`, `minis.precio`,
`minis.cuerpo`, `minis.nota`, `gotas.titulo`, `gotas.desdeEtiqueta`,
`gotas.cuerpo`, `gotas.notaPrecio`, `gotas.sabores`, `polvoCard.titulo`,
`polvoCard.chip`, `polvoCard.cuerpo`, `polvo.kicker`, `polvo.chip`,
`polvo.titulo`, `polvo.cuerpo`, `polvo.altPrefijo`, y del documento `sabores`:
`gotas[].nombre`, `polvo[].nombre`.

**Dos títulos mezclan texto con precio en el mismo nodo** — son los casos
`:340` y `:360` que el spec §3.2 midió:

- [ ] **Paso 1: Los dos títulos con precio, partidos**

```astro
                <p class="extra-titulo"><span data-campo="sitio:minis.titulo">{marca.minis.titulo}</span> · <span data-campo="sitio:minis.precio">{precioMXN(marca.minis.precio)}</span></p>
```

```astro
                <span class="mono extra-precio"><span data-campo="sitio:gotas.desdeEtiqueta">{marca.gotas.desdeEtiqueta}</span> <span data-campo="sitio:gotas.precioDesde">{precioMXN(marca.gotas.precioDesde)}</span></span>
```

**`gotas.precioDesde` es DERIVADO** (sale del más barato de las gotas): no es
una ruta editable, así que ese `data-campo` haría fallar el test (b). La
versión correcta es sin marcar el precio:

```astro
                <span class="mono extra-precio"><span data-campo="sitio:gotas.desdeEtiqueta">{marca.gotas.desdeEtiqueta}</span> {precioMXN(marca.gotas.precioDesde)}</span>
```

Lo mismo con la nota de precio de las gotas, donde `precioJengibre` también es
derivado:

```astro
              <p class="mono extra-nota suave"><span data-campo="sitio:gotas.notaPrecio">{marca.gotas.notaPrecio}</span>: {precioMXN(marca.gotas.precioJengibre)}</p>
```

`minis.precio` SÍ es editable (`control: 'precio'`), por eso ese sí se marca.

- [ ] **Paso 2: El resto de los marcados directos**

```astro
                <p class="extra-cuerpo" data-campo="sitio:minis.cuerpo">{marca.minis.cuerpo}</p>
                <p class="mano" data-campo="sitio:minis.nota">{marca.minis.nota}</p>
                <h4 data-campo="sitio:gotas.titulo">{marca.gotas.titulo}</h4>
              <p class="extra-cuerpo suave" data-campo="sitio:gotas.cuerpo">{marca.gotas.cuerpo}</p>
                <h4 data-campo="sitio:polvoCard.titulo">{marca.polvoCard.titulo}</h4>
                <span class="mono extra-chip" data-campo="sitio:polvoCard.chip">{marca.polvoCard.chip}</span>
              <p class="extra-cuerpo suave" data-campo="sitio:polvoCard.cuerpo">{marca.polvoCard.cuerpo}</p>
```

La sección del polvo:

```astro
            <EtiquetaSabor texto={marca.polvo.kicker} campo="sitio:polvo.kicker" />
            <span class="sello-pronto mano" aria-hidden="true" data-campo="sitio:polvo.chip">{marca.polvo.chip}</span>
            <span class="sr-only" data-campo="sitio:polvo.chip">{marca.polvo.chip}</span>
          <h2 class="titular" data-campo="sitio:polvo.titulo">{marca.polvo.titulo}</h2>
          <p class="suave" data-campo="sitio:polvo.cuerpo">{marca.polvo.cuerpo}</p>
        <div class="polvo-riel" role="region" aria-label={marca.polvo.titulo} tabindex="0" data-parallax="0.05"
             data-campo-attr="aria-label:sitio:polvo.titulo">
```

**`polvo.chip` va en DOS nodos** (el sello visible y la copia para lectores de
pantalla): los dos llevan el mismo `data-campo`. Es exactamente el caso
uno-a-muchos, y el panel tiene que parchear los dos o la versión accesible
queda vieja.

- [ ] **Paso 3: Las listas del documento `sabores`**

Los nombres de las gotas y de los polvos salen de `sabores.json`. Pasá los
`map` a `(g, i)` / `(p, i)` y marcá con el índice:

```astro
                <li class="mono gotas-punto" data-campo={`sabores:gotas.${i}.nombre`}>{g.nombre}</li>
```

```astro
              alt={`${marca.polvo.altPrefijo} ${p.nombre}`}
              data-campo-attr="alt:sitio:polvo.altPrefijo"
```

Y el nombre del polvo donde se muestre como texto:
`data-campo={`sabores:polvo.${i}.nombre`}`.

**Leé el bloque entero antes de editarlo:** el riel de gotas tiene un
`aria-label` compuesto (`` `${marca.gotas.sabores} de gotas` ``) y una cifra
`aria-hidden`. La cifra lleva `data-campo="sitio:gotas.sabores"`; el
`aria-label` compuesto NO se marca (el texto « de gotas» es de la plantilla y
el campo ya tiene nodo).

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.**

- [ ] **Paso 5: Achicar la lista de pendientes**

Borrá de `PENDIENTES` las rutas de arriba (las de `sitio:minis.*`,
`sitio:gotas.*`, `sitio:polvoCard.*`, `sitio:polvo.*`, más
`sabores:gotas[].nombre` y `sabores:polvo[].nombre`).

**Si la lista trae alguna ruta de estas secciones que este plan no nombra
—porque el esquema creció—, marcala también y decilo en el reporte.** El plan
se escribió contra el esquema del 2026-09-15; la lista sale del esquema de
hoy, y la lista manda.

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 6: Probar que el test detecta**

Sacá el `data-campo` del `<h4>` de las gotas, `pnpm build:sitio`, corré el
test → **rojo** en (a) con `sitio:gotas.titulo`. Restaurá, reconstruí, verde.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: las tarjetas de producto dicen de qué campo sale cada texto

Los dos títulos que mezclan nombre y precio en un solo nodo se parten en
spans. Los precios derivados —el «desde» de las gotas y el del jengibre—
NO se marcan: no son editables, y marcarlos haría fallar la biyección.

El chip del polvo va en dos nodos, el visible y el de lectores de pantalla:
los dos llevan el mismo campo, o la versión accesible queda vieja.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 7: Cómo catar y las recetas

**Files:**
- Modify: `src/pages/index.astro` — `<section id="catar">` y `<section id="recetas">`
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea (18):** `catar.kicker`, `catar.titulo`,
`catar.pasos[].nombre`, `catar.pasos[].texto`, `catar.cita`,
`catar.porqueTitulo`, `catar.porque`, `catar.aporteTitulo`, `catar.aporte`,
`recetas.kicker`, `recetas.titulo`, `recetas.deslizaNota`,
`recetas.listaAria`, `recetas.verCompleta`, `recetas.etiquetaTip`,
`recetas.lista[].kicker`, `.titulo`, `.resumen`, `.ingredientes[]`, `.pasos`,
`.tip`, `.chipPolvo`.

- [ ] **Paso 1: Los pasos de «cómo catar», que mezclan nombre y texto**

Hoy: `<p><b>{paso.nombre}.</b> {paso.texto}</p>`. El `<b>` ya es un elemento
propio (se marca), el texto de al lado es un nodo suelto (span inventado). El
punto queda afuera del campo, como en el anaquel:

```astro
              <p><b data-campo={`sitio:catar.pasos.${i}.nombre`}>{paso.nombre}</b>. <span data-campo={`sitio:catar.pasos.${i}.texto`}>{paso.texto}</span></p>
```

**OJO con el punto:** hoy está ADENTRO del `<b>` (`{paso.nombre}.`). Al
sacarlo, el HTML cambia: `<b>Mirala.</b>` pasa a `<b>Mirala</b>.` — el
verificador lo va a marcar como diferencia porque el punto cambió de
elemento. **Dejalo adentro del `<b>`**:

```astro
              <p><b data-campo={`sitio:catar.pasos.${i}.nombre`}>{paso.nombre}.</b> <span data-campo={`sitio:catar.pasos.${i}.texto`}>{paso.texto}</span></p>
```

y anotá en el reporte que el nodo de `catar.pasos[].nombre` incluye el punto
final: es el cuarto campo transformado, además de los tres de la D5. El panel
de la fase 6 lo va a previsualizar con el punto.

Las dos notas de abajo tienen la misma forma (`<b class="nota-titulo">` +
texto suelto), con una diferencia: en `porqueTitulo` el punto NO está en la
plantilla y en `aporteTitulo` sí (`{marca.catar.aporteTitulo}.`). Marcá el
`<b>` en los dos y envolvé el texto en un span inventado, sin mover ningún
punto.

- [ ] **Paso 2: El resto de catar**

```astro
        <EtiquetaSabor texto={marca.catar.kicker} campo="sitio:catar.kicker" />
        <h2 class="titular" data-campo="sitio:catar.titulo">{marca.catar.titulo}</h2>
            <p class="cita-texto">“<span data-campo="sitio:catar.cita">{marca.catar.cita}</span>”</p>
```

**Las comillas tipográficas quedan afuera del span:** las pone la plantilla,
no la clienta. Si las metieras adentro, el editor se las mostraría como parte
del texto y ella podría borrarlas sin querer.

- [ ] **Paso 3: Las recetas**

```astro
        <EtiquetaSabor texto={marca.recetas.kicker} campo="sitio:recetas.kicker" />
        <span class="mano suave" aria-hidden="true" data-campo="sitio:recetas.deslizaNota">{marca.recetas.deslizaNota}</span>
      <div class="contenedor"><h2 class="titular" data-campo="sitio:recetas.titulo">{marca.recetas.titulo}</h2></div>
      <div class="recetas-riel" role="region" aria-label={marca.recetas.listaAria} tabindex="0"
           data-campo-attr="aria-label:sitio:recetas.listaAria">
```

El `map` pasa a `(r, i)` y cada receta se marca con su índice:

```astro
            <p class="mono receta-kicker" data-campo={`sitio:recetas.lista.${i}.kicker`}>{r.kicker}</p>
            <h3 class="receta-titulo" data-campo={`sitio:recetas.lista.${i}.titulo`}>{r.titulo}</h3>
            <p class="receta-resumen" data-campo={`sitio:recetas.lista.${i}.resumen`}>{r.resumen}</p>
            {r.chipPolvo && <p class="mono receta-chip" data-campo={`sitio:recetas.lista.${i}.chipPolvo`}>{r.chipPolvo}</p>}
            <div class="receta-tip mano"><b data-campo="sitio:recetas.etiquetaTip">{marca.recetas.etiquetaTip}</b>: <span data-campo={`sitio:recetas.lista.${i}.tip`}>{r.tip}</span></div>
              <summary data-campo="sitio:recetas.verCompleta">{marca.recetas.verCompleta}</summary>
                {r.ingredientes.map((ing, j) => <li data-campo={`sitio:recetas.lista.${i}.ingredientes.${j}`}>{ing}</li>)}
              <p data-campo={`sitio:recetas.lista.${i}.pasos`}>{r.pasos}</p>
```

**`chipPolvo` es opcional y tres recetas no lo tienen.** El `data-campo` va
adentro del `&&`, así que solo existe el nodo cuando existe el texto. El test
(a) se conforma con **un** nodo en toda la página, y la receta que sí lo tiene
lo aporta.

**El `<b>` del tip ya tenía el `:` afuera** (`<b>{etiquetaTip}:</b>`): hoy los
dos puntos están ADENTRO del `<b>`. Dejalos adentro y marcá el `<b>` igual;
no muevas el `:`.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.** Si da rojo, casi seguro moviste un punto o
unos dos puntos de lugar: el diff te lo muestra como texto que cambió de
elemento.

- [ ] **Paso 5: Achicar la lista de pendientes y correr el test**

Borrá de `PENDIENTES` las rutas `sitio:catar.*` y `sitio:recetas.*` de la
lista de arriba. Run: `pnpm exec vitest run test/panel.test.ts` → **PASS.**

- [ ] **Paso 6: Probar que el test detecta**

Sacá el `data-campo` del `<summary>`, `pnpm build:sitio`, corré el test →
**rojo** con `sitio:recetas.verCompleta`. Restaurá, reconstruí, verde.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: cómo catar y las recetas dicen de qué campo sale cada texto

Los pasos y el tip mezclan un <b> con texto suelto: el <b> se marca y el
texto va en un span inventado. Los puntos y los dos puntos NO se mueven de
elemento —el verificador los ve— así que el nodo del nombre del paso
incluye su punto final, y el panel lo previsualiza así.

Las comillas de la cita quedan afuera del campo: las pone la plantilla.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 8: Nosotros y negocios

**Files:**
- Modify: `src/pages/index.astro` — `<section id="nosotros">` y `<section id="negocios">`
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea (~26):** `nosotros.kicker`, `nosotros.titulo`,
`nosotros.parrafos[]`, `nosotros.cacaoTitulo`, `nosotros.cacao`,
`nosotros.datos.0`, `nosotros.datos.1`, `nosotros.personajeAlt`,
`negocios.kicker`, `negocios.titulo`, `negocios.intro`,
`negocios.fichas[].dato`, `negocios.fichas[].estado`, `negocios.fichasCta`,
`negocios.fichaEnlace`, `negocios.correoEtiqueta`, `negocios.correo`, y por
cada pestaña (`negocios.tabs.0/1/2`): `etiqueta`, `titulo`, `precioNota`,
`cuerpo`, `datos[]`, más `negocios.tabs.0.precio` (el único precio de pestaña
que NO es derivado).

- [ ] **Paso 1: Nosotros**

```astro
          <EtiquetaSabor texto={marca.nosotros.kicker} campo="sitio:nosotros.kicker" />
          <h2 class="titular" data-campo="sitio:nosotros.titulo">{marca.nosotros.titulo}</h2>
          {marca.nosotros.parrafos.map((p, i) => <p class="nosotros-parrafo" data-campo={`sitio:nosotros.parrafos.${i}`}>{p}</p>)}
            <b class="nota-titulo" data-campo="sitio:nosotros.cacaoTitulo">{marca.nosotros.cacaoTitulo}</b> <span data-campo="sitio:nosotros.cacao">{marca.nosotros.cacao}</span>
            alt={marca.nosotros.personajeAlt}
            data-campo-attr="alt:sitio:nosotros.personajeAlt"
```

La línea de datos hoy es un `join(' · ')` en un solo nodo. Los dos datos son
editables, así que se parte:

```astro
            <p class="mono suave"><span data-campo="sitio:nosotros.datos.0">{marca.nosotros.datos[0]}</span> · <span data-campo="sitio:nosotros.datos.1">{marca.nosotros.datos[1]}</span></p>
```

**Verificá el separador carácter por carácter.** Hoy es `join(' · ')`:
espacio, punto medio, espacio. Si lo escribís distinto —por ejemplo con un
espacio duro— el verificador se pone rojo y con razón. Comparalo con
`git show HEAD:src/pages/index.astro | grep "datos.join"`.

- [ ] **Paso 2: Negocios, encabezado y fichas**

```astro
          <EtiquetaSabor texto={marca.negocios.kicker} campo="sitio:negocios.kicker" />
          <h2 class="titular" data-campo="sitio:negocios.titulo">{marca.negocios.titulo}</h2>
          <p class="suave negocios-intro" data-campo="sitio:negocios.intro">{marca.negocios.intro}</p>
          <div class="pestanas" role="tablist" aria-label={marca.negocios.titulo}
               data-campo-attr="aria-label:sitio:negocios.titulo">
```

Las tres pestañas (el `map` ya tiene `i`):

```astro
              >{t.etiqueta}</button>
```
pasa a
```astro
                data-campo={`sitio:negocios.tabs.${i}.etiqueta`}
              >{t.etiqueta}</button>
```

La lista de definiciones:

```astro
            {marca.negocios.fichas.map((f, i) => (
                <dt data-campo={`sitio:negocios.fichas.${i}.dato`}>{f.dato}</dt>
                <dd class="mono" data-campo={`sitio:negocios.fichas.${i}.estado`}>{f.estado}</dd>
```

El botón a las fichas técnicas (va por `<slot>`):

```astro
            <BotonMarca href={marca.fichasTecnicas.ruta} variante="secundario"><span data-campo="sitio:negocios.fichasCta">{marca.negocios.fichasCta}</span></BotonMarca>
```

- [ ] **Paso 3: Los tres paneles, con el precio que puede no estar**

```astro
                <h3 data-campo={`sitio:negocios.tabs.${i}.titulo`}>{t.titulo}</h3>
                <span class="mono">{t.precio == null ? <span data-campo={`sitio:negocios.tabs.${i}.precioNota`}>{t.precioNota}</span> : <><span data-campo={`sitio:negocios.tabs.${i}.precioNota`}>{t.precioNota}</span> {precioMXN(t.precio)}</>}</span>
              <p class="negocio-cuerpo" data-campo={`sitio:negocios.tabs.${i}.cuerpo`}>{t.cuerpo}</p>
                {t.datos.map((d, j) => (
                  <li data-campo={`sitio:negocios.tabs.${i}.datos.${j}`}>{d}</li>
```

**Cuidado con el ternario:** hoy la rama con precio arma un solo string
(`` `${t.precioNota} ${precioMXN(t.precio)}` ``). Al partirlo en dos nodos, el
espacio del medio TIENE que quedar igual: un espacio normal entre el `</span>`
y el `{precioMXN(...)}`. Corré el verificador antes de seguir; si se pone
rojo, es el espacio.

**`negocios.tabs.1.precio` y `.2.precio` son DERIVADOS** (salen de las gotas y
de las barras): no se marcan. `tabs.0.precio` es `null` en el contenido de hoy
—el polvo todavía no tiene precio— y es editable: cuando la clienta le ponga
uno, el nodo aparece solo. **El test (a) lo va a pedir igual**, y como hoy no
hay nodo, esa ruta se queda en `PENDIENTES` con un comentario que lo explique:

```ts
  // El polvo todavía no tiene precio (`null`), así que la plantilla no
  // renderiza ningún nodo. Cuando la clienta le ponga uno, el nodo aparece
  // con su data-campo y esta línea se borra. Antes no.
  'sitio:negocios.tabs.0.precio',
```

- [ ] **Paso 4: El correo de negocios**

```astro
              <p class="mono negocio-correo"><span data-campo="sitio:negocios.correoEtiqueta">{marca.negocios.correoEtiqueta}</span> <span data-campo="sitio:negocios.correo">{marca.negocios.correo}</span></p>
```

Y el enlace a la ficha de cada pestaña:

```astro
                <a href={`${marca.fichasTecnicas.ruta}${t.ficha}`}>
                  <span data-campo="sitio:negocios.fichaEnlace">{marca.negocios.fichaEnlace}</span><span class="mano" aria-hidden="true"> →</span>
```

- [ ] **Paso 5: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.**

- [ ] **Paso 6: Achicar la lista de pendientes y correr el test**

Borrá las rutas `sitio:nosotros.*` y `sitio:negocios.*` **menos**
`'sitio:negocios.tabs.0.precio'`, que queda con su comentario.

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 7: Probar que el test detecta**

Sacá el `data-campo` de un `<dt>` de las fichas de negocio,
`pnpm build:sitio`, corré el test → **rojo** con
`sitio:negocios.fichas[].dato`. Restaurá, reconstruí, verde.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: nosotros y negocios dicen de qué campo sale cada texto

La línea de datos era un join(' · ') en un solo nodo: se parte en dos
spans respetando el separador carácter por carácter. Los precios de las
pestañas de gotas y barras son derivados y no se marcan.

El precio del polvo es editable pero hoy es null, así que la plantilla no
renderiza ningún nodo: queda en la lista de pendientes con el porqué, y se
borra el día que tenga precio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 9: Preguntas y contacto — la sección más grande (34 campos)

**Files:**
- Modify: `src/pages/index.astro` — `<section id="preguntas">` y `<section id="contacto">`
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea:** `preguntas.kicker`, `preguntas.titulo`,
`preguntas.items[].p`, `preguntas.items[].r`, y los 34 de `contacto.*`
(el formulario entero, el bloque de información y el correo).

- [ ] **Paso 1: Preguntas**

```astro
        <EtiquetaSabor texto={marca.preguntas.kicker} campo="sitio:preguntas.kicker" />
        <h2 class="titular" data-campo="sitio:preguntas.titulo">{marca.preguntas.titulo}</h2>
          {marca.preguntas.items.map((item, i) => (
                <h3 data-campo={`sitio:preguntas.items.${i}.p`}>{item.p}</h3>
              <p class="suave" data-campo={`sitio:preguntas.items.${i}.r`}>{item.r}</p>
```

- [ ] **Paso 2: El formulario**

Los `<span>` de las etiquetas ya son elementos propios: se marcan sin
inventar nada.

```astro
            <h3 class="formulario-titulo" data-campo="sitio:contacto.formulario.titulo">{marca.contacto.formulario.titulo}</h3>
                <span data-campo="sitio:contacto.formulario.nombre">{marca.contacto.formulario.nombre}</span>
                <span data-campo="sitio:contacto.formulario.correo">{marca.contacto.formulario.correo}</span>
                <legend data-campo="sitio:contacto.formulario.tipo">{marca.contacto.formulario.tipo}</legend>
                <span data-campo="sitio:contacto.formulario.mensaje">{marca.contacto.formulario.mensaje}</span>
                <span data-formulario-boton data-campo="sitio:contacto.formulario.enviar">{marca.contacto.formulario.enviar}</span>
              <p class="formulario-nota suave" data-campo="sitio:contacto.formulario.nota">{marca.contacto.formulario.nota}</p>
                  <p class="exito-titulo mano" data-campo="sitio:contacto.formulario.exitoTitulo">{marca.contacto.formulario.exitoTitulo}</p>
                  <p class="exito-sub" data-campo="sitio:contacto.formulario.exitoSub">{marca.contacto.formulario.exitoSub}</p>
```

Los tres que viven en atributos o en nodos sin elemento propio:

```astro
                <textarea name="mensaje" rows="5" placeholder={marca.contacto.formulario.mensajeEjemplo} required
                          data-campo-attr="placeholder:sitio:contacto.formulario.mensajeEjemplo"></textarea>
            data-asunto-personal={marca.contacto.formulario.asuntoPersonal}
            data-asunto-negocio={marca.contacto.formulario.asuntoNegocio}
```

El `<form>` lleva los dos asuntos en `data-*`, así que el elemento puede
llevar UN solo `data-campo-attr`. **Poné el de `asuntoPersonal`** y dejá
`asuntoNegocio` en `PENDIENTES` con este comentario:

```ts
  // El <form> lleva los dos asuntos en data-asunto-*; `data-campo-attr` es
  // un solo atributo por elemento. Se resuelve en la fase 6, cuando el
  // panel tenga la ficha del formulario: ahí los dos se editan juntos y
  // ninguno de los dos necesita nodo propio. Ver spec §1.7.
  'sitio:contacto.formulario.asuntoNegocio',
```

Los textos de los dos radios (`tipoOpciones[].texto`) y los dos sueltos
(`otraVez`, `aviso`, `trampa`) van en spans inventados si el texto es un nodo
suelto; miralos en el archivo y marcá el elemento propio cuando exista.

- [ ] **Paso 3: El bloque de información y el correo**

```astro
            <p class="mono info-etiqueta" data-campo="sitio:contacto.correoEtiqueta">{marca.contacto.correoEtiqueta}</p>
              <a href={`mailto:${marca.contacto.correo}`} data-campo="sitio:contacto.correo">{marca.contacto.correo}</a>
              <button class="copiar" type="button" data-copiar={marca.contacto.correo} hidden
                      data-campo-attr="data-copiar:sitio:contacto.correo">
                <span data-copiar-texto data-campo="sitio:contacto.copiar">{marca.contacto.copiar}</span>
            <p class="info-nota suave" data-campo="sitio:contacto.correoNota">{marca.contacto.correoNota}</p>
            <p class="mono info-etiqueta" data-campo="sitio:contacto.puestoEtiqueta">{marca.contacto.puestoEtiqueta}</p>
            <p class="info-dato"><span data-campo="sitio:contacto.puestoTitulo.0">{marca.contacto.puestoTitulo[0]}</span> <span data-campo="sitio:contacto.puestoTitulo.1">{marca.contacto.puestoTitulo[1]}</span></p>
            <p class="info-nota suave"><span data-campo="sitio:contacto.direccion.0">{marca.contacto.direccion[0]}</span> · <span data-campo="sitio:contacto.direccion.1">{marca.contacto.direccion[1]}</span></p>
            <p class="mono info-etiqueta" data-campo="sitio:contacto.catalogoEtiqueta">{marca.contacto.catalogoEtiqueta}</p>
                <span data-campo="sitio:contacto.catalogoNombre">{marca.contacto.catalogoNombre}</span><span class="sr-only"> (se abre en pestaña nueva)</span>
            <p class="info-nota suave" data-campo="sitio:contacto.catalogoNota">{marca.contacto.catalogoNota}</p>
            <p class="mono info-etiqueta" data-campo="sitio:contacto.redesEtiqueta">{marca.contacto.redesEtiqueta}</p>
            <p class="info-dato" data-campo="sitio:contacto.redes">{marca.contacto.redes}</p>
            <p class="info-nota suave" data-campo="sitio:contacto.redesNota">{marca.contacto.redesNota}</p>
            alt={marca.contacto.personajeAlt}
            data-campo-attr="alt:sitio:contacto.personajeAlt"
```

**`puestoTitulo` y `direccion` son tuplas de 2** y hoy se renderizan con
`join(' ')` y con ` · ` respectivamente: los dos se parten en spans, cuidando
el separador exacto.

**`contacto.copiado` no se marca acá:** es uno de los textos que el script
pinta en runtime (Parte A, `textos-ui`), no está en el HTML construido. Queda
en `PENDIENTES` hasta la Tarea 13.

**Los tres campos de `direccionPostal` (localidad, estado, código postal) no
tienen nodo:** viven solo en el JSON-LD del `<head>`. Quedan en `PENDIENTES`
hasta la Tarea 12, que marca el `<head>`.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar.** Esta sección tiene tres separadores
distintos (` `, ` · `, `@`): si algo se pone rojo, es uno de ellos.

- [ ] **Paso 5: Achicar la lista de pendientes y correr el test**

Borrá las rutas `sitio:preguntas.*` y `sitio:contacto.*` **menos** estas
cuatro, que se quedan con su comentario: `contacto.copiado`,
`contacto.formulario.asuntoNegocio`, `contacto.formulario.enviando`, y las
tres de `contacto.direccionPostal.*`.

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 6: Probar que el test detecta**

Sacá el `data-campo` del `<a>` del correo, `pnpm build:sitio`, corré el test
→ **rojo** con `sitio:contacto.correo`. Restaurá, reconstruí, verde.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: preguntas y contacto dicen de qué campo sale cada texto

Es la sección con más campos: el formulario entero, el bloque de datos y
el correo. Las tuplas de dos —el nombre del puesto y las dos líneas de la
dirección— se parten en spans respetando el separador exacto.

Quedan pendientes a propósito: los dos textos que el script pinta en
runtime, el segundo asunto del formulario (un elemento no puede llevar dos
data-campo-attr) y los tres campos de la dirección de Google, que viven en
el <head>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 10: El pie, y el campo que hoy no existe

**Files:**
- Modify: `src/pages/index.astro` — `<footer class="pie">` entera
- Modify: `src/contenido/esquema/sitio/paginas.ts` (o el archivo donde vive el grupo `footer`) — un campo nuevo
- Modify: `src/contenido/datos/sitio.json` — el valor del campo nuevo
- Modify: `test/fixtures/contenido-2026-09-10.json` — **a mano, en este mismo commit**
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea (9 + 1 nuevo):** `footer.lema`,
`footer.seccionesTitulo`, `footer.productosTitulo`, `footer.contactoTitulo`,
`footer.legalesTitulo`, `footer.productos[].texto`, `footer.legales[]`,
`footer.legalesNota`, `footer.derechos`, `footer.linea`, más el campo nuevo
`footer.mapaAria`.

**Por qué el campo nuevo:** `<nav class="pie-columnas" aria-label="Mapa del
sitio">` tiene el texto escrito a mano en la plantilla. Es de la misma clase
que el `alt` del visor 3D (Ruling D de la Parte A): un texto que las personas
ciegas leen y que hoy nadie puede cambiar sin tocar el código. Lo encontró la
revisión final de la Parte A.

- [ ] **Paso 1: El campo nuevo**

En el grupo `footer` del esquema, después de `legalesTitulo`:

```ts
      // El `aria-label` del bloque de columnas del pie. Lo leen las
      // personas ciegas y los buscadores; en la pantalla no se ve. Estaba
      // escrito a mano en index.astro hasta la fase 2 Parte B.
      mapaAria: texto({
        ...enPie,
        etiqueta: 'Nombre del mapa del sitio',
        ayuda: 'No se ve en la página: es el nombre que escuchan las personas que navegan con lector de pantalla cuando llegan a las columnas del pie.',
        maxCaracteres: 40,
        falla: ['ninguno'],
      }),
```

(`enPie` es la constante de sección que ese archivo ya usa; si se llama
distinto, usá la que esté.)

- [ ] **Paso 2: El dato, a mano y después canónico**

`serializa()` va a exigir la clave nueva, y el script lee la fachada, que lee
el JSON: es el caso donde **sí** se escribe a mano. Agregá
`"mapaAria": "Mapa del sitio"` en el bloque `footer` de
`src/contenido/datos/sitio.json`, en la posición que declara el esquema, y
después corré `pnpm migra sitio` para dejar el archivo en orden canónico.
Verificá con `git diff` que el único cambio es esa línea.

- [ ] **Paso 3: El certificado va a dar ROJO y se actualiza**

```bash
pnpm exec vitest run test/contenido-fachada.test.ts
```

Expected: **rojo** en «marca exporta el mismo objeto que antes de la
migración», diciendo que apareció `footer.mapaAria`. Es un cambio de contenido
deliberado. Agregá `"mapaAria": "Mapa del sitio"` en el mismo lugar de
`test/fixtures/contenido-2026-09-10.json`, **en este mismo commit**, y pegá el
diff del fixture en el reporte: son dos líneas y alguien tiene que leerlas.

- [ ] **Paso 4: El pie marcado**

```astro
      <Marquesina aria={marca.footer.lema} campoAria="sitio:footer.lema" dur="24s">
        <span class="mono pie-lema" data-campo="sitio:footer.lema">{marca.footer.lema} ·</span>
        <span class="mono pie-lema" data-campo="sitio:footer.lema">{marca.footer.lema} ·</span>
        <p class="pie-wordmark" data-campo="sitio:marca.wordmark">{marca.marca.wordmark}</p>
        <p class="mono pie-linea" data-campo="sitio:footer.linea">{marca.footer.linea}</p>
      <nav class="pie-columnas" aria-label={marca.footer.mapaAria} data-campo-attr="aria-label:sitio:footer.mapaAria">
          <p class="pie-titulo mano" data-campo="sitio:footer.seccionesTitulo">{marca.footer.seccionesTitulo}</p>
          <p class="pie-titulo mano" data-campo="sitio:footer.productosTitulo">{marca.footer.productosTitulo}</p>
          <p class="pie-titulo mano" data-campo="sitio:footer.contactoTitulo">{marca.footer.contactoTitulo}</p>
          <p class="pie-titulo mano" data-campo="sitio:footer.legalesTitulo">{marca.footer.legalesTitulo}</p>
      <p class="mono" data-campo="sitio:footer.derechos">{marca.footer.derechos}</p>
```

**El ` ·` del lema queda ADENTRO del span**, como está hoy: no lo muevas. Es
el quinto campo transformado, y va anotado en el reporte.

Las tres listas de columnas, con índice:

```astro
            {marca.nav.items.map((item, i) => (
              <li><a href={item.ancla} data-campo={`sitio:nav.items.${i}.texto`}>{item.texto}</a></li>
```

```astro
            {marca.footer.productos.map((p, i) => (
              ... data-campo={`sitio:footer.productos.${i}.texto`}
```

```astro
            {marca.footer.legales.map((l, i) => (
              <li><span class="pie-suelto"><span data-campo={`sitio:footer.legales.${i}`}>{l}</span> <em data-campo="sitio:footer.legalesNota">({marca.footer.legalesNota.toLowerCase()})</em></span></li>
```

**`footer.legalesNota` es transformado dos veces:** la plantilla lo pasa a
minúsculas y lo mete entre paréntesis. El nodo lleva su `data-campo` igual
(D5) y el `<em>` ya existe, así que no se inventa nada.

El correo partido por `<wbr>`:

```astro
              <a href={`mailto:${marca.contacto.correo}`} data-campo="sitio:contacto.correo">{correoUsuario}@<wbr />{correoDominio}</a>
```

**El `data-campo` va en el `<a>`, no en las mitades.** El spec (§1.8) ya lo
anota: el parche en vivo de la fase 6 tiene que reconstruir las dos mitades,
y el campo lleva `falla: ['ninguno']` para que el medidor no intente medirlo.
Anotalo en el reporte: es el caso especial del correo.

- [ ] **Paso 5: El verificador y el conteo del lema**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
grep -o 'data-campo="sitio:footer.lema"' dist/index.html | wc -l
```

Expected: verificador **PASS sin recapturar**, y el lema en **6 nodos** (dos
en la marquesina, que `Marquesina.astro` duplica para el bucle, más el
`aria-label`). Si te da 2, el componente no está duplicando el slot y hay algo
que cambió.

- [ ] **Paso 6: Achicar la lista de pendientes y correr los tests**

Borrá las rutas `sitio:footer.*` y agregá la nueva `sitio:footer.mapaAria` a
las marcadas (no a `PENDIENTES`: se marca en esta misma tarea).

```bash
pnpm exec vitest run test/panel.test.ts test/contenido-fachada.test.ts
```

Expected: **PASS todo.**

- [ ] **Paso 7: Probar que el campo nuevo manda de verdad**

Cambiá `"mapaAria"` en `src/contenido/datos/sitio.json` a `"Mapa"`,
reconstruí, y verificá que el HTML lo trae:

```bash
pnpm build:sitio && grep -c 'aria-label="Mapa"' dist/index.html
```

Expected: **1**. Restaurá con `git checkout src/contenido/datos/sitio.json`
—ojo: solo si ya commiteaste el paso 2; si no, editá el valor de vuelta a
mano— reconstruí y verificá que volvió a «Mapa del sitio». Pegá las dos
salidas.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/pages/index.astro src/contenido/esquema/sitio/paginas.ts src/contenido/datos/sitio.json test/fixtures/contenido-2026-09-10.json test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: el pie dice de qué campo sale cada texto, y el mapa del sitio es un campo

«Mapa del sitio» estaba escrito a mano en la plantilla: lo leen las
personas ciegas y nadie podía cambiarlo sin tocar el código. Es la misma
clase que el alt del visor 3D, y lo encontró la revisión final de la
Parte A. El fixture del certificado se actualiza en este mismo commit.

El correo del pie se renderiza partido por un <wbr>: el data-campo va en
el <a>, y el parche en vivo de la fase 6 reconstruye las dos mitades.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 11: Las otras dos páginas — 404 y fichas técnicas

**Files:**
- Modify: `src/pages/404.astro`
- Modify: `src/pages/fichas-tecnicas.astro`
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea:** de `sitio` — `noEncontrada.encabezado`,
`noEncontrada.sub`, `noEncontrada.cta`, `fichasTecnicas.kicker`,
`fichasTecnicas.encabezado`, `fichasTecnicas.sub`, `fichasTecnicas.descargar`,
`fichasTecnicas.descargarNota`, `fichasTecnicas.volver`,
`fichasTecnicas.contactoNota`, `fichasTecnicas.indiceAria`. Del documento
`fichas` — `fichas[].producto`, `fichas[].denominacion`, `fichas[].meta[].0`,
`fichas[].meta[].1`, `fichas[].secciones[].titulo`, y los tres tipos de bloque
(`parrafo.texto`, `lista.items[]`, `tabla.encabezados[]`, `tabla.filas[][]`).

- [ ] **Paso 1: La página 404**

```astro
    <p class="perdida-wordmark" data-campo="sitio:marca.wordmark">{marca.marca.wordmark}</p>
    <h1 class="perdida-titulo" data-campo="sitio:noEncontrada.encabezado">{marca.noEncontrada.encabezado}</h1>
    <p class="perdida-sub" data-campo="sitio:noEncontrada.sub">{marca.noEncontrada.sub}</p>
      <BotonMarca href={marca.noEncontrada.rutaInicio}><span data-campo="sitio:noEncontrada.cta">{marca.noEncontrada.cta}</span></BotonMarca>
```

`noEncontrada.titulo` va al `<title>` por la prop de `Base.astro`: se marca en
la Tarea 12, no acá.

- [ ] **Paso 2: La página de fichas técnicas, lo del documento `sitio`**

```astro
  <a href="#contenido" class="salto" data-campo="sitio:skipLink">{marca.skipLink}</a>
          <span class="lockup-nombre" data-campo="sitio:marca.wordmark">{marca.marca.wordmark}</span>
          <span class="lockup-descriptor mono" data-campo="sitio:marca.descriptor">{marca.marca.descriptor}</span>
      <nav class="indice" aria-label={copy.indiceAria} data-campo-attr="aria-label:sitio:fichasTecnicas.indiceAria">
```

y los textos de `copy` (`copy` es `marca.fichasTecnicas`, así que la ruta
completa lleva el prefijo del grupo): `kicker`, `encabezado`, `sub`,
`descargar`, `descargarNota`, `volver` y `contactoNota` se marcan con
`data-campo="sitio:fichasTecnicas.<clave>"` en el elemento que ya los muestra.
Leé la página entera antes: varios están adentro de `<BotonMarca>` y necesitan
el span del slot.

- [ ] **Paso 3: Los cuatro documentos de ficha**

Los `map` pasan a llevar índice en los cuatro niveles:

```astro
        {fichasBase.map((f, i) => <a href={`#${ancla(f.archivo)}`} data-campo={`fichas:fichas.${i}.producto`}>{f.producto}</a>)}
```

```astro
        {fichasBase.map((f, i) => (
            ... data-campo={`fichas:fichas.${i}.denominacion`}
            {f.meta.map(([clave, valor], j) => (
              ... data-campo={`fichas:fichas.${i}.meta.${j}.0`} ... data-campo={`fichas:fichas.${i}.meta.${j}.1`}
            {f.secciones.map((seccion, k) => (
                ... data-campo={`fichas:fichas.${i}.secciones.${k}.titulo`}
                {seccion.bloques.map((b, m) =>
                    ... data-campo={`fichas:fichas.${i}.secciones.${k}.bloques.${m}.texto`}
                    <ul>{b.items.map((item, n) => <li data-campo={`fichas:fichas.${i}.secciones.${k}.bloques.${m}.items.${n}`}>{item}</li>)}</ul>
                          <tr>{b.encabezados.map((e, n) => <th scope="col" data-campo={`fichas:fichas.${i}.secciones.${k}.bloques.${m}.encabezados.${n}`}>{e}</th>)}</tr>
                          {b.filas.map((fila, n) => (
                              {fila.map((celda, o) => ... data-campo={`fichas:fichas.${i}.secciones.${k}.bloques.${m}.filas.${n}.${o}`}
```

**Cuatro niveles de índice es mucho anidamiento y es fácil equivocarse.** El
test (b) lo ataja: si una ruta no resuelve a un valor, se pone rojo con la
ruta exacta. Corré `pnpm exec vitest run test/panel.test.ts` cada vez que
termines un nivel, no al final.

- [ ] **Paso 4: El verificador tiene que quedar VERDE**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **PASS sin recapturar** — y ahora la fixture de `404.html` y la de
`fichas-tecnicas` también entran en juego, que hasta esta tarea no habían
cambiado nunca.

- [ ] **Paso 5: Achicar la lista y correr el test**

Borrá las rutas `sitio:noEncontrada.*` (menos `titulo`, que es de la Tarea
12), `sitio:fichasTecnicas.*` (menos `titulo`) y **todas** las de `fichas:`.

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 6: Probar que el test detecta un índice de más**

Cambiá `${m}` por `${m + 1}` en el `data-campo` de los párrafos de ficha,
`pnpm build:sitio`, corré el test → **rojo** en (b) con «no resuelve».
Restaurá, reconstruí, verde. Pegá las dos salidas.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/pages/404.astro src/pages/fichas-tecnicas.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: la 404 y las fichas técnicas dicen de qué campo sale cada texto

Las fichas son cuatro niveles de lista anidada —documento, sección,
bloque, ítem o celda— y cada nodo lleva su ruta completa con índices. El
test de biyección exige que cada una resuelva a un valor de verdad, que es
lo único que ataja un índice corrido.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 12: El `<head>` — el título, la descripción y el último literal del sitio

**Files:**
- Modify: `src/layouts/Base.astro`
- Modify: `src/pages/index.astro`, `src/pages/404.astro`, `src/pages/fichas-tecnicas.astro` — la prop nueva
- Test: `test/panel.test.ts` (la lista `PENDIENTES`)

**Los campos de esta tarea (6):** `titulo`, `descripcion`,
`fichasTecnicas.titulo`, `noEncontrada.titulo`, `marca.nombre`, y los tres de
`contacto.direccionPostal.*` que viven en el JSON-LD.

**El último literal:** `src/layouts/Base.astro:96` tiene
`<meta property="og:site_name" content="Maracacao" />` escrito a mano, y
`marca.marca.nombre` es un campo que la clienta edita. Si ella renombra la
marca, publica y comparte el enlace, el nombre viejo sigue apareciendo en la
tarjeta de WhatsApp y de Facebook. La revisión final de la Parte A barrió
todas las hojas del esquema contra todos los accesos de `src/`: **este es el
último huérfano de su clase en todo el sitio.**

- [ ] **Paso 1: `og:site_name` sale del contenido**

En `src/layouts/Base.astro`, importá la fachada como ya lo hacen las páginas
(`import { marca } from '@/copy/sitio-marca'`) y cambiá la línea:

```astro
    <meta property="og:site_name" content={marca.marca.nombre} data-campo-attr="content:sitio:marca.nombre" />
```

**El HTML cambia**: aparece un atributo nuevo. El verificador lo perdona
(`data-campo-attr` es de los dos que borra), así que tiene que seguir verde
sin recapturar. Si `marca.marca.nombre` no fuera exactamente `"Maracacao"`, el
`content` cambiaría de valor y ahí sí el verificador se pondría rojo con
razón: verificá el valor antes.

- [ ] **Paso 2: El título y la descripción, que llegan por prop**

`Base.astro` recibe `titulo` y `descripcion` como strings: desde adentro no
sabe de qué campo salen. Agregá dos props opcionales:

```astro
interface Props {
  titulo: string
  descripcion?: string
  /** Ruta del campo del que sale `titulo`, «documento:ruta». */
  campoTitulo?: string
  /** Ruta del campo del que sale `descripcion`. */
  campoDescripcion?: string
  // …el resto igual
}
```

y en el `<head>`:

```astro
    <title data-campo={campoTitulo}>{titulo}</title>
    {descripcion && <meta name="description" content={descripcion} data-campo-attr={campoDescripcion && `content:${campoDescripcion}`} />}
```

**Solo el `<title>` y la `<meta name="description">`**: las etiquetas
`og:title`, `og:description`, `twitter:title` y `twitter:description` repiten
los mismos dos valores, y marcar las seis no le da nada al panel (ya tiene un
nodo por campo) y ensucia el `<head>`. Anotalo en el reporte.

Las tres páginas pasan la prop:

```astro
<Base titulo={marca.titulo} campoTitulo="sitio:titulo" descripcion={marca.descripcion} campoDescripcion="sitio:descripcion" …>
<Base titulo={marca.noEncontrada.titulo} campoTitulo="sitio:noEncontrada.titulo" …>
<Base titulo={copy.titulo} campoTitulo="sitio:fichasTecnicas.titulo" …>
```

- [ ] **Paso 3: Los tres campos de la dirección de Google**

Viven solo adentro del JSON-LD (`<script type="application/ld+json">`), que es
un bloque de JSON, no nodos marcables. El `<script>` lleva un
`data-campo-attr` por campo y no se puede: un elemento, un atributo.

**Solución:** marcá los tres en el elemento que YA los muestra en la página
—ninguno— así que no hay nodo posible, y quedan como el caso del
`asuntoNegocio`: en `PENDIENTES` con su porqué.

```ts
  // Los tres viven solo adentro del JSON-LD del <head>, que es un bloque
  // de JSON y no un nodo de texto. El panel los edita desde la ficha de
  // «Dirección para Google», con vista previa textual y sin resaltado en
  // la página — spec §1.7, los campos que son atributo no se miden.
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
```

- [ ] **Paso 4: El verificador y el conteo**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
grep -c 'og:site_name" content="Maracacao"' dist/index.html
```

Expected: verificador **PASS sin recapturar**, y el `grep` en **1** (el valor
no cambió, solo de dónde sale).

- [ ] **Paso 5: Probar que ahora sigue al contenido**

Cambiá `marca.nombre` en `src/contenido/datos/sitio.json` a `"Maracacao MX"`,
reconstruí, y verificá:

```bash
pnpm build:sitio && grep -c 'og:site_name" content="Maracacao MX"' dist/index.html
```

Expected: **1**. Antes de esta tarea daba **0** con cualquier valor: ese es el
bug. Restaurá con `git checkout src/contenido/datos/sitio.json`, reconstruí.
Pegá las dos salidas.

- [ ] **Paso 6: Achicar la lista y correr el test**

Borrá `sitio:titulo`, `sitio:descripcion`, `sitio:noEncontrada.titulo`,
`sitio:fichasTecnicas.titulo` y `sitio:marca.nombre`. Dejá las tres de
`direccionPostal` con su comentario.

Run: `pnpm exec vitest run test/panel.test.ts` → **PASS las cuatro.**

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add src/layouts/Base.astro src/pages/index.astro src/pages/404.astro src/pages/fichas-tecnicas.astro test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: el <head> dice de qué campo sale cada texto, y og:site_name deja de ser literal

«Maracacao» estaba escrito a mano en el layout mientras marca.marca.nombre
es un campo que la clienta edita: si ella renombraba la marca, la tarjeta
de WhatsApp seguía diciendo el nombre viejo. Era el último literal de su
clase en todo el sitio.

og:title, og:description y las dos de twitter repiten los mismos valores y
no se marcan: el panel ya tiene un nodo por campo y marcarlas solo ensucia
el <head>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 13: Los textos que el script pinta, y el alt del visor 3D

**Files:**
- Modify: `src/contenido/esquema/sitio/producto.ts` — el campo nuevo del visor
- Modify: `src/contenido/datos/sitio.json` y `test/fixtures/contenido-2026-09-10.json`
- Modify: `src/contenido/textos-ui.ts` — dos claves nuevas
- Modify: `src/scripts/marca.ts` — el alt del visor y el `data-campo` en vivo
- Test: `test/contenido.test.ts` (los tests de `textosUi` que ya existen), `test/panel.test.ts`

**Los campos de esta tarea (4):** `nav.cerrar`, `contacto.copiado`,
`contacto.formulario.enviando` (los tres que el script pinta y que por eso no
tienen nodo en el HTML construido) y `anaquel.visorAlt` (el campo nuevo).

**El alt del visor 3D es el Ruling D de la Parte A:**
`src/scripts/marca.ts` monta el visor con
`'La barra en tres dimensiones; arrastra para girarla'` escrito a mano. No se
conectó en la Parte A porque **no existe como campo del esquema** y inventarlo
—decidir su sección, su etiqueta y su ayuda— es trabajo de esquema hecho con
la clienta en mente, no un apuro dentro de una tarea de script. Acá se hace.

- [ ] **Paso 1: El campo nuevo**

En el grupo `anaquel` de `src/contenido/esquema/sitio/producto.ts`, después de
`ilustracionCaption`:

```ts
      // Lo que escucha quien navega con lector de pantalla cuando llega al
      // visor de la barra en 3D. Estaba escrito a mano adentro de
      // `marca.ts` hasta la fase 2 Parte B: la clienta no podía cambiarlo
      // y nadie se enteraba de que existía.
      visorAlt: texto({
        ...enSabores,
        etiqueta: 'Descripción de la barra que gira',
        ayuda: 'No se ve en la página: es lo que escuchan las personas que navegan con lector de pantalla cuando llegan a la barra que se puede girar.',
        maxCaracteres: 80,
        falla: ['ninguno'],
      }),
```

- [ ] **Paso 2: El dato y el certificado**

Agregá a mano `"visorAlt": "La barra en tres dimensiones; arrastra para girarla"`
en el bloque `anaquel` de `src/contenido/datos/sitio.json` —**el mismo texto
que hoy tiene el literal, carácter por carácter**— corré `pnpm migra sitio`,
y actualizá `test/fixtures/contenido-2026-09-10.json` a mano en este mismo
commit. `pnpm exec vitest run test/contenido-fachada.test.ts` tiene que quedar
verde después de tocar el fixture.

- [ ] **Paso 3: Las tres claves nuevas de `TEXTOS_UI`**

En `src/contenido/textos-ui.ts`:

```ts
export const TEXTOS_UI = {
  navAbrir: 'nav.abrir',
  navCerrar: 'nav.cerrar',
  copiado: 'contacto.copiado',
  enviando: 'contacto.formulario.enviando',
  envolturaAltPrefijo: 'anaquel.envolturaAltPrefijo',
  ilustracionAltPrefijo: 'anaquel.ilustracionAltPrefijo',
  visorAlt: 'anaquel.visorAlt',
} as const
```

`navCerrar`, `copiado` y `enviando` **ya estaban** (la Parte A los conectó):
lo único que se agrega es `visorAlt`. Actualizá el test de `textosUi` en
`test/contenido.test.ts` que lista las claves ordenadas: pasa de seis a siete.

En `src/scripts/marca.ts`, el respaldo suma su clave (el tipo
`Record<ClaveTextoUi, string>` lo exige, así que `pnpm typecheck` te avisa si
te olvidás) y el montaje del visor pasa a:

```ts
          const aplica = await montarBarra3D(visor, textos.visorAlt)
```

- [ ] **Paso 4: Los tres textos que el script pinta, marcados en vivo**

Los tres tienen nodo en el HTML, pero con OTRO valor: el nodo del menú dice
«Abrir menú» (`nav.abrir`) y el script lo cambia a «Cerrar menú»
(`nav.cerrar`) al abrir. El nodo del botón de copiar dice `contacto.copiar` y
el script lo cambia a `contacto.copiado`. El del formulario dice
`contacto.formulario.enviar` y pasa a `enviando`.

**No se resuelven con un `data-campo` más en el mismo nodo** —un elemento, un
`data-campo`— sino con un atributo que diga cuál es el texto alterno:

```astro
                <span class="sr-only" data-menu-texto data-campo="sitio:nav.abrir" data-campo-alterno="sitio:nav.cerrar">{marca.nav.abrir}</span>
```

Agregá el mismo `data-campo-alterno` al botón de copiar
(`sitio:contacto.copiado`) y al del formulario
(`sitio:contacto.formulario.enviando`).

Y en `test/lib/campos-en-html.ts`, sumá la lectura de ese tercer atributo al
final de `referenciasDe()`, con la misma forma que `data-campo`:

```ts
  for (const el of document.querySelectorAll('[data-campo-alterno]')) {
    const crudo = el.getAttribute('data-campo-alterno') ?? ''
    const partes = partiendoEnDosPuntos(crudo)
    salida.push({
      pagina,
      documento: partes?.[0] ?? '',
      ruta: partes?.[1] ?? '',
      // Es el texto que el script pinta DESPUÉS, sobre el mismo nodo:
      // cuenta para la biyección igual que un data-campo, pero el panel
      // tiene que saber que la vista previa no lo va a mostrar sin
      // simular la interacción.
      atributo: null,
      crudo,
    })
  }
```

- [ ] **Paso 5: El verificador va a dar ROJO y está bien**

```bash
pnpm build:sitio && pnpm exec vitest run test/html-normalizado.test.ts
```

Expected: **rojo**, por dos cambios declarados: los tres
`data-campo-alterno` (el normalizador no los borra, porque son nuevos) y el
`#textos-ui` con la clave `visorAlt`.

**Dos caminos, y el correcto es el primero:** agregá `data-campo-alterno` a la
lista de atributos que `test/lib/html-normalizado.ts` borra —es un atributo de
la fase 2, de la misma familia que los otros dos— y volvé a correr. El
`#textos-ui` con la clave nueva SÍ es un cambio de contenido real: recapturá
con `pnpm captura:html` y explicalo en el commit, después de pegar el diff en
el reporte.

- [ ] **Paso 6: Probar que el alt del visor llega de verdad**

```bash
grep -c 'visorAlt' dist/index.html
```

Expected: **1 o más** (viaja en `#textos-ui`). Y cambiá el valor en
`sitio.json` a `"La barra que gira"`, reconstruí, y verificá que el HTML lo
trae. Restaurá con `git checkout`, reconstruí. Pegá las dos salidas.

- [ ] **Paso 7: Achicar la lista y correr todo**

Borrá `sitio:nav.cerrar`, `sitio:contacto.copiado`,
`sitio:contacto.formulario.enviando`, y agregá el campo nuevo
`sitio:anaquel.visorAlt` a los marcados (viaja en `#textos-ui`; si el test (a)
no lo ve —porque el JSON del script no es un nodo con `data-campo`— dejalo en
`PENDIENTES` con el comentario de que vive en `#textos-ui`, y decilo en el
reporte).

```bash
pnpm exec vitest run test/panel.test.ts test/contenido.test.ts test/contenido-fachada.test.ts
```

Expected: **PASS todo.**

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/producto.ts src/contenido/datos/sitio.json src/contenido/textos-ui.ts src/scripts/marca.ts src/pages/index.astro test/fixtures/contenido-2026-09-10.json test/fixtures/html-antes-fase-2 test/lib/campos-en-html.ts test/lib/html-normalizado.ts test/contenido.test.ts test/panel.test.ts
git commit -m "$(cat <<'EOF'
feat: el alt del visor 3D es un campo, y los textos alternos se marcan

El visor montaba con «La barra en tres dimensiones; arrastra para girarla»
escrito adentro del script: lo escuchan las personas que navegan con
lector de pantalla y la clienta no podía cambiarlo. Ahora es un campo del
anaquel y viaja por textos-ui, como los otros seis.

Los tres textos que el script pinta sobre un nodo que ya existe —«Cerrar
menú», «¡Copiado!», «Enviando»— se marcan con data-campo-alterno en ese
mismo nodo: el panel necesita saber que ese texto existe aunque la vista
previa no lo muestre sin simular la interacción.

El HTML cambia a propósito: el JSON de textos-ui trae una clave más.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

### Tarea 14: El cierre — las excepciones quedan por escrito y el verificador se retira

**Files:**
- Modify: `test/panel.test.ts` — `PENDIENTES` muere y nace `SIN_NODO`
- Delete: `test/html-normalizado.test.ts`, `test/lib/html-normalizado.ts`, `scripts/captura-html.ts`, `test/fixtures/html-antes-fase-2/`
- Modify: `package.json` — se va el script `captura:html`
- Modify: `src/styles/global.css` — se va la línea `@source not`
- Modify: `docs/tests-que-congelan-contenido.md` — la fila del verificador pasa a EJECUTADA

**Interfaces:**
- Produce: `test/panel.test.ts` en su forma final, que es lo que la fase 4
  (el medidor) y la fase 6 (el panel) van a asumir: todo campo editable tiene
  nodo, salvo la lista corta de excepciones declaradas.

- [ ] **Paso 1: Las excepciones, con nombre y apellido**

`PENDIENTES` era un andamio: lo que quede adentro al final NO es «lo que falta
hacer», es «lo que no puede tener nodo, y por qué». Renombralo y dejá el
comentario de cada una:

```ts
/**
 * Los campos editables que NO tienen ningún nodo en el HTML, con su razón.
 * No es una lista de pendientes: es la lista de excepciones, y cada línea
 * tiene que poder defenderse sola. Agregar una es una decisión, no un
 * atajo — el panel de la fase 6 tiene que tratar a estos campos distinto
 * (vista previa textual, sin resaltado), y esta lista es de dónde lo saca.
 */
const SIN_NODO = new Set<string>([
  // El polvo todavía no tiene precio (`null`), así que la plantilla no
  // renderiza ningún nodo. El día que la clienta le ponga uno, el nodo
  // aparece con su data-campo y esta línea se borra.
  'sitio:negocios.tabs.0.precio',

  // El <form> lleva los dos asuntos en data-asunto-*, y `data-campo-attr`
  // es un solo atributo por elemento. El panel los edita juntos desde la
  // ficha del formulario.
  'sitio:contacto.formulario.asuntoNegocio',

  // Los tres viven solo adentro del JSON-LD del <head>, que es un bloque
  // de JSON y no un nodo de texto. Vista previa textual, sin resaltado
  // (spec §1.7).
  'sitio:contacto.direccionPostal.localidad',
  'sitio:contacto.direccionPostal.estado',
  'sitio:contacto.direccionPostal.codigoPostal',
])
```

Cambiá los tres usos de `PENDIENTES` por `SIN_NODO` y actualizá el nombre del
cuarto test: «la lista de excepciones no está podrida: todo lo que dice existe
y de verdad no tiene nodo».

- [ ] **Paso 2: El test que impide que la lista crezca sola**

Agregá al final de `test/panel.test.ts`:

```ts
  it('las excepciones son exactamente estas cinco y ninguna más', () => {
    // Si alguien agrega un campo editable y no lo marca, la salida más
    // barata es meterlo acá. Este test hace que esa salida cueste: hay
    // que editar la lista Y editar este número, y el diff lo muestra.
    expect([...SIN_NODO].sort()).toEqual([
      'sitio:contacto.direccionPostal.codigoPostal',
      'sitio:contacto.direccionPostal.estado',
      'sitio:contacto.direccionPostal.localidad',
      'sitio:contacto.formulario.asuntoNegocio',
      'sitio:negocios.tabs.0.precio',
    ])
  })
```

Si tu lista final tiene otras entradas —porque alguna tarea encontró un caso
que este plan no previó— ponelas acá con su comentario y decilo en el reporte:
la lista de arriba es la esperada, no la obligatoria.

- [ ] **Paso 3: Correr todo y ver la biyección completa**

```bash
pnpm build:sitio && pnpm exec vitest run test/panel.test.ts
```

Expected: **PASS los cinco.** Y contá cuánto quedó marcado:

```bash
grep -o 'data-campo="' dist/index.html | wc -l
grep -o 'data-campo-attr="' dist/index.html | wc -l
```

Expected: **más de 200** el primero (las quince fichas del anaquel pesan) y
**alrededor de 15** el segundo. Pegá los dos números en el reporte: es la
medida de la fase.

- [ ] **Paso 4: Retirar el verificador**

Ya hizo su trabajo: catorce tareas de cambios de markup pasaron por él. A
partir de acá **estorba**, y no es una opinión: `vercel.json` corre
`pnpm build`, que corre la suite, así que mientras exista, cualquier edición
de contenido de la clienta deja el deploy en rojo hasta que alguien recapture
la línea base. El día que el panel esté en sus manos eso es un sitio que no se
puede publicar.

```bash
git rm test/html-normalizado.test.ts test/lib/html-normalizado.ts scripts/captura-html.ts
git rm -r test/fixtures/html-antes-fase-2
```

Sacá de `package.json` la línea `"captura:html": "tsx scripts/captura-html.ts"`
y de `src/styles/global.css` la línea
`@source not "../../test/fixtures/html-antes-fase-2";` (con su comentario, que
explica un problema que ya no existe).

**Lo que lo reemplaza, y conviene decirlo en el commit:** la fase 4 trae el
medidor, que es un guard diferencial de geometría —mide HEAD contra HEAD~1— y
no congela contenido. Hasta que exista, lo que protege la visual son los topes
de caracteres del esquema, que ya están puestos desde la fase 1.

- [ ] **Paso 5: La auditoría, al día**

En `docs/tests-que-congelan-contenido.md`, la sección «Actualización
2026-09-14» dice que la última tarea de la Parte B tiene que borrar el
verificador. Agregá abajo una línea que diga que se ejecutó, con la fecha y el
commit, para que el documento no quede prometiendo algo ya hecho.

- [ ] **Paso 6: Compuerta y commit**

```bash
pnpm build
git add -A
git commit -m "$(cat <<'EOF'
feat: la biyección campo ↔ HTML está completa, y el verificador se retira

Las excepciones quedan por escrito con su razón —el precio que todavía es
null, el segundo asunto del formulario y los tres campos que viven solo en
el JSON-LD— y un test exige que sean exactamente esas: meter un campo sin
marcar en la lista cuesta editar dos lugares y se ve en el diff.

El verificador de HTML se va. Hizo su trabajo: catorce tareas de cambios
de markup pasaron por él sin mover un byte de la visual. Quedarse sería
peor que inútil: corre en el build de Vercel, así que congelaría las once
páginas justo cuando la clienta empieza a editarlas. El guard que lo
reemplaza es el medidor de la fase 4, que es diferencial y no congela
contenido; hasta entonces protegen los topes de caracteres del esquema.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QptFNg7qoAdSA5b5XeFBbu
EOF
)"
```

---

## Cobertura del spec

| Lo que pide el spec | Dónde |
|---|---|
| Los ~200 `data-campo` (§3.2, orden de trabajo FASE 2) | Tareas 3 a 12 |
| Los `data-campo-attr` de alt y aria (§1.7) | Tareas 3, 5, 6, 8, 9, 10, 12 |
| Los spans inventados en los nodos de texto mezclados (§3.2) | Tareas 3 (h1, menú), 4 (listas), 5 (ingredientes), 6 (títulos con precio), 7 (pasos y tip), 8 (datos, precios), 9 (tuplas de contacto) |
| El test de biyección en los dos sentidos, por página, cardinalidad ≥1 (§3.1) | Tarea 1, cerrado en la Tarea 14 |
| `Insignia.astro` y `EtiquetaSabor.astro` con prop `campo` (§3.2) | Tarea 2 |
| El correo del pie partido por `<wbr>` (§1.8) | Tarea 10 |
| El `alt` del visor 3D (Ruling D de la Parte A) | Tarea 13 |
| `og:site_name` (revisión final de la Parte A) | Tarea 12 |
| El `aria-label` del mapa del sitio (revisión final de la Parte A) | Tarea 10 |
| Retiro del verificador (revisión final de la Parte A, `docs/tests-que-congelan-contenido.md`) | Tarea 14 |

**Lo que este plan NO hace, a propósito:**

- **La línea base geométrica del CI** (§3.2: «se toma DESPUÉS de la fase 2»).
  Es de la fase 4, con el medidor. Ninguna tarea de acá la toma.
- **El mecanismo de transformación declarativa** para los cinco campos que la
  plantilla modifica (`hero.titular.1`, `footer.legalesNota`, los precios
  formateados, el punto de `catar.pasos[].nombre`, el ` ·` de `footer.lema`).
  El panel de la fase 6 aplica la misma transformación en la vista previa; hoy
  no hace falta declararla y el spec no la pide.
- **El `data-campo` en las páginas privadas** (`/presentacion`, `/manual`):
  su copy vive en módulos que el panel nunca va a exponer.

**Lo que la Parte B hereda para más adelante** (de la revisión final de la
Parte A, y no se resuelve acá):

- El candado cruzado de la dirección es sensible a acentos y mayúsculas:
  «Coyoacan» sin tilde le rompe el build a la clienta. Normalizar los dos
  lados antes de comparar. **Fase 5 o 6.**
- `contacto.direccionPostal.estado` como selector de los 32 estados en vez de
  texto libre. **Fase 7.**
- `datos.get('tipo') === 'negocio'` en `marca.ts` duplica
  `contacto.formulario.tipoOpciones.1.valor`. **Fase 6.**
- `d.ilustracion ?? true` es rama muerta con comentario equivocado. **Fase 6.**
- `test/anaquel-ilustracion.test.ts` congela el slug `'canela'`. **Fase 7.**
- `src/lib/ilustraciones.ts` falla en silencio si algún día se agrega un
  adapter de servidor. **Fase 5**, cuando se toque el deploy.

---

## Cierre de la Parte B (2026-09-15)

Las catorce tareas se ejecutaron con subagent-driven-development sobre la rama
`panel-fase-2-parte-b` (23 commits). Cada una pasó su revisión; la revisión
final de toda la rama (opus) dio «ready to merge with fixes», con cuatro
Important que se arreglaron acá. Estado al cerrar: **908 tests verdes en 37
archivos, `astro check` 0 errores / 0 warnings / 3 hints**, y en el HTML
construido **784 `data-campo`, 45 `data-campo-attr` y 4 `data-campo-alterno`**
repartidos en las tres páginas públicas.

**Lo que corrigió la revisión final:**

- **Doce nodos marcados muestran algo distinto del valor del campo**, no tres
  como decía la D5 de este plan —y tres de esos doce no los había visto nadie:
  el nombre del polvo en minúsculas, el punto de `catar.aporteTitulo` y los dos
  puntos de `recetas.etiquetaTip`. Ahora están declarados uno por uno en
  `TRANSFORMADOS` (`test/panel.test.ts`) con lo que la plantilla les hace, y un
  test exige que cada nodo marcado muestre el valor crudo salvo que su ruta
  esté declarada. **Ese test es además el reemplazo del verificador retirado**
  para esta clase de regresión: compara el HTML contra el CONTENIDO, no contra
  una foto, así que no se pone rojo cuando la clienta edita.
- El comentario de la excepción `negocios.tabs.0.precio` prometía algo falso
  (que el nodo aparecería solo el día que hubiera precio); ahora la plantilla
  lo marca condicionalmente y el comentario dice la verdad.
- `data-campo-attr` acepta varias referencias separadas por espacio, así que
  `contacto.formulario.asuntoNegocio` dejó de ser excepción: quedan **cinco**.
- El `data-campo-alterno` del visor 3D nombra su atributo
  (`alt:sitio:anaquel.visorAlt`), para que la fase 6 pueda distinguir por
  máquina —y no por comentario— los alternos de texto de los de atributo. Sin
  eso, la implementación obvia le borraba la imagen de respaldo a la ficha.

**Las cinco excepciones que quedan**, cada una con su razón en
`test/panel.test.ts`: el precio del polvo (hoy `null`, no hay nodo), el precio
suelto de cada bolsa de gotas (ninguna plantilla lo muestra), y los tres campos
de la dirección de Google (viven solo adentro del JSON-LD).

**Lo que hereda la fase 6 (el panel):**

- **`TRANSFORMADOS` es su lista de trabajo.** Para esos doce campos, `inyecta.ts`
  tiene que aplicar la misma transformación en la vista previa, o va a publicar
  el valor crudo encima de un nodo transformado.
- **La D5 de este plan quedó mal medida** (decía tres, son doce). Si en la fase 6
  la lista sigue creciendo, conviene declarar la transformación en el esquema en
  vez de mantenerla a mano.
- **Hay nodos marcados invisibles en reposo:** las catorce fichas de sabor que el
  script esconde, los bloques `hidden` del formulario, los `sr-only` y los
  `aria-hidden`. El panel tiene que mostrarlos o desplazarse hasta ellos antes de
  resaltarlos, y los cuatro alternos necesitan simular la interacción.
- `valorAtributo` no distingue «atributo ausente» de «atributo vacío», y el
  parser nuevo (lista separada por espacios) no tiene test unitario propio: la
  fase 6 va a escribir los suyos sobre ese mismo código.
- El test (c) detecta «muestra algo distinto y no está declarado», pero no lo
  inverso (un nodo que debería transformar y no transforma). Eso lo cubre el
  medidor de la fase 4, que mide el texto renderizado.
