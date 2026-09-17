/*
 * LAS ASERCIONES DE FORMA de las tres fachadas.
 *
 * Este archivo tuvo hasta el 2026-09-17 un CERTIFICADO: tres `toEqual`
 * que comparaban lo que las fachadas exportan contra la foto del árbol
 * viejo (`test/fixtures/contenido-2026-09-10.json`). Existía para que la
 * migración a `src/contenido/datos/**` no moviera una coma sin que nadie
 * se enterara, y cumplió: las catorce tareas de la fase 2 pasaron por él.
 *
 * SE BORRÓ porque el panel lo convirtió en una trampa. `pnpm verifica`
 * —o sea estos tests— es el comando de deploy de Vercel, así que desde el
 * día que la clienta publica su primera edición, el certificado deja el
 * build en rojo y la publicación no llega al sitio. La primera prueba de
 * humo en producción terminó exactamente así: el panel publicó bien
 * (commit e51ca6b) y el deploy murió acá. La auditoría de la fase 0 ya
 * había escrito el destino de esta clase de assert: «BORRAR — el valor
 * pasa a ser editable; la verdad histórica queda en el fixture de la
 * migración, que es el acta, no la ley».
 *
 * El fixture sigue en el repo —es el acta— y lo siguen usando
 * `contenido.test.ts` y `contenido-mutaciones.test.ts` como dato de
 * entrada. Lo que reemplaza al certificado para su trabajo real («que el
 * contenido no cambie sin que nadie se entere») es el diff que el panel
 * arma en cada publicación (`src/contenido/diff.ts` → `frase()`), que se
 * lo muestra a la clienta ANTES de publicar y queda escrito en el
 * mensaje del commit.
 *
 * Lo que queda acá son las aserciones de FORMA: las expresiones de
 * `index.astro` que dependen de la forma del dato y no de su valor.
 * Ninguna se rompe con una edición de contenido legítima.
 */
import { describe, it, expect } from 'vitest'
import { marca } from '@/copy/sitio-marca'
import { sabores } from '@/copy/sabores'
import { sabor as colorSabor, tintaSabor } from '@/tokens/color'
import { jsonParaHtml } from '@/lib/json-en-html'

describe('las aserciones de forma', () => {
  // Las expresiones de index.astro que dependen de la FORMA del dato y no
  // de su valor. Cada una nombra la línea que la necesita.
  //
  // Eran nueve y quedan SIETE. Los números NO se corrieron: los planes de
  // las fases 1 y 2 las citan por número.
  //
  // Cayó la 4 («el nombre del puesto se une con un espacio y da el nombre
  // real»), que comparaba `puestoTitulo.join(' ')` contra «Mercado de
  // Coyoacán»: eso es un VALOR que la clienta edita, no una forma — el día
  // que el puesto se mude, ese assert le bloquea la publicación. Lo que sí
  // importa —que el JSON-LD de la dirección salga de ese mismo join y no de
  // una copia a mano— ya lo mide `test/seo.test.ts` contra el copy, no
  // contra un literal.
  //
  // Y cayó la 8 («los nueve espacios duros siguen siendo espacios duros»),
  // que exigía un U+00A0 en cada uno de ocho campos y NUEVE en total. El
  // espacio duro es de verdad importante —sin él, en el celular la «g» o el
  // «kg» quedan solas en el renglón siguiente—, pero la regla real es «si
  // hay una cifra seguida de una unidad, el espacio del medio es duro», y
  // eso ya lo exige el esquema (`medida`, MEDIDA_MAL_ESCRITA) en el panel,
  // antes de publicar. Lo que este assert agregaba encima era «y tiene que
  // haber una medida»: medido, el esquema acepta «Polvo de cacao» y este
  // test lo rechazaba. Eso es copy legítimo, y el precio de rechazarlo era
  // dejarle el deploy en rojo a la clienta.

  it('1 · la receta que trae chip de polvo lo trae con texto, nunca vacío', () => {
    // index.astro:448 pregunta `'chipPolvo' in r`, que es existencia de
    // CLAVE, no contenido. Un '' guardado renderiza una cajita amarilla
    // vacía de 6×10 px que estira las cuatro tarjetas.
    //
    // CUÁNTAS recetas lo traen no se mide: hoy es una, mañana pueden ser
    // tres, y eso es una decisión de la clienta, no una regresión. Antes
    // esto exigía `toHaveLength(1)` y —medido— le ponía el deploy en rojo
    // tanto si le agregaba el chip a otra receta como si se lo sacaba a la
    // única que lo tiene.
    for (const r of marca.recetas.lista) {
      if (!('chipPolvo' in r)) continue
      expect(r.chipPolvo, `receta «${r.titulo}»`).toBeTruthy()
    }
  })

  it('2 · el precio de cada tab de negocios es null o un entero, nunca undefined', () => {
    // index.astro:538 se estrecha con `t.precio === null`. Un undefined
    // en vez de null renderiza «$NaN».
    //
    // CUÁL de los tres tabs tiene el precio en null no se mide: el del
    // polvo lo tiene hoy porque todavía no hay precio de lista, y el día
    // que la clienta se lo ponga, el sitio tiene que publicarlo, no
    // rechazarlo. Antes esto exigía «exactamente uno, y es el polvo».
    for (const t of marca.negocios.tabs) {
      expect(t.precio === null || Number.isInteger(t.precio), `tab «${t.id}»`).toBe(true)
    }
  })

  it('3 · el renglón 2 del titular termina en coma y tiene una sola', () => {
    // index.astro:146 hace `.replace(/,$/, '')` y pinta una coma roja en
    // su lugar. Con dos comas, el h1 dice «…DE VERDAD,,».
    expect(marca.hero.titular[1]).toMatch(/^[^,]+,$/)
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
    // index.astro:35 hace `sabores.find((s) => s.clave === marca.anaquel
    // .saborInicial)!` — con el `!` puesto. Si ese sabor dejara de existir,
    // TypeScript no dice nada y la portada del anaquel se pinta con
    // `undefined`: banda sin color y nombre vacío.
    expect(sabores.find((s) => s.clave === marca.anaquel.saborInicial)).toBeDefined()
  })

  it('9 · el contador del anaquel sale de cuántas barras hay', () => {
    // index.astro:305 renderiza «{fichaEtiqueta} {orden} {contadorDe}» →
    // «Barra n.º 3 de 15». Cuando era texto a mano, agregar una barra
    // imprimía «n.º 16 de 15» en la página publicada.
    expect(marca.anaquel.contadorDe).toBe(`de ${sabores.length}`)
  })
})
