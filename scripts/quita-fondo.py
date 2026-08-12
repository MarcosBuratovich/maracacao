#!/usr/bin/env python3
"""Quita el fondo plano (blanco o crema) de una ilustración.

Dos pasadas que importan:
1. Componentes conexos del color de fondo: se limpian los que tocan el
   borde Y los bolsones internos grandes (el "babero" blanco encerrado
   entre brazos y cuerpo del changuito). Los brillos chicos (< área
   mínima) se conservan.
2. Alfa suave en el borde de lo limpiado, para no dejar halo sobre
   bandas oscuras.

Uso: python3 scripts/quita-fondo.py <entrada> <salida> <ancho_final>
"""
from PIL import Image
from collections import deque
import sys


def quitar_fondo(src, dst, ancho_final, tol=42, area_min_conservar=250):
    img = Image.open(src).convert('RGBA')
    w, h = img.size
    px = img.load()
    br, bg_, bb, _ = px[2, 2]

    def es_fondo(x, y):
        r, g, b, a = px[x, y]
        return abs(r - br) <= tol and abs(g - bg_) <= tol and abs(b - bb) <= tol

    visit = bytearray(w * h)
    for y0 in range(h):
        for x0 in range(w):
            if visit[y0 * w + x0] or not es_fondo(x0, y0):
                continue
            comp, toca = [], False
            q = deque([(x0, y0)])
            visit[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                if x in (0, w - 1) or y in (0, h - 1):
                    toca = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not visit[ny * w + nx] and es_fondo(nx, ny):
                        visit[ny * w + nx] = 1
                        q.append((nx, ny))
            if toca or len(comp) > area_min_conservar:
                for (x, y) in comp:
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, 0)

    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        r, g, b, a = px[nx, ny]
                        if a == 255:
                            d = max(abs(r - br), abs(g - bg_), abs(b - bb))
                            if d < 110:
                                px[nx, ny] = (r, g, b, min(255, int(d * 2.3)))

    if ancho_final and w > ancho_final:
        img = img.resize((ancho_final, int(h * ancho_final / w)), Image.LANCZOS)
    img.save(dst, quality=90)
    print(dst, img.size)


if __name__ == '__main__':
    quitar_fondo(sys.argv[1], sys.argv[2], int(sys.argv[3]))
