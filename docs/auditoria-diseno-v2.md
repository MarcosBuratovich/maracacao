# Auditoría del rediseño (claude.ai/design) — antes de implementar

**2026-08-13.** Marcos diseñó el sitio nuevo en claude.ai/design (proyecto
`27808b87-aa0b-432c-abff-789622213973`, archivo `Sitio Maracacao.dc.html`).
La decisión es reemplazar el diseño editorial actual de `/sitio` por este.
Esta auditoría es el mapa de lo que hay que respetar, corregir y transferir.
Copia local decodificada del diseño: se re-baja con DesignSync
(`get_file`, mismo projectId) cuando haga falta.

## Qué es el diseño nuevo

**El empaque ES el sistema.** Todo sale de los 15 PDF de imprenta:

- **Tipografía:** Bricolage Grotesque 700/800 (titulares), Trocchi serif
  (cuerpo, nombres de sabor), Courier Prime (ingredientes/datos), Patrick
  Hand como sustituto de **Bryndan Write** (la mano real del impreso —
  pedir el TTF al diseñador para fidelidad total).
- **Color:** crema `#F8ECDE` (papel), cacao `#4C2C16` (tinta), rojo
  `#CB3C41` (acento = el rojo del personaje), amarillo ticket `#F4D261`,
  banda cálida `#F3E4CA`, banda clara `#FFF9EE`, y los 15 colores de sabor
  (idénticos a nuestro token `sabor` salvo dos con ±1 dígito — mandan los
  NUESTROS, medidos del arte).
- **Componentes de marca:** ArchTitle (arco letra a letra ±53°, calca el
  MARACACAO de las etiquetas), TicketPanel (PNG del ticket cosido),
  FlavorTag (chispas CSS + versales a .35em), Badge, Button (sombra dura
  `#7C2024`), Personaje.
- **Secciones:** portada con marquesina de barras a −3° · "¿Qué hay en una
  barra?" con toggle Sí lleva/No lleva · **el anaquel interactivo** (15
  barras, la banda toma el color del sabor elegido, ficha con ingredientes
  reales + ilustración) · polvo (banda oscura, "Próximamente") · cata en 6
  pasos · recetas en tarjetas de color con scroll-snap · nosotros · B2B con
  tabs · FAQ acordeón · contacto · footer rojo con arco y marquesina.
- **Interacción:** menú overlay con stagger, parallax suave (factores
  .045–.06), hovers de lift.

El anaquel es la pieza firma y está muy bien pensada: color como dato del
producto, ingredientes verdaderos por sabor, precio, ilustración.

## Lo que la implementación DEBE corregir

### 1. Contraste (medido, WCAG)

El diseño pone blanco fijo sobre el color del sabor elegido. Medido:

| Sobre el color de… | blanco | tinta cacao | veredicto |
|---|---|---|---|
| canela | **11.13** | 1.12 | blanco, AAA |
| sal de mar | **7.53** | 1.66 | blanco |
| cardamomo | **6.62** | 1.89 | blanco |
| fresas y chile | **6.36** | 1.96 | blanco |
| lima y chile | **6.26** | 2.00 | blanco |
| jengibre y naranja | **5.91** | 2.12 | blanco |
| mango / chamoy | **4.93** | 2.54 | blanco |
| piña con chile | 2.65 | **4.72** | tinta oscura |
| limoncillo | 1.89 | **6.62** | tinta oscura |
| menta intensa | 2.09 | **6.00** | tinta oscura |
| hierbabuena | **4.02** | 3.11 | ninguno pasa AA texto normal |
| coriandro | **3.74** | 3.34 | ninguno pasa AA texto normal |
| tamarindo | 2.79 | **4.48** | ninguno pasa AA texto normal |
| blanco-pistache | 3.05 | **4.10** | ninguno pasa AA texto normal |

**Solución:** token `tintaSabor` por sabor (blanca u oscura según tabla),
texto normal solo sobre superficies aprobadas (tarjeta blanca/crema), y en
los 4 sabores ambiguos el texto sobre el color va solo en tamaño display.
Test automático de pares como ya hacemos con `paresAprobados`.

Pares fijos a corregir: `--text-muted #8A6F5A` sobre crema = 4.01 (falla AA
en 13.5px → oscurecer a ~`#75593F`, validar) · rojo ticket sobre amarillo =
3.34 (→ `#7D0303` = 7.55 AAA) · amarillo sobre rojo del footer = 3.34 en
11.5px (→ blanco 4.93 o crema) · rojo `#CB3C41` sobre crema = 4.23 (ok
display, no para mono de 10–11.5px).

### 2. Copy (13 violaciones detectadas)

- **«El mono de la etiqueta»** (ficha del anaquel) — prohibido; va «El
  personaje de la etiqueta».
- **«Chispas» → «Gotas»** en todos lados (tarjeta, tab B2B, kickers y
  cuerpos de recetas). El cliente las llama gotas.
- **«Mini pack sorpresa» → «Paquete de seis minis»** (nombre del cliente,
  sin anglicismo).
- «snack» → «botana» · «smoothies» → «licuados» (es-MX).
- **«Te avisamos cuando esté a la venta»** — no existe canal de aviso;
  reemplazar por invitación a escribir al correo.
- «Mousse rápido» → «Mousse rápida» (copy original del cliente).
- «Licor de cacao — 70% de la barra» — impreciso: el 70% son TODOS los
  ingredientes del cacao (licor + manteca). Reformular.

### 3. Datos

- **% de cacao:** el diseño muestra 70% para las 15; las envolturas
  impresas dicen **73% en mango y piña**. Mantenemos lo impreso (la
  envoltura es la autoridad) hasta que el cliente resuelva el conflicto.
- **Nombres de sabor:** el diseño usa los de la ENVOLTURA («Jengibre y
  naranja», «Fresas y chile», «Hierbabuena», «Tamarindo con chile»); el
  catálogo y el sitio actual usan los del CATÁLOGO («Naranja con
  jengibre», «Fresas enchiladas», «Yerbabuena», «Tamarindo»). Decisión de
  Marcos (pregunta abierta).
- Gotas: «desde $258» esconde que naranja-jengibre vale $340 — mostrar
  precio por sabor o aclararlo.
- Colores de sabor: usar nuestros tokens exactos (`sabor` en color.ts).

### 4. Contenido que el diseño pierde (restaurar)

- **Las 4 recetas completas del cliente** (cantidades, pasos, tip) quedan
  en resúmenes de una línea → expandible «ver receta completa» por tarjeta
  (la estructura ya existía en las opciones descartadas 7a/7c).
- **8 etiquetas de polvo**, no 4 (tenemos las 8 en `public/sitio/`).
- FAQ: fusionar las 6 del diseño (prácticas, con la respuesta de alérgenos
  que ahora es dato real de envoltura) con las temáticas del sitio actual.
- El bloque suavizado de beneficios del cacao (tema elegido por el
  cliente; versión pasada por filtro COFEPRIS) desapareció — restaurar
  chico.
- «Nosotros» no tiene entrada en el menú overlay — agregarla.
- Skip link, `lang`, y las 3 fotos reales de producto (decidir dónde; la
  foto de minis es la única imagen del paquete de seis).

### 5. Accesibilidad (25 hallazgos, resumen)

Todo control es `<div onClick>` → botones/`<details>` nativos, radiogroup
para el anaquel, tabs con panel relacionado, menú overlay como diálogo con
foco (y `<nav>` real en HTML sin JS), focus-visible global, marquesinas y
parallax bajo `prefers-reduced-motion`, scrollers con teclado, landmarks +
`<main>`, alts saneados (marquesina decorativa `aria-hidden`), `<a>` en
lugar de `window.open`, `scroll-margin` en `#preguntas`.

## Transferencia de animaciones (lo nuestro que entra)

Del sitio actual: **cursor de sello** con tinta por sección y etiquetas ·
**CTAs magnéticos** (fusionados con la sombra dura del botón nuevo) ·
**revelado por IntersectionObserver** con stagger · titulares partidos en
líneas (para los H1/H2 grandes) · barra que adapta tinta por sección (más
rica que el swap binario del diseño) · **VisorProducto** (slot de Spline)
montado en la imagen de la ficha del anaquel · grano de papel al 4–5%
opcional. Reglas de siempre: `html.js` (nada oculto sin JS) y
reduced-motion APAGA.

Rescates de las opciones descartadas: botón «copiar correo» con
confirmación · tabla semáforo de datos B2B (disponible / en empaque / en
preparación) · cifras 15/6/8 como entrada rápida.

## Assets

De los 32 del proyecto de diseño solo el ticket bajó por API (668×280 con
alfa; el resto supera los 256 KiB del `get_file`):

- **15 renders de barra** (754×1620 RGBA) y **15 ilustraciones recortadas**
  (mayoría 650×1594) — o Marcos baja el ZIP del proyecto, o se reconstruyen
  de los PDF (extendiendo `scripts/extrae-envolturas.py`: recorte frontal +
  esquinas + sombra; ilustraciones por color-key sobre fondo plano).
- `chocolate-mexicano.png` (1363×410, wordmark blanco) — extraíble del PDF
  con `pdfimages` si no llega el ZIP.
- Etiquetas de polvo y personajes ya los tenemos en mejor calidad local.
- Todo se convierte a webp con tamaños responsivos al importar.

## Arquitectura de implementación

- Sistema nuevo en `src/styles/marca.css` + `src/scripts/marca.ts`;
  `editorial.css` queda para `/` (construcción) hasta decidir su restyling.
  `/presentacion` y `/manual` no se tocan (proyecto 1).
- Tokens: grupo `marca` en `color.ts` (crema, tinta, rojo, amarillo,
  bandas, textoSuave corregido) + mapa `tintaSabor` con test AA.
- Fuentes self-hosted (las 4 familias son OFL); `Base.astro` gana la
  variante `fuentes: 'marca'`.
- Datos de sabor generados desde `docs/envolturas.json` — cero strings
  duplicados.
- Componentes en `src/components/marca/`: ArcoTitulo, TicketPanel,
  EtiquetaSabor, Insignia, BotonMarca, AnaquelSabores, Marquesina,
  TarjetaReceta, TabsNegocios, MenuPrincipal (+ VisorProducto existente).
- Tests: los guardias de copy actuales (sin «mono», etc.) se quedan y van
  a atrapar regresiones; render tests y contraste se actualizan.

## Calendario

Hoy 13. La implementación completa son ~2–3 días de trabajo enfocado:
link al cliente ~16–17 · feedback hasta ~23–24 · incorporación y QA hasta
el 31. El plan anterior («mandar el viernes 15») queda reemplazado por
esto — la ventana de feedback se achica pero alcanza.
