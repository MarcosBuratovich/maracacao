#!/usr/bin/env python3
"""Genera la plantilla Word de fichas técnicas para el cliente.

    python3 scripts/genera-plantilla-docx.py

Produce docs/fichas/plantilla-ficha-tecnica-maracacao.docx precargada
con la ficha oficial de barras (el ejemplo enseña el formato) y
docs/fichas/tipografias-maracacao.zip con las fuentes a instalar.

Réplica del diseño de los PDF hasta donde Word permite: cabecera con
sello y wordmark, banda crema de metadatos, cuerpo a dos columnas con
secciones numeradas, tablas con cifras en Courier y pie con contacto.
La última hoja trae las instrucciones (el cliente la borra al usarla).

Insumos preparados en el scratchpad de la sesión (sello.png, TTFs y el
JSON de la ficha); si no existen, correr primero los pasos de
preparación documentados en el historial del repo (commit de esta
plantilla).
"""
import json
import os
import zipfile
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

SCRATCH = '/tmp/claude-1000/-home-buratovich-dev-Chocolateria/a70b2ef6-df56-40aa-87cd-45a659228c2d/scratchpad/plantilla-docx'
SALIDA = 'docs/fichas'

TINTA = RGBColor(0x4C, 0x2C, 0x16)
ROJO_HONDO = RGBColor(0x7D, 0x03, 0x03)
SUAVE = RGBColor(0x7A, 0x60, 0x4A)
CREMA = 'F8ECDE'

BRICOLAGE = 'Bricolage Grotesque'
TROCCHI = 'Trocchi'
COURIER = 'Courier Prime'
CORMORANT = 'Cormorant Garamond Medium'

ficha = json.load(open(f'{SCRATCH}/ficha-barras.json'))


def fuente(run, nombre, tamano, color=TINTA, negrita=False, espaciado=None):
    run.font.name = nombre
    r = run._element.get_or_add_rPr()
    rf = r.find(qn('w:rFonts'))
    rf.set(qn('w:cs'), nombre)
    run.font.size = Pt(tamano)
    run.font.color.rgb = color
    run.font.bold = negrita
    if espaciado is not None:
        esp = parse_xml(f'<w:spacing {nsdecls("w")} w:val="{espaciado}"/>')
        r.append(esp)


def sombrea(celda, hexa):
    celda._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hexa}"/>'))


def sin_bordes(tabla):
    tabla._tbl.tblPr.append(parse_xml(
        f'<w:tblBorders {nsdecls("w")}>' + ''.join(
            f'<w:{lado} w:val="none"/>' for lado in
            ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')
        ) + '</w:tblBorders>'))


def borde_inferior(parrafo, grosor=6, color='4C2C16'):
    pPr = parrafo._p.get_or_add_pPr()
    pPr.append(parse_xml(
        f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="{grosor}" w:color="{color}"/></w:pBdr>'))


def borde_celda_abajo(celda, grosor=4, color='B8A895'):
    celda._tc.get_or_add_tcPr().append(parse_xml(
        f'<w:tcBorders {nsdecls("w")}><w:bottom w:val="single" w:sz="{grosor}" w:color="{color}"/></w:tcBorders>'))


doc = Document()

# ---------- Página y estilo base ----------
seccion0 = doc.sections[0]
seccion0.page_width = Inches(8.5)
seccion0.page_height = Inches(11)
for lado in ('left_margin', 'right_margin'):
    setattr(seccion0, lado, Inches(0.7))
seccion0.top_margin = Inches(0.55)
seccion0.bottom_margin = Inches(0.7)

normal = doc.styles['Normal']
normal.font.name = TROCCHI
normal.font.size = Pt(9.5)
normal.font.color.rgb = TINTA
normal.paragraph_format.space_after = Pt(4)
normal.paragraph_format.line_spacing = 1.15

# ---------- Cabecera de marca ----------
cab = doc.add_table(rows=1, cols=3)
cab.columns[0].width = Inches(0.85)
cab.columns[1].width = Inches(3.6)
cab.columns[2].width = Inches(2.65)
sin_bordes(cab)

c_sello = cab.cell(0, 0).paragraphs[0]
c_sello.add_run().add_picture(f'{SCRATCH}/sello.png', width=Inches(0.72))

c_marca = cab.cell(0, 1).paragraphs[0]
r = c_marca.add_run('MARACACAO')
fuente(r, CORMORANT, 17, TINTA, espaciado=54)
c_tipo = cab.cell(0, 1).add_paragraph()
r = c_tipo.add_run('FICHA TÉCNICA DE PRODUCTO')
fuente(r, COURIER, 7, ROJO_HONDO, espaciado=56)

c_prod = cab.cell(0, 2).paragraphs[0]
c_prod.alignment = WD_ALIGN_PARAGRAPH.RIGHT
r = c_prod.add_run(ficha['producto'])
fuente(r, BRICOLAGE, 15, ROJO_HONDO, negrita=True)
c_den = cab.cell(0, 2).add_paragraph()
c_den.alignment = WD_ALIGN_PARAGRAPH.RIGHT
r = c_den.add_run(ficha['denominacion'])
fuente(r, TROCCHI, 8, SUAVE)

raya = doc.add_paragraph()
raya.paragraph_format.space_before = Pt(4)
raya.paragraph_format.space_after = Pt(8)
borde_inferior(raya, grosor=14)

# ---------- Banda de metadatos ----------
meta = doc.add_table(rows=1, cols=4)
sin_bordes(meta)
for i, (clave, valor) in enumerate(ficha['meta'][:4]):
    celda = meta.cell(0, i)
    sombrea(celda, CREMA)
    p1 = celda.paragraphs[0]
    p1.paragraph_format.space_after = Pt(1)
    r = p1.add_run(clave.upper())
    fuente(r, COURIER, 6.5, ROJO_HONDO, espaciado=24)
    p2 = celda.add_paragraph()
    p2.paragraph_format.space_after = Pt(2)
    r = p2.add_run(valor)
    fuente(r, TROCCHI, 8.5, TINTA)

doc.add_paragraph().paragraph_format.space_after = Pt(2)

# ---------- Cuerpo a dos columnas ----------
cuerpo = doc.add_section(WD_SECTION.CONTINUOUS)
cols = cuerpo._sectPr.xpath('./w:cols')[0]
cols.set(qn('w:num'), '2')
cols.set(qn('w:space'), '360')

for n, seccion in enumerate(ficha['secciones'], start=1):
    titulo = doc.add_paragraph()
    titulo.paragraph_format.space_before = Pt(6)
    titulo.paragraph_format.space_after = Pt(3)
    titulo.paragraph_format.keep_with_next = True
    r = titulo.add_run(f'{n:02d}  ')
    fuente(r, COURIER, 7.5, SUAVE)
    r = titulo.add_run(seccion['titulo'])
    fuente(r, BRICOLAGE, 10, ROJO_HONDO, negrita=True)
    borde_inferior(titulo, grosor=4, color='C9BBA8')

    for bloque in seccion['bloques']:
        if bloque['tipo'] == 'parrafo':
            doc.add_paragraph(bloque['texto'])
        elif bloque['tipo'] == 'lista':
            for item in bloque['items']:
                p = doc.add_paragraph(item, style='List Bullet')
                p.paragraph_format.space_after = Pt(1)
                p.paragraph_format.left_indent = Inches(0.16)
        else:  # tabla
            tabla = doc.add_table(rows=1 + len(bloque['filas']), cols=len(bloque['encabezados']))
            sin_bordes(tabla)
            # Dentro de la sección a dos columnas, la tabla necesita
            # ancho explícito o desborda la columna (≈3.4 in por columna
            # de página): primera celda 60 %, el resto reparte.
            ancho_total = Inches(3.35)
            n_cols = len(bloque['encabezados'])
            anchos = [Inches(3.35 * 0.58)] + [Inches(3.35 * 0.42 / max(1, n_cols - 1))] * (n_cols - 1)
            tabla.autofit = False
            tabla._tbl.tblPr.append(parse_xml(
                f'<w:tblW {nsdecls("w")} w:w="{int(ancho_total.inches * 1440)}" w:type="dxa"/>'))
            for fila_t in tabla.rows:
                for j, celda_t in enumerate(fila_t.cells):
                    celda_t.width = anchos[j]
            for j, enc in enumerate(bloque['encabezados']):
                celda = tabla.cell(0, j)
                r = celda.paragraphs[0].add_run(enc.upper())
                fuente(r, COURIER, 6.5, ROJO_HONDO, espaciado=16)
                borde_celda_abajo(celda, grosor=8, color='4C2C16')
            for i, fila in enumerate(bloque['filas'], start=1):
                for j, valor in enumerate(fila):
                    celda = tabla.cell(i, j)
                    r = celda.paragraphs[0].add_run(valor)
                    if j == 0:
                        fuente(r, TROCCHI, 8.5, TINTA)
                    else:
                        fuente(r, COURIER, 8, TINTA)
                    if i < len(bloque['filas']):
                        borde_celda_abajo(celda)
            doc.add_paragraph().paragraph_format.space_after = Pt(1)

# ---------- Pie de página ----------
pie = seccion0.footer.paragraphs[0]
pie.paragraph_format.tab_stops.add_tab_stop(Inches(7.1), WD_TAB_ALIGNMENT.RIGHT)
r = pie.add_run('maracacaomx@gmail.com')
fuente(r, COURIER, 7, SUAVE, espaciado=16)
r = pie.add_run('\t@maracacaomx')
fuente(r, COURIER, 7, SUAVE, espaciado=16)

# ---------- Hoja de instrucciones (el cliente la borra) ----------
instr = doc.add_section(WD_SECTION.NEW_PAGE)
instr._sectPr.xpath('./w:cols')[0].set(qn('w:num'), '1')

t = doc.add_paragraph()
r = t.add_run('CÓMO USAR ESTA PLANTILLA')
fuente(r, BRICOLAGE, 14, ROJO_HONDO, negrita=True)
s = doc.add_paragraph()
r = s.add_run('(Borra esta hoja antes de guardar o enviar la ficha.)')
fuente(r, TROCCHI, 9.5, SUAVE)

pasos = [
    'Duplica este archivo y renómbralo con el producto nuevo (por ejemplo «Ficha técnica — Gotas sabor X»).',
    'Reemplaza los textos: el nombre del producto arriba a la derecha, los cuatro datos de la banda crema y el contenido de cada sección. El texto de ejemplo es la ficha real del chocolate 70%: te muestra el tono y el nivel de detalle.',
    'Para agregar una sección, copia un título existente con su número y pégalo donde la necesites; corrige la numeración.',
    'En las tablas puedes agregar filas con clic derecho → Insertar. Mantén las cifras en la fuente Courier Prime para que se alineen.',
    'No cambies colores ni fuentes: son los de la marca.',
    'Al terminar: Archivo → Guardar como PDF.',
]
for paso in pasos:
    p = doc.add_paragraph(paso, style='List Number')
    p.paragraph_format.space_after = Pt(4)

t2 = doc.add_paragraph()
t2.paragraph_format.space_before = Pt(10)
r = t2.add_run('TIPOGRAFÍAS')
fuente(r, BRICOLAGE, 11, ROJO_HONDO, negrita=True)
p = doc.add_paragraph(
    'Para que la ficha se vea con las letras de la marca, instala una vez '
    'las fuentes del archivo «tipografias-maracacao.zip» que acompaña esta '
    'plantilla: descomprime y haz doble clic en cada una → Instalar. Son '
    'gratuitas y de licencia abierta. Si no las instalas, el documento se '
    've con fuentes sustitutas (funciona, pero no es la marca).'
)

os.makedirs(SALIDA, exist_ok=True)
ruta_docx = f'{SALIDA}/plantilla-ficha-tecnica-maracacao.docx'
doc.save(ruta_docx)
print(f'{ruta_docx} listo')

# ---------- Paquete de tipografías ----------
ruta_zip = f'{SALIDA}/tipografias-maracacao.zip'
with zipfile.ZipFile(ruta_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(f'{SCRATCH}/fuentes')):
        z.write(f'{SCRATCH}/fuentes/{f}', f'tipografias-maracacao/{f}')
    z.writestr(
        'tipografias-maracacao/LEEME.txt',
        'Tipografías de la marca Maracacao para la plantilla de fichas.\n'
        'Instalación: doble clic en cada archivo .ttf y luego «Instalar».\n'
        'Licencia: SIL Open Font License (gratuitas, uso comercial permitido).\n',
    )
print(f'{ruta_zip} listo')
