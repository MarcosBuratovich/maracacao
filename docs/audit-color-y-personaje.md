# Audit: el color y el personaje en el sitio

**2026-08-12.** Disparado por la retro de Marcos: "al pasar a lo
profesional ahora falta color… el changuito parece pegado, fuera de
foco". Todo lo de acá está medido sobre el sitio construido, no
estimado.

## 1. Evidencia

**El 40% del sitio no tiene un solo píxel de color.** De 11.876 px de
alto, 4.779 son secciones sin ninguna superficie con color:

| Sección | Alto | Superficie con color |
|---|---:|---:|
| Hero | 900 | 56% |
| Manifiesto | 647 | **0%** |
| Nuestros productos | 2.061 | 30% |
| Chocolate en polvo | 1.752 | 54% |
| **El ABC del chocolate** | **1.675** | **0%** |
| Recetas | 1.515 | 8% |
| Quiénes somos | 948 | 16% |
| Para cafeterías y negocios | 580 | **0%** |
| Preguntas frecuentes | 961 | **0%** |
| Contacto | 717 | **0%** |
| Pie | 199 | **0%** |

La sección de contenido más larga —el ABC, 1.675 px— es también la más
muerta. Lo mismo FAQ y Contacto.

**El color que sí hay viene del asset más apagado.** Saturación media
medida:

| Fuente | Saturación | Uso actual |
|---|---:|---|
| Etiquetas digitales (arte, 8) | **0.644** | sección de polvo |
| Fotos de estudio (WhatsApp, 4) | 0.340 | 3 fotos de producto |
| Fotos del catálogo (16) | 0.369 | **la tira del hero** |

El color real de la marca vive en el **arte**, no en la fotografía. El
hero está construido sobre la fuente más lavada de las tres.

**El personaje, medido.** Original 460 × 814 px, mostrado a 96 px en la
portada: 21% de escala. La densidad de borde sube de 11.7% (al 100%) a
19.9% (a 96 px): las líneas dejan de ser líneas y se vuelven ruido. Eso
es literalmente lo que se ve como "fuera de foco". **Piso utilizable:
~300 px** (66% de escala).

## 2. Diagnóstico

El sistema trata el color como **contenido** —entra con las fotos—
mientras que el empaque lo trata como **sistema**: cada producto es un
campo de color sólido. Por eso donde no hay foto no hay marca.

Y por eso el personaje flota: en la envoltura nunca flota. Siempre está
**sobre** su campo de color, con lettering blanco encima. Puesto solo
sobre tinta, sin campo, sin blanco y a 96 px, no pertenece a nada.

## 3. El principio: la envoltura como modelo

Anatomía de una envoltura Maracacao:

> campo de color sólido · lettering blanco · ilustración de línea ·
> etiqueta chica con el sabor y el % de cacao

La página tiene que poder producir una envoltura en cualquier parte. Eso
es lo que lleva la identidad a las secciones que hoy son solo texto.

**La regla que conserva lo profesional: un color por pantalla.** Cada
envoltura es UN color; la colección es la que tiene muchos. Tinta y
papel siguen siendo el tejido conectivo y el sello nunca se pinta. Esa
regla es la diferencia entre marca y confeti — y es la que faltaba en la
versión de las ocho bandas peleándose.

## 4. Plan, por impacto

**1. Secciones con campo de color.** Cuatro de once secciones dejan de
ser papel y toman un color pleno de la familia: Manifiesto → morado,
ABC → petróleo, Preguntas frecuentes → carmín, Negocios → cacao. Los
cuatro ya tienen par de contraste verificado con papel/crema (AA o
mejor). Solo esto elimina el 40% muerto.

**2. El muro de sabores.** El índice deja de ser quince puntitos y pasa
a ser quince campos de color con el nombre en blanco: el anaquel
completo, a página entera. Es el dispositivo más fiel a la marca que
tenemos y el que más se parece a ver los productos juntos.

**3. El color sigue al sabor.** Un sabor arrastra su color a todo lo que
toca: su ficha, su hover, su receta, su marcador. El color como dato,
extendido de un punto de 8 px a todo el sistema.

**4. Reglas del personaje.** Piso de 300 px, nunca menos. Nunca flotando
sobre tinta: siempre contra un campo de color, como en la envoltura. Y
preferir las versiones **planas de línea** (las que están en los
empaques) sobre los renders pintados, que son los que no sobreviven la
reducción.

**5. La portada, como envoltura.** Campo de color pleno, sello y
wordmark en blanco, personaje grande y dentro del campo. Deja de ser una
página oscura con un sticker encima.

## 5. Lo que falta de tu lado

- **Los colores exactos de las 15 envolturas de barra.** Hoy solo
  tenemos medidos los 8 de las etiquetas de polvo, que son arte digital.
  Las fotos del catálogo están mal iluminadas y desaturadas: no sirven
  para muestrear color. Hacen falta los archivos de diseño de las
  envolturas, o fotos nuevas con luz pareja.
- **Versiones planas del personaje**, como las de los empaques. Si no
  existen sueltas, se generan con el kit de `docs/prompts-diseno.md`
  pidiendo explícitamente línea plana sobre campo de color.
- **Confirmar el alcance:** ¿cuatro secciones con campo de color, o más?
  Mi recomendación es cuatro; con más, la tinta deja de ser el tejido
  conectivo y perdemos el hilo profesional.
