import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { cargarSvg } from './svg-utils'

/*
 * La "batería del brazo" — criterio de aceptación 2 del spec de la Task 8:
 * rotar un brazo ±20° sobre su pivote no puede abrir un agujero en el
 * hombro. Las dos rondas de fix anteriores de la Task 8 corrieron esta
 * batería a mano contra archivos en /tmp (ver task-8-report.md, §6 y §11) y
 * quedó en prosa: nada en `pnpm test` la reproducía, así que una regresión
 * futura en el hombro — o en la cadera/pierna que va a dibujar la Task 9 —
 * podía colarse sin que ningún test se enterara. Este archivo la automatiza.
 *
 * Método: rasteriza el SVG **como string** (nunca el archivo — los casos
 * rotados inyectan `transform="rotate(±20 CX CY)"` sobre una copia en
 * memoria; el archivo del repo se verifica sin tocar más abajo) a 900px de
 * ancho con fondo transparente, y hace BFS sobre el canal alfa en nueve
 * casos — sin rotar, cada brazo ±20° y cada pierna ±20° sobre su propio
 * pivote, leído del propio SVG — para medir:
 *
 *   (a) Componentes conexas del dibujo: no pueden AUMENTAR respecto de la
 *       base. Si un miembro se despega, la figura se parte en dos y el
 *       conteo sube, y ESE es el agujero de hombro/cadera que un flood fill
 *       de fondo no ve por sí solo (un hueco en el hombro conecta con el
 *       exterior, así que el fondo "alcanzable desde el borde" lo atraviesa
 *       sin marcarlo distinto).
 *   (b) Regiones de fondo ENCERRADAS (no alcanzables desde el borde): no
 *       puede aparecer ninguna región nueva al rotar. La pose ya encierra
 *       regiones legítimas sin rotar nada — el ojal del gancho del brazo
 *       izquierdo, la cuña que queda entre el brazo derecho y el bowl, y una
 *       cuñita sub-visual de ~15px entre el pliegue del puño y la cáscara
 *       del pistache — así que el criterio no es "cero regiones" sino
 *       "nunca más que la base", medida acá mismo abajo y nunca
 *       hardcodeada: si algún día cambia el dibujo y la base pasa a ser 2 o
 *       4, la prueba se sigue midiendo sola.
 *
 * POR QUÉ (a) DEJÓ DE SER "== 1" (Task 9): la escena ya no es una sola
 * figura. El suelo trae seis ondas sueltas, la órbita catorce granos y el
 * "¡mmm!" tres chispas, todos flotando sin tocar al mono: la base son 24
 * componentes, no 1. Y el conteo puede BAJAR legítimamente al rotar — con
 * `#pierna-apoyo −20°` el pie barre hasta tocar un grano y dos componentes
 * se funden en una. Por eso la aserción es `≤ base` y no `== base`: sólo el
 * modo de falla real (un miembro que se despega) hace subir el número.
 *
 * Esa asimetría deja un punto ciego conocido, marcado por la re-review de la
 * Task 8: si un miembro se despega Y al mismo tiempo el miembro errante toca
 * otra geometría, las dos variaciones se cancelan y (a) no se entera. La
 * red que sí lo atrapa es (b): un despegue en la cadera abre fondo rodeado
 * de torso por todos lados, que es una región encerrada nueva. Las dos
 * métricas están acá porque ninguna sola alcanza — verificado con
 * mutaciones de control sobre la geometría real (ver task-9-report.md §7).
 *
 * Ancho 900: a menos resolución la cuñita de ~15px se funde con el
 * antialiasing y los conteos de arriba cambian de un ancho a otro (se probó:
 * a 220px esta tabla ya no se puede reproducir).
 *
 * Por qué tarda: 9 rasterizaciones a 900px (~900×900 ≈ 810 000 píxeles cada
 * una) más hasta 3 recorridos BFS por caso (componentes de tinta, fondo
 * alcanzable desde el borde, componentes de fondo encerrado). En esta
 * máquina corre en ~2 segundos, pero el timeout se deja generoso a
 * propósito para no ser el test que empieza a fallar por ruido de CPU en CI:
 * NO LO BORREN POR LENTO. Es la única red automática contra un hueco de
 * hombro o de cadera que reaparece.
 */

const RUTA_SVG = 'src/assets/brand/mascota.svg'
const ANCHO_RENDER = 900
const TIMEOUT_MS = 60_000

type Rotacion = { grupo: string; pivId: string; angulo: number }
type EspecCaso = { nombre: string; rotacion: Rotacion | null }

// Única fuente de verdad para los nueve casos: de acá salen tanto los
// nombres de los `it.each` (necesarios en el momento de la colección, antes
// de que `beforeAll` haya corrido) como las instrucciones para construir
// cada SVG dentro de `beforeAll`. Si alguna vez difieren, el índice deja de
// coincidir y hay un solo lugar para arreglarlo.
const ESPECIFICACION_CASOS: EspecCaso[] = [
  { nombre: 'sin rotar', rotacion: null },
  { nombre: '#brazo-l +20°', rotacion: { grupo: 'brazo-l', pivId: 'piv-brazo-l', angulo: 20 } },
  { nombre: '#brazo-l −20°', rotacion: { grupo: 'brazo-l', pivId: 'piv-brazo-l', angulo: -20 } },
  { nombre: '#brazo-r +20°', rotacion: { grupo: 'brazo-r', pivId: 'piv-brazo-r', angulo: 20 } },
  { nombre: '#brazo-r −20°', rotacion: { grupo: 'brazo-r', pivId: 'piv-brazo-r', angulo: -20 } },
  // Cadera (Task 9). Mismo método, mismos pivotes leídos del propio SVG.
  { nombre: '#pierna-apoyo +20°', rotacion: { grupo: 'pierna-apoyo', pivId: 'piv-pierna-apoyo', angulo: 20 } },
  { nombre: '#pierna-apoyo −20°', rotacion: { grupo: 'pierna-apoyo', pivId: 'piv-pierna-apoyo', angulo: -20 } },
  { nombre: '#pierna-post +20°', rotacion: { grupo: 'pierna-post', pivId: 'piv-pierna-post', angulo: 20 } },
  { nombre: '#pierna-post −20°', rotacion: { grupo: 'pierna-post', pivId: 'piv-pierna-post', angulo: -20 } },
]
const NOMBRE_BASE = ESPECIFICACION_CASOS[0].nombre
const NOMBRES_ROTADOS = ESPECIFICACION_CASOS.slice(1).map((c) => c.nombre)

function pivote(doc: Document, id: string): { cx: number; cy: number } {
  // Se lee del propio SVG, no se hardcodea: si `piv-brazo-l` o `piv-brazo-r`
  // se mueven en el dibujo, la batería rota desde el punto nuevo sin que
  // haga falta tocar este archivo.
  const el = doc.querySelector(`[id="${id}"]`)
  if (!el) throw new Error(`no existe el pivote "${id}" en ${RUTA_SVG}`)
  const cx = Number(el.getAttribute('cx'))
  const cy = Number(el.getAttribute('cy'))
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    throw new Error(`el pivote "${id}" no tiene cx/cy numéricos`)
  }
  return { cx, cy }
}

function inyectarTransform(svg: string, id: string, transform: string): string {
  // Permisivo con otros atributos que la etiqueta ya tenga ([^>]*), pero
  // exige encontrar EXACTAMENTE una apertura de grupo con ese id: si el
  // archivo cambia de forma que esto deje de matchear (o matchee de más),
  // preferimos que la batería explote con un mensaje claro antes que rotar
  // el grupo equivocado, o no rotar nada, en silencio.
  const re = new RegExp(`(<g\\s+id="${id}"[^>]*)(>)`, 'g')
  const apariciones = svg.match(re)?.length ?? 0
  if (apariciones !== 1) {
    throw new Error(`se esperaba exactamente una apertura de <g id="${id}">; hubo ${apariciones}`)
  }
  return svg.replace(re, `$1 transform="${transform}"$2`)
}

function construirSvgDelCaso(svgOriginal: string, doc: Document, caso: EspecCaso): string {
  if (caso.rotacion === null) return svgOriginal
  const { grupo, pivId, angulo } = caso.rotacion
  const { cx, cy } = pivote(doc, pivId)
  return inyectarTransform(svgOriginal, grupo, `rotate(${angulo} ${cx} ${cy})`)
}

interface Raster { width: number; height: number; pixels: Buffer }

function rasterizar(svg: string, ancho: number): Raster {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: ancho },
    background: 'rgba(0,0,0,0)',
  })
  const render = resvg.render()
  return { width: render.width, height: render.height, pixels: render.pixels }
}

// BFS 4-conexo genérico: cuenta los blobs de un predicado sobre índices de
// píxel (`y * width + x`) y devuelve sus tamaños. Sirve tanto para
// "componentes de tinta" como para "componentes de fondo encerrado" — lo
// único que cambia entre los dos usos es el predicado, no el recorrido.
function contarComponentes(width: number, height: number, esObjetivo: (idx: number) => boolean): number[] {
  const total = width * height
  const visitado = new Uint8Array(total)
  const pila = new Int32Array(total)
  const tamanos: number[] = []
  for (let inicio = 0; inicio < total; inicio++) {
    if (visitado[inicio] || !esObjetivo(inicio)) continue
    let tope = 0
    pila[tope++] = inicio
    visitado[inicio] = 1
    let n = 0
    while (tope > 0) {
      const idx = pila[--tope]
      n++
      const x = idx % width
      const y = (idx - x) / width
      if (x > 0) { const j = idx - 1; if (!visitado[j] && esObjetivo(j)) { visitado[j] = 1; pila[tope++] = j } }
      if (x < width - 1) { const j = idx + 1; if (!visitado[j] && esObjetivo(j)) { visitado[j] = 1; pila[tope++] = j } }
      if (y > 0) { const j = idx - width; if (!visitado[j] && esObjetivo(j)) { visitado[j] = 1; pila[tope++] = j } }
      if (y < height - 1) { const j = idx + width; if (!visitado[j] && esObjetivo(j)) { visitado[j] = 1; pila[tope++] = j } }
    }
    tamanos.push(n)
  }
  return tamanos
}

function fondoAlcanzableDesdeBorde(width: number, height: number, esFondo: (idx: number) => boolean): Uint8Array {
  const alcanzable = new Uint8Array(width * height)
  const pila: number[] = []
  const marcar = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return
    const idx = y * width + x
    if (alcanzable[idx] || !esFondo(idx)) return
    alcanzable[idx] = 1
    pila.push(idx)
  }
  for (let x = 0; x < width; x++) { marcar(x, 0); marcar(x, height - 1) }
  for (let y = 0; y < height; y++) { marcar(0, y); marcar(width - 1, y) }
  while (pila.length > 0) {
    const idx = pila.pop()!
    const x = idx % width
    const y = (idx - x) / width
    marcar(x + 1, y); marcar(x - 1, y); marcar(x, y + 1); marcar(x, y - 1)
  }
  return alcanzable
}

interface Analisis {
  componentesDelDibujo: number
  tamanosDelDibujo: number[]
  regionesEncerradas: number[]
}

// Fondo := alfa exactamente 0 (transparente puro); cualquier alfa > 0 —
// tinta llena o el borde antialiaseado de una forma — cuenta como dibujo.
// Con fondo transparente esto no necesita ningún umbral de color (el
// problema real que sí tuvo la Task 8 original al leer la foto de
// referencia, donde dos verdes casi iguales no se separaban por
// umbralización de color). Se probaron umbrales de alfa "a mitad de camino"
// (64, 128, 200) antes de elegir este: todos introducen islas sueltas de 1
// píxel de puro antialiasing que no son agujeros reales y ensucian el
// conteo de regiones. alfa==0 exacto es el único corte que no depende de
// dónde cae el antialiasing.
function analizar(svg: string, ancho: number): Analisis {
  const { width, height, pixels } = rasterizar(svg, ancho)
  const alphaEn = (idx: number) => pixels[idx * 4 + 3]
  const esTinta = (idx: number) => alphaEn(idx) > 0
  const esFondo = (idx: number) => alphaEn(idx) === 0

  const tamanosDelDibujo = contarComponentes(width, height, esTinta)

  const alcanzable = fondoAlcanzableDesdeBorde(width, height, esFondo)
  const regionesEncerradas = contarComponentes(width, height, (idx) => esFondo(idx) && !alcanzable[idx])

  return { componentesDelDibujo: tamanosDelDibujo.length, tamanosDelDibujo, regionesEncerradas }
}

describe('batería de miembros — criterio de aceptación 2 (rotar no abre agujeros)', () => {
  let svgOriginal: string
  let resultados: Record<string, Analisis>

  beforeAll(() => {
    svgOriginal = readFileSync(RUTA_SVG, 'utf8')
    const doc = cargarSvg(RUTA_SVG)
    resultados = {}
    for (const caso of ESPECIFICACION_CASOS) {
      const svg = construirSvgDelCaso(svgOriginal, doc, caso)
      resultados[caso.nombre] = analizar(svg, ANCHO_RENDER)
    }
  }, TIMEOUT_MS)

  it('el SVG del repo no lleva ningún transform — los casos rotados viven solo en memoria', () => {
    expect(svgOriginal).not.toMatch(/\stransform=/)
  })

  it('la pose sin rotar encierra al menos una región de fondo (ojal, cuña del bowl, cuñita)', () => {
    // No fijamos el número exacto (hoy da 3). Se mide acá y las pruebas de
    // abajo lo usan como referencia — es la garantía de que "≤ la base" no
    // es una comparación vacía contra cero.
    expect(resultados[NOMBRE_BASE].regionesEncerradas.length).toBeGreaterThan(0)
  })

  it('la escena base es el mono más adornos sueltos, y el mono es la componente dominante', () => {
    // Documenta por qué la aserción de componentes dejó de ser "== 1": las
    // ondas, los granos y las chispas son objetos flotantes que no tocan al
    // mono. Si alguno los soldara al cuerpo (o partiera al mono), esto se
    // entera antes de que las comparaciones de abajo se vuelvan opacas.
    const base = resultados[NOMBRE_BASE]
    expect(base.componentesDelDibujo).toBeGreaterThan(1)
    const total = base.tamanosDelDibujo.reduce((a, b) => a + b, 0)
    expect(Math.max(...base.tamanosDelDibujo) / total).toBeGreaterThan(0.5)
  })

  it.each(NOMBRES_ROTADOS)(
    '%s — el dibujo no se parte: no aparece ninguna componente nueva',
    (nombre) => {
      expect(resultados[nombre].componentesDelDibujo)
        .toBeLessThanOrEqual(resultados[NOMBRE_BASE].componentesDelDibujo)
    },
  )

  it.each(NOMBRES_ROTADOS)(
    '%s — no aparece ninguna región de fondo encerrada nueva frente a la base',
    (nombre) => {
      expect(resultados[nombre].regionesEncerradas.length)
        .toBeLessThanOrEqual(resultados[NOMBRE_BASE].regionesEncerradas.length)
    },
  )
})

/*
 * La contraparte analítica de la batería de arriba.
 *
 * La batería raster muestrea ±20° y sólo ve lo que el ráster deja ver. Para
 * la cadera eso no alcanza: el casquete proximal de una pierna vive ENTERO
 * adentro de la silueta del torso, así que hay desplazamientos de pierna que
 * no abren ningún agujero visible y la batería no los marca (verificado con
 * mutaciones: la pierna corrida 45 unidades a la derecha, y el marcador de
 * pivote corrido 14, pasan las nueve rotaciones en verde — ver
 * task-9-report.md §7).
 *
 * Lo que sí se puede afirmar exacto, para CUALQUIER ángulo y sin rasterizar,
 * es la garantía estructural en la que se apoya todo el dibujo desde la
 * Task 8: cada miembro se genera como el contorno de una línea de centro y
 * su casquete proximal es un ARCO CIRCULAR CENTRADO EN EL PIVOTE. Un arco
 * centrado en el centro de rotación es invariante a la rotación, así que la
 * unión con el cuerpo no puede despegarse por más que el rig gire el
 * miembro. Acá se verifica sobre el path: los dos extremos del último
 * comando `A` de cada miembro tienen que estar exactamente a `rx` del
 * pivote.
 */
describe('miembros — el casquete proximal está centrado en el pivote', () => {
  const doc = cargarSvg(RUTA_SVG)

  const MIEMBROS = [
    { forma: 'brazo-l-forma', pivote: 'piv-brazo-l' },
    { forma: 'brazo-r-forma', pivote: 'piv-brazo-r' },
    { forma: 'pierna-apoyo-forma', pivote: 'piv-pierna-apoyo' },
    { forma: 'pierna-post-forma', pivote: 'piv-pierna-post' },
    { forma: 'pie-apoyo-forma', pivote: 'piv-pie-apoyo' },
    { forma: 'pie-post-forma', pivote: 'piv-pie-post' },
    { forma: 'cola-forma', pivote: 'piv-cola' },
  ]

  // Cuántos números consume cada comando de path, para poder recorrer el `d`
  // llevando la cuenta del punto actual sin depender de un parser externo.
  const ARIDAD: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 }

  /** Último arco del path: su radio y sus dos extremos (inicial y final). */
  function ultimoArco(d: string): { rx: number; desde: [number, number]; hasta: [number, number] } {
    const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? []
    let cursor: [number, number] = [0, 0]
    let cmd = ''
    let ultimo: { rx: number; desde: [number, number]; hasta: [number, number] } | null = null
    for (let i = 0; i < tokens.length;) {
      const t = tokens[i]
      if (/[A-Za-z]/.test(t)) {
        // Sólo se usan comandos absolutos en este archivo; si aparece uno
        // relativo preferimos explotar a leer mal las coordenadas.
        expect(t).toBe(t.toUpperCase())
        cmd = t
        i += 1
        if (cmd === 'Z') continue
        expect(Object.keys(ARIDAD)).toContain(cmd)
        continue
      }
      const n = ARIDAD[cmd]
      const nums = tokens.slice(i, i + n).map(Number)
      const fin: [number, number] = [nums[n - 2], nums[n - 1]]
      if (cmd === 'A') ultimo = { rx: nums[0], desde: cursor, hasta: fin }
      cursor = fin
      i += n
    }
    if (ultimo === null) throw new Error('el path no termina en un arco de casquete')
    return ultimo
  }

  const attr = (id: string, a: string) =>
    Number(doc.querySelector(`[id="${id}"]`)!.getAttribute(a))

  it.each(MIEMBROS)('#$forma cierra con un arco centrado en $pivote', ({ forma, pivote }) => {
    const el = doc.querySelector(`[id="${forma}"]`)
    expect(el, `no existe #${forma}`).not.toBeNull()
    const { rx, desde, hasta } = ultimoArco(el!.getAttribute('d')!)
    const cx = attr(pivote, 'cx')
    const cy = attr(pivote, 'cy')
    const dist = (p: [number, number]) => Math.hypot(p[0] - cx, p[1] - cy)
    // Tolerancia de 0.06: las coordenadas del generador salen redondeadas a
    // dos decimales, así que el radio reconstruido no da exacto.
    expect(dist(desde)).toBeCloseTo(rx, 1)
    expect(dist(hasta)).toBeCloseTo(rx, 1)
  })
})
