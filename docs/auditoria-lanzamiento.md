# Auditoría de lanzamiento — 2026-08-20

La landing salió en vivo en `https://www.maracacao.mx/` este día. Antes
del deploy se revisó la página construida (`dist`) con un navegador real
en once tamaños de ventana, modos de accesibilidad, sin JS, con las
interacciones ejercitadas y Lighthouse. Este archivo deja el registro de
qué se miró, qué se encontró y qué se corrigió.

## Cómo se auditó

- **Capturas y métricas por viewport** (Playwright + Chrome): 320×568,
  360×800, 390×844, 430×932, 844×390 (teléfono apaisado), 768×1024,
  1024×768, 1280×800, 1440×900, 1920×1080 y 2560×1440. En cada uno:
  desborde horizontal, elementos fuera de la ventana, imágenes rotas o
  sin `width/height`, objetivos táctiles < 24px, texto < 12px, texto
  recortado, jerarquía de encabezados, fuentes cargadas y consola.
- **Recorrido real con scroll** (no captura de página completa, que
  falsea los revelados por IntersectionObserver) en 390, 1280, 1440 y
  2560, armado en hojas de contacto.
- **Modos:** `prefers-reduced-motion`, `prefers-color-scheme: dark`, sin
  JavaScript.
- **Interacciones:** anaquel (clic y flechas del teclado, con vuelta al
  inicio), pestañas, acordeón de preguntas, recetas (`<details>`),
  «Copiar correo» (portapapeles), formulario con respaldo a mailto,
  menú (abrir, navegar a una sección, cerrar con Esc), skip link, 404.
- **Lighthouse** móvil y desktop sobre `dist` servido en local.

## Lo que se encontró y se corrigió

| Hallazgo | Dónde | Corrección |
|---|---|---|
| El titular del hero partía «70% CACAO.» en dos líneas entre 1000 y 1400px (todas las laptops). Causa raíz: `.portada-fila` (un `.contenedor` con `margin-inline: auto`) dentro de `.portada` (flex column) no se estiraba y medía su contenido. | Hero, desktop | `width: 100%` en `.portada-fila`. |
| A 320px las tres pestañas de «¿Con qué trabajas?» empujaban la página de lado (16px de scroll horizontal). | Negocios, móvil chico | Menos padding y cuerpo 14px en pestañas ≤360px. |
| El correo del footer se partía «maracacaomx@gmail.co / m» (`overflow-wrap: anywhere` en columna angosta), en móvil y en desktop. | Footer | `<wbr>` tras la arroba: parte en «maracacaomx@ / gmail.com». |
| Enlaces del footer de 19px de alto y radios del formulario de 20px (objetivo táctil mínimo 24px). | Footer, formulario | `padding-block` en enlaces y radios, mismo ritmo visual. |
| «Gotas de chocolate · 250 / g» con la unidad huérfana al partir línea. | Anaquel, negocios, footer | Espacio duro entre cifra y unidad en el copy. |
| El sitemap de `@astrojs/sitemap` escribía la raíz sin barra (`…mx`), distinta del canonical (`…mx/`). | SEO | Integración propia `src/seo/sitemap.ts` (sin dependencia). |
| El personaje del menú (60KB) se descargaba en el primer pintado aunque el menú esté cerrado: el overlay `fixed` interseca la ventana y el `lazy` no lo frena. | Rendimiento móvil | Sin caja hasta abrir el menú (`display: none` con JS y menú cerrado). |
| El LCP móvil es una barra de la marquesina del hero y llevaba `fetchpriority="low"`. | Rendimiento móvil | Las primeras cuatro barras van en prioridad alta; el resto baja. Variante de 300px en `srcset`. |
| Tres hojas de estilo bloqueaban el render (~720ms simulados en móvil). | Rendimiento | CSS inline en el HTML (`inlineStylesheets: 'always'`; ~17KB gz). |
| CLS 0.035 en desktop: `html.js` la ponía el módulo diferido y el menú se pintaba un instante como fila estática. | Rendimiento | `<script is:inline>` al inicio del body. |
| `aria-label="Maracacao"` en el lockup contradecía su texto visible (label-content-name-mismatch). | Accesibilidad | Fuera el aria-label; el texto visible nombra el enlace. |
| Imágenes de `public/` sin caché en Vercel (`max-age=0`): 60+ revalidaciones por visita. | Rendimiento | `Cache-Control` en `vercel.json`: fuentes 1 año inmutables; imágenes 1 día + `stale-while-revalidate` 1 semana. |
| Personajes `webp` casi sin comprimir (86KB y 78KB). | Peso | Recomprimidos a q80 (60KB y 58KB), sin diferencia visible. |

## Lo que se revisó y está bien

- Sin desborde horizontal en ningún ancho (320 a 2560). Cero imágenes
  rotas; todas con `width/height`. Un solo `h1`; jerarquía h2/h3/h4
  coherente. Cero errores de consola.
- Sin JS: las quince fichas del anaquel se ven apiladas, el menú es una
  lista estática, todo el contenido está.
- `prefers-reduced-motion`: sin marquesinas ni revelados; todo visible.
- Modo oscuro: la paleta es explícita, nada se invierte.
- Foco visible en campos (borde rojo) y el skip link aparece al primer
  Tab. Menú cierra con Esc y devuelve el foco.
- La 404 responde 404 de verdad con diseño de marca.
- Texto pequeño: las etiquetas mono (10–11.5px) son secundarias y se
  leen en pantalla real; el descriptor del lockup (9px) es parte del
  logotipo. No se tocaron a propósito.

## Lighthouse final (dist servido en local)

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|---|
| Móvil (Moto G, 4G lenta simulada) | 91 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

Móvil: LCP 3.2s (la barra de la marquesina), CLS 0, TBT 120ms.
Desktop: LCP 0.6s, CLS 0. Lo que Lighthouse sigue marcando en móvil es
el peso de las ilustraciones de ficha (100KB c/u, arte con textura que
no comprime) y las ocho etiquetas de polvo que su emulación precarga;
ambos fuera del primer pantallazo.

## Pendiente que no es del sitio

Ver `docs/seo-lanzamiento.md`: Search Console (propiedad de dominio +
enviar `sitemap.xml`), Resend en Vercel (sin eso el formulario cae a
mailto), Google Business Profile y la red de @maracacaomx.
