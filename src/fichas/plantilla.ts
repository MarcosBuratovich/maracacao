/* La plantilla de las fichas técnicas — compartida.
 *
 * La consume scripts/genera-fichas.ts (pnpm fichas → docs/fichas/*.pdf).
 * El generador en línea /fichas que también la usaba se eliminó
 * (2026-08-18, decisión de Marcos): el cliente recibe una plantilla
 * Word — ver scripts/genera-plantilla-docx.py.
 */
import { marca } from '@/tokens/color'

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'tabla'; encabezados: string[]; filas: string[][] }

export interface Seccion {
  titulo: string
  bloques: Bloque[]
}

export interface Ficha {
  archivo: string
  producto: string
  denominacion: string
  meta: Array<[string, string]>
  acento: string
  secciones: Seccion[]
}

export const p = (texto: string): Bloque => ({ tipo: 'parrafo', texto })
export const li = (...items: string[]): Bloque => ({ tipo: 'lista', items })

/* ---------- Render ---------- */

const escapa = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function bloqueHtml(b: Bloque): string {
  if (b.tipo === 'parrafo') return `<p>${escapa(b.texto)}</p>`
  if (b.tipo === 'lista') return `<ul>${b.items.map((i) => `<li>${escapa(i)}</li>`).join('')}</ul>`
  return `<table>
    <thead><tr>${b.encabezados.map((e) => `<th>${escapa(e)}</th>`).join('')}</tr></thead>
    <tbody>${b.filas
      .map((f) => `<tr>${f.map((c, i) => (i === 0 ? `<td>${escapa(c)}</td>` : `<td class="cifra">${escapa(c)}</td>`)).join('')}</tr>`)
      .join('')}</tbody>
  </table>`
}

/**
 * El documento completo de una ficha.
 * @param rutaFuentes base de los woff2 — `/fonts` en el sitio,
 *   `file:///…/public/fonts` en el generador local.
 * @param sello el SVG del sello, inline.
 */
export function fichaHtml(f: Ficha, rutaFuentes: string, sello: string): string {
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'Bricolage Grotesque'; src: url('${rutaFuentes}/bricolage-grotesque-variable.woff2') format('woff2'); font-weight: 200 800; }
  @font-face { font-family: 'Trocchi'; src: url('${rutaFuentes}/trocchi.woff2') format('woff2'); }
  @font-face { font-family: 'Courier Prime'; src: url('${rutaFuentes}/courier-prime.woff2') format('woff2'); }
  @font-face { font-family: 'Cormorant Garamond'; src: url('${rutaFuentes}/cormorant-garamond.woff2') format('woff2'); font-weight: 300 700; }

  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: 'Trocchi', Georgia, serif; color: ${marca.tinta}; font-size: 8.9pt; line-height: 1.45; background: #fff; }

  .hoja { padding: 0.55in 0.7in 0.5in; position: relative; min-height: 11in; }

  header { display: flex; align-items: center; gap: 14pt; border-bottom: 2pt solid ${marca.tinta}; padding-bottom: 10pt; }
  .sello { width: 52pt; flex: none; }
  .sello svg { width: 100%; height: auto; }
  .wordmark { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 17pt; letter-spacing: 0.18em; line-height: 1; }
  .doc-tipo { font-family: 'Courier Prime', monospace; font-size: 7pt; letter-spacing: 0.28em; color: ${marca.rojoHondo}; margin-top: 3pt; text-transform: uppercase; }
  .producto { margin-left: auto; text-align: right; }
  .producto b { display: block; font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 15.5pt; letter-spacing: -0.01em; color: ${f.acento}; }
  .producto span { font-size: 8pt; color: ${marca.textoSuave}; }

  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; background: ${marca.crema}; border-radius: 5pt; padding: 8pt 11pt; margin-top: 10pt; }
  .meta b { display: block; font-family: 'Courier Prime', monospace; font-size: 6.4pt; letter-spacing: 0.14em; text-transform: uppercase; color: ${marca.rojoHondo}; margin-bottom: 2pt; }
  .meta div { font-size: 8.2pt; line-height: 1.35; }

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
      <span class="producto"><b>${escapa(f.producto)}</b><span>${escapa(f.denominacion)}</span></span>
    </header>
    <div class="meta">
      ${f.meta
        .filter(([k, v]) => k.trim() && v.trim())
        .map(([k, v]) => `<div><b>${escapa(k)}</b>${escapa(v)}</div>`)
        .join('')}
    </div>
    <main>
      ${f.secciones
        .filter((s) => s.titulo.trim())
        .map(
          (s, i) =>
            `<section><h2><span class="n">${String(i + 1).padStart(2, '0')}</span>${escapa(s.titulo)}</h2>${s.bloques.map(bloqueHtml).join('')}</section>`,
        )
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
