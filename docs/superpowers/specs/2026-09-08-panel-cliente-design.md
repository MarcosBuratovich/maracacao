# El panel del cliente — diseño

**Fecha:** 2026-09-08 · **Rama:** `rediseno-marca` · **Estado:** diseño aprobado, pendiente de plan de implementación

Un panel de administración a medida dentro del repo para que la clienta de
Maracacao publique cambios en www.maracacao.mx sola, sin tocar git y sin
esperar a Marcos, y sin que un cambio de texto pueda romper la visual.

---

## Decisiones que tomó Marcos antes de este diseño

Estas no se re-litigan. Están acá para que el que lea el spec entienda por
qué el diseño es como es.

1. **La clienta publica sola.** Edita y el sitio se actualiza sin que Marcos
   intervenga. La validación en el panel es la red de seguridad, no la
   aprobación de un humano.
2. **El panel abre lleno** con el contenido de producción de hoy, migrado
   palabra por palabra. Nada de pantallas vacías: no se espera trabajo de la
   clienta para arrancar.
3. **Panel a medida dentro del repo**, no Keystatic, no TinaCMS, no SaaS. Se
   evaluaron cinco alternativas (ver «Por qué no un CMS de estantería»). El
   sitio sigue estático.
4. **Alcance comprometido: fases 0 a 6.** Textos y precios editables desde el
   celular. Las fases 7 y 8 (altas, bajas, fotos y entrega formal) quedan
   diseñadas en este documento pero fuera del compromiso actual.
5. **Vercel Pro ya está contratado.** Eso cierra el riesgo de suspensión por
   uso comercial en Hobby y destraba `maxDuration` y el tope de deploys.
6. **Acceso: contraseña larga como puerta principal** (guardada por el llavero
   del celular), enlace mágico por correo solo como recuperación.
7. **Los asserts de valor se borran.** Los tests dejan de congelar precios,
   el lema del pie y las frases textuales del cliente; pasan a verificar
   forma. Los asserts de *conteo* se mantienen hasta la fase 7, porque hasta
   entonces nadie puede agregar ni quitar ítems y son un guard gratis.
8. **Interfaz del panel 100% en español mexicano**, entendible por alguien no
   técnico.

## Por qué no un CMS de estantería

Se investigaron Keystatic, Decap, Sveltia, TinaCMS, Pages CMS, Storyblok,
Sanity, Contentful, Prismic, Directus y Payload contra los requisitos de este
proyecto. Resumen del descarte:

| Opción | Por qué no |
|---|---|
| Decap CMS | Sin `maxlength` ni contador; la validación es un regex que rebota recién al guardar. UI en español al 65%. |
| Pages CMS | Tres meses sin commits en `main`; sin contador; sin i18n; su GitHub App pide `administration:write`. |
| Sveltia CMS | El mejor contador de fábrica, pero exige cuenta de GitHub con scope `repo` completo sobre un repo privado, es pre-1.0 con breaking changes anunciados y bus factor 1. |
| Keystatic | MIT y el contenido no sale del repo, pero sin contador (el error salta al salir del campo, en inglés) y mantenimiento delgado. |
| TinaCMS | Vivo y financiado, pero el contador hay que escribirlo igual, y mete un SaaS en el camino crítico con plan gratis de 2 usuarios. |
| Storyblok / Sanity / Contentful | Sacan el contenido de git: los 677 tests dejan de custodiar la fuente de verdad. |

El argumento decisivo no es el contador. Es que el alcance elegido incluye
**trabajo derivado** —derivar tres WebP de una foto, calcular una tinta con
contraste medido, regenerar PDF de fichas, mantener coherentes precios
escritos en cinco lugares— y ningún CMS genérico hace trabajo derivado. Con
cualquiera de ellos habría que escribir ese trabajo igual, y encima la
clienta quedaría con un panel que no puede previsualizar el slot real.

---

## Índice

- [Resumen ejecutivo](#resumen-ejecutivo)
- [Arquitectura](#arquitectura) — el documento central. Secciones internas:
  - `0` Lo que se arregla antes de empezar (compuerta de build, la mina del JSON, limpieza, auditoría de los 677)
  - `1` La capa de contenido — `src/contenido/`, isomorfa
  - `2` La validación: una verdad, cuatro consumidores
  - `3` El medidor — geometría real, no conteo de caracteres
  - `4` Publicación — `api/panel.ts` + `src/servidor/`
  - `5` El panel — `src/pages/panel/` + `src/panel/`
  - `6` Fotos de producto *(fase 7, diferida)*
  - `7` Fichas técnicas: el PDF sobrevive pero se apaga solo
  - `8` Alta y baja de ítems *(fase 7, diferida)*
  - `9` Los conteos congelados
  - `10` La migración, y cómo se prueba
  - `11` Tests nuevos que la arquitectura habilita
- [Decisiones de diseño](#decisiones-de-diseño)
- [Mapa de archivos](#mapa-de-archivos)
- [Orden de trabajo](#orden-de-trabajo)
- [Riesgos residuales](#riesgos-residuales)
- [Preguntas abiertas](#preguntas-abiertas)
- [Apéndice A · Correcciones tras la crítica adversarial](#apéndice-a--correcciones-aplicadas-tras-la-crítica-adversarial)
- [Apéndice B · Críticas rechazadas](#apéndice-b--críticas-rechazadas)

---

## Resumen ejecutivo

Un panel a medida dentro del repo para que la clienta publique sola, con el sitio siguiendo estático y $0/mes.

El copy deja de ser TypeScript a mano y pasa a cuatro JSON en `src/contenido/datos/`. La forma de esos datos vive en un esquema Zod con constructores propios que EXIGEN etiqueta y ayuda en español: un campo sin etiqueta no compila. Ese registro es el único catálogo de campos del sistema — lo lee el panel para pintarse, la función para rechazar, vitest para verificar y el build de Vercel para no deployar basura.

Verifiqué las críticas contra el repo y cinco bloqueantes son reales. Los reproduje:

1. `pnpm test` HOY corre un `astro build` completo adentro (test/css-tokens.test.ts:67). Poner `vitest run` dentro de `build` es una fork bomb. **Se invierte el orden: `build` = `astro build && vitest run && astro check`.** Los tests leen el `dist/` recién construido — la compuerta queda más fuerte, no más débil, y no hay recursión posible.
2. La biyección campo↔nodo es falsa. Medí las 321 hojas contra `dist/index.html`: 118 aparecen 2+ veces (`anaquel.pesoInsignia` ×17, `manoInsignia` ×15 — las 15 fichas se prerenderizan) y `hero.titular.1` aparece CERO porque index.astro le saca la coma. **El mapeo es uno-a-muchos, y hay un segundo atributo para los que son alt/aria.**
3. `prepararDocumento()` revelando las 15 fichas de una miente. Lo medí en Chrome: `.chips` mide **407 px con una ficha visible (idéntico en los 15) y 331/444/633 px con las 15 reveladas**. Falso positivo y falso negativo en el único gate que bloquea duro. **Se revela una por vez** — y como los 15 dan el mismo número, alcanza con medir UNA.
4. `set:html={JSON.stringify(datosAnaquel)}` sin escapar + `JSON.parse` sin try. Un `</script` en un ingrediente mata todo el JS de la página y deja los 6 pasos de «Cómo catar» invisibles para siempre (`html.js [data-revelar]{opacity:0}`). **Es una mina latente, no una falla activa: verificado que hoy ningún campo de contenido contiene `<` y que el JSON renderizado parsea limpio. Se arma sola en el momento en que la clienta puede escribir. Se desactiva en la fase 0.**
5. Sin Resend con dominio verificado nadie entra al panel. `api/contacto.ts:99` cae a `onboarding@resend.dev`, que solo entrega al dueño de la cuenta. **La puerta principal pasa a ser una contraseña larga en el llavero del teléfono; el enlace mágico queda como recuperación.**

Además: si el build falla con el commit de la clienta ya en main, la función **revierte sola** y se lo dice en español. Y el PDF de fichas no se mata: se le pone un sello de vigencia y **se apaga solo cuando queda viejo** — el B2B conserva el archivo, y servir alérgenos viejos se vuelve imposible.

Se saca todo lo que sobraba: sin `medidas.generated.json` ni su guard de frescura (el gate de CI mide HEAD contra HEAD~1, no contra un archivo congelado), sin golden HTML, sin `Inmutable<T>`, sin tres iframes (uno solo, redimensionado en serie), sin `catalogo-barras`, sin homografía de cuatro esquinas en el camino crítico.

---

# Arquitectura

> **Nota de alcance:** las secciones 6 (fotos) y 8 (altas y bajas) describen
> las fases 7-8, fuera del compromiso actual. Se conservan porque la capa de
> contenido de la fase 1 y la instrumentación de la fase 2 se diseñan para
> soportarlas sin reescritura.

```
═══════════════════════════════════════════════════════════
EL MAPA EN UNA LÍNEA
═══════════════════════════════════════════════════════════

  datos JSON → esquema Zod (forma + metadato) → cargar() → derivados() → fachadas → index.astro
                     ↑                                                        ↑
              el panel se pinta de acá                    el medidor mide ESTO, en vivo, diferencial
              la función rechaza con esto
              vitest verifica con esto

Todo lo que verifiqué en este repo está marcado [MEDIDO].


═══════════════════════════════════════════════════════════
0 · LO QUE SE ARREGLA ANTES DE EMPEZAR
═══════════════════════════════════════════════════════════

─── 0.1 · La compuerta de build, sin recursión ───

[MEDIDO] `pnpm test` hoy imprime un `astro build` completo (11 páginas,
sitemap incluido) en el medio de los 677 tests. Sale de
test/css-tokens.test.ts:67, `execSync('pnpm build', {timeout:60000})`.
Poner `vitest run` adentro de `build` hace que el build se llame a sí
mismo. Todos los deploys quedarían rojos para siempre.

Se invierte el orden en vez de blindar el test:

  "build:sitio": "astro build",
  "verifica":    "vitest run && astro check",
  "build":       "pnpm build:sitio && pnpm verifica"

Y css-tokens.test.ts deja de construir: LEE `dist/index.html`, y si no
existe se salta con un mensaje («corré pnpm build:sitio primero»).

Esto es mejor que blindar con una variable de entorno por tres razones:
  · No hay recursión POSIBLE, no una recursión evitada por disciplina.
  · El test pasa a verificar el artefacto que Vercel realmente publica,
    que era su intención declarada en el comentario del propio test.
  · Le regala al guard del CSS su hash correcto: el `<style>` inline de
    dist/index.html (§3.5) sale gratis porque el build ya corrió.

Red anti-reincidencia: `test/meta.test.ts` grepea `test/**` buscando
`pnpm build` / `pnpm run build` y falla. Es una trampa que se puede
volver a poner.

RIESGO QUE HAY QUE DESPEJAR EN LA MISMA FASE: los 677 tests tienen que
correr en el contenedor de build de Vercel, no solo en la máquina de
Marcos. `@resvg/resvg-js` es nativo y `test/render.test.ts` hace
`execFileSync` sobre `scripts/render-svg.mjs`. Si algo de eso no corre
allá, se parte en `verifica:vercel` (el subconjunto puro) y el resto
queda solo en Actions. Esto se prueba con un push de prueba ANTES de
que nada dependa de la compuerta.

─── 0.2 · El JSON del anaquel puede matar la página HOY ───

index.astro:775:
  <script type="application/json" id="datos-anaquel"
          set:html={JSON.stringify(datosAnaquel)} />

`set:html` no escapa nada. src/scripts/marca.ts:187 hace
`JSON.parse(datosCrudos)` sin try. Y `<script>import '@/scripts/marca'</script>`
es un módulo único: si tira, muere entero.

[MEDIDO] Consecuencia exacta de un `</script` adentro de cualquier campo
de sabor: se van el copiar-correo, el envío del formulario por fetch, el
parallax, el cursor de sello — y como marca.css:212 dice
`html.js [data-revelar]{opacity:0}` y `data-revelar` está en index.astro:408
(los 6 pasos de «Cómo catar», dentro del `.map`), esos SEIS PASOS QUEDAN
INVISIBLES PARA SIEMPRE. Los 677 tests pasan, el build pasa, el deploy
sale verde.

Tres arreglos, ninguno caro, todos en la fase 0:
  1. `JSON.stringify(datosAnaquel).replace(/</g, '\\u003c')` en index.astro.
  2. try/catch alrededor del JSON.parse en marca.ts, con las 15 fichas
     visibles como degradado (es el estado sin-JS, que ya se ve completo).
  3. Test que hace `JSON.parse` del `#datos-anaquel` del HTML renderizado.
Y en la fase 1, regla de esquema: `<` prohibido en todo campo que viaje
a `set:html` o al JSON-LD.

─── 0.3 · El resto de la limpieza de fase 0 ───

  · [MEDIDO] `src/copy/sitio.ts`: 354 líneas, único consumidor
    test/sitio.test.ts:12. Se borra con su describe.
  · [MEDIDO] `paqueteSeis` está IMPORTADO en index.astro:25 y no se usa
    en ninguna parte del cuerpo. Se borra del import y del módulo. Si
    el panel lo expusiera, la clienta editaría un precio que no cambia
    nada en la página — el peor caso posible, porque insiste.
  · `_barras.astro` y todo el bloque `catalogoBarras` (18 campos) se
    borran. `src/seo/esquema.ts:58` pasa de `marca.catalogoBarras.encabezado`
    a `marca.anaquel.titulo`: hoy publica como `name` del ItemList el
    encabezado de una página sin rutear desde el 2026-08-17.
  · Los 3 campos muertos: `marca.selloAlt`, `anaquel.verTodas`,
    `footer.wordmarkAlt` (0 apariciones en el HTML [MEDIDO]).
  · [MEDIDO] `zod` NO está en node_modules/ raíz (solo en
    .pnpm/zod@4.4.3): `import 'zod'` desde api/ falla hoy. Pasa a
    `dependencies`. `sharp` pasa a `devDependencies` explícita
    (mismo problema, solo transitiva).
  · Escapar la interpolación cruda de regex en los 4 tests que la
    tienen: sitio.test.ts:169-171 (wordmark), seo.test.ts:208
    (nombres de sabor), fichas.test.ts:60 (producto), :79 (ruta). Una
    función `esc()` de una línea. Con eso la clienta puede escribir
    «Lima (con chile)» y «Fresas & chile» sin que nada explote, y deja
    de haber una restricción de vocabulario que existía solo porque un
    test estaba mal escrito.
  · index.astro:145: `titular[1].replace(',','')` saca la PRIMERA coma.
    Pasa a `.slice(0,-1)`, que dice lo que quiere decir.
  · docs/tests-que-congelan-contenido.md (§0.4).
  · La prueba de humo de Resend (§4.1).

─── 0.4 · La auditoría de los 677, como tarea propia ───

La lista de «conteos congelados» estaba armada a ojo. Auditando
encontré, además de los enumerados:

  sitio.test.ts:77    expect(html).toMatch(/\$\s?108/)
                      → el precio congelado en un SEGUNDO lugar. Es el
                        caso de uso número uno del panel.
  sitio.test.ts:169-171  new RegExp(`class="lockup-nombre"[^>]*>${wordmark}<`)
                      → asume texto pegado al `>`. Envolver el wordmark
                        en un <span data-campo> rompe tres tests de una.
  marca-copy:118-127  exige CINCO archivos por sabor (barra, mini,
                      ilustración, envoltura/-frente, pliego). Choca de
                      frente con «un sabor sale al aire con solo la foto
                      de la barra».
  marca-copy:191      el lema del pie, string exacto.
  marca-copy:139,161  precios 122/108 y 340/258.
  marca-copy:53       lee docs/envolturas.json con readFileSync.
  seo.test.ts:208     `<h3 class="ficha-nombre"[^>]*>${nombre}</h3>`
  fichas.test.ts:60   `<h2[^>]*>${f.producto}</h2>`
  css-tokens.test.ts:67  el execSync (§0.1)

La auditoría completa de los 26 archivos es una tarea con horas propias
y va ANTES de tocar el script de build. Entrega:
`docs/tests-que-congelan-contenido.md`, una tabla de
`archivo:línea → qué edición lo rompe → qué se hace con él`.


═══════════════════════════════════════════════════════════
1 · LA CAPA DE CONTENIDO (src/contenido/) — ISOMORFA
═══════════════════════════════════════════════════════════

REGLA DURA DE LA CARPETA: `src/contenido/**` no importa `node:*`, no
importa Astro y usa SOLO rutas relativas sin extensión (nada de `@/`).
Es la condición para que el MISMO código corra en el navegador de la
clienta, en la función serverless y en vitest. Un test lo verifica con
grep. Dependencias externas permitidas: `zod` y `../tokens/color` +
`../tokens/contrast` (ambos puros, verificado).

  src/contenido/
    vocabulario.ts    DOS listas (ver 1.5)
    campos.ts         constructores + z.registry<MetaCampo>()
    carga.ts          cargar() · serializa() · recorre()
    derivados.ts      los precios y conteos que NO se editan (1.4)
    validacion.ts     validar(doc, crudo) → Problema[]
    diff.ts           resume(antes, después) → Cambio[] · frase()
    conteos.ts        la regla `cuenta` + tabla de 1 a 20 en letras
    color-sabor.ts    resuelveColor() · mejorTinta() · la regla de contraste
    esquema/{sitio,sabores,fichas,index}.ts
    datos/{sitio,sabores,fichas,envolturas}.json

  NO EXISTEN: catalogo-barras.{ts,json}, limites.ts, medidas.generated.json,
  src/panel/catalogo.ts, src/panel/medidas.ts, src/anti-desborde/slots.ts,
  src/cms/validacion.ts. Eran los mismos campos escritos cinco veces.

─── 1.1 · Los constructores ───

  export interface MetaCampo {
    etiqueta: string        // «Renglón 2 del titular» — OBLIGATORIO
    seccion: Seccion
    ayuda: string           // la oración de «dónde vive» — OBLIGATORIA
    quien?: 'cliente' | 'marcos'          // default 'cliente'
    control?: 'texto' | 'parrafo' | 'precio' | 'medida' | 'renglones'
            | 'lista' | 'foto' | 'regulado' | 'derivado' | 'oculto'
    max?: number            // TECHO DE CORDURA, no el límite de diseño
    min?: number
    sufijo?: string         // el ':' que agrega la plantilla, se dibuja gris
    cuenta?: 'sabores' | 'gotas' | 'polvo' | 'recetas' | 'preguntas'
    escribeTambien?: string[]
    nombra?: (v: unknown) => string
    falla?: ModoFalla[]     // nowrap · fila · renglones · alto · ninguno
    enAtributo?: string     // 'alt' | 'aria-label' | 'data-copiar' (1.7)
    mayusculas?: boolean
  }
  export const panel = z.registry<MetaCampo>()

[MEDIDO] `z.registry` existe en zod 4.4.3 y las formas de `_zod.def` son:
object→`shape`, array→`element`, tuple→`items`+`rest`, optional→`innerType`,
discriminatedUnion→`options`+`discriminator`+`inclusive`. `recorre()` (~60
líneas) es lo único que toca interna de Zod, y `test/contenido.test.ts`
afirma cada una de esas formas: si Zod las mueve, falla ahí y no en el panel.

Constructores: `texto`, `parrafo`, `precio`, `precioONada`, `numero`,
`medida`, `claveSabor`, `tokenColor`, `ruta`, `url`, `correo`, `slug`,
`archivo`, `opcion`, `grupo`, `tupla`, `lista`, `derivado`.

`tupla` = forma fija (los 3 renglones del titular, las 2 líneas de
dirección, las 2 opciones del formulario): cajas fijas, sin «agregar».
`lista` = colección con min/max: agregar, quitar, reordenar.

─── 1.2 · Dos clases de límite ───

  · `max` DEL ESQUEMA = techo de cordura, generoso (insignia: 60, no 31).
    Bloquea en `cargar()`. Existe para atajar datos absurdos, no para
    hacer diseño. Es lo único que alimenta el contador del panel, y el
    panel lo dice con esas palabras: «tope de seguridad», no «cabe».
  · EL BLOQUEO GEOMÉTRICO lo decide el medidor midiendo la página de
    verdad, en diferencial contra lo publicado (§3).

Razón: 31 «W» miden 426.52 px y 31 «i» 141.89 px contra un interior de
tarjeta de 282 px. Un número escrito a mano es a la vez falso positivo
y falso negativo.

Lo que SÍ bloquea desde el esquema, porque son reglas de DATO:
  · campo vacío tras trim
  · vocabulario prohibido de MARCA (§1.5)
  · `$` seguido de dígito en un texto
  · precio que no es entero, o fuera de 1–99.999
  · `<` en todo campo que viaje a `set:html` o al JSON-LD (§0.2)
  · `& < > "` en marca.titulo / marca.descripcion
  · el renglón 2 del titular: `/^[^,]+,$/` — EXACTAMENTE UNA COMA, al
    final. La regla «termina en coma» dejaba pasar
    '70% CACAO, DE VERDAD,' → index.astro saca la primera y repinta una
    → «70% CACAO DE VERDAD,,» en el h1. Con `.slice(0,-1)` (§0.3) el
    regex y el render dicen lo mismo.
  · `descripcion` ≤155 (Google corta)
  · espacio duro donde toca (§1.6)
  · ingredientes: prefijo exacto normalizado del arte impreso (§8.3)
  · contraste banda/tinta ≥4.5 vía `.superRefine` con el `contrastRatio`
    que ya está en el repo y es puro. Hoy [MEDIDO] hierbabuena da 4.41 y
    está declarada `saboresSoloDisplay` en src/tokens/color.ts:182: la
    regla del esquema hereda esa excepción por slug, no la reinventa.

─── 1.3 · El cargador ───

  cargar(archivo, esquema, crudo, conteos) → Readonly<z.infer<E>>

Valida con Zod, cruza la regla `cuenta`, congela con Object.freeze
recursivo, devuelve el objeto. Si falla, TIRA con la ruta punteada y el
mensaje en español:

    src/contenido/datos/sitio.json — 2 problema(s):
      hero.titular.1: Tiene que terminar en «,» y tener una sola.
      anaquel.kicker: dice «15» pero hoy hay 16 sabores.

`cargar()` corre DENTRO del módulo que index.astro importa, así que un
JSON inválido revienta `astro build` y Vercel deja servido el deploy
anterior. Prohibido envolverlo en try/catch.

SE VA `Inmutable<T>`: era un mapped type recursivo sobre 321 hojas y 5
niveles para preservar un `readonly` que ningún consumidor necesita, a
cambio de encarecer `astro check`. El Object.freeze recursivo da la
garantía real en runtime.

  serializa(esquema, valor) → string
Bytes canónicos: orden de claves = orden del esquema, y los invisibles
(U+00A0 y compañía) escapados como ` `. [MEDIDO] hoy el copy los
escribe así (`'70 g'` en sitio-marca.ts:88) y hay CERO caracteres
U+00A0 literales en el fuente: la convención ya existe y se conserva.

─── 1.4 · Derivados: lo que la clienta NO edita porque se calcula ───

[MEDIDO] El precio está escrito en más lugares de los que nadie contó:
  108 → sabores[].precio (14 barras) Y negocios.tabs[2].precio
  258 → gotas[].precio (5 de 6) Y marca.gotas.precioDesde Y tabs[1].precio
  340 → gotas[0].precio Y marca.gotas.precioJengibre
  118 → marca.minis.precio Y paqueteSeis.precio (muerto, se borra)

Si sube las barras a 130 desde el anaquel, la pestaña «Para negocios»
le sigue diciendo «desde $108» a las cafeterías, que son exactamente el
público de ese panel. Nada avisa.

`src/contenido/derivados.ts` los CALCULA en la fachada:
  tabs[2].precio      = min(sabores[].precio)
  tabs[1].precio      = min(gotas[].precio)
  gotas.precioDesde   = min(gotas[].precio)
  gotas.precioJengibre= gotas.find(jengibre).precio

Salen del JSON. En el panel se dibujan en gris con la nota «sale del
precio más bajo de las barras», `control: 'derivado'`. Es la misma
solución que la regla `cuenta` para el «15», aplicada a lo que además
es plata.

Y en la bandeja de publicar, un chequeo de sentido común:
«el paquete de seis quedó más barato que seis barras sueltas»,
«el precio pasó de $122 a $1,300 — ¿seguro?» (un cero de más es un
número perfectamente válido y ninguna regla lo ataja).

─── 1.5 · vocabulario.ts, en dos listas ───

El filtro nació de test/sitio.test.ts:114-116, que es un guard
anti-maqueta del SITIO. Si el panel compartiera la lista entera, el
panel tendría prohibida la palabra «Borrador», que necesita para su
concepto central.

  MARCA (aplica al copy Y a los mensajes del panel):
    mono, chango, changuito, chispa(s), carrito, pistachos, cacahuete,
    maní, packaging, snack, smoothie
  MAQUETA (solo al sitio publicado):
    Borrador, PENDIENTE, te avisamos, Lorem

─── 1.6 · El espacio duro, como regla, no como control ───

[MEDIDO] Hay 9 apariciones de ` ` en 8 campos:
anaquel.pesoInsignia · gotas.titulo · polvoCard.titulo ·
negocios.tabs[0].titulo (dos) · tabs[1].titulo · tabs[2].titulo ·
footer.productos[0].texto · footer.productos[1].texto

SOLO UNO (pesoInsignia) es «cifra + unidad» y lo cubre el constructor
`medida`. Los otros SIETE son texto libre con la cifra adentro
('Chocolate en polvo · 250 g y 1 kg'). Si la clienta retoca ese título
en un input de texto plano, los espacios duros se vuelven normales, y
en el celular la «g» o el «kg» quedan solos en el renglón siguiente.

Regla de esquema en los campos marcados: un `/\d\s(g|kg|ml|l|°C)\b/`
con espacio NORMAL es gravedad 'impide', con el arreglo ofrecido con un
botón: «poner el espacio que no parte». La clienta nunca se entera de
que el espacio duro existe, que es lo correcto.

─── 1.7 · Campos que son atributo ───

`data-campo` en un nodo y `el.textContent = borrador` no alcanzan para:
hero.marquesinaAria, nav.etiqueta, anaquel.grupoAria,
anaquel.envolturaAltPrefijo, anaquel.ilustracionAltPrefijo,
polvo.altPrefijo, contacto.correo (en `data-copiar`, index.astro:674),
marca.titulo y marca.descripcion (viven en el `<head>`), y el JSON-LD.

Solución: `enAtributo` en el metadato + un segundo atributo acotado en
el HTML, `data-campo-attr="alt:anaquel.ilustracionAltPrefijo"`. Estos
campos tienen `falla: ['ninguno']`: no se miden, y el panel NO dice «no
pude revisar» sobre ellos — muestra vista previa textual y listo. Van
en el NIVEL 3 (plegados dentro del bloque de su foto), con «La leen las
personas ciegas y Google».

─── 1.8 · Las fachadas ───

  src/copy/sitio-marca.ts   441 → ~16 líneas. Exporta `marca`, `precioMXN`.
  src/copy/sabores.ts       101 → ~14. Exporta Sabor, sabores, gotas,
                            polvo, urlCatalogoBarras. (paqueteSeis se borra.)
  src/fichas/base.ts        404 → 6. Exporta fichasBase: Ficha[].

Verificado expresión por expresión contra el index.astro real:

  · `titular[1].replace(...)` → `tupla` de 3.
  · [MEDIDO] `{'chipPolvo' in r && ...}` (index.astro:446) es un chequeo
    de EXISTENCIA de clave. En zod 4.4.3, `z.string().optional()` sobre
    `{chipPolvo: ''}` devuelve el objeto CON la clave. Si la clienta
    borra el texto del chip y el panel guarda `''`, se renderiza
    `<p class="mono receta-chip"></p>`: una cajita amarilla vacía de
    6×10 px con 12 px de margen (index.astro:1434). Y como las 4
    tarjetas se estiran a la más alta, crecen las cuatro.
    DOS ARREGLOS, los dos: la fachada pasa a `r.chipPolvo` (truthy), y
    el panel BORRA LA CLAVE al vaciar un campo opcional, nunca escribe ''.
  · `t.precio === null ? …` (index.astro:536) → `t.precio == null`,
    robusto a las dos representaciones.
  · `colorSabor[s.clave]` con `keyof typeof sabor` → `clave` se conserva
    en la fase 1 (§10) y muere en la fase 7.
  · `puestoTitulo.join(' ')` → tupla de 2.
  · [MEDIDO] el correo del pie se renderiza partido:
    `{correoUsuario}@<wbr />{correoDominio}` (index.astro:748). Ese nodo
    lleva `data-campo` pero con `falla:['ninguno']` y parche especial:
    el script del iframe reconstruye las dos mitades.


═══════════════════════════════════════════════════════════
2 · LA VALIDACIÓN: UNA VERDAD, CUATRO CONSUMIDORES
═══════════════════════════════════════════════════════════

  export interface Problema {
    campo: string           // 'sabores.3.nombre' → el panel sabe adónde ir
    gravedad: 'impide' | 'avisa'
    titulo: string          // lo que lee la clienta, sin jerga
    detalle?: string
    arreglo?: { etiqueta: string; valor: unknown }  // el botón de un toque
  }
  export function validar(doc: IdDocumento, crudo: unknown): Problema[]

Los cuatro importan el MISMO archivo:
  1. El navegador, mientras escribe (import directo en la isla React).
  2. `api/panel.ts`, antes de tocar GitHub — revalida TODO desde cero.
  3. `vitest`: `expect(validar('sitio', datos)).toEqual([])`.
  4. `astro build`, porque `cargar()` está en el camino del import.

`test/contenido-mutaciones.test.ts` toma ~25 contenidos malos conocidos
—titular de 12 letras, insignia de 90, «chispas», un `$108` adentro de
un texto, un campo vacío, un precio como string, ingredientes
reescritos, un `</script`, un '250 g' con espacio normal, `chipPolvo: ''`—
y exige que `validar()` cachee cada uno.

Y CORRIENDO LA CADENA ENTERA, no solo validar(): la mutación «cambiar
el precio a 115» tiene que pasar `validar()` Y `pnpm build` completo.
Es la única forma de atrapar sitio.test.ts:77.


═══════════════════════════════════════════════════════════
3 · EL MEDIDOR (src/anti-desborde/) — GEOMETRÍA REAL
═══════════════════════════════════════════════════════════

No se declara ni un píxel a mano. El ancho disponible se lee del render
en el momento de medir. Si Marcos cambia un padding, el motor se entera
solo.

─── 3.1 · Un atributo, mapeo UNO-A-MUCHOS ───

[MEDIDO] contra dist/index.html, sobre las 321 hojas string de `marca`:
  · 171 aparecen exactamente una vez
  · 118 aparecen 2+ veces
  · 32 no aparecen nunca (viven en 404.astro, fichas-tecnicas.astro, el
    bloque catalogoBarras que se borra, o son campos muertos)

Los casos duros, con su causa:
  anaquel.pesoInsignia ×17, ingredientesEtiqueta ×17, manoInsignia ×15,
  cta ×15, remate ×15, fichaEtiqueta ×15, contadorDe ×15
      → index.astro:301 renderiza las QUINCE fichas en build (decisión
        de SEO del 2026-08-19: nombre, precio e ingredientes indexables).
  footer.lema ×6
      → index.astro:707-708 lo pone dos veces Y Marquesina.astro duplica
        el `<slot>` entero para el loop, más el `aria-label`.
  marca.wordmark ×3 (cabecera, portada, pie) + 404.astro.
  nav.items[].texto ×2 (overlay de 988 px + columna del pie de 173 px).
  hero.titular.1 ×0
      → index.astro:145 le saca la coma antes de pintarla.

Entonces:
  · `data-campo` PUEDE REPETIRSE. `inyecta.ts` hace `querySelectorAll` y
    parchea TODOS los nodos.
  · El medidor mide TODOS los nodos de un campo y se queda con el PEOR.
  · El test de biyección es, en los dos sentidos:
      (a) todo campo con `quien:'cliente'` y control ≠ 'oculto' tiene
          AL MENOS un `[data-campo]` o un `[data-campo-attr]` en ALGUNA
          de las 4 páginas que consumen copy (home, 404, fichas-técnicas,
          y las 4 páginas por ficha);
      (b) todo `data-campo` del HTML existe en el esquema.
    Nunca «exactamente uno». Esa versión no puede pasar.

─── 3.2 · Fase 2 es un cambio de markup, y se trata como tal ───

Muchos campos NO tienen elemento propio hoy. Verificados:
  :315  `{marca.anaquel.ingredientesEtiqueta}: {d.ingredientes}.`
  :340  `{marca.minis.titulo} · {precioMXN(marca.minis.precio)}`
  :360  `{marca.gotas.notaPrecio}: {precioMXN(...)}`
  :536  `{t.precio === null ? t.precioNota : ...}`
  :415  `<p><b>{paso.nombre}.</b> {paso.texto}</p>`
  :143-147  los tres renglones del `<h1>`, nodos de texto entre `<br>`
  :215  `<li><span>✓</span>{item}</li>`

Poner `data-campo` obliga a inventar `<span>`s. Eso CAMBIA el HTML
renderizado, no solo sus atributos. Así que:
  · La verificación de la fase 2 NO es «auditar el diff a ojo». Es un
    diff NORMALIZADO: se parsea el HTML antes y después, se borran los
    `data-campo*` y se desenvuelven los `<span data-campo>` que no
    tienen otro atributo; el resto tiene que ser idéntico byte a byte.
  · La línea base geométrica del CI se toma DESPUÉS de la fase 2, nunca
    antes: sobre un DOM que ya no existe no se mide nada.

`Insignia.astro` y `EtiquetaSabor.astro` reciben una prop `campo`
porque el nodo a marcar vive adentro de ellos.

─── 3.3 · El medidor isomorfo ───

`medidor.ts` no importa nada de Astro ni de Node. Se compila a un
script clásico que se inyecta tal cual en el iframe del panel y en
`Runtime.evaluate` de CDP. DOS CONSUMIDORES, UNA IMPLEMENTACIÓN: el
panel y el bloque B de tests.

`prepararDocumento()` hace SEIS cosas:

  1. Revela lo que marca.ts esconde, PERO DE A UNA.
     [MEDIDO, y es el hallazgo más importante de esta revisión]
     `.ficha-fila` es `display:flex; flex-wrap:wrap` y `.ficha-datos` es
     `flex: 1 1 300px; min-width: 0`. Medí `.chips` en Chrome a 1440 px
     sobre dist/:
        con UNA ficha visible (producción):  407 px — LOS QUINCE IGUAL
        con las 15 reveladas:                331 / 444 / 633 px
     O sea que revelar todas de una da un error de −76 a +226 px sobre
     la única invariante que el medidor bloquea duro. Falso positivo Y
     falso negativo en el mismo gate.
     El método correcto es: para cada ficha, dejar 14 ocultas y una
     visible, medir, seguir. Son 15 pasadas de un `hidden=` y un
     `getBoundingClientRect()`: milisegundos.
     Y el bonus que salió de medir: como los 15 dan EXACTAMENTE 407 px,
     el medidor mide UNA ficha y el resultado vale para las quince.
  2. Abre los `<details>` (8 preguntas, 4 recetas).
  3. Frena las marquesinas.
  4. Apaga las transiciones (la banda tarda 0.45 s en cambiar de color).
  5. `transform: none !important` en todo, y `.visto` a todo
     `[data-revelar]`.
     [MEDIDO] Hay transforms en slots apretados: `.sello-pronto` va con
     `rotate(-4deg)` (index.astro:1303) y la marquesina del hero con
     `rotate(-3deg)`. `getBoundingClientRect()` devuelve el rect DESPUÉS
     del transform, o sea la caja axis-aligned, más ancha que la real:
     el chip PRÓXIMAMENTE se marcaría desbordado con un texto que entra
     perfecto. Y `html.js [data-revelar]` va con `translateY(18px)`
     hasta que el IntersectionObserver de marca.ts:446 dispara, cosa que
     dentro de un iframe corto puede no pasar nunca.
  6. Espera `document.fonts.ready` + dos rAF Y verifica
     `fonts.check('700 48px "Bricolage Grotesque"')` y Trocchi. Si
     falla, TIRA. Nunca se emite un reporte medido con la cara de
     respaldo (`size-adjust: 98.47%`, ~2 % de diferencia).

Primitivas: `anchoInterior` (clientWidth menos padding), `minContent`
(clona el nodo dentro de su propio padre con `width:min-content`),
`renglones` (`Range.getClientRects()` agrupado por top — respeta
`text-wrap: balance`), `desborde` (0.5 px de tolerancia).

─── 3.4 · El veredicto es DIFERENCIAL, y no hay archivo congelado ───

El veredicto es contra la MISMA medición hecha con el contenido
publicado. Sin línea base, un detector genérico da ~25 hallazgos sobre
la home tal como está hoy y hay que mantener una allowlist que se pudre.

  EN EL PANEL: el «antes» es el sitio en vivo, en el mismo iframe, con
  el borrador sin aplicar. Impecable, y siempre fresco.

  EN CI: el «antes» es el HEAD anterior. El workflow construye DOS
  veces (HEAD y HEAD~1, ~1 s de build cada uno [MEDIDO: `astro build`
  completa en 983 ms]) y compara entre sí. NO hay archivo congelado que
  desactualizar, así que no hay correo rojo por cada publicación
  legítima de la clienta, y no hay «guard de frescura» que hashee lo
  que no debe.

  SE ELIMINAN: `medidas.generated.json`, `holguras.generated.json`,
  `test/instantaneas/anti-desborde.json`, `src/panel/medidas.ts`,
  `scripts/mide-slots.ts`, el guard de frescura y `servidor.ts`
  (`astro preview` ya existe y ya está en package.json).
  Con el archivo se va su bug: el hash proponía cubrir marca.css y los
  woff2, pero `inlineStylesheets: 'always'` + Tailwind v4 hacen que el
  CSS compilado dependa del CONTENIDO de las plantillas, y la lista
  omitía global.css (el preflight de Tailwind: box-sizing, márgenes,
  line-height — la base de toda medición), el `<style is:global>` de
  Base.astro y 2 de los 6 componentes con `<style>`.

Bonus que confirma el método: el lema del pie. El tramo mide ~1059 px
contra 1440 → el hueco YA EXISTE con el lema publicado. Un mínimo
absoluto estaría fallando sobre contenido de producción desde el día
uno. El diferencial dice la verdad y no bloquea.

QUÉ BLOQUEA Y QUÉ AVISA:
  BLOQUEA  nowrap (una insignia sola más ancha que su caja)
           fila-sin-corte (Σ min-content de las pestañas > la caja)
           renglones del hero (los 3 son exactos)
           scroll horizontal de página (contra clientWidth, no
           innerWidth: `scrollbar-gutter: stable` mete 15 px)
  AVISA    alto-caja (el ticket cosido se deforma)
           cinta-minima (el hueco de la marquesina del pie)
           renglones de receta (las 4 tarjetas se estiran a la más alta)
  NO PUDO MEDIR → NUNCA una frase genérica. Dice QUÉ campo no se pudo
           revisar, con un botón que lleva ahí con el resaltado puesto,
           y deja publicar todo lo demás. Una advertencia que no se
           puede accionar es peor que no advertir.

CUANDO BLOQUEA, HAY SALIDA. El bloqueo termina en una acción de ella,
no en una pared:
  · el iframe muestra el desborde, señalado;
  · botón «Pedirle a Marcos que entre este texto», que le manda a
    Marcos el campo, el texto propuesto, la captura y las medidas.
Esto es lo que separa «soy dueña de mi sitio» de «la computadora no me
deja».

─── 3.5 · Lo único que queda de Chrome ───

`chrome.ts` (cliente CDP mínimo sobre el WebSocket nativo de Node 22) +
`scripts/mide.ts`, usados por el bloque B de tests, que corre en la
máquina de Marcos y en `ubuntu-latest`. Nunca en Vercel.


═══════════════════════════════════════════════════════════
4 · PUBLICACIÓN (api/panel.ts + src/servidor/)
═══════════════════════════════════════════════════════════

UNA sola función serverless nueva. Acción por query string:
`/api/panel?accion=publicar`.

  src/servidor/
    origen.ts            LA lista de orígenes — también la usa api/contacto.ts
    sesion.ts            contraseña + enlace mágico + cookie firmada
    github.ts            cliente REST mínimo
    publicar.ts          Git Data API: blobs → tree → commit → PATCH ref
    revertir.ts          la vuelta atrás automática (§4.6)
    borrador.ts          refs/panel/borrador
    historial.ts         commits + diff campo por campo
    estado.ts            API de Vercel + /version.json
    correo.ts            Resend
    rutas-permitidas.ts  la lista blanca de escritura
    acciones.ts          el router

vercel.json:
  "functions": {
    "api/panel.ts": { "maxDuration": 60,
                      "includeFiles": "src/servidor/**,src/contenido/**,src/tokens/**" }
  }

[MEDIDO] `maxDuration` no está hoy y una función Node de Vercel arranca
con 10 s. Hobby llega a 60 s.

RIESGO DE TRACING, con su plan B escrito al lado: `includeFiles` copia
archivos al bundle pero NO hace que un import TypeScript de fuera de
/api resuelva. Si `@vercel/nft` no traza `../src/servidor/...`,
includeFiles no cambia nada. Plan B: `scripts/bundle-api.ts` con esbuild
produce `api/panel.js` autocontenido en un paso de build. Se decide con
el experimento más barato del proyecto: en la fase 5, PRIMERO
`api/contacto.ts` importando `../src/servidor/origen`. Un cambio de una
línea que responde la pregunta antes de que dependa nada.

─── 4.1 · Acceso: contraseña primero, enlace mágico de recuperación ───

Esto se invierte respecto del diseño anterior, por dos razones que se
suman:

  (a) [MEDIDO] api/contacto.ts:99 cae a `Maracacao <onboarding@resend.dev>`
      cuando CONTACTO_REMITENTE no está cargada, y con el dominio de
      prueba Resend solo entrega al correo del dueño de la cuenta.
      Verificar maracacao.mx en Resend es SPF+DKIM en el DNS: hacen
      falta las credenciales del registrador y días de propagación.
      Es un trámite, no una tarea de código.
  (b) Aunque llegue, llega a maracacaomx@gmail.com — la misma casilla
      donde caen los pedidos. En un día de mercado el enlace se pierde
      entre correos y los 15 minutos se los come un cliente.

PUERTA PRINCIPAL: una contraseña larga, en un
`<input type="password" autocomplete="current-password">` para que el
llavero de iOS la guarde sola. Se verifica en la función contra un
hash scrypt en `PANEL_CLAVE_HASH`, con comparación de tiempo constante
y un tope de 5 intentos por IP cada 15 minutos. Cookie de sesión de
UN AÑO en el dispositivo que ella marca como «mi celular», 30 días en
los demás.

PUERTA DE RECUPERACIÓN: el enlace mágico de 15 minutos firmado con HMAC
(`PANEL_SECRETO`). El correo apunta a `/panel/entrar?t=…`, HTML estático
con un BOTÓN que hace POST — porque Gmail, Outlook y los antivirus
abren los enlaces para escanearlos y un GET consumiría la sesión en el
datacenter de Google. La página hace `history.replaceState` y
vercel.json le pone `Referrer-Policy: no-referrer`. El propósito va
DENTRO del HMAC (`'entrar'` vs `'sesion'`).

La lista blanca `PANEL_CORREOS` se relee EN CADA PEDIDO. Marcos va en
ella desde el día uno: es el break-glass.

EXPLÍCITO EN EL CÓDIGO, con comentario arriba de la página: el panel NO
usa el `candado` de Base.astro, que compara un SHA-256 en el navegador
y cuyo propio código dice que es «una tranca, NO seguridad real».

VIGILANCIA DEL PAT: `GET /api/panel?accion=salud` chequea la fecha de
expiración del token y avisa por correo con 30 días de anticipación. El
modo de falla sin esto es «la clienta publica y recibe un 401
incomprensible».

─── 4.2 · Escritura: un commit atómico ───

PAT fine-grained sobre `maracacao`: Contents RW + Metadata R, SIN
Workflows (GitHub rechaza por sí solo cualquier push que toque
`.github/workflows/**`, así que el panel es incapaz de desarmar su
propia compuerta), solo en el entorno Production.

Una publicación = UN commit: blobs → tree (`base_tree`) → commit →
`PATCH refs/heads/main` con `force: false`. Nunca `force: true`.
Si falla por no ser fast-forward, se reintenta UNA vez comparando qué
cambió en el medio; si tocó rutas de contenido, 409 con «Marcos cambió
algo del sitio mientras editabas».

PRESUPUESTO DE ROUND-TRIPS. Las imágenes YA subieron al ref de borrador
una por una mientras ella las elegía, y el árbol de main reusa esos
blob sha: publicar son 4 JSON + el árbol + el commit + el ref ≈ 7
llamadas, no 43. Los blobs que sí haya que crear van en paralelo con
concurrencia 4.

Lista blanca de escritura (defensa en profundidad):
  /^src\/contenido\/datos\/[a-z0-9-]+\.json$/
  /^public\/sitio\/(marca|envoltura)\/[a-z0-9-]+\.webp$/
  /^public\/sitio\/etiqueta-[a-z0-9-]+\.webp$/
  TOPE_ARCHIVOS 40 · TOPE_CUERPO 3.5 MB (por debajo del tope de 4.5 MB
  de cuerpo de request de Vercel, y contando que la API de blobs exige
  base64: 3.5 MB de binario son ~4.7 MB de cuerpo, así que el tope real
  se aplica sobre el CUERPO, no sobre el binario).

Autor del commit: `Panel Maracacao <panel@maracacao.mx>`, trailers
`Panel: sí` y `Panel-Autor: <correo>`. El historial dice QUIÉN publicó
con nombre, no «Vos» — el día que la hermana también tenga acceso, las
dos serían «Vos». El asunto del commit ES el resumen que la clienta ve,
y sale de `src/contenido/diff.ts`, la misma función que pinta la
bandeja y el historial.

─── 4.3 · Borrador de dos capas ───

  Capa 1 — IndexedDB, cada tecla. Instantáneo. (IndexedDB y no
    localStorage: el borrador puede tener imágenes y localStorage se
    muere en Safari privado a los 5 MB.) localStorage queda solo para
    el id de dispositivo y la preferencia de ancho.
  Capa 2 — `refs/panel/borrador`, un ref FUERA de refs/heads/ que
    Vercel directamente no mira. Esto elimina de raíz la pregunta
    abierta sobre Branch Tracking: no hay nada que verificar en el
    panel de Vercel y no se ensucia la lista de ramas.
    Debounce 10 s con piso duro de 30 s.

CONFLICTO DE BORRADOR, que antes no tenía nada (había bloqueo optimista
para publicar y CERO para el borrador, que es donde ella vive el 90% del
tiempo). El borrador lleva `dispositivo` y `hora`. Al abrir, si el del
servidor es más nuevo que el local, se pregunta cuál abrir con los dos
resúmenes en español:
  «celular, ayer 11:04, 3 cambios»  /  «esta compu, hace 6 días, 1 cambio»
Y si hay dos personas: «tu hermana está editando desde hace 10 minutos».

Imágenes: se suben apenas se eligen a `pendientes/<hash>.webp` en el
ref de borrador; el borrador guarda su blob sha; al publicar, el árbol
de main reusa ese sha. Cero re-subida.

─── 4.4 · La compuerta: cuatro capas ───

  1. Mientras escribe: `validar()` en el navegador + el medidor en vivo.
  2. EN LA FUNCIÓN, antes de tocar GitHub: revalidación completa +
     lista blanca de rutas + cabeceras WebP. Si falla: 422, CERO
     commits, borrador intacto, mensaje en español con [Ir al campo].
     Es la única capa que le habla a la clienta a tiempo.
  3. `pnpm build` de Vercel = `astro build && vitest run && astro check`
     [MEDIDO: ~1 s de build + 2.6 s de tests + ~5.6 s de typecheck ≈ 9 s
     por deploy]. Si falla, Vercel deja servido el último deploy bueno.
  4. `.github/workflows/verifica.yml` en push a main: tests, typecheck y
     el bloque de anti-desborde con Chrome (HEAD vs HEAD~1). Juez
     posterior que le avisa a Marcos por correo, no compuerta.

NO se activan required status checks sobre main: rechazarían el push
del panel y la clienta vería un error incomprensible.

─── 4.5 · Feedback: version.json manda, y la API de Vercel es OBLIGATORIA ───

`src/pages/version.json.ts` (estático, prerenderizado) emite
`{ sha: process.env.VERCEL_GIT_COMMIT_SHA, construido }` con
`Cache-Control: no-store`. La API de Vercel dice que el deploy TERMINÓ;
version.json dice que el CDN YA ESTÁ SIRVIENDO ESE COMMIT. El «Listo»
exige las dos.

`PANEL_VERCEL_TOKEN` pasa a OBLIGATORIO: sin él no se habilita el botón
Publicar. Publicar a ciegas es peor que no publicar — ella cree que
publicó, vende a $130, y el cliente le muestra el celular con $108. Y
además el token es lo que hace posible §4.6.

El polling lo dicta el servidor (3 s el primer minuto, 6 s después,
tope 5 minutos) y NUNCA gira infinito.

AVISO FUERA DEL PANEL: cuando termina (bien o mal), correo. «Tu cambio
de las 11:04 ya está en el sitio» / «No salió; lo dejé como estaba y ya
le avisé a Marcos». Porque ella va a guardar el teléfono y atender tres
clientes — nadie mira un reloj tres minutos parada en un mercado. Y lo
primero que ve al reabrir el panel es el resultado de su última
publicación, no un tablero limpio.

Y un botón «Ver mi sitio» que abre la home con un parámetro que saltea
el caché, como última cosa al terminar. Ella va a ir a mirar el sitio
de verdad, y si le sale el precio viejo por caché, es pánico y llamada.

─── 4.6 · Vuelta atrás: automática si el build falla, a mano si se arrepiente ───

AUTOMÁTICA. Si el deploy del commit de la clienta falla, la función
—que ya está sondeando— arma un commit de reversión (mismo camino,
misma validación, apuntando a los blobs anteriores), lo publica, y le
dice: «No pude publicar esto: el sitio no lo aceptó. Lo dejé como estaba
y ya le avisé a Marcos». A Marcos le llega el log del build por correo.

Sin esto, el commit malo queda en main, el próximo publish también falla
—ahora sin que ella haya cambiado nada— y termina en el WhatsApp que el
panel viene a matar. Con el hallazgo de sitio.test.ts:77 ($108
congelado), el escenario no es hipotético.

A MANO. Durante 30 minutos después de publicar, en la MISMA pantalla del
estado, un botón grande «Deshacer esta publicación». Un `1300` en vez de
`130` es un número perfectamente válido, se ve a los veinte segundos, y
hay que poder volver con una mano, parada. El historial completo sigue
existiendo, pero no es el camino del arrepentimiento inmediato.

Volver a una versión vieja arma un commit NUEVO con los BLOBS VIEJOS
(cero subidas, funciona igual para las imágenes) y pasa por la misma
validación. Si el contenido viejo ya no pasa las reglas de hoy, el panel
lo dice y ofrece abrirlo como borrador.


═══════════════════════════════════════════════════════════
5 · EL PANEL (src/pages/panel/ + src/panel/)
═══════════════════════════════════════════════════════════

`/panel` NO es un tablero de bienvenida: es la home de maracacao.mx,
editable. Una isla React (`client:only="react"`; @astrojs/react ya está
instalado por MascotaRive.tsx) sobre una cáscara estática.

─── 5.1 · La vista previa: UN SOLO IFRAME ───

El panel hace `fetch('/index.html')`, le inserta un `<base>` y el
script del editor, y lo escribe al iframe. Mismo origen, DOM accesible,
producción sin ensuciar, cero necesidad de SSR.

UN iframe, no tres. [MEDIDO] dist/index.html = 209 KB, 88 `<img>`,
public/vendor/model-viewer.min.js = 935 KB, barra.glb = 266 KB. Tres
copias son ~2.8 MB de JS a parsear, 3 GLB, 3 islas de Rive y ~264
imágenes; las 30 minis de la marquesina son 380×815 → ~1.2 MB de bitmap
decodificado cada una. Safari en iOS mata la pestaña bastante antes de
eso, y §5.5 declara el celular el PRIMER dispositivo.

Medir en serie redimensionando el mismo iframe da EXACTAMENTE los
mismos números. Y mientras escribe se mide solo 320 (el peor caso, el
que le importa); los otros dos anchos se miden al apretar Publicar, que
igual hace la revisión completa.

`src/panel/preview/inyecta.ts` hace las dos cosas con UN script:
resalta slots, aplica texto en vivo (`querySelectorAll` + patch de
todos los nodos del campo) y expone `medir()` importando
`src/anti-desborde/medidor.ts`.

Al apretar Publicar: revisión COMPLETA, todos los slots, los tres
anchos, con todo el borrador aplicado. Imprescindible porque los slots
interactúan: las 3 insignias comparten `.chips`, los 4 títulos de receta
se estiran a la más alta, los 3 paneles de negocios saltan al conmutar.

LÍMITE HONESTO: el parche en vivo no muestra cambios ESTRUCTURALES (un
sabor 16, una 5.ª receta). Para eso, el panel CLONA en el iframe la
tarjeta de un ítem existente con la foto y el color nuevos, y lo dice:
«así se va a ver, aproximado». Iterar en segundos, no en dos minutos de
deploy de preview. El preview real queda como botón opcional para el
final.

─── 5.2 · Arquitectura de información ───

  LA PÁGINA ......... las secciones EN ORDEN DE SCROLL — la lista se
                      DERIVA del propio HTML (`main > section[id]` y sus
                      `h2`), no se escribe a mano. [MEDIDO] la home tiene
                      10 secciones más el pie; una lista escrita a mano
                      que diga 12 deja de ser un mapa y pasa a ser otra
                      lista que hay que aprender.
  LOS PRODUCTOS ..... rejilla de tarjetas con la foto y el precio grande
  LAS FICHAS ........ los 4 documentos
  DATOS DEL NEGOCIO . correo, dirección, redes, catálogo, cómo te ve Google

Más PUBLICAR (con contador) e HISTORIAL al pie.

DOS caminos a un campo, no tres: señalarlo en la vista previa (el
principal) y el índice de secciones (el respaldo). La búsqueda por
contenido deja de ser un tercer camino y pasa a ser un FILTRO adentro
del índice — cuando quiere cambiar «el texto ese de abajo de la foto»
es justamente porque no se acuerda de qué dice.

Las miniaturas de sección se recortan del iframe VIVO, que ya está
cargado. No hay `scripts/genera-miniaturas.ts` ni Chromium.

─── 5.3 · La ficha de un campo ───

Miniatura viva (recorte del iframe centrado en el slot, con anillo) ·
nombre en cristiano · la oración de «dónde vive» IMPRESA, nunca en
tooltip (en celular no hay hover) · la caja · la regla · el estado ·
«Volver a como estaba».

Controles por tipo, cada uno matando una clase de bug de raíz:

  PRECIO    input numérico con el «$» dibujado AFUERA de la caja. Es
            imposible escribir «$». Muere la clase de bug que hoy rompe
            tres tests.
  MEDIDA    número + unidad de un desplegable cerrado. El panel arma
            «70 g» con el espacio duro.
  PUNTUACIÓN donde la plantilla agrega el ':' o el '.', se dibuja
            AFUERA, en gris, no editable. Muere el «::».
  DERIVADO  gris, no editable, con la nota de dónde sale (§1.4).
  INSIGNIA  sin estado ámbar: en nowrap hay «entra» o «se sale», y el
            desborde se ilustra con el propio iframe.
  TITULAR   tres cajas; el renglón 2 con la regla de la coma única.
  REGULADO  candado + comparación viva contra el arte impreso. Verde =
            igual, tachado = acortado (se puede), ROJO = no está en la
            envoltura. Con la salida de §8.3 para cuando el arte cambia.

─── 5.4 · Qué se oculta: NO HAY MODO AVANZADO ───

Un cajón «avanzado» es una invitación. El día que se abra por
curiosidad, alguien va a cambiar `'negocio'` por `'Negocio'` en
`formulario.tipoOpciones[].valor` y el ruteo del formulario se rompe en
silencio, porque lo comparan crudo marca.ts:364 y api/contacto.ts:61.

  NIVEL 1 · AUSENTES (`quien:'marcos'` + `control:'oculto'`): anclas,
    rutas, claves de token, ids, slugs, nombres de archivo, valores de
    protocolo, el honeypot, los textos de sistema.
  NIVEL 2 · SE VE UNA VEZ, COMO CONSECUENCIA: el slug, en el alta de un
    sabor — «Las fotos se van a llamar guayaba-con-chile. Esto ya no se
    puede cambiar después.»
  NIVEL 3 · PLEGADOS: los alt y aria (§1.7), dentro del bloque de su
    foto, con «La leen las personas ciegas y Google».

─── 5.5 · Celular, en serio ───

Es el PRIMER dispositivo para cambiar un precio, corregir un dedazo y
subir una foto recién tomada.

SEÑALAR CON EL DEDO. A 375 px de ancho no se puede acertar un texto de
12 px. Tocar y MANTENER sobre la vista previa abre una lista de los 3 o
4 campos más cercanos al dedo, cada uno con su texto y su nombre. No
hay que acertar el píxel, y de paso le enseña cómo se llaman las cosas.

TECLADO ABIERTO. Con el teclado quedan ~200 px de alto. La ficha se
colapsa sola a DOS cosas: la caja donde escribe y la miniatura del
pedacito del sitio que está tocando, con la regla como una línea de
color de 4 px. Todo lo demás se pliega y vuelve al cerrar el teclado.
Sin esto escribe a ciegas y pierde las dos cosas que hacen al panel
mejor que un WhatsApp.

Barra fija abajo con «4 cambios sin publicar → Publicar». Objetivos
táctiles ≥44 px. Las 4 fichas técnicas son SOLO LECTURA en celular y se
dice con todas las letras.

SIN SERVICE WORKER, y se dice con todas las letras: «el panel necesita
internet». El borrador en IndexedDB protege contra perder trabajo a
mitad de una sesión, que es el riesgo real. Registrar un service worker
desde /panel en el mismo origen que el sitio de producción es un
footgun de alcance que puede dejar HTML viejo a los visitantes reales.

─── 5.6 · Identidad visual ───

Papel crema #F8ECDE, tinta #4C2C16 (contraste 10.75, AAA). Bricolage
para interfaz, Courier Prime para rótulos en versales, Trocchi SOLO en
la vista previa y en la ayuda. Base 15 px, rejilla de 8.

[MEDIDO con el contrastRatio del repo] el rojo de marca #CB3C41 sobre
crema da 4.23 y FALLA AA para texto normal. Texto de error →
`rojoHondo` #7D0303 (9.57). El botón Publicar va sólido tinta con letra
crema, no rojo: publicar no es una alarma.

Sin modo oscuro. Se usa de día, en un mercado.

─── 5.7 · Las 327 oraciones de ayuda ───

No se escriben las 327 a mano antes de saber cuáles se leen. La
miniatura viva explica más que cualquier oración. Se escriben las ~60
que no son obvias; el resto arranca con un texto generado del metadato
(«Sale en la sección Anaquel, arriba del precio»), y en el ensayo con
la clienta (§fase 6) se anota cuáles pregunta. Eso corrige el «40% del
trabajo del panel» a algo proporcional.


═══════════════════════════════════════════════════════════
6 · FOTOS DE PRODUCTO
═══════════════════════════════════════════════════════════

TODO SE PROCESA EN EL NAVEGADOR y viaja en el MISMO commit que el
texto. Lo que decide es la atomicidad: si la imagen llega por otro
camino, existe un estado donde el HTML nombra una imagen que no está, y
ese estado lo ve el visitante. Además el cuerpo de una función de
Vercel topa en 4.5 MB y una foto de iPhone son 3-8 MB.

`src/imagenes/especies.ts` es la especificación única:

  barra grande   754×1617   sin alfa   ≤65 KB
  barra mini     380×815    sin alfa   ≤32 KB
  barra mini-300 300×643    sin alfa   ≤22 KB
  ilustración    ancho 400  CON alfa   ≤150 KB
  pliego 3D      2048×1765  sin alfa   ≤110 KB   ← Marcos
  etiqueta polvo 468×900    sin alfa   ≤55 KB

EL PRESUPUESTO SE DESATA DE LA POSICIÓN. [MEDIDO]
`barra-cardamomo-mini.webp` pesa 29.9 KB y cardamomo es el 12; si la
clienta lo mueve al 3 porque se vende mejor, un tope de 28 KB «para las
4 primeras» tira el deploy por reordenar una lista. Un solo tope de
32 KB para todas las minis. El `fetchpriority="high"` de las 4 primeras
sigue por índice (es correcto: es sobre la posición en el DOM) pero
ningún test ata bytes a posición.

CAMINO DE ESCAPE, obligatorio. [MEDIDO] la barra más pesada de hoy son
63.6 KB contra un tope de 65, y `canvas.toBlob('image/webp', q)` no
tiene el `-m 6` de cwebp: a igual calidad sale 10-30% más pesado. Si la
búsqueda binaria de `quality` en [0.55, 0.92] no llega al presupuesto,
SE PUBLICA LA MEJOR QUE CONSIGUIÓ con un aviso a Marcos («esta foto
quedó en 41 KB, pasala por pnpm imagenes»). Rechazar la foto de la
clienta no es una respuesta.

`src/panel/foto/recorte.ts` — RECORTE RECTANGULAR + un slider de
ENDEREZAR. Nada más en el camino crítico. La homografía de 4 esquinas
con eliminación gaussiana, la lupa 3×, el aplanado de iluminación
portado de envoltura-a-packshot.py y el quitado de fondo de
quita-fondo.py quedan como AJUSTE FINO OPCIONAL en escritorio, si sobra
tiempo. Hacer que la única foto obligatoria pase por el subsistema más
complejo del proyecto, en un mostrador, entre dos clientes, es al revés.

CONTROL DE CALIDAD QUE SÍ IMPORTA: después del recorte, la barra nueva
se muestra METIDA EN LA REJILLA DEL ANAQUEL, junto a sus vecinas, a
escala real, con el aviso «esta quedó más ancha que las demás». Es la
única pantalla donde el problema se ve.

Opacidad POR CONSTRUCCIÓN: el canvas de salida se crea con
`{ alpha: false }` y se rellena con la mediana del borde (no blanco: si
el encuadre se pasa un pelo, el relleno es del color de la envoltura).

`src/imagenes/webp.ts`: lector de cabecera sin dependencias
(VP8/VP8L/VP8X → ancho, alto, alfa, ~40 líneas). Lo escribí y lo corrí
en este repo para la auditoría: funciona. Corre igual en el navegador,
en la función y en vitest. La función lo usa ANTES de commitear:
medida exacta, alfa correcta, bytes bajo presupuesto, o rechaza en
español sin commitear nada.

`src/imagenes/manifiesto.json` (generado): index.astro toma width/height
de ahí en vez de literales. [MEDIDO] hoy hace falta:
  · barra-limoncillo y barra-menta-intensa son 754×1566 (minis 380×789
    y 300×623) mientras index.astro declara 754/1617 y 380/815, y
    model-viewer fija `aspect-ratio: 754/1617`. Se estiran 3.26% y
    saltan al cargar.
  · las 15 ilustraciones declaran 400/450 y van de 400×400 a 400×705:
    cada cambio de sabor salta la tarjeta.
  · ilustracion-limoncillo pesa 145 KB y jengibre-y-naranja 134 KB.

DIAGNÓSTICO DE FOTO, en español y sin nombrar formatos: nunca «HEIC».
«Esta foto no la puedo usar; sacala de nuevo con el botón de cámara de
acá» — y ese botón de cámara está DENTRO del panel, que evita el
problema de raíz. El borrador se guarda ANTES de empezar a procesar
(iOS mata pestañas por memoria sin avisar) y hay barra de progreso con
pasos («enderezando», «achicando»), no un spinner.

`pnpm imagenes` (sharp, del lado de Marcos) re-deriva todo desde los
maestros.


═══════════════════════════════════════════════════════════
7 · FICHAS TÉCNICAS: EL PDF SOBREVIVE, PERO SE APAGA SOLO
═══════════════════════════════════════════════════════════

Dos críticos independientes objetaron matar el PDF, y el argumento
comercial es bueno: un comprador B2B (cafetería, distribuidor) pide la
ficha como archivo adjunto para su expediente de proveedor, y «Guardar
como PDF» desde el navegador del celular está escondido en
Compartir → Opciones → PDF. Eso no se le explica a un cliente por
WhatsApp.

Pero los dos problemas técnicos son reales y verificados:
  · [MEDIDO] `scripts/genera-fichas.ts:8` llama `/usr/bin/google-chrome`
    por ruta absoluta: solo corre en la máquina de Marcos. En cuanto la
    clienta publique sola, el PDF queda viejo — y lo que queda viejo son
    alérgenos y tabla nutrimental, información regulada.
  · [MEDIDO] los dos renderers YA NO COINCIDEN. `plantilla.ts:45,51`
    filtra pares de meta vacíos y secciones sin título;
    `fichas-tecnicas.astro` no filtra nada. Con un título vacío, el PDF
    muestra 7 secciones y la web 8, con la numeración posicional corrida
    distinta en cada uno.

Ninguna de las dos opciones que se propusieron sirve:
  · Regenerar en Actions y commitear a main: el panel también pushea a
    main; el commit de vuelta dispara un segundo deploy, hay que
    guardarlo con path filters para que no se autotrigueree, y dos
    publicaciones en un minuto se pisan. Es una máquina de estados
    entera para un PDF.
  · Matarlo: pierde el flujo B2B, y lo pierde de verdad.

LO QUE SE HACE:

  1. Se extrae `src/components/marca/DocumentoFicha.astro`: UN renderer,
     con los filtros de plantilla.ts adentro. Se va `fichaHtml()`.
  2. `src/pages/fichas-tecnicas/[ficha].astro` (getStaticPaths sobre
     fichasBase → 4 páginas), con CSS de impresión, membrete y pie.
  3. `pnpm fichas` sigue existiendo, del lado de Marcos, y además de
     los 4 PDF escribe `public/fichas/.sello.json`:
        { hash: sha256(datos/fichas.json), generado: '2026-09-08T…' }
     Se hashean los DATOS, no el PDF: Chrome le mete CreationDate y dos
     corridas del mismo contenido dan bytes distintos.
  4. La página de fichas compara ese hash contra el actual EN BUILD:
        vigente  → botón «Descargar PDF · carta · 1 página»
        vencido  → el botón desaparece y queda «Ver e imprimir», y en el
                   panel a Marcos le espera una tarjeta «las fichas
                   cambiaron, corré pnpm fichas».
     El build NUNCA falla por esto. Un PDF viejo es una posibilidad; un
     PDF viejo SERVIDO es imposible.
  5. En el panel, «Mandar la ficha por WhatsApp» con el mensaje ya
     armado y el enlace a la página imprimible.

Chrome queda en DOS lugares, los dos fuera de Vercel: `pnpm fichas` y
`pnpm mide` + el bloque B de tests.

`src/fichas/base.ts` usa los helpers `p()` y `li()` — llamadas a
función, que el panel no puede emitir. Pasa a `datos/fichas.json` con
bloques planos, modelados con `z.discriminatedUnion('tipo', …)`
[MEDIDO: `options` + `discriminator` en zod 4.4.3].

LAS TABLAS NUTRIMENTALES nunca se editan como texto libre. Cada valor
se parte en número + unidad de un desplegable cerrado, y la columna de
la izquierda (los nutrimentos de NOM-051) no se toca.
EXCEPCIÓN QUE HAY QUE MODELAR APARTE: [MEDIDO] la fila de energía es
`['Contenido energético', '600 kcal / 2,510 kJ']` — una celda compuesta,
con barra, dos unidades y separador de miles. Ninguno de los siete
controles la representa. Se modela como `{ kcal: number }`: el kJ se
calcula (kcal × 4.184, verificado contra las 4 fichas de hoy, ninguna
difiere más del 1%) y la plantilla arma el string con el separador del
locale. Un campo, un número, cero forma de romperlo.


═══════════════════════════════════════════════════════════
8 · ALTA Y BAJA DE ÍTEMS
═══════════════════════════════════════════════════════════

─── 8.1 · Sabor: 5 pasos ───

nombre (con el slug mostrado como consecuencia) → arte del frente (de
donde sale el color) → color → precio y catálogo → fotos.

Lo OBLIGATORIO para publicar es UNA cosa: la foto de la barra. La
ilustración y el pliego 3D quedan opcionales; el sabor sale al aire sin
visor 3D y sin ilustración, y Marcos los agrega después.

ESTO OBLIGA A TRES CAMBIOS QUE NADIE HABÍA LISTADO:
  · [MEDIDO] test/marca-copy.test.ts:118-127 exige CINCO archivos por
    sabor. Con la compuerta del build, el alta caería el deploy. Se
    reescribe: barra + mini + mini-300 siempre; ilustración y pliego
    solo si el registro los declara.
  · index.astro renderiza `ilustracion-${slug}.webp` incondicional: sin
    archivo queda una imagen rota con su alt. Pasa a condicional.
  · marca.ts, en el `aplica()` del visor 3D, va con try/catch: hoy un
    pliego faltante deja la barra 3D con la textura del sabor ANTERIOR
    — un sabor mostrando la envoltura de otro.

Cada pendiente es una tarjeta con qué falta, qué se ve mientras tanto,
y «Avisarle a Marcos» que arma el mensaje con las medidas exactas.

─── 8.2 · El «15» escrito nueve veces, resuelto en UN aviso ───

[MEDIDO] el «15» está en 9 lugares del copy: descripcion, ctaSabores,
marquesinaAria («quince», en letras), anaquel.kicker, anaquel.contadorDe,
negocios.tabs[2].cuerpo, y 3 en catalogoBarras (que se borra en la
fase 0, así que quedan SEIS). Más el `/15` literal de index.astro:247,
que se deriva en la fase 2.

La regla `cuenta:` los marca. Pero el panel NO da nueve avisos: da UNO.

    Ahora hay 16 sabores. Hay 6 textos que dicen 15.
    [Cambiarlos todos]  [Ver cuáles]

`numeroEnLetras()` sobrevive como una tabla de 1 a 20 dentro de
`conteos.ts` (~6 líneas), no como pieza de la arquitectura. No hay
marcadores `{sabores}` en las cajas de texto: la clienta no debe ver
plantillas.

─── 8.3 · Ingredientes: el cortador, y la puerta para cuando cambia el arte ───

EL CORTADOR. El texto impreso se muestra con cada palabra clickeable y
una manija al final: sale siempre un prefijo exacto. La regla regulada
pasa a ser IMPOSIBLE de violar por construcción.

EL PROBLEMA QUE ESO NO RESUELVE, y es doble:
  (a) para un sabor 16 no existe texto impreso en el sistema
      ([MEDIDO] `docs/envolturas.json` lo produce
      `scripts/extrae-envolturas.py` desde los PDF de imprenta, en
      Python, en la máquina de Marcos);
  (b) cuando la envoltura CAMBIA de verdad —cambió el proveedor, o la
      imprenta tenía mal los alérgenos— la clienta es la única que lo
      sabe, y el candado se lo prohíbe categóricamente. Bloquear una
      corrección de alérgenos es peor que no bloquearla.

UNA SOLA PUERTA PARA LOS DOS. Los ingredientes pasan a:

    ingredientes: { texto: string, estado: 'verificado' | 'pendiente' }

  · `verificado` = es prefijo exacto del arte en
    `datos/envolturas.json`. Se renderiza en el sitio.
  · `pendiente` = ella escribió texto nuevo (sabor 16, o corrección).
    NO SE RENDERIZA EN EL SITIO — ni el viejo ni el nuevo: la línea de
    ingredientes desaparece de esa ficha hasta que se verifique. Mostrar
    el texto impreso que ella acaba de decirte que está mal es peor que
    no mostrar nada.
  · El panel lo muestra como tarjeta pendiente, con la foto del arte
    nuevo que ella suba, y «Avisarle a Marcos» que le manda todo. Marcos
    corre `extrae-envolturas.py`, el arte entra a `datos/envolturas.json`
    y el estado pasa a `verificado` solo.

Es el mismo mecanismo que ya existe para la ilustración y el pliego, y
resuelve el callejón sin salida sin que ninguna información regulada
sin verificar llegue al visitante.

─── 8.4 · Color ───

Se extrae del arte (la mediana del borde del rectificado ES el color de
la banda: es lo que ya hace `extrae-envolturas.py`, por eso
`sabor.chamoy === '#CB3C41'` coincide exacto). Si la mejor tinta no
llega a 4.5, el panel corre el color de banda lo mínimo (mezcla ≤10%
hacia crema o hacia `tintaImpreso`) hasta que llegue. La función NO es
monótona en k (la tinta ganadora se da vuelta a mitad de camino), así
que es un barrido con corte. El hex del arte se guarda igual y se sigue
usando para el punto de las gotas; lo que se ajusta es la superficie web.

─── 8.5 · Baja ───

«Quitar del sitio» (`visible: false`, reversible, archivos intactos) con
pantalla de referencias antes de confirmar: «este sabor es el que abre
el anaquel», «lo usa la receta Peras con chocolate y canela para su
color», y REASIGNACIÓN OBLIGATORIA.

[MEDIDO] index.astro:33 hace `sabores.find(s => s.slug === 'canela')!`
con non-null assertion, marca.ts:202 tiene `?? 'canela'` y marca.css:101-102
`--mrc-sabor-canela`. Si la fachada filtrara los no visibles, `inicial`
sería undefined y `inicial.orden` revienta el build. Se resuelve con un
campo `anaquel.saborInicial` (control 'oculto', quien:'marcos'),
consumido por index.astro, por marca.ts vía `textos-ui`, y por el CSS
vía `--mrc-sabor-inicial`. Se hace en la FASE 2, no en la 7: es barato,
saca una aserción `!` y el `?? 'canela'` es una bomba de relojería (el
día que el aria-checked no esté, elige un slug que ya no existe y el
anaquel deja de responder a los clics).

SE VA el «Eliminar para siempre» con espera de 30 días y escribir el
nombre. Ella nunca va a borrar para siempre; con «Quitar del sitio»
alcanza. El borrado definitivo lo hace Marcos una vez por año.

`visible` existe SOLO en sabores. Recetas, preguntas, gotas y polvo se
agregan o se quitan, y punto.

UN SOLO EDITOR DE LISTA (`alta/EditorDeLista.tsx`) para recetas,
preguntas, gotas y polvo. Una pregunta son dos campos: no necesita un
asistente. Aparece vacía en su lugar dentro de la vista previa y se
escribe ahí, como todo lo demás. `AsistenteSabor` es el único asistente,
porque es el único con 6 archivos y un slug inmutable.

REORDENAR solo detrás de un botón explícito «Cambiar el orden», nunca
por arrastre libre en la vista normal: en el celular se reordena un
sabor sin querer buscando otra cosa.


═══════════════════════════════════════════════════════════
9 · LOS CONTEOS CONGELADOS
═══════════════════════════════════════════════════════════

NOTA DE ALCANCE (decisión de Marcos, 2026-09-08). Esta sección se aplica
en DOS momentos:

  · AHORA (fases 0-1): caen los asserts de VALOR — marca-copy:139
    (precios 122/108), marca-copy:191 (el lema textual), sitio:57 y
    sitio:77. Son los que la clienta va a editar desde la fase 6.

  · EN LA FASE 7, diferida: caen los asserts de CONTEO —
    marca-copy:59 (15 sabores), :61 (órdenes 1-15), :152, :160 (gotas 6),
    :165 (polvo 8), :118 (archivos por sabor). Hasta que exista el alta
    de ítems nadie puede violarlos, así que se quedan puestos: es un
    guard gratis que no puede molestar a nadie.

No se aflojan: cambian de naturaleza. De «15 exactos» a «el HTML pinta
exactamente lo que dice el dato, y el dato está en rango».

  marca-copy:59  toHaveLength(15)     → slugs === los del arte de imprenta
  marca-copy:61  órdenes 1–15         → 1..sabores.length sin huecos
  marca-copy:139 precios 122/108      → SE BORRA (el esquema garantiza
                                        entero, 1–99.999, nunca texto)
  marca-copy:152 catálogo null en 4   → null o URL de pulpos.shop
  marca-copy:160 gotas 6              → claves únicas + el texto
                                        «6 sabores» coincide (coherencia
                                        que HOY nadie vigila)
  marca-copy:165 polvo 8              → derivado de readdirSync
  marca-copy:118 5 archivos por sabor → 3 siempre + 2 si se declaran (§8.1)
  marca-copy:191 el lema exacto       → min/max + no vacío. La frase
                                        textual del cliente queda en el
                                        fixture congelado, no en un test
                                        que le prohíbe editarla.
  marca-copy:53  lee docs/envolturas  → lee datos/envolturas.json
  sitio:57       productos.barras 15  → SE BORRA con src/copy/sitio.ts
  sitio:77       /\$\s?108/           → SE BORRA (§0.4)
  sitio:99/102   details ×4 y ×8      → toHaveLength(marca.X.length)
  sitio:169-171  wordmark en RegExp   → esc() + `>\s*` (§0.3)
  sitio:235      data-salto ×15       → NO LLEGA A LA FASE 7: vive dentro
                                       del describe de _barras.astro, que
                                       §0.3 borra entero en la fase 0.
                                       Fila anulada (auditoría 2026-09-08).
  seo:130        ItemList 15          → sabores.length
  seo:208        nombre en RegExp     → esc() + `>\s*`
  fichas:23      fichas 4             → derivado de los datos
  fichas:60,79   producto/ruta en RegExp → esc()
  fichas:88      enlaces ≥5           → tabs.length + 2

`docs/envolturas.json` NO SE DUPLICA. Se MUEVE a
`src/contenido/datos/envolturas.json`, `extrae-envolturas.py` escribe
ahí, y el de docs/ se borra. Dos copias de la autoridad sobre
ingredientes y % de cacao, en un diseño cuya tesis es «una sola verdad»,
es exactamente el bug que el diseño dice prevenir — y el modo de falla
es «la web publica un porcentaje y la envoltura otro».


═══════════════════════════════════════════════════════════
10 · LA MIGRACIÓN, Y CÓMO SE PRUEBA
═══════════════════════════════════════════════════════════

SE VA EL GOLDEN HTML. Pero no por la razón que se dio.

La razón que se dio (el fixture + `serializa()` + `migra-contenido.ts`
ya prueban lo mismo tres veces) es incompleta: ninguno de los tres
prueba que LA FACHADA re-exporte el mismo objeto. El JSON puede estar
perfecto y la fachada devolver `undefined` donde antes había valor,
reordenar un array o coercer un número.

Lo que reemplaza al golden es más barato Y más exacto:

  COMMIT 1 — el fixture.
  `scripts/migra-contenido.ts` corre UNA vez contra el árbol viejo:
  importa `marca`, `sabores` y `fichasBase` de los módulos `as const`
  todavía vivos y escribe `test/fixtures/contenido-2026-09-08.json`.
  NADIE TIPEA CONTENIDO A MANO ⇒ nadie puede cambiar una coma.

  COMMIT 2 — la migración.
  El mismo script escribe los cuatro JSON con `serializa()`, que recorre
  el esquema: si el esquema declara una ruta que el objeto no tiene, o
  al revés, tira antes de escribir. Eso prueba que el esquema describe
  exactamente lo que hay hoy. Se reescriben las tres fachadas.

  EL CERTIFICADO — `test/contenido-fachada.test.ts`, PERMANENTE:
    expect(estructura(marca)).toEqual(fixture.marca)
    expect(estructura(sabores)).toEqual(fixture.sabores)
    expect(estructura(fichasBase)).toEqual(fixture.fichas)
  Deep-equal de los objetos EXPORTADOS contra el fixture capturado del
  módulo viejo. Prueba exactamente lo que el golden probaba sobre el
  copy, en 3 aserciones, sin depender de AstroContainer, y sin morir en
  el commit 3.

  MÁS 8 ASERCIONES DE FORMA, sobre las expresiones de index.astro que
  dependen de la FORMA y no del valor — que es donde un golden HTML
  hubiera servido y estas sirven mejor porque dicen POR QUÉ:
    · `'chipPolvo' in r` da false en las 3 recetas sin chip
    · `t.precio == null` se estrecha en el tab de polvo
    · `titular[1]` termina en una coma y solo una
    · `puestoTitulo.join(' ')` da 'Mercado de Coyoacán'
    · `colorSabor[s.clave]` compila para los 15
    · `JSON.parse` del `#datos-anaquel` renderizado no tira
    · `sabores.find(slug === anaquel.saborInicial)` no es undefined
    · los 8 espacios duros siguen siendo U+00A0 en el HTML renderizado

REGLA DEL COMMIT DE LA FASE 1: cero `.astro` tocados. Pero la
justificación que se daba —«los hashes data-astro-cid-* salen del
contenido del componente»— ES FALSA, y la verifiqué: agregué un
comentario dentro del `<style>` de Insignia.astro, reconstruí, y los
seis `data-astro-cid-*` de dist/index.html quedaron IDÉNTICOS. El cid es
hash de la RUTA del archivo. La regla se mantiene por higiene de señal
(un commit, una causa), no por ese motivo. Y la razón real para
posponer la muerte de `sabores[].clave` a la fase 7 es otra, y es buena:
`colorSabor[s.clave]` con `keyof typeof sabor` es lo que hace cara la
migración temprana, y `--mrc-sabor-canela` está clavado en marca.css.


═══════════════════════════════════════════════════════════
11 · TESTS NUEVOS QUE LA ARQUITECTURA HABILITA
═══════════════════════════════════════════════════════════

  · Candado anti-desincronización: rutasDelEsquema === rutasDelDato.
  · Bytes canónicos: serializa(cargar(bytes)) === bytes.
  · Biyección campo↔data-campo EN LOS DOS SENTIDOS y POR PÁGINA, con
    cardinalidad ≥1 (§3.1).
  · Las cajas declaradas existen en el HTML: si Marcos renombra `.chips`,
    esto truena ANTES de que el motor mida contra un selector muerto y
    dé verde siempre — el falso negativo más peligroso.
  · El medidor mide la MISMA caja que ve el visitante: `.chips` con una
    ficha revelada === `.chips` en producción, ±1 px. Es el test que
    hubiera atrapado el bug de revelar las 15.
  · Anclas vivas: cada `nav.items[].ancla` tiene su `id=` en la home.
    Hoy nada lo vigila y es lo que rompe un cliente reordenando el menú.
  · `#datos-anaquel` del HTML renderizado hace JSON.parse sin tirar, y
    con un `</script` inyectado tampoco.
  · Todo campo tiene etiqueta, ayuda y sección válidas.
  · El reparto de permisos: las rutas con `quien:'marcos'` son
    exactamente el conjunto declarado.
  · Las formas de `_zod.def` siguen siendo las esperadas.
  · Los mensajes del panel pasan el filtro de vocabulario de MARCA (no
    el de MAQUETA: el panel necesita la palabra «Borrador»).
  · Las ~25 mutaciones que `validar()` tiene que cachear, más la
    mutación «cambiar un precio» corriendo el build ENTERO.
  · El motor detecta 31 «W» y NO detecta 31 «i» (control de falso
    positivo), y da verde sobre el chip PRÓXIMAMENTE rotado −4° con un
    texto conocido-bueno (control de la neutralización de transforms).
  · `test/meta.test.ts`: ningún test invoca `pnpm build`.
```

---

# Decisiones de diseño

### El build de Vercel pasa a `astro build && vitest run && astro check` — el build PRIMERO, los tests leyendo el dist

**Por qué.** Lo reproduje: `pnpm test` hoy imprime un `astro build` completo (11 páginas, sitemap incluido) en el medio de los 677 tests, porque test/css-tokens.test.ts:67 hace `execSync('pnpm build')`. Poner vitest ADENTRO de build es una fork bomb que dejaría todos los deploys rojos para siempre, empezando por el commit que instala la compuerta que promete «producción nunca se rompe». Invertir el orden elimina la recursión por construcción en vez de evitarla por disciplina, y de yapa hace que css-tokens verifique el artefacto que Vercel realmente publica —que era su intención declarada en el propio comentario del test— y le regale al medidor el `<style>` inline de dist/index.html sin costo.

**Descartado.** Blindar el test con una variable de entorno (`if (process.env.MRC_BUILD_INTERNO) return`) y dejar `build = vitest run && astro check && astro build`. Funciona, pero deja la recursión a un `git revert` de distancia y hace el test más débil justo cuando se lo convierte en compuerta de producción.

### El mapeo campo→nodo es UNO-A-MUCHOS, y hay un segundo atributo `data-campo-attr` para los que son alt/aria

**Por qué.** Medí las 321 hojas string de `marca` contra dist/index.html: 171 aparecen una vez, 118 aparecen 2+ veces y 32 no aparecen nunca. `anaquel.pesoInsignia` ×17 y `manoInsignia` ×15 porque index.astro:301 prerenderiza las QUINCE fichas (decisión de SEO del 2026-08-19); `footer.lema` ×6 porque el pie lo pone dos veces y Marquesina.astro duplica el `<slot>`; `hero.titular.1` ×0 porque index.astro:145 le saca la coma. El test «exactamente un data-campo o es oculto, no hay tercera opción» falla en ~150 campos el día que se escribe, y el parche en vivo actualizaría 1 de 15 nodos —posiblemente uno oculto, y la vista previa no cambia nada.

**Descartado.** Biyección uno-a-uno con un nodo primario declarado por campo. Deja los otros 14 nodos sin parchear: la clienta edita «Hecho a mano» y ve cambiar una sola ficha de quince, sin poder saber si eso es su cambio o un bug.

### `prepararDocumento()` revela las fichas DE A UNA, no las 15 de golpe — y con eso alcanza medir una sola

**Por qué.** Lo medí en Chrome sobre dist/ a 1440 px. `.ficha-fila` es flex-wrap y `.ficha-datos` es `flex: 1 1 300px; min-width: 0`. Con UNA ficha visible (que es producción) `.chips` mide 407 px, idéntico en los quince. Revelando las 15 de una: 331, 444 y 633 px. Un error de −76 a +226 px sobre la ÚNICA invariante que el medidor bloquea duro (nowrap de insignias): una insignia de 420 px se mediría como que entra en trece sabores y en producción se sale; una de 350 px se bloquearía estando perfecta. El paso que el diseño celebraba como el que elimina «el falso negativo grande y silencioso» introducía uno propio, más grande. Y el mismo experimento regala la simplificación: como los quince dan 407 px exacto, el medidor mide UNA ficha y el número vale para todas.

**Descartado.** Revelar todo con `[data-ficha-de][hidden] → hidden = false` y medir en una pasada. Es 15 veces más rápido y está 226 px equivocado.

### Se elimina `medidas.generated.json`, su cadena de generación y el guard de frescura: el gate de CI mide HEAD contra HEAD~1

**Por qué.** El archivo existía para alimentar un contador de caracteres que el propio diseño demuestra que no significa nada (31 «W» miden 426 px y 31 «i» 142 px) y que explícitamente no bloquea. Como el veredicto del panel es diferencial contra el sitio en vivo en el mismo iframe, y el de CI puede ser diferencial contra el commit anterior (`astro build` completa en 983 ms medidos: construir dos veces es gratis), el archivo se queda literalmente sin consumidores. Y con él se van tres problemas: la allowlist que se pudre —cada publicación legítima de la clienta desactualizaba el archivo y llenaba de correos rojos la bandeja de Marcos hasta que los filtrara—, el guard de frescura, y el bug del guard: hasheaba marca.css y los woff2, pero con `inlineStylesheets: 'always'` y Tailwind v4 el CSS compilado depende del CONTENIDO de las plantillas, y la lista omitía global.css (el preflight: box-sizing, márgenes, line-height — la base de toda medición), Base.astro y 2 de los 6 componentes con `<style>`.

**Descartado.** Regenerar el archivo en Actions y commitearlo cuando cambia. Agrega un commit automático a main que compite con los pushes del panel y dispara un segundo deploy por publicación, para mantener fresco un archivo que ya no lee nadie.

### La puerta principal del panel es una contraseña larga en el llavero del teléfono; el enlace mágico queda como recuperación

**Por qué.** Dos cosas se suman. Primera: api/contacto.ts:99 cae a `Maracacao <onboarding@resend.dev>` cuando CONTACTO_REMITENTE no está cargada, y con el dominio de prueba Resend solo entrega al correo del dueño de la cuenta — verificar maracacao.mx es SPF+DKIM en el DNS del registrador, un trámite de días, no una tarea de código. Segunda: aunque llegue, llega a maracacaomx@gmail.com, la misma casilla donde caen los pedidos, y en un día de mercado los 15 minutos de vigencia se los come un cliente que interrumpe. Con el enlace como única puerta, el modo de falla de la autenticación es «llamar a Marcos», que es exactamente lo que el panel viene a matar. Una contraseña en un `<input type=password autocomplete=current-password>` la guarda el llavero de iOS sola y no viaja por ningún lado.

**Descartado.** Solo enlace mágico, con la verificación del dominio como pregunta abierta. Deja el proyecto entero inutilizable esperando un trámite de DNS, y con un único punto de falla cuyo respaldo es el WhatsApp.

### Si el build de Vercel falla, la función REVIERTE sola el commit de la clienta

**Por qué.** «Producción nunca se rompe» es cierto para el visitante y falso para ella: su commit ya está en main, así que el próximo publish también falla —ahora sin que ella haya cambiado nada— y lo único que ve es «falló». Con el hallazgo de sitio.test.ts:77 (`expect(html).toMatch(/\$\s?108/)`, el precio congelado en un segundo lugar que nadie había enumerado) el escenario no es hipotético: es el caso de uso número uno del panel. La reversión automática usa el mismo camino de publicación y la misma validación, y le habla en español: «no pude publicar esto, lo dejé como estaba y ya le avisé a Marcos».

**Descartado.** Dejar el commit en main y ofrecerle «Volver a esta versión» desde el Historial. Es la pantalla más lejana justo en el peor momento, y no destraba a Marcos, que a partir de ahí tampoco puede publicar.

### El PDF de las fichas no se mata: se le pone un sello de vigencia y el botón se apaga solo cuando queda viejo

**Por qué.** Los dos problemas técnicos son reales y los verifiqué —genera-fichas.ts:8 llama /usr/bin/google-chrome por ruta absoluta, y plantilla.ts:45,51 filtra secciones sin título y pares de meta vacíos mientras fichas-tecnicas.astro no filtra nada, así que con un título vacío dan 7 y 8 secciones con la numeración corrida distinta— pero los dos se resuelven extrayendo DocumentoFicha.astro, sin tocar el archivo. Y matar el PDF tiene un costo comercial que nadie del lado del negocio firmó: un distribuidor pide la ficha como adjunto para su expediente de proveedor, y «Guardar como PDF» en iOS está en Compartir → Opciones → PDF, tres pasos que no se explican por WhatsApp. Con `public/fichas/.sello.json` guardando el sha256 de datos/fichas.json, la página compara en build: vigente muestra «Descargar PDF», vencido lo esconde y deja «Ver e imprimir». Un PDF viejo es posible; un PDF viejo SERVIDO es imposible. El build nunca falla por esto.

**Descartado.** Regenerar los PDF en Actions y commitearlos. El panel también pushea a main: el commit de vuelta dispara un segundo deploy, hay que guardarlo con path filters para que no se autotrigueree, y dos publicaciones en un minuto se pisan. Es una máquina de estados entera para un archivo de 700 KB.

### Un solo iframe de vista previa, redimensionado en serie; en vivo se mide solo 320 px

**Por qué.** dist/index.html son 209 KB con 88 `<img>`, model-viewer.min.js pesa 935 KB y barra.glb 266 KB (todo medido). Tres iframes son ~2.8 MB de JS a parsear, tres GLB, tres islas de Rive y ~264 imágenes, con las 30 minis del hero a 380×815 = ~1.2 MB de bitmap decodificado cada una. Safari en iOS descarta la pestaña bastante antes de eso, y el celular es el PRIMER dispositivo declarado. Medir en serie redimensionando el mismo iframe da exactamente los mismos números. Y medir los tres anchos en cada tecla es trabajo sobre información que ella no puede usar: el ancho que le importa mientras escribe es el peor, y los otros dos se revisan al apretar Publicar, que ya hace la pasada completa.

**Descartado.** Tres bancos (320 visible, 768 y 1440 ocultos) con requestIdleCallback. El idle callback posterga la MEDICIÓN, no la carga: las tres copias se bajan igual.

### Los precios que están escritos dos y tres veces se DERIVAN en la fachada, no se editan

**Por qué.** El 108 vive en sabores[].precio y en negocios.tabs[2].precio; el 258 en gotas[].precio, en marca.gotas.precioDesde y en tabs[1].precio; el 340 en dos lugares; el 118 en marca.minis.precio y en paqueteSeis.precio (que además está importado en index.astro:25 y no se usa en ninguna parte). Si sube las barras a 130 desde el anaquel, la pestaña «Para negocios» le sigue diciendo «desde $108» a las cafeterías, que son exactamente el público de ese panel, y nada avisa. El diseño inventó la regla `cuenta:` para el «15» escrito nueve veces y no la aplicó al precio, que es el mismo problema y además es plata.

**Descartado.** Exponer los tres precios como campos editables con un aviso de coherencia en la bandeja. Le pide a la clienta que mantenga sincronizados a mano tres números que la máquina puede calcular, y el aviso solo sirve si lo lee, que apurada no lo hace.

### Los ingredientes ganan un estado `pendiente` que sirve para el sabor 16 Y para cuando cambia la envoltura

**Por qué.** El cortador de prefijos hace la regla regulada imposible de violar, y eso mismo la convierte en un callejón sin salida en dos casos que no tienen salida hoy: un sabor nuevo no tiene texto impreso en el sistema (extrae-envolturas.py es Python y corre en la máquina de Marcos), y cuando la imprenta tenía mal los alérgenos la clienta es la única que lo sabe. Bloquear una corrección de alérgenos es peor que no bloquearla. Con `{texto, estado}`, `pendiente` significa que la línea de ingredientes DESAPARECE del sitio hasta que se verifique —ni el viejo ni el nuevo, porque mostrar el texto que ella acaba de decirte que está mal es peor que no mostrar nada— y el panel lo pinta como tarjeta con «Avisarle a Marcos». Es el mismo mecanismo que ya existe para la ilustración y el pliego.

**Descartado.** Dejar el candado absoluto y decir que los ingredientes los cambia Marcos. Congela información de seguridad alimentaria en manos de la persona que no está, que es la definición del problema que el panel viene a resolver.

### El editor de foto es recorte rectangular más un slider de enderezar; la homografía de 4 esquinas queda como ajuste fino opcional en escritorio

**Por qué.** El propio diseño dice que lo ÚNICO obligatorio para publicar un sabor es la foto de la barra. Hacer que esa única foto obligatoria pase por el subsistema más complejo del proyecto —homografía con eliminación gaussiana, mapeo inverso bilineal, lupa 3× flotante, aplanado de iluminación y quitado de fondo portados de dos scripts de Python— es al revés, y peor: es una tarea de precisión que ella va a hacer parada, entre dos clientes, en un mostrador. El control de calidad que sí importa no es el editor sino la comprobación: mostrar la barra nueva METIDA EN LA REJILLA del anaquel, junto a sus vecinas, a escala real, con «esta quedó más ancha que las demás». Es la única pantalla donde el problema se ve.

**Descartado.** El rectificador de cuatro esquinas como camino obligatorio de toda foto, con el argumento de que la barra no tiene fondo y un recorte rectangular deja la perspectiva adentro. Es cierto y es un lujo de precisión para un momento sin precisión; queda disponible, no impuesto.

### El golden HTML se reemplaza por un deep-equal permanente fachada-vs-fixture más 8 aserciones de FORMA

**Por qué.** El argumento de que el fixture, `serializa()` y `migra-contenido.ts` ya prueban lo mismo tres veces es incompleto: ninguno de los tres prueba que LA FACHADA re-exporte el mismo objeto. El JSON puede estar perfecto y la fachada devolver undefined donde había valor, reordenar un array o coercer un número. El test correcto no es un golden HTML sino `expect(estructura(marca)).toEqual(fixture.marca)`: tres aserciones, permanentes, sin depender de AstroContainer, que no mueren en el commit 3. Las ocho aserciones de forma cubren lo único que un golden agregaba —`'chipPolvo' in r`, `t.precio == null`, los tres renglones del titular, `puestoTitulo.join`, el JSON.parse del anaquel— y encima dicen POR QUÉ, que un diff de 136 KB no dice.

**Descartado.** Mantener el golden byte a byte durante tres commits. Además de redundante, forzaba a la fase 2 a auditar a ojo un diff con 200 elementos nuevos en un archivo de 1938 líneas, que no es una verificación.

### El borrador vive en `refs/panel/borrador`, un ref fuera de refs/heads/, desde el día uno

**Por qué.** Era el plan B del diseño y no hay ninguna razón para no hacerlo el plan A. Vercel directamente no mira refs fuera de refs/heads/, así que desaparece la pregunta abierta entera sobre Branch Tracking (que había que ir a verificar en el panel de Vercel antes de habilitar el autosave, con el riesgo de que cada guardado disparara un deploy de preview), no ensucia la lista de ramas, y ~960 commits de borrador en un día de mercado con el panel abierto no aparecen en ningún lado.

**Descartado.** La rama `panel-borrador` con `git.deploymentEnabled` en falso. Requiere Branch Tracking activo en Environments → Preview, o sea una verificación manual en una consola ajena antes de habilitar una función, con un modo de falla caro.

### `PANEL_VERCEL_TOKEN` pasa a OBLIGATORIO — sin él no se habilita el botón Publicar

**Por qué.** Rechazo el argumento de que la API de Vercel sobra porque version.json responde «¿ya está en el aire?». version.json solo puede decir «todavía no», nunca «nunca»: no distingue tardar de fallar. Y en cuanto la reversión automática por build fallido pasa a ser un arreglo de bloqueante, saber que el deploy falló deja de ser un lujo y se vuelve la condición para que funcione. Publicar a ciegas es peor que no publicar: ella cree que publicó, vende a $130, y el cliente le muestra el celular con $108.

**Descartado.** Degradar solo a version.json cuando el token no está, con la misma filosofía que contacto.ts sin RESEND_API_KEY. Es la filosofía correcta para un formulario de contacto y la equivocada para el estado de una publicación.

---

# Mapa de archivos

```
═══ NUEVOS ═══

src/contenido/                  ← ISOMORFO: sin node:*, sin Astro, sin alias @/
  vocabulario.ts                dos listas: MARCA (copy + panel) y MAQUETA (solo sitio)
  campos.ts                     constructores + z.registry<MetaCampo>() — EL catálogo de campos
  carga.ts                      cargar() valida/congela/tipa · serializa() bytes canónicos · recorre()
  derivados.ts                  tabs[].precio, gotas.precioDesde, precioJengibre — calculados, no editables
  validacion.ts                 validar(doc, crudo) → Problema[] — lo importan panel, función y vitest
  diff.ts                       resume(antes, después) → Cambio[] · frase()
  conteos.ts                    la regla `cuenta` (cifra Y palabra) + tabla de 1 a 20 en letras
  color-sabor.ts                resuelveColor() · mejorTinta() · la regla de contraste del esquema
  esquema/sitio.ts              los ~300 campos de la home, anotados
  esquema/sabores.ts            sabores, gotas, polvo
  esquema/fichas.ts             las 4 fichas; Bloque como discriminatedUnion; la fila de energía como {kcal}
  esquema/index.ts              DOCUMENTOS + SECCIONES: de acá se pinta el panel
  datos/sitio.json              el copy de la home (lo escribe el panel)
  datos/sabores.json            sabores, gotas, polvo
  datos/fichas.json             las 4 fichas como datos planos
  datos/envolturas.json         MOVIDO de docs/ — el arte de imprenta, autoridad única

src/anti-desborde/
  medidor.ts                    isomorfo: prepararDocumento (6 pasos), aplicarBorrador, medir, comparar
  veredicto.ts                  mediciones → hallazgos en español mexicano
  chrome.ts                     cliente CDP mínimo (WebSocket nativo de Node 22)

src/servidor/                   ← lo que corre en la función serverless
  origen.ts                     LA lista de orígenes — la usa también api/contacto.ts
  sesion.ts                     contraseña (scrypt + tiempo constante) · enlace mágico HMAC · cookie firmada
  github.ts                     cliente REST mínimo con el PAT
  publicar.ts                   Git Data API: blobs (paralelo, conc. 4) → tree → commit → PATCH ref force:false
  revertir.ts                   la vuelta atrás automática cuando el build falla
  borrador.ts                   refs/panel/borrador, con dispositivo y hora
  historial.ts                  commits + contenido por sha para el diff
  estado.ts                     API de Vercel + /version.json (OBLIGATORIO)
  correo.ts                     Resend: enlace mágico, «ya está en el sitio», «no salió», «algo se ve mal»
  rutas-permitidas.ts           la lista blanca de escritura y los topes
  acciones.ts                   el router de /api/panel?accion=

src/imagenes/
  especies.ts                   medida exacta, alfa y presupuesto por familia — fuente única
  webp.ts                       lector de cabecera sin dependencias (VP8/VP8L/VP8X) — probado en este repo
  manifiesto.json               GENERADO: medida real, alfa y bytes de cada imagen publicada
  manifiesto.ts                 accesor tipado medida(ruta), tira si falta
  maestros/*.webp               los maestros (2× la derivada mayor), fuera de public/

src/panel/
  mensajes.ts                   TODOS los textos; pasa el filtro de vocabulario de MARCA
  borradores.ts                 IndexedDB + resolución de conflicto entre dispositivos
  preview/inyecta.ts            el script del iframe: resalta, parchea TODOS los nodos y expone medir()
  app/Cascara.tsx               barra, lateral, hoja de campo, ruteo del lado del cliente
  app/VistaPrevia.tsx           UN iframe; redimensiona en serie; tocar-y-mantener → campos cercanos
  app/IndiceSecciones.tsx       derivado del HTML en orden de scroll, con filtro por contenido
  app/EditorCampo.tsx           la ficha; se colapsa sola con el teclado abierto
  app/campos/{Texto,Renglones,Lista,Precio,Medida,Derivado,Foto,Regulado}.tsx
  app/Regla.tsx                 la barra de medición y las frases del veredicto
  app/BandejaPublicar.tsx       resumen en plata («cambia el precio de 15 productos»), antes/ahora, deshacer
  app/EstadoDeploy.tsx          Guardado · Armando · En vivo · No salió (+ deshacer, + ver mi sitio)
  app/Historial.tsx             publicaciones con QUIÉN, y volver a esta versión
  app/AlgoSeVeMal.tsx           la salida de emergencia, con contexto, por correo
  alta/AsistenteSabor.tsx       los 5 pasos (el único asistente)
  alta/CortadorDeIngredientes.tsx  el prefijo por construcción + el camino «cambió la envoltura»
  alta/EditorDeLista.tsx        UNO solo para recetas, preguntas, gotas y polvo
  baja/PantallaReferencias.tsx  qué se rompe, con reasignación OBLIGATORIA
  foto/recorte.ts               rectangular + enderezar (el camino crítico)
  foto/derivar.ts               maestro → 3 derivadas + búsqueda binaria de calidad + escape
  foto/diagnostico.ts           las validaciones con sus mensajes, sin nombrar formatos
  foto/RecorteBarra.tsx         el recorte + la comprobación en la rejilla del anaquel
  foto/encuadre.ts              OPCIONAL, escritorio: homografía de 4 esquinas (si sobra tiempo)

src/pages/panel/index.astro     la cáscara del panel (isla React client:only)
src/pages/panel/entrar.astro    HTML estático con un BOTÓN que hace POST
src/pages/version.json.ts       el sello de commit que el panel sondea
src/pages/fichas-tecnicas/[ficha].astro   una página por ficha, imprimible sola
src/components/marca/DocumentoFicha.astro UN renderer, con los filtros de plantilla.ts adentro
src/styles/panel.css            paleta de marca a densidad de herramienta

api/panel.ts                    la ÚNICA función nueva; router delgado, todo en src/servidor/

scripts/migra-contenido.ts      corre UNA vez: módulos as const → fixture + JSON, con serializa()
scripts/mide.ts                 pnpm mide — Chrome headless, para el bloque B
scripts/imagenes.ts             pnpm imagenes — sharp re-deriva todo desde los maestros
scripts/estres.ts               CONTENIDO_ESTRES=1: rellena cada texto al máximo y construye
scripts/bundle-api.ts           PLAN B: esbuild → api/panel.js autocontenido

.github/workflows/verifica.yml  push a main: test + typecheck + anti-desborde HEAD vs HEAD~1
docs/panel-operacion.md         el runbook (rotar el PAT, cerrar sesiones, sacar a alguien, main roto)
docs/tests-que-congelan-contenido.md   la auditoría de la fase 0

test/meta.test.ts               ningún test invoca `pnpm build`
test/contenido.test.ts          candado esquema↔dato, bytes canónicos, permisos, formas de _zod.def
test/contenido-mutaciones.test.ts las ~25 mutaciones (una corre el build entero)
test/contenido-fachada.test.ts  EL CERTIFICADO: deep-equal fachada vs fixture + 8 aserciones de forma
test/anti-desborde.test.ts      bloque A sin navegador + bloque B con Chrome
test/imagenes.test.ts           medidas, alfa, presupuestos, huérfanos, sin literales en las páginas
test/panel.test.ts              biyección campo↔data-campo (≥1, por página), vocabulario del panel
test/panel-sesion.test.ts       scrypt, HMAC, propósito, expiración, lista blanca releída
test/panel-publicar.test.ts     lista blanca de rutas, topes, árbol atómico, el reintento no-fast-forward
test/fixtures/contenido-2026-09-08.json   el fixture congelado (PERMANENTE)

═══ TOCADOS ═══

package.json                 build:sitio · verifica · build = build:sitio && verifica
                             zod ^4.4.3 a dependencies · sharp a devDependencies
                             scripts: mide, imagenes, estres, contenido:migra
                             `fichas` SE QUEDA (§7), pero además escribe .sello.json
test/css-tokens.test.ts      DEJA de correr `execSync('pnpm build')`; LEE dist/index.html
src/copy/sitio-marca.ts      441 → ~16 líneas: fachada. Mismos exports (marca, precioMXN)
src/copy/sabores.ts          101 → ~14: fachada. Se va `paqueteSeis`
src/fichas/base.ts           404 → 6: fachada sobre datos/fichas.json
src/fichas/plantilla.ts      se va fichaHtml(); quedan Bloque/Seccion/Ficha y los filtros
src/pages/index.astro        FASE 0: escape de `<` en datos-anaquel, .slice(0,-1) en el titular,
                             borrar el import de paqueteSeis
                             FASE 2: ~200 data-campo + data-campo-attr, <script id="textos-ui">,
                             /15 derivado, width/height del manifiesto, ilustración condicional,
                             anaquel.saborInicial, la dirección postal del JSON-LD sacada al copy
src/pages/fichas-tecnicas.astro  pasa a DocumentoFicha; el botón de PDF condicionado al sello
src/pages/404.astro          data-campo en los 4 textos
src/components/marca/Insignia.astro       prop `campo` → data-campo
src/components/marca/EtiquetaSabor.astro  prop `campo` → data-campo en .texto
src/scripts/marca.ts         try/catch en el JSON.parse del anaquel (FASE 0)
                             try/catch en aplica() del visor 3D
                             lee textos-ui con respaldo; ajusta el alto de la ilustración
                             el `?? 'canela'` pasa a anaquel.saborInicial
src/seo/esquema.ts           FASE 0: deja de leer catalogoBarras.encabezado → anaquel.titulo
                             FASE 2: la dirección postal sale al copy
src/seo/sitemap.ts           suma panel a RUTAS_PRIVADAS; filtra /fichas-tecnicas/<slug>
src/styles/marca.css         líneas 100-102: --mrc-sabor-inicial en vez de --mrc-sabor-canela
src/tokens/css.ts            emite --mrc-sabor-inicial y --mrc-tinta-sabor-inicial
api/contacto.ts              importa ../src/servidor/origen (el experimento de tracing)
                             y lee el destino de datos/sitio.json en vez de CONTACTO_DESTINO
vercel.json                  /panel al noindex + Referrer-Policy (SIN CSP)
                             functions.api/panel.ts: maxDuration 60 + includeFiles
                             /version.json no-store
scripts/extrae-envolturas.py escribe en src/contenido/datos/envolturas.json
astro.config.mjs             la isla React del panel

═══ BORRADOS ═══

src/copy/sitio.ts            354 líneas muertas; único consumidor test/sitio.test.ts:12
src/pages/_barras.astro      sin rutear desde el 2026-08-17
el bloque catalogoBarras     18 campos, más 3 de los 9 «15» del copy
paqueteSeis                  importado en index.astro:25 y no usado en ningún lado
docs/envolturas.json         MOVIDO, no copiado
4 campos muertos             selloAlt, anaquel.verTodas, footer.wordmarkAlt (0 apariciones medidas)

═══ NO EXISTEN (estaban en el diseño anterior) ═══

src/panel/catalogo.ts · src/panel/medidas.ts · src/contenido/limites.ts
src/anti-desborde/slots.ts · src/anti-desborde/servidor.ts · src/cms/validacion.ts
src/contenido/medidas.generated.json + su guard de frescura + scripts/mide-slots.ts
src/contenido/esquema/catalogo-barras.ts + datos/catalogo-barras.json
scripts/instantanea-html.ts + test/golden.test.ts + test/golden/*.html
scripts/genera-miniaturas.ts
src/panel/alta/{AsistenteReceta,AsistentePregunta,AsistenteGotas}.tsx
src/panel/app/Recorrido.tsx · src/panel/app/Buscador.tsx (es un filtro del índice)
src/panel/foto/{luz,fondo}.ts (fuera del camino crítico)
Inmutable<T>

═══ TESTS REESCRITOS ═══

test/sitio.test.ts · test/marca-copy.test.ts · test/seo.test.ts · test/fichas.test.ts
test/marca-tokens.test.ts · test/css-tokens.test.ts — conteos derivados del dato,
regex escapados, sin asserts que le prohíban editar a la clienta
```

---

# Orden de trabajo

Fases 0 a 6 comprometidas. Fases 7 y 8 diseñadas y diferidas.

### FASE 0 · AUDITORÍA, COMPUERTA Y DESACTIVAR MINAS (3-4 días, no medio día)

(a) Arreglar la recursión ANTES que nada: partir el script en build:sitio / verifica / build, y que css-tokens.test.ts LEA dist/index.html en vez de construirlo. Push a main y verificar que Vercel deploya verde — incluyendo que los 677 tests corran en SU contenedor (@resvg/resvg-js es nativo y render.test.ts hace execFileSync); si algo no corre allá, partir en verifica:vercel. Más test/meta.test.ts que grepea `pnpm build` dentro de test/. (b) Escapar `<` en el JSON del anaquel + try/catch en marca.ts:187 + test que hace JSON.parse del #datos-anaquel renderizado: es una mina latente (hoy ningún campo tiene `<`, verificado) que puede dejar seis pasos de «Cómo catar» invisibles para siempre en cuanto la clienta pueda escribir. (c) La auditoría escrita de los 26 archivos de test → docs/tests-que-congelan-contenido.md. (d) Limpieza: borrar src/copy/sitio.ts y su describe, _barras.astro y el bloque catalogoBarras (esquema.ts pasa a anaquel.titulo), paqueteSeis y los 3 campos muertos. (e) zod a dependencies, sharp a devDependencies. (f) esc() en los 4 tests que interpolan regex crudo. (g) .slice(0,-1) en el titular. (h) Prueba de humo de Resend a una casilla que NO sea la del dueño de la cuenta. ENTREGA: la compuerta existe y está verde con el contenido congelado, producción tiene una mina menos, y hay una lista escrita de qué se rompe con qué edición.

### FASE 1 · LA CAPA DE CONTENIDO (5-7 días; el esquema son ~900 líneas escritas a mano y no se puede generar: la etiqueta en español y la ayuda SON el producto)

campos.ts, carga.ts, validacion.ts, derivados.ts, los tres esquemas anotados. scripts/migra-contenido.ts corre UNA vez y escribe el fixture y los cuatro JSON con serializa(): nadie tipea contenido a mano. Se reescriben las tres fachadas y se escribe test/contenido-fachada.test.ts (el deep-equal contra el fixture más las 8 aserciones de forma). Se mueve docs/envolturas.json a datos/. REGLA DEL COMMIT: cero .astro tocados — por higiene de señal (un commit, una causa), no porque los data-astro-cid dependan del contenido, que verifiqué que no. ENTREGA: `pnpm build` verde con el contenido saliendo de JSON, y un certificado permanente de que la migración no movió una coma.

### FASE 2 · INSTRUMENTAR index.astro (3-4 días — es un cambio de MARKUP, no de atributos)

Los ~200 data-campo, que obligan a inventar spans donde hoy hay nodos de texto mezclados (:315, :340, :360, :415, :536 y los tres renglones del h1). Los data-campo-attr de los alt y aria. El <script id="textos-ui">. La dirección postal del JSON-LD sacada al copy. El /15 derivado. anaquel.saborInicial reemplazando el find(...)! de :33, el ?? 'canela' de marca.ts:202 y el --mrc-sabor-canela de marca.css:101. El try/catch del visor 3D. La ilustración condicional. VERIFICACIÓN: diff normalizado (borrar data-campo*, desenvolver los spans sin otro atributo, exigir idéntico byte a byte), no auditoría a ojo de 200 elementos nuevos. ENTREGA: el HTML es direccionable por ruta de campo.

### FASE 3 · FICHAS E IMÁGENES (3-4 días)

DocumentoFicha.astro extraído con los filtros de plantilla.ts adentro: hoy plantilla.ts filtra secciones sin título y la página no, y con un título vacío dan 7 y 8 secciones con la numeración corrida distinta. Las 4 páginas por ficha con CSS de impresión. pnpm fichas escribe public/fichas/.sello.json y la página condiciona el botón de PDF al sello. src/imagenes/{especies,webp,manifiesto} + pnpm imagenes, y se re-derivan barra-limoncillo y barra-menta-intensa, que están a 754×1566 mientras index.astro declara 1617 y model-viewer fija aspect-ratio 754/1617: se estiran 3.26% y saltan al cargar. Las 15 ilustraciones dejan de declarar 400/450 cuando van de 400×400 a 400×705. ENTREGA: un solo renderer de ficha, un PDF que no puede servirse viejo, y medidas de imagen que salen del manifiesto.

### FASE 4 · EL MEDIDOR (3-4 días, uno menos que antes porque se fue toda la cadena de medidas.generated.json)

medidor.ts isomorfo con los seis pasos de prepararDocumento (revelando las fichas DE A UNA y con transform:none), veredicto.ts, chrome.ts, scripts/mide.ts. Tests: bloque A sin navegador (biyección ≥1 por página en los dos sentidos, cajas vivas, composición, sin píxeles a mano) y bloque B con Chrome (el contenido publicado entra hoy; `.chips` con una ficha revelada === producción ±1 px; el motor detecta 31 «W» y NO 31 «i»; el chip PRÓXIMAMENTE rotado −4° da verde con texto conocido-bueno). .github/workflows/verifica.yml midiendo HEAD contra HEAD~1. ENTREGA ÚTIL SOLA: aunque el panel se atrase seis meses, ya hay un guard que impide que un cambio de CSS rompa el contenido publicado.

### FASE 5 · PUBLICACIÓN (5-6 días)

PRIMERO api/contacto.ts importando ../src/servidor/origen: el cambio de una línea que responde si el bundler de Vercel arrastra archivos de afuera de /api. Si falla, se destraba con scripts/bundle-api.ts (esbuild) ANTES de que dependa nada. Después: sesión con contraseña scrypt + enlace mágico de recuperación, github.ts, publicar.ts con blobs en paralelo, revertir.ts, borrador.ts sobre refs/panel/borrador, historial.ts con Panel-Autor, estado.ts con el token de Vercel (obligatorio), correo.ts. version.json.ts. maxDuration 60 en vercel.json. La vigilancia de la expiración del PAT en accion=salud. ENTREGA: se puede publicar por HTTP, con validación, atómicamente, con reversión automática si el build falla, y producción nunca se rompe.

### FASE 6 · EL PANEL, TEXTOS (6-7 días)

Cáscara, UN iframe con los tres anchos en serie, ficha de campo con sus ocho controles, tocar-y-mantener en celular, el colapso con el teclado abierto, la regla con su salida («pedirle a Marcos»), la bandeja con resumen en plata, el estado del deploy con deshacer y «ver mi sitio», el historial. Se escriben las ~60 oraciones de ayuda que no son obvias; el resto arranca con el texto generado del metadato. Sin altas, sin fotos. Y ACÁ VA EL ENSAYO CON LA CLIENTA, no en la fase 8: sola, con su celular, sin Marcos al lado, cronómetro en «el texto ese que está abajo de la foto grande». En la fase 8 ya no se cambia nada; en la 6 sí. De ese ensayo salen las oraciones de ayuda que faltan. ENTREGA: la clienta cambia cualquier texto y cualquier precio, sola, desde el celular. Es el 80% del valor.

### FASE 7 · ALTAS, BAJAS Y FOTOS (6-7 días)

El asistente de sabor con el cortador de ingredientes y el estado `pendiente`. El editor de lista único para recetas, preguntas, gotas y polvo. La pantalla de referencias con reasignación obligatoria. El recorte rectangular + enderezar, las derivadas con presupuesto y su camino de escape, y la comprobación en la rejilla del anaquel. El aviso único del «15» con [Cambiarlos todos]. Acá se descongelan los conteos (a auto-consistencia HTML↔dato + rango) y acá muere sabores[].clave: el color se resuelve en la fachada desde el arte + bandaAjuste, y de paso se arregla hierbabuena (4.41 → 4.67 con k=0.04, invisible a ojo). ENTREGA: alcance completo.

  *(diferida — fuera del alcance comprometido)*

### FASE 8 · ENTREGA (2 días)

docs/panel-operacion.md con el runbook —rotar el PAT, cerrar sesiones, sacar a alguien de la lista, y QUÉ HACER SI MAIN QUEDA ROTO—, «Algo se ve mal», pnpm estres corrido en Chrome a 320/768/1440 para ver si algún límite está mal medido, y la segunda sesión con la clienta sobre lo que ya se corrigió de la primera. ENTREGA: se entrega.

  *(diferida — fuera del alcance comprometido)*

---

# Riesgos residuales

- El PAT fine-grained es la llave del repo entero (Contents RW). Si se filtra —un log, una captura, un correo mal reenviado— cualquiera puede escribir en main. Mitigado: sin permiso de Workflows (GitHub rechaza por sí solo los pushes a .github/workflows/**), lista blanca de rutas del lado de la función, y vigilancia de expiración en accion=salud. NO mitigado: un atacante con el PAT no pasa por la función, así que la lista blanca no lo frena. El runbook tiene que decir cómo revocar y rotar en cinco minutos.

- La reversión automática por build fallido depende de la API de Vercel. Si el token de Vercel expira o el endpoint cambia, el modo de falla es que un commit malo se quede en main sin que nadie revierta, y la clienta vea «tardando» hasta el tope de 5 minutos. El correo a Marcos sigue saliendo, pero el destrabe pasa a ser manual.

- El bloque B de anti-desborde depende de la versión de Chrome, que decide el line-breaking y el `text-wrap: balance`. Como el veredicto es diferencial HEAD vs HEAD~1 y las dos mediciones corren en el MISMO runner con el MISMO Chrome, el riesgo está acotado a que un salto de versión mayor mueva la línea base de golpe — un correo rojo espurio, no un falso verde. Se acepta.

- El presupuesto de bytes en el navegador es un cálculo, no una garantía: `canvas.toBlob('image/webp', q)` no tiene el `-m 6` de cwebp y a igual calidad sale 10-30% más pesado. Medí que la barra más pesada de hoy son 63.6 KB contra un tope de 65. El camino de escape (publicar la mejor que consiguió + avisar a Marcos) evita rechazar la foto, pero deja la puerta abierta a que se acumulen imágenes fuera de presupuesto si Marcos no corre `pnpm imagenes`. El manifiesto lo hace visible; nadie lo hace imposible.

- Cuando la clienta agrega un sabor 16 sin ilustración y sin pliego, el sabor sale al aire mostrando la foto fija y sin visor 3D. Es una tarjeta visiblemente distinta de las otras quince en la única pantalla que ve todo el mundo, hasta que Marcos entregue las piezas. Es la decisión correcta (la alternativa es que el sabor espere a que Marcos tenga tiempo, que es el WhatsApp que el panel viene a matar), pero es una degradación visible y hay que decírselo con todas las letras en el asistente.

- El fixture congelado (test/fixtures/contenido-2026-09-08.json) es permanente y no mira contenido vivo, así que sobrevive a que la clienta edite. Pero envejece como documento: dentro de un año dirá «los precios eran 108 y 122» sobre un sitio donde son otros. Es lo que se quiere —es el acta de la migración— siempre que nadie lo confunda con la verdad de hoy. El README de test/fixtures/ tiene que decirlo en una línea.

- Si la fase 1 sale mal en producción, el camino de vuelta es `git revert` del commit de la migración: las tres fachadas vuelven a ser los módulos `as const` y el sitio queda exactamente como estaba. Es limpio porque la fase 1 no toca ningún .astro. Lo que NO tiene vuelta barata es la fase 2, que cambia el markup de index.astro: ahí el revert arrastra los ~200 spans y hay que reconstruir la línea base geométrica. Conviene que la fase 2 sea un commit solo y que se deje decantar unos días antes de la 3.

- Nada prueba el camino real contra la API de GitHub (blobs → tree → commit → PATCH con force:false, y el reintento por no-fast-forward, que es el pedazo más difícil del subsistema) sin desplegar. test/panel-publicar.test.ts prueba la lista blanca y los topes contra un doble. El primer despliegue de api/panel.ts es también la primera prueba real, y hay que hacerlo contra un repo de juguete antes que contra maracacao.

- El panel necesita internet para abrir. IndexedDB protege el trabajo a mitad de sesión, pero si en el mercado no hay señal, no hay panel. Se dice con todas las letras en vez de prometer offline. La alternativa (service worker) se rechazó por el riesgo de alcance sobre el sitio de producción; si algún día se hace, va en su propio origen, no en el de maracacao.mx.

> El riesgo de suspensión por uso comercial en Vercel Hobby quedó cerrado:
> Marcos ya tiene plan Pro.

---

# Preguntas abiertas

- BLOQUEANTE OPERATIVO, y va antes de la fase 5: ¿está maracacao.mx VERIFICADO en Resend (SPF+DKIM en el DNS), no solo cargada RESEND_API_KEY? Verifiqué que api/contacto.ts:99 cae a `Maracacao <onboarding@resend.dev>` si CONTACTO_REMITENTE no está, y con el dominio de prueba Resend solo entrega al correo del dueño de la cuenta. Señal fea: CONTACTO_DESTINO tiene como default maracacaomx@gmail.com — si esa NO es la casilla del dueño de la cuenta de Resend, el formulario de contacto está rechazado en silencio desde el lanzamiento y nadie se enteró. La prueba es de dos minutos: mandá un mensaje por el formulario a una dirección que no sea la tuya y fijate si llega. ¿Quién tiene las credenciales del registrador y cuánto tarda la propagación?

- ¿Firmás que la puerta principal del panel sea una CONTRASEÑA larga (guardada por el llavero del iPhone) y el enlace mágico quede como recuperación? Invertí el diseño anterior porque el enlace tiene un único punto de falla cuyo modo de falla es «llamarte a vos», que es lo que el panel viene a matar — y porque el enlace llega a la misma casilla donde caen los pedidos, y los 15 minutos se los come un cliente que interrumpe. Si preferís solo enlace mágico, decilo y lo saco, pero entonces la verificación del dominio pasa a ser bloqueante duro del proyecto entero.

- ¿Estás de acuerdo con la solución del PDF de fichas? No lo mato: `pnpm fichas` además escribe un sello con el sha256 de los datos, y la página apaga el botón «Descargar PDF» cuando el sello no coincide, dejando «Ver e imprimir». Un PDF viejo es posible; servirlo es imposible. El costo es que puede haber días donde el B2B no tenga el archivo y tenga que imprimir desde el navegador, hasta que vos corras el comando. ¿Preferís eso, o preferís matarlo del todo y ganar simplicidad?

- Con el panel, un cambio de precio deja de romper el build: se borran los asserts de 122/108, de 340/258, los 4 slugs sin producto, los conteos de gotas y polvo, y el `expect(marca.footer.lema).toBe(...)` con la frase textual del cliente. Todo eso queda congelado en el fixture de la migración, que es el acta, no la ley. ¿Confirmás? Es la consecuencia directa de «el cliente publica solo», pero conviene que quede dicho por escrito.

- ¿Qué correos van en PANEL_CORREOS además del tuyo? ¿maracacaomx@gmail.com? Y una pregunta que cambia el diseño del historial: ¿va a haber una tercera persona (una hermana, una empleada)? Si sí, el trailer Panel-Autor ya está previsto, pero también hace falta el aviso de «otra persona está editando desde hace 10 minutos», que hoy dejé como parte del borrador de dos capas.

- ¿Aceptás que un sabor nuevo salga al aire sin ilustración y sin pliego 3D, con la foto fija nomás, hasta que vos entregues las piezas? Es una tarjeta visiblemente distinta de las otras quince en la pantalla que ve todo el mundo. La alternativa es que el sabor espere a que tengas tiempo — o sea, el WhatsApp de siempre.

- Sobre los ingredientes cuando cambia la envoltura: propuse que la clienta pueda escribir el texto nuevo, que quede en estado `pendiente`, y que mientras tanto LA LÍNEA DE INGREDIENTES DESAPAREZCA de esa ficha —ni el viejo ni el nuevo—, con una tarjeta que te avisa. Es la falla segura, pero es una decisión sobre información regulada y no la firmo yo. ¿Te parece bien, o preferís que siga mostrando el texto viejo con una marca?

- ¿Firmás el corrimiento de color de banda? Cuando un sabor nuevo no llegue a 4.5 de contraste, el panel corre el color de la banda WEB hasta un 10% respecto del arte de imprenta; el hex exacto se guarda igual y se sigue usando para el punto de las gotas. Es defendible (la superficie web no es la envoltura) pero es una decisión de marca. Y de paso: hoy hierbabuena da 4.41 medido y está declarada `saboresSoloDisplay` en src/tokens/color.ts:182, o sea que el CSS «no debe» poner texto normal encima — pero el anaquel sí lo hace cuando ella elige hierbabuena. ¿Querés que lo arregle con k=0.04 (#6F8473 → #748877, 4.41 → 4.67, invisible a ojo) y saque la excepción?

- El sitio es comercial y está en Hobby. Este diseño le monta encima un CMS autenticado con un PAT de escritura sobre el repo, y si Vercel suspende la cuenta se caen el sitio, el panel y el formulario juntos. No lo crea este diseño —la exposición ya existe— pero lo vuelve más caro. ¿Pasás a Pro antes de la fase 5, o lo asumís por escrito?

- Dos cosas que decidiría yo si me dejás, y las digo para que no te sorprendan: (a) el `sabores[].clave` acoplado a los tokens de color muere en la fase 7 y `--mrc-sabor-canela` pasa a `--mrc-sabor-inicial`; (b) verifiqué que los `data-astro-cid-*` NO dependen del contenido del componente (agregué un comentario a un `<style>`, reconstruí, quedaron idénticos: son hash de la RUTA), así que la regla de «no tocar .astro en la fase 1» se mantiene por higiene de señal y no por lo que decía el diseño anterior. Si conocés algún otro motivo para no tocar .astro en ese commit, decímelo antes.

---

# Apéndice A · Correcciones aplicadas tras la crítica adversarial

El diseño se ensambló a partir de seis diseños independientes y se sometió a
tres críticos en paralelo (factibilidad de plataforma, la clienta usándolo, y
«cómo rompe esto el sitio»). Esto es lo que cambió:

- BLOQUEANTE — recursión del build. REPRODUCIDO: `npx vitest run` imprime un `astro build` completo (11 páginas + sitemap) dentro de los 677 tests, por test/css-tokens.test.ts:67. Se invierte el orden en vez de blindar el test: `build:sitio` = `astro build`, `verifica` = `vitest run && astro check`, `build` = `pnpm build:sitio && pnpm verifica`. css-tokens deja de construir y LEE dist/index.html (se salta con mensaje si no existe). Más `test/meta.test.ts` que grepea `pnpm build` dentro de test/ y falla.

- BLOQUEANTE — la biyección uno-a-uno es falsa. MEDIDO contra dist/index.html sobre las 321 hojas de `marca`: 171 con una aparición, 118 con 2+, 32 con ninguna. El mapeo pasa a uno-a-muchos: `data-campo` puede repetirse, `inyecta.ts` usa querySelectorAll y parchea todos los nodos, el medidor se queda con el peor, y el test es «≥1 nodo en alguna de las 4 páginas» más «todo data-campo del HTML existe en el esquema», en los dos sentidos y por página.

- BLOQUEANTE — `prepararDocumento()` revelando las 15 fichas. MEDIDO en Chrome a 1440px: `.chips` = 407 px con una ficha revelada (idéntico en los quince) contra 331/444/633 px con las quince. Se revela de a una. Y como los quince dan el mismo número, alcanza con medir una. Más un test que compara las dos mediciones y falla si difieren más de 1 px.

- BLOQUEANTE — `set:html={JSON.stringify(datosAnaquel)}` sin escapar más `JSON.parse` sin try en marca.ts:187. Un `</script` en cualquier campo de sabor mata el módulo entero y deja los 6 pasos de «Cómo catar» invisibles para siempre (`html.js [data-revelar]{opacity:0}`, index.astro:408). Tres arreglos en la FASE 0 porque es un bug de producción hoy: escapar `<` a `<`, try/catch con las 15 fichas visibles como degradado, y un test que hace JSON.parse del `#datos-anaquel` renderizado. Más regla de esquema que prohíbe `<` en todo campo que viaje a set:html o al JSON-LD.

- BLOQUEANTE — el enlace mágico como única puerta. Verificado que api/contacto.ts:99 cae a `onboarding@resend.dev`. La contraseña larga con `autocomplete=current-password` (llavero de iOS) pasa a puerta principal, verificada contra un hash scrypt en `PANEL_CLAVE_HASH` con comparación de tiempo constante y tope de 5 intentos por IP; el enlace mágico queda como recuperación. Sesión de un año en el dispositivo marcado «mi celular». Prueba de humo de Resend a una casilla que NO sea la del dueño de la cuenta, en la fase 0.

- BLOQUEANTE — la lista de conteos congelados estaba armada a ojo. La auditoría test por test de los 26 archivos pasa a ser tarea propia de la fase 0, con entrega escrita (docs/tests-que-congelan-contenido.md), ANTES de tocar el script de build. Ya sumé nueve casos que no estaban: sitio.test.ts:77 ($108 en el HTML), :57, :169-171 (wordmark interpolado crudo asumiendo texto pegado al `>`), marca-copy:118-127 (5 archivos por sabor), :191 (el lema exacto), :53 (lee docs/envolturas.json), seo:208, fichas:60 y :79. Y `contenido-mutaciones.test.ts` incluye «cambiar un precio» corriendo el build ENTERO, no solo validar().

- BLOQUEANTE (crítico cliente) — el build falla y el commit queda en main. La función, que ya sondea el deploy, arma un commit de reversión por el mismo camino y con la misma validación, y le dice «no pude publicar esto, lo dejé como estaba y ya le avisé a Marcos». A Marcos le llega el log por correo. `PANEL_VERCEL_TOKEN` pasa a obligatorio porque sin él no se puede saber que falló.

- BLOQUEANTE (crítico cliente) — los ingredientes no se podían corregir nunca. Pasan a `{texto, estado: 'verificado'|'pendiente'}`. Pendiente = la línea desaparece del sitio (ni el viejo ni el nuevo) y queda como tarjeta con «Avisarle a Marcos». Resuelve de una el mismo hueco para el sabor 16, que no tiene arte en el sistema porque extrae-envolturas.py es Python y corre en la máquina de Marcos.

- SERIA — el medidor no neutralizaba transforms. Sexto paso en prepararDocumento(): `transform: none !important` en todo y `.visto` a todo `[data-revelar]`. Verificado que hay transforms en slots apretados: `.sello-pronto` con rotate(-4deg) (index.astro:1303), la marquesina del hero con rotate(-3deg) y `html.js [data-revelar]` con translateY(18px). Más un caso de prueba en el bloque B que mide el chip rotado con un texto conocido-bueno y exige verde.

- SERIA — el diferencial existía en el panel y no en CI. El bloque B mide HEAD y HEAD~1 y compara entre sí; no hay archivo congelado. `astro build` completa en 983 ms medidos, así que construir dos veces es gratis. Con eso desaparecen `medidas.generated.json`, el guard de frescura y su bug de hashear la entrada equivocada.

- SERIA — tres iframes en el celular. Uno solo, redimensionado en serie (mismos números). En vivo se mide solo 320 px; los tres anchos se barren al apretar Publicar, que ya hace la pasada completa. Medido lo que había en juego: 209 KB de HTML, 88 img, 935 KB de model-viewer, 266 KB de GLB por copia.

- SERIA — sin maxDuration ni presupuesto de round-trips. `"functions": {"api/panel.ts": {"maxDuration": 60}}` en vercel.json (Hobby llega a 60 s). Los topes se redefinen sobre lo que realmente viaja: las imágenes ya subieron al ref de borrador una por una, así que publicar son ~7 llamadas, no 43. TOPE_CUERPO 3.5 MB, aplicado sobre el cuerpo (base64) y no sobre el binario.

- SERIA — `functions.includeFiles` no arregla el tracing de imports. Plan B escrito al lado: `scripts/bundle-api.ts` con esbuild produce un `api/panel.js` autocontenido. Se decide con el experimento más barato: en la fase 5, primero api/contacto.ts importando `../src/servidor/origen`. Confirmado además que `zod` NO está en node_modules/ raíz hoy (solo en .pnpm/zod@4.4.3), así que pasarlo a dependencies es obligatorio, no opcional.

- SERIA — el correo estaba en más lugares de los que el diseño listaba. Verificados cinco: nav.pie[1], negocios.correo, contacto.correo, DENTRO del texto de preguntas.items[7].r («Escríbenos a maracacaomx@gmail.com y lo resolvemos contigo») y `CONTACTO_DESTINO` en api/contacto.ts:93. Se saca de la FAQ (la plantilla lo pone, como ya hace negocios.correoEtiqueta) y api/contacto.ts lee el destino de datos/sitio.json — mismo movimiento que ya va a hacer para importar origen.ts. Más un test: el correo no aparece como literal en ningún string de copy salvo los campos declarados.

- SERIA — test/marca-copy.test.ts:118-127 exige cinco archivos por sabor y no estaba en la lista de tests tocados. Se reescribe: barra + mini + mini-300 siempre; ilustración y pliego solo si el registro los declara. Más index.astro renderizando la ilustración condicionalmente (hoy va incondicional: sin archivo queda una imagen rota con alt) y try/catch en el `aplica()` del visor 3D (hoy un pliego faltante deja la barra 3D con la textura del sabor ANTERIOR).

- SERIA — el espacio duro solo estaba cubierto en 1 de 8 campos. Verificado: 9 apariciones de ` ` en 8 campos, y solo pesoInsignia es «cifra + unidad». Regla de esquema en los otros siete: `/\d\s(g|kg|ml|l|°C)\b/` con espacio normal = 'impide', con el arreglo ofrecido con un botón.

- SERIA — `'chipPolvo' in r`. Verificado en zod 4.4.3: `z.string().optional()` sobre `{chipPolvo:''}` devuelve el objeto CON la clave. Dos arreglos: la fachada pasa a truthy (`r.chipPolvo`) y `t.precio == null`, y el panel BORRA la clave al vaciar un campo opcional en vez de escribir ''.

- SERIA — la regla del renglón 2 del titular. Verificado que index.astro:145 hace `.replace(',','')`, que saca la PRIMERA coma: '70% CACAO, DE VERDAD,' pasaba la regla «termina en coma» y renderizaba doble coma en el h1. La regla pasa a `/^[^,]+,$/` y el render a `.slice(0,-1)`.

- SERIA — el guard de frescura hashea la entrada equivocada. Desaparece entero junto con medidas.generated.json. La objeción quedó igual documentada porque era correcta: con `inlineStylesheets:'always'` y Tailwind v4, el CSS compilado depende del contenido de las plantillas, y la lista omitía global.css (el preflight), Base.astro y 2 de los 6 componentes con `<style>`.

- SERIA — el presupuesto de bytes atado a la posición en la lista. Verificado que barra-cardamomo-mini.webp pesa 29.9 KB y cardamomo es el 12: moverlo al 3 tiraría el deploy por reordenar. Un solo tope de 32 KB para todas las minis. Y camino de escape obligatorio: si la búsqueda binaria de calidad no llega, se publica la mejor que consiguió con aviso a Marcos, nunca se rechaza la foto de la clienta.

- SERIA — vocabulario.ts prohibía la palabra «Borrador» al propio panel. Se parte en dos listas: MARCA (aplica al copy y a los mensajes del panel) y MAQUETA (Borrador, PENDIENTE, te avisamos — solo al sitio publicado).

- SERIA — el contraste no era regla de esquema. Pasa a `.superRefine` sobre el par (banda, tinta) con el `contrastRatio` que ya está en el repo y es puro, heredando la excepción declarada `saboresSoloDisplay` de src/tokens/color.ts:182 por slug. Medido: hierbabuena da 4.41 hoy.

- SERIA — el borrador se pisaba entre dispositivos y personas sin avisar. Lleva dispositivo y hora; al abrir, si el del servidor es más nuevo, pregunta cuál con los dos resúmenes en español; si hay dos personas, avisa que la otra está editando.

- SERIA — cómo señala un campo con el dedo en 375 px. Tocar y mantener sobre la vista previa abre la lista de los 3-4 campos más cercanos, con su texto y su nombre. No hay que acertar el píxel.

- SERIA — con el teclado abierto no entraba nada. La ficha se colapsa a dos cosas: la caja donde escribe y la miniatura del slot, con la regla como una línea de color de 4 px. Todo lo demás se pliega y vuelve al cerrar el teclado.

- SERIA — el bloqueo geométrico terminaba en una pared. Cuando bloquea: el iframe muestra el desborde señalado, más un botón «Pedirle a Marcos que entre este texto» que le manda campo, texto, captura y medidas. Y «no pude revisar» deja de ser una frase genérica: nombra el campo, lleva ahí con el resaltado puesto, y deja publicar todo lo demás.

- SERIA — no había deshacer después de publicar. Botón grande «Deshacer esta publicación» durante 30 minutos en la MISMA pantalla del estado. Más un aviso de sentido común cuando un precio se mueve más de ±40%: «pasó de $122 a $1,300 — ¿seguro?».

- SERIA — publicar y no enterarse de cómo terminó. Correo cuando termina, bien o mal, y lo primero que se ve al reabrir el panel es el resultado de la última publicación, no un tablero limpio. Más un botón «Ver mi sitio» que saltea el caché, como última cosa al terminar.

- SERIA — las imágenes de producto con medidas mentidas. Verificado con un lector de cabecera WebP que escribí y corrí acá: barra-limoncillo y barra-menta-intensa son 754×1566 (minis 380×789 y 300×623) contra los 754/1617 y 380/815 que declara index.astro y el `aspect-ratio: 754/1617` de model-viewer — se estiran 3.26%; y las 15 ilustraciones declaran 400/450 y van de 400×400 a 400×705. `src/imagenes/manifiesto.json` reemplaza los literales.

- MENOR — `data-astro-cid-*` no sale del contenido del componente. LO VERIFIQUÉ: agregué un comentario dentro del `<style>` de Insignia.astro, reconstruí, y los seis cid quedaron idénticos. Es hash de la ruta del archivo. La «regla del commit» de la fase 1 se mantiene por higiene de señal, con la justificación buena: `colorSabor[s.clave]` con `keyof typeof sabor` y `--mrc-sabor-canela` en marca.css son lo que hace cara la migración temprana de `clave`.

- MENOR — los campos que son atributo no tenían mecanismo. `enAtributo` en el metadato más `data-campo-attr="alt:anaquel.ilustracionAltPrefijo"` en el HTML, con `falla:['ninguno']`: no se miden y el panel no dice «no pude revisar» sobre ellos. Cubre marquesinaAria, los alt, los aria-label, `data-copiar`, y marca.titulo/descripcion del `<head>`. Más el caso especial del correo del pie, que se renderiza partido por un `<wbr>` (index.astro:748).

- MENOR — el CSP para /panel se hereda al iframe. Verificado `inlineStylesheets: 'always'` en astro.config.mjs y un `<script is:inline>` en index.astro:83: un CSP sin unsafe-inline deja la vista previa en blanco sin error visible. Se saca el CSP; quedan noindex y Referrer-Policy.

- MENOR — el autosave y la pregunta abierta de Branch Tracking. `refs/panel/borrador` desde el día uno: Vercel no mira refs fuera de refs/heads/, la pregunta abierta desaparece entera.

- MENOR — el arranque del anaquel clavado en tres lugares. Verificados los tres: index.astro:33 (`find(slug==='canela')!` con non-null assertion), marca.ts:202 (`?? 'canela'`) y marca.css:101-102 (`--mrc-sabor-canela`). Un campo `anaquel.saborInicial` (oculto, de Marcos) consumido por los tres, adelantado a la FASE 2 porque saca una aserción `!` y una bomba de relojería.

- MENOR — la interpolación cruda de regex restringía el vocabulario de la clienta por un problema de los tests. Se escapan los cuatro (sitio:169-171, seo:208, fichas:60 y :79) con una función `esc()` de una línea, y se les agrega `>\s*` para que envolver el texto en un span no los rompa. Con eso la clienta puede escribir «Lima (con chile)» y «Fresas & chile»; lo único que queda prohibido es `<`, y por la razón buena (§0.2).

- MENOR — envolturas.json duplicado. Se MUEVE a src/contenido/datos/envolturas.json, extrae-envolturas.py escribe ahí, el de docs/ se borra (no «con una nota adentro»: las notas no las lee nadie) y marca-copy.test.ts:53 se actualiza.

- MENOR — la fila de energía de las tablas nutrimentales. Verificado que es `['Contenido energético', '600 kcal / 2,510 kJ']`, una celda compuesta que ninguno de los siete controles representa. Se modela como `{kcal: number}` con el kJ calculado y el string armado por la plantilla.

- MENOR — el historial no decía quién publicó. Trailer `Panel-Autor: <correo>` en el commit, y el nombre en el historial.

- MENOR — reordenar por arrastre accidental. Solo detrás de un botón explícito «Cambiar el orden».

- MENOR — el índice decía 12 secciones y la home tiene 10 más el pie. La lista se deriva del propio HTML (`main > section[id]` y sus h2) en orden de scroll, no se escribe a mano.

- MENOR — `paqueteSeis` está importado en index.astro:25 y no se usa en ningún lado. Se borra del módulo y del import, junto con selloAlt, anaquel.verTodas y footer.wordmarkAlt (0 apariciones medidas en el HTML).

---

# Apéndice B · Críticas rechazadas

- RECHAZO «el golden HTML es sobreingeniería porque el fixture, serializa() y migra-contenido.ts ya prueban lo mismo tres veces». La conclusión la acepto, el razonamiento no: ninguno de esos tres prueba que LA FACHADA re-exporte el mismo objeto. El JSON puede estar perfecto y la fachada devolver undefined donde había valor, reordenar un array o coercer un número. Por eso el golden no se borra a secas: se reemplaza por algo estrictamente más fuerte y permanente — un deep-equal de los objetos exportados contra el fixture (3 aserciones) más 8 aserciones de forma sobre las expresiones de index.astro que dependen de la forma y no del valor. Si hubiera aceptado el razonamiento tal cual, habría quedado un hueco real en el certificado de la migración.

- RECHAZO «estado.ts con la API de Vercel es sobreingeniería: version.json solo responde la única pregunta que le importa a la clienta». version.json puede decir «todavía no», nunca «nunca»: no distingue tardar de fallar. Y en cuanto la reversión automática por build fallido pasa a ser un arreglo de bloqueante —lo es, porque el commit de la clienta queda en main y bloquea también a Marcos—, saber que el deploy falló es la condición para que funcione. El token de Vercel pasa de opcional a OBLIGATORIO, en la dirección contraria a la crítica. El otro crítico llegó a la misma conclusión por el lado de la clienta: publicar a ciegas es peor que no publicar.

- RECHAZO PARCIALMENTE «matar el PDF es una decisión de negocio, que la firme el cliente». La observación comercial es correcta y la incorporo. Pero las dos alternativas ofrecidas —matarlo, o regenerarlo en Actions y commitearlo— son las dos malas: la segunda mete un commit automático a main que compite con los pushes del panel, dispara un segundo deploy por publicación, necesita path filters para no autotriguerearse, y dos publicaciones en un minuto se pisan. Hay una tercera que ninguno de los dos críticos propuso: `public/fichas/.sello.json` con el sha256 de los datos, y el botón «Descargar PDF» que se apaga solo cuando el sello no coincide. Un PDF viejo es posible; un PDF viejo SERVIDO es imposible. Chrome queda en la máquina de Marcos, el build nunca falla por esto, y el B2B conserva el archivo.

- RECHAZO «un service worker que guarde la cáscara del panel y el último HTML de la home». El panel se sirve del MISMO origen que maracacao.mx. Un service worker registrado desde /panel con el alcance mal puesto puede terminar sirviendo HTML viejo a los visitantes reales del sitio, y el modo de falla es invisible y difícil de revertir (hay que desregistrarlo desde el propio SW). El riesgo real que la crítica identifica —perder trabajo— ya lo cubre IndexedDB. Lo que sí acepto es la mitad honesta: el panel dice con todas las letras «necesita internet» en vez de prometer offline.

- RECHAZO «la baja en dos etapas con espera de 30 días es sobreingeniería, pero también rechazo la parte de la pantalla de referencias». Acepto matar el «Eliminar para siempre» con espera y escribir el nombre —la clienta nunca lo va a usar y Marcos puede hacer la limpieza una vez por año—, pero la PANTALLA DE REFERENCIAS antes de quitar del sitio se queda entera y encima se endurece: index.astro:33 hace `sabores.find(s => s.slug === 'canela')!` con non-null assertion, así que quitar el sabor que abre el anaquel sin reasignar es un crash de build, no un detalle de experiencia. La reasignación es obligatoria, no un aviso.

- RECHAZO «numeroEnLetras() es sobreingeniería para un solo campo: marcá marquesinaAria como quien:'marcos'». Marcarlo de Marcos significa que el día que la clienta agregue el sabor 16, el aria-label de la marquesina va a seguir diciendo «los quince sabores» y nadie se va a enterar — es exactamente la clase de desincronización silenciosa que el resto del diseño persigue. La solución barata no es sacarle el campo: es que `numeroEnLetras` sea una tabla de 1 a 20 dentro de conteos.ts, unas seis líneas, y no un módulo listado en la arquitectura. Lo que sí acepto es que dejó de ser una «pieza de la arquitectura».

- RECHAZO «no activar la compuerta de build hasta la fase 5». Ninguna crítica lo pidió explícitamente, pero es la lectura natural del orden de trabajo anterior, y es al revés: la compuerta se instala en la FASE 0, mientras el contenido todavía está congelado y verde. Instalarla en la fase 5, cuando el panel ya empuja commits, es estrenar una compuerta con tráfico real encima. Y el arreglo de la recursión tiene que estar probado en Vercel —incluyendo que los 677 tests corran en su contenedor de build, con @resvg/resvg-js nativo y el execFileSync de render.test.ts— antes de que nada dependa de ella.

- RECHAZO la afirmación de que «hero.titular.1 sale CERO veces porque index.astro:144 le saca la coma» sea solo un problema de biyección. Lo confirmé (aparece 0 veces), pero la consecuencia importante es otra y ninguna crítica la sacó del todo: como el render y la regla de validación describen operaciones distintas (`.replace(',','')` saca la PRIMERA coma, la regla exigía «termina en coma»), un texto con dos comas pasa la validación y produce «,,» en el h1 de la portada. El arreglo no es solo de test: es la regla `/^[^,]+,$/` MÁS cambiar el render a `.slice(0,-1)`.

- RECHAZO «medir a 320 y a 1440 nomás — ninguno de los modos de falla es exclusivo de 768». Acepto medir uno solo en vivo, pero no borrar 768 del barrido de Publicar. Las pestañas de negocios (`flex` sin wrap, con el modo de falla `fila-sin-corte`) fallan en el ancho donde la fila deja de entrar, y ese ancho depende del contenido: no está garantizado que sea 320 ni 1440. Como el barrido de Publicar cuesta tres redimensionadas de un iframe que ya está cargado, el ahorro no compensa el hueco.

