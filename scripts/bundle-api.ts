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
import { build } from 'esbuild'

export interface Empaque {
  entrada: string
  salida: string
}

export async function empaqueta({ entrada, salida }: Empaque): Promise<void> {
  await build({
    entryPoints: [entrada],
    outfile: salida,
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
  })
}

const FUNCIONES: Empaque[] = [
  { entrada: 'src/servidor/entradas/contacto.ts', salida: 'api/contacto.js' },
]

if (import.meta.url === `file://${process.argv[1]}`) {
  await Promise.all(FUNCIONES.map(empaqueta))
  console.log(`Empaquetadas ${FUNCIONES.length} función(es).`)
}
