// Genera public/favicon.svg — el sello circular del §8 del spec ("Favicon,
// avatar de redes"): la cabeza reducida sobre el círculo verde-600, mismo
// par que SelloCircular.astro. Generado, no dibujado a mano: el color sale
// de src/tokens/color.ts y el dibujo de src/assets/brand/mascota-reducida.svg
// (cuyo punto más lejano cae a ~94% del medio-canvas — cabe en el círculo
// sin recorte, medido en la Task 14). Regenerar con `pnpm favicon`.
//
// A 16px la cara degrada a "forma de mono" — esperable y aceptado en el
// handoff; si algún día molesta, ahí vive la nota sobre una variante
// solo-silueta.
import { readFileSync, writeFileSync } from 'node:fs'
import { verde } from '../src/tokens/color'

const crudo = readFileSync('src/assets/brand/mascota-reducida.svg', 'utf8')
const interior = crudo
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')

const favicon = `<!-- GENERADO por pnpm favicon. No editar a mano. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="256" fill="${verde[600]}"/>
${interior}
</svg>
`

writeFileSync('public/favicon.svg', favicon)
console.log('public/favicon.svg generado')
