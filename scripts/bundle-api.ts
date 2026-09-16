/*
 * Empaqueta una función serverless en UN archivo autocontenido.
 *
 * Por qué existe: [MEDIDO 2026-09-16, en producción] una función de Vercel
 * que importa un archivo de afuera de `api/` CONSTRUYE y después muere al
 * invocarse (FUNCTION_INVOCATION_FAILED). El tracer no se lleva el archivo
 * al paquete. Sin esto, todo `src/servidor/**` es inalcanzable desde la
 * función, que es donde tiene que correr.
 *
 * esbuild resuelve los imports y escribe un solo archivo. `packages: 'bundle'`
 * mete TODO adentro —incluido zod— porque el paquete de la función no tiene
 * node_modules; `platform: 'node'` deja los `node:*` como externos, que sí
 * existen en el runtime.
 */
import { build, type BuildOptions } from 'esbuild'

export interface Empaque {
  entrada: string
  salida: string
}

/**
 * Todo lo que esbuild necesita y es igual para CUALQUIER función —todo
 * menos `entryPoints`/`outfile`, que cambian con cada una—. Exportada
 * porque antes vivía escrita dos veces: acá, y de nuevo como un objeto
 * literal calcado a mano en `test/bundle-api.test.ts`. Dos copias de la
 * misma configuración es exactamente la clase de cosa que ese test existe
 * para no tener: las dos coincidían de casualidad, porque nadie había
 * tocado ninguna desde que se escribieron. Con una sola —esta— ya no hay
 * una segunda que se pueda desincronizar en silencio.
 */
export const OPCIONES = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'bundle',
  // Las funciones de Vercel corren con el runtime de Node, no en el navegador:
  // `node:*` se resuelve allá y meterlo al bundle rompería.
  external: ['node:*'],
  banner: { js: '/* GENERADO por scripts/bundle-api.ts — no editar a mano. */' },
  logLevel: 'warning',
} as const satisfies Omit<BuildOptions, 'entryPoints' | 'outfile'>

export async function empaqueta({ entrada, salida }: Empaque): Promise<void> {
  await build({
    entryPoints: [entrada],
    outfile: salida,
    ...OPCIONES,
  })
}

/** Cada función serverless del repo. `test/bundle-api.test.ts` recorre esta MISMA lista. */
export const FUNCIONES: Empaque[] = [
  { entrada: 'src/servidor/entradas/contacto.ts', salida: 'api/contacto.js' },
  { entrada: 'src/servidor/entradas/panel.ts', salida: 'api/panel.js' },
]

if (import.meta.url === `file://${process.argv[1]}`) {
  await Promise.all(FUNCIONES.map(empaqueta))
  console.log(`Empaquetadas ${FUNCIONES.length} función(es).`)
}
