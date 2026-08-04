# Rig spec — mascota de Maracacao

> GENERADO por `pnpm rig-spec` desde `jerarquia.ts` y `mascota.svg`.
> No editar a mano: se regenera y se pierde. Si algo de acá está desactualizado,
> el arreglo va en `src/assets/brand/jerarquia.ts` o en `mascota.svg`, nunca en este archivo.

Este documento es para quien abre Rive por primera vez con `mascota.svg` al lado y no
estuvo en ninguna conversación sobre este proyecto. No hace falta más contexto que este
archivo y el SVG.

## Antes de re-emparentar nada: el caso especial de `#mano-l`

**`#mano-l` es el único grupo de todo el árbol cuyo padre en el SVG no es su padre en el
esqueleto de Rive.** Si te salteás este aviso y armás el rig tomando la sección
«Jerarquía» de abajo al pie de la letra, el brazo izquierdo va a moverse sin la mano —
la mano se queda flotando en el lugar donde estaba, porque quedó emparentada a la raíz
del mono en lugar de al brazo.

Por qué el SVG la dibuja así: en `mascota.svg`, `#mano-l` cuelga de `#mono` y se pinta
**después** de `#cabeza`. Eso es a propósito — SVG no tiene z-index, así que el único
modo de que el pistache que sostiene la mano quede por delante de la cara (y no
desaparezca detrás del cráneo) es dibujar la mano más tarde en el documento. La sección
«Jerarquía» de este documento es literalmente ese orden de dibujo, así que reporta a
`#mano-l` colgando de `#mono`, igual que el propio `mascota.svg` y que
`src/assets/brand/jerarquia.ts` (los tres tienen el mismo comentario sobre esto; este
documento es la tercera pata, no una fuente nueva).

**Lo que tenés que hacer en Rive:** después de importar, re-emparentá (reparent) el
objeto `#mano-l` al hueso/bone de `#brazo-l`, para que mover el brazo mueva la mano con
él. El pivote de `#mano-l` (la muñeca) ya está medido para calzar con el casquete distal
de `#brazo-l`, así que una vez re-emparentada la unión debería quedar limpia sin
retocar geometría.

## Cómo usar este documento

1. Importá `src/assets/brand/mascota.svg` en Rive (arrastralo al editor o usá su import
   de archivo). Los grupos entran con los mismos ids que ves en las tablas de abajo.
2. Para cada fila de **Pivotes**, movés el origen del objeto — el punto desde el que
   rota, no el centro de su bounding box — a la coordenada indicada. Rive lo pone por
   defecto en el centro del bounding box, que para un miembro está mal: un brazo que
   rota desde la mitad de su propio largo no gira desde el hombro.
3. Armá los huesos siguiendo la sección **Jerarquía** de más abajo, **con la única
   excepción de `#mano-l`**, que se re-emparenta a `#brazo-l` como se explicó arriba.
4. Cuando terminaste de alinear todo, **se borra la capa `#pivotes` entera.** Es guía de
   importación, no parte del dibujo final — si queda, se exporta un círculo marrón de
   4 px flotando en cada articulación.

Las coordenadas están en el sistema del viewBox `0 0 1024 1024`. Si Rive reescala el
artboard al importar, aplicá el mismo factor de escala a estos números antes de tipearlos.

## Pivotes

| Grupo | Punto anatómico | Coordenada |
|---|---|---|
| `#cola` | cadera | `540, 574` |
| `#pierna-post` | cadera | `468, 556` |
| `#pie-post` | tobillo | `410, 707` |
| `#pierna-apoyo` | cadera | `556, 556` |
| `#pie-apoyo` | tobillo | `551, 872` |
| `#brazo-l` | hombro | `476, 268` |
| `#mano-l` | muñeca | `360, 276` **← ver «Antes de re-emparentar nada» arriba** |
| `#brazo-r` | hombro | `548, 268` |
| `#mano-r` | muñeca | `612, 510` |
| `#cabeza` | base del cuello | `512, 287.19` |
| `#oreja-l` | unión al cráneo | `400.87, 132.75` |
| `#oreja-r` | unión al cráneo | `623.13, 132.75` |
| `#ojo-l` | centro del ojo | `468.68, 155.35` |
| `#ojo-r` | centro del ojo | `555.32, 155.35` |

## Jerarquía

El orden es el de pintado: primero es más atrás. **Esto es el orden de dibujo, no el
árbol de huesos** — coinciden en todos los grupos salvo uno, marcado abajo.

- `#escena`
- `#suelo` — dentro de `#escena`
- `#granos-orbita` — dentro de `#escena`
- `#mono` — dentro de `#escena`
- `#cola` — dentro de `#mono`
- `#pierna-post` — dentro de `#mono`
- `#pie-post` — dentro de `#pierna-post`
- `#cuerpo` — dentro de `#mono`
- `#pierna-apoyo` — dentro de `#mono`
- `#pie-apoyo` — dentro de `#pierna-apoyo`
- `#brazo-l` — dentro de `#mono`
- `#bowl` — dentro de `#mono`
- `#bowl-cuenco` — dentro de `#bowl`
- `#bowl-contenido` — dentro de `#bowl`
- `#bowl-borde` — dentro de `#bowl`
- `#brazo-r` — dentro de `#mono`
- `#mano-r` — dentro de `#brazo-r`
- `#cabeza` — dentro de `#mono`
- `#oreja-l` — dentro de `#cabeza`
- `#oreja-r` — dentro de `#cabeza`
- `#craneo` — dentro de `#cabeza`
- `#rostro` — dentro de `#cabeza`
- `#ojo-l` — dentro de `#cabeza`
- `#ojo-r` — dentro de `#cabeza`
- `#cachete-l` — dentro de `#cabeza`
- `#cachete-r` — dentro de `#cabeza`
- `#nariz` — dentro de `#cabeza`
- `#boca` — dentro de `#cabeza`
- `#mano-l` — dentro de `#mono` en el SVG (orden de pintado). **En Rive va emparentada al hueso de `#brazo-l`, no a `#mono`.** **← ver «Antes de re-emparentar nada» arriba**
- `#chispas` — dentro de `#mono`
- `#pivotes`

## State machine `MonoSM`

El código del sitio (`src/components/brand/MascotaRive.tsx`) referencia la state
machine por este nombre exacto — puede parecer un detalle menor, pero si el `.riv`
exportado usa otro nombre (o mayúsculas distintas), la isla simplemente no encuentra
la state machine y el sitio se queda mostrando el SVG estático de siempre en su lugar
(nunca revienta: ver «Integración con el sitio» más abajo).

### Inputs

| Input | Tipo | Disparador |
|---|---|---|
| `hover` | Boolean | El cursor entra en la mascota |
| `scrollY` | Number 0..1 | Progreso de scroll normalizado |
| `celebrar` | Trigger | Agregado al carrito, form enviado |
| `banda` | Number 0/1 | Sobre `papel` o sobre `verde-700` |

### Estados

| Estado | Comportamiento |
|---|---|
| `Idle` | Respiración (torso 1.00→1.02, 3.2 s), parpadeo cada 4-7 s con jitter, cola ±6° a 4 s, granos en órbita lenta |
| `Saluda` | Al entrar `hover`: cabeza gira 8°, brazo libre levanta, ojos se abren |
| `Come` | Mano a la boca, mastica dos veces. Auto-disparo cada ~12 s dentro de `Idle` |
| `Celebra` | Salta, los granos del bowl se dispersan, las chispas destellan |

El mínimo viable es `Idle` + `Saluda`. Si el resto resulta excesivo al riggear, se poda
— nadie va a pedir los cuatro estados si dos alcanzan para que la mascota se sienta viva.

## Principios de movimiento

Personalidad de referencia: goloso · ágil · orgulloso · hecho a mano · mexicano sin
folklore. Si una pose o un timing no encaja con esos cinco adjetivos, probablemente no
es la pose correcta aunque sea técnicamente prolija.

1. Nada se mueve en línea recta. Todo describe un arco.
2. Anticipación siempre: antes de subir, baja un poco.
3. Peso: cola y orejas llegan tarde, 80-120 ms respecto del cuerpo.
4. Nunca más de dos cosas moviéndose a la vez fuera del idle.
5. Easing por defecto: spring suave, no `ease-in-out`.
6. Duraciones: micro 120-200 ms · gestos 300-500 ms · ambientales 3-5 s.

## Presupuesto

El `.riv` tiene que quedar **bajo 60 kB**. El runtime de Rive canvas pesa ~90 kB gzip
aparte, y ese número no lo movés vos — lo único que controlás con el archivo es que la
animación en sí no infle el total. Medí el peso final contra el fallback CSS antes de
darlo por bueno: si el `.riv` termina pesando más que la diferencia de experiencia que
aporta, no vale la pena.

## Integración con el sitio

No hace falta tocar código para riggear, pero esto ubica dónde termina tu trabajo:

- El archivo exportado se llama **`mono.riv`** y va en `public/brand/mono.riv`.
- Mientras ese archivo no exista (o falle al cargar, o tarde), el sitio no se entera:
  sigue mostrando `mascota.svg` estático con una animación ambiental en CSS puro
  (respiración, parpadeo, vaivén de cola). Podés iterar y exportar versiones parciales
  sin miedo a dejar el sitio roto en ningún momento.
- Con `prefers-reduced-motion` activo, el sitio directamente no monta el rig — nadie ve
  el `.riv` corriendo en ese caso, así que no hace falta diseñar una versión "reducida"
  de la animación.
