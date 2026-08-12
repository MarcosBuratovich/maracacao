# Imágenes de producto: qué se puede hacer sin el producto

**2026-08-12.** Problema real: no tenemos las barras en la mano, el
cliente tarda en mandar material, y de lo que sí se vende hoy —barras y
gotas— no hay un catálogo con buenas imágenes. Lo que sigue está probado,
no propuesto.

## Sí se puede reconstruir el arte desde una foto

Probado de punta a punta con la barra de mango con chile. El proceso
está guionado en `scripts/envoltura-a-packshot.py`:

1. **Rectificar.** La cara impresa de la envoltura se mapea a un
   rectángulo (transformación QUAD): se va la perspectiva y queda el arte
   plano. Funciona incluso con la barra girada 35°, comprobado con la de
   naranja y jengibre.
2. **Aplanar la luz.** La iluminación del estudio es la componente de
   baja frecuencia de la imagen: se divide el píxel por ella y se
   reescala al promedio. El fondo pasó de variar entre `#BA524F` y
   `#D79F83` a quedar parejo.
3. **Montar el packshot.** Sobre la textura plana se reconstruye el
   volumen: sombreado cilíndrico, crimpado de foil, esquinas redondeadas
   y alfa. Sale un PNG recortado, del mismo tamaño para todos los
   sabores.

Resultado: **470 × 992 px de imagen de producto limpia**, hecha sin tener
el producto y sin molestar al cliente. Ya están generadas las de mango
con chile y naranja y jengibre, en `public/sitio/packshot/`.

## Y también dónde está el límite

| Fuente | Resolución | Envoltura utilizable |
|---|---|---|
| Fotos de estudio (WhatsApp) | 1027–1349 px | ~460 × 900 · **alcanza** |
| Fotos del catálogo (16) | 360–560 px | ~200 × 400 · **no alcanza** |
| Etiquetas de polvo (arte digital) | 832 × 1600 | perfecta, pero es la línea que aún no sale |

Para una imagen de producto en web hacen falta unos 460 × 900 (el doble
de 230 × 450). Las fotos del catálogo dan menos de la mitad: menos de un
cuarto de la superficie. No hay upscaler que invente el lettering que no
está.

**Traducción:** hoy podemos producir imágenes de alta fidelidad de **2
barras y el paquete de minis**. De los otros 13 sabores, no.

## Lo que hay que pedirle al cliente (y es chico)

El error sería pedirle "las fotos de todo". Hay que pedirle **una** de
estas dos cosas, en este orden:

**Opción A — el archivo de arte de las envolturas.** Un PDF o AI del
diseñador, con el dieline. Es un solo correo y desbloquea todo: color
exacto, packshots perfectos, 3D e imprenta. Es la pieza más valiosa que
falta en el proyecto y ya la pedimos en el audit de color.

**Opción B — veinte minutos con su teléfono.** Si el arte no aparece,
esto lo puede hacer cualquiera hoy mismo. El texto para mandarle, tal
cual:

> Necesito una foto de cada barra, así de simple:
> 1. Apoyá la barra sobre una hoja blanca, cerca de una ventana, sin sol
>    directo.
> 2. Ponete justo arriba, con el teléfono paralelo a la barra —que se vea
>    como un rectángulo, no como un trapecio.
> 3. Que la barra ocupe casi toda la foto.
> 4. Una foto por sabor. Sin decoración, sin fondos, sin filtros.
>
> No hace falta que quede linda: de esas fotos saco las imágenes finales.

Eso son quince fotos mecánicas, no una producción. Es la diferencia entre
un pedido que un cliente lento puede cumplir y uno que se posterga.

## Un desbalance que conviene arreglar mientras tanto

Hoy la sección más vistosa del sitio es la de **chocolate en polvo**
—ocho etiquetas a todo color— y es justo la línea que todavía no se
vende. Las barras y las gotas, que son lo que hay en el mostrador, están
con las peores imágenes.

Con los packshots nuevos eso se puede dar vuelta: barras y gotas al
frente con imagen de verdad, y el polvo más chico y marcado como lo que
es. El material manda el orden, y hoy el material está al revés.
