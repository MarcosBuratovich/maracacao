/*
 * Qué commit está sirviendo el CDN AHORA MISMO.
 *
 * El panel lo usa para la mitad más importante de «ya está en el sitio»
 * (spec §4.5): la API de la plataforma dice que el deploy TERMINÓ, y esto
 * dice que el borde de la red ya está entregando ESE commit. Las dos cosas
 * no pasan en el mismo instante, y la distancia entre ellas es la distancia
 * entre cantar «listo» y que ella abra el sitio y vea el precio viejo.
 *
 * Es estático: se escribe una vez, en el build, con el sha de ESE build. No
 * hay nada que calcular en cada pedido —el archivo ES la respuesta—, y por
 * eso funciona incluso si todas las funciones están caídas.
 *
 * `VERCEL_GIT_COMMIT_SHA` la inyecta la plataforma en todo deploy. Fuera de
 * ella (una construcción local) no existe, y el sha sale `null`: es
 * honesto, y el panel sabe leerlo como «esto no se construyó en el sitio de
 * verdad» en vez de comparar contra una cadena vacía que no es igual a nada.
 */
export const prerender = true

export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  return new Response(JSON.stringify({ sha, construido: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
