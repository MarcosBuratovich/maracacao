# Panel del cliente · Fase 1, Parte B — Los esquemas, la migración y las fachadas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declarar el esquema de los cuatro documentos de contenido, migrar el contenido de hoy a JSON sin que cambie una coma, y reescribir las tres fachadas para que el sitio lea desde ahí — con un certificado permanente que prueba que el objeto exportado es idéntico al de antes.

**Architecture:** El contenido deja de ser TypeScript a mano y pasa a `src/contenido/datos/*.json`. Su forma vive en `src/contenido/esquema/*.ts`, escrito con los constructores de la Parte A: cada campo lleva etiqueta y ayuda en español mexicano, y un campo sin etiqueta no compila. `scripts/migra-contenido.ts` corre dos veces —una para capturar el fixture del árbol viejo, otra para escribir los JSON con `serializa()`— y `test/contenido-fachada.test.ts` compara para siempre lo que la fachada exporta contra ese fixture. Las tres fachadas pasan de 915 líneas a ~45.

**Tech Stack:** Zod 4.4.3 (fijada por override en `pnpm-workspace.yaml`), Astro 7 estático, Vitest 4, TypeScript 6, pnpm 11.2.2.

**Spec:** `docs/superpowers/specs/2026-09-08-panel-cliente-design.md` — secciones `1`, `2`, `9`, `10` y `11` de la arquitectura.

**Base:** `main` en `a2666b6` (Parte A mergeada por el PR #2 y verificada: 769 tests verdes, `astro check` 0 errores).

**Plan de la Parte A:** `docs/superpowers/plans/2026-09-09-panel-fase-1.md`. No hace falta leerlo para ejecutar este, pero explica por qué la maquinaria tiene la forma que tiene.

**Entrega de la Parte B:** el sitio renderiza EXACTAMENTE el mismo HTML que hoy, leyendo desde JSON. `src/copy/sitio-marca.ts`, `src/copy/sabores.ts` y `src/fichas/base.ts` quedan como fachadas de pocas líneas. Todavía no hay panel: eso es la fase 6.

---

## Global Constraints

Valen para toda tarea de este plan.

- **REGLA DURA DE LA CARPETA:** `src/contenido/**` no importa `node:*`, no importa Astro, y usa **solo rutas relativas sin extensión** (nada de `@/`). Es la condición para que el mismo código corra en el navegador de la clienta, en la función serverless y en vitest. Dependencias externas permitidas: `zod`, `../tokens/color` y `../tokens/contrast`. El guard vive en `test/contenido.test.ts` y ya vigila `import`, `import()`, `require` y `from`.
  - **Excepción única y acotada:** los `import` de `*.json` de `src/contenido/datos/` **sí** son rutas relativas y **sí** están permitidos (`import datos from '../datos/sitio.json'`). No violan la regla: son datos, no plataforma.
  - `scripts/migra-contenido.ts` **no** está bajo `src/contenido/`, así que sí puede usar `node:fs`.
- **Registro es-MX.** Vocabulario prohibido de MARCA en todo copy: «mono», «chango», «changuito», «chispa(s)», «carrito», «pistachos», «cacahuete», «maní», «packaging», «snack», «smoothie». La lista de MAQUETA («Borrador», «PENDIENTE», «te avisamos», «Lorem») aplica **solo al sitio publicado**.
- **Las etiquetas y ayudas que ve la clienta van en español mexicano, sin jerga.** Nada de «string», «array», «campo requerido», «slug». La ayuda dice DÓNDE VIVE el texto en la página, no qué tipo tiene. Los comentarios del código van en español rioplatense y explican POR QUÉ.
- **Precios como número entero**, 1–99.999. Ningún `$` seguido de dígito dentro de un string de copy.
- **Colores solo desde tokens** (`src/tokens/color.ts`). Ningún hex a mano.
- **El sitio queda 100% estático.** Ningún adapter, ningún `output: 'server'`.
- **Cero `.astro` tocados en toda la fase.** Un commit, una causa. Ver el ítem «Los dos arreglos de `index.astro` NO son de esta fase» más abajo.
- **Los invisibles se escriben como escape, nunca se pegan.** En la Parte A esto mordió a cuatro implementadores: el espacio duro se convierte en espacio normal en el camino, y el error espejo también aparece (acentos de verdad convertidos en el texto literal de su escape). En TypeScript va `'70\u00a0g'`. En JSON va `"70\u00a0g"`. **Nunca** se pega el carácter. Después de escribir un archivo con invisibles, verificalo:
  ```bash
  grep -c $'\u00a0' <archivo>   # tiene que dar 0
  grep -c 'u00a0' <archivo>            # tiene que dar la cantidad esperada
  ```
- **Línea de base:** hoy `pnpm test` da **769 tests verdes** (30 archivos) y `pnpm typecheck` **0 errores, 0 warnings, 3 hints**. Ninguna tarea puede bajar el verde.
- **`pnpm build` es la compuerta:** construye el sitio, corre la suite y `astro check`. Corrélo antes de cada commit que toque el camino del import.
- **Commits en español, imperativo,** terminando con:

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

### Cómo se prueba el rojo de una aserción de TIPO

**Vitest no tipa.** Transpila con esbuild y tira los tipos, así que un test que afirma
una forma de TIPO —que `tokenColor` no acepta `valores`, que `cuenta` no acepta un
objeto, que `z.infer<>` da la unión de literales— **pasa en verde bajo `vitest run` desde
antes de implementar nada**. Y `expectTypeOf()` de vitest se borra en runtime: sin un
bloque `typecheck` en `vitest.config.ts` (no lo hay), no afirma nada al correr.

Eso no las deja sin poder de detección: `pnpm typecheck` es `astro check`, y el
`tsconfig.json` del repo no tiene `include` ni `exclude`, así que **cubre `test/`**. El
rojo existe — vive en otro comando.

> **Donde un paso diga «FAIL en compilación», el comando es `pnpm typecheck`, no
> `vitest run`.** Capturá esa salida como evidencia de rojo. Los tests de comportamiento
> en runtime se prueban con `vitest run`, como siempre.

(Lo encontró el implementador de la Tarea 1 y tenía razón; el plan decía el comando
equivocado en dos pasos.)

### La regla de método, otra vez, porque sigue siendo la más importante

> **Todo test que se escriba tiene que venir con su prueba de que falla.** No alcanza con verlo pasar. Hay que romper a propósito lo que el test dice cuidar, verlo dar **rojo**, restaurar, y pegar las dos salidas en el reporte.

En la Parte A esta regla encontró **14 hallazgos Importantes, 13 de ellos defectos del plan**. El diagnóstico de la fase, textual: *«con la asimetría puesta, los otros 39 tests quedan verdes»* — ninguno de los defectos sobrevivió porque fuera difícil; sobrevivieron porque **la suite estaba verde**.

El caso que mejor lo explica: el constructor `medida` **rechazaba todos los valores**, correctos e incorrectos por igual, porque `\s` también matchea el espacio duro. Invisible durante días porque ningún test ejercía su caso feliz.

Si un paso de este plan te hace escribir un test y **no** te dice cómo probar que falla, eso es un defecto del plan: paralo y decilo.

### La regla de la migración

**Nadie tipea contenido a mano.** Ni una coma, ni un acento, ni un espacio duro. Los cuatro JSON los escribe `scripts/migra-contenido.ts` leyendo los módulos `as const` vivos. Si un JSON tiene un carácter que no salió del script, el certificado de la Tarea 14 lo va a encontrar — pero recién ahí, y con un diff de 300 líneas encima.

**Corolario:** ningún paso de este plan te pide copiar copy del sitio a un archivo. Si te encontrás haciéndolo, algo salió mal.

---

## Lo que este plan NO hace, y por qué

**Los dos arreglos de `index.astro` de la §1.8 del spec quedan para la fase 2.** El spec pide dos cambios de expresión:

- `index.astro:448` — `{'chipPolvo' in r && …}` tiene que pasar a `{r.chipPolvo && …}`, porque si la clienta vacía el chip y el panel guarda `''`, se renderiza una cajita amarilla vacía de 6×10 px que estira las cuatro tarjetas.
- `index.astro:538` — `t.precio === null` tiene que pasar a `t.precio == null`.

Los dos son cambios de `.astro`, y la constraint global de esta fase es **cero `.astro` tocados** — que además está en el spec mismo (§10, «REGLA DEL COMMIT DE LA FASE 1»). Y ninguno de los dos es urgente todavía: los dos se vuelven necesarios cuando **el panel puede escribir**, que es la fase 6; la fase 2 toca `index.astro` de todos modos.

Lo que esta fase SÍ hace al respecto es dejar clavada la forma que hoy los hace innecesarios: dos de las ocho aserciones de forma de la Tarea 14 afirman que `'chipPolvo' in r` da `false` en las tres recetas sin chip y que `t.precio` es `null` exactamente en el tab del polvo. Si la migración materializa un `chipPolvo: ''`, esas aserciones truenan en esta fase, no en la seis.

**No se toca `src/copy/marca.ts` ni `src/copy/landing.ts`.** Son el copy del manual de marca y de la presentación (`/presentacion`, `/manual`), páginas de Marcos. No son contenido de la clienta y no están entre los cuatro documentos del spec.

**No mueren los asserts de CONTEO.** Solo caen los asserts de VALOR (§9: los tres nombrados en la Tarea 17). Los de conteo —15 sabores, 6 gotas, 8 polvos— se quedan hasta la fase 7, cuando exista el alta de ítems. Hasta entonces nadie puede violarlos: es un guard gratis.

---

## File Structure

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/contenido/esquema/sabores.ts` | La forma de los 15 sabores, las 6 gotas y los 8 polvos. |
| `src/contenido/esquema/fichas.ts` | La forma de las 4 fichas técnicas, con la unión discriminada de bloques. |
| `src/contenido/esquema/sitio.ts` | La forma de `marca`: 198 campos en 21 bloques. El archivo grande. |
| `src/contenido/esquema/index.ts` | `IdDocumento`, el mapa de los cuatro documentos, `validar()` y `conteosDe()`. |
| `src/contenido/datos/sabores.json` | Escrito por el script. Nadie lo edita a mano. |
| `src/contenido/datos/fichas.json` | Ídem. |
| `src/contenido/datos/sitio.json` | Ídem. |
| `src/contenido/datos/envolturas.json` | **Movido** desde `docs/envolturas.json`. |
| `scripts/migra-contenido.ts` | Captura el fixture y escribe los JSON. Node, fuera de `src/contenido/`. |
| `test/fixtures/contenido-2026-09-10.json` | La foto del árbol viejo. Se escribe UNA vez y no se toca nunca más. |
| `test/contenido-fachada.test.ts` | El certificado: 3 igualdades profundas + 8 aserciones de forma. |
| `test/contenido-mutaciones.test.ts` | Los ~25 contenidos malos que `validar()` tiene que cachear. |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `src/contenido/campos.ts` | `validos` → `valores`; `cuenta` pasa a llevar su sustantivo. |
| `src/contenido/carga.ts` | El recorrido real de las uniones discriminadas; `serializa()` omite los derivados. |
| `src/contenido/validacion.ts` | `validar()` cruza los conteos y produce `gravedad: 'avisa'`. |
| `src/contenido/derivados.ts` | La tabla de derivados del sitio y `injerta()`. |
| `src/copy/sabores.ts` | 98 → ~18 líneas. |
| `src/fichas/base.ts` | 404 → ~10 líneas. |
| `src/fichas/plantilla.ts` | Se borran `p()` y `li()`, que quedan sin usuarios. |
| `src/copy/sitio-marca.ts` | 413 → ~24 líneas. |
| `scripts/extrae-envolturas.py` | Escribe en la ruta nueva. |
| `test/marca-copy.test.ts` | Caen dos asserts de valor; el de envolturas lee la ruta nueva. |
| `test/sitio.test.ts` | Caen dos asserts de valor. |
| `test/contenido.test.ts` | Suma los candados nuevos. |

**Se borra:** `docs/envolturas.json` (se MUEVE, no se duplica — dos copias de la autoridad sobre ingredientes y % de cacao es exactamente el bug que este diseño existe para prevenir).

---

## Barrido previo de conflictos

Lo corrí antes de escribir las tareas. Cada fila es un par de tareas que comparten archivo o interfaz, o una tarea contra sí misma.

| Qué revisé | Resultado |
|---|---|
| T1 (renombre `valores`) × T4–T12 (todo esquema que use `tokenColor`) | **Conflicto real, resuelto por orden.** T1 va primera justamente para que ningún esquema se escriba contra el nombre viejo. Ruling A. |
| T1 (`cuenta` cambia de forma) × T7–T12 (los nueve campos con conteo) | **Conflicto real, resuelto por orden.** Mismo motivo. Ruling B. |
| T2 (uniones) × T5 (fichas) | **Dependencia dura.** `recorre()` y `serializa()` HOY tiran con una unión, a propósito, con el mensaje «lo agrega la fase 1 parte B». Sin T2, T5 no puede ni serializar. T2 va antes. |
| T3 (fixture) × T4/T5/T13 (las tres migraciones) | **Dependencia dura.** El fixture se captura del árbol VIEJO. Si se sacara después de reescribir una fachada, sería una comparación de algo contra sí mismo: verde y sin valor. T3 va antes de la primera migración. |
| T4 (`sabores.json`) × T13 (`sitio.json` deriva precios de `sabores`) | **Dependencia real.** `derivados.ts` calcula `tabs.2.precio` desde `sabores[].precio` y `tabs.1.precio` desde `gotas[].precio`. T4 antes que T13. |
| T4 (`claveSabor` pasa a `z.enum`) × T8/T9/T10 (los cinco campos `claveSabor` del sitio) | **Dependencia de tipo.** Los cinco heredan el tipo que T4 arregla. Si T4 no fuera primera, `astro check` daría siete errores en `index.astro` y esta fase no puede tocar `.astro`. |
| T5 (fichas) × T6 (envolturas) | Comparten el directorio `datos/` pero ningún archivo. Sin conflicto. Van seguidas por afinidad de tema. |
| T4/T5/T12 (`esquema/index.ts`) | `index.ts` crece con cada documento: T4 lo crea con `sabores`, T5 agrega `fichas`, T12 agrega `sitio`. **Cada tarea agrega su entrada; ninguna reescribe las de las otras.** Está escrito explícito en las tres para que no haya sorpresa. |
| T7 (`sinHtml`) × T12 (`fichasTecnicas.titulo`/`descripcion`) | **Riesgo de duplicación.** Los dos bloques necesitan la misma regla. T12 la IMPORTA de `cabecera.ts`; está dicho explícito ahí. La misma regla escrita dos veces es el patrón que esta capa ya pagó cuatro veces. |
| T13 (derivados) × T13 (fachada del sitio) | **La fachada NECESITA los derivados** para armar el objeto antes de `cargar()`. Por eso van en la MISMA tarea y no en dos: un revisor no puede aprobar una sin la otra. |
| T13 (`DERIVADOS_DEL_SITIO`) × T8/T10 (los campos `derivado` del esquema) | **Dos declaraciones de la misma verdad.** T13 trae el candado que exige que las dos listas digan lo mismo. Es el ruling 31 de la Parte A aplicado a otra cosa: tres piezas que existen y nadie ensambla. |
| T15 (mutaciones) × T14 (certificado) | Independientes. El certificado prueba que la migración no cambió nada; las mutaciones prueban que la validación ataja lo malo. Ninguna sirve sin la otra y ninguna depende de la otra. |
| T17 (caen los asserts de valor) × T14/T16 | **Orden importa, y es el único orden que importa al final.** Esos asserts son la única red que hoy existe sobre el contenido. Sacarlos antes de que el certificado y los candados estén verdes deja una ventana sin nada. T17 va última. |
| T2 (`serializa()` omite derivados) × T2 mismo | El mismo archivo cambia por dos causas: las uniones y los derivados. **Van en dos commits dentro de la tarea**, con su test cada uno. Un commit, una causa. |
| T8 (`cuenta` en `negocios.tabs`) × Ruling C | El plan mandaría declarar `tabs` como `lista`, que es lo natural para tres elementos de forma idéntica — y sería un defecto, porque el metadato de una lista es uno solo para todos sus elementos y estos necesitan tres reglas de conteo distintas. Resuelto en el Ruling C antes de escribir la tarea. |
| El plan contra el rubro de revisión | Ningún paso manda duplicar un bloque de lógica: los tres paneles de negocio salen de un constructor parametrizado y la regla del `<head>` se importa. Ningún test escrito acá pasa antes y después de su implementación: cada uno viene con su mutación. Las tablas de campo de T8 a T12 son contenido exacto, no placeholders. |

**Rulings tomados antes de arrancar:**

**Ruling A — `validos` y `valores` se unifican en `valores`.** Es el ruling 33 de la Parte A, cargado a esta como su primer punto. `opcion` usa `valores`, `tokenColor` usa `validos`, y son el mismo concepto: la lista cerrada que el campo acepta. Gana `valores` porque es lo que consume `z.enum` y porque `opcion` es el constructor más general. *Costo si me equivoco:* un renombre de dos llamadas. Hoy es gratis; después de 200 campos, no.

**Ruling B — `cuenta` deja de ser un string y pasa a `{ de, sustantivo }`.** Contra el copy real, el sustantivo NO se deduce de la colección: `negocios.tabs[2].cuerpo` dice «Las 15 **barras**» y `gotas.sabores` dice «6 **sabores**» aunque cuente gotas. Con `cuenta: 'sabores'` a secas, `cruzaConteo()` no sabe qué palabra buscar y el aviso no se puede producir. Y los dos datos son inútiles por separado: un sustantivo sin colección no cruza nada. *Costo si me equivoco:* dos campos donde había uno, en un metadato que todavía no tiene consumidores.

**Ruling C — `negocios.tabs` se declara `tupla` de tres, no `lista`.** Los tres tabs tienen forma idéntica, así que `lista` parece lo natural. Pero (1) el `id` y el `ficha` de cada uno están cableados a anclas del markup (`#chocolate-en-polvo`, `#barras-y-gotas`) y a `fichas-tecnicas.astro`: un cuarto tab agregado desde el panel no apuntaría a nada; y (2) cada tab necesita su propio `cuenta` —«15 barras» en uno, «6 sabores» en otro— y el metadato de una `lista` es UNO solo para todos los elementos. *Costo si me equivoco:* la clienta no puede agregar una cuarta línea de producto desde el panel. Eso es la fase 7 (altas y bajas), que está diferida.

**Ruling D — el fixture se llama `contenido-2026-09-10.json`, no `-2026-09-08` como dice el spec.** El nombre afirma cuándo se sacó la foto. El spec puso la fecha del día en que se escribió el diseño; la foto se saca hoy. Una fecha falsa en un artefacto permanente es una mentira barata de evitar. *Costo si me equivoco:* ninguno; es un nombre de archivo.

**Ruling E — `anaquel.contadorDe` («de 15») no lleva `cuenta`.** `cruzaConteo()` exige que el número sea vecino inmediato de un sustantivo, y acá no hay sustantivo: la plantilla renderiza «n.º 3 **de 15**». Forzar la regla pidiría inventar un sustantivo falso. En su lugar va como una de las aserciones de forma de la Tarea 14: `marca.anaquel.contadorDe === 'de ' + sabores.length`. *Costo si me equivoco:* una aserción en vez de una regla de esquema; el campo queda cubierto igual.

---

## Tarea 1: El renombre que no puede esperar, y el productor de «avisa»

Los dos puntos que la Parte A dejó anotados y que se cierran ANTES de escribir un solo esquema, porque después son 200 campos escritos contra el nombre equivocado.

**Files:**
- Modify: `src/contenido/campos.ts` — `MetaCampo.validos`, `MetaCampo.cuenta`, `tokenColor()`
- Modify: `src/contenido/validacion.ts` — `validar()` nuevo
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `MetaCampo.valores?: readonly string[]` (el único nombre para una lista cerrada), `ColeccionContada`, `MetaCampo.cuenta?: { de: ColeccionContada; sustantivo: string }`, `Conteos`, `validar(esquema, crudo, conteos)`.
- Consume: `cruzaConteo(texto, esperado, sustantivo)` y `recorre(esquema, visita, prefijo?)`, los dos ya existentes.

**Por qué ahora.** El ruling 33 de la Parte A, textual: *«a diferencia de las envolturas, que quedaron ruidosas, acá no hay guard — un widget que lea el nombre equivocado simplemente no pinta el selector, sin excepción y sin error de tipos»*. Y el ruling 31: las tres piezas del aviso de conteos existen (`cuenta`, `cruzaConteo`, `gravedad: 'avisa'`) y **nadie las ensambla**; hoy `'avisa'` no tiene un solo productor en todo el sistema.

- [ ] **Paso 1: El test del nombre único, que hoy falla**

En `test/contenido.test.ts`, dentro del bloque de `campos.ts`:

```ts
it('la lista cerrada de valores se llama igual en los dos constructores que la tienen', () => {
  // `opcion` la llamaba `valores` y `tokenColor` la llamaba `validos`: un
  // concepto con dos nombres, sin nada que los mantenga alineados. El panel
  // lee este metadato para pintar el selector — con el nombre equivocado no
  // pinta nada, sin excepción y sin error de tipos.
  const base = { etiqueta: 'X', seccion: 'contacto', ayuda: 'Y' } as const
  const conListaCerrada = [
    opcion({ ...base, valores: ['personal', 'negocio'] }),
    tokenColor({ ...base, valores: ['rojoHondo'] }),
  ]
  for (const esquema of conListaCerrada) {
    const meta = panel.get(esquema) as MetaCampo
    expect(Object.keys(meta).filter((k) => /^val(ores|idos)$/.test(k))).toEqual(['valores'])
    expect(meta.valores).toBeDefined()
  }
})
```

- [ ] **Paso 2: Correrlo y verlo fallar**

Es una aserción de TIPO, así que el rojo NO sale en vitest (ver «Cómo se prueba el rojo de una aserción de tipo»).

Run: `pnpm typecheck`
Expected: FAIL — `tokenColor` no acepta `valores` (espera `validos`). Pegá la salida en el reporte.

- [ ] **Paso 3: El renombre**

En `src/contenido/campos.ts`, en `MetaCampo`, **borrá** la propiedad `validos` y dejá una sola:

```ts
  /**
   * La lista cerrada de valores que acepta el campo. La usan `opcion` (las
   * dos opciones del formulario) y `tokenColor` (los tokens de color
   * declarados). Era el mismo concepto con dos nombres —`valores` y
   * `validos`— y el panel dibuja el selector leyendo esta clave: con el
   * nombre equivocado no dibuja nada, sin excepción y sin error de tipos.
   */
  valores?: readonly string[]
```

Y en el constructor:

```ts
/** Igual que claveSabor pero para cualquier token de color declarado. */
export const tokenColor = (meta: Base & { valores: readonly string[] }) =>
  anota(
    z.string().refine((v) => meta.valores.includes(v), 'No es un token de color del sistema.'),
    { control: 'oculto', quien: 'marcos', ...meta },
  )
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS, y ninguno de los tests que ya existían en rojo.

- [ ] **Paso 5: Commit**

```bash
git add src/contenido/campos.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
refactor: la lista cerrada de valores tiene un solo nombre

`opcion` la llamaba `valores` y `tokenColor` `validos`. Es el mismo
concepto, y el panel dibuja el selector leyendo esta clave: con el nombre
equivocado no dibuja nada, sin excepción y sin error de tipos. Se cierra
con dos llamadas escritas; después del esquema son doscientas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Paso 6: El test de que `cuenta` sabe qué palabra buscar, que hoy falla**

```ts
it('cuenta lleva el sustantivo con el que ESE texto nombra la lista', () => {
  // Contra el copy real, la colección y la palabra NO coinciden:
  // negocios.tabs[2].cuerpo dice «Las 15 barras» y cuenta sabores;
  // gotas.sabores dice «6 sabores» y cuenta gotas. Con `cuenta` como un
  // string a secas, cruzaConteo() no sabe qué palabra buscar y el aviso
  // no se puede producir.
  const campo = texto({
    etiqueta: 'Cuerpo del panel de barras',
    seccion: 'negocios',
    ayuda: 'El párrafo del panel «Chocolate en barras».',
    maxCaracteres: 170,
    cuenta: { de: 'sabores', sustantivo: 'barras' },
  })
  const meta = panel.get(campo) as MetaCampo
  expect(meta.cuenta).toEqual({ de: 'sabores', sustantivo: 'barras' })
})
```

- [ ] **Paso 7: Correrlo y verlo fallar**

Otra aserción de TIPO: el rojo sale en `pnpm typecheck`, no en vitest.

Run: `pnpm typecheck`
Expected: FAIL — `cuenta` está tipado como un string union, no acepta un objeto.

- [ ] **Paso 8: La forma nueva de `cuenta`**

En `src/contenido/campos.ts`, arriba de `MetaCampo`:

```ts
/**
 * Las listas cuya cantidad aparece escrita en algún texto del sitio. El
 * «15» está en nueve lugares; el «6» de las gotas, en dos.
 */
export type ColeccionContada =
  | 'sabores'
  | 'gotas'
  | 'polvo'
  | 'recetas'
  | 'preguntas'
  | 'pasos'
  | 'ingredientes'
```

Y dentro de `MetaCampo`, reemplazá la propiedad `cuenta` por:

```ts
  /**
   * El texto menciona una cantidad que sale de una lista.
   *
   * Son DOS datos y no uno porque contra el copy real no coinciden: el
   * cuerpo del panel de barras dice «Las 15 barras» y la lista que cuenta
   * es la de sabores; el de las gotas dice «6 sabores» y la lista que
   * cuenta es la de gotas. `de` dice de qué lista sale el número;
   * `sustantivo` dice con qué palabra lo nombra ESTE texto, que es lo que
   * `cruzaConteo()` necesita para no marcar cualquier número suelto.
   *
   * Y van juntos y no separados porque por separado no sirven: un
   * sustantivo sin colección no cruza nada.
   */
  cuenta?: { de: ColeccionContada; sustantivo: string }
```

- [ ] **Paso 9: Correr el test y verlo pasar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS.

- [ ] **Paso 10: Commit**

```bash
git add src/contenido/campos.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
refactor: cuenta dice de qué lista sale el número Y con qué palabra

Contra el copy real la colección y el sustantivo no coinciden: «Las 15
barras» cuenta sabores, «6 sabores» cuenta gotas. Con `cuenta` como un
string a secas, cruzaConteo() no sabe qué palabra buscar y el aviso no se
puede producir. Van juntos porque por separado no sirven.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Paso 11: Los tres tests de `validar()`, que hoy fallan**

En `test/contenido.test.ts`, un bloque nuevo. **Los tres importan**: el que produce el aviso, el que prueba que NO lo produce cuando el texto está bien, y el que prueba que un `cuenta` sin conteo TRUENA en vez de callarse.

```ts
describe('validar() — los avisos de conteo', () => {
  const esquemaDePrueba = grupo({
    etiqueta: 'Prueba',
    seccion: 'sabores',
    ayuda: 'Un documento de prueba.',
    campos: {
      kicker: texto({
        etiqueta: 'Antetítulo del anaquel',
        seccion: 'sabores',
        ayuda: 'La línea chiquita arriba de «Elige tu barra».',
        maxCaracteres: 30,
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
    },
  })

  it('avisa cuando el texto dice un número distinto del real', () => {
    const problemas = validar(esquemaDePrueba, { kicker: 'LOS 15 SABORES' }, { sabores: 16 })
    expect(problemas).toEqual([
      {
        campo: 'kicker',
        gravedad: 'avisa',
        titulo: 'Este texto dice «15» pero hoy hay 16.',
        detalle: 'Si agregaste o quitaste algo de la lista, este texto quedó viejo.',
      },
    ])
  })

  it('no avisa cuando el texto y la lista dicen lo mismo', () => {
    expect(validar(esquemaDePrueba, { kicker: 'LOS 16 SABORES' }, { sabores: 16 })).toEqual([])
  })

  it('truena si el esquema declara un conteo que el llamador no pasó', () => {
    // Es un error de cableado, no de contenido: las tres piezas del aviso
    // existían desde la Parte A y nadie las ensamblaba. Si el silencio
    // fuera aceptable acá, la feature podría volver a quedar muerta sin
    // que un solo test lo note.
    expect(() => validar(esquemaDePrueba, { kicker: 'LOS 15 SABORES' }, {})).toThrow(
      /kicker.*«sabores».*no vino en los conteos/,
    )
  })
})
```

- [ ] **Paso 12: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'avisos de conteo'`
Expected: FAIL — `validar` no existe (`validacion.ts` solo exporta `validarContra`).

- [ ] **Paso 13: `validar()`**

En `src/contenido/validacion.ts`, agregá al final. `validarContra` **se queda como está** y no cambia: `validar()` lo llama.

```ts
/** Cuántos hay de verdad en cada lista contada. Lo arma el llamador. */
export type Conteos = Readonly<Partial<Record<ColeccionContada, number>>>

/**
 * Une un prefijo con una parte de la ruta. Misma regla que `con()` en
 * carga.ts: la raíz no lleva punto adelante.
 */
const une = (a: string, b: string | number): string => (a === '' ? String(b) : `${a}.${b}`)

/**
 * `recorre()` devuelve rutas de ESQUEMA, con `[]` donde hay una lista
 * ('negocios.tabs[].datos[]'). Los avisos son sobre VALORES, así que hay
 * que instanciar cada `[]` contra el dato real y devolver una ruta
 * concreta por elemento — que es la que el panel usa para llevar a la
 * clienta al campo exacto.
 */
const enRutas = (dato: unknown, ruta: string): { ruta: string; valor: unknown }[] => {
  let actuales: { ruta: string; valor: unknown }[] = [{ ruta: '', valor: dato }]
  for (const parte of ruta.split('.')) {
    const siguiente: { ruta: string; valor: unknown }[] = []
    for (const { ruta: r, valor } of actuales) {
      if (valor === null || valor === undefined) continue
      if (parte.endsWith('[]')) {
        const clave = parte.slice(0, -2)
        const lista = clave ? (valor as Record<string, unknown>)[clave] : valor
        const base = clave ? une(r, clave) : r
        if (Array.isArray(lista)) lista.forEach((v, i) => siguiente.push({ ruta: une(base, i), valor: v }))
      } else {
        siguiente.push({ ruta: une(r, parte), valor: (valor as Record<string, unknown>)[parte] })
      }
    }
    actuales = siguiente
  }
  return actuales
}

/**
 * Los avisos de conteo: el texto dice «15 sabores» y hoy hay 16.
 *
 * Esta función es el ÚNICO productor de `gravedad: 'avisa'` del sistema.
 * Hasta acá las tres piezas existían por separado —el metadato `cuenta`,
 * la regla `cruzaConteo()` y el valor `'avisa'` del tipo— y ninguna las
 * juntaba: la clase de feature de tres piezas que se olvida.
 */
function avisosDeConteo(esquema: z.ZodType, crudo: unknown, conteos: Conteos): Problema[] {
  const avisos: Problema[] = []
  recorre(esquema, (ruta, meta) => {
    const cuenta = meta?.cuenta
    if (!cuenta) return
    const esperado = conteos[cuenta.de]
    // Callarse acá sería volver al estado anterior: la regla declarada y
    // nadie ejecutándola. Un conteo que falta es un error de cableado del
    // llamador, no un problema del contenido de la clienta.
    if (esperado === undefined) {
      throw new Error(
        `validar(): el campo «${ruta}» declara un conteo sobre «${cuenta.de}», que no vino en los conteos.`,
      )
    }
    for (const { ruta: concreta, valor } of enRutas(crudo, ruta)) {
      if (typeof valor !== 'string') continue
      const aviso = cruzaConteo(valor, esperado, cuenta.sustantivo)
      if (aviso === null) continue
      avisos.push({
        campo: concreta,
        gravedad: 'avisa',
        titulo: `Este texto ${aviso}`,
        detalle: 'Si agregaste o quitaste algo de la lista, este texto quedó viejo.',
      })
    }
  })
  return avisos
}

/**
 * La verdad única de la validación, la que importan los cuatro
 * consumidores: el navegador mientras la clienta escribe, la función
 * antes de tocar GitHub, vitest, y `astro build` por el camino del import.
 *
 * Lo que IMPIDE publicar sale del esquema; lo que solo AVISA sale de
 * cruzar los textos contra las listas reales.
 */
export function validar(esquema: z.ZodType, crudo: unknown, conteos: Conteos = {}): Problema[] {
  const impiden = validarContra(esquema, crudo)
  // Si el dato no pasa el esquema, cruzar conteos sobre él es ruido sobre
  // ruido: la clienta ya tiene que arreglar algo, y los avisos se
  // calculan sobre valores que pueden ni existir.
  if (impiden.length > 0) return impiden
  return avisosDeConteo(esquema, crudo, conteos)
}
```

Los imports que hay que agregar arriba del archivo:

```ts
import { cruzaConteo } from './conteos'
import { recorre } from './carga'
import type { ColeccionContada } from './campos'
```

- [ ] **Paso 14: Correr los tres y verlos pasar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS los tres, y los 769 de antes siguen verdes.

- [ ] **Paso 15: Probar que el tercer test tiene poder de detección**

Cambiá el `throw` por `return` (o sea: que se calle cuando falta el conteo) y corré:

Run: `pnpm exec vitest run test/contenido.test.ts -t 'truena si el esquema declara'`
Expected: FAIL. Restaurá el `throw`, volvé a correr, verde. Pegá las dos salidas.

Hacé lo mismo con el primero: cambiá `gravedad: 'avisa'` por `'impide'` y verificá que el test da rojo.

- [ ] **Paso 16: Compuerta y commit**

```bash
pnpm build
git add src/contenido/validacion.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: validar() ensambla el aviso de conteos, que no tenía productor

Las tres piezas existían desde la Parte A —el metadato `cuenta`, la regla
`cruzaConteo()` y el valor 'avisa' del tipo— y nadie las juntaba: la clase
de feature de tres piezas que se olvida. `validar()` es ahora el único
productor de 'avisa' del sistema.

Un `cuenta` declarado cuyo conteo no vino TRUENA en vez de callarse: un
conteo que falta es un error de cableado, y el silencio es exactamente
cómo esta feature quedó muerta la primera vez.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 2: El recorrido real de las uniones, y `serializa()` deja de escribir los derivados

Dos causas, dos commits, el mismo archivo.

**Files:**
- Modify: `src/contenido/carga.ts` — `recorre()`, `ordenaSegun()`, `serializa()`
- Modify: `src/contenido/validacion.ts` — `enRutas()` aprende a leer la variante
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: rutas de esquema con variante — `secciones[].bloques[]<tipo=parrafo>.texto`; `escapaInvisibles(json: string): string`.
- Consume: `MetaCampo.control` (ya existe), `desenvuelve()` (interno de `carga.ts`).

**Por qué.** Hoy `recorre()` y `ordenaSegun()` **tiran a propósito** cuando encuentran una unión, con el mensaje *«todavía no sé recorrer una unión… Lo agrega la fase 1 parte B, con los bloques de ficha»*. Es exactamente esta tarea: los bloques de las fichas técnicas son una `discriminatedUnion` de tres formas (`parrafo`, `lista`, `tabla`) y sin esto la Tarea 5 no puede ni serializar.

**Las internas de Zod, medidas contra 4.4.3 en esta máquina:**

```
union   → def.type = 'union'   | claves: type, options, discriminator, inclusive
literal → def.type = 'literal' | claves: type, values   (values es un ARRAY: ['parrafo'])
```

Que `discriminatedUnion` reporte `def.type === 'union'` y no `'discriminatedUnion'` es la razón por la que sin un `case` propio caería en el `default:` y se emitiría como HOJA, dejando invisibles todos los campos de todas las variantes sin un solo error.

### El formato de la ruta

Una variante se nombra `<clave=valor>` pegado al contenedor:

```
secciones[].bloques[]<tipo=parrafo>.texto
secciones[].bloques[]<tipo=lista>.items[]
secciones[].bloques[]<tipo=tabla>.encabezados[]
secciones[].bloques[]<tipo=tabla>.filas[][]
```

Lleva la CLAVE del discriminante además del valor —`<tipo=parrafo>` y no `<parrafo>`— para que la ruta se pueda instanciar contra el dato sin volver a consultar el esquema. Eso es lo que hace `enRutas()` en `validacion.ts`, y lo que va a hacer el panel cuando pinte un bloque.

Sin la variante en la ruta, las tres formas emitirían `bloques[].tipo` **tres veces con la misma ruta**: el candado «toda ruta del esquema existe en el dato» de la Tarea 16 no podría distinguirlas, y «todo campo tiene etiqueta» contaría un campo donde hay tres.

- [ ] **Paso 1: Los cuatro tests de la unión, que hoy fallan**

En `test/contenido.test.ts`:

```ts
describe('recorre() y serializa() sobre una unión discriminada', () => {
  const bloque = z.discriminatedUnion('tipo', [
    z.object({
      tipo: z.literal('parrafo'),
      texto: parrafo({ etiqueta: 'Párrafo', seccion: 'fichas', ayuda: 'Un párrafo de la ficha.', maxCaracteres: 600 }),
    }),
    z.object({
      tipo: z.literal('lista'),
      items: lista({
        etiqueta: 'Viñetas', seccion: 'fichas', ayuda: 'Las viñetas de la ficha.',
        minItems: 1, maxItems: 12,
        elemento: texto({ etiqueta: 'Viñeta', seccion: 'fichas', ayuda: 'Una viñeta.', maxCaracteres: 300 }),
      }),
    }),
  ])

  it('emite una rama por variante, con la variante en la ruta', () => {
    const rutas: string[] = []
    recorre(bloque, (ruta) => rutas.push(ruta))
    expect(rutas).toEqual([
      '<tipo=parrafo>.tipo',
      '<tipo=parrafo>.texto',
      '<tipo=lista>.tipo',
      '<tipo=lista>.items[]',
    ])
  })

  it('cada hoja de una variante conserva su etiqueta', () => {
    const etiquetas = new Map<string, string | undefined>()
    recorre(bloque, (ruta, meta) => etiquetas.set(ruta, meta?.etiqueta))
    expect(etiquetas.get('<tipo=parrafo>.texto')).toBe('Párrafo')
    expect(etiquetas.get('<tipo=lista>.items[]')).toBe('Viñeta')
  })

  it('serializa() elige la variante que dice el dato y reordena adentro', () => {
    const salida = serializa(bloque, { texto: 'Hola', tipo: 'parrafo' })
    expect(JSON.parse(salida)).toEqual({ tipo: 'parrafo', texto: 'Hola' })
    expect(Object.keys(JSON.parse(salida))).toEqual(['tipo', 'texto'])
  })

  it('serializa() truena si el discriminante no es ninguna variante', () => {
    expect(() => serializa(bloque, { tipo: 'tabla', filas: [] })).toThrow(
      /«tipo» dice «tabla», que no es ninguna de las variantes declaradas \(parrafo, lista\)/,
    )
  })
})
```

- [ ] **Paso 2: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'unión discriminada'`
Expected: los cuatro FAIL con `recorre(): todavía no sé recorrer una unión` y `serializa(): todavía no sé recorrer una unión`. Pegá la salida.

- [ ] **Paso 3: El lector del discriminante**

En `src/contenido/carga.ts`, arriba de `recorre()`:

```ts
/**
 * El valor literal del discriminante de una variante: 'parrafo' para el
 * bloque de párrafo de una ficha.
 *
 * Toca interna de Zod —`literal` guarda su valor en `def.values`, que es
 * un ARRAY aunque el literal sea uno solo— así que el canario de
 * `test/contenido.test.ts` lo afirma junto con las otras seis formas: si
 * una versión de Zod lo mueve, falla ahí y no adentro del panel.
 */
const varianteDe = (opcion: z.ZodType, discriminante: string, donde: string): string => {
  const shape = definicion(opcion).shape as Record<string, z.ZodType> | undefined
  const campo = shape?.[discriminante]
  const valores = campo && (definicion(campo).values as unknown[] | undefined)
  if (!Array.isArray(valores) || valores.length !== 1 || typeof valores[0] !== 'string') {
    throw new Error(
      `La variante de «${donde || '(raíz)'}» no declara «${discriminante}» como un valor fijo de texto.`,
    )
  }
  return valores[0]
}

/**
 * La marca de variante que va en la ruta: `<tipo=parrafo>`. Lleva la CLAVE
 * además del valor para que la ruta se pueda instanciar contra el dato sin
 * volver a mirar el esquema — es lo que hace `enRutas()` en validacion.ts
 * y lo que va a hacer el panel cuando pinte un bloque.
 */
const marcaDeVariante = (discriminante: string, valor: string): string =>
  `<${discriminante}=${valor}>`

/**
 * El discriminante de una unión, o el mensaje de por qué no se puede
 * recorrer. Las uniones del sistema son TODAS discriminadas; una unión a
 * secas no dice cuál de sus ramas mirar y no se puede ni recorrer ni
 * ordenar sin adivinar.
 */
const discriminanteDe = (quien: string, def: Def, donde: string): string => {
  const d = def.discriminator
  if (typeof d !== 'string') {
    todaviaNo(quien, 'una unión sin discriminante', donde,
      'Las uniones del sistema son discriminadas: la de bloques de ficha, por «tipo».')
  }
  return d as string
}
```

- [ ] **Paso 4: El caso de `recorre()`**

Reemplazá el `case 'union':` de `recorre()` (el que hoy llama a `todaviaNo`) por:

```ts
    case 'union': {
      // `z.discriminatedUnion` reporta `def.type === 'union'`, así que sin
      // este caso caería en `default` y se emitiría como HOJA: todos los
      // campos de todas las variantes quedarían invisibles para el panel,
      // sin un solo error.
      const discriminante = discriminanteDe('recorre', def, prefijo)
      for (const opcion of def.options as z.ZodType[]) {
        const variante = marcaDeVariante(discriminante, varianteDe(opcion, discriminante, prefijo))
        recorre(opcion, visita, `${prefijo}${variante}`)
      }
      return
    }
```

Borrá también la constante `PORQUE_UNION`, que queda sin usuarios.

- [ ] **Paso 5: El caso de `ordenaSegun()`**

Reemplazá el `case 'union':` de `ordenaSegun()` por:

```ts
    case 'union': {
      // La MISMA respuesta que recorre(), a propósito: las dos caminan el
      // mismo árbol y tienen que contestar lo mismo. Cuando no lo hacían
      // —recorre() tiraba y ordenaSegun() devolvía la unión cruda, dejando
      // pasar claves que el esquema no declara— la que callaba era justo
      // la que esta parte iba a pisar.
      const discriminante = discriminanteDe('serializa', def, ruta)
      if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
        throw new Error(`${donde}: el esquema espera un bloque y el dato trae ${typeof valor}.`)
      }
      const opciones = def.options as z.ZodType[]
      const nombres = opciones.map((o) => varianteDe(o, discriminante, ruta))
      const dice = (valor as Record<string, unknown>)[discriminante]
      const i = nombres.indexOf(dice as string)
      if (i === -1) {
        throw new Error(
          `${donde}: «${discriminante}» dice «${String(dice)}», que no es ninguna de las variantes declaradas (${nombres.join(', ')}).`,
        )
      }
      return ordenaSegun(opciones[i], valor, ruta)
    }
```

- [ ] **Paso 6: `enRutas()` aprende a leer la variante**

En `src/contenido/validacion.ts`, reemplazá el cuerpo del `for` de `enRutas()` para que entienda las tres cosas que una parte de ruta puede traer: la clave, el `[]` de lista y la marca de variante.

```ts
/**
 * Una parte de ruta puede traer tres cosas: la clave (`bloques`), el `[]`
 * de una lista y la marca de variante de una unión (`<tipo=parrafo>`).
 * 'bloques[]<tipo=parrafo>' trae las tres.
 */
const PARTE = /^([^<[]*)(\[\])?(?:<([^=>]+)=([^>]+)>)?$/

const enRutas = (dato: unknown, ruta: string): { ruta: string; valor: unknown }[] => {
  let actuales: { ruta: string; valor: unknown }[] = [{ ruta: '', valor: dato }]
  for (const parte of ruta.split('.')) {
    const m = PARTE.exec(parte)
    if (!m) throw new Error(`enRutas(): no entiendo la parte «${parte}» de la ruta «${ruta}».`)
    const [, clave, corchetes, discriminante, variante] = m
    const siguiente: { ruta: string; valor: unknown }[] = []
    for (const { ruta: r, valor } of actuales) {
      if (valor === null || valor === undefined) continue
      const base = clave ? une(r, clave) : r
      const dentro = clave ? (valor as Record<string, unknown>)[clave] : valor
      // Sin corchetes hay un solo candidato; con corchetes, uno por elemento.
      const candidatos = corchetes
        ? Array.isArray(dentro)
          ? dentro.map((v, i) => ({ ruta: une(base, i), valor: v }))
          : []
        : [{ ruta: base, valor: dentro }]
      for (const c of candidatos) {
        // La variante FILTRA: la rama <tipo=parrafo> del esquema solo
        // aplica a los bloques cuyo dato dice tipo: 'parrafo'.
        if (discriminante !== undefined) {
          const v = c.valor as Record<string, unknown> | null
          if (v === null || typeof v !== 'object' || v[discriminante] !== variante) continue
        }
        siguiente.push(c)
      }
    }
    actuales = siguiente
  }
  return actuales
}
```

- [ ] **Paso 7: Correr los cuatro y verlos pasar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS los cuatro, 769 + los nuevos, todos verdes.

- [ ] **Paso 8: El canario aprende las dos formas nuevas**

En `test/contenido.test.ts`, en el test que ya afirma las formas de `_zod.def`, agregá las dos filas. **Afirmá `def.type`, no solo los nombres de las claves** — en la Parte A el canario afirmaba las claves y no el tipo, y el revisor lo llamó «verificaste la vitrina, no la cerradura».

```ts
  it('discriminatedUnion reporta type «union» y guarda discriminator + options', () => {
    const u = z.discriminatedUnion('tipo', [
      z.object({ tipo: z.literal('parrafo'), texto: z.string() }),
      z.object({ tipo: z.literal('lista'), items: z.array(z.string()) }),
    ])
    const def = (u as unknown as { _zod: { def: Record<string, unknown> } })._zod.def
    expect(def.type).toBe('union')
    expect(Object.keys(def).sort()).toEqual(['discriminator', 'inclusive', 'options', 'type'])
    expect(def.discriminator).toBe('tipo')
    expect(Array.isArray(def.options)).toBe(true)
  })

  it('literal reporta type «literal» y guarda su valor en un ARRAY', () => {
    // Un array aunque el literal sea uno solo. varianteDe() lo desarma
    // asumiendo exactamente eso.
    const def = (z.literal('parrafo') as unknown as { _zod: { def: Record<string, unknown> } })._zod.def
    expect(def.type).toBe('literal')
    expect(Object.keys(def).sort()).toEqual(['type', 'values'])
    expect(def.values).toEqual(['parrafo'])
  })
```

- [ ] **Paso 9: Probar que los tests de la unión tienen poder de detección**

Tres mutaciones, una por vez, restaurando entre cada una:

1. En `recorre()`, sacá la marca de variante del prefijo (`recorre(opcion, visita, prefijo)`) → el primer test tiene que dar **rojo** por rutas duplicadas.
2. En `ordenaSegun()`, devolvé `valor` tal cual en vez de bajar a la variante → el tercer test tiene que dar **rojo** (no reordena: las claves salen `texto, tipo`).
3. En `varianteDe()`, devolvé `valores[0]` sin el chequeo de forma → el canario del literal tiene que seguir verde, pero cambiá `def.values` por `def.value` en el acceso y el tercer test tiene que dar **rojo**.

Pegá las tres salidas en rojo y las tres restauradas en verde.

- [ ] **Paso 10: Compuerta y commit**

```bash
pnpm build
git add src/contenido/carga.ts src/contenido/validacion.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: recorre() y serializa() atraviesan las uniones discriminadas

Las dos tiraban a propósito desde la Parte A, esperando el caso real: los
bloques de las fichas técnicas son una unión de tres formas. La ruta lleva
la variante con su clave —<tipo=parrafo>— para que se pueda instanciar
contra el dato sin volver a mirar el esquema, y para que las tres formas
no emitan `bloques[].tipo` tres veces con la misma ruta.

Las dos funciones contestan lo mismo a la misma pregunta, que es la
lección que este archivo ya pagó cuatro veces.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Paso 11: Los dos tests de los derivados, que hoy fallan**

Segundo commit, otra causa. En `test/contenido.test.ts`:

```ts
describe('los campos derivados no viajan al JSON', () => {
  const conDerivado = grupo({
    etiqueta: 'Gotas', seccion: 'productos', ayuda: 'El bloque de las gotas.',
    campos: {
      titulo: texto({ etiqueta: 'Título', seccion: 'productos', ayuda: 'El título del bloque.', maxCaracteres: 50 }),
      precioDesde: derivado({
        etiqueta: 'Precio desde', seccion: 'productos',
        ayuda: 'El precio más bajo de las bolsas de gotas.',
        saleDe: 'el precio más bajo de las bolsas de gotas',
      }),
    },
  })

  it('serializa() no escribe el derivado', () => {
    const salida = JSON.parse(serializa(conDerivado, { titulo: 'Gotas', precioDesde: 258 }))
    expect(salida).toEqual({ titulo: 'Gotas' })
  })

  it('cargar() SÍ lo exige: la fachada tiene que injertarlo antes', () => {
    // Es el contrato con la fachada. Si cargar() lo dejara pasar, el sitio
    // publicaría un `undefined` donde va un precio y nada avisaría.
    expect(() => cargar('prueba.json', conDerivado, { titulo: 'Gotas' })).toThrow(/precioDesde/)
  })
})
```

- [ ] **Paso 12: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'derivados no viajan'`
Expected: el primero FAIL (`serializa()` escribe `precioDesde: 258`); el segundo ya pasa (`cargar()` exige la clave desde siempre) — dejalo igual, es el contrato que hay que clavar para que nadie lo afloje después.

- [ ] **Paso 13: `serializa()` omite los derivados, y la regla de los invisibles sale a la luz**

En `src/contenido/carga.ts`, en el `case 'object':` de `ordenaSegun()`, dentro del `for` de claves, justo después del `desenvuelve(hijo)` (pedile también el `meta`):

```ts
        const { fondo, opcional, meta } = desenvuelve(hijo)
        // Un derivado no se escribe: se calcula (ver derivados.ts). Vive en
        // el esquema para que el panel lo dibuje en gris con su
        // explicación, y en el objeto que cargar() valida, pero no en el
        // archivo — si estuviera, se podría editar a mano y el sitio
        // publicaría un precio que no coincide con ningún producto.
        if (meta?.control === 'derivado') continue
```

Y extraé el escapador de invisibles, que deja de ser privado de `serializa()`:

```ts
/**
 * Los invisibles salen escapados: el espacio duro, los espacios finos, los
 * de ancho cero y el BOM. Es la convención que el repo ya tiene —hoy hay
 * CERO caracteres U+00A0 literales en el fuente— y existe porque un
 * copiar-y-pegar se los come sin dejar rastro. En la Parte A esto mordió a
 * cuatro implementadores, en las dos direcciones.
 *
 * Exportada porque `serializa()` no es su único usuario: el script de
 * migración escribe el fixture con la misma regla, y dos copias de esta
 * regla es exactamente la clase de bug que esta capa existe para no tener.
 */
export const escapaInvisibles = (json: string): string =>
  json.replace(
    // Escritos como \u para que este archivo no dependa de caracteres que
    // un copiar-y-pegar puede comerse.
    /[\u00a0\u2000-\u200d\ufeff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
```

Y `serializa()` la usa:

```ts
export function serializa<E extends z.ZodType>(esquema: E, valor: unknown): string {
  return escapaInvisibles(JSON.stringify(ordenaSegun(esquema, valor, ''), null, 2))
}
```

- [ ] **Paso 14: Correr y verificar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS todo. Verificá además que el test viejo de bytes canónicos con espacio duro sigue verde: la extracción no cambió el comportamiento.

- [ ] **Paso 15: Probar el poder de detección**

Sacá el `if (meta?.control === 'derivado') continue` → el primer test da **rojo**. Restaurá. Pegá las dos salidas.

- [ ] **Paso 16: Compuerta y commit**

```bash
pnpm build
git add src/contenido/carga.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: serializa() omite los derivados y el escapador de invisibles se comparte

Un derivado vive en el esquema para que el panel lo dibuje en gris, y en
el objeto que cargar() valida, pero no en el archivo: si estuviera, se
podría editar a mano y el sitio publicaría un precio que no coincide con
ningún producto. cargar() lo sigue exigiendo — ese es el contrato con la
fachada, y ahora tiene un test que lo dice.

El escapador de invisibles sale a la luz porque el script de migración lo
necesita para el fixture. Dos copias de esa regla es la clase de bug que
esta capa existe para no tener.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 3: El fixture — la foto del árbol viejo

**Files:**
- Create: `scripts/migra-contenido.ts`
- Create: `test/fixtures/contenido-2026-09-10.json` (lo escribe el script)
- Modify: `package.json` — un script `migra`

**Interfaces:**
- Produce: `pnpm migra fixture`, y el archivo `test/fixtures/contenido-2026-09-10.json` con las claves `marca`, `sabores`, `gotas`, `polvo`, `urlCatalogoBarras`, `fichas`.
- Consume: `escapaInvisibles` de `../src/contenido/carga` (Tarea 2).

**Por qué esta tarea va antes de tocar una sola fachada.** El fixture es la foto del árbol **viejo**. Si se sacara después de reescribir una fachada, dejaría de probar nada: estaría comparando el resultado contra sí mismo. Y es lo que reemplaza al golden HTML del diseño original, con la ventaja de probar lo que el golden no probaba — que **la fachada re-exporte el mismo objeto**. El JSON puede estar perfecto y la fachada devolver `undefined` donde había valor, reordenar un array o coercer un número.

**Nadie tipea contenido a mano.** El script importa los módulos `as const` vivos y escribe. Por eso nadie puede cambiar una coma.

- [ ] **Paso 1: El script, modo fixture**

Create `scripts/migra-contenido.ts`:

```ts
/*
 * La migración del contenido, en dos modos.
 *
 *   pnpm migra fixture   → escribe test/fixtures/contenido-2026-09-10.json
 *                          leyendo los módulos `as const` VIVOS. Se corre
 *                          UNA vez, antes de tocar ninguna fachada.
 *   pnpm migra <doc>     → escribe src/contenido/datos/<doc>.json con
 *                          serializa(), que recorre el esquema: si el
 *                          esquema declara una ruta que el objeto no tiene
 *                          —o al revés— TIRA antes de escribir. Eso es lo
 *                          que prueba que el esquema describe exactamente
 *                          el contenido de hoy.
 *
 * Este archivo NO está bajo src/contenido/, así que sí puede usar node:fs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { escapaInvisibles } from '../src/contenido/carga'
import { marca } from '../src/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '../src/copy/sabores'
import { fichasBase } from '../src/fichas/base'

const FIXTURE = 'test/fixtures/contenido-2026-09-10.json'

/**
 * La forma pura del objeto, sin `readonly`, sin `undefined` y sin
 * prototipos: exactamente lo que un JSON puede representar. Es la misma
 * transformación que va a sufrir el contenido al pasar por el archivo, así
 * que compararlo contra esto compara lo que de verdad importa.
 */
const estructura = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/**
 * Recibe TEXTO ya listo, no un objeto: los documentos los produce
 * `serializa()`, que además de escapar ordena las claves según el esquema.
 * Si esta función stringificara por su cuenta, habría dos maneras de
 * escribir un JSON en el sistema y una sola de leerlo.
 */
function escribe(ruta: string, texto: string): void {
  mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true })
  writeFileSync(ruta, texto.endsWith('\n') ? texto : texto + '\n', 'utf8')
  console.log(`escrito: ${ruta}`)
}

function capturaFixture(): void {
  escribe(
    FIXTURE,
    escapaInvisibles(
      JSON.stringify(
        {
          marca: estructura(marca),
          sabores: estructura(sabores),
          gotas: estructura(gotas),
          polvo: estructura(polvo),
          urlCatalogoBarras,
          fichas: estructura(fichasBase),
        },
        null,
        2,
      ),
    ),
  )
}

const modo = process.argv[2]
if (modo === 'fixture') capturaFixture()
else {
  console.error(`Modo desconocido: «${modo ?? '(ninguno)'}». Modos: fixture`)
  process.exit(1)
}
```

- [ ] **Paso 2: El script de `package.json`**

En `"scripts"`, después de `"fichas"`:

```json
    "migra": "tsx scripts/migra-contenido.ts"
```

- [ ] **Paso 3: Correrlo**

Run: `pnpm migra fixture`
Expected: `escrito: test/fixtures/contenido-2026-09-10.json`

- [ ] **Paso 4: Verificar la foto a mano, que es lo único que se verifica a mano en toda la fase**

```bash
# Los ocho espacios duros salieron escapados, no literales:
python3 -c "
import io; s=io.open('test/fixtures/contenido-2026-09-10.json',encoding='utf-8').read()
print('nbsp literales:', s.count(chr(0xa0)))
print('escapes u00a0:', s.count('\\\\u00a0'))
"
# Las claves de primer nivel:
python3 -c "
import json; d=json.load(open('test/fixtures/contenido-2026-09-10.json'))
print(sorted(d))
print('sabores:', len(d['sabores']), '| gotas:', len(d['gotas']), '| polvo:', len(d['polvo']), '| fichas:', len(d['fichas']))
print('bloques de marca:', len(d['marca']))
"
```

Expected, exacto:
```
nbsp literales: 0
escapes u00a0: 9
['fichas', 'gotas', 'marca', 'polvo', 'sabores', 'urlCatalogoBarras']
sabores: 15 | gotas: 6 | polvo: 8 | fichas: 4
bloques de marca: 21
```

Si el conteo de escapes no da **9**, parás. Son las nueve apariciones medidas del espacio duro (`anaquel.pesoInsignia`, `gotas.titulo`, `polvoCard.titulo`, `negocios.tabs[0].titulo` ×2, `tabs[1].titulo`, `tabs[2].titulo`, `footer.productos[0].texto`, `footer.productos[1].texto`) y son exactamente lo que la clienta puede romper sin verlo.

- [ ] **Paso 5: El test que prueba que el fixture NO está vacío ni truncado**

En `test/contenido.test.ts`, un test corto — el fixture es la red de toda la fase y merece un guard propio:

```ts
it('el fixture del árbol viejo está entero', async () => {
  // Si este archivo se trunca o se regenera contra el árbol NUEVO, el
  // certificado de la Tarea 14 se vuelve una comparación de algo contra sí
  // mismo: verde y sin valor. Esto no lo impide, pero lo hace ruidoso.
  const fixture = (await import('./fixtures/contenido-2026-09-10.json')).default
  expect(Object.keys(fixture).sort()).toEqual(
    ['fichas', 'gotas', 'marca', 'polvo', 'sabores', 'urlCatalogoBarras'],
  )
  expect(fixture.sabores).toHaveLength(15)
  expect(fixture.fichas).toHaveLength(4)
  expect(Object.keys(fixture.marca)).toHaveLength(21)
})
```

- [ ] **Paso 6: Correr y verificar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'fixture del árbol viejo'`
Expected: PASS.

Para probar que detecta: borrá dos sabores del fixture, corré (rojo), restaurá con `git checkout test/fixtures/`, corré (verde). Pegá las dos salidas.

- [ ] **Paso 7: Compuerta y commit**

```bash
pnpm build
git add scripts/migra-contenido.ts package.json test/fixtures/contenido-2026-09-10.json test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el fixture del árbol viejo, escrito por el script y no a mano

La foto del contenido de hoy, capturada de los módulos `as const` vivos
ANTES de tocar ninguna fachada. Es lo que reemplaza al golden HTML, y
prueba lo que el golden no probaba: que la fachada re-exporte el mismo
objeto. El JSON puede estar perfecto y la fachada devolver undefined donde
había valor, reordenar un array o coercer un número.

Nadie tipeó una coma: por eso nadie pudo cambiarla.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 4: El documento de productos — esquema, migración y fachada

El documento más chico de los tres, y va primero a propósito: prueba la tubería entera —esquema → `serializa()` → JSON → `cargar()` → fachada— sobre 15 sabores, 6 gotas y 8 polvos, antes de escribir los 198 campos del sitio contra una tubería que nadie recorrió.

**Files:**
- Create: `src/contenido/esquema/sabores.ts`
- Create: `src/contenido/esquema/index.ts`
- Create: `src/contenido/datos/sabores.json` (lo escribe el script, no lo escribís vos)
- Modify: `src/contenido/campos.ts` — `claveSabor` pasa a producir el tipo que `index.astro` necesita
- Modify: `scripts/migra-contenido.ts` — el modo `sabores`
- Modify: `src/copy/sabores.ts` — 98 → ~20 líneas
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `esquemaSabores` (un `grupo` con `urlCatalogoBarras`, `sabores`, `gotas`, `polvo`), con la regla de contraste ≥4.5 sobre cada barra; `DOCUMENTOS` e `IdDocumento` en `esquema/index.ts`; y las mismas exportaciones de siempre en `src/copy/sabores.ts`: `Sabor`, `sabores`, `gotas`, `polvo`, `urlCatalogoBarras`.
- Consume: los constructores de `campos.ts`, `cargar` y `serializa` de `carga.ts`, y `resuelveColor` / `mejorTinta` / `contrasteSuficiente` de `color-sabor.ts` — que existen desde la Parte A y hasta ahora no tenían un solo consumidor.

**Lo que NO puede cambiar.** `index.astro` indexa los tokens de color con la clave del sabor en **siete** lugares (`colorSabor[s.clave]`, `tintaSabor[paso.clave]`, `tintaClara(r.clave)`…) y `tintaClara` está tipada `(clave: keyof typeof tintaSabor)`. Si el esquema tipa `clave` como `string` a secas, `astro check` da siete errores y **no se puede tocar `index.astro` en esta fase**. Por eso el primer paso de esta tarea es el tipo, no el esquema.

### Ruling F — `cargar()` no cruza los conteos; el candado vive en un test

El spec (§1.3) describe `cargar(archivo, esquema, crudo, conteos)` cruzando la regla `cuenta`. No lo hago así, por una razón que el spec mismo da en la §2: los conteos producen `gravedad: 'avisa'`, y un aviso **no impide publicar**. Si `cargar()` tirara por un aviso, sería `'impide'` con otro nombre; si no tirara, el cuarto argumento no haría nada.

Donde sí tiene que fallar es en el **build**, y ahí llega igual: `pnpm build` corre la suite, y el candado de la Tarea 16 afirma `validar(esquema, datos, conteos)` → `[]`, avisos incluidos. Mismo momento, misma compuerta, sin darle a `cargar()` una responsabilidad que no puede cumplir.

*Costo si me equivoco:* un conteo viejo lo caza el test en vez del import. Los dos corren adentro de `pnpm build`.

- [ ] **Paso 1: El test del tipo de `claveSabor`, que hoy falla**

En `test/contenido.test.ts` (agregá `expectTypeOf` al import de vitest). **El primero de los dos es una aserción de TIPO: `expectTypeOf` se borra en runtime, así que su rojo sale en `pnpm typecheck`, no en `vitest run`.** El segundo sí es de runtime.

```ts
it('claveSabor produce el tipo con el que index.astro indexa los tokens', () => {
  // index.astro hace colorSabor[s.clave] y tintaClara(r.clave), con
  // tintaClara tipada (clave: keyof typeof tintaSabor), en siete lugares.
  // Con `clave` tipada `string` a secas son siete errores de astro check —
  // y esta fase no puede tocar un solo .astro.
  const campo = claveSabor({ etiqueta: 'Sabor', seccion: 'sabores', ayuda: 'Qué sabor pinta este bloque.' })
  expectTypeOf<z.infer<typeof campo>>().toEqualTypeOf<keyof typeof tokens.sabor>()
})

it('las claves de sabor del esquema son exactamente las del token', () => {
  // El cast de Object.keys() es lo único que sostiene el tipo de arriba.
  // Si el token gana un sabor y esta lista no, el cast miente en silencio.
  expect([...CLAVES_DE_SABOR].sort()).toEqual(Object.keys(tokens.sabor).sort())
})
```

- [ ] **Paso 2: Correrlos y verlos fallar**

Run: `pnpm typecheck` (para el del tipo) y `pnpm exec vitest run test/contenido.test.ts -t 'claves de sabor del esquema'` (para el de runtime).
Expected: los dos FAIL — el tipo inferido es `string`, y `CLAVES_DE_SABOR` no existe. Pegá las dos salidas.

- [ ] **Paso 3: `claveSabor` pasa de `refine` a `enum`**

En `src/contenido/campos.ts`, reemplazá `claveSabor` por:

```ts
/**
 * Las claves del token `sabor`, con su tipo literal conservado.
 *
 * El cast es lo que hace que `z.enum` infiera la unión de literales en vez
 * de `string`, y eso es lo que `index.astro` necesita: indexa `colorSabor`
 * y `tintaSabor` con esta clave en siete lugares, y `tintaClara` la pide
 * tipada. Un test afirma que esta lista y las claves del token son la
 * misma, porque el cast por sí solo no lo garantiza.
 */
export const CLAVES_DE_SABOR = Object.keys(sabor) as [
  keyof typeof sabor,
  ...Array<keyof typeof sabor>,
]

/**
 * Una clave del token `sabor`. No es texto: nombra el color de la banda,
 * la tinta medida y seis archivos de imagen. La clienta no la ve.
 *
 * `z.enum` y no `z.string().refine()` por el TIPO: refine devuelve
 * `string`, y con eso `astro check` da siete errores en index.astro que
 * esta fase no puede arreglar porque no toca .astro.
 */
export const claveSabor = (meta: Base) =>
  anota(z.enum(CLAVES_DE_SABOR, 'No es un sabor del sistema de color.'), {
    control: 'oculto',
    quien: 'marcos',
    ...meta,
  })
```

- [ ] **Paso 4: Correr y verificar**

Run: `pnpm exec vitest run test/contenido.test.ts`
Expected: PASS los dos nuevos y todos los viejos. **Si algún test viejo de `claveSabor` esperaba el mensaje de error de `refine`, el mensaje ahora sale de `z.enum` — es el mismo texto, así que no debería cambiar nada. Si cambia, arreglá el test viejo y decilo en el reporte.**

Para probar que detecta: cambiá `z.enum(...)` por `z.string()` → el primer test da rojo. Restaurá.

- [ ] **Paso 5: Commit**

```bash
git add src/contenido/campos.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
fix: claveSabor conserva el tipo con el que index.astro indexa los tokens

z.string().refine() devuelve `string`, y index.astro indexa colorSabor y
tintaSabor con esta clave en siete lugares —tintaClara la pide tipada—.
Con `string` a secas son siete errores de astro check en una fase que no
puede tocar un solo .astro. z.enum sobre las claves del token conserva la
unión, y un test afirma que la lista y el token no se separan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Paso 6: El esquema**

Create `src/contenido/esquema/sabores.ts`. **Los topes son el máximo medido de hoy × 1,6 redondeado a la decena, con piso de 20**: son techo de cordura, no límite de diseño — quien decide si un texto entra es el medidor de la fase 4, midiendo la página de verdad, porque 31 «W» miden 426 px y 31 «i» miden 142 px.

| Campo | Largo hoy | Tope |
|---|---|---|
| `sabores[].nombre` | 19 («Tamarindo con chile») | 40 |
| `sabores[].cacao` | 16 («Chocolate blanco») | 30 |
| `sabores[].ingredientes` | 113 | 190 |
| `gotas[].nombre` | 18 | 30 |
| `polvo[].nombre` | 18 | 30 |

```ts
/*
 * La forma de los productos: las 15 barras, las 6 bolsas de gotas y las 8
 * variedades de polvo.
 *
 * Los nombres son los IMPRESOS en la envoltura, no los del catálogo
 * (decisión del cliente, 2026-08-13): la envoltura es la autoridad porque
 * es lo que la persona lee en el producto que compra.
 *
 * Los topes de caracteres son TECHO DE CORDURA, generosos a propósito. Si
 * un texto entra o no lo decide el medidor de la fase 4 midiendo la página
 * de verdad; el panel dice «tope de seguridad», nunca «cabe».
 */
import { grupo, lista, texto, precio, numero, slug, archivo, claveSabor, url } from '../campos'
import { resuelveColor, mejorTinta, contrasteSuficiente } from '../color-sabor'

const sabor = grupo({
  etiqueta: 'Barra',
  seccion: 'sabores',
  ayuda: 'Una de las barras del anaquel.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Barra',
  campos: {
    orden: numero({
      etiqueta: 'Número de la serie',
      seccion: 'sabores',
      ayuda: 'La numeración impresa en la envoltura. La barra 3 dice «Barra n.º 3».',
      minValor: 1,
      maxValor: 99,
    }),
    slug: slug({
      etiqueta: 'Nombre del archivo',
      seccion: 'sabores',
      ayuda: 'Con este nombre se guardan las seis fotos de esta barra. No se cambia.',
    }),
    clave: claveSabor({
      etiqueta: 'Color de la banda',
      seccion: 'sabores',
      ayuda: 'De aquí salen el color de fondo y el color de la letra de esta barra.',
    }),
    nombre: texto({
      etiqueta: 'Nombre del sabor',
      seccion: 'sabores',
      ayuda: 'Como está impreso en la envoltura. Aparece en el anaquel y en el catálogo.',
      maxCaracteres: 40,
    }),
    cacao: texto({
      etiqueta: 'Porcentaje de cacao',
      seccion: 'sabores',
      ayuda: 'La línea chica bajo el nombre: «Cacao 70%» o «Chocolate blanco».',
      maxCaracteres: 30,
    }),
    precio: precio({
      etiqueta: 'Precio de la barra',
      seccion: 'sabores',
      ayuda: 'En pesos, sin centavos. De aquí sale el «desde» de la pestaña Para negocios.',
    }),
    ingredientes: texto({
      etiqueta: 'Ingredientes',
      seccion: 'sabores',
      ayuda: 'Copiados de la envoltura impresa, en el mismo orden. Es información legal.',
      maxCaracteres: 190,
    }),
    catalogo: url({
      etiqueta: 'Página en el catálogo',
      seccion: 'sabores',
      ayuda: 'La dirección de esta barra en la tienda en línea. Vacío si todavía no está dada de alta.',
    }).nullable(),
  },
})

const gota = grupo({
  etiqueta: 'Bolsa de gotas',
  seccion: 'productos',
  ayuda: 'Una de las bolsas de gotas de 250 g.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Bolsa',
  campos: {
    clave: claveSabor({
      etiqueta: 'Color del punto',
      seccion: 'productos',
      ayuda: 'De aquí sale el color del puntito que acompaña a este sabor.',
    }),
    nombre: texto({
      etiqueta: 'Nombre del sabor',
      seccion: 'productos',
      ayuda: 'Se escribe igual que en la barra del mismo sabor, para que se llame igual en todo el sitio.',
      maxCaracteres: 30,
    }),
    precio: precio({
      etiqueta: 'Precio de la bolsa',
      seccion: 'productos',
      ayuda: 'En pesos, sin centavos. De aquí sale el «desde» del bloque de gotas.',
    }),
  },
})

const variedadDePolvo = grupo({
  etiqueta: 'Variedad de polvo',
  seccion: 'productos',
  ayuda: 'Una de las etiquetas del chocolate en polvo.',
  nombra: (v) => (v as { nombre?: string }).nombre ?? 'Variedad',
  campos: {
    archivo: archivo({
      etiqueta: 'Nombre del archivo de la etiqueta',
      seccion: 'productos',
      ayuda: 'Con este nombre se guarda la foto de la etiqueta. No se cambia.',
    }),
    nombre: texto({
      etiqueta: 'Nombre de la variedad',
      seccion: 'productos',
      ayuda: 'Aparece bajo su etiqueta en el bloque «Chocolate para beber».',
      maxCaracteres: 30,
    }),
  },
})

/**
 * El contraste entre la banda de color y la tinta tiene que dar 4.5 o más:
 * es lo que hace que el nombre del sabor se lea encima de su propio color.
 *
 * Hereda la excepción que YA está declarada en los tokens
 * (`saboresSoloDisplay`, src/tokens/color.ts:182): hoy la hierbabuena da
 * 4.41 y está ahí a propósito. La regla la LEE de ahí en vez de
 * reinventarla — dos listas de excepciones es cómo una excepción
 * deliberada se convierte en un bug seis meses después.
 *
 * Va como `.superRefine()` sobre el grupo y no sobre `clave` porque
 * necesita las dos cosas: el color sale de `clave` y la excepción se
 * consulta por `slug`. Verificado contra zod 4.4.3: `.superRefine()` sobre
 * un objeto conserva `def.type === 'object'` y su `shape`, así que
 * `recorre()` y `serializa()` lo siguen atravesando, y el registro del
 * panel sigue la cadena de padres a través de él. El problema se reporta
 * en `clave`, que es el campo que la clienta tendría que cambiar.
 */
const saborConContraste = sabor.superRefine((v, ctx) => {
  const fondo = resuelveColor(v.clave)
  const tinta = mejorTinta(v.clave)
  // Si alguno falta, `claveSabor` ya emitió su propio problema: agregar
  // otro sobre el mismo campo es hacerle leer dos veces lo mismo.
  if (fondo === undefined || tinta === undefined) return
  if (!contrasteSuficiente(fondo, tinta, v.slug)) {
    ctx.addIssue({
      code: 'custom',
      path: ['clave'],
      message: 'Con ese color, el nombre del sabor no se alcanza a leer encima. Elegí otro.',
    })
  }
})

/** El documento entero de productos. */
export const esquemaSabores = grupo({
  etiqueta: 'Productos',
  seccion: 'sabores',
  ayuda: 'Las barras, las bolsas de gotas y el chocolate en polvo.',
  campos: {
    urlCatalogoBarras: url({
      etiqueta: 'Categoría de barras en el catálogo',
      seccion: 'sabores',
      ayuda: 'A dónde lleva «Ver en el catálogo» cuando una barra todavía no está dada de alta.',
    }),
    // Los mínimos y máximos son de cordura, no de negocio: hoy son 15, y
    // que sigan siendo 15 lo vigilan los tests de conteo hasta la fase 7,
    // que es cuando existe el alta de ítems.
    sabores: lista({
      etiqueta: 'Las barras',
      seccion: 'sabores',
      ayuda: 'El anaquel completo, en el orden en que se muestran.',
      minItems: 1,
      maxItems: 30,
      elemento: saborConContraste,
    }),
    gotas: lista({
      etiqueta: 'Las bolsas de gotas',
      seccion: 'productos',
      ayuda: 'Los sabores que hay en bolsa de 250 g.',
      minItems: 1,
      maxItems: 15,
      elemento: gota,
    }),
    polvo: lista({
      etiqueta: 'Las variedades de polvo',
      seccion: 'productos',
      ayuda: 'Las etiquetas del chocolate en polvo, todavía no a la venta.',
      minItems: 1,
      maxItems: 20,
      elemento: variedadDePolvo,
    }),
  },
})
```

- [ ] **Paso 7: El índice de documentos**

Create `src/contenido/esquema/index.ts`:

```ts
/*
 * El mapa de los documentos del sistema. Crece con cada documento que se
 * migra: primero productos, después fichas, después el sitio.
 *
 * Lo van a leer el panel (para saber qué puede editar), la función de
 * publicación (para revalidar todo desde cero antes de tocar GitHub) y los
 * candados de test.
 */
import type { z } from 'zod'
import { esquemaSabores } from './sabores'

export type IdDocumento = 'sabores'

export const DOCUMENTOS = {
  sabores: esquemaSabores,
} as const satisfies Readonly<Record<IdDocumento, z.ZodType>>
```

- [ ] **Paso 8: El modo `sabores` del script**

En `scripts/migra-contenido.ts`, agregá el import de `serializa` y del esquema, la función y el despacho:

```ts
import { escapaInvisibles, serializa } from '../src/contenido/carga'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
```

```ts
/**
 * Escribe el documento de productos.
 *
 * `serializa()` recorre el ESQUEMA: si el esquema declara una ruta que el
 * objeto no tiene —o el objeto trae una clave que el esquema no declara—
 * tira antes de escribir nada. Eso es lo que prueba que el esquema
 * describe exactamente el contenido de hoy, y por eso no hace falta
 * revisar el JSON a ojo.
 */
function migraSabores(): void {
  escribe(
    'src/contenido/datos/sabores.json',
    serializa(esquemaSabores, {
      urlCatalogoBarras,
      sabores: estructura(sabores),
      gotas: estructura(gotas),
      polvo: estructura(polvo),
    }),
  )
}
```

Y el despacho al final del archivo:

```ts
const modo = process.argv[2]
if (modo === 'fixture') capturaFixture()
else if (modo === 'sabores') migraSabores()
else {
  console.error(`Modo desconocido: «${modo ?? '(ninguno)'}». Modos: fixture, sabores`)
  process.exit(1)
}
```

- [ ] **Paso 9: Correrlo, y leer con atención si truena**

Run: `pnpm migra sabores`
Expected: `escrito: src/contenido/datos/sabores.json`

**Si truena, el mensaje te dice exactamente qué falta y dónde** (`sabores.3: falta «cacao», que el esquema declara`). Eso es el esquema equivocado, no el contenido: arreglá el esquema y volvé a correr. **No toques el contenido.**

- [ ] **Paso 10: Verificar el archivo escrito**

```bash
python3 -c "
import json, io
s = io.open('src/contenido/datos/sabores.json', encoding='utf-8').read()
d = json.loads(s)
print('nbsp literales:', s.count(chr(0xa0)))
print('claves:', list(d))
print('sabores:', len(d['sabores']), '| gotas:', len(d['gotas']), '| polvo:', len(d['polvo']))
print('orden de claves del primer sabor:', list(d['sabores'][0]))
"
```

Expected, exacto:
```
nbsp literales: 0
claves: ['urlCatalogoBarras', 'sabores', 'gotas', 'polvo']
sabores: 15 | gotas: 6 | polvo: 8
orden de claves del primer sabor: ['orden', 'slug', 'clave', 'nombre', 'cacao', 'precio', 'ingredientes', 'catalogo']
```

El orden de claves sale del ESQUEMA, no del objeto: es lo que hace que dos guardados seguidos den el mismo archivo.

- [ ] **Paso 11: El test de la ida y vuelta, antes de tocar la fachada**

```ts
it('el documento de productos vuelve a salir idéntico', async () => {
  // Bytes canónicos: si esto no se cumple, dos guardados seguidos producen
  // diffs distintos sin que haya cambiado nada, y el historial del repo
  // se llena de ruido que esconde los cambios de verdad.
  const bytes = readFileSync('src/contenido/datos/sabores.json', 'utf8')
  const cargado = cargar('src/contenido/datos/sabores.json', esquemaSabores, JSON.parse(bytes))
  expect(serializa(esquemaSabores, cargado) + '\n').toBe(bytes)
})
```

- [ ] **Paso 11 bis: Los dos tests de la regla de contraste**

```ts
describe('el contraste de la banda de cada sabor', () => {
  const unSabor = {
    orden: 1, slug: 'canela', clave: 'canela', nombre: 'Canela', cacao: 'Cacao 70%',
    precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural',
    catalogo: null,
  }
  const doc = (sabor: object) => ({
    urlCatalogoBarras: 'https://chocolateria.pulpos.shop',
    sabores: [sabor], gotas: [{ clave: 'canela', nombre: 'Canela', precio: 258 }],
    polvo: [{ archivo: 'etiqueta-canela', nombre: 'Canela' }],
  })

  it('los 15 sabores de hoy pasan la regla', () => {
    const bytes = readFileSync('src/contenido/datos/sabores.json', 'utf8')
    expect(validar(esquemaSabores, JSON.parse(bytes), {})).toEqual([])
  })

  it('hereda la excepción de los tokens en vez de reinventarla', () => {
    // La hierbabuena da 4.41 —abajo del 4.5— y está declarada
    // `saboresSoloDisplay` en src/tokens/color.ts a propósito. Si la regla
    // tuviera su propia lista de excepciones, esta se le escaparía y el
    // build no publicaría un contenido que hoy es correcto.
    expect(tokens.saboresSoloDisplay).toContain('hierbabuena')
    const hierbabuena = { ...unSabor, slug: 'hierbabuena', clave: 'hierbabuena', nombre: 'Hierbabuena' }
    expect(validar(esquemaSabores, doc(hierbabuena), {})).toEqual([])
  })
})
```

Mutación obligatoria: en `color-sabor.ts`, hacé que `contrasteSuficiente` ignore `saboresSoloDisplay` (que devuelva la comparación pelada). El segundo test tiene que dar **rojo** con la hierbabuena. Restaurá. Pegá las dos salidas.

Después, la otra dirección: bajá el umbral de la regla a `9` en vez de `4.5` y verificá que el PRIMER test da rojo con varios sabores — eso prueba que la regla de verdad se está evaluando sobre los 15 y no está muerta.

- [ ] **Paso 12: Correrlo y probar que detecta**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'productos vuelve a salir'`
Expected: PASS.

Para probar el poder de detección: en el JSON, mové la clave `nombre` del primer sabor al final del objeto y corré → tiene que dar **rojo** (el archivo dejó de estar en orden canónico). Restaurá con `git checkout src/contenido/datos/sabores.json`. Pegá las dos salidas.

- [ ] **Paso 13: La fachada**

Reemplazá `src/copy/sabores.ts` **entero** por:

```ts
/*
 * La fachada de los productos. El contenido vive en
 * `src/contenido/datos/sabores.json` y su forma en
 * `src/contenido/esquema/sabores.ts`, que es también el catálogo de campos
 * que el panel lee para pintarse.
 *
 * `cargar()` corre acá adentro, en el camino del import de index.astro: un
 * JSON inválido revienta `astro build` y Vercel deja servido el deploy
 * anterior. PROHIBIDO envolverlo en try/catch — eso publicaría la página
 * rota, que es exactamente lo contrario de lo que se quiere.
 */
import { cargar } from '../contenido/carga'
import { esquemaSabores } from '../contenido/esquema/sabores'
import datos from '../contenido/datos/sabores.json'

const productos = cargar('src/contenido/datos/sabores.json', esquemaSabores, datos)

export type Sabor = (typeof productos.sabores)[number]

export const { urlCatalogoBarras, sabores, gotas, polvo } = productos
```

- [ ] **Paso 14: La compuerta completa**

Run: `pnpm build`
Expected: build del sitio verde, la suite verde, `astro check` **0 errores**.

**Este es el momento de la verdad de toda la tarea.** Si `astro check` da errores de tipo en `index.astro` o en `src/seo/esquema.ts`, el esquema tipa algo distinto de lo que había. Los sospechosos, en orden: `clave` (tiene que ser `keyof typeof sabor`, ver Paso 3), `catalogo` (`string | null`, no `string | undefined`), y `precio` (`number`, no `number | undefined`). **Arreglá el esquema, nunca el `.astro`.**

- [ ] **Paso 15: Verificar que el sitio no cambió**

```bash
git stash && pnpm build:sitio && cp dist/index.html /tmp/antes.html && git stash pop && pnpm build:sitio
diff /tmp/antes.html dist/index.html && echo "IDÉNTICO"
```

Expected: `IDÉNTICO`. Si hay diferencias, pegalas en el reporte **antes** de commitear: la fase entera existe para que no las haya.

- [ ] **Paso 16: Commit**

```bash
git add src/contenido/esquema/ src/contenido/datos/sabores.json src/copy/sabores.ts scripts/migra-contenido.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: los productos salen de JSON, y el sitio renderiza igual

El documento más chico primero, a propósito: prueba la tubería entera
—esquema, serializa(), JSON, cargar(), fachada— sobre 15 sabores antes de
escribir los 198 campos del sitio contra una tubería que nadie recorrió.

src/copy/sabores.ts: 98 líneas a 20. El dist/index.html es idéntico byte a
byte al de antes; nadie tipeó una coma de contenido.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 5: El documento de fichas técnicas — la unión discriminada en su caso real

**Files:**
- Create: `src/contenido/esquema/fichas.ts`
- Create: `src/contenido/datos/fichas.json` (lo escribe el script)
- Modify: `src/contenido/campos.ts` — el constructor `valorFijo`
- Modify: `src/contenido/esquema/index.ts` — la entrada `fichas`
- Modify: `scripts/migra-contenido.ts` — el modo `fichas`
- Modify: `src/fichas/base.ts` — 404 → ~12 líneas
- Modify: `src/fichas/plantilla.ts` — se borran `p()` y `li()`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `esquemaFichas`; `valorFijo({ ..., valores: readonly [V] })`; `fichasBase: Ficha[]` en `src/fichas/base.ts`, con la misma forma que hoy.
- Consume: el recorrido de uniones de la Tarea 2; `Ficha`, `Seccion` y `Bloque` de `src/fichas/plantilla.ts`.

**Por qué es el segundo documento.** Es el que estrena las uniones de la Tarea 2 con el caso que las motivó, y sigue siendo chico: 4 fichas, 382 hojas, pero solo unos 25 constructores porque la estructura se repite.

**La forma medida hoy:**

```
4 fichas · hasta 8 secciones por ficha · hasta 3 bloques por sección
meta: hasta 4 pares · lista: hasta 5 viñetas · tabla: hasta 10 filas × 3 columnas
acentos usados: #7D0303 (marca.rojoHondo) y #4C2C16 (marca.oscuro)
```

| Campo | Largo hoy | Tope |
|---|---|---|
| `producto` | 19 | 40 |
| `denominacion` | 73 | 120 |
| `meta[].0` (la etiqueta) | 19 | 40 |
| `meta[].1` (el valor) | 42 | 70 |
| `secciones[].titulo` | 39 | 70 |
| bloque `parrafo` → `texto` | 357 | 580 |
| bloque `lista` → `items[]` | 114 | 190 |
| bloque `tabla` → `encabezados[]` | 11 | 20 |
| bloque `tabla` → `filas[][]` | 36 | 60 |

- [ ] **Paso 1: El test de `valorFijo`, que hoy falla**

```ts
it('valorFijo anota el literal que discrimina una forma de bloque', () => {
  // Sin esto, el `tipo` de cada variante es un z.literal pelado: recorre()
  // lo emite como hoja SIN metadato, y el candado «todo campo tiene
  // etiqueta» de la Tarea 16 lo cuenta como un campo sin nombre.
  const campo = valorFijo({
    etiqueta: 'Forma del bloque',
    seccion: 'fichas',
    ayuda: 'Dice si este bloque es un párrafo, una lista o una tabla.',
    valores: ['parrafo'],
  })
  expect((panel.get(campo) as MetaCampo).etiqueta).toBe('Forma del bloque')
  expect(campo.parse('parrafo')).toBe('parrafo')
  expect(() => campo.parse('lista')).toThrow()
  expectTypeOf<z.infer<typeof campo>>().toEqualTypeOf<'parrafo'>()
})
```

- [ ] **Paso 2: Correrlo y verlo fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'valorFijo'` y después `pnpm typecheck`.
Expected: los dos FAIL — `valorFijo` no existe. La aserción `expectTypeOf` de este test solo se evalúa en el typecheck; el resto del test sí corre en vitest.

- [ ] **Paso 3: El constructor**

En `src/contenido/campos.ts`, al lado de `opcion`:

```ts
/**
 * El valor FIJO que dice de qué forma es un bloque: 'parrafo', 'lista',
 * 'tabla'. No es un campo que se edite —la clienta elige la forma al
 * insertar el bloque y el panel la dibuja como el nombre del bloque, no
 * como un input— pero lleva etiqueta y ayuda igual, porque es una hoja
 * del esquema y toda hoja del esquema tiene que poder nombrarse.
 *
 * `valores` con un solo elemento y no un `valor` suelto: es la misma
 * pregunta que contestan `opcion` y `tokenColor` —qué valores acepta este
 * campo— y ya pagamos una vez el precio de contestarla con dos nombres.
 */
export const valorFijo = <const V extends string>(meta: Base & { valores: readonly [V] }) =>
  anota(z.literal(meta.valores[0]), { control: 'oculto', quien: 'marcos', ...meta })
```

- [ ] **Paso 4: Correr y verificar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'valorFijo'`
Expected: PASS. Para probar que detecta: sacá el `anota(...)` (devolvé el literal pelado) → rojo. Restaurá.

- [ ] **Paso 5: El esquema de fichas**

Create `src/contenido/esquema/fichas.ts`:

```ts
/*
 * La forma de las cuatro fichas técnicas oficiales.
 *
 * El contenido es VERBATIM de los documentos del cliente (2026-08-14
 * barras y gotas, 2026-08-17 polvo): son datos que se declaran ante
 * COFEPRIS y que las cafeterías reenvían a sus propios clientes. Los topes
 * son generosos a propósito; lo que no se puede es que un dato quede
 * vacío o pierda su forma.
 *
 * Los bloques son una unión discriminada de tres formas —párrafo, lista y
 * tabla— y son el caso real para el que la Tarea 2 enseñó a recorrer
 * uniones.
 */
import { z } from 'zod'
import { marca as tokensMarca } from '../../tokens/color'
import { grupo, lista, tupla, texto, parrafo, archivo, tokenColor, valorFijo } from '../campos'

const enFichas = { seccion: 'fichas' } as const

const bloqueParrafo = z.object({
  tipo: valorFijo({
    ...enFichas,
    etiqueta: 'Forma del bloque',
    ayuda: 'Este bloque es un párrafo corrido.',
    valores: ['parrafo'],
  }),
  texto: parrafo({
    ...enFichas,
    etiqueta: 'Texto del párrafo',
    ayuda: 'Un párrafo de la ficha, tal como aparece en el documento oficial.',
    maxCaracteres: 580,
  }),
})

const bloqueLista = z.object({
  tipo: valorFijo({
    ...enFichas,
    etiqueta: 'Forma del bloque',
    ayuda: 'Este bloque es una lista de viñetas.',
    valores: ['lista'],
  }),
  items: lista({
    ...enFichas,
    etiqueta: 'Viñetas',
    ayuda: 'Cada renglón de la lista, en orden.',
    minItems: 1,
    maxItems: 20,
    elemento: texto({
      ...enFichas,
      etiqueta: 'Viñeta',
      ayuda: 'Un renglón de la lista.',
      maxCaracteres: 190,
    }),
  }),
})

const bloqueTabla = z.object({
  tipo: valorFijo({
    ...enFichas,
    etiqueta: 'Forma del bloque',
    ayuda: 'Este bloque es una tabla con encabezados.',
    valores: ['tabla'],
  }),
  encabezados: lista({
    ...enFichas,
    etiqueta: 'Encabezados de la tabla',
    ayuda: 'Los títulos de las columnas. Cada fila tiene que traer esta misma cantidad de celdas.',
    minItems: 1,
    maxItems: 6,
    elemento: texto({
      ...enFichas,
      etiqueta: 'Encabezado',
      ayuda: 'El título de una columna.',
      maxCaracteres: 20,
    }),
  }),
  filas: lista({
    ...enFichas,
    etiqueta: 'Filas de la tabla',
    ayuda: 'Cada fila, con una celda por columna.',
    minItems: 1,
    maxItems: 40,
    elemento: lista({
      ...enFichas,
      etiqueta: 'Fila',
      ayuda: 'Las celdas de una fila, en el orden de los encabezados.',
      minItems: 1,
      maxItems: 6,
      elemento: texto({
        ...enFichas,
        etiqueta: 'Celda',
        ayuda: 'El contenido de una celda.',
        maxCaracteres: 60,
      }),
    }),
  }),
})

/**
 * Un bloque de una sección. La unión va DISCRIMINADA por `tipo`: sin
 * discriminante, Zod probaría las tres formas y el error de una tabla mal
 * escrita saldría como «ninguna de las 3 opciones coincide», que no le
 * dice nada a nadie.
 */
const bloque = z.discriminatedUnion('tipo', [bloqueParrafo, bloqueLista, bloqueTabla])

const seccion = grupo({
  ...enFichas,
  etiqueta: 'Sección de la ficha',
  ayuda: 'Un apartado de la ficha, con su título y sus bloques.',
  nombra: (v) => (v as { titulo?: string }).titulo ?? 'Sección',
  campos: {
    titulo: texto({
      ...enFichas,
      etiqueta: 'Título de la sección',
      ayuda: 'El encabezado del apartado: «Alérgenos», «Información nutrimental de referencia».',
      maxCaracteres: 70,
    }),
    bloques: lista({
      ...enFichas,
      etiqueta: 'Bloques',
      ayuda: 'El contenido del apartado: párrafos, listas y tablas, en orden.',
      minItems: 1,
      maxItems: 10,
      elemento: bloque,
    }),
  },
})

const ficha = grupo({
  ...enFichas,
  etiqueta: 'Ficha técnica',
  ayuda: 'Una de las cuatro fichas oficiales.',
  nombra: (v) => (v as { producto?: string }).producto ?? 'Ficha',
  campos: {
    archivo: archivo({
      ...enFichas,
      etiqueta: 'Nombre del archivo PDF',
      ayuda: 'Con este nombre se publica el PDF de esta ficha. No se cambia.',
    }),
    producto: texto({
      ...enFichas,
      etiqueta: 'Nombre del producto',
      ayuda: 'El título grande de la ficha, arriba a la derecha.',
      maxCaracteres: 40,
    }),
    denominacion: texto({
      ...enFichas,
      etiqueta: 'Denominación legal',
      ayuda: 'Cómo se llama el producto ante las autoridades. Sale del documento oficial.',
      maxCaracteres: 120,
    }),
    acento: tokenColor({
      ...enFichas,
      etiqueta: 'Color de acento',
      ayuda: 'El color del nombre del producto en la ficha.',
      valores: Object.values(tokensMarca),
    }),
    meta: lista({
      ...enFichas,
      etiqueta: 'Datos de cabecera',
      ayuda: 'Los pares de la tabla chica del encabezado: «Marca / Maracacao».',
      minItems: 1,
      maxItems: 10,
      elemento: tupla({
        ...enFichas,
        etiqueta: 'Dato de cabecera',
        ayuda: 'Un par: primero cómo se llama el dato, después el dato.',
        partes: [
          texto({
            ...enFichas,
            etiqueta: 'Nombre del dato',
            ayuda: 'La columna izquierda: «País de elaboración».',
            maxCaracteres: 40,
          }),
          texto({
            ...enFichas,
            etiqueta: 'Valor del dato',
            ayuda: 'La columna derecha: «México».',
            maxCaracteres: 70,
          }),
        ],
      }),
    }),
    secciones: lista({
      ...enFichas,
      etiqueta: 'Secciones',
      ayuda: 'Los apartados de la ficha, en el orden en que se imprimen.',
      minItems: 1,
      maxItems: 20,
      elemento: seccion,
    }),
  },
})

/** El documento entero de fichas. */
export const esquemaFichas = grupo({
  ...enFichas,
  etiqueta: 'Fichas técnicas',
  ayuda: 'Las fichas oficiales que se publican en la página y en PDF.',
  campos: {
    fichas: lista({
      ...enFichas,
      etiqueta: 'Las fichas',
      ayuda: 'Una por producto.',
      minItems: 1,
      maxItems: 12,
      elemento: ficha,
    }),
  },
})
```

**Por qué la raíz es un `grupo` con una lista adentro y no la lista sola:** `cargar()` devuelve `Readonly<z.infer<E>>`, y `Readonly<T[]>` no es asignable a `T[]` — `fichaHtml(f: Ficha)` no lo aceptaría. Con la raíz objeto, `Readonly<{fichas: Ficha[]}>` deja `fichas` como `Ficha[]` y la fachada lo re-exporta tal cual. Los tres documentos tienen raíz objeto por la misma razón.

- [ ] **Paso 6: El modo `fichas` del script y la entrada en el índice**

En `scripts/migra-contenido.ts`:

```ts
function migraFichas(): void {
  escribe(
    'src/contenido/datos/fichas.json',
    serializa(esquemaFichas, { fichas: estructura(fichasBase) }),
  )
}
```

Agregalo al despacho (`else if (modo === 'fichas') migraFichas()`) y a la lista de modos del mensaje de error.

En `src/contenido/esquema/index.ts`:

```ts
export type IdDocumento = 'sabores' | 'fichas'

export const DOCUMENTOS = {
  sabores: esquemaSabores,
  fichas: esquemaFichas,
} as const satisfies Readonly<Record<IdDocumento, z.ZodType>>
```

- [ ] **Paso 7: Correrlo**

Run: `pnpm migra fichas`
Expected: `escrito: src/contenido/datos/fichas.json`

Si truena, el mensaje dice la ruta exacta. Un error posible y esperable: `fichas.2.secciones.4.bloques.1: «tipo» dice «tabla», que no es ninguna de las variantes declaradas (...)` — eso sería un error de escritura en el esquema, no del contenido.

- [ ] **Paso 8: Verificar el archivo**

```bash
python3 -c "
import json, io
s = io.open('src/contenido/datos/fichas.json', encoding='utf-8').read()
d = json.loads(s)['fichas']
print('nbsp literales:', s.count(chr(0xa0)))
print('fichas:', len(d))
print('archivos:', [f['archivo'] for f in d])
tipos = [b['tipo'] for f in d for sec in f['secciones'] for b in sec['bloques']]
from collections import Counter
print('bloques por tipo:', dict(Counter(tipos)))
print('orden de claves de una ficha:', list(d[0]))
"
```

Expected, exacto:
```
nbsp literales: 0
fichas: 4
archivos: ['ficha-tecnica-barras-y-gotas', 'ficha-tecnica-chocolate-en-polvo', 'ficha-tecnica-cocoa-natural', 'ficha-tecnica-cocoa-alcalina']
bloques por tipo: {'parrafo': 25, 'lista': 5, 'tabla': 11}
orden de claves de una ficha: ['archivo', 'producto', 'denominacion', 'acento', 'meta', 'secciones']
```

Los 41 bloques (25 párrafos, 5 listas, 11 tablas) son el conteo medido contra el fixture del árbol viejo. Si sale otro número, algo se perdió.

- [ ] **Paso 9: Los tres tests de las fichas**

```ts
describe('el documento de fichas', () => {
  it('vuelve a salir idéntico', () => {
    const bytes = readFileSync('src/contenido/datos/fichas.json', 'utf8')
    const cargado = cargar('src/contenido/datos/fichas.json', esquemaFichas, JSON.parse(bytes))
    expect(serializa(esquemaFichas, cargado) + '\n').toBe(bytes)
  })

  it('toda fila trae una celda por encabezado', () => {
    // El esquema no puede expresar esto: `lista` no sabe cuánto mide su
    // hermana. Y una fila con una celda de menos renderiza una tabla
    // corrida — el modo de falla que el PDF le manda a las cafeterías.
    for (const ficha of fichasBase) {
      for (const seccion of ficha.secciones) {
        for (const bloque of seccion.bloques) {
          if (bloque.tipo !== 'tabla') continue
          for (const fila of bloque.filas) {
            expect(fila, `${ficha.archivo} · ${seccion.titulo}`).toHaveLength(bloque.encabezados.length)
          }
        }
      }
    }
  })

  it('el panel puede nombrar todas las hojas de las tres formas de bloque', () => {
    // Es la prueba de que las uniones se recorren de verdad: si recorre()
    // emitiera el bloque como hoja opaca, este test vería 1 ruta en vez de
    // las 8 de las tres variantes.
    const rutas: string[] = []
    recorre(esquemaFichas, (r, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${r}`).toBeTruthy()
      rutas.push(r)
    })
    const deBloques = rutas.filter((r) => r.includes('bloques[]'))
    expect(deBloques).toEqual([
      'fichas[].secciones[].bloques[]<tipo=parrafo>.tipo',
      'fichas[].secciones[].bloques[]<tipo=parrafo>.texto',
      'fichas[].secciones[].bloques[]<tipo=lista>.tipo',
      'fichas[].secciones[].bloques[]<tipo=lista>.items[]',
      'fichas[].secciones[].bloques[]<tipo=tabla>.tipo',
      'fichas[].secciones[].bloques[]<tipo=tabla>.encabezados[]',
      'fichas[].secciones[].bloques[]<tipo=tabla>.filas[][]',
    ])
  })
})
```

- [ ] **Paso 10: Correr y probar el poder de detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'documento de fichas'`
Expected: PASS los tres.

Mutaciones, una por vez:
1. Borrá una celda de una fila de una tabla en `fichas.json` → el segundo test rojo. (Restaurá con `git checkout src/contenido/datos/fichas.json`.)
2. En `esquemaFichas`, sacá el `valorFijo` del bloque de tabla y poné `z.literal('tabla')` pelado → el tercer test rojo por `sin etiqueta`. Restaurá.

Pegá las cuatro salidas.

- [ ] **Paso 11: La fachada**

Reemplazá `src/fichas/base.ts` **entero** por:

```ts
/*
 * La fachada de las fichas técnicas. El contenido vive en
 * `src/contenido/datos/fichas.json` y su forma en
 * `src/contenido/esquema/fichas.ts`.
 *
 * Lo consumen el generador de PDF (`pnpm fichas`) y la página
 * `/fichas-tecnicas`. La anotación `: Ficha[]` no es decorativa: es un
 * test estructural gratis contra el contrato del renderizador. Si el
 * esquema se separa de `Ficha`, `astro check` lo dice acá.
 */
import { cargar } from '../contenido/carga'
import { esquemaFichas } from '../contenido/esquema/fichas'
import datos from '../contenido/datos/fichas.json'
import type { Ficha } from './plantilla'

export const fichasBase: Ficha[] = cargar(
  'src/contenido/datos/fichas.json',
  esquemaFichas,
  datos,
).fichas
```

Y en `src/fichas/plantilla.ts`, borrá `p()` y `li()`: eran los constructores que usaba el `base.ts` viejo y ya no tienen usuarios. `Bloque`, `Seccion`, `Ficha` y `fichaHtml` se quedan — los usa el renderizador.

- [ ] **Paso 12: La compuerta**

Run: `pnpm build`
Expected: verde, 0 errores.

Si `astro check` se queja de que el tipo inferido no es asignable a `Ficha`, **el esquema es el que está mal**. El sospechoso más probable: `meta` tiene que dar `[string, string][]` (una `tupla` de dos), no `string[][]`.

- [ ] **Paso 13: Verificar que las fichas no cambiaron**

```bash
pnpm fichas
git status --porcelain public/fichas docs/fichas
```

Expected: **sin cambios**. Los PDF se regeneran byte a byte iguales. Si cambian, la migración movió algo: pegá el diff antes de seguir.

- [ ] **Paso 14: Commit**

```bash
git add src/contenido/esquema/ src/contenido/datos/fichas.json src/contenido/campos.ts src/fichas/ scripts/migra-contenido.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: las fichas técnicas salen de JSON, con sus bloques como unión

El caso real para el que la tarea anterior enseñó a recorrer uniones: los
bloques son párrafo, lista o tabla, discriminados por «tipo». Las siete
hojas de las tres formas se recorren con etiqueta, y una fila con una
celda de menos ahora la caza un test en vez del PDF que la cafetería abre.

src/fichas/base.ts: 404 líneas a 12. Los PDF se regeneran idénticos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 6: Las envolturas se MUEVEN, no se duplican

Tarea corta y con una razón grande.

**Files:**
- Create: `src/contenido/datos/envolturas.json` (movido, con `git mv`)
- Delete: `docs/envolturas.json`
- Modify: `scripts/extrae-envolturas.py:23`
- Modify: `test/marca-copy.test.ts:55`
- Modify: `docs/tests-que-congelan-contenido.md` — la fila que lo nombra

**Por qué.** `docs/envolturas.json` es la autoridad sobre ingredientes y % de cacao: sale del arte de imprenta por `scripts/extrae-envolturas.py`, y `test/marca-copy.test.ts` verifica que el copy del sitio no se desvíe de él. Dos copias de esa autoridad, en un diseño cuya tesis es «una sola verdad», es exactamente el bug que el diseño dice prevenir — y el modo de falla es **la web publicando un porcentaje y la envoltura otro**.

**No lleva esquema Zod.** No es contenido que la clienta edite: sale del arte impreso. El spec lo confirma — lista `esquema/{sitio,sabores,fichas,index}.ts`, sin envolturas. Vive en `datos/` porque es dato, no porque sea editable.

- [ ] **Paso 1: El movimiento**

```bash
mkdir -p src/contenido/datos
git mv docs/envolturas.json src/contenido/datos/envolturas.json
```

`git mv` y no copiar-y-borrar: así el historial del archivo sobrevive y `git log --follow` sigue funcionando.

- [ ] **Paso 2: Correr la suite y ver qué se rompe**

Run: `pnpm test`
Expected: **FAIL** en `test/marca-copy.test.ts` con `ENOENT: no such file or directory, open 'docs/envolturas.json'`.

Eso es el test haciendo su trabajo: pegá la salida. Es la prueba de que ese test de verdad lee el archivo y no una copia en memoria.

- [ ] **Paso 3: Los dos consumidores**

En `test/marca-copy.test.ts:55`:

```ts
  const json = JSON.parse(readFileSync('src/contenido/datos/envolturas.json', 'utf8')) as Record<
```

En `scripts/extrae-envolturas.py:23`:

```python
FICHA = 'src/contenido/datos/envolturas.json'
```

Y arriba, en el docstring del script (línea 16):

```python
Salida: public/sitio/envoltura/ + src/contenido/datos/envolturas.json
```

- [ ] **Paso 4: La fila de la tabla de tests que congelan contenido**

En `docs/tests-que-congelan-contenido.md`, la fila de `test/marca-copy.test.ts:55` dice hoy «QUEDA (Fase 1 lo mueve a `datos/`)». Actualizala a que ya está movido:

```
| `test/marca-copy.test.ts:55` | lee `src/contenido/datos/envolturas.json` | Ninguna | QUEDA (movido en la fase 1 parte B) |
```

Y en la línea 40 del mismo documento, donde dice `docs/envolturas.json`, poné la ruta nueva.

- [ ] **Paso 5: Verificar que no queda ninguna referencia vieja**

```bash
grep -rn "docs/envolturas" --include='*.ts' --include='*.py' --include='*.astro' --include='*.md' . | grep -v node_modules
```

Expected: solo las menciones históricas de `docs/maracacao-company-brief.md` y `docs/auditoria-diseno-v2.md`, que son bitácoras de una fecha y **no se tocan** — reescribir la historia de un documento fechado para que apunte a una ruta que no existía entonces es peor que dejarlo.

- [ ] **Paso 6: La compuerta y el commit**

```bash
pnpm build
git add -A src/contenido/datos/envolturas.json docs/envolturas.json test/marca-copy.test.ts scripts/extrae-envolturas.py docs/tests-que-congelan-contenido.md
git commit -m "$(cat <<'EOF'
refactor: la autoridad sobre ingredientes vive en un solo lugar

docs/envolturas.json sale del arte de imprenta y es lo que verifica que el
copy del sitio no se desvíe. Dos copias de esa autoridad, en un diseño
cuya tesis es «una sola verdad», es el bug que el diseño dice prevenir: el
modo de falla es la web publicando un porcentaje y la envoltura otro.

Se mueve con git mv para que el historial del archivo sobreviva. No lleva
esquema: no es contenido que se edite, sale del arte impreso.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## El documento del sitio, en seis tareas

`marca` tiene **21 bloques** y unas doscientas rutas de dato, que el esquema declara en unas 220 llamadas a constructor (los tres paneles de negocio y las tuplas se nombran uno por uno). Escribirlo en un archivo de 900 líneas y en una sola tarea es pedirle a un revisor que apruebe o rechace las 900 de una: no puede hacer ninguna de las dos con criterio.

Así que el esquema del sitio se parte en **seis archivos por tema**, uno por tarea, y la última los compone:

| Archivo | Bloques de `marca` | Campos |
|---|---|---|
| `esquema/sitio/cabecera.ts` | `titulo`, `descripcion`, `skipLink`, `marca`, `nav`, `hero` | 32 |
| `esquema/sitio/producto.ts` | `postura`, `anaquel`, `minis`, `gotas`, `polvoCard`, `polvo` | 45 |
| `esquema/sitio/experiencia.ts` | `catar`, `recetas`, `nosotros` | 37 |
| `esquema/sitio/negocio.ts` | `negocios`, `preguntas` | 25 |
| `esquema/sitio/contacto.ts` | `contacto` | 46 |
| `esquema/sitio/paginas.ts` | `fichasTecnicas`, `noEncontrada`, `footer` | 32 |

Cada tarea termina con su archivo **probado por sí solo**: `recorre()` sobre su sub-esquema emite las rutas esperadas, toda hoja tiene etiqueta, y el pedazo correspondiente del contenido de hoy valida contra él. Ninguna espera a la de al lado.

### Cómo se escribe una etiqueta y una ayuda

Son el producto, no metadatos. La clienta no sabe qué es un campo ni le importa.

- **La etiqueta nombra la cosa como la ve ella:** «Renglón 2 del titular», «Precio de la barra», «Antetítulo». Nunca «hero.titular[1]» ni «string obligatorio».
- **La ayuda dice DÓNDE VIVE,** en una oración: «La línea chiquita arriba de "Elige tu barra"». Si el campo tiene una consecuencia que no se ve, la ayuda la nombra: «De aquí sale el "desde" de la pestaña Para negocios».
- **Español mexicano de tú, sin jerga.** Ni «slug», ni «array», ni «requerido», ni «render».
- **Las palabras prohibidas de MARCA valen también acá.** «chispas» en una ayuda es tan malo como en la página.

### Cómo leer las tablas de campo

Las tareas 8 a 12 traen **una tabla con el contenido exacto de cada campo**: ruta, constructor, etiqueta, ayuda y tope. No es un resumen: es lo que hay que escribir, palabra por palabra. La forma del código es siempre la misma —la de la Tarea 7, que va escrita entera— y la tabla trae los valores.

Los campos marcados con **⚑** llevan además algo que una tabla no puede expresar: una regla propia, un `cuenta`, un `enAtributo`, un derivado. Debajo de cada tabla van esos, en código. **En esos bloques, el `…` significa «la etiqueta, la ayuda y la sección que dice la tabla de arriba»** — no es un hueco por llenar a criterio: está escrito tres renglones más arriba. Todo lo demás del bloque va literal.

**Los topes son el largo medido hoy × 1,6 redondeado a la decena, con piso de 20.** Son techo de cordura. Las dos excepciones —`titulo` y `descripcion`— llevan el tope de lo que corta Google, y están explicadas donde aparecen.

---

## Tarea 7: El esquema del sitio 1/6 — cabecera, navegación y portada

**Files:**
- Create: `src/contenido/esquema/sitio/cabecera.ts`
- Modify: `src/contenido/campos.ts` — el constructor `ancla`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `campos` de cabecera como un objeto plano de claves → esquemas (`{ titulo, descripcion, skipLink, marca, nav, hero }`), listo para que la Tarea 12 lo derrame dentro del `grupo` raíz; y `ancla({...})` en `campos.ts`.
- Consume: los constructores de `campos.ts`.

**Por qué exporta un objeto plano y no un `grupo`:** los seis archivos de `esquema/sitio/` son bloques del MISMO documento. Si cada uno devolviera un `grupo`, el documento tendría un nivel de anidamiento que no existe en el contenido, y todas las rutas cambiarían (`cabecera.hero.sub` en vez de `hero.sub`). Cada archivo exporta las claves que le tocan y la Tarea 12 las junta con `...`.

- [ ] **Paso 1: El test del constructor `ancla`, que hoy falla**

```ts
it('ancla acepta un salto interno y una ruta, y rechaza lo demás', () => {
  // nav.items[].ancla es '#sabores'; footer.productos[3].ancla es
  // '/fichas-tecnicas'. Los dos son «a dónde lleva este enlace» y viven en
  // la misma lista de campos, así que es un solo constructor. `ruta()` no
  // sirve: exige empezar con «/» y rechaza los saltos.
  const campo = ancla({ etiqueta: 'A dónde lleva', seccion: 'portada', ayuda: 'El destino del enlace.' })
  expect(campo.parse('#sabores')).toBe('#sabores')
  expect(campo.parse('/fichas-tecnicas')).toBe('/fichas-tecnicas')
  expect(() => campo.parse('https://ejemplo.com')).toThrow()
  expect(() => campo.parse('sabores')).toThrow()
})
```

- [ ] **Paso 2: Correrlo y verlo fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'ancla acepta'`
Expected: FAIL — `ancla` no existe.

- [ ] **Paso 3: El constructor**

En `src/contenido/campos.ts`, al lado de `ruta`:

```ts
/**
 * A dónde lleva un enlace del sitio: un salto dentro de la página
 * ('#sabores') o una ruta interna ('/fichas-tecnicas'). Nunca una
 * dirección externa — para eso está `url`, y mezclarlas es cómo un menú
 * termina sacando a la visitante del sitio sin querer.
 */
export const ancla = (meta: Base) =>
  anota(
    z.string().regex(/^[#/][\w\-/]*$/, 'Tiene que empezar con «#» (un salto) o con «/» (una página).'),
    { control: 'oculto', quien: 'marcos', ...meta },
  )
```

- [ ] **Paso 4: Correr, probar detección, commitear**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'ancla acepta'` → PASS.
Mutación: cambiá el regex por `/^.+$/` → rojo en las dos últimas aserciones. Restaurá.

```bash
git add src/contenido/campos.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el constructor ancla, para los enlaces internos del sitio

Un salto ('#sabores') o una ruta ('/fichas-tecnicas'), nunca una dirección
externa. `ruta()` no servía: exige empezar con «/» y rechaza los saltos, y
los dos casos viven en la misma lista de campos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Paso 5: El archivo de cabecera, completo**

Create `src/contenido/esquema/sitio/cabecera.ts`:

```ts
/*
 * Lo primero que ve la visitante y lo que ve Google: el <title> y la
 * descripción de los buscadores, el logotipo, el menú y la portada.
 *
 * Los cinco archivos de `esquema/sitio/` exportan CLAVES, no grupos: son
 * bloques del mismo documento, y envolverlos agregaría un nivel de
 * anidamiento que no existe en el contenido (`cabecera.hero.sub` en vez de
 * `hero.sub`), cambiando todas las rutas del sistema.
 */
import { grupo, lista, tupla, texto, parrafo, ancla, correo } from '../../campos'

/**
 * Ni `&` ni `<` ni `>` ni `"` en lo que viaja al <head>.
 *
 * El <title> y la meta descripción se escriben dentro de atributos y de
 * elementos del <head>, donde un carácter de estos no se escapa solo: el
 * resultado es una etiqueta rota y Google mostrando basura. La regla es de
 * DATO, no de diseño, así que bloquea desde el esquema.
 */
const SIN_CARACTERES_DE_HTML = /^[^&<>"]*$/
const sinHtml = <T extends { refine: unknown }>(campo: T) =>
  (campo as unknown as { refine: (p: (v: string) => boolean, m: string) => T }).refine(
    (v) => SIN_CARACTERES_DE_HTML.test(v),
    'No se pueden usar los signos & < > ni las comillas dobles: rompen la ficha que ve Google.',
  )

const enBuscadores = { seccion: 'buscadores' } as const
const enPortada = { seccion: 'portada' } as const
const enAccesibilidad = { seccion: 'accesibilidad' } as const

export const camposDeCabecera = {
  titulo: sinHtml(
    texto({
      ...enBuscadores,
      etiqueta: 'Título en Google',
      ayuda: 'El renglón azul del resultado de búsqueda y el nombre de la pestaña del navegador.',
      // 70 y no el techo × 1,6: pasado ese largo Google lo corta y el
      // campo deja de hacer lo que existe para hacer. Acá el tope de
      // cordura Y el de diseño son el mismo número.
      maxCaracteres: 70,
      falla: ['ninguno'],
    }),
  ),
  descripcion: sinHtml(
    parrafo({
      ...enBuscadores,
      etiqueta: 'Descripción en Google',
      ayuda: 'El párrafo gris debajo del título en el resultado de búsqueda.',
      // Misma razón: Google corta en 155.
      maxCaracteres: 155,
      enAtributo: 'content',
      falla: ['ninguno'],
    }),
  ),
  skipLink: texto({
    ...enAccesibilidad,
    etiqueta: 'Salto al contenido',
    ayuda: 'El enlace invisible que aparece al apretar Tab: lleva al contenido saltándose el menú.',
    maxCaracteres: 30,
    falla: ['ninguno'],
  }),

  marca: grupo({
    ...enPortada,
    etiqueta: 'La marca',
    ayuda: 'Cómo se escribe el nombre en el logotipo.',
    campos: {
      nombre: texto({
        ...enPortada,
        etiqueta: 'Nombre',
        ayuda: 'El nombre tal cual, con mayúscula y minúsculas.',
        maxCaracteres: 20,
      }),
      wordmark: texto({
        ...enPortada,
        etiqueta: 'Nombre en el logotipo',
        ayuda: 'Como se dibuja en la cabecera, la portada y el pie: todo en mayúsculas.',
        maxCaracteres: 20,
        mayusculas: true,
      }),
      descriptor: texto({
        ...enPortada,
        etiqueta: 'Bajada del logotipo',
        ayuda: 'La línea chiquita bajo el nombre en el sello.',
        maxCaracteres: 30,
        mayusculas: true,
      }),
    },
  }),

  nav: grupo({
    ...enPortada,
    etiqueta: 'Menú',
    ayuda: 'El menú de arriba y su versión desplegada.',
    campos: {
      abrir: texto({
        ...enAccesibilidad,
        etiqueta: 'Botón para abrir el menú',
        ayuda: 'Lo que dice el botón de las tres rayas cuando el menú está cerrado.',
        maxCaracteres: 20,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      cerrar: texto({
        ...enAccesibilidad,
        etiqueta: 'Botón para cerrar el menú',
        ayuda: 'Lo mismo, con el menú abierto.',
        maxCaracteres: 20,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      etiqueta: texto({
        ...enAccesibilidad,
        etiqueta: 'Nombre del menú',
        ayuda: 'Cómo nombra al menú el lector de pantalla. No se ve en la página.',
        maxCaracteres: 30,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
      }),
      items: lista({
        ...enPortada,
        etiqueta: 'Entradas del menú',
        ayuda: 'En el orden en que aparecen, arriba y en el pie.',
        minItems: 3,
        maxItems: 12,
        nombra: (v) => (v as { texto?: string }).texto ?? 'Entrada',
        elemento: grupo({
          ...enPortada,
          etiqueta: 'Entrada del menú',
          ayuda: 'Un renglón del menú.',
          campos: {
            ancla: ancla({
              ...enPortada,
              etiqueta: 'A qué sección lleva',
              ayuda: 'El salto dentro de la página. Tiene que existir una sección con ese nombre.',
            }),
            texto: texto({
              ...enPortada,
              etiqueta: 'Texto de la entrada',
              ayuda: 'Lo que se lee en el menú. Aparece en el menú desplegado y en el pie.',
              maxCaracteres: 30,
              falla: ['nowrap'],
            }),
          },
        }),
      }),
      catalogo: texto({
        ...enPortada,
        etiqueta: 'Enlace al catálogo, en el menú',
        ayuda: 'El botón del menú desplegado que lleva a la tienda en línea.',
        maxCaracteres: 30,
      }),
      pie: tupla({
        ...enPortada,
        etiqueta: 'Pie del menú desplegado',
        ayuda: 'Las dos líneas chiquitas abajo del menú abierto: dónde estamos y el correo.',
        partes: [
          texto({
            ...enPortada,
            etiqueta: 'Dónde estamos',
            ayuda: 'La primera línea del pie del menú.',
            maxCaracteres: 50,
            mayusculas: true,
          }),
          correo({
            ...enPortada,
            etiqueta: 'Correo, en el menú',
            ayuda: 'La segunda línea del pie del menú. Tiene que ser el mismo correo de la sección Contacto.',
          }),
        ],
      }),
    },
  }),

  hero: grupo({
    ...enPortada,
    etiqueta: 'Portada',
    ayuda: 'Lo primero que se ve al entrar.',
    campos: {
      titular: tupla({
        ...enPortada,
        etiqueta: 'Titular',
        ayuda: 'Los tres renglones grandes de la portada. Son tres cajas fijas: no se agregan ni se quitan.',
        falla: ['nowrap', 'renglones'],
        partes: [
          texto({
            ...enPortada,
            etiqueta: 'Renglón 1 del titular',
            ayuda: 'El primer renglón grande. Se dibuja en versales.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }),
          // El renglón 2 es el único con una regla propia, y es una regla
          // que se paga cara: la plantilla le SACA la coma del final y
          // pinta una coma de color en su lugar. Si el renglón trae dos
          // comas, la del medio se queda y el título dice
          // «70% CACAO, DE VERDAD,,». La regla «termina en coma» no
          // alcanzaba: hay que exigir que sea la ÚNICA.
          texto({
            ...enPortada,
            etiqueta: 'Renglón 2 del titular',
            ayuda: 'El segundo renglón grande. Tiene que terminar en coma, y esa tiene que ser la única coma: la página la vuelve a dibujar en rojo.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }).refine(
            (v) => /^[^,]+,$/.test(v),
            'Este renglón tiene que terminar en «,» y no llevar ninguna otra coma.',
          ),
          texto({
            ...enPortada,
            etiqueta: 'Renglón 3 del titular',
            ayuda: 'El tercer renglón grande, el que cierra.',
            maxCaracteres: 20,
            mayusculas: true,
            falla: ['nowrap'],
          }),
        ],
      }),
      sub: parrafo({
        ...enPortada,
        etiqueta: 'Texto bajo el titular',
        ayuda: 'El párrafo que explica la marca, debajo de los tres renglones grandes.',
        maxCaracteres: 200,
        falla: ['renglones'],
      }),
      ctaCatalogo: texto({
        ...enPortada,
        etiqueta: 'Botón del catálogo',
        ayuda: 'El botón rojo de la portada. Lleva a la tienda en línea.',
        maxCaracteres: 40,
        falla: ['nowrap'],
      }),
      ctaSabores: texto({
        ...enPortada,
        etiqueta: 'Botón que baja al anaquel',
        ayuda: 'El botón claro de la portada. Baja a los sabores.',
        maxCaracteres: 30,
        falla: ['nowrap'],
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
      marquesinaAria: texto({
        ...enAccesibilidad,
        etiqueta: 'Descripción de la cinta de barras',
        ayuda: 'Cómo describe el lector de pantalla la cinta de barras que se desliza sola. No se ve en la página.',
        maxCaracteres: 70,
        enAtributo: 'aria-label',
        falla: ['ninguno'],
        cuenta: { de: 'sabores', sustantivo: 'sabores' },
      }),
    },
  }),
}
```

**Sobre `sinHtml`:** el cast existe porque `.refine()` de Zod devuelve el mismo tipo pero TypeScript no lo sabe a través de un genérico tan amplio. Y usar `.refine()` y no un constructor nuevo es deliberado: el registro del panel **sí** sigue la cadena de padres a través de `.refine()` (a diferencia de `.optional()`), así que la etiqueta y la ayuda sobreviven. Está verificado en la Parte A.

- [ ] **Paso 6: Los tres tests del bloque de cabecera**

```ts
describe('el esquema de cabecera', () => {
  const cabecera = grupo({
    etiqueta: 'Cabecera', seccion: 'portada', ayuda: 'Prueba.',
    campos: camposDeCabecera,
  })

  it('valida el contenido de hoy', () => {
    const hoy = {
      titulo: marcaVieja.titulo, descripcion: marcaVieja.descripcion,
      skipLink: marcaVieja.skipLink, marca: marcaVieja.marca,
      nav: marcaVieja.nav, hero: marcaVieja.hero,
    }
    expect(validar(cabecera, JSON.parse(JSON.stringify(hoy)), { sabores: 15 })).toEqual([])
  })

  it('toda hoja tiene etiqueta, ayuda y sección', () => {
    recorre(cabecera, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
    })
  })

  it('el renglón 2 del titular exige una coma y solo una', () => {
    // La plantilla le SACA la coma final y pinta una roja en su lugar. Con
    // dos comas, la del medio se queda: «70% CACAO, DE VERDAD,,» en el h1.
    const conDos = { ...JSON.parse(JSON.stringify(marcaVieja.hero)), titular: ['CHOCOLATE', '70% CACAO, DE VERDAD,', 'MEXICANO.'] }
    const problemas = validar(cabecera, { ...base, hero: conDos }, { sabores: 15 })
    expect(problemas.map((p) => p.campo)).toContain('hero.titular.1')
  })
})
```

Donde `marcaVieja` es el import del fixture (`test/fixtures/contenido-2026-09-10.json`), **no** del módulo: el fixture es la foto congelada y no se mueve cuando la Tarea 13 reescriba la fachada.

- [ ] **Paso 7: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'esquema de cabecera'`
Expected: PASS los tres.

Mutaciones, una por vez:
1. Bajá `maxCaracteres` de `hero.sub` a 50 → el primero rojo, con el mensaje que va a leer la clienta.
2. Sacá la `ayuda` de `nav.catalogo` → **`pnpm typecheck` da error** (la ayuda es obligatoria: ese es el punto del diseño, y vitest no lo vería). Pegá el error del compilador; eso ES la prueba.
3. Cambiá el regex del renglón 2 a `/,$/` → el tercero rojo.

- [ ] **Paso 8: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/cabecera.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el esquema de cabecera, navegación y portada — 32 campos

El primero de los cinco archivos del documento del sitio. Exporta claves y
no un grupo: son bloques del mismo documento, y envolverlos agregaría un
nivel de anidamiento que no existe en el contenido.

El renglón 2 del titular lleva la regla que se paga cara: la plantilla le
saca la coma del final y pinta una roja en su lugar, así que con dos comas
el h1 dice «70% CACAO, DE VERDAD,,». «Termina en coma» no alcanzaba: tiene
que ser la única.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 8: El esquema del sitio 2/6 — la barra, el anaquel y las tres tarjetas

**Files:**
- Create: `src/contenido/esquema/sitio/producto.ts`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `camposDeProducto` — `{ postura, anaquel, minis, gotas, polvoCard, polvo }`.
- Consume: los constructores de `campos.ts`. Acá aparecen por primera vez `medida` (el espacio duro) y `derivado` (los precios que no se editan).

**45 campos.** La forma del código es la de la Tarea 7: cada fila de la tabla es una llamada al constructor con esa etiqueta, esa ayuda y ese tope. Las filas con **⚑** llevan algo más y su código completo va debajo.

### `postura` — «¿Qué hay en una barra?» · sección `productos`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `postura.kicker` | `texto` | Antetítulo de la sección | La línea chiquita en versales arriba del título. | 30 |
| `postura.titulo` | `texto` | Título de la sección | El título grande: «¿Qué hay en una barra?». | 40 |
| `postura.intro` ⚑ | `parrafo` | Texto de entrada | El párrafo bajo el título. Dice cuántos ingredientes lleva la barra. | 180 |
| `postura.chips` | `lista` 1–6 | Sellos | Las cápsulas de la sección: origen, año y hechura. | — |
| `postura.chips[]` | `texto` | Sello | Una cápsula: «Cacao de Tabasco». | 30 |
| `postura.tabSi` | `texto` | Pestaña «Sí lleva» | El nombre de la pestaña izquierda. | 20 |
| `postura.tabNo` | `texto` | Pestaña «No lleva» | El nombre de la pestaña derecha. | 20 |
| `postura.lleva` | `lista` 1–12 | Lo que lleva | Los ingredientes de la barra, del que más hay al que menos. | — |
| `postura.lleva[]` | `texto` | Ingrediente | Un ingrediente de la lista. | 110 |
| `postura.llevaNota` | `parrafo` | Nota al pie de los ingredientes | La aclaración chiquita bajo la lista: de dónde sale el 70% y qué lleva el blanco. | 240 |
| `postura.noLleva` | `lista` 1–12 | Lo que no lleva | Lo que la barra no tiene, en la pestaña derecha. | — |
| `postura.noLleva[]` | `texto` | Cosa que no lleva | Un renglón de la lista. | 40 |
| `postura.noLlevaCierre` | `parrafo` | Cierre de la pestaña | La frase que cierra la pestaña «No lleva». | 140 |

### `anaquel` — los 15 sabores · sección `sabores`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `anaquel.kicker` ⚑ | `texto` | Antetítulo del anaquel | La línea en versales arriba de «Elige tu barra». Dice cuántos sabores hay. | 30 |
| `anaquel.titulo` | `texto` | Título del anaquel | El título grande de la sección de sabores. | 30 |
| `anaquel.contadorDe` ⚑ | `texto` | Final del contador | Lo que va después del número: «n.º 3 de 15». Cambia cuando cambia la cantidad de barras. | 20 |
| `anaquel.fichaEtiqueta` | `texto` | Etiqueta del contador | Lo que va antes del número: «Barra n.º 3». | 20 |
| `anaquel.grupoAria` ⚑ | `texto` | Descripción del selector de sabores | Cómo describe el lector de pantalla la fila de barras. No se ve en la página. | 60 |
| `anaquel.pesoInsignia` ⚑ | `medida` | Peso en la insignia | El sello redondo sobre la envoltura. Entre el número y la unidad va un espacio que no parte el renglón. | 20 |
| `anaquel.manoInsignia` | `texto` | Texto de la insignia | La segunda línea del sello redondo sobre la envoltura. | 20 |
| `anaquel.ingredientesEtiqueta` ⚑ | `texto` | Etiqueta de ingredientes | La palabra antes de la lista de ingredientes de cada barra. | 20 |
| `anaquel.cta` | `texto` | Botón del catálogo, en la ficha | El botón bajo cada barra que lleva a comprarla. | 30 |
| `anaquel.remate` | `texto` | Remate del anaquel | La frase que cierra la sección de sabores. | 50 |
| `anaquel.ilustracionCaption` | `texto` | Pie de la ilustración | El texto bajo el dibujo de la envoltura. | 50 |
| `anaquel.ilustracionAltPrefijo` ⚑ | `texto` | Descripción del dibujo | Cómo empieza la descripción del dibujo para quien no lo ve. Se le agrega el nombre del sabor. | 50 |
| `anaquel.envolturaAltPrefijo` ⚑ | `texto` | Descripción de la foto de la envoltura | Cómo empieza la descripción de la foto para quien no la ve. Se le agrega el nombre del sabor. | 20 |

### `minis`, `gotas`, `polvoCard`, `polvo` · sección `productos`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `minis.titulo` | `texto` | Título del paquete de minis | El título de la tarjeta del paquete de seis. | 40 |
| `minis.precio` | `precio` | Precio del paquete | En pesos, sin centavos. | — |
| `minis.cuerpo` | `parrafo` | Texto del paquete | El párrafo de la tarjeta del paquete de seis. | 160 |
| `minis.nota` | `texto` | Nota del paquete | La línea chiquita al pie de la tarjeta. | 90 |
| `gotas.titulo` ⚑ | `medida` | Título del bloque de gotas | El título de la tarjeta de las bolsas. Entre el número y la unidad va un espacio que no parte el renglón. | 50 |
| `gotas.precioDesde` ⚑ | `derivado` | Precio desde | Sale solo del precio más bajo de las bolsas de gotas. No se edita aquí. | — |
| `gotas.precioJengibre` ⚑ | `derivado` | Precio de la bolsa de jengibre y naranja | Sale solo del precio de esa bolsa. No se edita aquí. | — |
| `gotas.desdeEtiqueta` | `texto` | Palabra antes del precio | La palabra chiquita antes del precio: «desde $258». | 20 |
| `gotas.cuerpo` | `parrafo` | Texto de las gotas | El párrafo de la tarjeta de las bolsas. | 150 |
| `gotas.sabores` ⚑ | `texto` | Cuántos sabores hay en gotas | La cápsula que dice cuántos sabores hay en bolsa. | 20 |
| `gotas.notaPrecio` | `texto` | Sabor del precio distinto | El nombre del sabor que cuesta distinto, al lado de su precio. | 30 |
| `polvoCard.titulo` ⚑ | `medida` | Título de la tarjeta de polvo | El título de la tarjeta chica del chocolate en polvo. | 30 |
| `polvoCard.chip` | `texto` | Cápsula de la tarjeta | La cápsula amarilla que avisa que todavía no está a la venta. | 20 |
| `polvoCard.cuerpo` | `parrafo` | Texto de la tarjeta de polvo | El párrafo de la tarjeta chica. | 100 |
| `polvo.kicker` | `texto` | Antetítulo del bloque de polvo | La línea en versales arriba de «Chocolate para beber». | 20 |
| `polvo.chip` | `texto` | Cápsula del bloque | La cápsula amarilla del bloque grande de polvo. | 20 |
| `polvo.titulo` | `texto` | Título del bloque de polvo | El título grande: «Chocolate para beber». | 40 |
| `polvo.cuerpo` ⚑ | `parrafo` | Texto del bloque de polvo | El párrafo del bloque. Dice cuántas variedades hay. | 120 |
| `polvo.altPrefijo` ⚑ | `texto` | Descripción de las etiquetas | Cómo empieza la descripción de cada etiqueta para quien no la ve. Se le agrega el nombre de la variedad. | 60 |

### Las filas con ⚑, completas

```ts
// ── Los cuatro conteos de este archivo ──────────────────────────────
// Los textos que mencionan una cantidad que sale de una lista. Si la
// clienta agrega un sabor y estos textos no se actualizan, el sitio
// miente — y hasta la Tarea 1 no había un solo test que lo detectara.

postura.intro:  parrafo({ seccion: 'productos', …, maxCaracteres: 180,
  cuenta: { de: 'ingredientes', sustantivo: 'ingredientes' } })   // «Cinco ingredientes…»

anaquel.kicker: texto({ seccion: 'sabores', …, maxCaracteres: 30, mayusculas: true,
  cuenta: { de: 'sabores', sustantivo: 'sabores' } })             // «LOS 15 SABORES»

gotas.sabores:  texto({ seccion: 'productos', …, maxCaracteres: 20,
  cuenta: { de: 'gotas', sustantivo: 'sabores' } })               // «6 sabores» — cuenta gotas, dice «sabores»

polvo.cuerpo:   parrafo({ seccion: 'productos', …, maxCaracteres: 120,
  cuenta: { de: 'polvo', sustantivo: 'variedades' } })            // «Ocho variedades…», en letras
```

```ts
// ── Los tres espacios duros de este archivo ─────────────────────────
// `medida` rechaza «250 g» con espacio normal y ofrece el arreglo de un
// toque. En el celular, sin el espacio duro, la «g» o el «kg» quedan
// solas en el renglón siguiente. La clienta nunca se entera de que el
// espacio duro existe, que es lo correcto.
//
// OJO: en el JSON estos valores viven ESCAPADOS (\u00a0). Nunca se pegan.

anaquel.pesoInsignia: medida({ seccion: 'sabores', …, maxCaracteres: 20, falla: ['nowrap'] })
gotas.titulo:         medida({ seccion: 'productos', …, maxCaracteres: 50, falla: ['nowrap'] })
polvoCard.titulo:     medida({ seccion: 'productos', …, maxCaracteres: 30, falla: ['nowrap'] })
```

```ts
// ── Los dos derivados de este archivo ───────────────────────────────
// NO viajan al JSON: los calcula la fachada (Tarea 13). Viven en el
// esquema para que el panel los dibuje en gris con su explicación.
//
// El motivo: el 258 está escrito en tres lugares y el 340 en dos. Si la
// clienta sube las bolsas desde el anaquel y estos no se mueven, la
// tarjeta le sigue diciendo «desde $258» a quien está por comprar.

gotas.precioDesde: derivado({
  seccion: 'productos',
  etiqueta: 'Precio desde',
  ayuda: 'Sale solo del precio más bajo de las bolsas de gotas. No se edita aquí.',
  saleDe: 'el precio más bajo de las bolsas de gotas',
})
gotas.precioJengibre: derivado({
  seccion: 'productos',
  etiqueta: 'Precio de la bolsa de jengibre y naranja',
  ayuda: 'Sale solo del precio de esa bolsa. No se edita aquí.',
  saleDe: 'el precio de la bolsa de jengibre y naranja',
})
```

```ts
// ── Los cuatro campos que son atributo ──────────────────────────────
// No tienen nodo de texto propio: viven adentro de un atributo. El panel
// los muestra con vista previa textual y NO dice «no pude revisar» sobre
// ellos, porque no hay nada geométrico que revisar. Van con
// `falla: ['ninguno']` y sección `accesibilidad`.

anaquel.grupoAria:             texto({ …, enAtributo: 'aria-label', falla: ['ninguno'] })
anaquel.ilustracionAltPrefijo: texto({ …, enAtributo: 'alt',        falla: ['ninguno'] })
anaquel.envolturaAltPrefijo:   texto({ …, enAtributo: 'alt',        falla: ['ninguno'] })
polvo.altPrefijo:              texto({ …, enAtributo: 'alt',        falla: ['ninguno'] })
```

```ts
// ── Los dos con marca propia ────────────────────────────────────────

// La plantilla le agrega los dos puntos: «Ingredientes: licor de cacao…».
// El panel los dibuja en gris al lado del campo para que la clienta no
// los escriba dos veces.
anaquel.ingredientesEtiqueta: texto({ seccion: 'sabores', …, maxCaracteres: 20, sufijo: ':' })

// «de 15». No lleva `cuenta`: cruzaConteo() exige que el número sea
// vecino inmediato de un sustantivo y acá no hay ninguno (la plantilla
// renderiza «n.º 3 de 15»). Lo cubre una de las ocho aserciones de forma
// de la Tarea 14, que afirma que dice exactamente 'de ' + la cantidad de
// barras. Va como `quien: 'marcos'`: si la clienta lo edita a mano, el
// contador miente y nada en el panel se lo dice.
anaquel.contadorDe: texto({ seccion: 'sabores', …, maxCaracteres: 20, quien: 'marcos', falla: ['nowrap'] })
```

- [ ] **Paso 1: Escribir el archivo**

Create `src/contenido/esquema/sitio/producto.ts`, exportando `camposDeProducto` con los seis bloques. Mismo encabezado de archivo y mismo estilo que `cabecera.ts`: constantes `enProductos` / `enSabores` / `enAccesibilidad` arriba, un `grupo` por bloque.

- [ ] **Paso 2: Los cuatro tests**

```ts
describe('el esquema de producto', () => {
  const producto = grupo({
    etiqueta: 'Producto', seccion: 'productos', ayuda: 'Prueba.',
    campos: camposDeProducto,
  })
  const hoy = () => {
    const m = JSON.parse(JSON.stringify(fixture.marca))
    // Los derivados NO están en el JSON, pero cargar() y validar() los
    // exigen: es el contrato con la fachada. El fixture los tiene porque
    // salió del módulo viejo, donde estaban escritos a mano.
    return { postura: m.postura, anaquel: m.anaquel, minis: m.minis, gotas: m.gotas, polvoCard: m.polvoCard, polvo: m.polvo }
  }
  const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, ingredientes: 5 }

  it('valida el contenido de hoy, avisos incluidos', () => {
    expect(validar(producto, hoy(), CONTEOS)).toEqual([])
  })

  it('toda hoja tiene etiqueta, ayuda y sección', () => {
    recorre(producto, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
    })
  })

  it('avisa si el anaquel dice un número de sabores que ya no es', () => {
    const problemas = validar(producto, hoy(), { ...CONTEOS, sabores: 16 })
    expect(problemas).toContainEqual(
      expect.objectContaining({ campo: 'anaquel.kicker', gravedad: 'avisa' }),
    )
  })

  it('los tres espacios duros se exigen', () => {
    // El modo de falla es invisible en el escritorio y evidente en el
    // celular: la «g» sola en el renglón siguiente.
    const roto = hoy()
    roto.anaquel.pesoInsignia = '70 g' // espacio NORMAL, escrito a propósito
    const problemas = validar(producto, roto, CONTEOS)
    expect(problemas.map((p) => p.campo)).toContain('anaquel.pesoInsignia')
  })
})
```

**En el cuarto test, el `'70 g'` va con espacio NORMAL a propósito** — es el valor malo. El bueno, el del contenido, lleva el escape `\u00a0`. Es el único lugar del plan donde un espacio normal entre cifra y unidad es lo correcto.

- [ ] **Paso 3: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'esquema de producto'`
Expected: PASS los cuatro.

Mutaciones, una por vez:
1. Sacá el `cuenta` de `anaquel.kicker` → el tercero rojo.
2. Cambiá `anaquel.pesoInsignia` de `medida` a `texto` → el cuarto rojo.
3. Cambiá `gotas.precioDesde` de `derivado` a `precio` → el primero **sigue verde** (el valor es válido como precio) pero el candado de derivados de la Tarea 13 lo va a cazar. Anotá esto en el reporte: es una mutación que esta tarea NO detecta, y saberlo importa.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/producto.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el esquema de la barra, el anaquel y las tres tarjetas — 45 campos

Acá aparecen por primera vez los tres modos de falla que la clienta no
puede ver sola: el espacio duro entre cifra y unidad (sin él, la «g» queda
sola en el celular), los precios derivados que están escritos en tres
lugares, y los cuatro textos que mencionan una cantidad que sale de una
lista.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 9: El esquema del sitio 3/6 — cómo catar, las recetas y nosotros

**Files:**
- Create: `src/contenido/esquema/sitio/experiencia.ts`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `camposDeExperiencia` — `{ catar, recetas, nosotros }`.
- Consume: los constructores de `campos.ts`. Acá aparece el primer campo **opcional** del sistema (`recetas.lista[].chipPolvo`).

**37 campos.**

### `catar` · sección `catar`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `catar.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 40 |
| `catar.titulo` ⚑ | `texto` | Título de la sección | El título grande. Dice cuántos pasos son. | 50 |
| `catar.pasos` | `lista` 1–12 | Los pasos | Los pasos para catar, en orden. | — |
| `catar.pasos[].nombre` | `texto` | Nombre del paso | La palabra en negrita al empezar el paso: «Mira», «Escucha». | 40 |
| `catar.pasos[].texto` | `parrafo` | Texto del paso | Lo que explica el paso. | 180 |
| `catar.pasos[].clave` | `claveSabor` | Color del paso | De aquí sale el color de fondo de la tarjeta de este paso. | — |
| `catar.cita` | `parrafo` | Cita de la sección | La frase destacada, en cursiva. | 140 |
| `catar.porqueTitulo` | `texto` | Título de «¿Por qué 70% cacao?» | El título del bloque que explica el porcentaje. | 40 |
| `catar.porque` | `parrafo` | Texto de «¿Por qué 70% cacao?» | El párrafo que explica el porcentaje. | 280 |
| `catar.aporteTitulo` | `texto` | Título de «Lo que aporta el cacao» | El título del bloque de propiedades. | 40 |
| `catar.aporte` ⚑ | `parrafo` | Texto de «Lo que aporta el cacao» | El párrafo de propiedades. Está redactado para cumplir con las reglas de COFEPRIS. | 330 |

### `recetas` · sección `recetas`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `recetas.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 20 |
| `recetas.titulo` | `texto` | Título de la sección | El título grande: «Qué hacer con ellas». | 40 |
| `recetas.deslizaNota` | `texto` | Aviso de deslizar | La línea chiquita que invita a deslizar el carrusel. | 20 |
| `recetas.verCompleta` | `texto` | Botón de la receta | El botón que abre la receta completa. | 40 |
| `recetas.etiquetaTip` | `texto` | Etiqueta del consejo | El título del recuadro del consejo, al final de cada receta. | 30 |
| `recetas.listaAria` ⚑ | `texto` | Descripción del carrusel | Cómo describe el lector de pantalla el carrusel. No se ve en la página. | 40 |
| `recetas.lista` | `lista` 1–12 | Las recetas | Las recetas del carrusel, en orden. | — |
| `recetas.lista[].kicker` | `texto` | Antetítulo de la receta | La línea en versales: «CON GOTAS · 2 PORCIONES». | 40 |
| `recetas.lista[].titulo` | `texto` | Nombre de la receta | El título de la tarjeta. | 70 |
| `recetas.lista[].resumen` | `parrafo` | Resumen de la receta | El párrafo corto que se ve con la tarjeta cerrada. | 150 |
| `recetas.lista[].clave` | `claveSabor` | Color de la receta | De aquí salen el color de fondo y el de la letra de esta receta. | — |
| `recetas.lista[].ingredientes` | `lista` 1–15 | Ingredientes | Lo que hace falta, en orden. | — |
| `recetas.lista[].ingredientes[]` | `texto` | Ingrediente | Un renglón de la lista. | 80 |
| `recetas.lista[].pasos` | `parrafo` | Preparación | Cómo se hace, en un párrafo corrido. | 260 |
| `recetas.lista[].tip` | `parrafo` | Consejo | El consejo del recuadro al final de la receta. | 120 |
| `recetas.lista[].chipPolvo` ⚑ | `texto` **opcional** | Cápsula de polvo | La cápsula amarilla que avisa que esta receta usa el chocolate en polvo, que todavía no está a la venta. | 50 |

### `nosotros` · sección `nosotros`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `nosotros.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 20 |
| `nosotros.titulo` | `texto` | Título de la sección | El título grande: «Empezó en una cocina». | 40 |
| `nosotros.parrafos` | `lista` 1–6 | Párrafos de la historia | La historia de la marca, un párrafo por caja. | — |
| `nosotros.parrafos[]` | `parrafo` | Párrafo | Uno de los párrafos de la historia. | 380 |
| `nosotros.cacaoTitulo` | `texto` | Título del recuadro del cacao | El título chiquito del recuadro sobre el origen del cacao. | 20 |
| `nosotros.cacao` | `parrafo` | Texto del recuadro del cacao | El párrafo sobre de dónde viene el cacao y cómo se trabaja. | 380 |
| `nosotros.datos` | `tupla` de 2 | Datos al pie | Las dos líneas al pie de la sección. Son dos cajas fijas. | — |
| `nosotros.datos.0` | `texto` | Dónde estamos | La primera de las dos líneas al pie. | 50 |
| `nosotros.datos.1` | `texto` | Desde cuándo | La segunda de las dos líneas al pie. | 50 |
| `nosotros.personajeAlt` ⚑ | `texto` | Descripción del personaje | Cómo se describe el dibujo para quien no lo ve. No se ve en la página. | 80 |

### Las filas con ⚑, completas

```ts
// El único conteo de este archivo: «Seis pasos para probarlo bien».
catar.titulo: texto({
  seccion: 'catar',
  etiqueta: 'Título de la sección',
  ayuda: 'El título grande. Dice cuántos pasos son.',
  maxCaracteres: 50,
  cuenta: { de: 'pasos', sustantivo: 'pasos' },
})

// El párrafo de propiedades del cacao pasó por el filtro de COFEPRIS: no
// promete prevenir ni curar nada, y esa redacción es una decisión legal,
// no de estilo. La ayuda no lo dice con esas palabras porque la clienta no
// necesita el nombre del organismo para entender que no se toca a la
// ligera — pero el comentario del código sí, para el que venga después.
catar.aporte: parrafo({
  seccion: 'catar',
  etiqueta: 'Texto de «Lo que aporta el cacao»',
  ayuda: 'El párrafo de propiedades. Está redactado para cumplir con las reglas de COFEPRIS.',
  maxCaracteres: 330,
})

// Los dos campos que son atributo de este archivo.
recetas.listaAria:      texto({ seccion: 'accesibilidad', …, enAtributo: 'aria-label', falla: ['ninguno'] })
nosotros.personajeAlt:  texto({ seccion: 'accesibilidad', …, enAtributo: 'alt',        falla: ['ninguno'] })
```

```ts
// ── El primer campo opcional del sistema ────────────────────────────
//
// Solo una de las cuatro recetas usa el polvo. Va `.optional()`, y el
// registro del panel lo sigue encontrando: `desenvuelve()` pela la
// envoltura y busca el metadato hacia adentro (por eso `anota()` recibe
// siempre el esquema terminado).
//
// LA TRAMPA, MEDIDA: index.astro:448 hace `{'chipPolvo' in r && …}`, que
// pregunta si la CLAVE existe, no si tiene contenido. En zod 4.4.3,
// `.optional()` sobre `{chipPolvo: ''}` devuelve el objeto CON la clave.
// Si el panel guardara '' al vaciar el campo, se renderizaría
// `<p class="mono receta-chip"></p>`: una cajita amarilla vacía de 6×10 px
// con 12 px de margen, y como las cuatro tarjetas se estiran a la más
// alta, crecen las cuatro.
//
// El arreglo de index.astro es de la FASE 2 (esta fase no toca .astro).
// Lo que sí se clava acá es la forma que hoy lo hace imposible: dos de las
// ocho aserciones de la Tarea 14 afirman que la clave NO existe en las
// tres recetas sin chip. Si la migración la materializa como '', truenan
// en esta fase y no en la seis.
recetas.lista[].chipPolvo: texto({
  seccion: 'recetas',
  etiqueta: 'Cápsula de polvo',
  ayuda: 'La cápsula amarilla que avisa que esta receta usa el chocolate en polvo, que todavía no está a la venta.',
  maxCaracteres: 50,
}).optional()
```

- [ ] **Paso 1: Escribir el archivo**

Create `src/contenido/esquema/sitio/experiencia.ts`, exportando `camposDeExperiencia`. Mismo encabezado y estilo que `cabecera.ts`.

- [ ] **Paso 2: Los cuatro tests**

```ts
describe('el esquema de experiencia', () => {
  const experiencia = grupo({
    etiqueta: 'Experiencia', seccion: 'catar', ayuda: 'Prueba.',
    campos: camposDeExperiencia,
  })
  const hoy = () => {
    const m = JSON.parse(JSON.stringify(fixture.marca))
    return { catar: m.catar, recetas: m.recetas, nosotros: m.nosotros }
  }
  const CONTEOS = { pasos: 6, recetas: 4 }

  it('valida el contenido de hoy, avisos incluidos', () => {
    expect(validar(experiencia, hoy(), CONTEOS)).toEqual([])
  })

  it('toda hoja tiene etiqueta, ayuda y sección', () => {
    recorre(experiencia, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
    })
  })

  it('el chip de polvo puede faltar, y falta en tres de las cuatro recetas', () => {
    const datos = hoy()
    expect(datos.recetas.lista.filter((r: object) => 'chipPolvo' in r)).toHaveLength(1)
    expect(validar(experiencia, datos, CONTEOS)).toEqual([])
  })

  it('el chip opcional conserva su etiqueta a través del .optional()', () => {
    // `panel.get()` NO sigue la cadena de padres a través de .optional()
    // —crea un tipo nuevo, sin `parent`— aunque sí la siga a través de
    // .refine(). Si esto se rompe, el panel dibuja ese campo sin nombre y
    // no hay ningún error que lo diga.
    const etiquetas = new Map<string, string | undefined>()
    recorre(experiencia, (ruta, meta) => etiquetas.set(ruta, meta?.etiqueta))
    expect(etiquetas.get('recetas.lista[].chipPolvo')).toBe('Cápsula de polvo')
  })
})
```

- [ ] **Paso 3: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'esquema de experiencia'`
Expected: PASS los cuatro.

Mutaciones, una por vez:
1. Sacá el `.optional()` de `chipPolvo` → el primero y el tercero rojos (tres recetas sin la clave).
2. Poné el `.optional()` **antes** del `anota()` —o sea, anotá el interior y envolvé después sin anotar— y verificá que el cuarto **sigue verde**: `desenvuelve()` busca hacia adentro. Después sacá el metadato del interior también → rojo. Pegá las tres salidas.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/experiencia.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el esquema de cómo catar, las recetas y nosotros — 37 campos

Acá aparece el primer campo opcional del sistema, y trae su trampa medida:
index.astro pregunta si la CLAVE existe, no si tiene contenido, así que un
'' guardado por el panel renderizaría una cajita amarilla vacía que estira
las cuatro tarjetas. El arreglo de index.astro es de la fase 2; lo que se
clava acá es la forma que hoy lo hace imposible.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 10: El esquema del sitio 4/6 — para negocios y las preguntas

**Files:**
- Create: `src/contenido/esquema/sitio/negocio.ts`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `camposDeNegocio` — `{ negocios, preguntas }`.
- Consume: los constructores de `campos.ts`, `ancla` (Tarea 7).

**25 campos**, más los tres paneles de producto que salen de un constructor parametrizado.

### `negocios` · sección `negocios`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `negocios.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 40 |
| `negocios.titulo` | `texto` | Título de la sección | El título grande: «¿Con qué trabajas?». | 30 |
| `negocios.intro` | `parrafo` | Texto de entrada | El párrafo bajo el título: a qué negocios se les vende. | 100 |
| `negocios.correoEtiqueta` | `texto` | Etiqueta del correo | La palabra antes del correo de pedidos. | 30 |
| `negocios.correo` ⚑ | `correo` | Correo de pedidos | El correo para cafeterías y mayoreo. Es el mismo de la sección Contacto. | — |
| `negocios.fichasCta` | `texto` | Botón de las fichas | El botón que lleva a la página de fichas técnicas. | 40 |
| `negocios.fichaEnlace` | `texto` | Enlace a la ficha del panel | El enlace de cada panel que lleva a su propia ficha técnica. | 40 |
| `negocios.fichas` | `lista` 1–8 | Semáforo de datos técnicos | Qué información técnica hay disponible hoy. | — |
| `negocios.fichas[].dato` | `texto` | Qué dato es | La columna izquierda: «Alérgenos». | 60 |
| `negocios.fichas[].estado` | `texto` | Dónde está ese dato | La columna derecha: «confirmados en ficha técnica». | 50 |
| `negocios.tabs` ⚑ | `tupla` de 3 | Los tres paneles de producto | Polvo, gotas y barras. Son tres cajas fijas: cada una está enganchada a su ancla y a su ficha técnica. | — |

### Los tres paneles, de un constructor parametrizado

Los tres tienen la misma forma y **contenidos con reglas distintas**: cada uno menciona una cantidad diferente y dos de los tres tienen un precio derivado. Escribirlos tres veces es duplicación; escribirlos como una `lista` no funciona, porque el metadato de una lista es **uno solo para todos los elementos** y estos necesitan tres reglas de conteo distintas (ver Ruling C).

```ts
/**
 * Un panel de la sección «Para negocios».
 *
 * Los tres son `tupla` y no `lista` porque el `id` y el `ficha` de cada
 * uno están cableados a anclas del markup y de /fichas-tecnicas: un cuarto
 * panel agregado desde el panel no apuntaría a nada. Y porque cada uno
 * menciona una cantidad distinta —«Ocho variedades», «6 sabores», «Las 15
 * barras»— y el metadato de una lista es uno solo para todos.
 *
 * El precio va como `derivado` en los dos que tienen precio: el 258 está
 * escrito en tres lugares del sitio y el 108 en dos. Si la clienta sube
 * las barras a 130 desde el anaquel y esta pestaña no se mueve, le sigue
 * diciendo «desde $108» a las cafeterías, que son exactamente el público
 * de esta sección. Nada avisa.
 */
const panelDeProducto = (p: {
  nombre: string          // «polvo», «gotas», «barras» — para las etiquetas
  topeCuerpo: number
  topeDatos: number
  cuentaCuerpo?: MetaCampo['cuenta']
  cuentaDatos?: MetaCampo['cuenta']
  precio: z.ZodType       // derivado(...) o precioONada(...)
}) =>
  grupo({
    seccion: 'negocios',
    etiqueta: `Panel de ${p.nombre}`,
    ayuda: `La pestaña de chocolate en ${p.nombre} de la sección Para negocios.`,
    campos: {
      id: ancla({
        seccion: 'negocios',
        etiqueta: 'Nombre interno de la pestaña',
        ayuda: 'Con este nombre la página recuerda qué pestaña estaba abierta. No se cambia.',
      }),
      ficha: ancla({
        seccion: 'negocios',
        etiqueta: 'A qué ficha técnica lleva',
        ayuda: 'El salto a la ficha técnica de este producto. Tiene que existir esa ficha.',
      }),
      etiqueta: texto({
        seccion: 'negocios',
        etiqueta: 'Nombre de la pestaña',
        ayuda: 'Lo que se lee en el botón de la pestaña.',
        maxCaracteres: 40,
        falla: ['fila'],
      }),
      titulo: medida({
        seccion: 'negocios',
        etiqueta: 'Título del panel',
        ayuda: 'El título dentro de la pestaña. Entre el número y la unidad va un espacio que no parte el renglón.',
        maxCaracteres: 60,
      }),
      precioNota: texto({
        seccion: 'negocios',
        etiqueta: 'Palabra antes del precio',
        ayuda: 'La palabra chiquita antes del precio: «desde», «próximamente».',
        maxCaracteres: 20,
      }),
      precio: p.precio,
      clave: claveSabor({
        seccion: 'negocios',
        etiqueta: 'Color del panel',
        ayuda: 'De aquí sale el color de fondo de esta pestaña.',
      }),
      cuerpo: parrafo({
        seccion: 'negocios',
        etiqueta: 'Texto del panel',
        ayuda: 'El párrafo que describe el producto dentro de la pestaña.',
        maxCaracteres: p.topeCuerpo,
        ...(p.cuentaCuerpo ? { cuenta: p.cuentaCuerpo } : {}),
      }),
      datos: lista({
        seccion: 'negocios',
        etiqueta: 'Datos del panel',
        ayuda: 'Las viñetas con los datos prácticos del producto.',
        minItems: 1,
        maxItems: 10,
        elemento: texto({
          seccion: 'negocios',
          etiqueta: 'Dato',
          ayuda: 'Una viñeta de la lista.',
          maxCaracteres: p.topeDatos,
          ...(p.cuentaDatos ? { cuenta: p.cuentaDatos } : {}),
        }),
      }),
    },
  })

const tabs = tupla({
  seccion: 'negocios',
  etiqueta: 'Los tres paneles de producto',
  ayuda: 'Polvo, gotas y barras. Son tres cajas fijas: cada una está enganchada a su ancla y a su ficha técnica.',
  partes: [
    // «Ocho variedades para la taza…» · sin precio todavía
    panelDeProducto({
      nombre: 'polvo',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaCuerpo: { de: 'polvo', sustantivo: 'variedades' },
      precio: precioONada({
        seccion: 'negocios',
        etiqueta: 'Precio del polvo',
        ayuda: 'Déjalo vacío mientras el chocolate en polvo no esté a la venta.',
      }),
    }),
    // «6 sabores: jengibre y naranja, …» — el conteo está en los DATOS
    panelDeProducto({
      nombre: 'gotas',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaDatos: { de: 'gotas', sustantivo: 'sabores' },
      precio: derivado({
        seccion: 'negocios',
        etiqueta: 'Precio de las gotas, en la pestaña',
        ayuda: 'Sale solo del precio más bajo de las bolsas de gotas. No se edita aquí.',
        saleDe: 'el precio más bajo de las bolsas de gotas',
      }),
    }),
    // «Las 15 barras de la línea…» — cuenta sabores y dice «barras»
    panelDeProducto({
      nombre: 'barras',
      topeCuerpo: 170,
      topeDatos: 140,
      cuentaCuerpo: { de: 'sabores', sustantivo: 'barras' },
      precio: derivado({
        seccion: 'negocios',
        etiqueta: 'Precio de las barras, en la pestaña',
        ayuda: 'Sale solo del precio más bajo de las barras. No se edita aquí.',
        saleDe: 'el precio más bajo de las barras',
      }),
    }),
  ],
})
```

**`negocios.correo` lleva `escribeTambien`:** el mismo correo vive en cuatro lugares del sitio. La ruta canónica es `contacto.correo` (Tarea 11) y esta es una de las tres que la siguen. Se declara **en el canónico**, no acá; la Tarea 11 lo escribe y la Tarea 16 pone el candado que verifica que las cuatro dicen lo mismo.

### `preguntas` · sección `preguntas`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `preguntas.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 40 |
| `preguntas.titulo` | `texto` | Título de la sección | El título grande: «Lo que más nos preguntan». | 40 |
| `preguntas.items` | `lista` 3–20 | Las preguntas | Las preguntas frecuentes, en orden. Cada una se abre al tocarla. | — |
| `preguntas.items[].p` | `texto` | La pregunta | Lo que se lee con la respuesta cerrada. | 70 |
| `preguntas.items[].r` | `parrafo` | La respuesta | Lo que aparece al abrir la pregunta. | 250 |

- [ ] **Paso 1: Escribir el archivo**

Create `src/contenido/esquema/sitio/negocio.ts`, exportando `camposDeNegocio`.

- [ ] **Paso 2: Los cuatro tests**

```ts
describe('el esquema de negocio', () => {
  const negocio = grupo({
    etiqueta: 'Negocio', seccion: 'negocios', ayuda: 'Prueba.',
    campos: camposDeNegocio,
  })
  const hoy = () => {
    const m = JSON.parse(JSON.stringify(fixture.marca))
    return { negocios: m.negocios, preguntas: m.preguntas }
  }
  const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, preguntas: 8 }

  it('valida el contenido de hoy, avisos incluidos', () => {
    expect(validar(negocio, hoy(), CONTEOS)).toEqual([])
  })

  it('toda hoja tiene etiqueta, ayuda y sección', () => {
    recorre(negocio, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
    })
  })

  it('cada panel tiene su propia regla de conteo', () => {
    // Es lo que la `tupla` compra y la `lista` no podía: tres reglas
    // distintas sobre tres campos con la misma forma.
    const cuentas = new Map<string, string | undefined>()
    recorre(negocio, (ruta, meta) => cuentas.set(ruta, meta?.cuenta && `${meta.cuenta.de}/${meta.cuenta.sustantivo}`))
    expect(cuentas.get('negocios.tabs.0.cuerpo')).toBe('polvo/variedades')
    expect(cuentas.get('negocios.tabs.1.datos[]')).toBe('gotas/sabores')
    expect(cuentas.get('negocios.tabs.2.cuerpo')).toBe('sabores/barras')
  })

  it('avisa en el panel de barras si cambia la cantidad de sabores', () => {
    const problemas = validar(negocio, hoy(), { ...CONTEOS, sabores: 16 })
    expect(problemas).toContainEqual(
      expect.objectContaining({ campo: 'negocios.tabs.2.cuerpo', gravedad: 'avisa' }),
    )
  })
})
```

- [ ] **Paso 3: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'esquema de negocio'`
Expected: PASS los cuatro.

Mutaciones, una por vez:
1. Cambiá `tabs` de `tupla` a `lista` con el elemento del panel de barras → el tercero rojo (las tres rutas colapsan en `negocios.tabs[]`) y probablemente el primero también.
2. En el panel de barras, poné `sustantivo: 'sabores'` en vez de `'barras'` → el cuarto rojo: el texto dice «barras» y el aviso deja de dispararse. **Esta es la mutación que importa**, porque es el error que un humano cometería.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/negocio.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el esquema de Para negocios y las preguntas — 25 campos

Los tres paneles van como tupla y no como lista: cada uno menciona una
cantidad distinta —«Ocho variedades», «6 sabores», «Las 15 barras»— y el
metadato de una lista es uno solo para todos sus elementos. Salen de un
constructor parametrizado, no escritos tres veces.

Dos de los tres precios son derivados: el 258 está escrito en tres lugares
y el 108 en dos, y si la clienta sube las barras desde el anaquel esta
pestaña le sigue diciendo «desde $108» a las cafeterías.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 11: El esquema del sitio 5/6 — contacto y el formulario

**Files:**
- Create: `src/contenido/esquema/sitio/contacto.ts`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `camposDeContacto` — `{ contacto }`.
- Consume: `valorFijo` (Tarea 5), `correo`, `url`, `tupla`, `grupo`.

**46 campos**, el bloque más grande del documento — y el que la clienta más va a tocar, porque es donde vive su correo.

### `contacto` · sección `contacto`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `contacto.kicker` | `texto` | Antetítulo de la sección | La línea en versales arriba del título. | 20 |
| `contacto.titulo` | `texto` | Título de la sección | El título grande: «Estamos en Coyoacán». | 40 |
| `contacto.puestoEtiqueta` | `texto` | Etiqueta del puesto | La línea en versales sobre el nombre del mercado. | 30 |
| `contacto.puestoTitulo` | `tupla` de 2 | Nombre del puesto | El nombre del mercado, en dos renglones. Son dos cajas fijas. | — |
| `contacto.puestoTitulo.0` | `texto` | Primer renglón del nombre | La primera mitad: «Mercado de». | 20 |
| `contacto.puestoTitulo.1` | `texto` | Segundo renglón del nombre | La segunda mitad: «Coyoacán». | 20 |
| `contacto.direccion` | `tupla` de 2 | Dirección | Las dos líneas de la dirección del puesto. Son dos cajas fijas. | — |
| `contacto.direccion.0` | `texto` | Calle y colonia | La primera línea de la dirección. | 50 |
| `contacto.direccion.1` | `texto` | Alcaldía, código postal y ciudad | La segunda línea de la dirección. | 50 |
| `contacto.correoEtiqueta` | `texto` | Etiqueta del correo | La línea en versales sobre el correo. | 20 |
| `contacto.correo` ⚑ | `correo` | Correo de la marca | El correo que se ve en la página y al que llegan los mensajes. Se escribe también en el menú y en la sección Para negocios. | — |
| `contacto.correoNota` | `texto` | Nota del correo | La línea chiquita bajo el correo: para qué escribir. | 60 |
| `contacto.copiar` | `texto` | Botón de copiar | Lo que dice el botón antes de copiar el correo. | 30 |
| `contacto.copiado` | `texto` | Aviso de copiado | Lo que dice el botón un momento después de copiar. | 20 |
| `contacto.redesEtiqueta` | `texto` | Etiqueta de redes | La línea en versales sobre el nombre de usuario. | 20 |
| `contacto.redes` | `texto` | Nombre en redes | El nombre de usuario de la marca en redes sociales. | 20 |
| `contacto.redesNota` | `texto` | Nota de redes | La línea chiquita bajo el nombre de usuario. | 50 |
| `contacto.catalogoEtiqueta` | `texto` | Etiqueta del catálogo | La línea en versales sobre el enlace a la tienda. | 30 |
| `contacto.catalogoNombre` | `texto` | Nombre del catálogo | Cómo se lee el enlace a la tienda en línea. | 40 |
| `contacto.catalogoUrl` | `url` | Dirección del catálogo | A dónde lleva el enlace de la tienda en línea. | — |
| `contacto.catalogoNota` | `texto` | Nota del catálogo | La línea chiquita bajo el enlace de la tienda. | 60 |
| `contacto.personajeAlt` ⚑ | `texto` | Descripción del personaje | Cómo se describe el dibujo para quien no lo ve. No se ve en la página. | 100 |

### `contacto.formulario` · sección `contacto`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `…formulario.titulo` | `texto` | Título del formulario | El título del recuadro de escribir. | 20 |
| `…formulario.nombre` | `texto` | Caja del nombre | Lo que dice la caja donde la persona escribe su nombre. | 20 |
| `…formulario.correo` | `texto` | Caja del correo | Lo que dice la caja donde la persona escribe su correo. | 20 |
| `…formulario.tipo` | `texto` | Pregunta del tipo de contacto | La pregunta antes de las dos opciones. | 40 |
| `…formulario.tipoOpciones` | `tupla` de 2 | Las dos opciones | Compra personal o para un negocio. Son dos cajas fijas: la página elige el asunto del correo según cuál se marque. | — |
| `…tipoOpciones.0.valor` ⚑ | `valorFijo` `['personal']` | Nombre interno de la opción | Con este nombre la página elige el asunto del mensaje. No se cambia. | — |
| `…tipoOpciones.0.texto` | `texto` | Texto de la primera opción | Lo que se lee en la primera opción. | 80 |
| `…tipoOpciones.1.valor` ⚑ | `valorFijo` `['negocio']` | Nombre interno de la opción | Con este nombre la página elige el asunto del mensaje. No se cambia. | — |
| `…tipoOpciones.1.texto` | `texto` | Texto de la segunda opción | Lo que se lee en la segunda opción. | 80 |
| `…formulario.mensaje` | `texto` | Caja del mensaje | Lo que dice la caja donde la persona escribe su mensaje. | 20 |
| `…formulario.mensajeEjemplo` | `texto` | Ejemplo del mensaje | El texto gris de ejemplo dentro de la caja del mensaje. | 100 |
| `…formulario.enviar` | `texto` | Botón de enviar | Lo que dice el botón. | 30 |
| `…formulario.enviando` | `texto` | Botón mientras envía | Lo que dice el botón mientras se está mandando el mensaje. | 20 |
| `…formulario.nota` | `texto` | Nota del formulario | La línea chiquita bajo el botón. | 70 |
| `…formulario.exitoTitulo` | `texto` | Título del aviso de enviado | El título que aparece cuando el mensaje se mandó. | 30 |
| `…formulario.exitoSub` | `texto` | Texto del aviso de enviado | El párrafo que aparece cuando el mensaje se mandó. | 80 |
| `…formulario.otraVez` | `texto` | Botón de escribir otra vez | El botón que vuelve a abrir el formulario vacío. | 40 |
| `…formulario.aviso` | `parrafo` | Aviso de que falló el envío | Lo que se muestra si el mensaje no se pudo mandar y se abre la aplicación de correo. | 130 |
| `…formulario.trampa` ⚑ | `texto` | Caja trampa | Una caja invisible para las personas y visible para los programas que mandan correo basura. Lo que diga aquí no lo lee nadie. | 40 |
| `…formulario.asuntoPersonal` | `texto` | Asunto de una compra personal | El asunto del correo cuando alguien escribe por una compra personal. | 70 |
| `…formulario.asuntoNegocio` | `texto` | Asunto de un negocio | El asunto del correo cuando alguien escribe por su negocio. | 60 |

### Las filas con ⚑, completas

```ts
// ── El correo, que vive en CUATRO lugares ───────────────────────────
//
// Esta es la ruta CANÓNICA. `escribeTambien` declara las hermanas que
// reciben el mismo valor: el pie del menú desplegado y la sección Para
// negocios. La cuarta aparición está adentro de la respuesta de una
// pregunta frecuente («Escríbenos a maracacaomx@gmail.com…»), en medio de
// una oración, así que no puede ser una ruta hermana — la cubre el candado
// de la Tarea 16, que exige que todo correo escrito en el documento sea
// este mismo.
//
// `falla: ['ninguno']` porque el correo se renderiza PARTIDO —
// {usuario}@<wbr />{dominio}, index.astro:748 — para que no rompa el
// renglón en el celular. No hay un solo nodo que medir, y el panel muestra
// vista previa textual en vez de decir «no pude revisar».
//
// `enAtributo: 'data-copiar'` porque además viaja al atributo que lee el
// botón de copiar (index.astro:674).
contacto.correo: correo({
  seccion: 'contacto',
  etiqueta: 'Correo de la marca',
  ayuda: 'El correo que se ve en la página y al que llegan los mensajes. Se escribe también en el menú y en la sección Para negocios.',
  escribeTambien: ['nav.pie.1', 'negocios.correo'],
  enAtributo: 'data-copiar',
  falla: ['ninguno'],
})

// El dibujo del personaje batiendo chocolate.
contacto.personajeAlt: texto({
  seccion: 'accesibilidad',
  etiqueta: 'Descripción del personaje',
  ayuda: 'Cómo se describe el dibujo para quien no lo ve. No se ve en la página.',
  maxCaracteres: 100,
  enAtributo: 'alt',
  falla: ['ninguno'],
})

// Los dos valores del selector del formulario. La página los lee para
// elegir entre `asuntoPersonal` y `asuntoNegocio`: si cambian, el correo
// sale con el asunto equivocado y nada avisa. Por eso son valores fijos y
// no texto libre.
tipoOpciones.0.valor: valorFijo({
  seccion: 'contacto',
  etiqueta: 'Nombre interno de la opción',
  ayuda: 'Con este nombre la página elige el asunto del mensaje. No se cambia.',
  valores: ['personal'],
})
tipoOpciones.1.valor: valorFijo({ …lo mismo…, valores: ['negocio'] })

// El honeypot: invisible para humanos, irresistible para los bots. Va
// `quien: 'marcos'` — es una defensa, no copy, y si la clienta lo edita
// pensando que es un campo del formulario, lo rompe sin enterarse.
contacto.formulario.trampa: texto({
  seccion: 'contacto',
  etiqueta: 'Caja trampa',
  ayuda: 'Una caja invisible para las personas y visible para los programas que mandan correo basura. Lo que diga aquí no lo lee nadie.',
  maxCaracteres: 40,
  quien: 'marcos',
  falla: ['ninguno'],
})
```

- [ ] **Paso 1: Escribir el archivo**

Create `src/contenido/esquema/sitio/contacto.ts`, exportando `camposDeContacto`.

- [ ] **Paso 2: Los tres tests**

```ts
describe('el esquema de contacto', () => {
  const contacto = grupo({
    etiqueta: 'Contacto', seccion: 'contacto', ayuda: 'Prueba.',
    campos: camposDeContacto,
  })
  const hoy = () => ({ contacto: JSON.parse(JSON.stringify(fixture.marca.contacto)) })

  it('valida el contenido de hoy', () => {
    expect(validar(contacto, hoy(), {})).toEqual([])
  })

  it('toda hoja tiene etiqueta, ayuda y sección', () => {
    recorre(contacto, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
    })
  })

  it('el correo declara sus tres hermanas y rechaza lo que no es un correo', () => {
    const metas = new Map<string, MetaCampo | undefined>()
    recorre(contacto, (ruta, meta) => metas.set(ruta, meta))
    expect(metas.get('contacto.correo')?.escribeTambien).toEqual(['nav.pie.1', 'negocios.correo'])

    const roto = hoy()
    roto.contacto.correo = 'maracacaomx arroba gmail punto com'
    expect(validar(contacto, roto, {}).map((p) => p.campo)).toContain('contacto.correo')
  })
})
```

- [ ] **Paso 3: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'esquema de contacto'`
Expected: PASS los tres.

Mutaciones, una por vez:
1. Cambiá `contacto.correo` de `correo` a `texto` → la última aserción del tercero rojo.
2. Cambiá `tipoOpciones.1.valor` a `valorFijo({ …, valores: ['negocios'] })` (con s) → el primero rojo: el contenido dice `negocio` y el esquema exige `negocios`. **Es la mutación que importa**: ese valor lo lee la página para elegir el asunto del correo.

- [ ] **Paso 4: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/sitio/contacto.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el esquema de contacto y el formulario — 46 campos

El bloque más grande del documento y el que la clienta más va a tocar,
porque es donde vive su correo. El correo declara sus dos rutas hermanas;
la cuarta aparición está en medio de la respuesta de una pregunta y la
cubre un candado.

Los dos valores del selector van como valor fijo: la página los lee para
elegir el asunto del correo, y con texto libre un cambio manda todos los
mensajes con el asunto equivocado sin que nada avise.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 12: Las otras páginas, el pie, y el documento del sitio completo

La tarea que junta las cinco piezas.

**Files:**
- Create: `src/contenido/esquema/sitio/paginas.ts`
- Create: `src/contenido/esquema/sitio.ts` — la composición
- Modify: `src/contenido/campos.ts` — la sección `no-encontrada`
- Modify: `src/contenido/esquema/index.ts` — la entrada `sitio`
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `camposDePaginas` — `{ fichasTecnicas, noEncontrada, footer }` — y `esquemaSitio`, el `grupo` raíz con los 21 bloques.
- Consume: los cinco archivos de `esquema/sitio/`.

**32 campos** propios, y después la composición.

### `fichasTecnicas` · sección `fichas`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `fichasTecnicas.ruta` | `ruta` | Dirección de la página | La dirección de la página de fichas técnicas. No se cambia. | — |
| `fichasTecnicas.rutaInicio` | `ruta` | Dirección del inicio | A dónde lleva «Volver al sitio». No se cambia. | — |
| `fichasTecnicas.rutaPdf` | `ruta` | Carpeta de los PDF | Dónde se publican los PDF de las fichas. No se cambia. | — |
| `fichasTecnicas.titulo` ⚑ | `texto` | Título en Google de esta página | El renglón azul del resultado de búsqueda de la página de fichas. | 70 |
| `fichasTecnicas.descripcion` ⚑ | `parrafo` | Descripción en Google de esta página | El párrafo gris del resultado de búsqueda de la página de fichas. | 155 |
| `fichasTecnicas.kicker` | `texto` | Antetítulo de la página | La línea en versales arriba del título. | 40 |
| `fichasTecnicas.encabezado` | `texto` | Título de la página | El título grande de la página de fichas. | 30 |
| `fichasTecnicas.sub` | `parrafo` | Texto de entrada | El párrafo bajo el título: qué hay en las fichas. | 320 |
| `fichasTecnicas.tipoDocumento` | `texto` | Tipo de documento | La línea chiquita en el encabezado de cada ficha impresa. | 40 |
| `fichasTecnicas.indiceAria` | `texto` | Descripción del índice | Cómo describe el lector de pantalla la lista de fichas. No se ve. | 30 |
| `fichasTecnicas.descargar` | `texto` | Botón de descargar | Lo que dice el botón que baja el PDF. | 30 |
| `fichasTecnicas.descargarNota` | `texto` | Nota del botón | La línea chiquita bajo el botón: tamaño y páginas. | 30 |
| `fichasTecnicas.volver` | `texto` | Botón de volver | El botón que regresa al sitio. | 30 |
| `fichasTecnicas.contactoNota` | `texto` | Nota de contacto | La línea antes del correo, al pie de la página. | 30 |

`titulo` y `descripcion` llevan los mismos topes de Google que los de la portada (70 y 155) y la misma regla de `& < > "`. **Importá `sinHtml` desde `cabecera.ts`** en vez de volver a escribirla: la misma regla escrita dos veces es el patrón que esta capa ya pagó cuatro veces.

`indiceAria` va con `seccion: 'accesibilidad'`, `enAtributo: 'aria-label'` y `falla: ['ninguno']`.

### `noEncontrada` · sección `no-encontrada`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `noEncontrada.titulo` ⚑ | `texto` | Título en Google | El nombre de la pestaña del navegador. Esta página no la indexa Google. | 60 |
| `noEncontrada.encabezado` | `texto` | Título de la página | El título grande de la página de error. | 40 |
| `noEncontrada.sub` | `parrafo` | Texto de la página | El párrafo que explica qué pasó. | 120 |
| `noEncontrada.cta` | `texto` | Botón de volver | El botón que lleva al inicio. | 30 |
| `noEncontrada.rutaInicio` | `ruta` | Dirección del inicio | A dónde lleva el botón. No se cambia. | — |

**La sección `no-encontrada` no existe todavía.** Agregala al tipo `Seccion` en `campos.ts`:

```ts
export type Seccion =
  | 'portada'
  | 'productos'
  // … las que ya están …
  | 'buscadores'
  | 'accesibilidad'
  /** La página que se ve cuando un enlace está roto. */
  | 'no-encontrada'
```

`noEncontrada.titulo` **no** lleva `sinHtml`: los 404 no se indexan, así que el único consumidor es el `<title>` de la pestaña, y ahí Astro escapa solo.

### `footer` · sección `pie`

| Ruta | Constructor | Etiqueta | Ayuda | Tope |
|---|---|---|---|---|
| `footer.lema` ⚑ | `texto` | Lema de la marca | La frase grande del pie. Aparece también en la cinta que se desliza. | 110 |
| `footer.linea` | `texto` | Línea del pie | La línea en versales bajo el lema. | 50 |
| `footer.seccionesTitulo` | `texto` | Título de la columna de secciones | El encabezado de la primera columna del pie. | 20 |
| `footer.productosTitulo` | `texto` | Título de la columna de productos | El encabezado de la segunda columna del pie. | 20 |
| `footer.contactoTitulo` | `texto` | Título de la columna de contacto | El encabezado de la tercera columna del pie. | 20 |
| `footer.legalesTitulo` | `texto` | Título de la columna de legales | El encabezado de la cuarta columna del pie. | 20 |
| `footer.productos` | `lista` 1–10 | Enlaces de productos | La columna de productos del pie. | — |
| `footer.productos[].ancla` | `ancla` | A dónde lleva | El salto o la página a la que lleva este enlace. | — |
| `footer.productos[].texto` ⚑ | `medida` | Texto del enlace | Lo que se lee en el pie. Entre el número y la unidad va un espacio que no parte el renglón. | 60 |
| `footer.legales` | `lista` 1–6 | Páginas legales | Los nombres de las páginas legales. Todavía no tienen enlace. | — |
| `footer.legales[]` | `texto` | Página legal | El nombre de una página legal. | 40 |
| `footer.legalesNota` | `texto` | Nota de legales | La aclaración chiquita al lado: que todavía están en preparación. | 30 |
| `footer.derechos` | `texto` | Línea de cierre | La última línea del pie. | 90 |

**`footer.lema` es el que la §9 del spec descongela.** Hoy `test/marca-copy.test.ts:191` afirma la frase textual del cliente, lo que le prohíbe a la clienta editar su propio lema. Ese assert cae en la Tarea 17; acá se le pone lo que lo reemplaza: un tope y la regla de no-vacío que ya trae `texto`. La frase exacta queda congelada en el fixture, que es donde corresponde.

**`footer.productos[].texto` es `medida`**: dos de los nueve espacios duros del sitio viven ahí («Barras 70\u00a0g», «Gotas de chocolate 250\u00a0g», escritos con el escape).

### La composición

Create `src/contenido/esquema/sitio.ts`:

```ts
/*
 * El documento del sitio: 21 bloques.
 *
 * Está partido en cinco archivos por tema —cabecera, producto,
 * experiencia, negocio, contacto y páginas— y este los junta. Los cinco
 * exportan CLAVES y no grupos: si cada uno devolviera un `grupo`, el
 * documento tendría cinco niveles de anidamiento que no existen en el
 * contenido y todas las rutas del sistema cambiarían.
 *
 * El orden de las claves acá adentro es el orden en que `serializa()`
 * escribe el JSON y el orden en que el panel dibuja las secciones. Es el
 * de la página, de arriba hacia abajo.
 */
import { grupo } from '../campos'
import { camposDeCabecera } from './sitio/cabecera'
import { camposDeProducto } from './sitio/producto'
import { camposDeExperiencia } from './sitio/experiencia'
import { camposDeNegocio } from './sitio/negocio'
import { camposDeContacto } from './sitio/contacto'
import { camposDePaginas } from './sitio/paginas'

export const esquemaSitio = grupo({
  etiqueta: 'El sitio',
  seccion: 'portada',
  ayuda: 'Todo el texto de la página: la portada, los productos, las recetas, el contacto y el pie.',
  campos: {
    ...camposDeCabecera,
    ...camposDeProducto,
    ...camposDeExperiencia,
    ...camposDeNegocio,
    ...camposDeContacto,
    ...camposDePaginas,
  },
})
```

Y en `src/contenido/esquema/index.ts`:

```ts
export type IdDocumento = 'sitio' | 'sabores' | 'fichas'

export const DOCUMENTOS = {
  sitio: esquemaSitio,
  sabores: esquemaSabores,
  fichas: esquemaFichas,
} as const satisfies Readonly<Record<IdDocumento, z.ZodType>>
```

- [ ] **Paso 1: La sección nueva y el archivo de páginas**

Agregá `'no-encontrada'` a `Seccion` y escribí `src/contenido/esquema/sitio/paginas.ts`.

- [ ] **Paso 2: La composición**

Escribí `src/contenido/esquema/sitio.ts` y agregá la entrada al índice.

- [ ] **Paso 3: El test que solo se puede escribir ahora**

```ts
describe('el documento del sitio, entero', () => {
  const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, recetas: 4, preguntas: 8, pasos: 6, ingredientes: 5 }

  it('los 21 bloques están, en el orden de la página', () => {
    // El orden de las claves del esquema es el orden del JSON y el orden
    // en que el panel dibuja las secciones. Si alguien reordena los
    // spread de sitio.ts, el JSON entero se reescribe y el diff del
    // commit siguiente es de 900 líneas sin que haya cambiado nada.
    const bloques = Object.keys((esquemaSitio as unknown as { _zod: { def: { shape: object } } })._zod.def.shape)
    expect(bloques).toEqual([
      'titulo', 'descripcion', 'skipLink', 'marca', 'nav', 'hero',
      'postura', 'anaquel', 'minis', 'gotas', 'polvoCard', 'polvo',
      'catar', 'recetas', 'nosotros',
      'negocios', 'preguntas', 'contacto',
      'fichasTecnicas', 'noEncontrada', 'footer',
    ])
  })

  it('valida el contenido de hoy, entero y con avisos', () => {
    // La prueba de que el esquema describe EXACTAMENTE lo que hay. Si
    // sobra una clave o falta una, esto lo dice con la ruta.
    expect(validar(esquemaSitio, JSON.parse(JSON.stringify(fixture.marca)), CONTEOS)).toEqual([])
  })

  it('todas las hojas tienen etiqueta, ayuda y sección', () => {
    const rutas: string[] = []
    recorre(esquemaSitio, (ruta, meta) => {
      expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
      expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
      expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      rutas.push(ruta)
    })
    expect(new Set(rutas).size, 'hay rutas repetidas').toBe(rutas.length)
    expect(rutas.length).toBeGreaterThan(190)
  })

  it('ninguna etiqueta ni ayuda usa una palabra que la marca no usa', () => {
    // El filtro de MARCA vale también para lo que lee la clienta en el
    // panel. El de MAQUETA no: el panel necesita la palabra «Borrador».
    recorre(esquemaSitio, (ruta, meta) => {
      expect(palabraProhibida(meta?.etiqueta ?? ''), `en la etiqueta de ${ruta}`).toBeNull()
      expect(palabraProhibida(meta?.ayuda ?? ''), `en la ayuda de ${ruta}`).toBeNull()
    })
  })
})
```

- [ ] **Paso 4: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'documento del sitio, entero'`
Expected: PASS los cuatro.

Mutaciones, una por vez:
1. Cambiá el orden de dos spread en `sitio.ts` → el primero rojo.
2. Poné «chispas» en la ayuda de `gotas.cuerpo` → el cuarto rojo. **Es una mutación con un punto**: la palabra prohibida en un texto que la clienta lee todos los días es tan mala como en la página.
3. Borrá `skipLink` de `camposDeCabecera` → el segundo rojo con `el dato trae claves que el esquema no declara: skipLink`.

- [ ] **Paso 5: Compuerta y commit**

```bash
pnpm build
git add src/contenido/esquema/ src/contenido/campos.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el documento del sitio, completo — 21 bloques

Las otras dos páginas, el pie, y la composición de los seis archivos de
esquema/sitio/. El orden de las claves es el orden de la página de arriba
hacia abajo: es el orden en que serializa() escribe el JSON y en que el
panel va a dibujar las secciones, así que reordenarlo reescribe el archivo
entero sin que haya cambiado nada.

Todas sus hojas tienen etiqueta, ayuda y sección, y ninguna de esas dos
centenas de oraciones usa una palabra que la marca no usa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 13: Los derivados, la migración del sitio y la fachada

La tarea que apaga el TypeScript a mano.

**Files:**
- Modify: `src/contenido/derivados.ts` — `DERIVADOS_DEL_SITIO`, `injerta()`
- Modify: `scripts/migra-contenido.ts` — el modo `sitio`
- Create: `src/contenido/datos/sitio.json` (lo escribe el script)
- Modify: `src/copy/sitio-marca.ts` — 413 → ~26 líneas
- Test: `test/contenido.test.ts`

**Interfaces:**
- Produce: `DERIVADOS_DEL_SITIO`, `injerta(crudo, fuentes)`, y las mismas exportaciones de siempre en `src/copy/sitio-marca.ts`: `marca` y `precioMXN`.
- Consume: `esquemaSitio` (Tarea 12), `precioDesde` y `precioDe` (ya existentes), `sabores` y `gotas` de `src/copy/sabores` (Tarea 4).

**Los cuatro derivados, medidos.** El mismo número está escrito en hasta tres lugares:

```
258 → gotas[].precio (5 de 6)  Y  marca.gotas.precioDesde   Y  negocios.tabs[1].precio
340 → gotas[0].precio          Y  marca.gotas.precioJengibre
108 → sabores[].precio (14/15) Y  negocios.tabs[2].precio
```

Si la clienta sube las barras a 130 desde el anaquel, la pestaña «Para negocios» le sigue diciendo «desde $108» a las cafeterías, que son exactamente el público de esa pestaña. **Nada avisa.**

- [ ] **Paso 1: Los tres tests de los derivados, que hoy fallan**

```ts
describe('los derivados del sitio', () => {
  const FUENTES = {
    sabores: [{ precio: 122 }, { precio: 108 }],
    gotas: [{ clave: 'jengibreYNaranja', precio: 340 }, { clave: 'canela', precio: 258 }],
  }

  it('la tabla de derivados es exactamente la que el esquema declara', () => {
    // ES EL CANDADO DE LA TAREA. Sin él, un campo marcado `derivado` en el
    // esquema y ausente de esta tabla se queda sin valor: serializa() no
    // lo escribe, injerta() no lo calcula, y cargar() truena en el build
    // con «falta «precioDesde»» sin decir por qué. Y al revés —una entrada
    // de más— escribe un valor en una ruta que el esquema no marca como
    // derivada, y esa la clienta la puede editar creyendo que sirve.
    const delEsquema: string[] = []
    recorre(esquemaSitio, (ruta, meta) => {
      if (meta?.control === 'derivado') delEsquema.push(ruta)
    })
    expect(DERIVADOS_DEL_SITIO.map((d) => d.ruta).sort()).toEqual(delEsquema.sort())
  })

  it('injerta escribe los cuatro valores en su ruta', () => {
    const crudo = { gotas: {}, negocios: { tabs: [{}, {}, {}] } }
    const con = injerta(crudo, FUENTES) as {
      gotas: { precioDesde: number; precioJengibre: number }
      negocios: { tabs: { precio?: number }[] }
    }
    expect(con.gotas.precioDesde).toBe(258)
    expect(con.gotas.precioJengibre).toBe(340)
    expect(con.negocios.tabs[1].precio).toBe(258)
    expect(con.negocios.tabs[2].precio).toBe(108)
    expect(con.negocios.tabs[0].precio).toBeUndefined()
  })

  it('injerta no toca el objeto que recibe', () => {
    // El crudo viene del import del JSON, que en un bundle es un módulo
    // COMPARTIDO: mutarlo le cambia el contenido a cualquier otro que lo
    // importe, y el orden de los imports decide qué ve cada uno.
    const crudo = { gotas: {}, negocios: { tabs: [{}, {}, {}] } }
    injerta(crudo, FUENTES)
    expect(crudo.gotas).toEqual({})
  })
})
```

- [ ] **Paso 2: Correrlos y verlos fallar**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'derivados del sitio'`
Expected: FAIL — `DERIVADOS_DEL_SITIO` e `injerta` no existen.

- [ ] **Paso 3: La tabla y el injerto**

Agregá al final de `src/contenido/derivados.ts`:

```ts
/** De dónde salen los valores que no se editan. */
export interface FuentesDeDerivados {
  sabores: readonly { precio: number }[]
  gotas: readonly { clave: string; precio: number }[]
}

interface Derivado {
  /** La ruta punteada dentro del documento del sitio. */
  ruta: string
  calcula: (fuentes: FuentesDeDerivados) => number
}

/**
 * Los cuatro valores del documento del sitio que se calculan en vez de
 * editarse.
 *
 * Esta tabla y el metadato `control: 'derivado'` del esquema tienen que
 * decir exactamente lo mismo, y un test lo exige. Son dos declaraciones de
 * la misma verdad —el esquema para que el panel dibuje el campo en gris,
 * esta tabla para saber CÓMO se calcula— y ya sabemos qué pasa cuando dos
 * declaraciones de la misma verdad no tienen quién las mantenga alineadas.
 *
 * Las rutas con número (`negocios.tabs.1.precio`) son índices de `tupla`:
 * `recorre()` las emite así, con el índice, y por eso las dos listas se
 * pueden comparar directo.
 */
export const DERIVADOS_DEL_SITIO: readonly Derivado[] = [
  { ruta: 'gotas.precioDesde', calcula: (f) => precioDesde(f.gotas) },
  { ruta: 'gotas.precioJengibre', calcula: (f) => precioDe(f.gotas, 'jengibreYNaranja') },
  { ruta: 'negocios.tabs.1.precio', calcula: (f) => precioDesde(f.gotas) },
  { ruta: 'negocios.tabs.2.precio', calcula: (f) => precioDesde(f.sabores) },
]

/**
 * Devuelve una COPIA del documento con los derivados puestos en su lugar.
 *
 * Copia y no mutación porque el crudo llega del `import` del JSON, que en
 * un bundle es un módulo compartido: mutarlo le cambiaría el contenido a
 * cualquier otro que lo importe, y quién ve qué dependería del orden de
 * los imports. Esa clase de bug no se depura, se sufre.
 */
export function injerta(crudo: unknown, fuentes: FuentesDeDerivados): unknown {
  const copia = structuredClone(crudo) as Record<string, unknown>
  for (const { ruta, calcula } of DERIVADOS_DEL_SITIO) {
    const partes = ruta.split('.')
    const ultima = partes.pop() as string
    let donde: Record<string, unknown> = copia
    for (const parte of partes) {
      const hijo = donde[parte]
      if (hijo === null || typeof hijo !== 'object') {
        throw new Error(`injerta(): la ruta «${ruta}» se corta en «${parte}».`)
      }
      donde = hijo as Record<string, unknown>
    }
    donde[ultima] = calcula(fuentes)
  }
  return copia
}
```

- [ ] **Paso 4: Correr y probar detección**

Run: `pnpm exec vitest run test/contenido.test.ts -t 'derivados del sitio'` → PASS los tres.

Mutaciones, una por vez:
1. Borrá la entrada `negocios.tabs.2.precio` de la tabla → el primero rojo.
2. Cambiá `structuredClone(crudo)` por `crudo as Record<string, unknown>` → el tercero rojo.
3. Cambiá `precioDesde(f.sabores)` por `precioDesde(f.gotas)` en la última entrada → el segundo rojo. **Es el error que un humano cometería copiando la línea de arriba.**

Pegá las tres salidas.

- [ ] **Paso 5: El modo `sitio` del script**

```ts
function migraSitio(): void {
  // Los derivados NO se escriben (serializa() los omite), pero SÍ tienen
  // que estar en el objeto que se serializa: `ordenaSegun()` recorre el
  // esquema y reclama toda clave que el esquema declare y el dato no
  // traiga. El módulo viejo los tiene escritos a mano, así que alcanza con
  // pasarle `marca` tal cual.
  escribe('src/contenido/datos/sitio.json', serializa(esquemaSitio, estructura(marca)))
}
```

Agregalo al despacho y a la lista de modos.

- [ ] **Paso 6: Correrlo y verificar**

Run: `pnpm migra sitio`

```bash
python3 -c "
import json, io
s = io.open('src/contenido/datos/sitio.json', encoding='utf-8').read()
d = json.loads(s)
print('nbsp literales:', s.count(chr(0xa0)), '| escapes:', s.count('\\\\u00a0'))
print('bloques:', len(d))
print('orden:', list(d)[:6], '…', list(d)[-3:])
print('derivados ausentes:',
      'precioDesde' not in d['gotas'],
      'precioJengibre' not in d['gotas'],
      'precio' not in d['negocios']['tabs'][1],
      'precio' not in d['negocios']['tabs'][2])
print('el precio del polvo SÍ está y es null:', d['negocios']['tabs'][0]['precio'] is None)
print('chipPolvo solo en una receta:', sum('chipPolvo' in r for r in d['recetas']['lista']))
"
```

Expected, exacto:
```
nbsp literales: 0 | escapes: 9
bloques: 21
orden: ['titulo', 'descripcion', 'skipLink', 'marca', 'nav', 'hero'] … ['fichasTecnicas', 'noEncontrada', 'footer']
derivados ausentes: True True True True
el precio del polvo SÍ está y es null: True
chipPolvo solo en una receta: 1
```

Los cuatro `True` son la prueba de que `serializa()` omitió los derivados. El `null` del polvo es la prueba de que **no** los omitió a todos: ese es un `precioONada` de verdad, que la clienta va a llenar cuando el polvo salga a la venta.

- [ ] **Paso 7: La fachada**

Reemplazá `src/copy/sitio-marca.ts` **entero** por:

```ts
/*
 * La fachada del sitio. El contenido vive en
 * `src/contenido/datos/sitio.json` y su forma en
 * `src/contenido/esquema/sitio.ts`, que es también el catálogo de campos
 * que el panel lee para pintarse.
 *
 * Los cuatro precios derivados NO están en el JSON: se calculan acá, antes
 * de validar, porque el mismo número está escrito en hasta tres lugares y
 * pedirle a la clienta que los mantenga sincronizados es pedirle que se
 * equivoque. Ver `derivados.ts`.
 *
 * `cargar()` corre en el camino del import de index.astro: un JSON
 * inválido revienta `astro build` y Vercel deja servido el deploy
 * anterior. PROHIBIDO envolverlo en try/catch.
 */
import { cargar } from '../contenido/carga'
import { injerta } from '../contenido/derivados'
import { esquemaSitio } from '../contenido/esquema/sitio'
import datos from '../contenido/datos/sitio.json'
import { sabores, gotas } from './sabores'

export const marca = cargar(
  'src/contenido/datos/sitio.json',
  esquemaSitio,
  injerta(datos, { sabores, gotas }),
)

/** Precio en pesos con el locale del sitio. */
export function precioMXN(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}
```

- [ ] **Paso 8: La compuerta, que ahora corre el sitio entero desde JSON**

Run: `pnpm build`
Expected: verde, `astro check` **0 errores**.

Los errores de tipo posibles y qué significan:
- `Property 'X' does not exist` en `index.astro` → al esquema le falta un campo. Agregalo.
- `Type 'string' is not assignable to type '"canela" | …'` → un `claveSabor` quedó como `texto`.
- `Type 'number | null' is not assignable to 'number'` → un `precioONada` donde va un `precio`, o al revés.

**Arreglá el esquema. Nunca el `.astro`.**

- [ ] **Paso 9: La verificación que justifica toda la fase**

```bash
git stash
pnpm build:sitio && cp -r dist /tmp/dist-antes
git stash pop
pnpm build:sitio
diff -r /tmp/dist-antes dist && echo "EL SITIO ES IDÉNTICO"
```

Expected: `EL SITIO ES IDÉNTICO`.

**Si hay una sola diferencia, parás y la pegás en el reporte.** Este diff es la fase entera: 413 líneas de TypeScript a mano reemplazadas por un JSON y un esquema, y el HTML publicado tiene que ser el mismo byte a byte. Una diferencia acá es un dato que se movió en la migración, y encontrarlo ahora cuesta minutos; encontrarlo en producción cuesta la confianza de la clienta.

- [ ] **Paso 10: Commit**

```bash
pnpm build
git add src/contenido/derivados.ts src/contenido/datos/sitio.json src/copy/sitio-marca.ts scripts/migra-contenido.ts test/contenido.test.ts
git commit -m "$(cat <<'EOF'
feat: el sitio sale de JSON, y el dist es idéntico byte a byte

src/copy/sitio-marca.ts: 413 líneas a 26. Los cuatro precios que estaban
escritos en dos y tres lugares ahora se calculan en la fachada: si la
clienta sube las barras desde el anaquel, la pestaña Para negocios se
mueve con ellas en vez de seguir diciéndole «desde $108» a las cafeterías.

La tabla de derivados y el metadato del esquema tienen que decir lo mismo,
y hay un test que lo exige: son dos declaraciones de la misma verdad, y ya
sabemos qué pasa cuando nadie las mantiene alineadas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 14: El certificado — lo que reemplaza al golden HTML

**Files:**
- Create: `test/contenido-fachada.test.ts`

**Interfaces:**
- Consume: el fixture de la Tarea 3, y las tres fachadas ya reescritas.

**Por qué existe.** El fixture prueba que el JSON salió del contenido viejo. `serializa()` prueba que el esquema describe el contenido. Ninguno de los dos prueba **que la fachada re-exporte el mismo objeto**: el JSON puede estar perfecto y la fachada devolver `undefined` donde antes había valor, reordenar un array o coercer un número. Eso es lo que el golden HTML cubría, y esto lo cubre mejor porque dice POR QUÉ.

Van dos cosas: **tres igualdades profundas** y **ocho aserciones de forma**. Las de forma son las expresiones de `index.astro` que dependen de la FORMA y no del valor: son las que el golden habría cubierto por accidente y estas cubren a propósito.

- [ ] **Paso 1: El archivo**

Create `test/contenido-fachada.test.ts`:

```ts
/*
 * EL CERTIFICADO. Es permanente: no muere con la migración.
 *
 * Compara lo que las tres fachadas EXPORTAN contra la foto del árbol viejo
 * (`test/fixtures/contenido-2026-09-10.json`, capturada antes de tocar
 * nada). Si algún día alguien edita el contenido a propósito, este test se
 * pone rojo y ESO ES CORRECTO: el fixture se actualiza a mano, en el mismo
 * commit, y el diff muestra exactamente qué cambió. Lo que no puede pasar
 * es que cambie sin que nadie se entere.
 */
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/contenido-2026-09-10.json'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '@/copy/sabores'
import { fichasBase } from '@/fichas/base'

/**
 * La forma pura, sin readonly, sin undefined y sin prototipos:
 * exactamente lo que un JSON representa. Es la misma transformación que
 * usó el script al capturar el fixture, así que compara lo que importa.
 */
const estructura = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

describe('el certificado de la migración', () => {
  it('marca exporta el mismo objeto que antes de la migración', () => {
    expect(estructura(marca)).toEqual(fixture.marca)
  })

  it('los productos exportan el mismo objeto que antes', () => {
    expect(estructura(sabores)).toEqual(fixture.sabores)
    expect(estructura(gotas)).toEqual(fixture.gotas)
    expect(estructura(polvo)).toEqual(fixture.polvo)
    expect(urlCatalogoBarras).toBe(fixture.urlCatalogoBarras)
  })

  it('las fichas exportan el mismo objeto que antes', () => {
    expect(estructura(fichasBase)).toEqual(fixture.fichas)
  })
})

describe('las ocho aserciones de forma', () => {
  // Las expresiones de index.astro que dependen de la FORMA del dato y no
  // de su valor. Cada una nombra la línea que la necesita.

  it('1 · el chip de polvo NO existe como clave en las tres recetas sin chip', () => {
    // index.astro:448 pregunta `'chipPolvo' in r`, que es existencia de
    // CLAVE, no contenido. Un '' guardado renderiza una cajita amarilla
    // vacía de 6×10 px que estira las cuatro tarjetas.
    const conChip = marca.recetas.lista.filter((r) => 'chipPolvo' in r)
    expect(conChip).toHaveLength(1)
    expect(conChip[0].chipPolvo).toBeTruthy()
  })

  it('2 · el precio es null exactamente en el tab del polvo', () => {
    // index.astro:538 se estrecha con `t.precio === null`. Un undefined
    // en vez de null renderiza «$NaN».
    const nulos = marca.negocios.tabs.filter((t) => t.precio === null)
    expect(nulos).toHaveLength(1)
    expect(nulos[0].id).toBe('polvo')
    for (const t of marca.negocios.tabs) {
      expect(t.precio === null || Number.isInteger(t.precio)).toBe(true)
    }
  })

  it('3 · el renglón 2 del titular termina en coma y tiene una sola', () => {
    // index.astro:146 hace `.replace(/,$/, '')` y pinta una coma roja en
    // su lugar. Con dos comas, el h1 dice «…DE VERDAD,,».
    expect(marca.hero.titular[1]).toMatch(/^[^,]+,$/)
  })

  it('4 · el nombre del puesto se une con un espacio y da el nombre real', () => {
    // index.astro hace puestoTitulo.join(' ').
    expect(marca.contacto.puestoTitulo.join(' ')).toBe('Mercado de Coyoacán')
  })

  it('5 · la clave de los 15 sabores indexa los tokens de color', () => {
    // index.astro:52-53 hace colorSabor[s.clave] y tintaSabor[s.clave].
    for (const s of sabores) {
      expect(colorSabor[s.clave], s.slug).toBeTruthy()
      expect(tintaSabor[s.clave], s.slug).toBeTruthy()
    }
  })

  it('6 · el JSON del anaquel se renderiza y vuelve a parsear', () => {
    // La mina de la fase 0: un `</script` en un ingrediente mataba todo el
    // JS de la página y dejaba los 6 pasos de «Cómo catar» invisibles para
    // siempre. `jsonParaHtml` la desactivó; esto lo mantiene desactivado.
    const datos = sabores.map((s) => ({ slug: s.slug, ingredientes: s.ingredientes }))
    expect(() => JSON.parse(jsonParaHtml(datos).replace(/\\u003c/g, '<'))).not.toThrow()
    expect(jsonParaHtml(datos)).not.toContain('</script')
  })

  it('7 · el sabor con el que abre el anaquel existe', () => {
    // index.astro:35 hace `sabores.find((s) => s.slug === 'canela')!` — con
    // el `!` puesto. Si ese slug dejara de existir, TypeScript no dice
    // nada y la portada del anaquel se pinta con `undefined`: banda sin
    // color y nombre vacío. El slug va como `quien: 'marcos'`, así que la
    // clienta no puede romperlo — pero un candado de una línea sobre algo
    // que hoy solo sostiene un `!` es barato.
    expect(sabores.find((s) => s.slug === 'canela')).toBeDefined()
  })

  it('8 · los nueve espacios duros siguen siendo espacios duros', () => {
    // Sin ellos, en el celular la «g» o el «kg» quedan solas en el renglón
    // siguiente. Es el modo de falla que la clienta no puede ver desde su
    // escritorio.
    const DURO = '\u00a0' // escrito como escape, SIEMPRE
    const conDuro = [
      marca.anaquel.pesoInsignia,
      marca.gotas.titulo,
      marca.polvoCard.titulo,
      marca.negocios.tabs[0].titulo,
      marca.negocios.tabs[1].titulo,
      marca.negocios.tabs[2].titulo,
      marca.footer.productos[0].texto,
      marca.footer.productos[1].texto,
    ]
    for (const texto of conDuro) expect(texto, texto).toContain(DURO)
    // El del panel de polvo lleva DOS: «250 g y 1 kg».
    expect(marca.negocios.tabs[0].titulo.split(DURO)).toHaveLength(3)
    const total = conDuro.join('').split(DURO).length - 1
    expect(total, 'son nueve, medidos').toBe(9)
  })
})
```

Los imports que faltan arriba: `colorSabor` y `tintaSabor` de `@/tokens/color` (con `sabor as colorSabor`), y `jsonParaHtml` de `@/lib/json-en-html`.

- [ ] **Paso 2: Correr**

Run: `pnpm exec vitest run test/contenido-fachada.test.ts`
Expected: PASS las once (3 igualdades + 8 de forma).

**Si alguna de las tres igualdades falla, la migración perdió o cambió algo.** El diff de vitest te dice exactamente qué ruta. No arregles el fixture: arreglá el esquema o el script.

- [ ] **Paso 3: Probar el poder de detección de las once**

Es el test más importante de la fase; merece la prueba completa. Una mutación por vez, restaurando entre cada una:

1. En `src/contenido/datos/sitio.json`, cambiá una letra de `footer.lema` → la igualdad 1 roja, con la ruta.
2. En `sitio.json`, cambiá `chipPolvo` de la receta 4 por `""` → la igualdad 1 **y** la aserción 1 rojas.
3. En `sitio.json`, sacale la coma final a `hero.titular[1]` → la 3 roja (y `cargar()` truena antes, en el build: pegá las dos cosas).
4. En `sitio.json`, cambiá el espacio duro de `anaquel.pesoInsignia` por uno normal → la 8 roja (y `medida` la rechaza en `cargar()`).
5. En `derivados.ts`, cambiá `precioDe(f.gotas, 'jengibreYNaranja')` por `precioDesde(f.gotas)` → la igualdad 1 roja en `gotas.precioJengibre`: 258 donde va 340.

Pegá las cinco salidas en rojo y la restaurada en verde.

- [ ] **Paso 4: Commit**

```bash
pnpm build
git add test/contenido-fachada.test.ts
git commit -m "$(cat <<'EOF'
test: el certificado permanente de la migración

Tres igualdades profundas contra la foto del árbol viejo, más las ocho
aserciones de forma que cubren las expresiones de index.astro que dependen
de la FORMA y no del valor.

Es lo que reemplaza al golden HTML, y prueba lo que el golden no probaba:
que la fachada re-exporte el mismo objeto. El JSON puede estar perfecto y
la fachada devolver undefined donde había valor, reordenar un array o
coercer un número.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 15: Las mutaciones — 27 contenidos malos que la validación tiene que cachear

**Files:**
- Create: `test/contenido-mutaciones.test.ts`

**Interfaces:**
- Consume: `validar` (Tarea 1), los tres esquemas, el fixture.

**Por qué.** Hasta acá se probó que el contenido BUENO pasa. Eso es la mitad: un `validar()` que devolviera `[]` siempre también la pasaría. Esta tarea prueba la otra mitad, que es la que de verdad protege a la clienta.

Cada mutación va con **la ruta que tiene que salir en el problema**, no solo «tiene que fallar»: un error reportado en la ruta equivocada manda a la clienta a corregir un campo que está bien.

- [ ] **Paso 1: El archivo**

Create `test/contenido-mutaciones.test.ts`:

```ts
/*
 * Los contenidos malos conocidos, y la ruta exacta donde tiene que salir
 * el problema.
 *
 * Que salga la ruta correcta importa tanto como que falle: el panel usa
 * `Problema.campo` para llevar a la clienta al campo, y mandarla a
 * corregir uno que está bien es peor que no decirle nada.
 *
 * Cada caso arranca del contenido REAL —el fixture— y le cambia UNA cosa.
 * Así lo que falla es la mutación y no un contenido de prueba mal armado.
 */
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/contenido-2026-09-10.json'
import { esquemaSitio } from '@/contenido/esquema/sitio'
import { esquemaSabores } from '@/contenido/esquema/sabores'
import { esquemaFichas } from '@/contenido/esquema/fichas'
import { validar } from '@/contenido/validacion'

const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, recetas: 4, preguntas: 8, pasos: 6, ingredientes: 5 }

/** El contenido real, con una cosa cambiada. */
const conCambio = (
  base: unknown,
  cambia: (d: Record<string, never>) => void,
): unknown => {
  const copia = structuredClone(base) as Record<string, never>
  cambia(copia)
  return copia
}

const sitio = () => structuredClone(fixture.marca)
const productos = () => ({
  urlCatalogoBarras: fixture.urlCatalogoBarras,
  sabores: structuredClone(fixture.sabores),
  gotas: structuredClone(fixture.gotas),
  polvo: structuredClone(fixture.polvo),
})

describe('el sitio: lo que impide publicar', () => {
  const casos: [string, (d: any) => void, string][] = [
    ['el titular sin la coma final',            (d) => { d.hero.titular[1] = 'MEXICANO' },                    'hero.titular.1'],
    ['el titular con dos comas',                (d) => { d.hero.titular[1] = '70% CACAO, DE VERDAD,' },       'hero.titular.1'],
    ['un renglón de más en el titular',         (d) => { d.hero.titular.push('Y PUNTO.') },                   'hero.titular'],
    ['un renglón de menos en el titular',       (d) => { d.hero.titular.pop() },                              'hero.titular'],
    ['la insignia con espacio normal',          (d) => { d.anaquel.pesoInsignia = '70 g' },                   'anaquel.pesoInsignia'],
    ['la insignia vacía',                       (d) => { d.anaquel.pesoInsignia = '   ' },                    'anaquel.pesoInsignia'],
    ['una palabra que la marca no usa',         (d) => { d.gotas.cuerpo = 'Nuestras chispas de chocolate.' }, 'gotas.cuerpo'],
    ['un precio escrito adentro de un texto',   (d) => { d.gotas.cuerpo = 'Las bolsas cuestan $258.' },       'gotas.cuerpo'],
    ['un precio como texto',                    (d) => { d.minis.precio = '118' },                            'minis.precio'],
    ['un precio con centavos',                  (d) => { d.minis.precio = 118.5 },                            'minis.precio'],
    ['un precio en cero',                       (d) => { d.minis.precio = 0 },                                'minis.precio'],
    ['un precio con un cero de más',            (d) => { d.minis.precio = 1180000 },                          'minis.precio'],
    ['la descripción pasada de largo',          (d) => { d.descripcion = 'x'.repeat(200) },                   'descripcion'],
    ['un signo de HTML en el título',           (d) => { d.titulo = 'Chocolate <b>rico</b>' },                'titulo'],
    ['un correo sin arroba',                    (d) => { d.contacto.correo = 'maracacaomx.gmail.com' },       'contacto.correo'],
    ['una dirección web sin http',              (d) => { d.contacto.catalogoUrl = 'chocolateria.pulpos.shop' },'contacto.catalogoUrl'],
    ['un enlace del menú sin # ni /',           (d) => { d.nav.items[0].ancla = 'sabores' },                  'nav.items.0.ancla'],
    ['un color de sabor que no existe',         (d) => { d.catar.pasos[0].clave = 'chocolatito' },            'catar.pasos.0.clave'],
    ['el chip de polvo vacío',                  (d) => { d.recetas.lista[3].chipPolvo = '' },                 'recetas.lista.3.chipPolvo'],
    ['un panel de producto de más',             (d) => { d.negocios.tabs.push(structuredClone(d.negocios.tabs[0])) }, 'negocios.tabs'],
    ['la lista de legales vacía',               (d) => { d.footer.legales = [] },                             'footer.legales'],
    ['el valor del formulario cambiado',        (d) => { d.contacto.formulario.tipoOpciones[1].valor = 'negocios' }, 'contacto.formulario.tipoOpciones.1.valor'],
    ['una pregunta sin respuesta',              (d) => { d.preguntas.items[0].r = '' },                       'preguntas.items.0.r'],
  ]

  it.each(casos)('caza %s', (_nombre, cambia, ruta) => {
    const problemas = validar(esquemaSitio, conCambio(sitio(), cambia as never), CONTEOS)
    expect(problemas.length, 'no cazó nada').toBeGreaterThan(0)
    expect(problemas.map((p) => p.campo)).toContain(ruta)
    expect(problemas.every((p) => p.gravedad === 'impide')).toBe(true)
  })

  it('ningún mensaje que lee la clienta tiene jerga de programación', () => {
    // La razón entera por la que existe validacion.ts. «Expected string,
    // received number» no le dice nada a nadie, y «Invalid option» encima
    // está en inglés.
    const JERGA = /string|number|boolean|array|invalid|expected|received|required|undefined|null\b/i
    for (const [, cambia] of casos) {
      for (const p of validar(esquemaSitio, conCambio(sitio(), cambia as never), CONTEOS)) {
        expect(p.titulo, `${p.campo}: «${p.titulo}»`).not.toMatch(JERGA)
      }
    }
  })
})

describe('el sitio: lo que solo avisa', () => {
  it('avisa —sin impedir— cuando un texto quedó con el número viejo', () => {
    // El aviso NO bloquea: la clienta puede publicar con un texto que
    // quedó viejo, y es correcto que pueda. Lo que no puede es no
    // enterarse.
    const problemas = validar(esquemaSitio, sitio(), { ...CONTEOS, sabores: 16 })
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas.every((p) => p.gravedad === 'avisa')).toBe(true)
    expect(problemas.map((p) => p.campo)).toContain('anaquel.kicker')
  })
})

describe('los productos y las fichas', () => {
  const casos: [string, unknown, (d: any) => void, string][] = [
    ['un número de serie en cero',   esquemaSabores, (d) => { d.sabores[0].orden = 0 },                'sabores.0.orden'],
    ['un nombre de archivo con mayúsculas', esquemaSabores, (d) => { d.sabores[0].slug = 'Jengibre' }, 'sabores.0.slug'],
    ['la lista de barras vacía',     esquemaSabores, (d) => { d.sabores = [] },                        'sabores'],
    ['unos ingredientes vacíos',     esquemaSabores, (d) => { d.sabores[0].ingredientes = '' },        'sabores.0.ingredientes'],
  ]

  it.each(casos)('caza %s', (_n, esquema, cambia, ruta) => {
    const problemas = validar(esquema as never, conCambio(productos(), cambia as never), CONTEOS)
    expect(problemas.map((p) => p.campo)).toContain(ruta)
  })

  it('caza un bloque de ficha con una forma que no existe', () => {
    const datos = structuredClone({ fichas: fixture.fichas })
    ;(datos.fichas[0].secciones[0].bloques[0] as { tipo: string }).tipo = 'grafico'
    const problemas = validar(esquemaFichas, datos, CONTEOS)
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas[0].campo).toMatch(/^fichas\.0\.secciones\.0\.bloques\.0/)
  })
})
```

- [ ] **Paso 2: Correr**

Run: `pnpm exec vitest run test/contenido-mutaciones.test.ts`
Expected: PASS las 29 (23 del sitio + jerga + aviso + 4 de productos + 1 de fichas).

**Es muy probable que algunas fallen la primera vez, y ahí está el valor.** Los dos modos de falla, con qué significan:
- **«no cazó nada»** → falta una regla en el esquema. Agregala en el archivo que corresponda y decilo en el reporte: es un hallazgo real.
- **la ruta no coincide** → la regla existe pero reporta en el lugar equivocado. Suele pasar con `tupla` (el problema sale en la tupla, no en la parte) y es información: anotá la ruta REAL en la tabla y explicá por qué es la correcta. No fuerces la ruta que yo escribí acá si la de verdad es mejor.

- [ ] **Paso 3: Probar que el test de jerga tiene poder de detección**

En `src/contenido/validacion.ts`, hacé que `tituloSinJerga` devuelva `issue.message` tal cual (o sea: que deje pasar el mensaje de Zod).

Run: `pnpm exec vitest run test/contenido-mutaciones.test.ts -t 'jerga'`
Expected: **FAIL**, con el mensaje en inglés que hoy no llega a la clienta. Restaurá. Pegá las dos salidas.

- [ ] **Paso 4: Commit**

```bash
pnpm build
git add test/contenido-mutaciones.test.ts
git commit -m "$(cat <<'EOF'
test: 27 contenidos malos, con la ruta exacta donde tienen que salir

Hasta acá se probó que el contenido bueno pasa, que es la mitad: un
validar() que devolviera [] siempre también la pasaría.

Cada caso arranca del contenido real y cambia UNA cosa, y afirma la ruta
además del fallo: el panel usa esa ruta para llevar a la clienta al campo,
y mandarla a corregir uno que está bien es peor que no decirle nada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 16: Los candados que la arquitectura recién ahora hace posibles

**Files:**
- Modify: `test/contenido.test.ts` — un bloque nuevo al final

**Interfaces:**
- Consume: `DOCUMENTOS` (Tarea 12), las tres fachadas, `dist/index.html`.

**Por qué juntos.** Son los tests de la §11 del spec: los que no se podían escribir antes de que existiera un catálogo de campos. Van todos en una tarea porque comparten la misma forma —recorrer `DOCUMENTOS` y afirmar algo sobre todas las rutas— y un revisor los aprueba o los rechaza como conjunto.

- [ ] **Paso 1: Los ocho candados**

En `test/contenido.test.ts`, al final:

```ts
describe('los candados del sistema de contenido', () => {
  const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, recetas: 4, preguntas: 8, pasos: 6, ingredientes: 5 }

  /** El dato crudo de cada documento, con los derivados ya injertados. */
  const CRUDO: Record<IdDocumento, unknown> = {
    sitio: injerta(JSON.parse(readFileSync('src/contenido/datos/sitio.json', 'utf8')), { sabores, gotas }),
    sabores: JSON.parse(readFileSync('src/contenido/datos/sabores.json', 'utf8')),
    fichas: JSON.parse(readFileSync('src/contenido/datos/fichas.json', 'utf8')),
  }

  it('1 · los tres documentos están declarados', () => {
    expect(Object.keys(DOCUMENTOS).sort()).toEqual(['fichas', 'sabores', 'sitio'])
  })

  it('2 · toda ruta del esquema existe en el dato, y toda clave del dato está en el esquema', () => {
    // El candado anti-desincronización. `serializa()` ya lo verifica al
    // escribir, pero eso pasa UNA vez, cuando alguien corre el script.
    // Esto lo verifica en cada build, que es cuando importa: si alguien
    // edita un JSON a mano y le agrega una clave, o le saca una, el build
    // no publica.
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      expect(() => serializa(esquema, CRUDO[id as IdDocumento]), id).not.toThrow()
    }
  })

  it('3 · bytes canónicos: lo que se lee y se vuelve a escribir es idéntico', () => {
    // Si esto no se cumple, dos guardados seguidos producen diffs
    // distintos sin que haya cambiado nada, y el historial se llena de
    // ruido que esconde los cambios de verdad.
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      const ruta = `src/contenido/datos/${id}.json`
      const bytes = readFileSync(ruta, 'utf8')
      const cargado = cargar(ruta, DOCUMENTOS[id], CRUDO[id])
      expect(serializa(DOCUMENTOS[id], cargado) + '\n', id).toBe(bytes)
    }
  })

  it('4 · el contenido publicado no tiene ni un problema, avisos incluidos', () => {
    // El candado de conteos (Ruling F). `cargar()` no cruza conteos porque
    // un aviso no impide publicar; acá sí se exige que no haya ninguno,
    // porque este test corre adentro de `pnpm build` y el contenido que se
    // publica no tiene por qué tener textos viejos.
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      expect(validar(DOCUMENTOS[id], CRUDO[id], CONTEOS), id).toEqual([])
    }
  })

  it('5 · todo campo de todo documento tiene etiqueta, ayuda y una sección válida', () => {
    const SECCIONES = new Set<string>([
      'portada', 'productos', 'sabores', 'negocios', 'recetas', 'nosotros', 'catar',
      'preguntas', 'contacto', 'pie', 'fichas', 'buscadores', 'accesibilidad', 'no-encontrada',
    ])
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      recorre(esquema, (ruta, meta) => {
        expect(meta?.etiqueta, `${id} · ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `${id} · ${ruta}`).toBeTruthy()
        expect(SECCIONES.has(meta?.seccion ?? ''), `${id} · ${ruta}: sección «${meta?.seccion}»`).toBe(true)
      })
    }
  })

  it('6 · lo que la clienta lee en el panel pasa el filtro de la marca', () => {
    // El de MARCA, no el de MAQUETA: el panel necesita la palabra
    // «Borrador» para su concepto central.
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      recorre(esquema, (ruta, meta) => {
        expect(palabraProhibida(meta?.etiqueta ?? ''), `${id} · ${ruta} · etiqueta`).toBeNull()
        expect(palabraProhibida(meta?.ayuda ?? ''), `${id} · ${ruta} · ayuda`).toBeNull()
      })
    }
  })

  it('7 · lo que la clienta NO puede editar es exactamente lo declarado', () => {
    // El reparto de permisos, escrito una vez y verificado. Si mañana
    // alguien marca `quien: 'marcos'` en un campo de copy, la clienta se
    // queda sin poder editar su propio texto y nadie se entera hasta que
    // ella lo pide.
    const deMarcos: string[] = []
    recorre(DOCUMENTOS.sitio, (ruta, meta) => {
      if (meta?.quien === 'marcos') deMarcos.push(ruta)
    })
    // Rutas estructurales: anclas, identificadores internos, colores,
    // valores fijos, derivados y el honeypot. NINGUNA es copy.
    expect(deMarcos.sort()).toMatchInlineSnapshot()
  })

  it('8 · cada entrada del menú apunta a una sección que existe en la página', () => {
    // Hoy nada lo vigila, y es lo que rompe un cliente reordenando el
    // menú: el enlace queda y la sección no.
    // Mismo patrón que dejó la fase 0 en test/css-tokens.test.ts: se lee
    // del dist/ construido, y se saltea SOLO si no hay dist Y no estamos
    // en CI. En Vercel corre siempre, porque `pnpm build` construye antes
    // de testear.
    if (!existsSync('dist/index.html') && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[anclas] Falta dist/index.html: se salta el guard. Corré `pnpm build`.')
      return
    }
    expect(existsSync('dist/index.html')).toBe(true)
    const html = readFileSync('dist/index.html', 'utf8')
    for (const item of marca.nav.items) {
      expect(html, `${item.texto} → ${item.ancla}`).toContain(`id="${item.ancla.slice(1)}"`)
    }
  })

  it('9 · todo correo escrito en el sitio es el correo de la marca', () => {
    // El correo vive en CUATRO lugares y uno de ellos está en medio de la
    // respuesta de una pregunta frecuente, donde no puede ser una ruta
    // hermana de `escribeTambien`. Este candado lo cubre igual.
    const texto = JSON.stringify(CRUDO.sitio)
    const correos = new Set(texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])
    expect([...correos]).toEqual([marca.contacto.correo])
  })
})
```

**Sobre el candado 7:** `toMatchInlineSnapshot()` vacío se llena solo la primera vez que corre. **Revisá esa lista campo por campo antes de commitear** y confirmá en el reporte que ninguna ruta de copy quedó adentro. Un `quien: 'marcos'` de más es un campo que la clienta no va a poder editar y sobre el que nadie le va a avisar.

**Sobre el candado 8:** necesita `dist/index.html`. Seguí el patrón que la fase 0 dejó en `test/css-tokens.test.ts`: leer del `dist/`, y saltear **solo** cuando no hay `dist/` **y** no estamos en CI (`process.env.CI || process.env.VERCEL`). En Vercel corre siempre, porque `pnpm build` construye antes de testear.

- [ ] **Paso 2: Correr**

Run: `pnpm build`
Expected: los nueve verdes.

- [ ] **Paso 3: Probar el poder de detección de los que importan**

Cuatro mutaciones, una por vez:

1. Agregá `"basura": 1` a `sitio.json` en el nivel raíz → el candado 2 rojo con la clave. Restaurá.
2. Reordená dos claves de `sabores.json` a mano → el candado 3 rojo. **Restaurá con `git checkout src/contenido/datos/sabores.json`, NO con `pnpm migra sabores`:** una vez migrado el documento, el script lee la fachada, que lee ese mismo JSON — regenerarlo reescribe la mutación en vez de deshacerla.
3. Cambiá `nav.items[0].ancla` a `#sabor` en `sitio.json` → el candado 8 rojo. **Y el candado 2 sigue verde**: es un ancla válida como dato, y solo el HTML renderizado sabe que no existe. Anotá eso en el reporte: es la razón por la que este candado no puede vivir en el esquema.
4. Cambiá el correo de `negocios.correo` en `sitio.json` por otro → el candado 9 rojo. Restaurá.

Pegá las cuatro salidas.

- [ ] **Paso 4: Commit**

```bash
pnpm build
git add test/contenido.test.ts
git commit -m "$(cat <<'EOF'
test: los nueve candados que el catálogo de campos hace posibles

Ninguno se podía escribir antes de que existiera un esquema que supiera
nombrar todos sus campos: que el dato y el esquema no se separen, que dos
guardados den el mismo archivo, que el reparto de permisos sea el
declarado, que cada entrada del menú apunte a una sección que existe, y que
los cuatro correos del sitio sean el mismo.

El del menú vive fuera del esquema a propósito: un ancla rota es un dato
perfectamente válido, y solo el HTML renderizado sabe que no existe.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarea 17: Caen los asserts que le prohibían a la clienta editar su contenido

La última, y la que le da sentido a todas las anteriores.

**Files:**
- Modify: `test/marca-copy.test.ts` — se borran dos tests
- Modify: `test/sitio.test.ts:34` — se borra una aserción
- Modify: `docs/tests-que-congelan-contenido.md` — el estado de las filas

**Por qué al final.** Estos asserts son la única red que hoy existe sobre el contenido. Sacarlos antes de que el certificado (Tarea 14) y los candados (Tarea 16) estén puestos deja una ventana sin nada. Se sacan cuando lo que los reemplaza ya está verde.

**Lo que cae, y qué lo reemplaza.** De la §9 del spec, la lista de AHORA — solo los asserts de VALOR. Los de CONTEO se quedan hasta la fase 7, cuando exista el alta de ítems: hasta entonces nadie puede violarlos y son un guard gratis.

| Test | Qué dice hoy | Por qué cae | Qué lo reemplaza |
|---|---|---|---|
| `marca-copy.test.ts` · «precios del catálogo: jengibre y naranja 122, el resto 108» | Congela los dos precios exactos | Es literalmente lo primero que la clienta va a querer cambiar | El esquema garantiza entero, 1–99.999, nunca texto; y los derivados garantizan que los tres lugares donde está escrito el mismo precio no se separen |
| `marca-copy.test.ts` · «el lema del pie es la frase textual del cliente» | Congela la frase exacta | Le prohíbe a la clienta editar su propio lema | El esquema exige no vacío y ≤110 caracteres; la frase de hoy queda congelada en el fixture, que es donde corresponde |
| `sitio.test.ts:34` · `expect(html).toMatch(/\$\s?108/)` | Exige que el HTML publicado contenga «$108» | Si la clienta sube las barras a 130, el build falla y nadie sabe por qué | El certificado prueba que el objeto es el mismo; el candado 4 prueba que el contenido es válido; y la aserción de forma 2 prueba que los precios se renderizan |

- [ ] **Paso 1: Borrar los dos tests de `marca-copy.test.ts`**

Borrá el bloque `it('precios del catálogo: jengibre y naranja 122, el resto 108', …)` entero y el bloque `it('el lema del pie es la frase textual del cliente', …)` entero.

**No los reemplaces por una versión aflojada.** Un test que dice `expect(marca.footer.lema.length).toBeGreaterThan(10)` no protege nada que el esquema no proteja ya, y encima da la impresión de que sí.

- [ ] **Paso 2: Borrar la aserción de `sitio.test.ts`**

En el `it('renderiza el contenido real: …')`, borrá **solo** la línea:

```ts
    expect(html).toMatch(/\$\s?108/)
```

Las otras cinco aserciones de ese test se quedan: los 15 sabores, el correo, la URL del catálogo, «Tabasco» y la dirección. Ninguna congela un valor que la clienta vaya a editar — y las que leen de `marca` se mueven solas con el contenido.

Actualizá también el nombre del test, que enumera lo que verifica:

```ts
  it('renderiza el contenido real: los 15 sabores, correo, catálogo, Tabasco y punto de venta', async () => {
```

- [ ] **Paso 3: La tabla del documento**

En `docs/tests-que-congelan-contenido.md`, poné las tres filas como BORRADAS, con la fecha y el motivo. El documento es la bitácora de qué congela qué: dejarlo diciendo que esos tests existen es peor que no tenerlo.

- [ ] **Paso 4: La prueba de la cadena entera — lo único que demuestra que esto sirvió**

Esta es la verificación de la fase completa. **Cambiá un precio como lo haría la clienta** y corré todo:

```bash
python3 - <<'EOF'
import json, io
p = 'src/contenido/datos/sabores.json'
d = json.loads(io.open(p, encoding='utf-8').read())
for s in d['sabores']:
    if s['precio'] == 108:
        s['precio'] = 130
io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
EOF

pnpm build
```

Expected: **el build pasa entero, salvo el certificado de la Tarea 14**, que tiene que dar rojo diciendo que `sabores[].precio` y `negocios.tabs[2].precio` cambiaron respecto del fixture.

Eso es exactamente lo correcto, y hay que leerlo bien:
- **El certificado en rojo es la señal buena.** Detectó un cambio de contenido deliberado, que es su trabajo. En un cambio real, el fixture se actualiza en el mismo commit.
- **Que NADA MÁS esté en rojo es el logro de la fase.** Antes, ese mismo cambio rompía `marca-copy` («el resto 108») y `sitio.test.ts` (`/\$\s?108/`) con mensajes que no explicaban nada.
- **Y verificá que el precio derivado se movió solo:**

```bash
grep -A 2 '"id": "barras"' dist/index.html | head   # o buscá «desde $130» en el HTML
grep -c '\$130' dist/index.html
```

La pestaña «Para negocios» tiene que decir **$130**, no $108. Ese número no lo escribió nadie: salió de `precioDesde(sabores)`. **Es la fase entera en una línea.**

Después, restaurá:

```bash
git checkout src/contenido/datos/sabores.json
pnpm build   # todo verde de nuevo
```

Pegá en el reporte: la salida del build con el precio cambiado, el `grep` que muestra el $130, y el build restaurado en verde.

- [ ] **Paso 5: Commit**

```bash
pnpm build
git add test/marca-copy.test.ts test/sitio.test.ts docs/tests-que-congelan-contenido.md
git commit -m "$(cat <<'EOF'
test: caen los asserts que le prohibían a la clienta editar su contenido

Tres asserts de valor: los dos precios exactos, la frase textual del lema y
el «$108» en el HTML publicado. Los tres le prohibían editar justamente lo
que el panel existe para que edite, y los tres fallaban con mensajes que no
explicaban nada.

No cambian de rigor, cambian de naturaleza: el esquema garantiza que un
precio sea entero y esté en rango, los derivados garantizan que los tres
lugares donde está escrito no se separen, y el certificado detecta
cualquier cambio de contenido mostrando exactamente cuál.

Los asserts de CONTEO se quedan hasta la fase 7: hasta que exista el alta
de ítems nadie puede violarlos, así que son un guard gratis.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Cobertura del spec

Recorrí las secciones del spec que este plan implementa y anoté dónde queda cada requisito.

### §1 · La capa de contenido

| Requisito | Dónde |
|---|---|
| Los cuatro JSON en `datos/` | T4, T5, T6, T13 |
| Los esquemas en `esquema/` | T4, T5, T7–T12 |
| `max` como techo de cordura, no límite de diseño | Dicho en cada tabla de campos; el bloqueo geométrico es la fase 4 |
| Campo vacío tras trim | `texto`/`parrafo` (Parte A); mutación en T15 |
| Vocabulario prohibido de MARCA | `texto`/`parrafo` (Parte A); en las etiquetas y ayudas, candado 6 de T16 |
| `$` seguido de dígito en un texto | `texto` (Parte A); mutación en T15 |
| Precio entero, 1–99.999 | `precio` (Parte A); cuatro mutaciones en T15 |
| `& < > "` en `titulo` y `descripcion` | `sinHtml` en T7, importada por T12 |
| El renglón 2 del titular: exactamente una coma, al final | T7; mutaciones en T15; aserción 3 del certificado |
| `descripcion` ≤155 | T7 (y T12 para la de fichas técnicas) |
| Espacio duro entre cifra y unidad | `medida` en T8, T10 y T12; aserción 8 del certificado |
| Ingredientes contra el arte impreso | `test/marca-copy.test.ts`, que T6 conserva apuntando a la ruta nueva |
| Contraste banda/tinta ≥4.5, heredando `saboresSoloDisplay` | T4, paso 11 bis |
| `cargar()` que TIRA, sin try/catch | T4, T5, T13 — dicho en el encabezado de las tres fachadas |
| `serializa()` con bytes canónicos e invisibles escapados | Parte A; candado 3 de T16 |
| Los cuatro derivados | T13 |
| Los nueve campos que son atributo (`enAtributo`) | T7, T8, T9, T11, T12 |
| Las tres fachadas, de 915 líneas a ~58 | T4, T5, T13 |

### §2 · La validación

| Requisito | Dónde |
|---|---|
| `Problema` con `campo`, `gravedad`, `titulo`, `detalle`, `arreglo` | Parte A |
| Una verdad para los cuatro consumidores | T1 (`validar()`) |
| ~25 contenidos malos cazados | T15 — son 27, con la ruta exacta de cada uno |
| La cadena entera: cambiar un precio y correr `pnpm build` | T17, paso 4 |

### §9 · Los conteos congelados

| Requisito | Dónde |
|---|---|
| Caen los asserts de VALOR | T17 — son tres; el cuarto (`sitio:57`) ya murió en la fase 0 con `src/copy/sitio.ts` |
| Los asserts de CONTEO se quedan hasta la fase 7 | Explícito en T17 y en el encabezado del plan |
| `envolturas.json` se MUEVE, no se duplica | T6 |

### §10 · La migración

| Requisito | Dónde |
|---|---|
| Commit 1: el fixture, escrito por el script | T3 |
| Commit 2: los JSON con `serializa()` y las fachadas | T4, T5, T13 |
| El certificado permanente: 3 igualdades profundas | T14 |
| Las 8 aserciones de forma | T14 |
| Cero `.astro` tocados | Constraint global; verificado por el `diff -r` del paso 9 de T13 |

### §11 · Los tests que la arquitectura habilita

| Requisito | Dónde |
|---|---|
| Candado anti-desincronización | Candado 2 de T16 |
| Bytes canónicos | Candado 3 de T16 |
| Todo campo tiene etiqueta, ayuda y sección | Candado 5 de T16 |
| El reparto de permisos | Candado 7 de T16 |
| Las formas de `_zod.def` | T2, paso 8 (union y literal, sumadas al canario de la Parte A) |
| Los mensajes del panel pasan el filtro de MARCA | Candado 6 de T16 |
| Anclas vivas | Candado 8 de T16 |
| El JSON del anaquel parsea | Aserción 6 del certificado |
| Las ~25 mutaciones + la del build | T15 y T17 |
| `test/meta.test.ts`: ningún test invoca `pnpm build` | Ya existe desde la fase 0 |

### Lo que el spec pide y esta fase NO hace

Todo esto es de fases posteriores, y está acá para que nadie lo busque en vano:

- **La biyección campo↔`data-campo`, en los dos sentidos** (§3.1) — necesita que el HTML tenga los atributos. Es la **fase 2**.
- **Los dos arreglos de expresión de `index.astro`** (`'chipPolvo' in r` y `t.precio === null`) — son cambios de `.astro`. **Fase 2**, y esta fase clava la forma que hoy los hace innecesarios (aserciones 1 y 2 del certificado).
- **Todo el medidor**: que las cajas declaradas existan, que mida la misma caja que ve la visitante, que detecte 31 «W» y no 31 «i». **Fase 4**.
- **Los chequeos de sentido común de la bandeja de publicar** («el paquete de seis quedó más barato que seis barras sueltas», «el precio pasó de $122 a $1.300 — ¿seguro?»). **Fase 5**: no son reglas de dato, son avisos del momento de publicar.
- **Que el panel borre la clave al vaciar un campo opcional**, en vez de escribir `''`. **Fase 6**: no hay panel todavía.
- **La muerte de `sabores[].clave`** y el alta y baja de ítems. **Fase 7**.

---

## Al terminar

Cuando la Tarea 17 esté verde, esto es lo que hay:

- `src/copy/sitio-marca.ts`, `src/copy/sabores.ts` y `src/fichas/base.ts` pasan de **915 líneas de TypeScript a mano a ~58** de fachada.
- Todo el contenido del sitio vive en cuatro JSON que **nadie tipeó**: los escribió el script leyendo los módulos viejos.
- Existe un catálogo de campos con **etiqueta y ayuda en español mexicano para cada uno**, que es lo que la fase 6 va a leer para dibujarse sola.
- El `dist/` es **idéntico byte a byte** al de antes.
- La clienta puede cambiar un precio y el sitio entero se mueve con él, incluida la pestaña que ven las cafeterías.
- Y hay un certificado permanente que dice, en tres líneas, si algo del contenido cambió y qué.

**Lo que sigue es la fase 2**: instrumentar `index.astro` con `data-campo`, que es un cambio de markup y se verifica con un diff normalizado del HTML. Recién después de eso se puede tomar la línea base geométrica, porque medir contra un DOM que va a cambiar no sirve de nada.

**Sobre el fixture, para el que venga después.** `test/fixtures/contenido-2026-09-10.json` es la foto del contenido del 10 de septiembre de 2026. Cuando la clienta edite algo de verdad, el certificado va a dar rojo — **y eso es correcto**. El fixture se actualiza a mano, en el mismo commit del cambio, y el diff muestra exactamente qué se movió. Lo que no puede pasar es que el contenido cambie sin que nadie se entere. No lo regeneres automáticamente: el día que se regenere solo, deja de probar algo.
