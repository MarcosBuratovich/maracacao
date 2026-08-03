#!/usr/bin/env node
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const [entrada, salida, ...resto] = process.argv.slice(2)
if (!entrada || !salida) {
  console.error('Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo \'#HEX\']')
  console.error('Ejemplo: pnpm render input.svg output.png --ancho 200 --fondo \'#FAF3E0\'')
  process.exit(1)
}

// Función para obtener argumentos nombrados con validación estricta
const arg = (nombre, def) => {
  const i = resto.indexOf(`--${nombre}`)
  if (i === -1) {
    return def
  }
  // El flag existe: el siguiente elemento debe existir y no puede ser otro flag
  if (i + 1 >= resto.length) {
    console.error(`Error: --${nombre} requiere un valor`)
    console.error('Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo \'#HEX\']')
    process.exit(1)
  }
  const valor = resto[i + 1]
  if (valor.startsWith('--')) {
    console.error(`Error: --${nombre} requiere un valor, pero se encontró otro flag`)
    console.error('Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo \'#HEX\']')
    process.exit(1)
  }
  return valor
}

const anchoStr = arg('ancho', '800')
const ancho = Number(anchoStr)
if (!Number.isFinite(ancho) || ancho <= 0) {
  console.error(`Error: --ancho debe ser un número positivo (recibido: '${anchoStr}')`)
  console.error('Uso: render-svg <entrada.svg> <salida.png> [--ancho N] [--fondo \'#HEX\']')
  process.exit(1)
}

const svg = readFileSync(entrada, 'utf8')
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: ancho },
  background: arg('fondo', 'rgba(0,0,0,0)'),
})
mkdirSync(dirname(salida), { recursive: true })
writeFileSync(salida, resvg.render().asPng())
console.log(`${salida} listo`)
