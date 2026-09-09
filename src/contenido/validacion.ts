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

// El brief original traía `\s` acá, que matchea TAMBIÉN el espacio duro
// (U+00A0): con esa clase, esta regla ofrecía "arreglar" un valor que ya
// estaba bien escrito, reescribiéndolo idéntico a sí mismo — y si ese
// mismo valor era inválido por OTRA razón (por ejemplo el máximo), el
// botón de un toque quedaba ofreciendo un arreglo que no arreglaba nada:
// la clienta lo aprieta, confía, y publica el mismo error. Es el mismo bug
// que en el constructor `medida` (campos.ts) dejaba pasar CERO valores.
// `[^\S\u00a0]` es «espacio en blanco que no sea el duro», igual que en
// campos.ts, y con el ESCAPE siempre: un espacio duro tipeado a mano es
// frágil, un editor o un copiar-y-pegar lo puede normalizar a uno común
// sin que nadie lo note — es exactamente este bug, movido de lugar.
const CIFRA_UNIDAD = /(\d)[^\S\u00a0](g|kg|ml|l|°C)\b/g

function proponeArreglo(valor: unknown): Problema['arreglo'] {
  if (typeof valor === 'string' && CIFRA_UNIDAD.test(valor)) {
    CIFRA_UNIDAD.lastIndex = 0
    return {
      etiqueta: 'Poner el espacio que no parte el renglón',
      // El reemplazo también va con el escape, nunca con el carácter
      // pegado: si no, el archivo fuente vuelve a tener el mismo invisible
      // frágil que esta regla existe para corregir en el DATO de la clienta.
      valor: valor.replace(CIFRA_UNIDAD, '$1\u00a0$2'),
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

/** Valida un contenido contra su esquema y devuelve problemas legibles. */
export function validarContra(esquema: z.ZodType, crudo: unknown): Problema[] {
  const r = esquema.safeParse(crudo)
  if (r.success) return []

  return r.error.issues.map((issue) => {
    const campo = issue.path.join('.')
    const valor = enRuta(crudo, issue.path)
    return {
      campo,
      gravedad: 'impide' as const,
      titulo: issue.message,
      arreglo: proponeArreglo(valor),
    }
  })
}
