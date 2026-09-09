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
