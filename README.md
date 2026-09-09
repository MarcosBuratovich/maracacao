# Maracacao — identidad y sitio

Identidad de marca y sitio web de **Maracacao**, chocolate mexicano
artesanal. Todo sale de un mismo sistema de diseño en código: tokens de
color/tipografía/movimiento, componentes de marca en SVG y un manual
navegable que se lee en vivo desde ese código.

## Qué hay en el sitio

| Ruta | Qué es |
|---|---|
| `/` | Presentación de identidad para el cliente |
| `/manual/` | Manual de marca completo (tokens leídos en vivo) |
| `/sitio` | Borrador del sitio público, para iterar ideas (no enlazado; se comparte por URL directa) |

## Correr el proyecto

```bash
pnpm install
pnpm dev        # servidor local
pnpm test       # suite completa (tests de dibujo, contraste, guards y páginas)
pnpm typecheck  # astro check
pnpm build:sitio # solo el build (astro build, sin verificar)
pnpm build      # la compuerta: build:sitio, luego test y typecheck — si algo falla, sale con error
```

Scripts de generación (sus salidas no se editan a mano):

```bash
pnpm tokens     # src/styles/tokens.generated.css desde src/tokens/
pnpm rig-spec   # docs/rig-spec.md desde el SVG de la mascota
pnpm favicon    # public/favicon.svg desde el asset + token
```

## Estructura

- `src/tokens/` — la fuente de verdad de color, tipografía y movimiento.
  Ningún hex vive fuera de acá (hay guards que lo verifican).
- `src/assets/brand/` + `src/components/brand/` — mascota vectorial por
  capas, lettering y las siete variantes de logo.
- `src/components/landing/` y `src/components/sitio/` — piezas de la
  presentación y del borrador del sitio (tabletas, paleta, taza con
  espuma, hojas, mazorca).
- `src/copy/` — TODO el texto visible, en es-MX. Ningún string vive en un
  componente.
- `docs/` — specs, handoff, cuestionarios al cliente, contenido
  confirmado del sitio, referencias visuales y prompts de diseño.

## Convenciones (las vigilan los tests)

- Registro **es-MX** ("pistaches", nunca "pistachos"); el personaje no se
  nombra "mono" en copy visible.
- Colores solo desde tokens; en SVG van como atributos de presentación.
- `prefers-reduced-motion` **apaga** todo movimiento, no lo atenúa; sin
  JavaScript la página se ve completa.
- Animación por **clases**, nunca buscando ids (los SVG inlineados
  duplican ids entre sí).
- Sin ecommerce: el sitio público es informativo.

## Deploy

`pnpm build` es la compuerta de publicación: construye con `build:sitio`
y recién después corre la suite y `astro check`. O sea que `dist/` se
escribe primero —el build en sí compiló—, pero si la verificación falla
el comando sale con código distinto de cero y Vercel no publica ese
`dist/`: queda en línea el último deploy bueno. El sitio resultante es 100%
estático: funciona en Vercel, Netlify o cualquier hosting estático sin
configuración extra. En Vercel el comando de build está fijado en
`vercel.json` (`buildCommand`), no delegado al preset del dashboard —
así la compuerta no se puede desarmar sin tocar el repo.
