/*
 * Guarda el HTML de las páginas construidas para poder comparar un antes
 * y un después. Se corre UNA vez antes de que la fase 2 toque markup, y
 * después cada vez que una tarea cambie el HTML a propósito — declarando
 * qué cambió, que es lo que hace que alguien lea el diff.
 *
 * Este archivo NO está bajo src/contenido/, así que sí puede usar node:fs.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const DESTINO = 'test/fixtures/html-antes-fase-2'

const paginas = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? paginas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  )

const rutas = paginas('dist').sort()
if (rutas.length === 0) {
  console.error('No hay HTML en dist/. Corré `pnpm build:sitio` primero.')
  process.exit(1)
}

mkdirSync(DESTINO, { recursive: true })
for (const ruta of rutas) {
  const nombre = relative('dist', ruta).replace(/\//g, '__')
  writeFileSync(join(DESTINO, nombre), readFileSync(ruta, 'utf8'), 'utf8')
}
console.log(`capturadas ${rutas.length} páginas en ${DESTINO}`)
