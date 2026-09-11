/*
 * EL CERTIFICADO. Es permanente: no muere con la migración.
 *
 * Compara lo que las tres fachadas EXPORTAN contra la foto del árbol viejo
 * (`test/fixtures/contenido-2026-09-10.json`, capturada antes de tocar
 * nada). Si algún día alguien edita el contenido a propósito, este test se
 * pone rojo y ESO ES CORRECTO: el fixture se actualiza a mano, en el mismo
 * commit, y el diff muestra exactamente qué cambió. Lo que no puede pasar
 * es que cambie sin que nadie se entere.
 */
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/contenido-2026-09-10.json'
import { marca } from '@/copy/sitio-marca'
import { sabores, gotas, polvo, urlCatalogoBarras } from '@/copy/sabores'
import { fichasBase } from '@/fichas/base'
import { sabor as colorSabor, tintaSabor } from '@/tokens/color'
import { jsonParaHtml } from '@/lib/json-en-html'

/**
 * La forma pura, sin readonly, sin undefined y sin prototipos:
 * exactamente lo que un JSON representa. Es la misma transformación que
 * usó el script al capturar el fixture, así que compara lo que importa.
 */
const estructura = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

describe('el certificado de la migración', () => {
  it('marca exporta el mismo objeto que antes de la migración', () => {
    expect(estructura(marca)).toEqual(fixture.marca)
  })

  it('los productos exportan el mismo objeto que antes', () => {
    expect(estructura(sabores)).toEqual(fixture.sabores)
    expect(estructura(gotas)).toEqual(fixture.gotas)
    expect(estructura(polvo)).toEqual(fixture.polvo)
    expect(urlCatalogoBarras).toBe(fixture.urlCatalogoBarras)
  })

  it('las fichas exportan el mismo objeto que antes', () => {
    expect(estructura(fichasBase)).toEqual(fixture.fichas)
  })
})

describe('las aserciones de forma', () => {
  // Las expresiones de index.astro que dependen de la FORMA del dato y no
  // de su valor. Cada una nombra la línea que la necesita.

  it('1 · el chip de polvo NO existe como clave en las tres recetas sin chip', () => {
    // index.astro:448 pregunta `'chipPolvo' in r`, que es existencia de
    // CLAVE, no contenido. Un '' guardado renderiza una cajita amarilla
    // vacía de 6×10 px que estira las cuatro tarjetas.
    const conChip = marca.recetas.lista.filter((r) => 'chipPolvo' in r)
    expect(conChip).toHaveLength(1)
    expect(conChip[0].chipPolvo).toBeTruthy()
  })

  it('2 · el precio es null exactamente en el tab del polvo', () => {
    // index.astro:538 se estrecha con `t.precio === null`. Un undefined
    // en vez de null renderiza «$NaN».
    const nulos = marca.negocios.tabs.filter((t) => t.precio === null)
    expect(nulos).toHaveLength(1)
    expect(nulos[0].id).toBe('polvo')
    for (const t of marca.negocios.tabs) {
      expect(t.precio === null || Number.isInteger(t.precio)).toBe(true)
    }
  })

  it('3 · el renglón 2 del titular termina en coma y tiene una sola', () => {
    // index.astro:146 hace `.replace(/,$/, '')` y pinta una coma roja en
    // su lugar. Con dos comas, el h1 dice «…DE VERDAD,,».
    expect(marca.hero.titular[1]).toMatch(/^[^,]+,$/)
  })

  it('4 · el nombre del puesto se une con un espacio y da el nombre real', () => {
    // index.astro hace puestoTitulo.join(' ').
    expect(marca.contacto.puestoTitulo.join(' ')).toBe('Mercado de Coyoacán')
  })

  it('5 · la clave de los 15 sabores indexa los tokens de color', () => {
    // index.astro:52-53 hace colorSabor[s.clave] y tintaSabor[s.clave].
    for (const s of sabores) {
      expect(colorSabor[s.clave], s.slug).toBeTruthy()
      expect(tintaSabor[s.clave], s.slug).toBeTruthy()
    }
  })

  it('6 · el JSON del anaquel sale escapado, aunque el contenido traiga un </script', () => {
    // La mina de la fase 0: `set:html={JSON.stringify(datosAnaquel)}` sin
    // escapar (index.astro:777). Un «</script» en cualquier campo CIERRA el
    // <script> del HTML, mata todo el JS de la página y deja los seis pasos
    // de «Cómo catar» invisibles para siempre — `html.js [data-revelar]
    // {opacity:0}` nunca se apaga.
    //
    // OJO CON LO QUE ESTE TEST TIENE QUE PROBAR, porque la primera versión
    // no probaba nada: hoy NINGÚN ingrediente real trae un «<», así que
    // afirmar sobre el contenido real deja `jsonParaHtml` y `JSON.stringify`
    // dando lo mismo byte a byte — y el test seguía verde aunque alguien
    // revirtiera el escape. El caso adversario hay que inyectarlo a mano.
    const conMina = [
      ...sabores.map((s) => ({ slug: s.slug, ingredientes: s.ingredientes })),
      { slug: 'prueba', ingredientes: 'Cacao </script><script>alert(1)</script>' },
    ]
    const salida = jsonParaHtml(conMina)

    // Lo que va al HTML no puede cerrar el <script>...
    expect(salida).not.toContain('</script')
    // ...y el escape tiene que haberse ejecutado de verdad.
    expect(salida).toContain('\\u003c/script')
    // Y escapar para el HTML no puede cambiar el dato que el navegador lee:
    // `\u003c` es un escape válido de JSON, así que vuelve a ser «<».
    expect(JSON.parse(salida)).toEqual(conMina)
  })

  it('7 · el sabor con el que abre el anaquel existe', () => {
    // index.astro:35 hace `sabores.find((s) => s.slug === 'canela')!` — con
    // el `!` puesto. Si ese slug dejara de existir, TypeScript no dice
    // nada y la portada del anaquel se pinta con `undefined`: banda sin
    // color y nombre vacío. El slug va como `quien: 'marcos'`, así que la
    // clienta no puede romperlo — pero un candado de una línea sobre algo
    // que hoy solo sostiene un `!` es barato.
    expect(sabores.find((s) => s.slug === 'canela')).toBeDefined()
  })

  it('8 · los nueve espacios duros siguen siendo espacios duros', () => {
    // Sin ellos, en el celular la «g» o el «kg» quedan solas en el renglón
    // siguiente. Es el modo de falla que la clienta no puede ver desde su
    // escritorio.
    const DURO = '\u00a0' // escrito como escape, SIEMPRE
    const conDuro = [
      marca.anaquel.pesoInsignia,
      marca.gotas.titulo,
      marca.polvoCard.titulo,
      marca.negocios.tabs[0].titulo,
      marca.negocios.tabs[1].titulo,
      marca.negocios.tabs[2].titulo,
      marca.footer.productos[0].texto,
      marca.footer.productos[1].texto,
    ]
    for (const texto of conDuro) expect(texto, texto).toContain(DURO)
    // El del panel de polvo lleva DOS: «250 g y 1 kg».
    expect(marca.negocios.tabs[0].titulo.split(DURO)).toHaveLength(3)
    const total = conDuro.join('').split(DURO).length - 1
    expect(total, 'son nueve, medidos').toBe(9)
  })

  it('9 · el final del contador termina en cuántas barras hay', () => {
    // `anaquel.contadorDe` vale «de 15» y la plantilla arma «n.º 3 de 15»
    // pegándole el número adelante. No lleva la regla `cuenta` porque
    // `cruzaConteo()` exige que el número sea vecino inmediato de un
    // sustantivo y acá no hay ninguno — el esquema decía que «lo cubre una
    // aserción de forma de la Tarea 14», y esa aserción NO EXISTÍA. Hoy,
    // sin ella, agregar una barra deja el anaquel imprimiendo «n.º 16 de
    // 15» en la página publicada y nada lo detecta.
    //
    // La frontera `\D` es lo que separa «de 15» de un «de 115» que termina
    // en los mismos dos dígitos.
    expect(
      marca.anaquel.contadorDe,
      `«${marca.anaquel.contadorDe}» tendría que terminar en ${sabores.length}`,
    ).toMatch(new RegExp(`(^|\\D)${sabores.length}\\s*$`))
  })

  it('10 · el chip vacío no renderiza la cajita, y un precio ausente no renderiza $NaN', () => {
    // Los dos arreglos de index.astro:448 y :538 son sobre un caso que hoy
    // no puede ocurrir —`texto()` rechaza el vacío y `precioONada` da
    // `null`, no `undefined`— pero que el panel de la fase 6 puede provocar.
    // Se prueban con las mismas expresiones que usa la plantilla, sobre el
    // valor que hoy no llega.
    const chip = (r: { chipPolvo?: string }) => Boolean(r.chipPolvo)
    expect(chip({ chipPolvo: '' })).toBe(false)          // la vieja daba true
    expect(chip({ chipPolvo: 'USA EL POLVO' })).toBe(true)
    expect(chip({})).toBe(false)

    const nota = (t: { precio?: number | null }) => t.precio == null
    expect(nota({ precio: undefined })).toBe(true)        // la vieja daba false
    expect(nota({ precio: null })).toBe(true)
    expect(nota({ precio: 108 })).toBe(false)
  })
})
