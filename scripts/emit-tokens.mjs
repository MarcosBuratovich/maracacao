import { writeFileSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Compilar y ejecutar TypeScript dinámicamente
async function compileAndRequire(filePath) {
  const source = readFileSync(filePath, 'utf-8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  })

  const tempFile = path.resolve(__dirname, `.temp-${Date.now()}.mjs`)
  writeFileSync(tempFile, result.outputText)

  const mod = await import(`file://${tempFile}`)
  return mod
}

// Import dinámico de los módulos compilados
async function main() {
  // Cargar módulos de color
  const colorPath = path.resolve(projectRoot, 'src/tokens/color.ts')
  const color = await compileAndRequire(colorPath)

  // Cargar módulos de type
  const typePath = path.resolve(projectRoot, 'src/tokens/type.ts')
  const type = await compileAndRequire(typePath)

  // Cargar módulos de motion
  const motionPath = path.resolve(projectRoot, 'src/tokens/motion.ts')
  const motion = await compileAndRequire(motionPath)

  // Crear CSS inline sin necesidad de compilar css.ts
  const { verde, tan, fijos, roles } = color
  const { familias, escala } = type
  const { duraciones, easings } = motion

  function customProperties() {
    const props = {}
    for (const [paso, hex] of Object.entries(verde)) props[`--mrc-verde-${paso}`] = hex
    for (const [paso, hex] of Object.entries(tan)) props[`--mrc-tan-${paso}`] = hex
    for (const [nombre, hex] of Object.entries(fijos)) props[`--mrc-${nombre}`] = hex
    for (const [rol, hex] of Object.entries(roles)) props[`--mrc-rol-${rol}`] = hex
    for (const [nombre, valor] of Object.entries(familias)) props[`--mrc-font-${nombre}`] = valor
    for (const [nombre, valor] of Object.entries(escala)) props[`--mrc-text-${nombre}`] = valor
    for (const [nombre, ms] of Object.entries(duraciones)) props[`--mrc-dur-${nombre}`] = `${ms}ms`
    for (const [nombre, valor] of Object.entries(easings)) props[`--mrc-ease-${nombre}`] = valor
    return props
  }

  function bloqueTheme() {
    const lineas = Object.entries(customProperties())
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')
    return `@theme {\n${lineas}\n}\n`
  }

  const salida = path.resolve(projectRoot, 'src/styles/tokens.generated.css')
  writeFileSync(salida, `/* GENERADO por pnpm tokens. No editar a mano. */\n${bloqueTheme()}`)
  console.log(`${path.relative(projectRoot, salida)} listo`)
}

main().catch(console.error)
