/*
 * El `fetch` de mentira para probar el cliente de GitHub sin salir a la red.
 * Lo usan `test/github.test.ts` (Tarea 3) y `test/publicar.test.ts` (Tarea 5):
 * una sola copia, porque dos copias de este ayudante son la forma en que dos
 * tests terminan creyendo cosas distintas sobre el mismo cliente.
 *
 * Vive en test/lib/ y no en src/ por la misma regla que campos-en-html.ts:
 * hoy lo usa solo la suite.
 */
/**
 * [M-11] Antes, un pedido de más repetía la ÚLTIMA respuesta programada
 * para siempre — así que un test que scriptea de menos (por ejemplo,
 * porque el código bajo prueba empezó a llamar a `fetch` una vez más de lo
 * que el test esperaba) podía pasar por casualidad, con la última
 * respuesta sirviendo para un pedido que nadie planeó. Ahora tira: un test
 * que pide más respuestas de las que programó falla ruidoso, en vez de
 * pasar en silencio por la razón equivocada.
 */
export function fetchFalso(respuestas: Array<{ status?: number; cuerpo: unknown }>) {
  const pedidos: Array<{ url: string; metodo: string; cuerpo: unknown; cabeceras: Record<string, string> }> = []
  let i = 0
  const f = async (url: string | URL, init?: RequestInit) => {
    if (i >= respuestas.length) {
      throw new Error(
        `fetchFalso(): se pidió una respuesta más de las ${respuestas.length} programadas ` +
          `(pedido #${i + 1}, ${init?.method ?? 'GET'} ${String(url)}) — el test scripteó de menos.`,
      )
    }
    const r = respuestas[i++]
    pedidos.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      cabeceras: (init?.headers ?? {}) as Record<string, string>,
    })
    return new Response(JSON.stringify(r.cuerpo), { status: r.status ?? 200 })
  }
  return { f: f as unknown as typeof globalThis.fetch, pedidos }
}
