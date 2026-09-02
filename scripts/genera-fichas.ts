/* Genera las fichas técnicas oficiales en PDF.
 *
 * `pnpm fichas` → public/fichas/*.pdf (los descarga /fichas-tecnicas)
 *
 * La plantilla y los datos viven en src/fichas/ (compartidos con el
 * generador en línea /fichas — mismo formato, mismo motor: Chromium).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fichaHtml } from '../src/fichas/plantilla'
import { fichasBase } from '../src/fichas/base'

const RAIZ = resolve(import.meta.dirname, '..')
const SALIDA = resolve(RAIZ, 'public/fichas')
const TEMPORAL = resolve(RAIZ, 'node_modules/.tmp-fichas')

const sello = readFileSync(resolve(RAIZ, 'src/assets/brand/sello-mano.svg'), 'utf8')
  .replace('<svg', '<svg aria-hidden="true"')

const rutaFuentes = `file://${resolve(RAIZ, 'public/fonts')}`

mkdirSync(SALIDA, { recursive: true })
mkdirSync(TEMPORAL, { recursive: true })

for (const ficha of fichasBase) {
  const html = resolve(TEMPORAL, `${ficha.archivo}.html`)
  const pdf = resolve(SALIDA, `${ficha.archivo}.pdf`)
  writeFileSync(html, fichaHtml(ficha, rutaFuentes, sello))
  execFileSync('/usr/bin/google-chrome', [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`,
    `file://${html}`,
  ], { stdio: 'pipe' })
  console.log(`${ficha.archivo}.pdf listo`)
}
