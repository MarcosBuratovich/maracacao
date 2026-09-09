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
      (v) => !/\d\s(g|kg|ml|l|°C)\b/.test(v),
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
