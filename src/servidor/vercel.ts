/*
 * ¿Terminó el deploy de este commit?
 *
 * Una de las dos fuentes que deciden «ya está en el sitio» (spec §4.5). La
 * otra es `version.json`, que dice qué commit está sirviendo el CDN — y
 * desde la inversión de precedencia (estado.ts), esa sola alcanza para
 * cantar «listo» cuando ya sirve el sha publicado: es el hecho observable,
 * esto es un reporte sobre ese hecho, y el reporte puede estar mal (medido
 * en producción). Lo que SIGUE haciendo falta de acá es la otra mitad de
 * la pregunta: cuando el CDN todavía no sirve el sha publicado, distinguir
 * «falló» de «todavía va», algo que `version.json` no puede contestar
 * porque en los dos casos sigue mostrando lo viejo.
 *
 * Puro e inyectable (regla de `src/servidor/**`): el token, el proyecto y el
 * `fetch` llegan por parámetro. Nada acá lee `process.env`.
 *
 * PENDIENTE DE MEDICIÓN — [RULING T5-1] Esto se escribió contra la forma
 * documentada, sin correr un `curl` real: el token no existe en el repo ni
 * puede existir, y pedírselo a Marcos hubiera parado esta tarea. La
 * medición real queda diferida al paso 7 del ensayo de humo (Tarea 15),
 * que sondea el estado de una publicación real contra producción. Lo que
 * ese paso tiene que confirmar y, si hace falta, corregir acá:
 *
 *   1. Con qué parámetro se filtra por commit (acá se asume `sha=`).
 *   2. En qué clave viene el estado y bajo qué forma (acá se asume
 *      `deployments[0].state`, string).
 *   3. Si el proyecto se nombra con `app=` o con `projectId=` (acá se
 *      asume `app=`).
 *
 * Si la medición contradice algo de lo de arriba, gana la medición, y este
 * comentario pasa a decir cuál era la suposición que falló.
 *
 * Los errores de este módulo llevan el status: son para el log de Marcos, no
 * para la clienta. La traducción a español la hace `estado.ts`.
 */

export type EstadoDeDespliegue = 'enCurso' | 'listo' | 'falló' | 'desconocido'

export interface CredencialesVercel {
  token: string
  /** El nombre del proyecto en la plataforma. */
  proyecto: string
  fetch: typeof globalThis.fetch
}

/**
 * De los estados crudos a los tres que le importan al panel.
 *
 * [B9] Lo que NO está acá se lee como `'enCurso'`. La lista de estados de una
 * plataforma cambia sin avisar, y la pregunta no es «¿cómo se llama este
 * estado?» sino «¿qué es lo barato de creer si me equivoco?». Creer «todavía
 * está trabajando» cuesta unos segundos de espera de más. Creer «listo» le
 * miente a la clienta y la manda a mirar un sitio que no cambió. Creer
 * «falló» dispara una reversión automática que nadie pidió. La asimetría
 * decide, no la completitud de la lista.
 */
const TERMINADOS: Record<string, EstadoDeDespliegue> = {
  READY: 'listo',
  ERROR: 'falló',
  CANCELED: 'falló',
}

export function clienteVercel(c: CredencialesVercel) {
  return {
    /**
     * El estado del despliegue de un commit, y la dirección donde quedó
     * servido. `'desconocido'` cuando la plataforma todavía no tiene ningún
     * despliegue para ese commit — que NO es lo mismo que «en curso»: puede
     * ser que el webhook no haya llegado aún, o que no vaya a llegar nunca.
     * Qué hacer con esa diferencia lo decide `estado.ts`, que es el que sabe
     * cuánto hace que se publicó.
     */
    async despliegueDe(sha: string): Promise<{ estado: EstadoDeDespliegue; url: string | null }> {
      const url =
        `https://api.vercel.com/v6/deployments` +
        `?app=${encodeURIComponent(c.proyecto)}&sha=${encodeURIComponent(sha)}&limit=1`

      const respuesta = await c.fetch(url, {
        headers: { Authorization: `Bearer ${c.token}`, 'User-Agent': 'panel-maracacao' },
      })
      const cuerpo: unknown = await respuesta.json().catch(() => undefined)

      if (!respuesta.ok) {
        const mensaje = (cuerpo as { error?: { message?: unknown } } | undefined)?.error?.message
        throw new Error(
          `La plataforma respondió ${respuesta.status}: ${typeof mensaje === 'string' ? mensaje : 'sin mensaje'}`,
        )
      }

      // [RULING T5-2] Un 200 con un cuerpo que no se puede leer también es un
      // error, y hay que tratarlo como tal. Sin esta línea, el `.catch()` de
      // arriba lo dejaba en `undefined`, el `?? []` de abajo lo volvía «no hay
      // despliegues» y el módulo contestaba `'desconocido'` — que significa
      // «la plataforma todavía no vio este commit», una afirmación FALSA
      // cuando lo que pasó es que contestó basura. Y en silencio: sin
      // excepción no hay nada en el log de Marcos, contra lo que promete el
      // docstring de este archivo. Pasa de verdad: una página de
      // mantenimiento servida con 200, una respuesta truncada por timeout.
      //
      // `json()` sobre un cuerpo válido nunca devuelve `undefined` —un `null`
      // literal parsea a `null`— así que `undefined` acá significa
      // exactamente una cosa: no se pudo leer.
      if (cuerpo === undefined) {
        throw new Error(`La plataforma respondió ${respuesta.status} con un cuerpo que no se pudo leer.`)
      }

      const despliegues = (cuerpo as { deployments?: Array<{ state?: string; url?: string | null }> } | undefined)?.deployments ?? []
      const primero = despliegues[0]
      if (!primero) return { estado: 'desconocido', url: null }

      return {
        estado: TERMINADOS[primero.state ?? ''] ?? 'enCurso',
        // La API devuelve el host pelado («maracacao-abc.vercel.app»); lo que
        // el panel necesita es algo que se pueda abrir.
        url: primero.url ? `https://${primero.url}` : null,
      }
    },
  }
}
