#!/usr/bin/env python3
"""Extrae los quince diseños de envoltura desde los PDF del diseñador.

Cada PDF trae la envoltura desplegada: dorso a la izquierda (ingredientes)
y frente a la derecha (marca, ilustración, sabor y gramaje), con marcas de
corte alrededor. Los textos son vectoriales y las ilustraciones van a
300-550 ppi, así que esta es la fuente de verdad: mejor que cualquier foto
y con el color exacto del diseño, no medido de una imagen.

De cada archivo salen:
  · frente y dorso recortados, en webp, listos para la web y para el 3D
  · el color exacto del fondo
  · sabor, porcentaje de cacao e ingredientes, leídos del propio PDF

Uso: python3 scripts/extrae-envolturas.py <carpeta-de-pdfs>
Salida: public/sitio/envoltura/ + docs/envolturas.json
"""
from PIL import Image
import json, os, re, subprocess, sys, tempfile

DPI = 300
DESTINO = 'public/sitio/envoltura'
FICHA = 'docs/envolturas.json'


def render(pdf, dpi=DPI):
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, 'p')
        subprocess.run(['pdftoppm', '-png', '-r', str(dpi), pdf, base], check=True)
        salida = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
        return Image.open(os.path.join(tmp, salida[0])).convert('RGB').copy()


def recortar_arte(im):
    """Deja solo el rectángulo impreso: fuera el margen blanco del PDF y
    las marcas de corte.

    Buscar "mayoría del color de fondo" no sirve — el escaneo se corta al
    llegar a la ilustración o al texto, que no son del color de fondo.
    Lo que sí es estable: el rectángulo impreso ocupa casi todo el ancho
    y el alto, y las marcas de corte son líneas finas. Así que se toman
    las filas y columnas donde MÁS DE LA MITAD de los píxeles no son
    blancos."""
    w, h = im.size
    px = im.load()

    def blanco(p, u=238):
        return p[0] >= u and p[1] >= u and p[2] >= u

    filas = [
        sum(0 if blanco(px[x, y]) else 1 for x in range(0, w, 4)) > (w // 4) * 0.5
        for y in range(h)
    ]
    cols = [
        sum(0 if blanco(px[x, y]) else 1 for y in range(0, h, 4)) > (h // 4) * 0.5
        for x in range(w)
    ]
    y0, y1 = filas.index(True), h - 1 - filas[::-1].index(True)
    x0, x1 = cols.index(True), w - 1 - cols[::-1].index(True)
    arte = im.crop((x0, y0, x1 + 1, y1 + 1))

    # El color exacto del diseño: esquina superior izquierda del impreso,
    # que en todas las envolturas es fondo plano.
    aw, ah = arte.size
    fondo = arte.crop((int(aw * 0.02), int(ah * 0.02), int(aw * 0.08), int(ah * 0.10)))
    fondo = fondo.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return arte, '#%02X%02X%02X' % fondo


def datos(pdf):
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'],
                         capture_output=True, text=True).stdout
    plano = ' '.join(txt.split())
    cacao = re.search(r'Cacao\s+(\d{2})\s*%', plano)
    ing = re.search(r'Ingredientes:\s*(.+?)\s*(?:Cacao|$)', plano)
    return {
        'cacao': f'{cacao.group(1)}%' if cacao else None,
        'ingredientes': re.sub(r'\s+', ' ', ing.group(1)).strip(' .') + '.' if ing else None,
    }


def clave(nombre):
    """`4_#12. Mango con chile  (17 x 14.5 cm).pdf` -> `mango-con-chile`."""
    n = re.sub(r'^\d+_\s*#?\d*\.?\s*', '', nombre)
    n = re.sub(r'\s*\(.*$', '', n).strip().lower()
    for a, b in (('á','a'),('é','e'),('í','i'),('ó','o'),('ú','u'),('ñ','n')):
        n = n.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', n).strip('-')


if __name__ == '__main__':
    carpeta = sys.argv[1]
    os.makedirs(DESTINO, exist_ok=True)
    fichas = {}
    for archivo in sorted(os.listdir(carpeta)):
        if not archivo.lower().endswith('.pdf'):
            continue
        ruta = os.path.join(carpeta, archivo)
        k = clave(archivo)
        arte, color = recortar_arte(render(ruta))
        w, h = arte.size
        # dorso a la izquierda, frente a la derecha
        dorso = arte.crop((0, 0, w // 2, h))
        frente = arte.crop((w // 2, 0, w, h))
        for cara, img in (('frente', frente), ('dorso', dorso)):
            img.save(f'{DESTINO}/{k}-{cara}.webp', quality=88, method=6)
        fichas[k] = {'color': color, 'ancho': w, 'alto': h, **datos(ruta)}
        print(f'{k:26s} {color}  {w}x{h}  cacao {fichas[k]["cacao"]}')
    json.dump(fichas, open(FICHA, 'w'), ensure_ascii=False, indent=2)
    print(f'\n{len(fichas)} envolturas -> {DESTINO} + {FICHA}')
