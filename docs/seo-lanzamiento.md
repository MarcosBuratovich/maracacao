# SEO — cómo está armado y el switch de lanzamiento

Auditoría profunda 2026-08-19 (cuatro frentes: técnico, contenido,
rastreo, rendimiento). Este archivo guarda lo que hay que ejecutar el
día del lanzamiento y lo que solo puede hacer Marcos a mano.

## La arquitectura de hoy

- **Host canónico: `https://www.maracacao.mx`** (el apex hace 308 a www
  en Vercel). Vive en `site` de `astro.config.mjs`; `Base.astro` y los
  JSON-LD (`src/seo/esquema.ts`) salen de ahí.
- **candado ⇒ noindex.** `Base.astro` emite `noindex, nofollow` cuando
  la página lleva `candado`; `vercel.json` refuerza con `X-Robots-Tag`
  sobre /sitio, /presentacion y /manual. Solo la portada `/` se indexa
  hoy — es la semilla del dominio.
- **robots.txt** solo excluye `/api/`. NUNCA poner `Disallow` a las
  rutas con candado: si el crawler no puede leerlas, no ve su noindex y
  la URL puede indexarse «a ciegas» por enlaces externos.
- **Una sola forma de URL:** sin barra final (`trailingSlash: false` en
  Vercel + `'never'` en Astro).
- JSON-LD: LocalBusiness en `/`; LocalBusiness + FAQPage + ItemList de
  las 15 barras en `/sitio` (cero datos inventados; sin redes en sameAs
  hasta confirmar dónde vive @maracacaomx).
- Tarjeta social 1200×630 en `public/social/tarjeta.png`.
- `test/seo.test.ts` fija todo esto.

## El switch del lanzamiento (un solo deploy)

1. **Mover el contenido de `src/pages/sitio.astro` a la raíz**
   (`index.astro`): la home real debe vivir en `/`, no en un
   subdirectorio — las búsquedas de marca y los enlaces apuntan a la
   raíz. La página «en construcción» se retira.
2. **Redirect permanente `/sitio` → `/`** en `vercel.json` (rescata lo
   ya compartido). Quitar entonces `/sitio` de la cabecera X-Robots-Tag.
3. **Quitar el candado** de la página: el noindex cae solo (está atado
   al prop). /manual y /presentacion siguen con candado+noindex si
   siguen privadas.
4. El title/description de `marca` (categoría primero: «Chocolate
   mexicano 70% cacao en Coyoacán | Maracacao») pasan con el contenido
   a `/`; `ruta="/"`.
5. **Sitemap real:** `pnpm add @astrojs/sitemap`, integrarlo con filtro
   que excluya /manual y /presentacion, borrar `public/sitemap.xml` (el
   estático de hoy) y dejar que la integración genere
   `/sitemap-index.xml`; actualizar la línea `Sitemap:` de robots.txt.
6. **El mismo día en Search Console:** enviar el sitemap y pedir
   indexación de la home (Inspección de URL). El aviso «Página con
   redirección» para /sitio en las semanas siguientes es lo correcto.

## Solo lo puede hacer Marcos (hoy mejor que mañana)

- **Search Console:** crear la propiedad tipo *Dominio* «maracacao.mx»
  con verificación DNS TXT. Revisar `site:maracacao.mx` en Google; si
  alguna página con candado ya aparece, usar *Retirada temporal de
  URLs*.
- **Google Business Profile** del puesto en el Mercado de Coyoacán: es
  donde aterriza la búsqueda local real («chocolate coyoacán»).
- Confirmar en qué red vive @maracacaomx → sumarla al `sameAs` del
  JSON-LD y enlazarla en el footer.

## Páginas futuras que la auditoría dejó tituladas

Contenido ya existente que merece URL propia tras el lanzamiento (los
titles/descriptions propuestos están en el registro de la auditoría):
`/sabores` (long-tail: «chocolate con chamoy», «mango con chile»),
`/recetas` (Schema Recipe; estacional), `/aprende-de-chocolate` (el
glosario del manual; revisar COFEPRIS antes), `/para-cafeterias` (B2B;
solo cuando haya presentaciones confirmadas — sin prometer fichas).
