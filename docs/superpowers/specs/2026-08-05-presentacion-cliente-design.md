# Presentación de identidad al cliente — Diseño

**Fecha:** 2026-08-05 · **Rama:** `presentacion-cliente` (desde `identidad-maracacao`)

## 1. Contexto y propósito

La identidad Maracacao está terminada (ver `docs/handoff-identidad.md`). Este
proyecto construye **la pieza que se le muestra al cliente**: una landing de
presentación en `/` que (a) revela la identidad completa, (b) adelanta cómo se
va a sentir el sitio final con secciones de muestra, y (c) enlaza al manual de
marca que ya existe. Registro **es-MX** de punta a punta.

No es todavía el "proyecto 2" del handoff (la landing pública con Rive): es la
presentación del trabajo. Pero comparte tokens, componentes y convenciones, y
todo lo que se construya acá (bandas, tabletas, copy) se reusa después.

**Audiencia:** el dueño de la marca. No sabe de tokens ni de tests; sí sabe de
chocolate y de su empaque. La página habla de lo que él reconoce — el mono, los
colores del empaque, los sabores — y deja la evidencia técnica a un clic.

## 2. Decisiones de diseño

**Tesis del hero:** la página abre como abre el empaque: banda verde profunda
con el sello completo (arco + mono + descriptor) respirando en crema. El
lettering crema sobre verde-700 es el par AAA que ya aprueba el sistema.

**Ritmo de bandas (§6.4 del spec de identidad — el ritmo lo define la landing):**

| # | Banda | Fondo | Contenido |
|---|---|---|---|
| 0 | Header | papel | `LockupHeader` + enlace al manual |
| 1 | Hero | verde-700 | Sello completo + tesis + 2 CTA |
| 2 | El mono | papel | Foto del empaque → vector; hover = Saluda |
| 3 | Las firmas | verde-700 | 7 variantes, cada una sobre su banda aprobada |
| 4 | La paleta | papel | **Firma: tableta mordida** + rampas |
| 5 | Las voces | verde-700 | Fraunces (SOFT/WONK animado) + Work Sans |
| 6 | El movimiento | papel | Principios + demo en vivo + reduced-motion |
| 7 | El adelanto | verde-800 | 3 tarjetas del sitio futuro: Sabores / Origen / Tienda |
| 8 | El cierre | papel | Números + CTA al manual + lo que sigue |
| 9 | Footer | verde-800 | Logotipo + descriptor + fecha |

El verde-800 se reserva para dos momentos: el umbral al "sitio que viene" y el
footer. Estructura que informa: banda profunda = salir de la presentación.

**Elemento firma — la paleta como tableta mordida.** Los 18 tonos centrales de
la paleta dispuestos como cuadritos de una tableta de chocolate, con un
cuadrito mordido y dos migajas. Codifica dos verdades: la paleta sale
literalmente de un empaque de chocolate, y el personaje es goloso. Es el único
lugar donde la página se permite el chiste; todo lo demás queda quieto.

**Vistas previas como tarjetas, no como bandas.** Las secciones del sitio
futuro (Sabores, Origen, Tienda) viven como tres tarjetas flotantes dentro de
la banda verde-800, cada una con su chip "Vista previa". Así la estructura
distingue "esto es la presentación" de "esto es un adelanto" sin explicarlo.

**Visuales de chocolate con logo:** `TabletaSabor` — tableta asomando de una
envoltura verde-700 con el logotipo crema (par AAA) y franja de sabor. Tres
sabores con precio en pesos vía `Intl` es-MX: blanco y pistaches (el canon del
empaque), leche con cacahuate, oscuro 70% cacao.

**Movimiento.** Un solo momento orquestado (revelado por scroll con
`IntersectionObserver` sobre `data-revelar` — nunca `getElementById`, por los
ids duplicados documentados en el handoff). Micro-gestos con presupuesto: el
mono saluda al hover (cabeza 8°, spring del token — anticipo de `MonoSM`), los
ejes SOFT/WONK de Fraunces oscilan en su specimen, los cuadritos de la tableta
se levantan al hover. Todo sale de los tokens de movimiento; `prefers-reduced-motion`
apaga todo (regla global existente) y el revelado no esconde contenido sin JS
ni con reduced-motion (estado inicial oculto solo bajo `html.js` + PRM off).

## 3. Convenciones que se respetan (del handoff)

- Ningún string visible en componentes → `src/copy/landing.ts`.
- Ningún hex a mano fuera de `src/tokens/` → los colores de tableta/rampas se
  **importan** de `@/tokens/color`; el guard B2 se extiende a `src/components/landing`.
- Enlaces internos por `ruta()`; anclas internas de página (`#...`) permitidas.
- `LockupHeader` solo banda clara; `Logotipo`/`SelloCompleto` solo banda oscura.
- La portada del manual se muda de `/` a `/manual/` sin perder nada.

## 4. Alcance

**Dentro:** landing en `/`, portada del manual en `/manual/`, copy es-MX,
4 componentes de landing, `landing.css`, tests (registro, guards, estructura).
**Afuera:** Rive (`mono.riv` no existe aún — el fallback CSS es el que se ve),
i18n, tienda real, CMS, el sitio público final.

## 5. Criterios de aceptación

1. `/` presenta la identidad completa y `/manual/` conserva el manual íntegro.
2. Todo texto visible vive en `src/copy/` y está en registro es-MX.
3. Ningún hex a mano en páginas ni componentes de landing (guard lo verifica).
4. Todos los pares texto/fondo usados son pares aprobados de `paresAprobados`.
5. Sin JS y con reduced-motion la página se ve completa y quieta.
6. `pnpm test`, `pnpm typecheck` y `pnpm build` pasan.
7. La página se sostiene en mobile (375px) y desktop (1280px+).

## 6. Plan de implementación

1. `src/copy/landing.ts` — todo el copy es-MX.
2. `src/pages/manual/index.astro` — portada del manual (contenido actual de `/`).
3. Componentes: `Banda.astro`, `VarianteTile.astro`, `PaletaTableta.astro`,
   `TabletaSabor.astro` + `src/styles/landing.css`.
4. `src/pages/index.astro` — la presentación (10 bandas) + script de revelado.
5. `test/landing.test.ts` + extensión del guard B2.
6. Verificación completa + revisión visual en navegador + iteración.
