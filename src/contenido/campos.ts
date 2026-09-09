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
  /**
   * TECHO DE CORDURA, no el límite de diseño. Generoso a propósito: si
   * el texto entra o no lo decide el medidor midiendo la página de
   * verdad (fase 4), porque 31 «W» miden 426 px y 31 «i» miden 142 px.
   * El panel lo dice con esas palabras: «tope de seguridad», no «cabe».
   */
  max?: number
  min?: number
  /** El ':' o el '.' que agrega la plantilla. El panel lo dibuja gris. */
  sufijo?: string
  /** El texto menciona una cantidad que sale de una lista: hay que cruzarla. */
  cuenta?: 'sabores' | 'gotas' | 'polvo' | 'recetas' | 'preguntas'
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
export const texto = (meta: Base & { max: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.max, mensajeMax(meta.max))),
    { control: 'texto', ...meta },
  )

/** Varias oraciones: un párrafo de «Nosotros», la respuesta de una pregunta. */
export const parrafo = (meta: Base & { max: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.max, mensajeMax(meta.max))),
    { control: 'parrafo', ...meta },
  )

/**
 * Cifra + unidad, con espacio duro: «70 g», «250 g».
 *
 * Si la clienta retoca esto en un input común, el espacio duro se vuelve
 * uno normal y en el celular la «g» queda sola en el renglón siguiente.
 * El panel le ofrece el arreglo con un botón; ella nunca se entera de
 * que el espacio duro existe, que es lo correcto.
 */
export const medida = (meta: Base & { max: number }) =>
  anota(
    reglasDeTexto(z.string().trim().max(meta.max, mensajeMax(meta.max))).refine(
      // `\s` (la versión original) matchea TAMBIÉN el espacio duro
      // (U+00A0): con esa clase, la regla rechazaba por igual el valor
      // bien escrito y el mal escrito, así que NINGÚN valor de `medida`
      // podía pasar nunca. `[^\S\u00a0]` es «espacio en blanco que
      // no sea el duro» — y va con el ESCAPE, nunca como carácter literal
      // pegado en el código: un espacio duro tipeado a mano es frágil, un
      // editor o un copiar-y-pegar lo puede normalizar a uno común sin que
      // nadie lo note, que es exactamente este bug, movido de lugar.
      // Verificado con los tres casos: cadena con U+00A0 real → no matchea
      // (válida); con espacio normal → matchea (inválida); con tab →
      // matchea (inválida).
      (v) => !/\d[^\S\u00a0](g|kg|ml|l|°C)\b/.test(v),
      'Entre el número y la unidad va un espacio que no parte el renglón.',
    ),
    { control: 'medida', ...meta },
  )

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
export const numero = (meta: Base & { min: number; max: number }) =>
  anota(
    z.int('Tiene que ser un número entero.')
      .min(meta.min, `Tiene que ser mayor o igual a ${meta.min}.`)
      .max(meta.max, `Tiene que ser menor o igual a ${meta.max}.`),
    { control: 'oculto', quien: 'marcos', ...meta },
  )

/**
 * Una clave del token `sabor`. No es texto: nombra el color de la banda,
 * la tinta medida y seis archivos de imagen. La clienta no la ve.
 */
export const claveSabor = (meta: Base) =>
  anota(
    z.string().refine((v) => v in sabor, 'No es un sabor del sistema de color.'),
    { control: 'oculto', quien: 'marcos', ...meta },
  )

/** Igual que claveSabor pero para cualquier token de color declarado. */
export const tokenColor = (meta: Base & { validos: readonly string[] }) =>
  anota(
    z.string().refine((v) => meta.validos.includes(v), 'No es un token de color del sistema.'),
    { control: 'oculto', quien: 'marcos', ...meta },
  )

/** Una ruta interna: '/fichas-tecnicas'. */
export const ruta = (meta: Base) =>
  anota(z.string().regex(/^\/[\w\-/]*$/, 'Tiene que empezar con «/».'), {
    control: 'oculto', quien: 'marcos', ...meta,
  })

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
export const derivado = (meta: Base & { de: string }) =>
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
export const lista = <T extends z.ZodType>(meta: Base & { de: T; min: number; max: number }) =>
  anota(
    z.array(meta.de)
      .min(meta.min, `Necesitás al menos ${meta.min} elementos.`)
      .max(meta.max, `No pueden ser más de ${meta.max} elementos.`),
    { control: 'lista', ...meta },
  )
