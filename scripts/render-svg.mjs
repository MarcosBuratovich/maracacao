#!/usr/bin/env node
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [entrada, salida, ...resto] = process.argv.slice(2)
if (!entrada || !salida) {
  console.error('Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo #HEX]')
  process.exit(1)
}
const arg = (nombre, def) => {
  const i = resto.indexOf(`--${nombre}`)
  return i === -1 ? def : resto[i + 1]
}

const svg = readFileSync(entrada, 'utf8')
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: Number(arg('ancho', 800)) },
  background: arg('fondo', 'rgba(0,0,0,0)'),
})
mkdirSync(dirname(salida), { recursive: true })
writeFileSync(salida, resvg.render().asPng())
console.log(`${salida} listo`)
