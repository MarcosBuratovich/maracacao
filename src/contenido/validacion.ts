/*
 * Una verdad, cuatro consumidores.
 *
 * Los cuatro importan ESTE archivo: el navegador mientras la clienta
 * escribe, `api/panel.ts` antes de tocar GitHub, vitest, y `astro build`
 * (porque `cargar()` está en el camino del import). Si cada uno tuviera su
 * criterio, el panel diría que sí y el build diría que no — que es la peor
 * experiencia posible: ella publica y le rebota sin saber por qué.
 */
import type { z } from 'zod'
import { cifraUnidad } from './campos'
import type { ColeccionContada } from './campos'
import { cruzaConteo } from './conteos'
import { recorre } from './carga'

export interface Problema {
  /** Ruta punteada: 'sabores.3.nombre'. El panel la usa para llevarla al campo. */
  campo: string
  gravedad: 'impide' | 'avisa'
  /** Lo que lee la clienta. Sin jerga, sin nombres de tipos. */
  titulo: string
  detalle?: string
  /** Un botón de un toque, cuando el arreglo es obvio. */
  arreglo?: { etiqueta: string; valor: unknown }
}

// La regla del espacio duro vive en `campos.ts` y sale de ahí para los DOS
// usos: el constructor `medida` la usa para RECHAZAR y este archivo para
// REEMPLAZAR. Escrita dos veces —lo estaba— nada las mantenía alineadas:
// agregar `mm` a la lista de unidades sin tocar este archivo le deja a la
// clienta un campo que se rechaza y sin el botón que lo arregla, y no cae
// ningún test. El bug de la clase de caracteres (`\s` matchea TAMBIÉN el
// espacio duro, así que la regla ofrecía «arreglar» un valor ya bien
// escrito, reescribiéndolo idéntico a sí mismo) está explicado en el
// docstring de `cifraUnidad`.
//
// Dos instancias y no una: el flag `g` le da `lastIndex` propio al objeto,
// así que compartir UNA entre el `.test()` y el `.replace()` hace que la
// pregunta siguiente arranque desde la mitad del texto y conteste que no.
// La de preguntar va sin `g` justamente para que no tenga `lastIndex` que
// filtrar; la de reemplazar lo necesita para agarrar todas las
// apariciones, y `String.replace` le resetea el `lastIndex` sola.
const TIENE_ESPACIO_BLANDO = cifraUnidad()
const CADA_ESPACIO_BLANDO = cifraUnidad('g')

function proponeArreglo(valor: unknown): Problema['arreglo'] {
  if (typeof valor === 'string' && TIENE_ESPACIO_BLANDO.test(valor)) {
    return {
      etiqueta: 'Poner el espacio que no parte el renglón',
      // El reemplazo va con el escape, nunca con el carácter pegado: si
      // no, el archivo fuente vuelve a tener el mismo invisible frágil que
      // esta regla existe para corregir en el DATO de la clienta.
      valor: valor.replace(CADA_ESPACIO_BLANDO, '$1\u00a0$2'),
    }
  }
  return undefined
}

function enRuta(crudo: unknown, ruta: readonly PropertyKey[]): unknown {
  let actual: unknown = crudo
  for (const paso of ruta) {
    if (actual === null || typeof actual !== 'object') return undefined
    actual = (actual as Record<PropertyKey, unknown>)[paso]
  }
  return actual
}

// La jerga de tipos de Zod, detectada por CONTENIDO y no por código: así,
// un código de issue que hoy no existe pero mañana se cuela con el
// default de Zod cae en la misma red, sin que haga falta acordarse de
// agregarlo a una lista. `issue.message` es lo único que se mira: los
// constructores que ya pisan el mensaje (precio, numero, derivado…) nunca
// lo tocan, porque su propio texto no contiene ninguna de estas palabras.
const JERGA_DE_ZOD = /\b(string|number|boolean|array|object|invalid|expected|received)\b/i

// Lo único que la clienta necesita saber de un tipo, en su idioma. Sin
// entrada en el diccionario, el genérico de abajo sigue sin nombrar el
// tipo — nunca se interpola `issue.expected` crudo en el título.
const NOMBRE_TIPO: Record<string, string> = {
  string: 'texto',
  number: 'un número',
  int: 'un número entero',
  boolean: 'sí o no',
  array: 'una lista',
  object: 'un bloque de datos',
  tuple: 'una lista de tamaño fijo',
}

/**
 * La red de contención: cuando el mensaje que trae el issue TODAVÍA tiene
 * jerga de Zod (porque ni el constructor del campo ni un error map más
 * específico la pisaron), esto decide qué decirle a la clienta en su
 * lugar. `invalid_type` es el caso real de hoy —una clave que falta o un
 * valor de otro tipo, que en la función serverless es EXACTAMENTE lo que
 * produce un payload mal formado o un JSON post-migración con una clave
 * nueva sin llenar— pero cualquier otro código cae acá igual, con un
 * genérico que sigue sin nombrar tipos.
 */
function tituloSinJerga(issue: { code: string; expected?: string }, valor: unknown): string {
  if (issue.code === 'invalid_type') {
    // Un valor ausente es, para la clienta, un campo que quedó vacío —no
    // «recibió undefined». Un valor presente pero del tipo equivocado es
    // otra cosa: ella no distingue «string» de «number», pero sí entiende
    // que ESE valor no va ahí.
    if (valor === undefined) return 'El campo quedó vacío.'
    const nombre = issue.expected ? NOMBRE_TIPO[issue.expected] : undefined
    return nombre
      ? `Ese valor no corresponde acá: tiene que ser ${nombre}.`
      : 'Ese valor no corresponde acá.'
  }
  return 'Ese valor no es válido.'
}

/** Valida un contenido contra su esquema y devuelve problemas legibles. */
export function validarContra(esquema: z.ZodType, crudo: unknown): Problema[] {
  const r = esquema.safeParse(crudo)
  if (r.success) return []

  return r.error.issues.map((issue) => {
    const campo = issue.path.join('.')
    const valor = enRuta(crudo, issue.path)
    const titulo = JERGA_DE_ZOD.test(issue.message) ? tituloSinJerga(issue, valor) : issue.message
    return {
      campo,
      gravedad: 'impide' as const,
      titulo,
      arreglo: proponeArreglo(valor),
    }
  })
}

/** Cuántos hay de verdad en cada lista contada. Lo arma el llamador. */
export type Conteos = Readonly<Partial<Record<ColeccionContada, number>>>

/**
 * Une un prefijo con una parte de la ruta. Misma regla que `con()` en
 * carga.ts: la raíz no lleva punto adelante.
 */
const une = (a: string, b: string | number): string => (a === '' ? String(b) : `${a}.${b}`)

/**
 * `recorre()` devuelve rutas de ESQUEMA, con `[]` donde hay una lista
 * ('negocios.tabs[].datos[]') y `<clave=valor>` donde hay una variante de
 * unión ('bloques[]<tipo=parrafo>.texto'). Los avisos son sobre VALORES,
 * así que hay que instanciar cada `[]` contra el dato real y filtrar cada
 * `<...>` contra lo que el dato dice, y devolver una ruta concreta por
 * elemento — que es la que el panel usa para llevar a la clienta al campo
 * exacto.
 */

/**
 * Una parte de ruta puede traer tres cosas: la clave (`bloques`), uno o
 * más `[]` de lista y la marca de variante de una unión (`<tipo=parrafo>`).
 * 'bloques[]<tipo=parrafo>' trae las tres; 'filas[][]' trae DOS `[]`
 * seguidos, sin clave entre medio, porque una lista de listas —las filas
 * de una tabla— se desenvuelve dos veces sin que haya una clave nueva
 * entre un nivel y el otro (ver el caso 'array' de `recorre()` en
 * carga.ts, que agrega `[]` sin punto).
 */
const PARTE = /^([^<[]*)((?:\[\])*)(?:<([^=>]+)=([^>]+)>)?$/

/**
 * Exportada porque el panel la necesita para lo mismo que este archivo:
 * instanciar una ruta de esquema ('recetas.lista[].titulo') contra el
 * contenido real y sacar las rutas concretas con su valor
 * ('recetas.lista.2.titulo'). Escribirla dos veces —una acá y otra en
 * `src/panel/campos.ts`— es exactamente la clase de bug que esta capa
 * existe para no tener: las dos tendrían que interpretar `[]` y
 * `<clave=valor>` de la MISMA manera, y nada las mantendría alineadas el
 * día que una cambie.
 */
export const enRutas = (dato: unknown, ruta: string): { ruta: string; valor: unknown }[] => {
  let actuales: { ruta: string; valor: unknown }[] = [{ ruta: '', valor: dato }]
  for (const parte of ruta.split('.')) {
    const m = PARTE.exec(parte)
    if (!m) throw new Error(`enRutas(): no entiendo la parte «${parte}» de la ruta «${ruta}».`)
    const [, clave, corchetes, discriminante, variante] = m
    // Cada par de corchetes es UN nivel de lista a desenvolver: 'filas[][]'
    // desenvuelve dos veces seguidas, sin una clave entre medio.
    const niveles = corchetes.length / 2
    const siguiente: { ruta: string; valor: unknown }[] = []
    for (const { ruta: r, valor } of actuales) {
      if (valor === null || valor === undefined) continue
      const base = clave ? une(r, clave) : r
      const dentro = clave ? (valor as Record<string, unknown>)[clave] : valor
      // Sin corchetes hay un solo candidato; cada nivel de `[]` multiplica
      // los candidatos por uno por elemento del nivel anterior.
      let candidatos: { ruta: string; valor: unknown }[] = [{ ruta: base, valor: dentro }]
      for (let nivel = 0; nivel < niveles; nivel++) {
        const desenvueltos: { ruta: string; valor: unknown }[] = []
        for (const { ruta: r2, valor: v2 } of candidatos) {
          if (Array.isArray(v2)) v2.forEach((v, i) => desenvueltos.push({ ruta: une(r2, i), valor: v }))
        }
        candidatos = desenvueltos
      }
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
