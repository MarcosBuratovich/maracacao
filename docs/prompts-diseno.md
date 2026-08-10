# Prompts de diseño — Maracacao

Dos juegos de prompts, para dos herramientas distintas:

- **Parte A — Secciones de la página (Claude design).** Maquetas de cada
  sección con varias posibilidades de composición. En español: Claude lo
  entiende perfecto y así los editas fácil.
- **Parte B — Assets e ilustración (Seedream / Seedance).** Imágenes y
  video del personaje e ingredientes. En inglés porque los modelos de
  imagen responden mejor. Esto NO va en Claude design.

En los dos casos: **adjunta las referencias** de
`docs/referencias/estilo-cliente/` (el changuito) y, si iteras sobre lo
que ya existe, capturas del borrador en `/sitio`.

---

# Parte A — Secciones de la página (Claude design)

Cada prompt es autocontenido: trae el sistema de diseño, el contenido
real y lo que debe lograr. Pega uno por conversación y pide ajustes ahí
mismo. Todos piden **3 propuestas distintas** — composiciones diferentes,
no variaciones del mismo layout.

## A1 · Encabezado + Inicio (hero)

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña el encabezado y la sección de inicio de una landing informativa (sin tienda).

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677; colores de empaque disponibles: morado #774A95, rojo #C66361, verde hoja #376042, menta #B2C0AD, naranja #DA8843. El personaje es el changuito rojo ilustrado que te adjunto (único personaje permitido). Tono es-MX cálido y directo, frases cortas. Mobile-first, contraste AA mínimo, sin degradados ni sombras 3D.

Contenido real: logotipo MARACACAO (lettering a mano, arriba); título "Chocolate mexicano, de verdad"; bajada "Solo cacao, esencias naturales y azúcar de caña. Sin químicos, saborizantes ni aditivos."; botones "Ver los sabores" y "Ir al catálogo"; menú: Productos, ABC del chocolate, Recetas, Quiénes somos, Negocios, FAQ, Contacto.

Debe lograr: marca y antojo en 3 segundos, y que se entienda que es informativa (el catálogo de compra es un enlace externo).

Dame 3 propuestas visualmente distintas de esta sección (por ejemplo: protagonismo del personaje vs. tipografía gigante vs. producto al frente — pero decide tú), cada una con una línea que explique su idea.
```

## A2 · Nuestros productos

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección "Nuestros productos" de una landing informativa (sin tienda, sin precios).

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677; cada sabor puede usar su color de envoltura: morado #774A95, rojo #C66361, verde hoja #376042, menta #B2C0AD, naranja #DA8843. Tono es-MX cálido y directo. Mobile-first, contraste AA, sin degradados ni sombras 3D.

Contenido real — 15 barras de 70 g: Naranja con jengibre, Chamoy, Mango con chile, Chocolate blanco con pistache, Sal de mar, Limoncillo, Tamarindo, Lima y chile, Cardamomo, Canela, Menta intensa, Fresas enchiladas, Piña con chile, Coriandro, Yerbabuena. Además: paquete de 6 minis de 10 g, y bolsas de 250 g. Botón "Ver el catálogo completo" (enlace externo).

Debe lograr: que 15 sabores se sientan como una fiesta ordenada, no como una lista abrumadora; cada sabor reconocible por su color.

Dame 3 propuestas visualmente distintas de organizar esta sección (composiciones diferentes, no el mismo grid con otro espaciado), cada una con una línea que explique su idea.
```

## A3 · El ABC del chocolate

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección educativa "El ABC del chocolate" de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677. Ilustraciones sticker de ingredientes disponibles (mazorca, granos, canela, menta…). Tono es-MX cálido y directo, didáctico sin ponerse técnico. Mobile-first, contraste AA.

Contenido (títulos reales; los textos vienen en camino, usa 2-3 líneas de relleno marcadas como borrador): "¿Qué dice el porcentaje?", "Cómo catar un chocolate", "Cómo guardarlo", "Por qué sin saborizantes ni aditivos", "El proceso del grano a la barra".

Debe lograr: que dé ganas de leer una sección educativa — bocados cortos, no un artículo largo.

Dame 3 propuestas visualmente distintas (por ejemplo: tarjetas coleccionables vs. recorrido paso a paso del grano a la barra vs. preguntas grandes tipo póster — pero decide tú), cada una con una línea que explique su idea.
```

## A4 · Recetas

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección "Recetas" de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677. Hay un video corto en loop del changuito batiendo chocolate con molinillo (adjunto la imagen fija). Tono es-MX cálido y directo. Mobile-first, contraste AA.

Contenido: de 3 a 5 recetas con foto (los textos reales vienen en camino: usa títulos de relleno como "Chocolate de mesa con canela" marcados como borrador). La sección habla a dos públicos: cocina de casa y cafeterías/repostería.

Debe lograr: que el video del personaje tenga un lugar protagónico sin robarse la receta, y que las recetas se vean hacederas.

Dame 3 propuestas visualmente distintas de esta sección, cada una con una línea que explique su idea.
```

## A5 · Quiénes somos

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección "Quiénes somos" de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677. Regla dura: SIN fotos de personas — solo el changuito rojo ilustrado (adjunto) y, si acaso, manos trabajando ilustradas. Tono es-MX cálido y directo. Mobile-first, contraste AA.

Contenido real (palabras del cliente): "Maracacao es una marca mexicana de chocolates y polvos elaborados con cacao y productos naturales. Busca regresar al sabor auténtico del cacao, con mezclas de sabores tradicionales, para consumidores y para cafeterías y negocios que valoran el chocolate mexicano auténtico." La historia de cómo empezó y el origen del cacao vienen en camino (deja el espacio marcado como borrador).

Debe lograr: cercanía y confianza sin caras — que la ilustración y la tipografía carguen la calidez.

Dame 3 propuestas visualmente distintas, cada una con una línea que explique su idea.
```

## A6 · Para cafeterías y negocios

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección "Para cafeterías y negocios" (B2B) de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30 (también existe una banda crema #F4E8C6 para destacar); títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677. Tono es-MX directo, un punto más profesional que el resto de la página sin perder calidez. Mobile-first, contraste AA.

Contenido real: venden a cafeterías, panaderías y repostería; hay fichas técnicas por producto (se piden por correo); botón "Pedir fichas técnicas" (mailto). Pedido mínimo y condiciones vienen en camino (borrador).

Debe lograr: que un dueño de cafetería sienta que esto es para él en 5 segundos, sin que la sección se vea corporativa ni fría.

Dame 3 propuestas visualmente distintas, cada una con una línea que explique su idea.
```

## A7 · Preguntas frecuentes

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección "Preguntas frecuentes" de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677. Puede aparecer el changuito en pose de siesta (adjunto referencias). Tono es-MX cálido y directo. Mobile-first, contraste AA, accesible con teclado si hay interacción.

Contenido: entre 5 y 8 preguntas (las reales vienen en camino; usa de relleno "¿Hacen envíos?", "¿Dónde los encuentro?", "¿Qué azúcar usan?", "¿El chocolate aguanta el calor del envío?" marcadas como borrador).

Debe lograr: respuestas escaneables en segundos, sin que la sección se sienta de soporte técnico.

Dame 3 propuestas visualmente distintas (acordeón, dos columnas, preguntas como fichas… decide tú), cada una con una línea que explique su idea.
```

## A8 · Contacto + pie de página

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña la sección de contacto y el pie de página de una landing informativa.

Sistema de diseño obligatorio: bandas de color plenas — esta sección vive en el verde más profundo #2A3522 con texto papel #FAF3E0; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos amarillo #ECC677 y crema #F4E8C6. Tono es-MX cálido y directo. Mobile-first, contraste AA.

Contenido real: correo chocolateriadulceolivia@gmail.com; enlace "Catálogo en línea" (externo); WhatsApp, redes y punto de venta vienen en camino (deja los espacios marcados como borrador). Pie: logotipo MARACACAO + "Chocolate mexicano".

Debe lograr: un cierre cálido con una sola acción clara (escribirles), no un formulario burocrático.

Dame 3 propuestas visualmente distintas, cada una con una línea que explique su idea.
```

## A9 · La página completa (para amarrar todo)

```
Eres el diseñador web de Maracacao, marca mexicana de chocolate artesanal. Diseña el recorrido COMPLETO de una landing informativa de una sola página, a nivel de composición general (no detalles finos): qué banda usa cada sección, qué ritmo visual llevan y cómo se pasa de una a otra.

Sistema de diseño obligatorio: bandas de color plenas alternando papel crema #FAF3E0 y verde profundo #3A4A30, con crema #F4E8C6 y verde #2A3522 como bandas especiales; títulos en serif cálida estilo Fraunces, texto en sans estilo Work Sans; acentos bordó #8B4D3F y amarillo #ECC677; colores de empaque por sabor: morado #774A95, rojo #C66361, verde hoja #376042, menta #B2C0AD, naranja #DA8843. Personaje: solo el changuito rojo (adjunto). Sin tienda, sin precios.

Secciones en este orden: Inicio · Nuestros productos (15 sabores) · El ABC del chocolate · Recetas (con video del personaje) · Quiénes somos (sin fotos de personas) · Para cafeterías y negocios · Preguntas frecuentes · Contacto.

Debe lograr: que el scroll se sienta como un recorrido con ritmo (bandas que alternan como las caras de un empaque) y no como secciones apiladas.

Dame 2 propuestas de recorrido completo con miniaturas de cada sección, cada una con una línea que explique su lógica de ritmo.
```

---

# Parte B — Assets e ilustración (Seedream / Seedance — NO Claude design)

Prompts en inglés, autocontenidos. Adjuntar siempre una referencia del
changuito. Paleta para estos prompts: rojo personaje `#BD1608` · crema
personaje `#FBD98A` · morado `#774A95` · verde hoja `#376042` · menta
`#B2C0AD` · naranja `#DA8843` · café `#723D13` · amarillo etiqueta
`#F3D87C` · rosa fondo `#E5BFBF` · rojo mango-chile `#C66361`.

## B1 · Poses del personaje (imagen)

### B1.1 Saludo — para el inicio

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) waves hello at the viewer with one arm raised high, holding a wrapped chocolate bar in the other hand. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.2 Antojo — mordida de chocolate

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) takes a delighted bite out of a single dark chocolate square held with both hands, tiny chocolate crumbs floating around its head. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.3 Cosecha — colgado de la rama

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) hangs upside down from a cacao branch by its spiral tail, reaching for a ripe orange-brown cacao pod, a few deep-green cacao leaves (#376042) around the branch. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.4 Barista — para cafeterías y negocios

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) wears a tiny apron and proudly slides a steaming ceramic cup of hot chocolate forward across a simple wooden counter. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.5 Maestro — para el ABC del chocolate

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) stands like a tiny teacher pointing with a thin wooden stick at a floating split cacao pod showing its beans inside. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.6 Siesta — para preguntas frecuentes

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile) naps peacefully lying on top of a giant chocolate bar, its long tail curled into the shape of a question mark above its head. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

### B1.7 Cartero — para contacto

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) happily holds out a cream envelope sealed with a small square of dark chocolate. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. Joyful, warm, naive. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Square format, high resolution.
```

## B2 · Ingredientes sueltos (sticker, sin personaje)

### B2.1 Mazorca de cacao (general)

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: one whole cacao pod and one split cacao pod showing cream-colored beans inside, with three loose cacao beans scattered beside them. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.2 Naranja con jengibre

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a juicy orange slice next to a knobby fresh ginger root with one small cut piece. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.3 Chamoy

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: dried apricots with red chile flakes sprinkled around them and one dried chile on the side. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.4 Mango con chile

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: fresh mango slices next to one whole mango and a small dried red chile with a few chile flakes. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.5 Pistache (chocolate blanco)

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: shelled and unshelled pistachios, one shell half-open showing the green nut. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.6 Sal de mar

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a small heap of chunky sea salt crystals with a few crystals scattered apart. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.7 Limoncillo (zacate limón)

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: fresh lemongrass blades tied in a small loose bundle. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.8 Tamarindo

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: tamarind pods, one whole and one cracked open showing the sticky pulp and seeds. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.9 Lima y chile

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a bright lime cut in half next to a whole lime and one small red chile. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.10 Cardamomo

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: green cardamom pods, one split open showing the dark seeds. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.11 Canela

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: two crossed cinnamon sticks with visible spiral ends and a small pinch of ground cinnamon beside them. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.12 Menta / yerbabuena

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a fresh mint sprig with rounded serrated leaves and two loose leaves beside it. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.13 Fresas enchiladas

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: ripe strawberries, one cut in half, with red chile flakes sprinkled over them. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.14 Piña con chile

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a pineapple wedge with skin and leafy crown fragment, chile flakes sprinkled on the fruit. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

### B2.15 Coriandro

```
Hand-drawn sticker-style illustration in the style of artisanal Mexican chocolate packaging: a small heap of round coriander seeds with a fresh coriander leaf sprig. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no characters. Square format, high resolution.
```

## B3 · Escenas por sabor (fondo del color de la envoltura)

### B3.1 Mango con chile (fondo #C66361)

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) joyfully juggles a whole mango overhead while hugging another mango, mango slices floating around it. Flat solid background color #C66361, the character and props keep their thick rounded dark-brown outlines and flat warm fills with subtle crosshatch paper texture. No gradients, no 3D rendering, no drop shadows, no text, no watermark, no other characters. Vertical 3:4 format, high resolution.
```

### B3.2 Naranja con jengibre (fondo #774A95)

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) dances in a ring with orange slices and knobby ginger roots floating around it like confetti. Flat solid background color #774A95, the character and props keep their thick rounded dark-brown outlines and flat warm fills with subtle crosshatch paper texture. No gradients, no 3D rendering, no drop shadows, no text, no watermark. Vertical 3:4 format, high resolution.
```

## B4 · Quiénes somos (manos sin cara)

```
Hand-drawn storybook illustration in the style of artisanal Mexican chocolate packaging. A slender, playful red monkey (brick-red #BD1608 body; warm cream #FBD98A face, muzzle, belly, hands and feet; rosy cheeks; happy closed eyes; small smile; long tail ending in a spiral curl) works side by side with a pair of human hands at a simple wooden table: the hands stir melted chocolate in a clay bowl with a wooden molinillo whisk while the monkey sorts cacao beans into a small basket, cacao pods and green leaves (#376042) at the edge of the table. Only the human hands and forearms are visible, never a face or body. Thick rounded dark-brown outlines, flat warm fills, subtle crosshatch paper texture, plain white background. No gradients, no 3D rendering, no drop shadows, no text, no watermark. Landscape 4:3 format, high resolution.
```

## B5 · Video (Seedance) — adjuntar la imagen fija

### B5.1 La taza humeante (loop)

```
Seamless 8 second loop animation of the attached illustration. Only subtle movement: steam wisps rise slowly from the hot chocolate cup and fade out, foam bubbles drift and gently pulse, the chocolate swirl rotates very slowly. Everything else stays perfectly still. Plain white background, no camera movement, no zoom, no text, hand-drawn storybook style preserved exactly.
```

### B5.2 El saludo (loop)

```
Seamless 8 second loop animation of the attached illustration. Only subtle movement: the red monkey waves its raised arm slowly side to side, its spiral tail sways softly, it blinks once. Everything else stays perfectly still. Plain white background, no camera movement, no zoom, no text, hand-drawn storybook style preserved exactly.
```

### B5.3 Los granos cayendo (loop)

```
Seamless 8 second loop animation of the attached illustration. Only subtle movement: cacao beans fall in a gentle continuous stream from the split pod into the bowl, one bean bounces off the rim, a faint puff of cocoa dust. The monkey's tail sways slightly. Everything else stays perfectly still. Plain white background, no camera movement, no zoom, no text, hand-drawn storybook style preserved exactly.
```

## B6 · Fotografía de producto

```
Product photography, artisanal Mexican chocolate brand: one wrapped chocolate bar standing upright at center on a flat dusty-pink background (#E5BFBF), soft natural daylight from the left, the flavor's real ingredients (fruit, spices) casually scattered around the base, shallow depth of field, warm and appetizing, no props unrelated to the brand, no text overlays, no hands.
```
