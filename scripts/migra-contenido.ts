/*
 * La migración del contenido, en dos modos.
 *
 *   pnpm migra fixture   → escribe test/fixtures/contenido-2026-09-10.json
 *                          leyendo los módulos `as const` VIVOS. Se corre
 *                          UNA vez, antes de tocar ninguna fachada.
 *   pnpm migra <doc>     → escribe src/contenido/datos/<doc>.json con
 *                          serializa(), que recorre el esquema: si el
 *                          esquema declara una ruta que el objeto no tiene
 *                          —o al revés— TIRA antes de escribir. Eso es lo
 *                          que prueba que el esquema describe exactamente
 *                          el contenido de hoy.
 *
 * Este archivo NO está bajo src/contenido/, así que sí puede usar node:fs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { escapaInvisibles } from '../src/contenido/carga'
import { marca } from '../src/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '../src/copy/sabores'
import { fichasBase } from '../src/fichas/base'

const FIXTURE = 'test/fixtures/contenido-2026-09-10.json'

/**
 * La forma pura del objeto, sin `readonly`, sin `undefined` y sin
 * prototipos: exactamente lo que un JSON puede representar. Es la misma
 * transformación que va a sufrir el contenido al pasar por el archivo, así
 * que compararlo contra esto compara lo que de verdad importa.
 */
const estructura = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/**
 * Recibe TEXTO ya listo, no un objeto: los documentos los produce
 * `serializa()`, que además de escapar ordena las claves según el esquema.
 * Si esta función stringificara por su cuenta, habría dos maneras de
 * escribir un JSON en el sistema y una sola de leerlo.
 */
function escribe(ruta: string, texto: string): void {
  mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true })
  writeFileSync(ruta, texto.endsWith('\n') ? texto : texto + '\n', 'utf8')
  console.log(`escrito: ${ruta}`)
}

function capturaFixture(): void {
  escribe(
    FIXTURE,
    escapaInvisibles(
      JSON.stringify(
        {
          marca: estructura(marca),
          sabores: estructura(sabores),
          gotas: estructura(gotas),
          polvo: estructura(polvo),
          urlCatalogoBarras,
          fichas: estructura(fichasBase),
        },
        null,
        2,
      ),
    ),
  )
}

const modo = process.argv[2]
if (modo === 'fixture') capturaFixture()
else {
  console.error(`Modo desconocido: «${modo ?? '(ninguno)'}». Modos: fixture`)
  process.exit(1)
}
