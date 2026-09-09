/*
 * Escapa los metacaracteres de regex para poder interpolar contenido —un
 * nombre de sabor, un wordmark, el producto de una ficha— dentro de un
 * patrón. Sin esto, un «Lima (con chile)» convierte los paréntesis en un
 * grupo y el patrón deja de matchear, con un error que apunta al HTML y
 * no al texto que lo causó.
 *
 * No es un test: por eso el archivo no lleva `.test.` (vitest solo
 * colecta `test/**\/*.test.ts`). Mismo criterio que `test/svg-utils.ts`.
 */
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
