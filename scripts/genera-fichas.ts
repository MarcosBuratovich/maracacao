/* Genera las fichas técnicas de marca en PDF.
 *
 * `pnpm fichas` → docs/fichas/*.pdf
 *
 * El contenido sale VERBATIM de los documentos del cliente (docx
 * 2026-08-14 barras/gotas y 2026-08-17 polvo), con limpieza tipográfica
 * mínima (mayúsculas perdidas por el docx, unidades). La plantilla usa
 * los tokens y las fuentes del sitio: la ficha no se parece a la marca,
 * ES la marca. Imprime Chromium headless (mismo motor con el que se
 * verifica el sitio).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { marca } from '../src/tokens/color'

const RAIZ = resolve(import.meta.dirname, '..')
const SALIDA = resolve(RAIZ, 'docs/fichas')
const TEMPORAL = resolve(RAIZ, 'node_modules/.tmp-fichas')

type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'tabla'; encabezados: string[]; filas: string[][] }

interface Seccion { titulo: string; bloques: Bloque[] }

interface Ficha {
  archivo: string
  producto: string
  denominacion: string
  meta: Array<[string, string]>
  acento: string
  secciones: Seccion[]
}

const p = (texto: string): Bloque => ({ tipo: 'parrafo', texto })
const li = (...items: string[]): Bloque => ({ tipo: 'lista', items })

const FICHAS: Ficha[] = [
  {
    archivo: 'ficha-tecnica-barras-y-gotas',
    producto: 'Chocolate 70% cacao',
    denominacion: 'Chocolate oscuro 70% cacao saborizado con esencias naturales y/o especias',
    acento: marca.rojoHondo,
    meta: [
      ['Marca', 'Maracacao'],
      ['País de elaboración', 'México'],
      ['Presentaciones', 'Barra 70 g · Gotas 250 g (piezas de ±10 g)'],
      ['Vida de anaquel', 'Dos años en condiciones sugeridas'],
    ],
    secciones: [
      {
        titulo: 'Descripción del producto',
        bloques: [
          p('Chocolate oscuro con 70% de cacao, elaborado a partir de chocolate extra oscuro 70% cacao y adicionado con esencias naturales grado alimenticio y/o especias naturales seleccionadas.'),
          p('Producto de sabor intenso a cacao, con notas aromáticas características de la esencia o especia utilizada. Las diferentes variedades Maracacao mantienen como base el mismo chocolate 70% cacao y se diferencian por la esencia natural, especia o combinación utilizada.'),
        ],
      },
      {
        titulo: 'Ingredientes base',
        bloques: [
          p('Licor de cacao, azúcar, manteca de cacao, lecitina de soya y extracto natural de vainilla. Según la variedad se adicionan esencias naturales grado alimenticio y/o especias naturales. Los ingredientes específicos del sabor se declaran en la etiqueta de cada variedad.'),
        ],
      },
      {
        titulo: 'Alérgenos',
        bloques: [p('Contiene soya. Puede contener leche y frutos de cáscara.')],
      },
      {
        titulo: 'Características organolépticas',
        bloques: [
          li(
            'Color: marrón oscuro.',
            'Aroma: característico a chocolate, complementado por las notas propias de la esencia o especia utilizada.',
            'Sabor: característico a chocolate oscuro 70% cacao, libre de sabores anormales y con notas propias de la variedad.',
            'Textura: sólida, firme y homogénea a temperatura ambiente.',
            'Formato: barras (tableta sólida de 70 g) y gotas (piezas de ±10 g en presentación de 250 g).',
          ),
        ],
      },
      {
        titulo: 'Información nutrimental de referencia',
        bloques: [
          p('Valores promedio por 100 g de chocolate base:'),
          {
            tipo: 'tabla',
            encabezados: ['Nutrimento', 'Por 100 g'],
            filas: [
              ['Contenido energético', '600 kcal / 2,510 kJ'],
              ['Grasas totales', '44 g'],
              ['Grasas saturadas', '27 g'],
              ['Grasas trans', '0 g'],
              ['Carbohidratos', '45 g'],
              ['Azúcares totales', '30 g'],
              ['Azúcares añadidos', '29 g'],
              ['Proteínas', '8 g'],
              ['Fibra dietética', '15 g'],
              ['Sodio', '0 g'],
            ],
          },
        ],
      },
      {
        titulo: 'Parámetros de la materia prima',
        bloques: [
          li(
            'Humedad: menor a 1%.',
            'Micrometría: 18–22 µm.',
            'Viscosidad Casson: 500–1,100 mPa·s.',
            'Límite de fluencia Casson: 5–13 Pa.',
          ),
        ],
      },
      {
        titulo: 'Usos',
        bloques: [
          li(
            'Barras de 70 g: producto listo para consumo directo.',
            'Gotas de 10 g: consumo directo y aplicaciones en bebidas, repostería, chocolatería y postres.',
          ),
        ],
      },
      {
        titulo: 'Almacenamiento',
        bloques: [
          p('Conservar en un lugar limpio, fresco y seco, protegido de la luz directa, olores fuertes y fuentes de calor. Temperatura recomendada: 16–20 °C. Humedad relativa: inferior al 60%. Mantener bien cerrado después de abrir. No requiere refrigeración en condiciones normales.'),
        ],
      },
    ],
  },
  {
    archivo: 'ficha-tecnica-chocolate-en-polvo',
    producto: 'Chocolate en polvo',
    denominacion: 'Mezcla en polvo para preparar bebida de chocolate',
    acento: marca.tinta,
    meta: [
      ['Marca', 'Maracacao'],
      ['País de origen', 'México'],
      ['Presentaciones', '250 g · 1 kg'],
      ['Vida de anaquel', 'Dos años en condiciones sugeridas'],
    ],
    secciones: [
      {
        titulo: 'Descripción del producto',
        bloques: [
          p('Chocolate en polvo elaborado con azúcar, cocoa natural, pasta de cacao y cocoa alcalina. La combinación de cocoa natural, cocoa alcalinizada y pasta de cacao aporta color oscuro, aroma y sabor característicos del cacao. Producto diseñado para preparación de bebidas calientes con leche o agua.'),
        ],
      },
      {
        titulo: 'Fórmula del producto',
        bloques: [
          {
            tipo: 'tabla',
            encabezados: ['Ingrediente', 'Porcentaje', 'Por 1 kg'],
            filas: [
              ['Azúcar', '70.60%', '706 g'],
              ['Cocoa natural', '12.00%', '120 g'],
              ['Pasta de cacao', '11.00%', '110 g'],
              ['Cocoa alcalina', '6.00%', '60 g'],
              ['Dióxido de silicio (antiaglomerante)', '0.40%', '4 g'],
              ['Total', '100.00%', '1,000 g'],
            ],
          },
        ],
      },
      {
        titulo: 'Ingredientes',
        bloques: [p('Azúcar, cocoa natural, pasta de cacao, cocoa alcalina y dióxido de silicio (antiaglomerante).')],
      },
      {
        titulo: 'Información nutrimental calculada',
        bloques: [
          p('Por 100 g de producto:'),
          {
            tipo: 'tabla',
            encabezados: ['Nutrimento', 'Cantidad'],
            filas: [
              ['Contenido energético', '395 kcal / 1,654 kJ'],
              ['Proteínas', '6.0 g'],
              ['Grasas totales', '7.8 g'],
              ['Grasas saturadas', '4.5 g'],
              ['Grasas trans', '2.2 mg'],
              ['Hidratos de carbono disponibles', '75.4 g'],
              ['Azúcares', '70.6 g'],
              ['Azúcares añadidos', '70.6 g'],
              ['Fibra dietética', '7.7 g'],
              ['Sodio', '13 mg'],
            ],
          },
          p('Valores calculados a partir de la fórmula del producto y de las declaraciones nutrimentales por 100 g de las materias primas utilizadas.'),
        ],
      },
      {
        titulo: 'Características organolépticas',
        bloques: [
          p('Polvo fino, seco, fluido y homogéneo, de color café oscuro. Aroma característico de cacao y chocolate; sabor dulce, intenso y característico del cacao. Materia extraña: ausente bajo condiciones adecuadas de elaboración y manejo.'),
        ],
      },
      {
        titulo: 'Modo de preparación sugerido',
        bloques: [
          p('Agregar aproximadamente 30 g de chocolate en polvo a 200 ml de leche o agua caliente y mezclar hasta obtener una bebida homogénea. La concentración puede ajustarse al gusto.'),
        ],
      },
      {
        titulo: 'Conservación y control',
        bloques: [
          p('Mantener el envase bien cerrado, en lugar fresco y seco, protegido de humedad, sol directo, fuentes de calor y olores fuertes. Lote y consumo preferente: identificados en el envase. La formulación y la información nutrimental por 100 g son las mismas para ambas presentaciones.'),
        ],
      },
    ],
  },
]

/* ---------- Plantilla ---------- */

const sello = readFileSync(resolve(RAIZ, 'src/assets/brand/sello-mano.svg'), 'utf8')
  .replace('<svg', '<svg aria-hidden="true"')

const fuente = (archivo: string) => `file://${resolve(RAIZ, 'public/fonts', archivo)}`

function bloqueHtml(b: Bloque): string {
  if (b.tipo === 'parrafo') return `<p>${b.texto}</p>`
  if (b.tipo === 'lista') return `<ul>${b.items.map((i) => `<li>${i}</li>`).join('')}</ul>`
  return `<table>
    <thead><tr>${b.encabezados.map((e) => `<th>${e}</th>`).join('')}</tr></thead>
    <tbody>${b.filas
      .map((f) => `<tr>${f.map((c, i) => (i === 0 ? `<td>${c}</td>` : `<td class="cifra">${c}</td>`)).join('')}</tr>`)
      .join('')}</tbody>
  </table>`
}

function fichaHtml(f: Ficha): string {
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Bricolage Grotesque'; src: url('${fuente('bricolage-grotesque-variable.woff2')}') format('woff2'); font-weight: 200 800; }
  @font-face { font-family: 'Trocchi'; src: url('${fuente('trocchi.woff2')}') format('woff2'); }
  @font-face { font-family: 'Courier Prime'; src: url('${fuente('courier-prime.woff2')}') format('woff2'); }
  @font-face { font-family: 'Cormorant Garamond'; src: url('${fuente('cormorant-garamond.woff2')}') format('woff2'); font-weight: 300 700; }

  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: 'Trocchi', Georgia, serif; color: ${marca.tinta}; font-size: 8.9pt; line-height: 1.45; }

  .hoja { padding: 0.55in 0.7in 0.5in; position: relative; min-height: 11in; }

  /* Cabecera de marca */
  header { display: flex; align-items: center; gap: 14pt; border-bottom: 2pt solid ${marca.tinta}; padding-bottom: 10pt; }
  .sello { width: 52pt; flex: none; }
  .sello svg { width: 100%; height: auto; }
  .wordmark { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 17pt; letter-spacing: 0.18em; line-height: 1; }
  .doc-tipo { font-family: 'Courier Prime', monospace; font-size: 7pt; letter-spacing: 0.28em; color: ${marca.rojoHondo}; margin-top: 3pt; text-transform: uppercase; }
  .producto { margin-left: auto; text-align: right; }
  .producto b { display: block; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 15.5pt; letter-spacing: -0.01em; color: ${f.acento}; }
  .producto span { font-size: 8pt; color: ${marca.textoSuave}; }

  /* Meta */
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; background: ${marca.crema}; border-radius: 5pt; padding: 8pt 11pt; margin-top: 10pt; }
  .meta b { display: block; font-family: 'Courier Prime', monospace; font-size: 6.4pt; letter-spacing: 0.14em; text-transform: uppercase; color: ${marca.rojoHondo}; margin-bottom: 2pt; }
  .meta div { font-size: 8.2pt; line-height: 1.35; }

  /* Cuerpo a dos columnas */
  main { column-count: 2; column-gap: 22pt; margin-top: 10pt; }
  section { break-inside: avoid; margin-bottom: 8pt; }
  h2 { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 9.6pt; letter-spacing: 0.02em; color: ${f.acento}; margin: 0 0 4pt; border-bottom: 0.75pt solid ${marca.tinta}33; padding-bottom: 2pt; }
  h2 .n { font-family: 'Courier Prime', monospace; font-size: 7.4pt; color: ${marca.textoSuave}; margin-right: 4pt; }
  p, ul { margin: 0 0 5pt; }
  ul { padding-left: 11pt; }
  li { margin-bottom: 1.5pt; }

  table { width: 100%; border-collapse: collapse; font-size: 8.2pt; margin: 3pt 0 5pt; }
  th { font-family: 'Courier Prime', monospace; font-size: 6.6pt; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; color: ${marca.rojoHondo}; border-bottom: 1pt solid ${marca.tinta}; padding: 2.5pt 6pt 2.5pt 0; white-space: nowrap; }
  td { border-bottom: 0.6pt solid ${marca.tinta}26; padding: 2.2pt 6pt 2.2pt 0; }
  td.cifra { font-family: 'Courier Prime', monospace; font-size: 8pt; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }

  footer { position: absolute; left: 0.7in; right: 0.7in; bottom: 0.42in; display: flex; justify-content: space-between; align-items: baseline; border-top: 0.75pt solid ${marca.tinta}33; padding-top: 6pt; font-family: 'Courier Prime', monospace; font-size: 6.8pt; letter-spacing: 0.08em; color: ${marca.textoSuave}; }
</style>
</head>
<body>
  <div class="hoja">
    <header>
      <span class="sello">${sello}</span>
      <span>
        <span class="wordmark">MARACACAO</span>
        <div class="doc-tipo">Ficha técnica de producto</div>
      </span>
      <span class="producto"><b>${f.producto}</b><span>${f.denominacion}</span></span>
    </header>
    <div class="meta">
      ${f.meta.map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join('')}
    </div>
    <main>
      ${f.secciones
        .map((s, i) => `<section><h2><span class="n">${String(i + 1).padStart(2, '0')}</span>${s.titulo}</h2>${s.bloques.map(bloqueHtml).join('')}</section>`)
        .join('')}
    </main>
    <footer>
      <span>maracacaomx@gmail.com</span>
      <span>@maracacaomx</span>
    </footer>
  </div>
</body>
</html>`
}

/* ---------- Generación ---------- */

mkdirSync(SALIDA, { recursive: true })
mkdirSync(TEMPORAL, { recursive: true })

for (const ficha of FICHAS) {
  const html = resolve(TEMPORAL, `${ficha.archivo}.html`)
  const pdf = resolve(SALIDA, `${ficha.archivo}.pdf`)
  writeFileSync(html, fichaHtml(ficha))
  execFileSync('/usr/bin/google-chrome', [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`,
    `file://${html}`,
  ], { stdio: 'pipe' })
  console.log(`${ficha.archivo}.pdf listo`)
}
