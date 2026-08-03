import { writeFileSync } from 'node:fs'
import { bloqueTheme } from '../src/tokens/css'

const salida = 'src/styles/tokens.generated.css'
writeFileSync(salida, `/* GENERADO por pnpm tokens. No editar a mano. */\n${bloqueTheme()}`)
console.log(`${salida} listo`)
