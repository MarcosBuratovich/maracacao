# Identidad Maracacao — Diseño

**Fecha:** 2026-08-03
**Estado:** aprobado, listo para plan de implementación
**Proyecto 1 de 2.** La landing animada es el proyecto 2 y tendrá su propio spec.

---

## 1. Contexto

Maracacao es una marca de chocolate mexicano que **ya existe**. No hay acceso a los archivos fuente del packaging ni al envoltorio físico. Todo el material de partida son dos imágenes:

- **Foto del envoltorio** — 900×1600 px, JPEG progresivo de 130 kB. Desenfocada, en perspectiva, con la cartulina curvada y los colores lavados por la iluminación.
- **Render limpio generado con Gemini** — 1536×2730 px, derivado de esa foto. Mucho más legible, pero cambió la tipografía y algunos detalles del dibujo.

Como no hay archivos originales ni packaging físico, la reconstrucción es **interpretativa**: la paleta y las proporciones finales son decisiones de diseño nuestras, no mediciones del impreso. Este documento lo dice explícitamente para que nadie asuma lo contrario más adelante.

## 2. Por qué no se vectoriza automáticamente

Se evaluó el trazado automático (potrace, vtracer, Image Trace, vectorizer.ai) sobre la foto y se descartó con evidencia:

- **No hay separación cromática.** Al cuantizar la zona de la mascota a 9 colores, 7 resultaron el mismo oliva (`#94957D`, `#92927A`, `#8E9179`, `#8D8E76`, `#878670`, `#888B74`, `#8C9078`, todos a menos de 5 puntos entre sí). En la foto, el verde del cuerpo del mono y el verde del fondo **son el mismo color**. Ningún tracer puede separar lo que la cámara ya fusionó.
- **Resolución insuficiente.** La mascota ocupa ~430×510 px reales.
- **Foco blando.** Los bordes son degradados de 3-5 px, no filos: el tracer los convierte en contornos temblorosos.
- **Geometría deformada.** La cartulina está curvada y en perspectiva; el arco del logotipo y el círculo compositivo están distorsionados.
- **Ruido.** Textura de papel mate más artefactos JPEG producen cientos de paths basura.
- **Estructura inservible.** Aun con un trazado perfecto, el resultado es una sopa de paths anónimos con los contornos como formas rellenas. Para animar hacen falta capas nombradas, pivotes y trazos como `stroke`.

**¿Y por qué no trazar automáticamente el render de Gemini, que sí está limpio?** Porque resuelve solo uno de los seis problemas. El render tiene trazos de pincel digital con grosor variable y bordes blandos, rellenos con textura y moteado tonal, y ninguna separación entre partes. Un trazado suyo daría paths más prolijos pero igual de inservibles: contornos como formas rellenas, sin nombres, sin pivotes, sin geometría oculta. Y arrastraría a la marca la textura pictórica que el packaging original no tiene.

**Decisión: redibujo vectorial a mano**, usando ambas imágenes como referencia.

## 3. Regla de referencias

Vinculante. Sin esto, el PNG de Gemini termina tratado como arte oficial.

| Fuente | Autoridad sobre |
|---|---|
| **Foto del packaging** | Proporciones, tipografía, composición, qué elementos existen |
| **Render de Gemini** | Legibilidad — resuelve el "no se entiende qué hay ahí" de la foto |
| **Ninguna de las dos** | Es el objetivo final |

El objetivo es **plano, de trazo parejo y geometría regularizada**. Ni la textura de papel de la foto, ni el pincel digital de Gemini.

**Lo que Gemini cambió respecto del original, y no se adopta:** rellenos con textura de pincel y moteado tonal; trazos de grosor variable con bordes blandos; bowl más grande con vetas de madera y sombreado; cabeza más ancha, panza más grande, cola más gruesa con otra curva; chispas, suelo y ondas con otra forma y cantidad.

**Lo que Gemini cambió y es un error a revertir:** la tipografía. El original usa una **sans redonda hecha a mano**, monolinear, con terminales redondeados de marcador. Gemini la reemplazó por una **serif de alto contraste** tipo Didone. Son universos opuestos: el original dice artesanal y cercano, el de Gemini dice editorial y formal.

Más grave que el cambio en sí: **el packaging original tenía un contraste tipográfico deliberado** — sans dibujada a mano para la marca (`MARACACAO`, `CHOCOLATE MEXICANO`) y serif para el descriptor de sabor (`Chocolate blanco y pistaches`). Esa tensión es parte de la identidad. Gemini puso serif en todo y la aplanó. **El sistema tipográfico de la sección 7 restaura esa lógica.**

## 4. Alcance

### Dentro

- Reconstrucción vectorial de la mascota como SVG por capas — fiel y limpio
- Versión reducida del personaje para tamaños chicos
- Lettering custom de `MARACACAO` y `CHOCOLATE MEXICANO` como paths, calcado del original
- Sistema de logo: seis variantes y reglas de uso
- Paleta cromática con rampas y roles semánticos
- Pairing tipográfico con fuentes libres, self-hosteadas
- Design tokens en código como fuente única de verdad
- Styleguide web navegable en Astro
- SVG riggeado, rig spec para Rive, código de integración y fallback CSS
- Personalidad de marca y principios de animación

### Afuera

- La landing (proyecto 2)
- El archivo `.riv` — lo produce el usuario en el editor de Rive
- Rediseño de packaging y aplicaciones impresas
- E-commerce, fotografía de producto
- Tono de voz y copy de marca

## 5. Decisiones tomadas

| Decisión | Elegido | Nota |
|---|---|---|
| Origen de la marca | Existe, sin archivos fuente | Reconstrucción interpretativa |
| Referencia disponible | Solo las dos imágenes | Sin packaging físico |
| Fidelidad del redibujo | Fiel y limpio, más versión reducida | Geometría regularizada |
| Formato del entregable | Styleguide web viva con tokens | El manual *es* el código |
| Stack | Astro + islas React + Tailwind | Salida estática, casi cero JS |
| Tipografías | Solo libres (SIL OFL), self-hosteadas | Sin dependencia de CDN |
| Enfoque de animación | **Rig en Rive** | Contra la recomendación inicial; ver §11 |
| Quién riggea | El usuario, en el editor de Rive | Sin API ni CLI para generar `.riv` |
| Base cromática | **C — bandas alternadas** | Crema y verde por secciones |
| Pairing tipográfico | **Fraunces + Work Sans** | |
| Header del sitio | **Cabeza + logotipo + descriptor** | |
| Idioma | **Español de México (`es-MX`)** | Más idiomas se evalúan después; ver §10.6 |

## 6. Sistema cromático

### 6.1 El problema de origen

Los colores medidos del render son **todos tonos medios** y no alcanzan para una interfaz. Contraste WCAG de las combinaciones más obvias:

| Par | Ratio | Veredicto |
|---|---|---|
| `#5B744B` sobre crema `#F4E8C6` | 4.25 | Falla para texto normal |
| Tan `#F8B465` sobre verde `#5B744B` | 2.89 | Falla fuerte |

**Regla derivada: los colores de la ilustración se quedan en la ilustración.** Para texto e interfaz se usan los pasos oscuros de las rampas.

### 6.2 Rampas

**Verde** — base `500` es el color medido del render.

| Paso | Hex | | Paso | Hex |
|---|---|---|---|---|
| 50 | `#F2F4F1` | | 500 | `#5B744B` |
| 100 | `#E1E6DF` | | 600 | `#4B5F3E` |
| 200 | `#C4CDBE` | | 700 | `#3A4A30` |
| 300 | `#A3B19A` | | 800 | `#2A3522` |
| 400 | `#7F9373` | | 900 | `#1B2316` |

**Tan** — solo ilustración y superficies decorativas, nunca texto sobre verde.

| Paso | Hex | | Paso | Hex |
|---|---|---|---|---|
| 50 | `#FEF9F3` | | 500 | `#F8B465` |
| 100 | `#FEF2E3` | | 600 | `#CB9453` |
| 200 | `#FCE4C8` | | 700 | `#9F7341` |
| 300 | `#FBD5A9` | | 800 | `#72532E` |
| 400 | `#FAC487` | | 900 | `#4A361E` |

**Rosa** — base `500` medida del render en los cachetes y la boca de la mascota. Se agregó al sistema durante la Task 7: el original tiene cachetes y lengua rosas, la paleta cerrada no tenía ningún rosa, y sin él la lengua queda crema y se lee como un diente.

| Paso | Hex | | Paso | Hex |
|---|---|---|---|---|
| 50 | `#FBF3F2` | | 500 | `#C8665D` |
| 100 | `#F5E3E2` | | 600 | `#A4544C` |
| 200 | `#EBC8C5` | | 700 | `#80413C` |
| 300 | `#E0A9A4` | | 800 | `#5C2F2B` |
| 400 | `#D48881` | | 900 | `#3C1F1C` |

Usos previstos: `rosa-300` para el rubor de los cachetes y para la lengua, `rosa-700` para texto sobre banda clara (6.92, AA). **`rosa-500` sobre papel da 3.44 y no sirve para texto normal** — misma disciplina que el resto de las rampas.

**Colores fijos**

| Nombre | Hex | Uso |
|---|---|---|
| `papel` | `#FAF3E0` | Fondo de banda clara |
| `crema` | `#F4E8C6` | Superficie cálida, texto sobre verde |
| `tinta` | `#372915` | Contorno de la ilustración y texto cuerpo |
| `bordo` | `#8B4D3F` | Acento, bowl |
| `amarillo` | `#ECC677` | Etiquetas, botones, destacados |
| `suelo` | `#E3BC87` | Isla de la ilustración |

### 6.3 Pares aprobados (contraste verificado)

| Uso | Combinación | Ratio | |
|---|---|---|---|
| Texto cuerpo sobre banda clara | `tinta` / `papel` | 12.72 | AAA |
| Títulos sobre banda clara | `verde-700` / `papel` | 8.61 | AAA |
| Texto secundario sobre banda clara | `verde-600` / `papel` | 6.31 | AA |
| Texto sobre banda verde | `papel` / `verde-700` | 8.61 | AAA |
| Texto crema sobre banda verde | `crema` / `verde-700` | 7.81 | AAA |
| Texto sobre banda verde profunda | `papel` / `verde-800` | 11.63 | AAA |
| Botón amarillo | `tinta` / `amarillo` | 8.66 | AAA |
| Botón bordó | `papel` / `bordo` | 5.87 | AA |
| Acento sobre banda clara | `bordo` / `papel` | 5.87 | AA |

**Prohibidos:** `crema` sobre `verde-500` (4.25) y `tan-500` sobre `verde-500` (2.89).

### 6.4 Estructura de bandas

El sitio alterna secciones de fondo `papel` y fondo `verde-700`, evocando las caras del packaging. La mascota cambia de tono al cruzar bandas — un input de la state machine (`banda`) lo controla.

El **ritmo** de alternancia se define al diseñar la landing. No es una decisión de marca.

## 7. Sistema tipográfico

El logotipo `MARACACAO` va **dibujado a mano como vectores** y no depende de ninguna fuente. Lo que sigue es para todo lo demás.

| Rol | Fuente | Licencia |
|---|---|---|
| Display — títulos, nombres de sabor | **Fraunces** (variable) | SIL OFL |
| Texto — cuerpo, UI, etiquetas | **Work Sans** | SIL OFL |

**Por qué este pairing y no una redonda para títulos:** el packaging tiene una regla — *la sans dibujada a mano es la voz de la marca, todo lo tipografiado es serif*. Poner otra redonda hecha a mano en los títulos duplicaría esa voz y el logotipo dejaría de ser lo único dibujado. Fraunces mantiene la regla original.

**Por qué Fraunces en particular:** es variable y expone dos ejes fuera de lo común — `SOFT` (redondea terminales) y `WONK` (introduce asimetrías de letra dibujada). Eso convierte *"juguetona y profesional"* en un dial en vez de un punto fijo, y ese dial **se puede animar**. Valor de partida: `SOFT 60, WONK 1`.

Ambas se self-hostean como woff2, subset latino, con `font-display: swap` y preload.

## 8. Sistema de logo

Siete piezas, todas derivadas del mismo dibujo vectorial.

| # | Pieza | Uso |
|---|---|---|
| 1 | Sello completo — arco + mascota + descriptor | Packaging, piezas grandes, hero |
| 2 | Sello reducido — arco + mascota | Cuando el descriptor sobra |
| 3 | Logotipo recto | Firma, pie de página, legales |
| 4 | Isotipo suelto — la cabeza | Ilustración de apoyo, stickers |
| 5 | Sello circular — cabeza en círculo | Favicon, avatar de redes, botón |
| 6 | Monocromo positivo y negativo | Grabado, sellos, una tinta |
| 7 | Lockup de header — cabeza + logotipo + descriptor | Header del sitio, mail, membrete |

**La pieza 7 es la que más se ve:** está en todas las páginas, todo el tiempo. Combina **cabeza + logotipo recto + descriptor `CHOCOLATE MEXICANO`** en Fraunces con tracking abierto. Mantiene vivo el contraste dibujado/serif del packaging y dice qué se vende sin scrollear.

Va aparte de la 1 y la 2 porque el arco del sello es impracticable en una barra de 64 px de alto: obliga a achicar el texto o a comerse medio viewport.

*Riesgo conocido, asumido:* en mobile este lockup se apelmaza y el descriptor a ~10 px es decorativo más que informativo. **Mitigación:** por debajo de 640 px el descriptor se oculta y queda cabeza + logotipo.

**La pieza 5 es la que más trabajo de diseño necesita.** A 32 px la cara actual se convierte en una mancha: hay que simplificarla de verdad — menos líneas, más contraste, cero detalle interno. Es la "versión reducida" del alcance.

## 9. Estructura del SVG de la mascota

### 9.1 Reglas de construcción

1. **El trazo va como `stroke`, no como contorno relleno.** Es la regla más importante. Un contorno dibujado como forma rellena no permite cambiar grosor, no escala parejo y no se puede animar. Con `stroke` + `stroke-linecap="round"` + `stroke-linejoin="round"` se reproduce el trazo de marcador y queda animable.
2. **Cada parte animable es un `<g>` cerrado**, con id y pivote anatómico real — el hombro, la base de la cola, el tobillo. No el centro del bounding box.
3. **La jerarquía es el esqueleto.** Mover `#cabeza` mueve ojos, boca y orejas gratis.
4. **Sin `<use>` ni `<defs>` compartidos entre partes animables** — Rive los aplana de forma impredecible. Los granos son copias reales.
5. **Fills planos.** Sin gradientes ni filtros. El original es plano y encarecen el render.
6. **Geometría oculta dibujada.** Lo que hoy tapa el brazo tiene que estar igual dibujado, o al rotarlo aparece un agujero.
7. **Numeración con padding:** `grano-01`, no `grano-1`.

### 9.2 Jerarquía

```
maracacao-mascota.svg          viewBox="0 0 1024 1024"
│
├── g#escena
│   ├── g#suelo                    isla + ondas del piso
│   ├── g#granos-orbita            granos flotantes 01..14, pivote propio c/u
│   │
│   └── g#mono
│       ├── g#cola                 pivote: cadera
│       ├── g#pierna-post
│       │   └── g#pie-post         pivote: tobillo
│       ├── g#cuerpo               torso + panza
│       ├── g#pierna-apoyo         pivote: cadera
│       │   └── g#pie-apoyo        pivote: tobillo
│       ├── g#brazo-l              pivote: hombro
│       ├── g#bowl
│       │   ├── g#bowl-cuenco
│       │   ├── g#bowl-contenido
│       │   └── g#bowl-borde
│       ├── g#brazo-r              pivote: hombro
│       │   └── g#mano-r           pivote: muñeca — la que sostiene el bowl
│       ├── g#cabeza               pivote: base del cuello
│       │   ├── g#oreja-l · g#oreja-r     pivote: unión al cráneo
│       │   ├── g#craneo · g#rostro
│       │   ├── g#ojo-l · g#ojo-r         pivote: centro del ojo
│       │   ├── g#cachete-l · g#cachete-r
│       │   ├── g#nariz
│       │   └── g#boca ── path#boca-forma + path#lengua
│       ├── g#mano-l               pivote: muñeca — pintada después de la cabeza para que el pistache llegue a la boca; en Rive se emparenta al hueso del brazo izquierdo
│       └── g#chispas              las tres rayitas naranjas del "¡mmm!"
│
└── g#pivotes                      marcadores, ver 9.3
```

El z-order exacto de piernas y brazos se cierra durante el redibujo, contra la referencia. **Cerrado en la Task 8:** se eliminó `g#brazo-post` — la referencia tiene dos brazos y ambos son visibles; el tercero era un fantasma del borrador — y `g#mano-l` pasó a pintarse después de la cabeza, porque en el packaging la mano va por delante de la cara al comer y la animación `Come` (§11.3) lo requiere.

### 9.3 La capa `g#pivotes`

SVG no tiene forma de declarar un pivote que Rive lea. Rive asigna el origen de cada objeto en su editor y por defecto lo pone en el centro del bounding box, que para un brazo está mal.

Solución: una capa con círculos de 4 px nombrados (`piv-hombro-l`, `piv-cola`, `piv-tobillo-r`…) en cada punto de pivote. Al riggear se alinea cada origen contra su marcador y después se borra la capa entera.

## 10. Arquitectura del repo

```
maracacao/
├── src/
│   ├── assets/brand/          # SVG maestros — fuente de verdad del dibujo
│   │   ├── mascota.svg
│   │   ├── mascota-reducida.svg
│   │   ├── logotipo.svg
│   │   ├── logotipo-arco.svg
│   │   ├── descriptor.svg
│   │   └── lockups/
│   ├── tokens/
│   │   ├── color.ts
│   │   ├── type.ts
│   │   └── motion.ts
│   ├── styles/global.css      # @theme de Tailwind, generado desde tokens
│   ├── components/
│   │   ├── brand/             # Logo.astro, Mascota.astro, MascotaRive.tsx
│   │   └── ui/
│   ├── content/manual/        # páginas del manual en MDX
│   └── pages/
├── public/fonts/              # Fraunces + Work Sans (woff2)
├── public/brand/mono.riv      # producido por el usuario en Rive
└── astro.config.mjs
```

**Decisiones y sus motivos:**

1. **Los tokens viven en TypeScript, no en CSS.** Un `.ts` exporta los objetos y de ahí se generan las variables CSS que consume Tailwind. Los tokens tienen que leerse desde JS —para animaciones y para pasar valores al runtime de Rive— *y* desde CSS. Si viven solo en CSS, el código de animación los duplica y se desincronizan.
2. **La styleguide es el sitio, no un anexo.** La portada del manual es `index.astro`; la landing se agrega después como otra ruta. Por eso el manual no se desactualiza: si se rompe un token, se rompe la página que lo documenta.
3. **Un componente por variante de logo**, no uno con quince props. Cada uno inyecta su SVG **inline** —no como `<img>`— para poder animarlo y que herede `currentColor`.
4. **Fuentes self-hosteadas.** Sin `<link>` a Google en producción: privacidad, velocidad, y que la identidad no dependa de un CDN ajeno.
5. **Dos capas de animación** con regla clara de cuál usar: **CSS keyframes y transiciones** para lo ambiental y para la UI, **Rive** para el personaje. `prefers-reduced-motion` las apaga desde un solo lugar. No se instala ninguna librería de animación de entrada — si más adelante aparece una interacción que necesite física de springs de verdad, se evalúa Motion entonces y se justifica el peso.

### 10.6 Idioma y preparación para i18n

El sitio es **español de México**: `<html lang="es-MX">`, y `Intl` con locale `es-MX` para fechas, números y pesos.

**No se implementa i18n ahora.** Pero se van a sumar idiomas, y hay tres reglas que no cuestan nada hoy y evitan una reescritura después:

1. **Ningún string visible se escribe dentro de un componente.** Todo el texto de cara al usuario vive en `src/content/` (MDX) o en un módulo de copy. Un componente recibe texto, no lo contiene.
2. **Las rutas nacen bajo un segmento de idioma implícito.** La estructura de `src/pages/` se arma de modo que agregar `[lang]/` después sea mover archivos, no reescribir enlaces. Los enlaces internos pasan por un helper, nunca son strings crudos.
3. **Nada de texto dentro de los SVG de marca.** El lettering de `MARACACAO` y `CHOCOLATE MEXICANO` son paths, no `<text>` — lo cual ya era la regla por otro motivo, pero acá suma: el logotipo no se traduce nunca.

**Vocabulario:** el español de México no es intercambiable con el rioplatense ni con el peninsular, y el packaging ya lo demuestra — dice **"pistaches"**, no "pistachos". Ese registro manda sobre cualquier corrección de estilo genérica.

## 11. Rig de Rive e integración

### 11.1 Restricción reconocida

Se eligió Rive sobre la recomendación inicial (SVG + CSS/Motion). La objeción registrada: el `.riv` es un binario propietario que no se versiona útilmente en git, no se puede revisar en un PR y ata el proyecto a una herramienta externa.

**Restricción dura:** Rive se opera desde su editor gráfico y no existe API ni CLI para generar un `.riv`. Ese archivo lo produce el usuario. El SVG por capas es exactamente el input que Rive necesita para importar, así que **no se pierde trabajo**.

### 11.2 Entregables para el rigger

- `mascota.svg` con la jerarquía de §9.2
- La capa `g#pivotes` con marcadores nombrados
- `docs/rig-spec.md` con pivotes y coordenadas en el viewBox, inputs, estados y transiciones

### 11.3 State machine `MonoSM`

| Input | Tipo | Disparador |
|---|---|---|
| `hover` | Boolean | El cursor entra en la mascota |
| `scrollY` | Number 0..1 | Progreso de scroll normalizado |
| `celebrar` | Trigger | Agregado al carrito, form enviado |
| `banda` | Number 0/1 | Sobre `papel` o sobre `verde-700` |

| Estado | Comportamiento |
|---|---|
| `Idle` | Respiración (torso 1.00→1.02, 3.2 s), parpadeo cada 4-7 s con jitter, cola ±6° a 4 s, granos en órbita lenta |
| `Saluda` | Al entrar `hover`: cabeza gira 8°, brazo libre levanta, ojos se abren |
| `Come` | Mano a la boca, mastica dos veces. Auto-disparo cada ~12 s dentro de `Idle` |
| `Celebra` | Salta, los granos del bowl se dispersan, las chispas destellan |

Es una propuesta de partida: si al riggear resulta excesiva, se podan estados. El mínimo viable es `Idle` + `Saluda`.

### 11.4 Integración

- Isla React con `@rive-app/react-canvas`, montada con `client:visible`
- El componente `<Mascota/>` renderiza **por defecto el SVG estático con animación CSS ambiental**; la isla lo reemplaza sólo cuando el `.riv` terminó de cargar
- Si Rive falla o tarda, la página no se entera
- Con `prefers-reduced-motion` la isla no monta

El fallback CSS no es un plan B: es lo que ve quien tiene reduced-motion o conexión mala, así que hace falta igual.

**Presupuesto:** runtime de Rive canvas ~90 kB gzip; el `.riv` debería quedar bajo 60 kB. Se mide contra el fallback antes de darlo por bueno.

## 12. Principios de animación

**Personalidad:** goloso · ágil · orgulloso · hecho a mano · mexicano sin folklore.

1. **Nada se mueve en línea recta.** Todo describe un arco.
2. **Anticipación siempre:** antes de subir, baja un poco.
3. **Peso:** cola y orejas llegan tarde, 80-120 ms de retardo respecto del cuerpo.
4. **Nunca más de dos cosas moviéndose a la vez** fuera del idle.
5. **El easing por defecto es un spring suave**, no `ease-in-out`.
6. **Duraciones:** micro 120-200 ms · gestos 300-500 ms · ambientales 3-5 s.
7. **`prefers-reduced-motion` apaga, no atenúa.**

## 13. Criterios de aceptación

1. **El SVG importa limpio a Rive:** los grupos aparecen con los nombres de §9.2, en esa jerarquía, sin reorganizar nada.
2. **Prueba del brazo:** rotar `#brazo-l` veinte grados no produce ningún agujero. Si aparece, faltó geometría oculta.
3. **El logo se lee a 32 px y a tres metros.**
4. **Cambiar un color en `tokens/color.ts` lo cambia en toda la styleguide** sin tocar nada más.
5. **Todos los pares de texto de la interfaz cumplen 4.5:1**, verificado con los valores de §6.3.
6. **La styleguide corre en local** y muestra los tokens reales del código, no valores copiados.
7. **Alguien externo puede leer el manual y aplicar la marca** sin preguntar nada.
8. **Con `prefers-reduced-motion` activo**, la página no monta la isla de Rive y no corre ninguna animación ambiental.

## 14. Riesgos y supuestos

| Riesgo / supuesto | Impacto | Mitigación |
|---|---|---|
| La paleta no está medida del impreso | Los colores de marca podrían no coincidir con el packaging real | Documentado como decisión de diseño. Si aparece el envoltorio físico, se recalibran las rampas sin tocar la estructura |
| Las proporciones salen de una foto borrosa | El redibujo es interpretativo | La foto manda sobre Gemini; se revisa contra ambas |
| No se identificó la fuente original del wordmark | El lettering es una aproximación | Se dibuja a mano calcando; no depende de identificarla |
| El `.riv` depende de una persona externa al código | La landing podría quedar bloqueada esperándolo | El fallback CSS shippea igual y la integración está preparada para swappear |
| Se van a sumar idiomas más adelante | Retrofitear i18n sobre strings incrustados en componentes es caro | Las tres reglas de §10.6 se aplican desde el primer commit. No se construye i18n, solo se evita bloquearla |

## 15. Próximo paso

Plan de implementación vía la skill `writing-plans`. La landing animada arranca después, con su propio ciclo de spec → plan → implementación, consumiendo los tokens y componentes de este proyecto.
