# Handoff — Identidad Maracacao (proyecto 1)

**Fecha:** 2026-08-04 · **Rama:** `identidad-maracacao` · **Estado:** lista para merge tras review final de rama completa.

## Qué se entrega

- **Mascota vectorial completa y riggeada** (`src/assets/brand/mascota.svg`): 1024×1024, capas nombradas según el contrato de `jerarquia.ts`, pivotes anatómicos marcados, geometría oculta verificada por batería automatizada (`test/mascota-rig.test.ts`: ráster BFS + invariante analítica del casquete proximal).
- **Mascota reducida** (`mascota-reducida.svg`): legible a 32 px reales. A 16 px degrada a "forma de mono" — esperable; si algún día se quiere un favicon perfecto a 16, se hace una variante solo-silueta.
- **Lettering custom** calcado de la foto del packaging (`logotipo.svg`, `logotipo-arco.svg`, `descriptor.svg`): una letra por path (animables individualmente), color como atributo de presentación — nunca en cascada CSS.
- **Siete variantes de logo** como componentes Astro (`src/components/brand/`). `LockupHeader` es de **banda clara únicamente**; `Logotipo`/`SelloCompleto` de banda oscura — documentado en cada archivo.
- **Design tokens** (`src/tokens/`): 36 colores (rampas verde/tan/rosa + 6 fijos), tipografía (Fraunces variable con ejes `SOFT`/`WONK` + Work Sans, self-hosteadas), movimiento (duraciones, spring, amplitudes). `tokens.generated.css` emite 62 custom properties con `@theme static` (sin tree-shaking) — regenerar con `pnpm tokens`.
- **Animación ambiental CSS** (respiración, parpadeo, cola) con pivotes reales y apagado total bajo `prefers-reduced-motion`.
- **Manual navegable** (`pnpm dev` → portada + 6 secciones), leyendo los tokens en vivo.
- **Rig spec para Rive** (`docs/rig-spec.md`, regenerable con `pnpm rig-spec`) + isla `MascotaRive` con fallback. El sitio funciona completo sin `mono.riv`.

**Verificación:** 476 tests (`pnpm test`) · `pnpm typecheck` 0/0/0 · `pnpm build` 7 páginas · aceptación 8/8 (§13 del spec) auditada por review final independiente.

## El paso que falta y es humano: riggear en Rive

1. Abrir Rive e importar `src/assets/brand/mascota.svg` con `docs/rig-spec.md` al lado.
2. **`#mano-l` se re-emparenta al hueso del brazo izquierdo** — en el SVG cuelga de `#mono` por orden de pintado (para que el pistache llegue a la boca por delante de la cara). El rig-spec lo repite tres veces; no saltearlo.
3. Alinear cada origen contra su marcador `piv-*` y **borrar la capa `#pivotes`** al final.
4. Exportar `mono.riv` (< 60 kB) a `public/brand/`, y **activar la prop** en el call site elegido: `<Mascota rive class="h-56" />`. Sin ese paso, el archivo no hace nada — el rig-spec lo documenta.
5. Mínimo viable: `Idle` + `Saluda`. Las transiciones exactas y el efecto de `scrollY`/`banda` quedan a criterio del rigger — el spec no las fijó (decisión anotada: pertenecen al diseño de la landing).

## Deuda aceptada y recomendaciones (triage del review final)

**Para el proyecto 2 (landing) — resolver antes de escribir JS que toque el DOM:**

- **Ids duplicados al inlinear** (17–129 por página): benigno hoy (nada consulta el DOM), pero cualquier `getElementById` de la landing hereda ambigüedad. El fix (prefijar ids en `svgDeMarca`) debe co-diseñarse con `mascota-ambiental.css`, que targetea `#cola`/`#cuerpo`/`#ojo-*`.
- **Transiciones de la state machine** y semántica de `scrollY`/`banda`: se definen con la landing.
- **Presupuesto Rive vs. fallback**: medir el peso real del fallback CSS+SVG contra los ~90 kB del runtime antes de comprometerse (§11.4 del spec lo pedía; quedó sin medir).

**Decisión de diseño pendiente (del dueño de la marca):** el descriptor `CHOCOLATE MEXICANO` del lockup de header renderiza a ~13 px de alto en desktop — lee como textura, no como palabra. Opciones: agrandar el lockup, subir la proporción del descriptor, o aceptarlo como textura deliberada.

**Recomendaciones del review final (valen la pena, no bloquean):**

1. Un test de contraste sobre el **DOM renderizado** (no solo sobre la tabla de tokens) — habría atrapado solo el bug de cascada del lettering.
2. La regla "un color de marca nunca vive en una clase CSS" como test sobre `src/assets/brand/*.svg`, no como comentario.
3. Los 11 strings visibles de `uso:`/`razon:` en `tokens/color.ts` deberían migrar a la capa de copy si el manual se traduce.
4. Encabezados accesibles (`<th>`/`<caption>`) en las tablas del manual.

## Convenciones que el código siguiente debe respetar

- Colores de marca: **atributos de presentación** en los SVG; la cascada solo para trazo estructural (`.t-*`), nunca para color.
- Ningún string visible en componentes: `src/copy/marca.ts` o MDX. Registro **es-MX** ("pistaches").
- Enlaces internos por `ruta()` (`src/lib/rutas.ts`) — preparado para `[lang]/` futuro.
- Ningún hex a mano fuera de `src/tokens/` — hay guard que escanea MDX, componentes del manual y páginas.
- `prefers-reduced-motion` **apaga, no atenúa**.
- `tokens.generated.css` y `docs/rig-spec.md` son generados: `pnpm tokens` / `pnpm rig-spec`, nunca a mano.
