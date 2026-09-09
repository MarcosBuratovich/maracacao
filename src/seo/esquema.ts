// Datos estructurados JSON-LD (SEO, 2026-08-19). Regla dura del
// proyecto: CERO datos inventados — todo sale del copy real
// (sitio-marca.ts) y de la fuente única de producto (sabores.ts).
// Las redes van sin sameAs hasta confirmar en qué red vive
// @maracacaomx; el único perfil externo seguro es el catálogo.
import { marca } from '@/copy/sitio-marca'
import { sabores, urlCatalogoBarras } from '@/copy/sabores'

/**
 * Host canónico (www: el apex hace 308 a www en Vercel). `site` viene de
 * astro.config.mjs vía `Astro.site`; el respaldo en duro cubre los tests
 * de Container, que renderizan sin config.
 */
export function origenCanonico(site: URL | undefined): string {
  return (site?.href ?? 'https://www.maracacao.mx/').replace(/\/$/, '')
}

/** El puesto del Mercado de Coyoacán como negocio local. */
export function esquemaNegocio(origen: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: marca.marca.nombre,
    description: marca.descripcion,
    url: `${origen}/`,
    email: marca.contacto.correo,
    image: `${origen}/social/tarjeta.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Mercado de Coyoacán, Malintzin s/n, Col. del Carmen',
      addressLocality: 'Coyoacán',
      addressRegion: 'Ciudad de México',
      postalCode: '04100',
      addressCountry: 'MX',
    },
    sameAs: [marca.contacto.catalogoUrl],
  }
}

/** Las preguntas frecuentes reales de la sección #preguntas. */
export function esquemaPreguntas() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: marca.preguntas.items.map((item) => ({
      '@type': 'Question',
      name: item.p,
      acceptedAnswer: { '@type': 'Answer', text: item.r },
    })),
  }
}

/** Las quince barras como lista de productos, con su precio público. */
export function esquemaBarras(origen: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    // El nombre sale de la sección que existe (el anaquel de la home).
    // Hasta 2026-09-08 salía de catalogoBarras.encabezado, el encabezado
    // de /barras — una página fuera de ruta desde el 2026-08-17. El
    // kicker, no el título: "Elige tu barra" es un CTA, no un nombre de
    // lista — "LOS 15 SABORES" sí lo es, y es el mismo contenido real.
    name: marca.anaquel.kicker,
    numberOfItems: sabores.length,
    itemListElement: sabores.map((s) => ({
      '@type': 'ListItem',
      position: s.orden,
      item: {
        '@type': 'Product',
        name: `Barra ${s.nombre} · ${s.cacao}`,
        description: s.ingredientes,
        image: `${origen}/sitio/marca/barra-${s.slug}.webp`,
        brand: { '@type': 'Brand', name: marca.marca.nombre },
        offers: {
          '@type': 'Offer',
          price: s.precio,
          priceCurrency: 'MXN',
          url: s.catalogo ?? urlCatalogoBarras,
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  }
}
