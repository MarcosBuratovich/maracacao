/*
 * Los contenidos malos conocidos, y la ruta exacta donde tiene que salir
 * el problema.
 *
 * Que salga la ruta correcta importa tanto como que falle: el panel usa
 * `Problema.campo` para llevar a la clienta al campo, y mandarla a
 * corregir uno que está bien es peor que no decirle nada.
 *
 * Cada caso arranca del contenido REAL —el fixture— y le cambia UNA cosa.
 * Así lo que falla es la mutación y no un contenido de prueba mal armado.
 */
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/contenido-2026-09-10.json'
import { esquemaSitio } from '@/contenido/esquema/sitio'
import { esquemaSabores } from '@/contenido/esquema/sabores'
import { esquemaFichas } from '@/contenido/esquema/fichas'
import { validar } from '@/contenido/validacion'

const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, recetas: 4, preguntas: 8, pasos: 6, ingredientes: 5 }

/** El contenido real, con una cosa cambiada. */
const conCambio = (
  base: unknown,
  cambia: (d: Record<string, never>) => void,
): unknown => {
  const copia = structuredClone(base) as Record<string, never>
  cambia(copia)
  return copia
}

const sitio = () => structuredClone(fixture.marca)
const productos = () => ({
  urlCatalogoBarras: fixture.urlCatalogoBarras,
  sabores: structuredClone(fixture.sabores),
  gotas: structuredClone(fixture.gotas),
  polvo: structuredClone(fixture.polvo),
})

describe('el sitio: lo que impide publicar', () => {
  const casos: [string, (d: any) => void, string][] = [
    ['el titular sin la coma final',            (d) => { d.hero.titular[1] = 'MEXICANO' },                    'hero.titular.1'],
    ['el titular con dos comas',                (d) => { d.hero.titular[1] = '70% CACAO, DE VERDAD,' },       'hero.titular.1'],
    ['un renglón de más en el titular',         (d) => { d.hero.titular.push('Y PUNTO.') },                   'hero.titular'],
    ['un renglón de menos en el titular',       (d) => { d.hero.titular.pop() },                              'hero.titular'],
    ['la insignia con espacio normal',          (d) => { d.anaquel.pesoInsignia = '70 g' },                   'anaquel.pesoInsignia'],
    ['la insignia vacía',                       (d) => { d.anaquel.pesoInsignia = '   ' },                    'anaquel.pesoInsignia'],
    ['una palabra que la marca no usa',         (d) => { d.gotas.cuerpo = 'Nuestras chispas de chocolate.' }, 'gotas.cuerpo'],
    ['un precio escrito adentro de un texto',   (d) => { d.gotas.cuerpo = 'Las bolsas cuestan $258.' },       'gotas.cuerpo'],
    ['un precio como texto',                    (d) => { d.minis.precio = '118' },                            'minis.precio'],
    ['un precio con centavos',                  (d) => { d.minis.precio = 118.5 },                            'minis.precio'],
    ['un precio en cero',                       (d) => { d.minis.precio = 0 },                                'minis.precio'],
    ['un precio con un cero de más',            (d) => { d.minis.precio = 1180000 },                          'minis.precio'],
    ['la descripción pasada de largo',          (d) => { d.descripcion = 'x'.repeat(200) },                   'descripcion'],
    ['un signo de HTML en el título',           (d) => { d.titulo = 'Chocolate <b>rico</b>' },                'titulo'],
    ['un correo sin arroba',                    (d) => { d.contacto.correo = 'maracacaomx.gmail.com' },       'contacto.correo'],
    ['una dirección web sin http',              (d) => { d.contacto.catalogoUrl = 'chocolateria.pulpos.shop' },'contacto.catalogoUrl'],
    ['un enlace del menú sin # ni /',           (d) => { d.nav.items[0].ancla = 'sabores' },                  'nav.items.0.ancla'],
    ['un color de sabor que no existe',         (d) => { d.catar.pasos[0].clave = 'chocolatito' },            'catar.pasos.0.clave'],
    ['el chip de polvo vacío',                  (d) => { d.recetas.lista[3].chipPolvo = '' },                 'recetas.lista.3.chipPolvo'],
    ['un panel de producto de más',             (d) => { d.negocios.tabs.push(structuredClone(d.negocios.tabs[0])) }, 'negocios.tabs'],
    ['la lista de legales vacía',               (d) => { d.footer.legales = [] },                             'footer.legales'],
    ['el valor del formulario cambiado',        (d) => { d.contacto.formulario.tipoOpciones[1].valor = 'negocios' }, 'contacto.formulario.tipoOpciones.1.valor'],
    ['una pregunta sin respuesta',              (d) => { d.preguntas.items[0].r = '' },                       'preguntas.items.0.r'],
  ]

  it.each(casos)('caza %s', (_nombre, cambia, ruta) => {
    const problemas = validar(esquemaSitio, conCambio(sitio(), cambia as never), CONTEOS)
    expect(problemas.length, 'no cazó nada').toBeGreaterThan(0)
    expect(problemas.map((p) => p.campo)).toContain(ruta)
    expect(problemas.every((p) => p.gravedad === 'impide')).toBe(true)
  })

  it('ningún mensaje que lee la clienta tiene jerga de programación', () => {
    // La razón entera por la que existe validacion.ts. «Expected string,
    // received number» no le dice nada a nadie, y «Invalid option» encima
    // está en inglés.
    const JERGA = /string|number|boolean|array|invalid|expected|received|required|undefined|null\b/i
    for (const [, cambia] of casos) {
      for (const p of validar(esquemaSitio, conCambio(sitio(), cambia as never), CONTEOS)) {
        expect(p.titulo, `${p.campo}: «${p.titulo}»`).not.toMatch(JERGA)
      }
    }
  })
})

describe('el sitio: lo que solo avisa', () => {
  it('avisa —sin impedir— cuando un texto quedó con el número viejo', () => {
    // El aviso NO bloquea: la clienta puede publicar con un texto que
    // quedó viejo, y es correcto que pueda. Lo que no puede es no
    // enterarse.
    const problemas = validar(esquemaSitio, sitio(), { ...CONTEOS, sabores: 16 })
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas.every((p) => p.gravedad === 'avisa')).toBe(true)
    expect(problemas.map((p) => p.campo)).toContain('anaquel.kicker')
  })
})

describe('los productos y las fichas', () => {
  const casos: [string, unknown, (d: any) => void, string][] = [
    ['un número de serie en cero',   esquemaSabores, (d) => { d.sabores[0].orden = 0 },                'sabores.0.orden'],
    ['un nombre de archivo con mayúsculas', esquemaSabores, (d) => { d.sabores[0].slug = 'Jengibre' }, 'sabores.0.slug'],
    ['la lista de barras vacía',     esquemaSabores, (d) => { d.sabores = [] },                        'sabores'],
    ['unos ingredientes vacíos',     esquemaSabores, (d) => { d.sabores[0].ingredientes = '' },        'sabores.0.ingredientes'],
  ]

  it.each(casos)('caza %s', (_n, esquema, cambia, ruta) => {
    const problemas = validar(esquema as never, conCambio(productos(), cambia as never), CONTEOS)
    expect(problemas.map((p) => p.campo)).toContain(ruta)
  })

  it('caza un bloque de ficha con una forma que no existe', () => {
    const datos = structuredClone({ fichas: fixture.fichas })
    ;(datos.fichas[0].secciones[0].bloques[0] as { tipo: string }).tipo = 'grafico'
    const problemas = validar(esquemaFichas, datos, CONTEOS)
    expect(problemas.length).toBeGreaterThan(0)
    expect(problemas[0].campo).toMatch(/^fichas\.0\.secciones\.0\.bloques\.0/)
  })
})
