/*
 * LA lista de orígenes que pueden pedirle algo a nuestras funciones.
 *
 * Vive acá, fuera de `api/`, porque la van a compartir `api/contacto.ts` y
 * el `api/panel.ts` de la fase 5: dos listas de orígenes que se separan es
 * cómo un dominio nuevo queda habilitado en una y bloqueado en la otra.
 *
 * ESTE ARCHIVO ES TAMBIÉN EL EXPERIMENTO de la fase 5 (spec §4): responde
 * si el bundler de Vercel sigue un import TypeScript de afuera de `api/`.
 * Si el deploy construye y la función responde, el resto de la fase se
 * escribe con imports normales; si no, hace falta un paso de esbuild que
 * arme un `api/panel.js` autocontenido ANTES de que nada dependa de eso.
 */

/** Los dominios propios. El apex redirige a www, pero los dos pueden pedir. */
export const ORIGENES_PERMITIDOS = [
  'https://maracacao.mx',
  'https://www.maracacao.mx',
  'http://localhost:4321',
  'http://localhost:4322',
] as const

/** Los previews de Vercel, que cambian de subdominio en cada deploy. */
export const PREVIEW_DE_VERCEL = /^https:\/\/[a-z0-9-]+\.vercel\.app$/

/** Si ese `Origin` puede pedirle algo a una función nuestra. */
export function origenPermitido(origen: string): boolean {
  return (ORIGENES_PERMITIDOS as readonly string[]).includes(origen) || PREVIEW_DE_VERCEL.test(origen)
}
