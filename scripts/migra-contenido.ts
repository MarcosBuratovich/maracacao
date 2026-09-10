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
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { escapaInvisibles, serializa } from '../src/contenido/carga'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { marca } from '../src/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '../src/copy/sabores'
import { fichasBase } from '../src/fichas/base'

const FIXTURE = 'test/fixtures/contenido-2026-09-10.json'
const DATOS = 'src/contenido/datos'

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

/**
 * ¿Ya hay algún documento migrado en `src/contenido/datos/`? Alcanza con
 * que exista UNO: es la señal de que al menos una fachada de `src/copy/`
 * dejó de leer los módulos `as const` originales y pasó a leer su propio
 * JSON con `cargar()`.
 */
function hayDocumentosMigrados(carpeta: string): boolean {
  if (!existsSync(carpeta)) return false
  return readdirSync(carpeta).some((archivo) => archivo.endsWith('.json'))
}

/**
 * Escribe el fixture del árbol VIEJO: la foto de los módulos `as const`
 * originales, tomada ANTES de que exista una sola fachada migrada. Se
 * corre UNA vez, al principio de la fase — y esa vez ya pasó (ver el
 * commit que escribió `test/fixtures/contenido-2026-09-10.json`).
 *
 * El candado de acá abajo es lo que hace que esa regla no dependa de que
 * nadie se acuerde: en cuanto `src/contenido/datos/` tiene un documento,
 * al menos una fachada de `src/copy/` dejó de leer los módulos originales
 * y pasó a leer su propio JSON con `cargar()`. Volver a correr esto
 * DESPUÉS de eso no fotografía el árbol viejo — fotografía el árbol
 * NUEVO a través de la fachada que ya migró. Las longitudes seguirían
 * coincidiendo, el guard de `contenido.test.ts` seguiría en verde, y el
 * certificado permanente de la Tarea 14 —que compara la fachada contra
 * ESTE fixture— pasaría a comparar el árbol nuevo contra una foto de sí
 * mismo: siempre verde, y sin ningún valor.
 */
function capturaFixture(): void {
  if (hayDocumentosMigrados(DATOS)) {
    throw new Error(
      `capturaFixture(): ${DATOS}/ ya tiene al menos un documento migrado. Esta función ` +
        'existe para fotografiar los módulos `as const` ORIGINALES, antes de que exista ' +
        'ninguna fachada migrada. Una vez que un documento migra, su fachada en src/copy/ ' +
        'deja de leer esos módulos y pasa a leer su propio JSON con cargar() — correr esto ' +
        'ahora fotografiaría el árbol NUEVO, no el viejo, y el certificado de la Tarea 14 ' +
        'terminaría comparando la fachada contra una foto de sí misma: siempre en verde, sin ' +
        'ningún valor. El fixture se captura UNA sola vez, al principio de la fase; esa vez ' +
        'ya pasó.',
    )
  }
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

/**
 * Escribe el documento de productos.
 *
 * `serializa()` recorre el ESQUEMA: si el esquema declara una ruta que el
 * objeto no tiene —o el objeto trae una clave que el esquema no declara—
 * tira antes de escribir nada. Eso es lo que prueba que el esquema
 * describe exactamente el contenido de hoy, y por eso no hace falta
 * revisar el JSON a ojo.
 */
function migraSabores(): void {
  escribe(
    'src/contenido/datos/sabores.json',
    serializa(esquemaSabores, {
      urlCatalogoBarras,
      sabores: estructura(sabores),
      gotas: estructura(gotas),
      polvo: estructura(polvo),
    }),
  )
}

const modo = process.argv[2]
if (modo === 'fixture') capturaFixture()
else if (modo === 'sabores') migraSabores()
else {
  console.error(`Modo desconocido: «${modo ?? '(ninguno)'}». Modos: fixture, sabores`)
  process.exit(1)
}
