# Panel fase 7 — que el CMS se entienda

**Problema.** El panel funciona y publica, pero muestra los campos en una sola
tirada. Quien lo va a usar no es técnica, y hoy se encuentra con **692 campos
instanciados** (no 219: los 219 son rutas del esquema, y cada lista se
multiplica por sus ítems). No hay forma de elegir *un* producto y editar solo
ese, ni de agregar o borrar un ítem de una lista.

**Objetivo.** Que cada cosa esté donde ella la buscaría, que nunca vea más de
un puñado de campos a la vez, y que pueda dar de alta y de baja donde
realmente puede terminar el trabajo sola.

---

## Lo que hay hoy

| Sección del esquema | Campos instanciados |
|---|---|
| fichas | 341 |
| productos | 66 |
| negocios | 55 |
| recetas | 45 |
| contacto | 44 |
| sabores | 39 |
| portada / catar | 19 + 19 |
| preguntas | 18 |
| accesibilidad / pie | 15 + 15 |
| nosotros | 8 |
| buscadores / no-encontrada | 4 + 4 |
| **Total** | **692** |

De esos, **490 viven dentro de una lista**. Los grupos repetibles más grandes
son `fichas[].secciones[]` (29 instancias), `fichas[].secciones[].bloques[]`
(25) y `sabores[]` (15 barras).

---

## Decisiones

### D1 · Cinco puertas, no catorce secciones

La navegación deja de seguir las secciones de la página y pasa a seguir las
cosas que ella administra.

| Puerta | Secciones que agrupa | Campos |
|---|---|---|
| Fichas técnicas | `fichas` | 341 |
| Textos del sitio | `portada`, `catar`, `recetas`, `nosotros`, `preguntas`, `pie`, `no-encontrada` | 128 |
| Productos | `productos`, `sabores` | 105 |
| Contacto y negocio | `contacto`, `negocios` | 99 |
| Lo que no se ve | `accesibilidad`, `buscadores` | 19 |

Las catorce secciones tienen puerta y ninguna queda afuera; eso es un test.

El mapa vive en `src/panel/`, **no** en el esquema: las puertas son una
decisión de la interfaz, no del contenido. `src/contenido/**` no se toca.

### D2 · Lista al costado, cajón en el celular

En pantalla ancha: lista de ítems a la izquierda, formulario del ítem elegido
a la derecha. En pantalla angosta la lista entra como cajón por encima del
formulario, y se abre con un botón rotulado **«☰ Elegir producto»** — con
palabras, no un ícono suelto, porque un ícono suelto es lo que no se descubre.

El número grande nunca se ve: detrás de «Productos» hay 105 campos, pero la
pantalla muestra entre dos y siete.

Las fichas técnicas usan la misma idea con un nivel más, porque ya vienen
anidadas: **ficha → sección → bloque**.

### D3 · La ayuda de cada campo, siempre visible

Debajo de la etiqueta y arriba del control, sin ícono que descubrir. Esa ayuda
ya está escrita para los 219 campos del esquema y está redactada para ella.

- **El mensaje de error es el del esquema**, tal cual. Es el mismo que impide
  publicar, así que el panel nunca puede aprobar algo que después falle.
- **El contador dice cuánto queda**, no cuánto lleva.

### D4 · Agregar y borrar, solo donde ella puede terminar sola

De los catorce grupos repetibles, cinco tienen **todos** sus campos en su
poder. Solo ahí aparecen los botones.

| Lista | Campos suyos | Hoy | Mínimo | Máximo |
|---|---|---|---|---|
| `cocoas.lista[]` | 5 | 2 | 1 | 6 |
| `negocios.condiciones[]` | 3 | 5 | 1 | 8 |
| `negocios.fichas[]` | 2 | 3 | 1 | 8 |
| `preguntas.items[]` | 2 | 8 | 3 | 20 |
| `fichas[].meta[]` | 2 | 4 | — | — |

En los grupos mixtos (barras, gotas, polvo, recetas, pasos de catado) **no hay
botón de agregar**, y en su lugar va una línea visible que dice que esos los da
de alta Marcos. No es una limitación que se esconde: es una frase, para que no
busque un botón que no existe.

Razón: una barra necesita clave de color (un enum del código), slug, orden, %
de cacao, ingredientes e ilustración. De sus ocho campos, ella controla dos.
Un alta desde el panel dejaría un producto a medio crear.

**Borrar** pide confirmación escribiendo el nombre del ítem, no un «¿estás
seguro?» que se contesta de memoria. Y nunca publica solo: queda en el borrador
hasta que ella toque Publicar, con el deshacer de media hora intacto después.

Cuando una lista está en su mínimo, el botón de borrar no desaparece: se
deshabilita y dice por qué.

### D5 · Las fichas técnicas se quedan, con advertencia

Decisión de Marcos: las edita ella. La puerta lleva un cartel que dice que ahí
adentro hay declaraciones que tienen que coincidir con el empaque y con lo que
se declara ante la autoridad. Entrar ahí no puede sentirse igual que corregir
una errata de la portada.

### D6 · Entorno de DOM por archivo, no global

Hoy `vitest` corre con `environment: 'node'`, sin jsdom, y el `include` solo
toma `.test.ts`. Por eso `Sesion.tsx` —505 líneas, el que orquesta todo— llegó
a la fase 6 con cobertura de comportamiento **cero**: su test afirmaba sobre el
texto del archivo fuente. Por ahí entraron cinco defectos obligatorios, dos de
ellos borrándole trabajo a ella sin avisar, y los encontró una lectura humana.

Se monta DOM **declarado por archivo**, no cambiando el entorno de toda la
suite: los tests del panel lo piden, los otros 1516 siguen en `node`. Cambiar
el entorno global el mismo día que se rediseña la interfaz es pedir dos
problemas a la vez.

---

## Qué se toca y qué no

**No se toca:**
- `src/contenido/**` — esquema y datos, intactos.
- `src/servidor/**` — **tampoco**. Publicar manda los documentos enteros, así
  que agregar o borrar un ítem es un documento distinto; el servidor valida con
  el mismo esquema y `minItems`/`maxItems` frenan los bordes. No hay que
  re-empaquetar `api/panel.js`.
- El autoguardado, el conflicto entre dos aparatos, la pantalla de revisión, el
  deshacer de media hora y la reversión automática si el despliegue falla.

**Se agrega, todo en `src/panel/`:**
- `puertas.ts` — el mapa sección → puerta y el agrupado de ítems navegables.
  Puro e inyectable.
- `agregarItem()` / `quitarItem()` por ruta de lista, puras, junto a `leer` y
  `escribir` que ya existen en `campos.ts`.
- La navegación nueva (lista, cajón, formulario), que reemplaza al `Editor.tsx`
  actual. `Sesion.tsx` conserva su papel.

---

## Fuera de alcance

- El buscador. Va **encima** de esta estructura, no en lugar de ella, y en otra
  tanda.
- La vista previa y el medidor de peso, que siguen pendientes de la fase 6.
- Cambiar de dueño ningún campo: lo que hoy es de Marcos sigue siendo de Marcos.
- Publicar precios de mayoreo en el sitio público.

---

## Riesgos

1. **Regresión en lo que ya funciona.** El rediseño toca la pantalla, no la
   lógica de publicar; pero `Editor.tsx` se reemplaza. Mitigación: el entorno de
   DOM entra **antes** que el rediseño, y los doce manejadores de `Sesion.tsx`
   quedan cubiertos antes de mover nada.
2. **Una ficha mal tecleada.** Es una declaración, no una errata. Mitigación: la
   advertencia de D5 y la validación del esquema, que ya rechaza formatos malos.
3. **El cajón del celular no se descubre.** Mitigación: el botón va rotulado con
   palabras, no con un ícono.
4. **Borrar por accidente.** Mitigación: confirmación escribiendo el nombre,
   nada se publica solo, y el deshacer de media hora sigue ahí.
