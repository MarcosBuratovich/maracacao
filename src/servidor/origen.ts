/*
 * LA lista de orígenes que pueden pedirle algo a nuestras funciones.
 *
 * Vive acá, fuera de `api/`, porque la comparten `src/servidor/entradas/
 * contacto.ts` y el `src/servidor/entradas/panel.ts` de la fase 5: dos
 * listas de orígenes que se separan es cómo un dominio nuevo queda
 * habilitado en una función y bloqueado en la otra.
 *
 * [RESUELTO 2026-09-16, en producción] este archivo fue el experimento del
 * spec §4: un import de acá desde `api/contacto.ts` construía y moría al
 * invocarse (FUNCTION_INVOCATION_FAILED). El bundler de Vercel no sigue un
 * import de afuera de `api/`, así que la fuente de cada función se mudó a
 * `src/servidor/entradas/` y `scripts/bundle-api.ts` (esbuild) la empaqueta
 * autocontenida en `api/<nombre>.js` — ver `docs/panel-operacion.md`.
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
