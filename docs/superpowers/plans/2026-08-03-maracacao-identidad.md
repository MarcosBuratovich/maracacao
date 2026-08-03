# Identidad Maracacao — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la identidad de Maracacao como código: mascota vectorial riggeada, lettering custom, siete variantes de logo, design tokens verificados y una styleguide viva en Astro.

**Architecture:** Los tokens en TypeScript son la fuente de verdad y de ahí se derivan las variables CSS. Los SVG maestros usan hex literales (para que Rive los importe sin sorpresas) y un transform de build los convierte a `var(--mrc-*)` al inyectarlos inline en el sitio. Cada invariante que se puede romper en silencio —contraste, jerarquía de grupos, colores fuera de paleta, pivotes huérfanos— tiene un test que lo detecta.

**Tech Stack:** Astro 5 · Tailwind v4 (plugin de Vite) · React (solo islas) · TypeScript strict · Vitest · linkedom (parseo de SVG en tests) · @resvg/resvg-js (rasterizado para verificación visual) · @rive-app/react-canvas

## Global Constraints

Aplican a **todas** las tareas. Copiadas del spec, verbatim donde hay valores.

- **Idioma:** `es-MX`. `<html lang="es-MX">`, `Intl` con locale `es-MX`.
- **Ningún string visible se escribe dentro de un componente.** El texto de cara al usuario vive en `src/content/` o en `src/copy/`. Un componente recibe texto, no lo contiene.
- **Los enlaces internos pasan por un helper**, nunca son strings crudos. Agregar `[lang]/` después debe ser mover archivos.
- **Registro léxico mexicano.** El packaging dice **"pistaches"**, no "pistachos". Manda sobre cualquier corrección genérica.
- **Cero `<text>` en los SVG de marca.** Todo lettering va como paths.
- **Cero `<use>`, `<defs>` compartidos, gradientes o filtros** en `mascota.svg`. Rive los aplana de forma impredecible.
- **En la ilustración, los trazos van como `stroke`**, nunca como contorno relleno. `stroke-linecap="round"`, `stroke-linejoin="round"`. Aplica a `mascota.svg` y `mascota-reducida.svg`. **No aplica al lettering** (Task 13): las letras son formas rellenas, no trazos animables — ahí un `stroke` sería el error.
- **`prefers-reduced-motion` apaga, no atenúa.**
- **Paleta cerrada.** Ningún color fuera de `src/tokens/color.ts` puede aparecer en un SVG de marca. Hay un test que lo verifica.
- **Contrastes mínimos:** texto normal 4.5:1. Prohibidos: `crema` sobre `verde-500` (4.25) y `tan-500` sobre `verde-500` (2.89).
- **viewBox de la mascota:** `0 0 1024 1024`.
- **Sin librería de animación.** Solo CSS y Rive.
- **Node ≥ 22.6.** Los scripts `emit-tokens.ts` y `emit-rig-spec.ts` importan TypeScript directo con `--experimental-strip-types`. En Node ≥ 23.6 el flag sobra. Si el entorno tiene menos, compilarlos con `tsx` en vez de cambiar el enfoque.

**Referencias de dibujo** (ver §3 del spec — regla vinculante). **Ya están en el repo**, commiteadas antes de la Task 1:
- `docs/referencias/packaging-foto.jpg` — **autoridad** en proporciones, tipografía, composición.
- `docs/referencias/render-limpio.png` — **solo legibilidad**. Su textura de pincel, grosores variables y detalles agregados **no se copian**.
- `docs/referencias/mascota-recorte-transparente.png` — el render con el fondo quitado, útil para comparar la silueta contra fondo claro. Mismas restricciones que el anterior.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/tokens/contrast.ts` | Cálculo WCAG puro. Sin dependencias. |
| `src/tokens/color.ts` | Rampas, colores fijos, roles semánticos, pares aprobados. |
| `src/tokens/type.ts` | Familias, escala, ejes variables de Fraunces. |
| `src/tokens/motion.ts` | Duraciones, easings, amplitudes. |
| `src/tokens/css.ts` | Serializa los tokens a custom properties. |
| `src/lib/tokenize-svg.ts` | Reemplaza hex conocidos por `var(--mrc-*)` con fallback. |
| `src/lib/rutas.ts` | Helper de enlaces internos. Único lugar que arma URLs. |
| `src/assets/brand/mascota.svg` | Escena completa riggeada. Hex literales. |
| `src/assets/brand/mascota-reducida.svg` | Cabeza simplificada para ≤48 px. |
| `src/assets/brand/logotipo.svg` | `MARACACAO` recto, paths. |
| `src/assets/brand/logotipo-arco.svg` | `MARACACAO` en arco, paths. |
| `src/assets/brand/descriptor.svg` | `CHOCOLATE MEXICANO`, paths. |
| `src/components/brand/*.astro` | Una variante de logo por componente. |
| `src/components/brand/MascotaRive.tsx` | Isla de React. Único archivo que conoce Rive. |
| `test/svg-utils.ts` | Helpers de parseo y aserción sobre SVG. |
| `scripts/render-svg.mjs` | Rasteriza un SVG a PNG para verificación visual. |
| `docs/rig-spec.md` | Contrato para el rigger de Rive. |

---

## Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/pages/index.astro`, `src/styles/global.css`
- Test: `test/scaffold.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: proyecto Astro que buildea; `pnpm test` corre Vitest; alias `@/*` → `src/*`.

- [ ] **Step 1: Inicializar el proyecto**

```bash
pnpm create astro@latest . --template minimal --no-install --no-git --typescript strict --skip-houston
pnpm add astro @astrojs/mdx @astrojs/react react react-dom
pnpm add -D vitest linkedom @resvg/resvg-js tailwindcss @tailwindcss/vite @types/react @types/react-dom
```

- [ ] **Step 2: Escribir `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'

export default defineConfig({
  // Un solo locale hoy. La config existe para que sumar idiomas sea
  // agregar entradas, no reescribir el routing.
  i18n: {
    defaultLocale: 'es-MX',
    locales: ['es-MX'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [mdx(), react()],
  vite: { plugins: [tailwindcss()] },
})
```

- [ ] **Step 3: Escribir `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})
```

- [ ] **Step 4: Escribir el test de scaffold (falla)**

```ts
// test/scaffold.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('el sitio declara es-MX como locale por defecto', () => {
    const cfg = readFileSync('astro.config.mjs', 'utf8')
    expect(cfg).toContain("defaultLocale: 'es-MX'")
  })

  it('el layout raíz marca lang="es-MX"', () => {
    const layout = readFileSync('src/layouts/Base.astro', 'utf8')
    expect(layout).toContain('lang="es-MX"')
  })
})
```

- [ ] **Step 5: Correr el test y verificar que falla**

Run: `pnpm vitest run test/scaffold.test.ts`
Expected: FAIL — `ENOENT: src/layouts/Base.astro`

- [ ] **Step 6: Crear `src/layouts/Base.astro`**

```astro
---
interface Props { titulo: string }
const { titulo } = Astro.props
---
<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{titulo}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 7: Crear `src/styles/global.css` y `src/pages/index.astro`**

```css
/* src/styles/global.css */
@import "tailwindcss";
```

```astro
---
// src/pages/index.astro
import Base from '@/layouts/Base.astro'
import '@/styles/global.css'
---
<Base titulo="Maracacao — Manual de marca">
  <h1>Maracacao</h1>
</Base>
```

- [ ] **Step 8: Correr el test y el build**

Run: `pnpm vitest run test/scaffold.test.ts && pnpm astro build`
Expected: tests PASS, build sin errores.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro + Tailwind + Vitest con locale es-MX"
```

---

## Task 2: Cálculo de contraste WCAG

**Files:**
- Create: `src/tokens/contrast.ts`
- Test: `test/contrast.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `relativeLuminance(hex: string): number`
  - `contrastRatio(a: string, b: string): number`
  - `type NivelWcag = 'AAA' | 'AA' | 'AA-grande' | 'falla'`
  - `nivelWcag(ratio: number): NivelWcag`

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/contrast.test.ts
import { describe, it, expect } from 'vitest'
import { contrastRatio, nivelWcag, relativeLuminance } from '@/tokens/contrast'

describe('relativeLuminance', () => {
  it('el negro es 0', () => expect(relativeLuminance('#000000')).toBe(0))
  it('el blanco es 1', () => expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5))
})

describe('contrastRatio', () => {
  it('negro contra blanco es 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })
  it('es simétrico', () => {
    expect(contrastRatio('#372915', '#FAF3E0'))
      .toBeCloseTo(contrastRatio('#FAF3E0', '#372915'), 10)
  })
  it('acepta hex con y sin almohadilla', () => {
    expect(contrastRatio('372915', 'FAF3E0')).toBeCloseTo(12.72, 1)
  })
})

describe('nivelWcag', () => {
  it.each([
    [21, 'AAA'], [7, 'AAA'], [6.31, 'AA'], [4.5, 'AA'],
    [4.25, 'AA-grande'], [3, 'AA-grande'], [2.89, 'falla'], [1, 'falla'],
  ] as const)('%s → %s', (ratio, esperado) => {
    expect(nivelWcag(ratio)).toBe(esperado)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/contrast.test.ts`
Expected: FAIL — no se puede resolver `@/tokens/contrast`

- [ ] **Step 3: Implementar `src/tokens/contrast.ts`**

```ts
export type NivelWcag = 'AAA' | 'AA' | 'AA-grande' | 'falla'

function canal(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Hex inválido: ${hex}. Se esperan 6 dígitos.`)
  }
  const r = canal(parseInt(h.slice(0, 2), 16))
  const g = canal(parseInt(h.slice(2, 4), 16))
  const b = canal(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function nivelWcag(ratio: number): NivelWcag {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-grande'
  return 'falla'
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/contrast.test.ts`
Expected: PASS, 13 tests (2 + 3 + las 8 filas del `it.each`).

- [ ] **Step 5: Commit**

```bash
git add src/tokens/contrast.ts test/contrast.test.ts
git commit -m "feat: cálculo de contraste WCAG"
```

---

## Task 3: Tokens de color

**Files:**
- Create: `src/tokens/color.ts`
- Test: `test/color.test.ts`

**Interfaces:**
- Consumes: `contrastRatio`, `nivelWcag` de Task 2.
- Produces:
  - `verde: Record<50|100|...|900, string>`, `tan: Record<...>`
  - `fijos: { papel, crema, tinta, bordo, amarillo, suelo }`
  - `roles: Record<string, string>`
  - `paresAprobados: ReadonlyArray<{ frente: string; fondo: string; uso: string; minimo: NivelWcag }>`
  - `paresProhibidos: ReadonlyArray<{ frente: string; fondo: string; razon: string }>`
  - `todosLosColores(): string[]` — todos los hex del sistema, en mayúsculas

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/color.test.ts
import { describe, it, expect } from 'vitest'
import { contrastRatio, nivelWcag } from '@/tokens/contrast'
import {
  verde, tan, paresAprobados, paresProhibidos, todosLosColores,
} from '@/tokens/color'

describe('rampas', () => {
  it('verde y tan tienen los diez pasos', () => {
    const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
    expect(Object.keys(verde).map(Number).sort((a, b) => a - b)).toEqual(pasos)
    expect(Object.keys(tan).map(Number).sort((a, b) => a - b)).toEqual(pasos)
  })

  it('el verde oscurece monótonamente de 50 a 900', () => {
    const pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
    const lum = pasos.map((p) => contrastRatio(verde[p], '#000000'))
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeLessThan(lum[i - 1])
  })

  it('todos los hex están normalizados a mayúsculas con almohadilla', () => {
    for (const c of todosLosColores()) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('el 500 del verde es el color medido del render', () => {
    expect(verde[500]).toBe('#5B744B')
  })
})

describe('pares aprobados', () => {
  it('no está vacío', () => expect(paresAprobados.length).toBeGreaterThan(0))

  it.each(paresAprobados)(
    '$uso — $frente sobre $fondo alcanza al menos $minimo',
    ({ frente, fondo, minimo }) => {
      const ratio = contrastRatio(frente, fondo)
      const orden = { falla: 0, 'AA-grande': 1, AA: 2, AAA: 3 } as const
      expect(orden[nivelWcag(ratio)]).toBeGreaterThanOrEqual(orden[minimo])
    },
  )

  it('ningún par aprobado para texto queda por debajo de 4.5', () => {
    for (const p of paresAprobados) {
      if (p.minimo === 'AA' || p.minimo === 'AAA') {
        expect(contrastRatio(p.frente, p.fondo)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('pares prohibidos', () => {
  it.each(paresProhibidos)(
    '$frente sobre $fondo efectivamente no llega a 4.5 ($razon)',
    ({ frente, fondo }) => {
      expect(contrastRatio(frente, fondo)).toBeLessThan(4.5)
    },
  )

  it('ningún par prohibido aparece en la lista de aprobados', () => {
    // Se comparan por clave, no campo a campo. Como los dos arrays son
    // `as const`, TypeScript estrecha los hex a tipos literales y declara
    // que la comparación nunca puede ser verdadera (ts2367) — o sea, prueba
    // estáticamente lo mismo que este test verifica en runtime, y de paso
    // rompe el build. Concatenar a string ensancha el tipo y deja el test
    // vivo como red contra futuras ediciones de las listas.
    const clave = (p: { frente: string; fondo: string }) => `${p.frente}|${p.fondo}`
    const aprobadas = paresAprobados.map(clave)
    for (const p of paresProhibidos) {
      expect(aprobadas).not.toContain(clave(p))
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/color.test.ts`
Expected: FAIL — no se puede resolver `@/tokens/color`

- [ ] **Step 3: Implementar `src/tokens/color.ts`**

```ts
import type { NivelWcag } from './contrast'

/** Base 500 = color medido del render limpio. Ver §6.2 del spec. */
export const verde = {
  50: '#F2F4F1', 100: '#E1E6DF', 200: '#C4CDBE', 300: '#A3B19A', 400: '#7F9373',
  500: '#5B744B', 600: '#4B5F3E', 700: '#3A4A30', 800: '#2A3522', 900: '#1B2316',
} as const

/** Solo ilustración y superficies decorativas. Nunca texto sobre verde. */
export const tan = {
  50: '#FEF9F3', 100: '#FEF2E3', 200: '#FCE4C8', 300: '#FBD5A9', 400: '#FAC487',
  500: '#F8B465', 600: '#CB9453', 700: '#9F7341', 800: '#72532E', 900: '#4A361E',
} as const

export const fijos = {
  papel: '#FAF3E0',
  crema: '#F4E8C6',
  tinta: '#372915',
  bordo: '#8B4D3F',
  amarillo: '#ECC677',
  suelo: '#E3BC87',
} as const

export const roles = {
  'fondo-claro': fijos.papel,
  'fondo-oscuro': verde[700],
  'fondo-profundo': verde[800],
  'texto-cuerpo': fijos.tinta,
  'texto-titulo': verde[700],
  'texto-secundario': verde[600],
  'texto-sobre-oscuro': fijos.papel,
  'acento': fijos.bordo,
  'destacado': fijos.amarillo,
  'contorno-ilustracion': fijos.tinta,
} as const

export const paresAprobados = [
  { frente: fijos.tinta, fondo: fijos.papel, uso: 'texto cuerpo sobre banda clara', minimo: 'AAA' },
  { frente: verde[700], fondo: fijos.papel, uso: 'títulos sobre banda clara', minimo: 'AAA' },
  { frente: verde[600], fondo: fijos.papel, uso: 'texto secundario sobre banda clara', minimo: 'AA' },
  { frente: fijos.papel, fondo: verde[700], uso: 'texto sobre banda verde', minimo: 'AAA' },
  { frente: fijos.crema, fondo: verde[700], uso: 'texto crema sobre banda verde', minimo: 'AAA' },
  { frente: fijos.papel, fondo: verde[800], uso: 'texto sobre banda verde profunda', minimo: 'AAA' },
  { frente: fijos.tinta, fondo: fijos.amarillo, uso: 'texto en botón amarillo', minimo: 'AAA' },
  { frente: fijos.papel, fondo: fijos.bordo, uso: 'texto en botón bordó', minimo: 'AA' },
  { frente: fijos.bordo, fondo: fijos.papel, uso: 'acento sobre banda clara', minimo: 'AA' },
] as const satisfies ReadonlyArray<{
  frente: string; fondo: string; uso: string; minimo: NivelWcag
}>

export const paresProhibidos = [
  { frente: fijos.crema, fondo: verde[500], razon: 'da 4.25, no llega a 4.5' },
  { frente: tan[500], fondo: verde[500], razon: 'da 2.89, falla fuerte' },
] as const

export function todosLosColores(): string[] {
  return [...Object.values(verde), ...Object.values(tan), ...Object.values(fijos)]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/color.test.ts`
Expected: PASS. Los 9 casos de `paresAprobados` y los 2 de `paresProhibidos` corren parametrizados.

- [ ] **Step 5: Commit**

```bash
git add src/tokens/color.ts test/color.test.ts
git commit -m "feat: tokens de color con pares de contraste verificados"
```

---

## Task 4: Helpers de test para SVG

**Files:**
- Create: `test/svg-utils.ts`
- Create: `test/fixtures/ejemplo.svg`
- Test: `test/svg-utils.test.ts`

**Interfaces:**
- Consumes: `linkedom`.
- Produces:
  - `cargarSvg(ruta: string): Document`
  - `idsDeGrupos(doc: Document): string[]`
  - `padreDe(doc: Document, id: string): string | null`
  - `hexUsados(doc: Document): string[]` — todos los hex del documento, en mayúsculas
  - `atributosDeTrazo(doc: Document): Array<{ id: string | null; width: string; cap: string }>` — resuelve `stroke-width` y `stroke-linecap` tanto del atributo del elemento como de la clase CSS declarada en el `<style>` del documento; si están los dos, gana el atributo. `id` es el `g[id]` contenedor más cercano, o `null` si el trazo no cuelga de ninguno.

- [ ] **Step 1: Crear la fixture**

```svg
<!-- test/fixtures/ejemplo.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="raiz">
    <g id="hijo-a"><path d="M0 0 L10 10" stroke="#5B744B" stroke-width="4" stroke-linecap="round"/></g>
    <g id="hijo-b"><circle cx="5" cy="5" r="2" fill="#F8B465"/></g>
  </g>
</svg>
```

- [ ] **Step 2: Escribir el test (falla)**

```ts
// test/svg-utils.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, idsDeGrupos, padreDe, hexUsados, atributosDeTrazo } from './svg-utils'

const doc = cargarSvg('test/fixtures/ejemplo.svg')

describe('svg-utils', () => {
  it('lista todos los ids de grupo', () => {
    expect(idsDeGrupos(doc).sort()).toEqual(['hijo-a', 'hijo-b', 'raiz'])
  })

  it('resuelve el grupo padre de un id', () => {
    expect(padreDe(doc, 'hijo-a')).toBe('raiz')
    expect(padreDe(doc, 'raiz')).toBeNull()
  })

  it('junta los hex de fill y stroke, normalizados', () => {
    expect(hexUsados(doc).sort()).toEqual(['#5B744B', '#F8B465'])
  })

  it('lee los atributos de trazo', () => {
    expect(atributosDeTrazo(doc)).toEqual([
      { id: 'hijo-a', width: '4', cap: 'round' },
    ])
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm vitest run test/svg-utils.test.ts`
Expected: FAIL — `./svg-utils` no existe

- [ ] **Step 4: Implementar `test/svg-utils.ts`**

```ts
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

export function cargarSvg(ruta: string): Document {
  const { document } = parseHTML(`<html><body>${readFileSync(ruta, 'utf8')}</body></html>`)
  return document as unknown as Document
}

export function idsDeGrupos(doc: Document): string[] {
  return [...doc.querySelectorAll('g[id]')].map((g) => g.getAttribute('id')!)
}

export function padreDe(doc: Document, id: string): string | null {
  // Selector por atributo: `CSS.escape` no existe en Node sin DOM global.
  const el = doc.querySelector(`[id="${id}"]`)
  if (!el) throw new Error(`No existe el elemento con id "${id}"`)
  const padre = el.parentElement
  if (!padre || padre.tagName.toLowerCase() !== 'g') return null
  return padre.getAttribute('id')
}

export function hexUsados(doc: Document): string[] {
  const encontrados = new Set<string>()
  const fuente = doc.body.innerHTML
  for (const m of fuente.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    encontrados.add(`#${m[1].toUpperCase()}`)
  }
  return [...encontrados]
}

export function atributosDeTrazo(doc: Document) {
  return [...doc.querySelectorAll('[stroke]')].map((el) => {
    const contenedor = el.closest('g[id]')
    return {
      id: contenedor?.getAttribute('id') ?? '',
      width: el.getAttribute('stroke-width') ?? '',
      cap: el.getAttribute('stroke-linecap') ?? '',
    }
  })
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/svg-utils.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add test/svg-utils.ts test/svg-utils.test.ts test/fixtures/ejemplo.svg
git commit -m "test: helpers de parseo y aserción sobre SVG"
```

---

## Task 5: Esqueleto de grupos de la mascota

Este archivo se crea **vacío de dibujo pero completo de estructura**. Las tareas 6-9 lo van llenando. La estructura es un contrato que el rigger de Rive va a leer, así que se fija antes de dibujar una sola curva.

**Files:**
- Create: `src/assets/brand/mascota.svg`
- Create: `src/assets/brand/jerarquia.ts`
- Test: `test/mascota-estructura.test.ts`

**Interfaces:**
- Consumes: `test/svg-utils.ts` de Task 4.
- Produces: `JERARQUIA: ReadonlyArray<{ id: string; padre: string | null }>` en `jerarquia.ts` — la fuente de verdad de la estructura, importable desde los tests y desde el generador del rig spec (Task 14).

- [ ] **Step 1: Escribir `src/assets/brand/jerarquia.ts`**

```ts
/**
 * Contrato de estructura de mascota.svg. Ver §9.2 del spec.
 * El orden del array ES el orden de pintado (primero = más atrás).
 */
export const JERARQUIA = [
  { id: 'escena', padre: null },
  { id: 'suelo', padre: 'escena' },
  { id: 'granos-orbita', padre: 'escena' },
  { id: 'mono', padre: 'escena' },
  { id: 'cola', padre: 'mono' },
  { id: 'pierna-post', padre: 'mono' },
  { id: 'pie-post', padre: 'pierna-post' },
  { id: 'brazo-post', padre: 'mono' },
  { id: 'cuerpo', padre: 'mono' },
  { id: 'pierna-apoyo', padre: 'mono' },
  { id: 'pie-apoyo', padre: 'pierna-apoyo' },
  { id: 'brazo-l', padre: 'mono' },
  { id: 'mano-l', padre: 'brazo-l' },
  { id: 'bowl', padre: 'mono' },
  { id: 'bowl-cuenco', padre: 'bowl' },
  { id: 'bowl-contenido', padre: 'bowl' },
  { id: 'bowl-borde', padre: 'bowl' },
  { id: 'brazo-r', padre: 'mono' },
  { id: 'mano-r', padre: 'brazo-r' },
  { id: 'cabeza', padre: 'mono' },
  { id: 'oreja-l', padre: 'cabeza' },
  { id: 'oreja-r', padre: 'cabeza' },
  { id: 'craneo', padre: 'cabeza' },
  { id: 'rostro', padre: 'cabeza' },
  { id: 'ojo-l', padre: 'cabeza' },
  { id: 'ojo-r', padre: 'cabeza' },
  { id: 'cachete-l', padre: 'cabeza' },
  { id: 'cachete-r', padre: 'cabeza' },
  { id: 'nariz', padre: 'cabeza' },
  { id: 'boca', padre: 'cabeza' },
  { id: 'chispas', padre: 'mono' },
  { id: 'pivotes', padre: null },
] as const

/** Grupos con pivote anatómico. La clave es el id del grupo. */
export const PIVOTES = {
  'cola': 'cadera',
  'pierna-post': 'cadera',
  'pie-post': 'tobillo',
  'brazo-post': 'hombro',
  'pierna-apoyo': 'cadera',
  'pie-apoyo': 'tobillo',
  'brazo-l': 'hombro',
  'mano-l': 'muñeca',
  'brazo-r': 'hombro',
  'mano-r': 'muñeca',
  'cabeza': 'base del cuello',
  'oreja-l': 'unión al cráneo',
  'oreja-r': 'unión al cráneo',
  'ojo-l': 'centro del ojo',
  'ojo-r': 'centro del ojo',
} as const
```

- [ ] **Step 2: Escribir el test (falla)**

```ts
// test/mascota-estructura.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, idsDeGrupos, padreDe, hexUsados } from './svg-utils'
import { JERARQUIA, PIVOTES } from '@/assets/brand/jerarquia'
import { todosLosColores } from '@/tokens/color'
import { readFileSync } from 'node:fs'

const RUTA = 'src/assets/brand/mascota.svg'
const doc = cargarSvg(RUTA)
const fuente = readFileSync(RUTA, 'utf8')

describe('mascota.svg — estructura', () => {
  it('declara el viewBox del spec', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 1024 1024')
  })

  it.each(JERARQUIA)('existe el grupo #$id', ({ id }) => {
    expect(idsDeGrupos(doc)).toContain(id)
  })

  it.each(JERARQUIA)('#$id cuelga de $padre', ({ id, padre }) => {
    expect(padreDe(doc, id)).toBe(padre)
  })

  it('no hay grupos de más', () => {
    // `JERARQUIA` es `as const`, así que `.map` devuelve una unión de tipos
    // literales y `.includes(string)` no compila. Ensanchar una sola vez con
    // la anotación es la salida honesta. Castear el argumento a `never`
    // también compila, pero desactiva el chequeo para siempre: `includes`
    // pasaría a aceptar cualquier cosa, incluso si el tipo se estrecha de
    // nuevo más adelante.
    const declarados: readonly string[] = JERARQUIA.map((g) => g.id)
    const sobrantes = idsDeGrupos(doc).filter(
      (id) => !declarados.includes(id) && !id.startsWith('piv-') && !id.startsWith('grano-'),
    )
    expect(sobrantes).toEqual([])
  })
})

describe('mascota.svg — restricciones duras', () => {
  it('no usa <text>', () => expect(doc.querySelector('text')).toBeNull())
  it('no usa <use>', () => expect(doc.querySelector('use')).toBeNull())
  it('no usa <defs>', () => expect(doc.querySelector('defs')).toBeNull())
  it('no usa gradientes', () => {
    expect(fuente).not.toMatch(/<(linear|radial)Gradient/i)
  })
  it('no usa filtros', () => expect(fuente).not.toMatch(/<filter\b/i))
  it('no usa <image>', () => expect(doc.querySelector('image')).toBeNull())
})

describe('mascota.svg — paleta cerrada', () => {
  it('todo hex del archivo pertenece a los tokens', () => {
    const permitidos = todosLosColores()
    const rogue = hexUsados(doc).filter((c) => !permitidos.includes(c))
    expect(rogue).toEqual([])
  })
})

describe('mascota.svg — pivotes', () => {
  it.each(Object.keys(PIVOTES))('existe el marcador piv-%s', (id) => {
    expect(doc.querySelector(`[id="piv-${id}"]`)).not.toBeNull()
  })

  it('no hay marcadores huérfanos', () => {
    const marcadores = [...doc.querySelectorAll('[id^="piv-"]')]
      .map((el) => el.getAttribute('id')!.replace('piv-', ''))
    for (const m of marcadores) expect(Object.keys(PIVOTES)).toContain(m)
  })

  it('todos los marcadores viven dentro de #pivotes', () => {
    for (const el of doc.querySelectorAll('[id^="piv-"]')) {
      expect(el.closest('g[id="pivotes"]')).not.toBeNull()
    }
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm vitest run test/mascota-estructura.test.ts`
Expected: FAIL — `ENOENT: src/assets/brand/mascota.svg`

- [ ] **Step 4: Crear `src/assets/brand/mascota.svg` con la estructura vacía**

Grupos vacíos en el orden de `JERARQUIA`, más la capa de pivotes con un marcador por cada entrada de `PIVOTES`. Las constantes de trazo van en un `<style>` para que se ajusten en un solo lugar.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Mono de Maracacao">
  <style>
    /* Trazo de marcador: parejo, terminales redondeados. Ver §9.1 del spec. */
    .t-principal { fill: none; stroke: #372915; stroke-width: 11;
                   stroke-linecap: round; stroke-linejoin: round; }
    .t-interior  { fill: none; stroke: #372915; stroke-width: 8;
                   stroke-linecap: round; stroke-linejoin: round; }
    .t-fino      { fill: none; stroke: #372915; stroke-width: 5;
                   stroke-linecap: round; stroke-linejoin: round; }
    /* La capa de pivotes se borra después de riggear. */
    #pivotes { display: none; }
  </style>

  <g id="escena">
    <g id="suelo"></g>
    <g id="granos-orbita"></g>
    <g id="mono">
      <g id="cola"></g>
      <g id="pierna-post"><g id="pie-post"></g></g>
      <g id="brazo-post"></g>
      <g id="cuerpo"></g>
      <g id="pierna-apoyo"><g id="pie-apoyo"></g></g>
      <g id="brazo-l"><g id="mano-l"></g></g>
      <g id="bowl">
        <g id="bowl-cuenco"></g>
        <g id="bowl-contenido"></g>
        <g id="bowl-borde"></g>
      </g>
      <g id="brazo-r"><g id="mano-r"></g></g>
      <g id="cabeza">
        <g id="oreja-l"></g>
        <g id="oreja-r"></g>
        <g id="craneo"></g>
        <g id="rostro"></g>
        <g id="ojo-l"></g>
        <g id="ojo-r"></g>
        <g id="cachete-l"></g>
        <g id="cachete-r"></g>
        <g id="nariz"></g>
        <g id="boca"></g>
      </g>
      <g id="chispas"></g>
    </g>
  </g>

  <!-- Marcadores de pivote. Alinear el origen de cada objeto en Rive contra
       su marcador y después borrar esta capa entera. Ver §9.3 del spec.
       Las coordenadas se ajustan al dibujar cada parte (tareas 6-9). -->
  <g id="pivotes">
    <circle id="piv-cola"          cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-pierna-post"   cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-pie-post"      cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-brazo-post"    cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-pierna-apoyo"  cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-pie-apoyo"     cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-brazo-l"       cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-mano-l"        cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-brazo-r"       cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-mano-r"        cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-cabeza"        cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-oreja-l"       cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-oreja-r"       cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-ojo-l"         cx="0" cy="0" r="4" fill="#8B4D3F"/>
    <circle id="piv-ojo-r"         cx="0" cy="0" r="4" fill="#8B4D3F"/>
  </g>
</svg>
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/mascota-estructura.test.ts`
Expected: PASS. Los tests de jerarquía corren 32 veces cada uno, los de pivote 15.

- [ ] **Step 6: Commit**

```bash
git add src/assets/brand/mascota.svg src/assets/brand/jerarquia.ts test/mascota-estructura.test.ts
git commit -m "feat: esqueleto de grupos de la mascota con contrato de jerarquía"
```

---

## Task 6: Script de rasterizado para verificación visual

Las tareas de dibujo necesitan mirarse, no solo testearse. Este script hace el ciclo dibujar → ver corto.

**Files:**
- Create: `scripts/render-svg.mjs`
- Modify: `package.json` (agregar script `render`)
- Test: `test/render.test.ts`

**Interfaces:**
- Consumes: `@resvg/resvg-js`.
- Produces: `pnpm render <entrada.svg> <salida.png> [--ancho N] [--fondo #HEX]`

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/render.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'

const SALIDA = 'test/tmp/ejemplo.png'
afterAll(() => rmSync('test/tmp', { recursive: true, force: true }))

describe('render-svg', () => {
  it('rasteriza un SVG a PNG', () => {
    execFileSync('node', ['scripts/render-svg.mjs', 'test/fixtures/ejemplo.svg', SALIDA, '--ancho', '200'])
    expect(existsSync(SALIDA)).toBe(true)
    // firma PNG
    expect([...readFileSync(SALIDA).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('falla con mensaje claro si falta la entrada', () => {
    expect(() =>
      execFileSync('node', ['scripts/render-svg.mjs'], { stdio: 'pipe' }),
    ).toThrow(/Uso: render-svg/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/render.test.ts`
Expected: FAIL — `Cannot find module scripts/render-svg.mjs`

- [ ] **Step 3: Implementar `scripts/render-svg.mjs`**

```js
#!/usr/bin/env node
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [entrada, salida, ...resto] = process.argv.slice(2)
if (!entrada || !salida) {
  console.error("Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo '#HEX']")
  console.error("Ej:  pnpm render mascota.svg /tmp/m.png --ancho 900 --fondo '#FAF3E0'")
  console.error('Las comillas en el color son obligatorias: sin ellas el shell trata el # como comentario.')
  process.exit(1)
}
const arg = (nombre, def) => {
  const i = resto.indexOf(`--${nombre}`)
  return i === -1 ? def : resto[i + 1]
}

const svg = readFileSync(entrada, 'utf8')
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: Number(arg('ancho', 800)) },
  background: arg('fondo', 'rgba(0,0,0,0)'),
})
mkdirSync(dirname(salida), { recursive: true })
writeFileSync(salida, resvg.render().asPng())
console.log(`${salida} listo`)
```

- [ ] **Step 4: Agregar el script a `package.json`**

```json
{
  "scripts": {
    "render": "node scripts/render-svg.mjs",
    "test": "vitest run",
    "build": "astro build"
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/render.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/render-svg.mjs package.json test/render.test.ts
git commit -m "feat: rasterizado de SVG para verificación visual"
```

---

## Task 7: Dibujo — cabeza

**El deliverable de esta tarea es el dibujo.** Los pasos fijan las restricciones, el ciclo de verificación y los tests; la geometría se produce al implementar.

**Files:**
- Modify: `src/assets/brand/mascota.svg` — grupos `#cabeza` y descendientes; marcadores `piv-cabeza`, `piv-oreja-l`, `piv-oreja-r`, `piv-ojo-l`, `piv-ojo-r`
- Test: `test/mascota-cabeza.test.ts`

**Interfaces:**
- Consumes: estructura de Task 5, `todosLosColores()` de Task 3, `pnpm render` de Task 6.
- Produces: `#cabeza` con contenido. Las tareas 8 y 9 se apoyan en su posición para encajar cuello y hombros.

**Restricciones de dibujo:**

| Qué | Valor |
|---|---|
| Referencia de forma | `docs/referencias/packaging-foto.jpg` (autoridad) |
| Referencia de legibilidad | `docs/referencias/render-limpio.png` |
| Caja de la cabeza dentro del viewBox 1024 | aprox. `x 300–700`, `y 90–420` |
| Clase de trazo del contorno exterior | `.t-principal` (11) |
| Clase de trazo de detalles internos | `.t-interior` (8) |
| Relleno del cráneo y orejas | `#5B744B` |
| Relleno del rostro | `#F8B465` |
| Relleno de cachetes | `#8B4D3F` a `opacity="0.35"` |
| Relleno de boca | `#8B4D3F`; lengua `#F4E8C6` |
| Ojos | arcos cerrados de sonrisa, sin relleno, `.t-interior` |

**No copiar del render:** textura de pincel, moteado tonal, ancho de cabeza aumentado. La foto manda en proporciones.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/mascota-cabeza.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!

const PARTES = ['craneo', 'rostro', 'oreja-l', 'oreja-r', 'ojo-l', 'ojo-r',
                'cachete-l', 'cachete-r', 'nariz', 'boca'] as const

describe('cabeza — contenido', () => {
  it.each(PARTES)('#%s tiene al menos una forma', (id) => {
    expect(grupo(id).querySelectorAll('path, circle, ellipse, rect').length)
      .toBeGreaterThan(0)
  })

  it('la boca tiene forma y lengua', () => {
    expect(doc.querySelector('[id="boca-forma"]')).not.toBeNull()
    expect(doc.querySelector('[id="lengua"]')).not.toBeNull()
  })
})

describe('cabeza — trazo', () => {
  it('ningún trazo del grupo usa contorno relleno', () => {
    for (const el of grupo('cabeza').querySelectorAll('[stroke]')) {
      // stroke real, no una forma rellena que simula contorno
      expect(el.getAttribute('fill')).not.toBe('#372915')
    }
  })

  it('todos los trazos usan una clase del sistema', () => {
    for (const el of grupo('cabeza').querySelectorAll('[stroke], [class]')) {
      const cls = el.getAttribute('class') ?? ''
      if (el.hasAttribute('stroke') || cls.startsWith('t-')) {
        expect(cls).toMatch(/^t-(principal|interior|fino)$/)
      }
    }
  })
})

describe('cabeza — paleta', () => {
  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('cabeza — pivotes ubicados', () => {
  it.each(['piv-cabeza', 'piv-oreja-l', 'piv-oreja-r', 'piv-ojo-l', 'piv-ojo-r'])(
    '%s dejó de estar en el origen',
    (id) => {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    },
  )

  it('los pivotes de los ojos caen dentro de la caja de la cabeza', () => {
    for (const id of ['piv-ojo-l', 'piv-ojo-r']) {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThanOrEqual(300)
      expect(Number(el.getAttribute('cx'))).toBeLessThanOrEqual(700)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThanOrEqual(90)
      expect(Number(el.getAttribute('cy'))).toBeLessThanOrEqual(420)
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/mascota-cabeza.test.ts`
Expected: FAIL — los grupos están vacíos, `#boca-forma` no existe, los pivotes están en `0,0`.

- [ ] **Step 3: Dibujar la cabeza**

Llenar `#craneo`, `#rostro`, `#oreja-l`, `#oreja-r`, `#ojo-l`, `#ojo-r`, `#cachete-l`, `#cachete-r`, `#nariz` y `#boca` (con `path#boca-forma` y `path#lengua`) respetando la tabla de restricciones.

**Geometría oculta obligatoria:** el cráneo se dibuja completo por detrás del rostro, y las orejas completas por detrás del cráneo. Al rotar `#oreja-l` no puede aparecer un hueco. Esto es lo que verifica el Step 6.

- [ ] **Step 4: Mover los marcadores de pivote a su punto anatómico**

`piv-cabeza` en la base del cuello, `piv-oreja-l` y `piv-oreja-r` en la unión de cada oreja al cráneo, `piv-ojo-l` y `piv-ojo-r` en el centro de cada ojo.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/mascota-cabeza.test.ts test/mascota-estructura.test.ts`
Expected: PASS. El test de estructura tiene que seguir pasando.

- [ ] **Step 6: Verificación visual y prueba de rotación**

```bash
pnpm render src/assets/brand/mascota.svg /tmp/cabeza.png --ancho 900 --fondo '#FAF3E0'
```

Abrir el PNG. Comparar contra `docs/referencias/packaging-foto.jpg`: proporciones, ángulo de las orejas, curvatura de la sonrisa.

Después, la prueba de geometría oculta — agregar temporalmente `transform="rotate(20 CX CY)"` a `#oreja-l` usando las coordenadas de `piv-oreja-l`, rasterizar de nuevo y confirmar que **no aparece ningún hueco** en la unión. Quitar el `transform`.

- [ ] **Step 7: Commit**

```bash
git add src/assets/brand/mascota.svg test/mascota-cabeza.test.ts
git commit -m "feat: dibujo de la cabeza de la mascota con pivotes ubicados"
```

---

## Task 8: Dibujo — torso, brazos y manos

**Files:**
- Modify: `src/assets/brand/mascota.svg` — `#cuerpo`, `#brazo-l`, `#mano-l`, `#brazo-r`, `#mano-r`, `#brazo-post`; marcadores `piv-brazo-l`, `piv-mano-l`, `piv-brazo-r`, `piv-mano-r`, `piv-brazo-post`
- Test: `test/mascota-torso.test.ts`

**Interfaces:**
- Consumes: `#cabeza` de Task 7 (el cuello encaja debajo).
- Produces: `#cuerpo` y los brazos con contenido. Task 9 encaja las piernas en la cadera.

**Restricciones de dibujo:**

| Qué | Valor |
|---|---|
| Caja del torso | aprox. `x 340–660`, `y 400–700` |
| Relleno del torso | `#5B744B` |
| Relleno de la panza | `#F8B465` |
| Relleno de las manos | `#F8B465` |
| Franjas del pecho | `#ECC677`, contorno `.t-interior` |
| Brazo izquierdo | gancho: hombro → codo abajo-izquierda → muñeca arriba, la mano llega a la boca |
| Brazo derecho | del hombro baja en arco hasta sostener el bowl |

**Geometría oculta obligatoria:** el torso se dibuja completo por detrás de los brazos. Es la parte donde más se nota si falta: al rotar un brazo 20° tiene que quedar torso debajo, no fondo.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/mascota-torso.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!
const formas = (id: string) =>
  grupo(id).querySelectorAll('path, circle, ellipse, rect').length

describe('torso y brazos — contenido', () => {
  it.each(['cuerpo', 'brazo-l', 'mano-l', 'brazo-r', 'mano-r', 'brazo-post'])(
    '#%s tiene al menos una forma', (id) => expect(formas(id)).toBeGreaterThan(0),
  )

  it('la mano izquierda vive dentro del brazo izquierdo', () => {
    expect(grupo('mano-l').closest('g[id="brazo-l"]')).not.toBeNull()
  })

  it('la mano derecha vive dentro del brazo derecho', () => {
    expect(grupo('mano-r').closest('g[id="brazo-r"]')).not.toBeNull()
  })
})

describe('torso y brazos — paleta', () => {
  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('torso y brazos — pivotes ubicados', () => {
  it.each(['piv-brazo-l', 'piv-mano-l', 'piv-brazo-r', 'piv-mano-r', 'piv-brazo-post'])(
    '%s dejó de estar en el origen', (id) => {
      const el = doc.querySelector(`[id="${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    },
  )

  it('los pivotes de hombro están por encima de los de muñeca', () => {
    const y = (id: string) => Number(doc.querySelector(`[id="${id}"]`)!.getAttribute('cy'))
    expect(y('piv-brazo-l')).toBeLessThan(y('piv-mano-l'))
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/mascota-torso.test.ts`
Expected: FAIL — grupos vacíos, pivotes en el origen.

- [ ] **Step 3: Dibujar torso, panza y franjas del pecho en `#cuerpo`**

- [ ] **Step 4: Dibujar los tres brazos y las dos manos**

`#brazo-post` va detrás del cuerpo; `#brazo-l` y `#brazo-r` delante. Cada brazo dibuja su segmento completo hasta el hombro, incluso la parte que el torso tapa.

- [ ] **Step 5: Mover los marcadores de pivote a hombros y muñecas**

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `pnpm vitest run test/mascota-torso.test.ts test/mascota-cabeza.test.ts test/mascota-estructura.test.ts`
Expected: PASS. Nada anterior se rompe.

- [ ] **Step 7: La prueba del brazo**

Este es el criterio de aceptación 2 del spec.

```bash
pnpm render src/assets/brand/mascota.svg /tmp/brazo-0.png --ancho 900 --fondo '#FAF3E0'
```

Agregar `transform="rotate(20 CX CY)"` a `#brazo-l` con las coordenadas de `piv-brazo-l`, rasterizar a `/tmp/brazo-20.png` y comparar. **Si aparece cualquier hueco en el hombro, falta geometría oculta: volver al Step 3.** Quitar el `transform` antes de commitear.

- [ ] **Step 8: Commit**

```bash
git add src/assets/brand/mascota.svg test/mascota-torso.test.ts
git commit -m "feat: dibujo de torso, brazos y manos con geometría oculta verificada"
```

---

## Task 9: Dibujo — piernas, cola, bowl, suelo y granos

**Files:**
- Modify: `src/assets/brand/mascota.svg` — `#pierna-apoyo`, `#pie-apoyo`, `#pierna-post`, `#pie-post`, `#cola`, `#bowl-*`, `#suelo`, `#granos-orbita`, `#chispas`; marcadores restantes
- Test: `test/mascota-completa.test.ts`

**Interfaces:**
- Consumes: `#cuerpo` de Task 8 (las piernas encajan en la cadera).
- Produces: `mascota.svg` completo. Tasks 10 y 13 lo consumen.

**Restricciones de dibujo:**

| Qué | Valor |
|---|---|
| Pierna de apoyo | de la cadera baja recta al pie sobre el suelo |
| Pierna posterior | doblada, rodilla a la izquierda, pie colgando |
| Cola | sale de la cadera, arco a la derecha, espiral al final |
| Bowl cuenco y borde | `#8B4D3F` |
| Contenido del bowl | pistaches en `#E3BC87` y `#FBD5A9`, contorno `.t-fino` |
| Suelo / isla | `#E3BC87`; ondas en `#7F9373` con `.t-fino` |
| Granos en órbita | exactamente **14**, ids `grano-01` … `grano-14` |
| Chispas | exactamente **3** rayitas, `#ECC677` |

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/mascota-completa.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'
import { JERARQUIA, PIVOTES } from '@/assets/brand/jerarquia'

const doc = cargarSvg('src/assets/brand/mascota.svg')
const grupo = (id: string) => doc.querySelector(`[id="${id}"]`)!
const formas = (id: string) =>
  grupo(id).querySelectorAll('path, circle, ellipse, rect').length

describe('mascota completa', () => {
  it('ningún grupo del contrato quedó vacío', () => {
    const vacios = JERARQUIA
      .filter((g) => !['escena', 'mono', 'bowl', 'pivotes'].includes(g.id))
      .filter((g) => formas(g.id) === 0)
      .map((g) => g.id)
    expect(vacios).toEqual([])
  })

  it('hay exactamente 14 granos en órbita, numerados con padding', () => {
    const granos = [...grupo('granos-orbita').querySelectorAll('[id^="grano-"]')]
      .map((el) => el.getAttribute('id')!)
    expect(granos).toHaveLength(14)
    for (const id of granos) expect(id).toMatch(/^grano-\d{2}$/)
    expect(new Set(granos).size).toBe(14)
  })

  it('hay exactamente 3 chispas', () => {
    expect(formas('chispas')).toBe(3)
  })

  it('cada grano tiene su propio pivote declarado como transform-origin', () => {
    for (const el of grupo('granos-orbita').querySelectorAll('[id^="grano-"]')) {
      expect(el.getAttribute('style') ?? '').toMatch(/transform-origin:/)
    }
  })
})

describe('mascota completa — invariantes globales', () => {
  it('todo hex pertenece a los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })

  it('todos los pivotes están ubicados', () => {
    for (const id of Object.keys(PIVOTES)) {
      const el = doc.querySelector(`[id="piv-${id}"]`)!
      expect(Number(el.getAttribute('cx'))).toBeGreaterThan(0)
      expect(Number(el.getAttribute('cy'))).toBeGreaterThan(0)
    }
  })

  it('sigue sin haber <text>, <use>, gradientes ni filtros', () => {
    expect(doc.querySelector('text')).toBeNull()
    expect(doc.querySelector('use')).toBeNull()
    expect(doc.body.innerHTML).not.toMatch(/<(linear|radial)Gradient|<filter\b/i)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/mascota-completa.test.ts`
Expected: FAIL — grupos vacíos, 0 granos.

- [ ] **Step 3: Dibujar piernas y pies**

- [ ] **Step 4: Dibujar la cola**

- [ ] **Step 5: Dibujar el bowl — cuenco, contenido y borde en sus tres grupos**

El borde va después del contenido para que lo tape por delante.

- [ ] **Step 6: Dibujar el suelo con sus ondas**

- [ ] **Step 7: Dibujar los 14 granos y las 3 chispas**

Cada grano lleva `style="transform-origin: CXpx CYpx"` en su propio centro, para que la animación de órbita lo rote sobre sí mismo.

- [ ] **Step 8: Ubicar los marcadores de pivote restantes**

- [ ] **Step 9: Correr toda la suite**

Run: `pnpm test`
Expected: PASS, todo.

- [ ] **Step 10: Verificación visual sobre las dos bandas**

```bash
pnpm render src/assets/brand/mascota.svg /tmp/mascota-papel.png --ancho 900 --fondo '#FAF3E0'
pnpm render src/assets/brand/mascota.svg /tmp/mascota-verde.png --ancho 900 --fondo '#3A4A30'
```

Tiene que leerse bien sobre las dos. Si el cuerpo verde se pierde sobre la banda verde, es exactamente el problema que motivó elegir la paleta C — se resuelve subiendo el contraste del contorno, no cambiando el verde del cuerpo.

- [ ] **Step 11: Commit**

```bash
git add src/assets/brand/mascota.svg test/mascota-completa.test.ts
git commit -m "feat: mascota vectorial completa, riggeada y verificada"
```

---

## Task 10: Tokenizado de SVG

Convierte los hex literales del SVG maestro en `var(--mrc-*)` con fallback, para que la versión inline del sitio siga los tokens y el archivo suelto siga siendo importable a Rive.

**Files:**
- Create: `src/lib/tokenize-svg.ts`
- Test: `test/tokenize-svg.test.ts`

**Interfaces:**
- Consumes: `verde`, `tan`, `fijos` de Task 3.
- Produces:
  - `nombreDeToken(hex: string): string | null` — `'#5B744B'` → `'verde-500'`
  - `tokenizarSvg(svg: string): string`

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/tokenize-svg.test.ts
import { describe, it, expect } from 'vitest'
import { nombreDeToken, tokenizarSvg } from '@/lib/tokenize-svg'
import { readFileSync } from 'node:fs'

describe('nombreDeToken', () => {
  it('resuelve un paso de rampa', () => expect(nombreDeToken('#5B744B')).toBe('verde-500'))
  it('resuelve un color fijo', () => expect(nombreDeToken('#372915')).toBe('tinta'))
  it('es insensible a mayúsculas', () => expect(nombreDeToken('#5b744b')).toBe('verde-500'))
  it('devuelve null si no es del sistema', () => expect(nombreDeToken('#123456')).toBeNull())
})

describe('tokenizarSvg', () => {
  it('reemplaza hex por var() con fallback', () => {
    expect(tokenizarSvg('<path fill="#5B744B"/>'))
      .toBe('<path fill="var(--mrc-verde-500, #5B744B)"/>')
  })

  it('deja intactos los hex que no son del sistema', () => {
    expect(tokenizarSvg('<path fill="#123456"/>')).toBe('<path fill="#123456"/>')
  })

  it('tokeniza también dentro de un bloque <style>', () => {
    const salida = tokenizarSvg('<style>.t{stroke:#372915}</style>')
    expect(salida).toContain('var(--mrc-tinta, #372915)')
  })

  it('la mascota real queda sin ningún hex crudo fuera de los fallbacks', () => {
    const salida = tokenizarSvg(readFileSync('src/assets/brand/mascota.svg', 'utf8'))
    const crudos = [...salida.matchAll(/#[0-9A-Fa-f]{6}/g)]
      .filter((m) => {
        const antes = salida.slice(Math.max(0, m.index! - 40), m.index!)
        return !antes.includes('var(--mrc-')
      })
    expect(crudos).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/tokenize-svg.test.ts`
Expected: FAIL — no se puede resolver `@/lib/tokenize-svg`

- [ ] **Step 3: Implementar `src/lib/tokenize-svg.ts`**

```ts
import { verde, tan, fijos } from '@/tokens/color'

const MAPA: ReadonlyMap<string, string> = new Map([
  ...Object.entries(verde).map(([p, hex]) => [hex.toUpperCase(), `verde-${p}`] as const),
  ...Object.entries(tan).map(([p, hex]) => [hex.toUpperCase(), `tan-${p}`] as const),
  ...Object.entries(fijos).map(([n, hex]) => [hex.toUpperCase(), n] as const),
])

export function nombreDeToken(hex: string): string | null {
  return MAPA.get(hex.toUpperCase()) ?? null
}

export function tokenizarSvg(svg: string): string {
  return svg.replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => {
    const token = nombreDeToken(hex)
    return token ? `var(--mrc-${token}, ${hex.toUpperCase()})` : hex
  })
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/tokenize-svg.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokenize-svg.ts test/tokenize-svg.test.ts
git commit -m "feat: tokenizado de SVG — hex literales a var() con fallback"
```

---

## Task 11: Tokens de tipografía y movimiento, y puente a CSS

**Files:**
- Create: `src/tokens/type.ts`, `src/tokens/motion.ts`, `src/tokens/css.ts`
- Modify: `src/styles/global.css`
- Test: `test/css-tokens.test.ts`

**Interfaces:**
- Consumes: `verde`, `tan`, `fijos`, `roles` de Task 3.
- Produces:
  - `familias`, `escala`, `ejesFraunces` en `type.ts`
  - `duraciones`, `easings`, `amplitudes` en `motion.ts`
  - `customProperties(): Record<string, string>` y `bloqueTheme(): string` en `css.ts`

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/css-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { customProperties, bloqueTheme } from '@/tokens/css'
import { verde, fijos, todosLosColores } from '@/tokens/color'
import { duraciones } from '@/tokens/motion'
import { ejesFraunces } from '@/tokens/type'

describe('customProperties', () => {
  it('emite una propiedad por cada color del sistema', () => {
    const props = customProperties()
    for (const hex of todosLosColores()) {
      expect(Object.values(props)).toContain(hex)
    }
  })

  it('usa el prefijo --mrc- en todas las claves', () => {
    for (const k of Object.keys(customProperties())) expect(k).toMatch(/^--mrc-/)
  })

  it('los nombres de color coinciden con los que emite tokenizarSvg', () => {
    const props = customProperties()
    expect(props['--mrc-verde-500']).toBe(verde[500])
    expect(props['--mrc-tinta']).toBe(fijos.tinta)
  })

  it('incluye duraciones de movimiento con unidad', () => {
    const props = customProperties()
    expect(props['--mrc-dur-micro']).toMatch(/ms$/)
    expect(props['--mrc-dur-ambiental']).toMatch(/m?s$/)
  })
})

describe('bloqueTheme', () => {
  it('genera un @theme válido de Tailwind', () => {
    const css = bloqueTheme()
    expect(css.startsWith('@theme {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('--mrc-verde-500: #5B744B;')
  })
})

describe('movimiento', () => {
  it('las duraciones respetan los rangos del spec', () => {
    expect(duraciones.micro).toBeGreaterThanOrEqual(120)
    expect(duraciones.micro).toBeLessThanOrEqual(200)
    expect(duraciones.gesto).toBeGreaterThanOrEqual(300)
    expect(duraciones.gesto).toBeLessThanOrEqual(500)
    expect(duraciones.ambiental).toBeGreaterThanOrEqual(3000)
    expect(duraciones.ambiental).toBeLessThanOrEqual(5000)
  })
})

describe('tipografía', () => {
  it('Fraunces arranca en SOFT 60 WONK 1, como fija el spec', () => {
    expect(ejesFraunces.SOFT).toBe(60)
    expect(ejesFraunces.WONK).toBe(1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/css-tokens.test.ts`
Expected: FAIL — no se pueden resolver `@/tokens/css`, `@/tokens/motion`, `@/tokens/type`

- [ ] **Step 3: Implementar `src/tokens/type.ts`**

```ts
export const familias = {
  display: "'Fraunces Variable', Fraunces, Georgia, serif",
  texto: "'Work Sans Variable', 'Work Sans', system-ui, sans-serif",
} as const

/** Valores de partida de los ejes variables. Ver §7 del spec. */
export const ejesFraunces = { SOFT: 60, WONK: 1, opsz: 32 } as const

export const escala = {
  'display-xl': '3.5rem',
  'display-l': '2.5rem',
  'titulo': '1.75rem',
  'subtitulo': '1.25rem',
  'cuerpo': '1rem',
  'menor': '0.875rem',
  'etiqueta': '0.75rem',
} as const
```

- [ ] **Step 4: Implementar `src/tokens/motion.ts`**

```ts
/** Milisegundos. Rangos fijados en §12 del spec. */
export const duraciones = {
  micro: 160,
  gesto: 400,
  ambiental: 3200,
  /** Ciclo completo del parpadeo. El cierre ocupa una fracción mínima. */
  parpadeo: 6000,
} as const

/** Spring suave por defecto: las cosas con masa no arrancan lineales. */
export const easings = {
  spring: 'linear(0, 0.02, 0.4 12%, 0.87 26%, 1.06 38%, 1.01 62%, 1)',
  salida: 'cubic-bezier(0.4, 0, 1, 1)',
  entrada: 'cubic-bezier(0, 0, 0.2, 1)',
} as const

/** Amplitudes de la animación ambiental. */
export const amplitudes = {
  respiracionEscala: 1.02,
  colaGrados: 6,
  parpadeoMinMs: 4000,
  parpadeoMaxMs: 7000,
} as const
```

- [ ] **Step 5: Implementar `src/tokens/css.ts`**

```ts
import { verde, tan, fijos, roles } from './color'
import { familias, escala } from './type'
import { duraciones, easings } from './motion'

export function customProperties(): Record<string, string> {
  const props: Record<string, string> = {}
  for (const [paso, hex] of Object.entries(verde)) props[`--mrc-verde-${paso}`] = hex
  for (const [paso, hex] of Object.entries(tan)) props[`--mrc-tan-${paso}`] = hex
  for (const [nombre, hex] of Object.entries(fijos)) props[`--mrc-${nombre}`] = hex
  for (const [rol, hex] of Object.entries(roles)) props[`--mrc-rol-${rol}`] = hex
  for (const [nombre, valor] of Object.entries(familias)) props[`--mrc-font-${nombre}`] = valor
  for (const [nombre, valor] of Object.entries(escala)) props[`--mrc-text-${nombre}`] = valor
  for (const [nombre, ms] of Object.entries(duraciones)) props[`--mrc-dur-${nombre}`] = `${ms}ms`
  for (const [nombre, valor] of Object.entries(easings)) props[`--mrc-ease-${nombre}`] = valor
  return props
}

export function bloqueTheme(): string {
  const lineas = Object.entries(customProperties())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `@theme {\n${lineas}\n}\n`
}
```

- [ ] **Step 6: Generar el CSS y engancharlo**

Agregar a `package.json`:

```json
{ "scripts": { "tokens": "node --experimental-strip-types scripts/emit-tokens.ts" } }
```

```ts
// scripts/emit-tokens.ts
import { writeFileSync } from 'node:fs'
import { bloqueTheme } from '../src/tokens/css.ts'

const salida = 'src/styles/tokens.generated.css'
writeFileSync(salida, `/* GENERADO por pnpm tokens. No editar a mano. */\n${bloqueTheme()}`)
console.log(`${salida} listo`)
```

```css
/* src/styles/global.css */
@import "tailwindcss";
@import "./tokens.generated.css";

@media (prefers-reduced-motion: reduce) {
  /* El spec dice apagar, no atenuar. */
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

`src/styles/tokens.generated.css` **se commitea** — no va al `.gitignore`. Así el build no depende de que alguien se acuerde de correr el script. Correr `pnpm tokens` antes de commitear.

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `pnpm tokens && pnpm vitest run test/css-tokens.test.ts && pnpm build`
Expected: PASS y build sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/tokens/ src/styles/ scripts/emit-tokens.ts package.json test/css-tokens.test.ts
git commit -m "feat: tokens de tipografía y movimiento con puente a CSS"
```

---

## Task 12: Fuentes self-hosteadas

**Files:**
- Create: `public/fonts/*.woff2`, `src/styles/fuentes.css`
- Modify: `src/styles/global.css`, `src/layouts/Base.astro`
- Test: `test/fuentes.test.ts`

**Interfaces:**
- Consumes: `familias` de Task 11.
- Produces: `Fraunces Variable` y `Work Sans Variable` disponibles sin pedirle nada a un tercero.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/fuentes.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const css = () => readFileSync('src/styles/fuentes.css', 'utf8')

describe('fuentes', () => {
  it('los woff2 existen y no están vacíos', () => {
    const archivos = readdirSync('public/fonts').filter((f) => f.endsWith('.woff2'))
    expect(archivos.length).toBeGreaterThanOrEqual(2)
    for (const f of archivos) {
      expect(statSync(`public/fonts/${f}`).size).toBeGreaterThan(1000)
    }
  })

  it('declara las dos familias', () => {
    expect(css()).toContain("font-family: 'Fraunces Variable'")
    expect(css()).toContain("font-family: 'Work Sans Variable'")
  })

  it('usa font-display: swap', () => {
    const bloques = css().match(/@font-face\s*\{[^}]*\}/g) ?? []
    expect(bloques.length).toBeGreaterThanOrEqual(2)
    for (const b of bloques) expect(b).toContain('font-display: swap')
  })

  it('no queda ninguna referencia a Google Fonts', () => {
    for (const ruta of ['src/styles/fuentes.css', 'src/layouts/Base.astro']) {
      expect(readFileSync(ruta, 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    }
  })

  it('el layout precarga las dos fuentes', () => {
    const layout = readFileSync('src/layouts/Base.astro', 'utf8')
    const preloads = layout.match(/rel="preload"[^>]*as="font"/g) ?? []
    expect(preloads.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/fuentes.test.ts`
Expected: FAIL — `ENOENT: public/fonts`

- [ ] **Step 3: Descargar los woff2 variables**

```bash
mkdir -p public/fonts
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

# Fraunces variable, con los ejes SOFT y WONK
curl -s -A "$UA" \
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&display=swap' \
  | grep -oE 'https://[^)]+\.woff2' | head -1 \
  | xargs curl -s -o public/fonts/fraunces-variable.woff2

# Work Sans variable
curl -s -A "$UA" \
  'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300..700&display=swap' \
  | grep -oE 'https://[^)]+\.woff2' | head -1 \
  | xargs curl -s -o public/fonts/work-sans-variable.woff2

ls -la public/fonts
```

Verificar que los dos pesan más de 1 kB. Si alguno bajó vacío, el `grep` tomó el subset equivocado: inspeccionar el CSS a mano y elegir el bloque cuyo `unicode-range` cubra `U+0000-00FF` (latin).

- [ ] **Step 4: Escribir `src/styles/fuentes.css`**

```css
@font-face {
  font-family: 'Fraunces Variable';
  src: url('/fonts/fraunces-variable.woff2') format('woff2-variations');
  font-weight: 300 900;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074,
                 U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}

@font-face {
  font-family: 'Work Sans Variable';
  src: url('/fonts/work-sans-variable.woff2') format('woff2-variations');
  font-weight: 300 700;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074,
                 U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}

/* Valor de partida de los ejes. Ver §7 del spec. */
.display {
  font-family: var(--mrc-font-display);
  font-variation-settings: 'SOFT' 60, 'WONK' 1;
}
```

- [ ] **Step 5: Importar y precargar**

En `src/styles/global.css`, agregar `@import "./fuentes.css";` después de los tokens.

En `src/layouts/Base.astro`, dentro del `<head>`:

```astro
<link rel="preload" href="/fonts/fraunces-variable.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/work-sans-variable.woff2" as="font" type="font/woff2" crossorigin />
```

- [ ] **Step 6: Correr el test y el build**

Run: `pnpm vitest run test/fuentes.test.ts && pnpm build`
Expected: PASS y build limpio.

- [ ] **Step 7: Commit**

```bash
git add public/fonts src/styles/fuentes.css src/styles/global.css src/layouts/Base.astro test/fuentes.test.ts
git commit -m "feat: Fraunces y Work Sans self-hosteadas, sin dependencia de CDN"
```

---

## Task 13: Lettering — logotipo, arco y descriptor

**Files:**
- Create: `src/assets/brand/logotipo.svg`, `logotipo-arco.svg`, `descriptor.svg`
- Test: `test/lettering.test.ts`

**Interfaces:**
- Consumes: `docs/referencias/packaging-foto.jpg` (autoridad de forma de letra), `pnpm render` de Task 6.
- Produces: los tres SVG de lettering. Task 15 los compone en las variantes de logo.

**Restricciones de dibujo:**

| Qué | Valor |
|---|---|
| Referencia | La foto del packaging. **No** el render de Gemini, que cambió la tipografía a una serif. |
| Estilo | Sans redonda hecha a mano, **monolinear**, terminales redondeados de marcador, con irregularidades de trazo manual |
| Letras de `logotipo.svg` | `MARACACAO` — 9 paths, uno por letra, id `letra-01` … `letra-09` |
| Letras de `descriptor.svg` | `CHOCOLATE MEXICANO` — 17 paths, id `letra-01` … `letra-17` |
| Relleno | `#F4E8C6` — se tokeniza a `var(--mrc-crema)` al inlinearse |
| Contornos | Rellenos, no strokes: son letras, no trazos animables |

Una letra por path **para que después se pueda animar la entrada letra por letra**. Es la razón de la restricción.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/lettering.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const ARCHIVOS = {
  logotipo: { ruta: 'src/assets/brand/logotipo.svg', letras: 9 },
  arco: { ruta: 'src/assets/brand/logotipo-arco.svg', letras: 9 },
  descriptor: { ruta: 'src/assets/brand/descriptor.svg', letras: 17 },
} as const

describe.each(Object.entries(ARCHIVOS))('%s', (_nombre, { ruta, letras }) => {
  const doc = cargarSvg(ruta)

  it('no usa <text> — es lettering, no tipografía', () => {
    expect(doc.querySelector('text')).toBeNull()
    expect(doc.querySelector('textPath')).toBeNull()
  })

  it(`tiene exactamente ${letras} letras, numeradas con padding`, () => {
    const ids = [...doc.querySelectorAll('[id^="letra-"]')].map((e) => e.getAttribute('id')!)
    expect(ids).toHaveLength(letras)
    for (const id of ids) expect(id).toMatch(/^letra-\d{2}$/)
    expect(new Set(ids).size).toBe(letras)
  })

  it('cada letra es un path', () => {
    for (const el of doc.querySelectorAll('[id^="letra-"]')) {
      expect(el.tagName.toLowerCase()).toBe('path')
    }
  })

  it('declara viewBox', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/)
  })

  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})

describe('logotipo recto vs arco', () => {
  it('los dos deletrean las mismas 9 letras en el mismo orden', () => {
    const ids = (ruta: string) =>
      [...cargarSvg(ruta).querySelectorAll('[id^="letra-"]')].map((e) => e.getAttribute('id'))
    expect(ids(ARCHIVOS.logotipo.ruta)).toEqual(ids(ARCHIVOS.arco.ruta))
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/lettering.test.ts`
Expected: FAIL — los tres archivos no existen.

- [ ] **Step 3: Dibujar `logotipo.svg`**

`MARACACAO` en línea recta, calcando las formas de la foto. Nueve paths, uno por letra.

- [ ] **Step 4: Dibujar `logotipo-arco.svg`**

Las mismas nueve letras, cada una rotada y ubicada sobre el arco del packaging. **Cada letra rotada individualmente, no un `textPath`** — el archivo tiene que quedar sin `<text>`.

- [ ] **Step 5: Dibujar `descriptor.svg`**

`CHOCOLATE MEXICANO` en dos líneas, 17 paths.

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/lettering.test.ts`
Expected: PASS.

- [ ] **Step 7: Verificación visual contra la foto**

```bash
pnpm render src/assets/brand/logotipo.svg /tmp/logotipo.png --ancho 900 --fondo '#3A4A30'
pnpm render src/assets/brand/logotipo-arco.svg /tmp/arco.png --ancho 900 --fondo '#3A4A30'
pnpm render src/assets/brand/descriptor.svg /tmp/descriptor.png --ancho 900 --fondo '#3A4A30'
```

Poner los PNG al lado de `docs/referencias/packaging-foto.jpg` y comparar **forma de letra**: ancho de trazo parejo, terminales redondeados, sin serifas. Si aparece cualquier modulación gruesa/fina, se coló la influencia del render de Gemini: corregir.

- [ ] **Step 8: Commit**

```bash
git add src/assets/brand/logotipo.svg src/assets/brand/logotipo-arco.svg src/assets/brand/descriptor.svg test/lettering.test.ts
git commit -m "feat: lettering custom calcado del packaging, una letra por path"
```

---

## Task 14: Mascota reducida

**Files:**
- Create: `src/assets/brand/mascota-reducida.svg`
- Test: `test/mascota-reducida.test.ts`

**Interfaces:**
- Consumes: `mascota.svg` de Task 9 como punto de partida de forma.
- Produces: la pieza que usan el favicon y el sello circular (Task 15).

**Restricciones de dibujo:**

| Qué | Valor |
|---|---|
| viewBox | `0 0 512 512`, cuadrado |
| Contenido | Solo la cabeza. Sin bowl, sin brazos, sin granos, sin suelo |
| Trazo | Más grueso en proporción: `16` sobre 512, contra `11` sobre 1024 |
| Detalle interno | Máximo 12 formas en total. Sin cachetes, sin lengua, sin detalle de orejas |
| Legibilidad objetivo | Reconocible a **32 px** |

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/mascota-reducida.test.ts
import { describe, it, expect } from 'vitest'
import { cargarSvg, hexUsados, atributosDeTrazo } from './svg-utils'
import { todosLosColores } from '@/tokens/color'

const doc = cargarSvg('src/assets/brand/mascota-reducida.svg')

describe('mascota reducida', () => {
  it('es cuadrada, 512', () => {
    expect(doc.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 512 512')
  })

  it('tiene 12 formas o menos — si no, no se lee a 32 px', () => {
    expect(doc.querySelectorAll('path, circle, ellipse, rect').length)
      .toBeLessThanOrEqual(12)
  })

  it('no arrastra partes que no son la cabeza', () => {
    for (const id of ['bowl', 'cola', 'granos-orbita', 'suelo', 'brazo-l', 'chispas']) {
      expect(doc.querySelector(`[id="${id}"]`)).toBeNull()
    }
  })

  it('el trazo es proporcionalmente más grueso que en la mascota completa', () => {
    // Se lee con el helper compartido de la Task 4, que resuelve tanto el
    // atributo del elemento como el valor que llega por clase CSS.
    // Reimplementar la lectura acá dejaría dos definiciones de "grosor de
    // trazo" conviviendo, y en cuanto una cambie la otra miente.
    const anchos = atributosDeTrazo(doc)
      .map((t) => Number(t.width))
      .filter((n) => Number.isFinite(n) && n > 0)
    expect(anchos.length).toBeGreaterThan(0)
    // 11/1024 = 0.0107 ; el objetivo es al menos 14/512 = 0.027
    expect(Math.max(...anchos) / 512).toBeGreaterThan(0.025)
  })

  it('no introduce colores fuera de los tokens', () => {
    const permitidos = todosLosColores()
    expect(hexUsados(doc).filter((c) => !permitidos.includes(c))).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/mascota-reducida.test.ts`
Expected: FAIL — el archivo no existe.

- [ ] **Step 3: Dibujar la versión reducida**

Partir de la cabeza de `mascota.svg` y **quitar hasta que quede reconocible y no más**: cráneo, rostro, dos orejas, dos ojos, nariz, boca. Nada más.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/mascota-reducida.test.ts`
Expected: PASS.

- [ ] **Step 5: La prueba de los 32 píxeles**

```bash
pnpm render src/assets/brand/mascota-reducida.svg /tmp/red-32.png  --ancho 32  --fondo '#FAF3E0'
pnpm render src/assets/brand/mascota-reducida.svg /tmp/red-48.png  --ancho 48  --fondo '#FAF3E0'
pnpm render src/assets/brand/mascota-reducida.svg /tmp/red-512.png --ancho 512 --fondo '#FAF3E0'
```

Mirar el de 32 px **a tamaño real, sin ampliar**. Si es una mancha, volver al Step 3 y sacar más. Este es el criterio de aceptación 3 del spec.

- [ ] **Step 6: Commit**

```bash
git add src/assets/brand/mascota-reducida.svg test/mascota-reducida.test.ts
git commit -m "feat: mascota reducida legible a 32 px"
```

---

## Task 15: Las siete variantes de logo como componentes

**Files:**
- Create: `src/components/brand/SelloCompleto.astro`, `SelloReducido.astro`, `Logotipo.astro`, `IsotipoSuelto.astro`, `SelloCircular.astro`, `Monocromo.astro`, `LockupHeader.astro`
- Create: `src/components/brand/svg-inline.ts`
- Test: `test/variantes-logo.test.ts`

**Interfaces:**
- Consumes: `tokenizarSvg` de Task 10, los SVG de Tasks 9, 13 y 14.
- Produces: siete componentes Astro. Task 17 los usa en la styleguide.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/variantes-logo.test.ts
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import LockupHeader from '@/components/brand/LockupHeader.astro'
import SelloCircular from '@/components/brand/SelloCircular.astro'
import Logotipo from '@/components/brand/Logotipo.astro'

const container = await AstroContainer.create()

describe('LockupHeader', () => {
  it('inyecta el SVG inline, no como <img>', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('<svg')
    expect(html).not.toContain('<img')
  })

  it('usa var() de tokens en vez de hex crudos', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('var(--mrc-')
  })

  it('muestra el descriptor por defecto y lo oculta bajo 640px', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toContain('descriptor')
    // la mitigación de §8 del spec
    expect(html).toMatch(/max-sm:hidden|hidden sm:block/)
  })

  it('lleva un aria-label en español', async () => {
    const html = await container.renderToString(LockupHeader)
    expect(html).toMatch(/aria-label="Maracacao[^"]*"/)
  })
})

describe('SelloCircular', () => {
  it('usa la mascota reducida, no la completa', async () => {
    const html = await container.renderToString(SelloCircular)
    expect(html).not.toContain('id="bowl"')
    expect(html).not.toContain('id="granos-orbita"')
  })
})

describe('Logotipo', () => {
  it('acepta una prop de tamaño y la aplica', async () => {
    const html = await container.renderToString(Logotipo, { props: { alto: 48 } })
    expect(html).toMatch(/height="48"|height:\s*48px/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/variantes-logo.test.ts`
Expected: FAIL — los componentes no existen.

- [ ] **Step 3: Implementar el helper de inyección**

```ts
// src/components/brand/svg-inline.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tokenizarSvg } from '@/lib/tokenize-svg'

/** Lee un SVG de marca, lo tokeniza y le saca la capa de pivotes. */
export function svgDeMarca(nombre: string): string {
  const ruta = fileURLToPath(new URL(`../../assets/brand/${nombre}.svg`, import.meta.url))
  const crudo = readFileSync(ruta, 'utf8')
  const sinPivotes = crudo.replace(/<g id="pivotes">[\s\S]*?<\/g>\s*/g, '')
  return tokenizarSvg(sinPivotes)
}
```

- [ ] **Step 4: Implementar `LockupHeader.astro`**

```astro
---
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { alto?: number }
const { alto = 44 } = Astro.props
const cabeza = svgDeMarca('mascota-reducida')
const logotipo = svgDeMarca('logotipo')
const descriptor = svgDeMarca('descriptor')
---
<a href="/" class="flex items-center gap-3" aria-label={copy.logoAria}>
  <span class="shrink-0" style={`height:${alto}px`} set:html={cabeza} />
  <span class="flex flex-col">
    <span set:html={logotipo} />
    <span class="descriptor hidden sm:block" set:html={descriptor} />
  </span>
</a>
```

```ts
// src/copy/marca.ts — ningún string visible dentro de un componente
export const copy = {
  logoAria: 'Maracacao — chocolate mexicano',
  navSabores: 'Sabores',
  navOrigen: 'Origen',
  navTienda: 'Tienda',
} as const
```

- [ ] **Step 5: Implementar los otros seis componentes**

```astro
---
// src/components/brand/SelloCircular.astro
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { diametro?: number }
const { diametro = 96 } = Astro.props
const cabeza = svgDeMarca('mascota-reducida')
---
<span
  class="inline-flex items-end justify-center overflow-hidden rounded-full"
  style={`width:${diametro}px;height:${diametro}px;background:var(--mrc-verde-600)`}
  role="img"
  aria-label={copy.logoAria}
  set:html={cabeza}
/>
```

```astro
---
// src/components/brand/Logotipo.astro
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { alto?: number }
const { alto = 32 } = Astro.props
const svg = svgDeMarca('logotipo').replace('<svg', `<svg height="${alto}"`)
---
<span role="img" aria-label={copy.logoAria} set:html={svg} />
```

```astro
---
// src/components/brand/IsotipoSuelto.astro
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { alto?: number }
const { alto = 120 } = Astro.props
const svg = svgDeMarca('mascota-reducida').replace('<svg', `<svg height="${alto}"`)
---
<span role="img" aria-label={copy.mascotaAria} set:html={svg} />
```

```astro
---
// src/components/brand/SelloCompleto.astro
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { ancho?: number }
const { ancho = 320 } = Astro.props
const arco = svgDeMarca('logotipo-arco')
const mascota = svgDeMarca('mascota')
const descriptor = svgDeMarca('descriptor')
---
<div class="flex flex-col items-center" style={`width:${ancho}px`} role="img" aria-label={copy.logoAria}>
  <span class="w-full" set:html={arco} />
  <span class="-mt-2 w-4/5" set:html={mascota} />
  <span class="w-1/2" set:html={descriptor} />
</div>
```

```astro
---
// src/components/brand/SelloReducido.astro
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { ancho?: number }
const { ancho = 280 } = Astro.props
const arco = svgDeMarca('logotipo-arco')
const mascota = svgDeMarca('mascota')
---
<div class="flex flex-col items-center" style={`width:${ancho}px`} role="img" aria-label={copy.logoAria}>
  <span class="w-full" set:html={arco} />
  <span class="-mt-2 w-4/5" set:html={mascota} />
</div>
```

```astro
---
// src/components/brand/Monocromo.astro
// Una sola tinta: se descartan los fills del sistema y todo hereda currentColor.
import { svgDeMarca } from './svg-inline'
import { copy } from '@/copy/marca'

interface Props { variante?: 'positivo' | 'negativo'; alto?: number }
const { variante = 'positivo', alto = 120 } = Astro.props

const plano = svgDeMarca('mascota-reducida')
  .replace(/fill="var\(--mrc-[^)]*\)"/g, 'fill="currentColor"')
  .replace(/stroke="var\(--mrc-[^)]*\)"/g, 'stroke="currentColor"')

const color = variante === 'positivo' ? 'var(--mrc-tinta)' : 'var(--mrc-papel)'
---
<span
  style={`color:${color};height:${alto}px`}
  role="img"
  aria-label={copy.logoAria}
  set:html={plano}
/>
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/variantes-logo.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/brand src/copy test/variantes-logo.test.ts
git commit -m "feat: las siete variantes de logo como componentes Astro"
```

---

## Task 16: Animación ambiental en CSS

**Files:**
- Create: `src/styles/mascota-ambiental.css`
- Create: `src/components/brand/Mascota.astro`
- Test: `test/ambiental.test.ts`

**Interfaces:**
- Consumes: tokens de movimiento de Task 11, `mascota.svg` de Task 9.
- Produces: `<Mascota/>` con respiración, parpadeo y cola. Es el **fallback obligatorio** que Task 18 reemplaza con Rive.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/ambiental.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Mascota from '@/components/brand/Mascota.astro'
import { amplitudes } from '@/tokens/motion'

const css = readFileSync('src/styles/mascota-ambiental.css', 'utf8')
const container = await AstroContainer.create()

describe('animación ambiental', () => {
  it.each(['respiracion', 'parpadeo', 'cola'])('define el keyframe %s', (n) => {
    expect(css).toMatch(new RegExp(`@keyframes\\s+${n}\\b`))
  })

  it('la respiración usa la amplitud del token', () => {
    expect(css).toContain(`scale(${amplitudes.respiracionEscala})`)
  })

  it('la cola usa los grados del token', () => {
    expect(css).toContain(`${amplitudes.colaGrados}deg`)
  })

  it('las duraciones salen de custom properties, no están hardcodeadas', () => {
    const duracionesCrudas = css.match(/animation:[^;]*\b\d+(\.\d+)?s\b/g) ?? []
    expect(duracionesCrudas).toEqual([])
    expect(css).toContain('var(--mrc-dur-ambiental)')
  })

  it('apaga por completo con prefers-reduced-motion', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    const bloque = css.slice(css.indexOf('prefers-reduced-motion'))
    expect(bloque).toContain('animation: none')
    expect(bloque).not.toContain('animation-duration: 0.01')
  })

  it('cada parte animada usa su pivote, no el centro de la caja', () => {
    for (const parte of ['cola', 'cabeza']) {
      expect(css).toMatch(new RegExp(`#${parte}[^{]*\\{[^}]*transform-origin:`))
    }
  })
})

describe('<Mascota/>', () => {
  it('renderiza el SVG inline sin la capa de pivotes', async () => {
    const html = await container.renderToString(Mascota)
    expect(html).toContain('<svg')
    expect(html).not.toContain('id="pivotes"')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/ambiental.test.ts`
Expected: FAIL — el CSS y el componente no existen.

- [ ] **Step 3: Implementar `src/styles/mascota-ambiental.css`**

```css
/* Respiración: el torso escala apenas. */
@keyframes respiracion {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.02); }
}

/* Parpadeo: los párpados se cierran un instante en un ciclo largo. */
@keyframes parpadeo {
  0%, 92%, 100% { transform: scaleY(1); }
  95%           { transform: scaleY(0.1); }
}

/* Cola: vaivén sobre la cadera. */
@keyframes cola {
  0%, 100% { transform: rotate(-6deg); }
  50%      { transform: rotate(6deg); }
}

.mascota #cuerpo {
  transform-origin: 500px 640px; /* cadera */
  animation: respiracion var(--mrc-dur-ambiental) var(--mrc-ease-entrada) infinite;
}

.mascota #cabeza {
  transform-origin: 500px 400px; /* base del cuello */
}

.mascota #ojo-l,
.mascota #ojo-r {
  animation: parpadeo var(--mrc-dur-parpadeo) steps(1, end) infinite;
}

.mascota #cola {
  transform-origin: 560px 660px; /* cadera */
  animation: cola calc(var(--mrc-dur-ambiental) * 1.25) ease-in-out infinite;
}

/* El spec dice apagar, no atenuar. */
@media (prefers-reduced-motion: reduce) {
  .mascota #cuerpo,
  .mascota #ojo-l,
  .mascota #ojo-r,
  .mascota #cola {
    animation: none;
  }
}
```

Los `transform-origin` se ajustan a las coordenadas reales de los marcadores `piv-*` del SVG terminado.

- [ ] **Step 4: Implementar `src/components/brand/Mascota.astro`**

```astro
---
import { svgDeMarca } from './svg-inline'
import '@/styles/mascota-ambiental.css'
import { copy } from '@/copy/marca'

interface Props { class?: string }
const { class: clase = '' } = Astro.props
const svg = svgDeMarca('mascota')
---
<div class={`mascota ${clase}`} role="img" aria-label={copy.mascotaAria} set:html={svg} />
```

Agregar `mascotaAria: 'El mono de Maracacao bailando con un tazón de pistaches'` a `src/copy/marca.ts`.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run test/ambiental.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificación en navegador (montaje temporal)**

Hasta la Task 17 no existe ninguna página que use `<Mascota/>`, así que el chequeo se hace montándola de forma descartable:

1. Agregar `<Mascota />` dentro de `src/pages/index.astro`, importándola.
2. `pnpm dev` y abrir la página.
3. Verificar las tres animaciones ambientales: la respiración del torso, el parpadeo y el vaivén de la cola. Cada parte tiene que girar sobre su pivote anatómico — si la cola pivotea desde su centro en vez de desde la cadera, el `transform-origin` está mal.
4. Activar `prefers-reduced-motion` en el sistema operativo y recargar. **Todo tiene que quedar quieto, no lento.** Una animación a velocidad reducida es un fallo, no un aprobado.
5. **Revertir el montaje**: sacar el import y el componente de `index.astro`, y confirmar con `git diff` que el archivo quedó igual que antes.

El montaje es descartable a propósito: `index.astro` se reescribe entero en la Task 17, y adelantar ese trabajo acá chocaría con la capa de copy que crea la Task 15.

- [ ] **Step 7: Commit**

```bash
git add src/styles/mascota-ambiental.css src/components/brand/Mascota.astro src/copy/marca.ts test/ambiental.test.ts
git commit -m "feat: animación ambiental en CSS con apagado por reduced-motion"
```

---

## Task 17: Styleguide — el manual

**Files:**
- Create: `src/lib/rutas.ts`
- Create: `src/content.config.ts`, `src/content/manual/*.mdx`
- Create: `src/pages/manual/[...slug].astro`, `src/pages/index.astro` (reescribir)
- Test: `test/manual.test.ts`

**Interfaces:**
- Consumes: todos los componentes anteriores.
- Produces: el sitio navegable del manual.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/manual.test.ts
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { ruta } from '@/lib/rutas'

describe('helper de rutas', () => {
  it('arma rutas internas sin locale hoy', () => {
    expect(ruta('manual/color')).toBe('/manual/color')
  })
  it('normaliza barras de más', () => {
    expect(ruta('/manual/color/')).toBe('/manual/color')
  })
  it('la raíz es una sola barra', () => expect(ruta('')).toBe('/'))
})

describe('contenido del manual', () => {
  const archivos = readdirSync('src/content/manual').filter((f) => f.endsWith('.mdx'))

  it('cubre las secciones del spec', () => {
    const slugs = archivos.map((f) => f.replace('.mdx', ''))
    for (const s of ['color', 'tipografia', 'logo', 'mascota', 'animacion', 'referencias']) {
      expect(slugs).toContain(s)
    }
  })

  it('cada página declara título y orden', () => {
    for (const f of archivos) {
      const fm = readFileSync(`src/content/manual/${f}`, 'utf8')
      expect(fm).toMatch(/^---[\s\S]*titulo:/m)
      expect(fm).toMatch(/^---[\s\S]*orden:/m)
    }
  })

  it('ninguna página escribe un hex a mano — se leen de los tokens', () => {
    for (const f of archivos) {
      const cuerpo = readFileSync(`src/content/manual/${f}`, 'utf8').replace(/^---[\s\S]*?---/, '')
      const hex = cuerpo.match(/#[0-9A-Fa-f]{6}\b/g) ?? []
      expect(hex).toEqual([])
    }
  })

  it('ninguna página enlaza con href crudo', () => {
    for (const f of archivos) {
      const cuerpo = readFileSync(`src/content/manual/${f}`, 'utf8')
      expect(cuerpo).not.toMatch(/href="\/(?!\{)/)
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/manual.test.ts`
Expected: FAIL — no existen `@/lib/rutas` ni `src/content/manual`.

- [ ] **Step 3: Implementar `src/lib/rutas.ts`**

```ts
/**
 * Único lugar donde se arman URLs internas.
 * Hoy no hay prefijo de idioma. Cuando lo haya, se cambia acá y nada más.
 */
export function ruta(destino: string): string {
  const limpio = destino.replace(/^\/+|\/+$/g, '')
  return limpio === '' ? '/' : `/${limpio}`
}
```

- [ ] **Step 4: Definir la colección de contenido**

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const manual = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/manual' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    orden: z.number(),
  }),
})

export const collections = { manual }
```

- [ ] **Step 5: Escribir las seis páginas del manual**

Seis archivos: `color`, `tipografia`, `logo`, `mascota`, `animacion`, `referencias`. Los valores se leen de los tokens en vivo — por eso el test prohíbe hex escritos a mano.

Componentes de demostración primero:

```astro
---
// src/components/manual/Rampa.astro
import { verde, tan } from '@/tokens/color'
interface Props { nombre: 'verde' | 'tan' }
const { nombre } = Astro.props
const rampa = nombre === 'verde' ? verde : tan
---
<div class="flex overflow-hidden rounded-lg">
  {Object.entries(rampa).map(([paso, hex]) => (
    <div class="flex-1 pb-2 pt-10 text-center text-[10px]" style={`background:${hex}`}>
      <span style={`color:${Number(paso) >= 500 ? '#FAF3E0' : '#372915'}`}>{paso}</span>
    </div>
  ))}
</div>
```

```astro
---
// src/components/manual/TablaContraste.astro
// Calcula en vivo: si alguien toca un token y rompe un par, se ve acá.
import { paresAprobados } from '@/tokens/color'
import { contrastRatio, nivelWcag } from '@/tokens/contrast'
---
<table class="w-full text-sm">
  <tbody>
    {paresAprobados.map((p) => {
      const ratio = contrastRatio(p.frente, p.fondo)
      return (
        <tr>
          <td class="p-3" style={`background:${p.fondo};color:${p.frente}`}>{p.uso}</td>
          <td class="p-3 text-right tabular-nums">{ratio.toFixed(2)}</td>
          <td class="p-3">{nivelWcag(ratio)}</td>
        </tr>
      )
    })}
  </tbody>
</table>
```

```astro
---
// src/components/manual/Bandas.astro — demuestra §6.4 del spec
import Mascota from '@/components/brand/Mascota.astro'
import { copy } from '@/copy/marca'
---
<div class="overflow-hidden rounded-lg">
  <section class="px-6 py-10" style="background:var(--mrc-papel);color:var(--mrc-tinta)">
    <p>{copy.demoBandaClara}</p>
    <Mascota class="h-40" />
  </section>
  <section class="px-6 py-10" style="background:var(--mrc-verde-700);color:var(--mrc-papel)">
    <p>{copy.demoBandaOscura}</p>
    <Mascota class="h-40" />
  </section>
</div>
```

Agregar a `src/copy/marca.ts`:

```ts
demoBandaClara: 'Banda clara: el mono recorta contra el papel.',
demoBandaOscura: 'Banda verde: el contorno sostiene la figura.',
```

Y la página que los usa:

```mdx
---
titulo: Color
resumen: Rampas, roles y los pares de contraste verificados.
orden: 1
---
import Rampa from '@/components/manual/Rampa.astro'
import TablaContraste from '@/components/manual/TablaContraste.astro'
import Bandas from '@/components/manual/Bandas.astro'

## Rampas

<Rampa nombre="verde" />
<Rampa nombre="tan" />

## Pares aprobados

Calculados en vivo desde los tokens. Si un número baja de 4.5, el test falla.

<TablaContraste />

## Bandas alternadas

<Bandas />
```

Las otras cinco siguen el mismo patrón: `tipografia.mdx` muestra especímenes con los ejes de Fraunces, `logo.mdx` renderiza las siete variantes, `mascota.mdx` documenta la jerarquía leyendo `JERARQUIA`, `animacion.mdx` lista los siete principios y muestra `<Mascota/>` corriendo, y `referencias.mdx` transcribe la regla vinculante de §3 del spec con las dos imágenes al lado.

- [ ] **Step 6: Implementar el layout de rutas y la portada**

```astro
---
// src/pages/manual/[...slug].astro
import { getCollection, render } from 'astro:content'
import Base from '@/layouts/Base.astro'
import { ruta } from '@/lib/rutas'

export async function getStaticPaths() {
  const paginas = await getCollection('manual')
  return paginas.map((p) => ({ params: { slug: p.id }, props: { pagina: p } }))
}

const { pagina } = Astro.props
const { Content } = await render(pagina)
const indice = (await getCollection('manual')).sort((a, b) => a.data.orden - b.data.orden)
---
<Base titulo={`${pagina.data.titulo} — Manual Maracacao`}>
  <div class="mx-auto flex max-w-5xl gap-10 px-6 py-10">
    <nav class="w-48 shrink-0">
      <ul>
        {indice.map((p) => (
          <li><a href={ruta(`manual/${p.id}`)}>{p.data.titulo}</a></li>
        ))}
      </ul>
    </nav>
    <article class="min-w-0 flex-1">
      <h1>{pagina.data.titulo}</h1>
      <p>{pagina.data.resumen}</p>
      <Content />
    </article>
  </div>
</Base>
```

```astro
---
// src/pages/index.astro
import { getCollection } from 'astro:content'
import Base from '@/layouts/Base.astro'
import LockupHeader from '@/components/brand/LockupHeader.astro'
import { ruta } from '@/lib/rutas'
import { copy } from '@/copy/marca'
import '@/styles/global.css'

const indice = (await getCollection('manual')).sort((a, b) => a.data.orden - b.data.orden)
---
<Base titulo="Maracacao — Manual de marca">
  <header class="mx-auto max-w-5xl px-6 py-8"><LockupHeader /></header>
  <main class="mx-auto max-w-5xl px-6 pb-16">
    <h1>{copy.manualTitulo}</h1>
    <ul>
      {indice.map((p) => (
        <li>
          <a href={ruta(`manual/${p.id}`)}>{p.data.titulo}</a> — {p.data.resumen}
        </li>
      ))}
    </ul>
  </main>
</Base>
```

Agregar `manualTitulo: 'Manual de marca'` a `src/copy/marca.ts`.

- [ ] **Step 7: Correr el test y el build**

Run: `pnpm test && pnpm build`
Expected: PASS y build limpio.

- [ ] **Step 8: Commit**

```bash
git add src/lib/rutas.ts src/content.config.ts src/content src/pages test/manual.test.ts
git commit -m "feat: styleguide navegable con tokens leídos en vivo"
```

---

## Task 18: Rig spec e integración de Rive

**Files:**
- Create: `docs/rig-spec.md`
- Create: `scripts/emit-rig-spec.ts`
- Create: `src/components/brand/MascotaRive.tsx`
- Modify: `src/components/brand/Mascota.astro`
- Test: `test/rive.test.ts`

**Interfaces:**
- Consumes: `JERARQUIA`, `PIVOTES` de Task 5; `mascota.svg` de Task 9.
- Produces: `docs/rig-spec.md` generado desde el código (no puede desincronizarse) y la isla que carga el `.riv` cuando exista.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// test/rive.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cargarSvg } from './svg-utils'
import { PIVOTES } from '@/assets/brand/jerarquia'

const spec = readFileSync('docs/rig-spec.md', 'utf8')
const tsx = readFileSync('src/components/brand/MascotaRive.tsx', 'utf8')

describe('rig-spec.md', () => {
  it.each(Object.keys(PIVOTES))('documenta el pivote de #%s', (id) => {
    expect(spec).toContain(`#${id}`)
  })

  it('lista las coordenadas reales de cada marcador', () => {
    const doc = cargarSvg('src/assets/brand/mascota.svg')
    for (const id of Object.keys(PIVOTES)) {
      const el = doc.querySelector(`[id="piv-${id}"]`)!
      expect(spec).toContain(`${el.getAttribute('cx')}, ${el.getAttribute('cy')}`)
    }
  })

  it('documenta los cuatro inputs de la state machine', () => {
    for (const input of ['hover', 'scrollY', 'celebrar', 'banda']) {
      expect(spec).toContain(input)
    }
  })

  it('documenta los cuatro estados', () => {
    for (const estado of ['Idle', 'Saluda', 'Come', 'Celebra']) {
      expect(spec).toContain(estado)
    }
  })

  it('avisa que la capa de pivotes se borra después de alinear', () => {
    expect(spec).toMatch(/borra|eliminar/i)
  })
})

describe('MascotaRive', () => {
  it('no monta bajo prefers-reduced-motion', () => {
    expect(tsx).toContain('prefers-reduced-motion')
  })

  it('parte del fallback y solo reemplaza cuando el .riv cargó', () => {
    expect(tsx).toMatch(/riveLoaded|isLoaded|hasLoaded/)
  })

  it('no importa Rive en el módulo de nivel superior de Astro', () => {
    const astro = readFileSync('src/components/brand/Mascota.astro', 'utf8')
    expect(astro).not.toContain('@rive-app')
    expect(astro).toContain('client:visible')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest run test/rive.test.ts`
Expected: FAIL — `docs/rig-spec.md` y el `.tsx` no existen.

- [ ] **Step 3: Implementar el generador del rig spec**

```ts
// scripts/emit-rig-spec.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { JERARQUIA, PIVOTES } from '../src/assets/brand/jerarquia.ts'

const { document } = parseHTML(
  `<html><body>${readFileSync('src/assets/brand/mascota.svg', 'utf8')}</body></html>`,
)
const coord = (id: string) => {
  const el = document.querySelector(`[id="piv-${id}"]`)
  if (!el) throw new Error(`Falta el marcador piv-${id}`)
  return `${el.getAttribute('cx')}, ${el.getAttribute('cy')}`
}

const filas = Object.entries(PIVOTES)
  .map(([id, donde]) => `| \`#${id}\` | ${donde} | \`${coord(id)}\` |`)
  .join('\n')

const arbol = JERARQUIA
  .map(({ id, padre }) => `- \`#${id}\`${padre ? ` — dentro de \`#${padre}\`` : ''}`)
  .join('\n')

writeFileSync('docs/rig-spec.md', `# Rig spec — mascota de Maracacao

> GENERADO por \`pnpm rig-spec\` desde \`jerarquia.ts\` y \`mascota.svg\`.
> No editar a mano: se regenera y se pierde.

## Cómo usar este documento

1. Importá \`src/assets/brand/mascota.svg\` en Rive.
2. Para cada fila de la tabla, movés el origen del objeto a la coordenada indicada.
   Rive lo pone por defecto en el centro del bounding box, que para un miembro está mal.
3. Cuando terminaste de alinear, **se borra la capa \`#pivotes\` entera.**

Las coordenadas están en el sistema del viewBox \`0 0 1024 1024\`.

## Pivotes

| Grupo | Punto anatómico | Coordenada |
|---|---|---|
${filas}

## Jerarquía

El orden es el de pintado: primero es más atrás.

${arbol}

## State machine \`MonoSM\`

### Inputs

| Input | Tipo | Disparador |
|---|---|---|
| \`hover\` | Boolean | El cursor entra en la mascota |
| \`scrollY\` | Number 0..1 | Progreso de scroll normalizado |
| \`celebrar\` | Trigger | Agregado al carrito, form enviado |
| \`banda\` | Number 0/1 | Sobre \`papel\` o sobre \`verde-700\` |

### Estados

| Estado | Comportamiento |
|---|---|
| \`Idle\` | Respiración (torso 1.00→1.02, 3.2 s), parpadeo cada 4-7 s con jitter, cola ±6° a 4 s, granos en órbita lenta |
| \`Saluda\` | Al entrar \`hover\`: cabeza gira 8°, brazo libre levanta, ojos se abren |
| \`Come\` | Mano a la boca, mastica dos veces. Auto-disparo cada ~12 s dentro de \`Idle\` |
| \`Celebra\` | Salta, los granos del bowl se dispersan, las chispas destellan |

El mínimo viable es \`Idle\` + \`Saluda\`. Si el resto resulta excesivo al riggear, se poda.

## Principios de movimiento

1. Nada se mueve en línea recta. Todo describe un arco.
2. Anticipación siempre: antes de subir, baja un poco.
3. Peso: cola y orejas llegan tarde, 80-120 ms respecto del cuerpo.
4. Nunca más de dos cosas moviéndose a la vez fuera del idle.
5. Easing por defecto: spring suave, no \`ease-in-out\`.
6. Duraciones: micro 120-200 ms · gestos 300-500 ms · ambientales 3-5 s.

## Presupuesto

El \`.riv\` tiene que quedar **bajo 60 kB**. El runtime pesa ~90 kB gzip aparte.
`)
console.log('docs/rig-spec.md listo')
```

Agregar `"rig-spec": "node --experimental-strip-types scripts/emit-rig-spec.ts"` a `package.json` y correrlo.

- [ ] **Step 4: Implementar la isla `MascotaRive.tsx`**

```tsx
import { useRive } from '@rive-app/react-canvas'
import { useEffect, useState } from 'react'

interface Props { src: string; fallback: string; class?: string }

export default function MascotaRive({ src, fallback, class: clase = '' }: Props) {
  const [permitido, setPermitido] = useState(false)

  useEffect(() => {
    // El spec dice apagar, no atenuar: bajo reduced-motion no montamos nada.
    setPermitido(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const { RiveComponent, rive } = useRive(
    { src, stateMachines: 'MonoSM', autoplay: true },
    { shouldDisableRiveListeners: !permitido },
  )

  const cargado = permitido && Boolean(rive)

  return (
    <div className={`mascota ${clase}`}>
      {!cargado && <div dangerouslySetInnerHTML={{ __html: fallback }} />}
      {permitido && <RiveComponent style={{ display: cargado ? 'block' : 'none' }} />}
    </div>
  )
}
```

- [ ] **Step 5: Conectar desde `Mascota.astro`**

```astro
---
import { svgDeMarca } from './svg-inline'
import MascotaRive from './MascotaRive'
import '@/styles/mascota-ambiental.css'
import { copy } from '@/copy/marca'

// `class` se mantiene: Bandas.astro (Task 17) ya lo usa.
interface Props { rive?: boolean; class?: string }
const { rive = false, class: clase = '' } = Astro.props
const svg = svgDeMarca('mascota')
---
{rive ? (
  <MascotaRive client:visible src="/brand/mono.riv" fallback={svg} class={clase} />
) : (
  <div class={`mascota ${clase}`} role="img" aria-label={copy.mascotaAria} set:html={svg} />
)}
```

- [ ] **Step 6: Correr el test y el build**

Run: `pnpm rig-spec && pnpm test && pnpm build`
Expected: PASS y build limpio. **La página tiene que funcionar sin que exista `public/brand/mono.riv`** — es exactamente lo que verifica el fallback.

- [ ] **Step 7: Commit**

```bash
git add docs/rig-spec.md scripts/emit-rig-spec.ts src/components/brand package.json test/rive.test.ts
git commit -m "feat: rig spec generado desde el código e isla de Rive con fallback"
```

---

## Task 19: Verificación final contra los criterios de aceptación

**Files:**
- Create: `test/aceptacion.test.ts`
- Create: `docs/referencias/` (mover las imágenes de referencia al repo)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la suite que verifica los ocho criterios del §13 del spec.

- [ ] **Step 1: Confirmar que las referencias siguen versionadas**

Se commitearon antes de la Task 1, porque la Task 7 ya dibuja contra ellas. Acá solo se verifica que nadie las haya borrado.

```bash
ls -la docs/referencias/
```

Esperado: `packaging-foto.jpg`, `render-limpio.png` y `mascota-recorte-transparente.png`.

- [ ] **Step 2: Escribir el test de aceptación**

```ts
// test/aceptacion.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { cargarSvg, idsDeGrupos, hexUsados } from './svg-utils'
import { JERARQUIA } from '@/assets/brand/jerarquia'
import { paresAprobados, todosLosColores } from '@/tokens/color'
import { contrastRatio } from '@/tokens/contrast'

describe('criterio 1 — el SVG importa limpio a Rive', () => {
  const doc = cargarSvg('src/assets/brand/mascota.svg')
  it('todos los grupos del contrato existen con su nombre exacto', () => {
    const ids = idsDeGrupos(doc)
    for (const { id } of JERARQUIA) expect(ids).toContain(id)
  })
})

describe('criterio 4 — un solo lugar define los colores', () => {
  it('el CSS generado sale de los tokens', () => {
    const css = readFileSync('src/styles/tokens.generated.css', 'utf8')
    for (const hex of todosLosColores()) expect(css).toContain(hex)
  })
  it('ningún SVG de marca tiene colores fuera del sistema', () => {
    const permitidos = todosLosColores()
    for (const n of ['mascota', 'mascota-reducida', 'logotipo', 'logotipo-arco', 'descriptor']) {
      const rogue = hexUsados(cargarSvg(`src/assets/brand/${n}.svg`))
        .filter((c) => !permitidos.includes(c))
      expect({ archivo: n, rogue }).toEqual({ archivo: n, rogue: [] })
    }
  })
})

describe('criterio 5 — todos los pares de texto cumplen 4.5:1', () => {
  it.each(paresAprobados.filter((p) => p.minimo === 'AA' || p.minimo === 'AAA'))(
    '$uso', ({ frente, fondo }) => {
      expect(contrastRatio(frente, fondo)).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('criterio 8 — reduced-motion apaga todo', () => {
  it('el CSS global y el de la mascota lo contemplan', () => {
    for (const ruta of ['src/styles/global.css', 'src/styles/mascota-ambiental.css']) {
      expect(readFileSync(ruta, 'utf8')).toMatch(/prefers-reduced-motion:\s*reduce/)
    }
  })
})

describe('las referencias están versionadas', () => {
  it.each(['docs/referencias/packaging-foto.jpg', 'docs/referencias/render-limpio.png'])(
    '%s existe', (r) => expect(existsSync(r)).toBe(true),
  )
})
```

- [ ] **Step 3: Correr toda la suite**

Run: `pnpm test`
Expected: PASS, todo.

- [ ] **Step 4: Verificación manual de los criterios que no se automatizan**

| Criterio | Cómo se verifica |
|---|---|
| 2 — prueba del brazo | Rotar `#brazo-l` 20°, rasterizar, confirmar cero huecos |
| 3 — legibilidad a 32 px | Mirar `mascota-reducida.svg` a 32 px sin ampliar |
| 6 — la styleguide corre | `pnpm dev` y navegar las seis páginas |
| 7 — alguien externo la puede usar | Leer el manual de punta a punta buscando lo que da por sabido |

- [ ] **Step 5: Commit**

```bash
git add test/aceptacion.test.ts docs/referencias
git commit -m "test: suite de aceptación contra los criterios del spec"
```

---

## Notas de ejecución

- **Las tareas 7, 8, 9, 13 y 14 son dibujo.** Sus tests verifican estructura, paleta y pivotes — no pueden verificar que el dibujo *esté bien*. Por eso cada una termina con un paso de verificación visual contra `docs/referencias/`. Ese paso no es opcional.
- **La prueba del brazo (Task 8, Step 7) es la que más ahorra retrabajo.** Si falla, falta geometría oculta, y arreglarlo después de dibujar las piernas cuesta el triple.
- **La paleta cerrada se verifica en cada tarea de dibujo, no solo al final.** Un hex fuera de sistema es más fácil de encontrar en la tarea que lo introdujo.
- **Nada bloquea en el `.riv`.** El sitio tiene que funcionar completo sin ese archivo. La Task 18, Step 6 lo verifica explícitamente.
