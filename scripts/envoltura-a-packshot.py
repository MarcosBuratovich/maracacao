#!/usr/bin/env python3
"""De una foto de barra a una imagen de producto limpia.

Tres pasos, todos sin dependencias fuera de Pillow:

1. RECTIFICAR — la cara impresa de la envoltura se mapea a un rectángulo
   (transformación QUAD): se va la perspectiva y queda el arte plano.
2. APLANAR LA LUZ — la iluminación del estudio es la componente de baja
   frecuencia de la imagen: se divide el pixel por ella y se reescala al
   promedio. Queda color parejo, como si fuera arte digital.
3. MONTAR EL PACKSHOT — sobre la textura plana se reconstruye el volumen:
   sombreado cilíndrico suave (la barra no es plana), crimpado de foil
   arriba y abajo, esquinas redondeadas y sombra propia. Sale un PNG con
   transparencia, del mismo tamaño para todos los sabores.

Uso:
  python3 scripts/envoltura-a-packshot.py <foto> <salida.png> x0,y0 x1,y1 x2,y2 x3,y3
  (las cuatro esquinas de la cara impresa, en orden NO, NE, SE, SO)

Ejemplo verificado (barra de mango con chile):
  python3 scripts/envoltura-a-packshot.py \\
    docs/referencias/etiquetas/foto-barra-mango-chile.jpeg \\
    public/sitio/packshot/mango-chile.png \\
    325,205 775,192 778,1108 327,1120
"""
from PIL import Image, ImageDraw, ImageFilter, ImageStat
import sys, os

ANCHO, ALTO = 470, 940          # textura de trabajo
CRIMP = 0.028                   # alto del foil, en fracción del total


def rectificar(foto, esquinas):
    im = Image.open(foto).convert('RGB')
    no, ne, se, so = esquinas
    # PIL espera el cuadrilátero fuente en orden NO, SO, SE, NE
    quad = (*no, *so, *se, *ne)
    return im.transform((ANCHO, ALTO), Image.QUAD, quad, Image.BICUBIC)


def aplanar_luz(img):
    w, h = img.size
    luz = img.filter(ImageFilter.GaussianBlur(radius=max(10, min(w, h) // 5)))
    media = ImageStat.Stat(luz).mean
    salida = [
        (
            min(255, int(r / max(lr, 1) * media[0])),
            min(255, int(g / max(lg, 1) * media[1])),
            min(255, int(b / max(lb, 1) * media[2])),
        )
        for (r, g, b), (lr, lg, lb) in zip(img.getdata(), luz.getdata())
    ]
    plano = Image.new('RGB', img.size)
    plano.putdata(salida)
    return plano


def packshot(textura):
    """Le devuelve el volumen a la textura plana."""
    w, h = textura.size
    barra = textura.copy()

    # Sombreado cilíndrico: la barra se curva, así que los bordes
    # verticales caen y hay un realce apenas a un tercio del ancho.
    sombra = Image.new('L', (w, 1))
    px = sombra.load()
    for x in range(w):
        t = x / (w - 1)
        # borde oscuro a los lados, brillo suave hacia la izquierda
        v = 1.0 - 0.30 * (2 * t - 1) ** 2 + 0.10 * max(0.0, 1 - abs(t - 0.34) * 4)
        px[x, 0] = max(0, min(255, int(v * 255)))
    sombra = sombra.resize((w, h))
    barra = Image.composite(barra, Image.new('RGB', (w, h), (0, 0, 0)), sombra)

    # Crimpado de foil arriba y abajo
    alto_crimp = int(h * CRIMP)
    foil = Image.new('RGB', (w, alto_crimp), (214, 210, 202))
    df = ImageDraw.Draw(foil)
    for i in range(0, w, 7):
        df.line([(i, 0), (i - 4, alto_crimp)], fill=(178, 174, 166), width=2)
    foil = foil.filter(ImageFilter.GaussianBlur(0.6))
    lienzo = Image.new('RGB', (w, h + alto_crimp * 2), (255, 255, 255))
    lienzo.paste(foil, (0, 0))
    lienzo.paste(barra, (0, alto_crimp))
    lienzo.paste(foil.transpose(Image.FLIP_TOP_BOTTOM), (0, alto_crimp + h))

    # Esquinas redondeadas y alfa
    W, H = lienzo.size
    mascara = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, W - 1, H - 1], radius=int(W * 0.03), fill=255)
    salida = Image.new('RGBA', (W, H))
    salida.paste(lienzo, (0, 0))
    salida.putalpha(mascara)
    return salida


if __name__ == '__main__':
    foto, destino = sys.argv[1], sys.argv[2]
    esquinas = [tuple(int(v) for v in p.split(',')) for p in sys.argv[3:7]]
    plano = aplanar_luz(rectificar(foto, esquinas))
    os.makedirs(os.path.dirname(destino) or '.', exist_ok=True)
    plano.save(destino.replace('.png', '-plano.png'))
    packshot(plano).save(destino)
    print(f'{destino}  (arte plano: {destino.replace(".png", "-plano.png")})')
