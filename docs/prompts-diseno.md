# Prompts de diseño — Maracacao

Kit para generar assets del sitio en Claude, Seedream (imagen) y
Seedance (video). Regla número uno, decidida por Marcos el 2026-08-10:
**el único personaje es el changuito rojo del cliente** (el de los
empaques reales y las ilustraciones de referencia en
`docs/referencias/estilo-cliente/`). La mascota verde del proyecto de
identidad no se usa en el sitio.

Los prompts van en inglés porque los modelos de imagen responden mejor;
la explicación de cada uno, en español.

## Paleta medida (tokens `--mrc-empaque-*`)

Colores medidos de los empaques, etiquetas e ilustraciones reales
(`src/tokens/color.ts`, grupo `empaque`):

| Token | Hex | De dónde salió |
|---|---|---|
| rojoPersonaje | `#BD1608` | cuerpo del changuito (sombra `#A6271C`) |
| cremaPersonaje | `#FBD98A` | cara, panza, manos |
| morado | `#774A95` | envoltura jengibre y naranja |
| verdeHoja | `#376042` | mini lima y chile |
| menta | `#B2C0AD` | mini zacate limón |
| naranja | `#DA8843` | envoltura naranja |
| cafe | `#723D13` | etiqueta cocoa alcalina |
| amarilloEtiqueta | `#F3D87C` | recuadro de sabor de las etiquetas |
| rosaFondo | `#E5BFBF` | fondo de las fotos de producto |

El rojo de la envoltura mango-chile midió `#C66361` ≈ `rosa-500` del
sistema (`#C8665D`): ese ya existía. La re-derivación completa de la
paleta del sitio (rampas y pares de contraste con estos colores) es
parte de esta fase de diseño.

## Bloque de estilo (pegar al inicio de TODO prompt de imagen)

> Hand-drawn storybook illustration in the style of artisanal Mexican
> chocolate packaging: thick rounded dark-brown outlines, flat warm
> fills, subtle crosshatch/paper texture, plain white background.
> The character is a slender, playful red monkey (brick red #BD1608
> body, warm cream #FBD98A face, muzzle, belly, hands and feet, rosy
> cheeks, happy closed eyes, small smile, long tail ending in a spiral
> curl). Joyful, warm, naive. No gradients, no 3D, no drop shadows,
> no text, no watermark.

**Siempre adjuntar como referencia** una o dos imágenes de
`docs/referencias/estilo-cliente/` para fijar el personaje. Pedir
2048 px o más, fondo blanco limpio (se recorta fácil).

## Poses del personaje (una por prompt, después del bloque de estilo)

- **Saludo (hero):** "The monkey waves hello at the viewer with one arm
  up, the other holding a wrapped chocolate bar."
- **Antojo:** "The monkey takes a bite of a single chocolate square,
  eyes closed in delight, crumbs floating."
- **Cosecha:** "The monkey hangs from a cacao branch by its tail,
  picking a ripe cacao pod, green leaves around."
- **Chocolatero:** "The monkey pours cacao beans from a split cacao pod
  into a stone bowl labeled with a leaf motif." *(ya existe, referencia)*
- **Barista (sección negocios):** "The monkey in a tiny apron slides a
  steaming cup of hot chocolate across a wooden counter."
- **Cartero (contacto):** "The monkey holds an envelope sealed with a
  chocolate square."
- **Siesta (FAQ):** "The monkey naps on top of a giant chocolate bar,
  tail curled like a question mark."

## Ingredientes sueltos (estilo sticker, sin personaje)

Mismo bloque de estilo, sin el personaje:

> Single isolated [INGREDIENT] in the same hand-drawn style, thick
> dark-brown outline, flat fills, white background, sticker-like.

Lista para el sitio (una imagen por ingrediente): cacao pod whole and
split · scattered cacao beans · cinnamon sticks · fresh mint sprig ·
lemongrass blades · dried chile · mango slices · orange slice · sea
salt crystals · tamarind pod · strawberry · pineapple wedge · cardamom
pods · peppermint leaves. (Cubren los 15 sabores reales del catálogo.)

## Escenas por sección del sitio

- **Inicio:** personaje en pose de saludo + taza con espuma (la taza ya
  existe como SVG animado propio).
- **Nuestros productos:** cada sabor con su mini-escena, como en los
  empaques reales: el personaje interactuando con el ingrediente
  (malabares de mangos, surfeando una ola de naranja…). Fondo del
  recuadro en el color de la envoltura de ese sabor (tabla de arriba).
- **ABC del chocolate:** ingredientes sticker + "the monkey as a tiny
  teacher pointing at a floating cacao pod diagram".
- **Recetas:** los videos (abajo).
- **Quiénes somos:** "the monkey and a human pair of hands working
  together at a wooden table with cacao beans and a molinillo" (sin
  caras humanas: el cliente no quiere fotos de personas).
- **Cafeterías y negocios:** pose barista.

## Video (Seedance) — loops de 6 a 8 segundos

> Seamless loop animation of the reference illustration, subtle
> movement only, white background, no camera movement, no text.

- **Molinillo:** ya existe (`public/sitio/changuito-molinillo.mp4`).
- **Taza:** "steam gently rising from the hot chocolate cup, foam
  bubbles slowly shifting, the swirl rotating very slowly."
- **Saludo:** "the monkey waves, tail swaying softly, a few cacao beans
  bouncing."
- **Granos:** "cacao beans falling in a gentle stream into the bowl,
  looping."

## Fotografía de producto (para cuando hagan fotos nuevas)

Mantener la dirección de arte que ya usan: fondo rosa polvo `#E5BFBF` o
blanco cálido, luz suave de día, la barra al centro y el ingrediente
real del sabor esparcido alrededor (naranjas, mangos, chiles). Sin
props ajenos a la marca.

## Reglas duras (van en todos los prompts)

1. Solo el changuito rojo — nunca otro personaje ni la mascota verde.
2. Sin texto dentro de la imagen (el lettering lo pone el sistema).
3. Sin degradados, sin 3D, sin sombras proyectadas.
4. Fondo blanco (ilustración) o rosa polvo (foto).
5. Los colores de la tabla de arriba, no inventados.
