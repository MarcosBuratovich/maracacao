/*
 * La IP de quien pide, sacada de las cabeceras HTTP. Vive acá, fuera de
 * `entradas/`, por la misma razón que `origen.ts`: es lógica pura —sin
 * `process.env` ni `fetch`— así que la suite la prueba pasándole cabeceras
 * de mentira, sin mockear ningún pedido HTTP de verdad. `entradas/panel.ts`
 * (el borde) solo le pasa `req.headers`.
 *
 * [M-2] `x-forwarded-for` la arma Vercel AGREGANDO su propia IP al final de
 * lo que el pedido ya traía —así que «la primera de la lista» NO es
 * necesariamente la del cliente real—: un cliente que manda su PROPIO
 * `x-forwarded-for` con una IP inventada al principio logra que esa IP
 * inventada sea «la primera», y el freno de intentos (E4) termina contando
 * contra una IP que el atacante elige, nunca la suya. Por eso se prefieren
 * `x-vercel-forwarded-for` (la que Vercel escribe DE CERO, con la IP real
 * de quien conectó, sin que el cliente la pueda pisar) y, si no está,
 * `x-real-ip` — las dos las pone el borde de Vercel, no el navegador.
 * `x-forwarded-for` queda como último recurso, para correr en local, donde
 * esas dos cabeceras no existen.
 */

type Cabeceras = Record<string, string | string[] | undefined>

const valorUnico = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

/** La IP de quien pide, para el freno de intentos de `entrar`/`salud` (E4). */
export function ipDelPedido(headers: Cabeceras): string {
  const deVercel = valorUnico(headers['x-vercel-forwarded-for']).split(',')[0]?.trim()
  if (deVercel) return deVercel

  const real = valorUnico(headers['x-real-ip']).trim()
  if (real) return real

  const primera = valorUnico(headers['x-forwarded-for']).split(',')[0]?.trim()
  return primera || 'desconocida'
}
