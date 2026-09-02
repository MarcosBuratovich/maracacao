# SEO — cómo está armado y qué queda a mano

Auditoría profunda 2026-08-19 (cuatro frentes: técnico, contenido,
rastreo, rendimiento) y **lanzamiento 2026-08-20**: la landing vive en
`/`, pública e indexable. Este archivo guarda cómo quedó y lo que solo
puede hacer Marcos a mano.

## La arquitectura

- **Host canónico: `https://www.maracacao.mx`** (el apex hace 308 a www
  en Vercel; `maracacao.vercel.app` hace 301 a www desde `vercel.json`).
  Vive en `site` de `astro.config.mjs`; `Base.astro`, los JSON-LD
  (`src/seo/esquema.ts`) y el sitemap salen de ahí.
- **La home es `src/pages/index.astro`** (hasta el lanzamiento fue
  `/sitio` con candado). `/sitio` hace **301 → `/`** en `vercel.json`
  con `source` exacto: los assets siguen viviendo bajo `/sitio/…` y no
  deben redirigir.
- **candado ⇒ noindex.** `Base.astro` emite `noindex, nofollow` cuando
  la página lleva `candado`; `vercel.json` refuerza con `X-Robots-Tag`
  sobre `/presentacion` y `/manual` (lo único privado hoy). Ojo: esa
  cabecera tapaba también las imágenes bajo `/sitio/` cuando el patrón
  incluía `sitio`; ya no.
- **robots.txt** solo excluye `/api/`. NUNCA poner `Disallow` a las
  rutas con candado: si el crawler no puede leerlas, no ve su noindex y
  la URL puede indexarse «a ciegas» por enlaces externos.
- **Sitemap:** lo escribe `src/seo/sitemap.ts` en el build
  (`/sitemap.xml`) a partir de las páginas generadas, sin las privadas
  ni el 404 y con la raíz con su barra, igual que el canonical
  (@astrojs/sitemap la recortaba por `trailingSlash: 'never'`). Páginas
  nuevas entran solas; `robots.txt` apunta ahí.
- **Una sola forma de URL:** sin barra final (`trailingSlash: false` en
  Vercel + `'never'` en Astro).
- JSON-LD en la home: LocalBusiness + FAQPage + ItemList de las 15
  barras (cero datos inventados; sin redes en `sameAs` hasta confirmar
  dónde vive @maracacaomx).
- Tarjeta social 1200×630 en `public/social/tarjeta.png`; favicon svg +
  ico + apple-touch-icon.
- `test/seo.test.ts` fija todo esto.

## Solo lo puede hacer Marcos (hoy mejor que mañana)

- **Search Console:** crear la propiedad tipo *Dominio* «maracacao.mx»
  con verificación DNS TXT. Enviar `https://www.maracacao.mx/sitemap.xml`
  y pedir indexación de la home (Inspección de URL). Revisar
  `site:maracacao.mx`; si alguna página con candado apareciera, *Retirada
  temporal de URLs*. El aviso «Página con redirección» para `/sitio` en
  las semanas siguientes es lo correcto.
- **Resend en Vercel:** `RESEND_API_KEY` (+ `CONTACTO_REMITENTE` con un
  dominio verificado). Sin eso, `/api/contacto` responde 503 y el
  formulario cae al mailto del visitante — funciona, pero abre su app de
  correo con el aviso.
- **Google Business Profile** del puesto en el Mercado de Coyoacán: es
  donde aterriza la búsqueda local real («chocolate coyoacán»).
- Confirmar en qué red vive @maracacaomx → sumarla al `sameAs` del
  JSON-LD y enlazarla en el footer.

## Páginas futuras que la auditoría dejó tituladas

La primera ya existe: **`/fichas-tecnicas`** (2026-09-02) — las cuatro
fichas oficiales legibles en la página, con PDF descargable (los PDF van
noindex: la página HTML es la cara indexable). Entra sola al sitemap.

Contenido ya existente que merece URL propia (los titles/descriptions
propuestos están en el registro de la auditoría): `/sabores`
(long-tail: «chocolate con chamoy», «mango con chile»), `/recetas`
(Schema Recipe; estacional), `/aprende-de-chocolate` (el glosario del
manual; revisar COFEPRIS antes), `/para-cafeterias` (B2B; solo cuando
haya presentaciones confirmadas — sin prometer fichas). No hay página de
productos: la venta vive en el catálogo en línea (pulpos) y la home
enlaza ahí.
