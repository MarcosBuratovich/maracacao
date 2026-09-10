/*
 * El catálogo de campos del sistema.
 *
 * Cada campo del contenido se declara con uno de estos constructores, y
 * todos EXIGEN etiqueta, sección y ayuda en español. No es burocracia: el
 * panel se pinta leyendo este registro, así que un campo sin etiqueta
 * sería un input mudo. Que el tipo lo exija significa que no se puede
 * agregar un campo al sitio y olvidarse de explicárselo a la clienta.
 *
 * Este archivo corre en tres lugares (navegador, función serverless y
 * vitest), así que no toca `node:*`, ni Astro, ni el alias `@/`.
 */
import { z } from 'zod'
import { palabraProhibida } from './vocabulario'
import { sabor } from '../tokens/color'

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

/** Las secciones tal como las va a ver la clienta en el panel. */
export type Seccion =
  | 'portada'
  | 'productos'
  | 'sabores'
  | 'negocios'
  | 'recetas'
  | 'nosotros'
  | 'catar'
  | 'preguntas'
  | 'contacto'
  | 'pie'
  | 'fichas'
  | 'buscadores'
  | 'accesibilidad'
  /** La página que se ve cuando un enlace está roto. */
  | 'no-encontrada'

/**
 * Cómo se rompe el slot si el texto no entra. Lo usa el medidor (fase 4)
 * para decidir qué mirar; 'ninguno' es para los campos que no se ven
 * (alt, aria, el <head>).
 */
export type ModoFalla = 'nowrap' | 'fila' | 'renglones' | 'alto' | 'ninguno'

export interface MetaCampo {
  /** «Renglón 2 del titular». Lo lee la clienta. Obligatorio. */
  etiqueta: string
  seccion: Seccion
  /** La oración de «dónde vive esto en la página». Obligatoria. */
  ayuda: string
  /** Quién lo edita. Default: la clienta. */
  quien?: 'cliente' | 'marcos'
  control?:
    | 'texto' | 'parrafo' | 'precio' | 'medida' | 'renglones'
    | 'lista' | 'foto' | 'regulado' | 'derivado' | 'oculto'
  // Los tres «máximos» del sistema van con nombres distintos a propósito.
  // `max` solo significaba caracteres en `texto`/`parrafo`/`medida`, valor
  // numérico en `numero`, y CANTIDAD DE ELEMENTOS en `lista` — tres cosas
  // bajo una palabra. La fase 2 pinta el panel leyendo este metadato: un
  // widget que lea `meta.max` y escriba «tope de seguridad de 2
  // caracteres» sobre una lista de 2 elementos es el bug garantizado, y
  // ninguna herramienta lo iba a atajar porque el tipo era el mismo
  // `number`. Lo mismo pasaba con `de`, que era un `ZodType` en `lista` y
  // una ruta en `derivado`.
  //
  // Se separan ACÁ, con 18 llamadas: la Parte B escribe ~900 líneas contra
  // esta API y después son cientos.

  /**
   * Cuántos CARACTERES entran. TECHO DE CORDURA, no el límite de diseño.
   * Generoso a propósito: si el texto entra o no lo decide el medidor
   * midiendo la página de verdad (fase 4), porque 31 «W» miden 426 px y 31
   * «i» miden 142 px. El panel lo dice con esas palabras: «tope de
   * seguridad», no «cabe».
   */
  maxCaracteres?: number
  /** El VALOR numérico más chico y el más grande que acepta el campo. */
  minValor?: number
  maxValor?: number
  /** Cuántos ELEMENTOS puede tener la lista: ni uno menos, ni uno más. */
  minItems?: number
  maxItems?: number
  // Los tres que siguen guardan ESQUEMAS, y van tipados `unknown` a
  // propósito: `MetaCampo` es el parámetro de `z.registry<MetaCampo>()`, y
  // meter un `z.ZodType` adentro le pide a TypeScript que instancie el
  // tipo del registro contra el tipo de los esquemas que registra —
  // «Type instantiation is excessively deep», verificado contra zod 4.4.3
  // y typescript 6.0.3. No se pierde nada real: el panel saca la forma del
  // árbol con `recorre()`, que la lee del esquema; esto queda como la
  // constancia de con qué se construyó el campo.
  /** El esquema de CADA elemento de una `lista`. */
  elemento?: unknown
  /** Los campos nombrados de un `grupo`. */
  campos?: unknown
  /** Las partes de una `tupla`, en orden y en cantidad fija. */
  partes?: unknown
  /**
   * La lista cerrada de valores que acepta el campo. La usan `opcion` (las
   * dos opciones del formulario) y `tokenColor` (los tokens de color
   * declarados). Era el mismo concepto con dos nombres —`valores` y
   * `validos`— y el panel dibuja el selector leyendo esta clave: con el
   * nombre equivocado no dibuja nada, sin excepción y sin error de tipos.
   */
  valores?: readonly string[]
  /** De dónde sale el valor de un `derivado`. El panel lo dibuja en gris. */
  saleDe?: string
  /** El ':' o el '.' que agrega la plantilla. El panel lo dibuja gris. */
  sufijo?: string
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
  /** Rutas hermanas que reciben el mismo valor (el correo vive en cuatro). */
  escribeTambien?: string[]
  /** Cómo nombrar un elemento de lista en el panel («Receta: peras al vino»). */
  nombra?: (v: unknown) => string
  falla?: ModoFalla[]
  /** Vive en un atributo, no en un nodo de texto: 'alt', 'aria-label'… */
  enAtributo?: string
  /** Se renderiza en versales; el medidor tiene que medirlo así. */
  mayusculas?: boolean
}

/**
 * El registro. OJO: `registry.get()` sigue la cadena de padres, así que
 * anotar una base compartida le pone esa etiqueta a todo lo derivado de
 * ella. Por eso `anota()` recibe siempre el esquema TERMINADO.
 */
export const panel = z.registry<MetaCampo>()

const anota = <T extends z.ZodType>(esquema: T, meta: MetaCampo): T => {
  panel.add(esquema, meta)
  return esquema
}

// El mensaje por default de zod para `.max()` es en inglés y habla de
// «string» y «characters»: jerga de tipos que la clienta jamás pidió leer.
// Este texto es el que de verdad va a ver ella cuando se pase de largo.
const mensajeMax = (max: number) =>
  `Te pasaste del tope de seguridad de ${max} caracteres.`

/** Lo que cumple TODO texto visible, sea cual sea su forma. */
const reglasDeTexto = (base: z.ZodString) =>
  base
    .refine((v) => v.trim().length > 0, 'No puede quedar vacío.')
    // El brief original pasaba una función como segundo argumento de
    // `.refine()` para armar el mensaje con la palabra encontrada. Verificado
    // contra zod 4.4.3: esa firma no existe (ni compila: TS espera
    // `string | $ZodCustomParams`) y en runtime el mensaje queda en
    // «Invalid input», en inglés y con la palabra que una tarea posterior
    // prohíbe. `superRefine` + `ctx.addIssue` es la forma soportada para un
    // mensaje que depende del valor.
    .superRefine((v, ctx) => {
      const palabra = palabraProhibida(v)
      if (palabra !== null) {
        ctx.addIssue({ code: 'custom', message: `La marca no usa la palabra «${palabra}».` })
      }
    })
    .refine(
      (v) => !/\$\s?\d/.test(v),
      'El precio no se escribe adentro del texto: tiene su propio campo.',
    )

type Base = Omit<MetaCampo, 'control'>

/** Una línea de texto. El caso normal. */
export const texto = (meta: Base & { maxCaracteres: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.maxCaracteres, mensajeMax(meta.maxCaracteres))),
    { control: 'texto', ...meta },
  )

/** Varias oraciones: un párrafo de «Nosotros», la respuesta de una pregunta. */
export const parrafo = (meta: Base & { maxCaracteres: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.maxCaracteres, mensajeMax(meta.maxCaracteres))),
    { control: 'parrafo', ...meta },
  )

/**
 * Las unidades que el sitio escribe pegadas a una cifra. Agregar una acá
 * la agrega en los DOS lados a la vez: la regla que rechaza y el botón que
 * arregla salen de esta misma lista (ver `cifraUnidad`).
 *
 * El orden importa: la alternancia del regex prueba de izquierda a
 * derecha, así que las unidades largas van ANTES que sus prefijos («kg»
 * antes que «g», «ml» antes que «l»).
 */
export const UNIDADES_DE_MEDIDA = ['g', 'kg', 'ml', 'l', '°C'] as const

/**
 * «Una cifra, un espacio que NO es el duro, y una unidad»: la forma MAL
 * escrita de una medida.
 *
 * Esta regla se escribía DOS veces —acá y en `validacion.ts`—, una para
 * rechazar y otra para ofrecer el arreglo de un toque. Estaban alineadas
 * de casualidad y nada las mantenía así: agregar `mm` a una y olvidar la
 * otra le deja a la clienta un campo que se rechaza y sin el botón que lo
 * arregla, y no cae ningún test. Ahora las dos salen de acá.
 *
 * Es una FÁBRICA y no una constante compartida por una razón concreta: un
 * regex con el flag `g` guarda `lastIndex` entre llamadas, así que una
 * sola instancia usada para `.test()` y para `.replace()` hace que la
 * pregunta siguiente arranque desde la mitad del texto y conteste que no.
 * Cada uso pide la suya, con las banderas que necesita.
 *
 * El grupo 1 captura la cifra porque `validacion.ts` reemplaza con
 * «$1\u00a0$2»; a `.test()` no le molesta que esté.
 *
 * `\s` (la versión original) matchea TAMBIÉN el espacio duro (U+00A0):
 * con esa clase, la regla rechazaba por igual el valor bien escrito y el
 * mal escrito, así que NINGÚN valor de `medida` podía pasar nunca.
 * `[^\S\u00a0]` es «espacio en blanco que no sea el duro» — y va con el
 * ESCAPE, nunca como carácter literal pegado en el código: un espacio duro
 * tipeado a mano es frágil, un editor o un copiar-y-pegar lo puede
 * normalizar a uno común sin que nadie lo note, que es exactamente este
 * bug, movido de lugar. Verificado con los tres casos: cadena con U+00A0
 * real → no matchea (válida); con espacio normal → matchea (inválida); con
 * tab → matchea (inválida).
 */
export const cifraUnidad = (banderas = ''): RegExp =>
  new RegExp(`(\\d)[^\\S\\u00a0](${UNIDADES_DE_MEDIDA.join('|')})\\b`, banderas)

// Sin `g`: esto solo pregunta. Así no hay `lastIndex` que se filtre entre
// una validación y la siguiente.
const MEDIDA_MAL_ESCRITA = cifraUnidad()

/**
 * Cifra + unidad, con espacio duro: «70 g», «250 g».
 *
 * Si la clienta retoca esto en un input común, el espacio duro se vuelve
 * uno normal y en el celular la «g» queda sola en el renglón siguiente.
 * El panel le ofrece el arreglo con un botón; ella nunca se entera de
 * que el espacio duro existe, que es lo correcto.
 */
export const medida = (meta: Base & { maxCaracteres: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.maxCaracteres, mensajeMax(meta.maxCaracteres))).refine(
      (v) => !MEDIDA_MAL_ESCRITA.test(v),
      'Entre el número y la unidad va un espacio que no parte el renglón.',
    ),
    { control: 'medida', ...meta },
  )

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

/** Un valor de una lista cerrada (el `valor` de las opciones del formulario). */
export const opcion = <const V extends readonly [string, ...string[]]>(
  meta: Base & { valores: V },
) => anota(
  // Aunque el panel solo ofrece estos valores por un selector, el mensaje
  // por default de zod dice «Invalid option» — inglés y la palabra exacta
  // que una tarea posterior prohíbe. Un mensaje propio no cuesta nada.
  z.enum(meta.valores, 'Ese valor no está en la lista permitida.'),
  { control: 'oculto', quien: 'marcos', ...meta },
)

// El precio es un ENTERO acotado: la misma terna de reglas (no-entero,
// muy chico, muy grande) y los mismos tres mensajes sirven para `precio`
// y para `precioONada`, así que viven en un solo lugar. `z.int()` ya
// rechaza por igual un string («108») y un decimal (108.5) con el MISMO
// código de error, así que un solo mensaje cubre los dos casos del test.
const mensajesPrecio = {
  entero: 'El precio va en pesos enteros, sin decimales ni signos: escribí 108, no $108.50.',
  chico: 'El precio tiene que ser mayor a cero.',
  // El techo no es de diseño, es de cordura: agarra el cero de más que
  // ninguna otra regla ataja (la bandeja de publicar además avisa por
  // saltos grandes).
  grande: 'Ese precio es demasiado alto: revisá que no tenga un cero de más.',
}

/**
 * Un precio en pesos. ENTERO: `precioMXN` lo formatea, y un decimal acá
 * sale como «$108.5» en la página. El techo de 99.999 no es capricho —
 * un cero de más es un número perfectamente válido y ninguna otra regla
 * lo ataja (la bandeja de publicar además avisa por saltos grandes).
 */
export const precio = (meta: Base) =>
  anota(
    z.int(mensajesPrecio.entero)
      .min(1, mensajesPrecio.chico)
      .max(99_999, mensajesPrecio.grande),
    { control: 'precio', ...meta },
  )

/** Un precio que puede no existir todavía (el polvo dice «Próximamente»). */
export const precioONada = (meta: Base) =>
  anota(
    z.int(mensajesPrecio.entero)
      .min(1, mensajesPrecio.chico)
      .max(99_999, mensajesPrecio.grande)
      .nullable(),
    { control: 'precio', ...meta },
  )

/** Un número que no es plata (el `orden` impreso de la serie). */
export const numero = (meta: Base & { minValor: number; maxValor: number }) =>
  anota(
    z.int('Tiene que ser un número entero.')
      .min(meta.minValor, `Tiene que ser mayor o igual a ${meta.minValor}.`)
      .max(meta.maxValor, `Tiene que ser menor o igual a ${meta.maxValor}.`),
    { control: 'oculto', quien: 'marcos', ...meta },
  )

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

/** Igual que claveSabor pero para cualquier token de color declarado. */
export const tokenColor = (meta: Base & { valores: readonly string[] }) =>
  anota(
    z.string().refine((v) => meta.valores.includes(v), 'No es un token de color del sistema.'),
    { control: 'oculto', quien: 'marcos', ...meta },
  )

/** Una ruta interna: '/fichas-tecnicas'. */
export const ruta = (meta: Base) =>
  anota(z.string().regex(/^\/[\w\-/]*$/, 'Tiene que empezar con «/».'), {
    control: 'oculto', quien: 'marcos', ...meta,
  })

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

/** Una dirección web completa. */
export const url = (meta: Base) =>
  anota(z.url('No es una dirección web válida.'), { control: 'oculto', quien: 'marcos', ...meta })

/** Un correo. Lo edita la clienta: es el que aparece en el pie. */
export const correo = (meta: Base) =>
  anota(z.email('No es un correo válido: le falta la @ o el dominio.'), {
    control: 'texto', ...meta,
  })

/** El identificador de un sabor. INMUTABLE: nombra seis archivos. */
export const slug = (meta: Base) =>
  anota(z.string().regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones.'), {
    control: 'oculto', quien: 'marcos', ...meta,
  })

/** El nombre de archivo de un PDF de ficha, sin extensión. */
export const archivo = (meta: Base) =>
  anota(z.string().regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones.'), {
    control: 'oculto', quien: 'marcos', ...meta,
  })

/**
 * Un valor que NO se edita porque se calcula (ver derivados.ts). Vive en
 * el esquema para que el panel sepa dibujarlo en gris con su explicación,
 * pero no sale del JSON.
 */
export const derivado = (meta: Base & { saleDe: string }) =>
  anota(
    z.int('Tiene que ser un número entero.')
      .min(1, 'Tiene que ser mayor a cero.')
      .max(99_999, 'No puede pasar de 99.999.'),
    { control: 'derivado', quien: 'marcos', ...meta },
  )

/** Un bloque con campos nombrados. */
export const grupo = <T extends z.ZodRawShape>(meta: Base & { campos: T }) =>
  anota(z.object(meta.campos), { control: 'oculto', ...meta })

/**
 * Forma FIJA: los 3 renglones del titular, las 2 líneas de la dirección.
 * El panel dibuja cajas fijas, sin «agregar» ni «quitar» — porque la
 * plantilla las indexa por posición y un cuarto renglón se pierde en
 * silencio. Por eso «faltan» y «sobran» llevan mensajes distintos: acá
 * la clienta necesita saber CUÁL de los dos errores cometió.
 */
export const tupla = <T extends readonly [z.ZodType, ...z.ZodType[]]>(
  meta: Base & { partes: T },
) =>
  anota(
    z.tuple(meta.partes, {
      error: (issue) => {
        const n = meta.partes.length
        if (issue.code === 'too_small') return `Faltan renglones: van exactamente ${n}.`
        if (issue.code === 'too_big') return `Sobran renglones: van exactamente ${n}.`
        return undefined
      },
    }),
    { control: 'renglones', ...meta },
  )

/** Colección con mínimo y máximo: agregar, quitar, reordenar. */
export const lista = <T extends z.ZodType>(
  meta: Base & { elemento: T; minItems: number; maxItems: number },
) =>
  anota(
    z.array(meta.elemento)
      .min(meta.minItems, `Necesitás al menos ${meta.minItems} elementos.`)
      .max(meta.maxItems, `No pueden ser más de ${meta.maxItems} elementos.`),
    { control: 'lista', ...meta },
  )
