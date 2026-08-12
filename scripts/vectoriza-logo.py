#!/usr/bin/env python3
"""Vectoriza el logo oficial (marcas oscuras sobre crema) SIN potrace.

Genera public/sitio/logo.svg desde docs/referencias/logo-oficial.jpeg:
binariza, cose los contornos siguiendo las aristas de píxel (multimapa —
los vértices-silla tienen dos salidas y un dict plano las colapsa, bug
que costó encontrar), simplifica con RDP PARTIDO EN DOS MITADES (en un
lazo cerrado la cuerda p0→p0 es degenerada y el RDP directo colapsa
todo) y emite un solo path con fill-rule evenodd.

Correr: python3 scripts/vectoriza-logo.py
"""
from PIL import Image
from collections import defaultdict
import sys

sys.setrecursionlimit(200000)

SRC = 'docs/referencias/logo-oficial.jpeg'
DST = 'public/sitio/logo.svg'
UMBRAL, AREA_MIN, EPS = 150, 18, 1.35

img = Image.open(SRC).convert('L')
w, h = img.size
px = img.load()
oscuro = [[1 if px[x, y] < UMBRAL else 0 for x in range(w)] for y in range(h)]


def es(x, y):
    return 0 <= x < w and 0 <= y < h and oscuro[y][x]


multi = defaultdict(list)
for y in range(h):
    for x in range(w):
        if not oscuro[y][x]:
            continue
        if not es(x, y - 1): multi[(x, y)].append((x + 1, y))
        if not es(x, y + 1): multi[(x + 1, y + 1)].append((x, y + 1))
        if not es(x - 1, y): multi[(x, y + 1)].append((x, y))
        if not es(x + 1, y): multi[(x + 1, y)].append((x + 1, y + 1))

usadas, lazos = set(), []
for inicio, dests in list(multi.items()):
    for d0 in dests:
        if (inicio, d0) in usadas:
            continue
        lazo = [inicio]
        actual, sig = inicio, d0
        while True:
            usadas.add((actual, sig))
            prev = (sig[0] - actual[0], sig[1] - actual[1])
            actual = sig
            if actual == inicio:
                break
            lazo.append(actual)
            sal = [s for s in multi[actual] if (actual, s) not in usadas]
            if not sal:
                break
            if len(sal) == 1:
                sig = sal[0]
            else:
                dx, dy = prev
                izq = (dy, -dx)
                sig = next((s for s in sal if (s[0] - actual[0], s[1] - actual[1]) == izq), sal[0])
        if actual == inicio:
            lazos.append(lazo)


def area(l):
    s = 0
    for i in range(len(l)):
        x1, y1 = l[i]
        x2, y2 = l[(i + 1) % len(l)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def rdp(p, eps):
    if len(p) < 3:
        return p
    (x1, y1), (x2, y2) = p[0], p[-1]
    dx, dy = x2 - x1, y2 - y1
    n = (dx * dx + dy * dy) ** 0.5 or 1e-9
    imax, dmax = 0, -1.0
    for i in range(1, len(p) - 1):
        d = abs(dy * (p[i][0] - x1) - dx * (p[i][1] - y1)) / n
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        a = rdp(p[:imax + 1], eps)
        b = rdp(p[imax:], eps)
        return a[:-1] + b
    return [p[0], p[-1]]


def simplifica_cerrado(lazo, eps):
    m = len(lazo) // 2
    a = rdp(lazo[:m + 1], eps)
    b = rdp(lazo[m:] + [lazo[0]], eps)
    return a[:-1] + b[:-1]


partes = []
for lazo in lazos:
    if area(lazo) < AREA_MIN:
        continue
    s = simplifica_cerrado(lazo, EPS)
    if len(s) < 3:
        continue
    partes.append(f'M{s[0][0]} {s[0][1]}' + ''.join(f'L{x} {y}' for x, y in s[1:]) + 'Z')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
       f'<path fill="#452A10" fill-rule="evenodd" d="{"".join(partes)}"/></svg>')
open(DST, 'w').write(svg)
print(f'{DST}: {len(partes)} contornos, {len(svg) // 1024} KB')
