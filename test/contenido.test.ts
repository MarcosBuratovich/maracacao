/*
 * Guards de la capa de contenido.
 *
 * El primero es la constitución de la carpeta: `src/contenido/**` tiene que
 * poder correr en TRES lugares —el navegador de la clienta, la función
 * serverless y vitest—, y el spec dice qué se puede traer de afuera, no qué
 * no: «dependencias externas permitidas: `zod`, `../tokens/color` y
 * `../tokens/contrast`». Por eso el guard es LISTA BLANCA.
 *
 * Lo era al revés y no alcanzaba ni de cerca: prohibía `node:`, `astro` y
 * `@/`, así que `from 'fs'`, `from 'path'` y `from 'lodash'` pasaban los
 * tres sin que nada dijera nada — y cualquiera de esos rompe el panel en el
 * navegador exactamente igual que `node:fs`. Una lista negra solo prohíbe
 * las tres formas que alguien se acordó de escribir; la propiedad que hay
 * que sostener es la otra.
 */
import { describe, it, expect, expectTypeOf } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { MARCA, MAQUETA, palabraProhibida } from '../src/contenido/vocabulario'
import {
  texto, parrafo, medida, precio, tupla, lista, claveSabor, CLAVES_DE_SABOR,
  numero, tokenColor, ruta, ancla, url, correo, slug, archivo, derivado, grupo, precioONada,
  panel, UNIDADES_DE_MEDIDA, opcion, valorFijo,
} from '../src/contenido/campos'
import type { MetaCampo } from '../src/contenido/campos'
import { recorre, cargar, serializa } from '../src/contenido/carga'
import { cruzaConteo, enLetras, conteosDe } from '../src/contenido/conteos'
import { contrasteSuficiente, resuelveColor, mejorTinta } from '../src/contenido/color-sabor'
import { precioDesde, precioDe, DERIVADOS_DEL_SITIO, injerta } from '../src/contenido/derivados'
import { validarContra, validar } from '../src/contenido/validacion'
import { esquemaSabores } from '../src/contenido/esquema/sabores'
import { esquemaFichas } from '../src/contenido/esquema/fichas'
import { camposDeCabecera } from '../src/contenido/esquema/sitio/cabecera'
import { camposDeProducto } from '../src/contenido/esquema/sitio/producto'
import { camposDeExperiencia } from '../src/contenido/esquema/sitio/experiencia'
import { camposDeNegocio } from '../src/contenido/esquema/sitio/negocio'
import { camposDeContacto } from '../src/contenido/esquema/sitio/contacto'
import { camposDePaginas } from '../src/contenido/esquema/sitio/paginas'
import { esquemaSitio } from '../src/contenido/esquema/sitio'
import { DOCUMENTOS } from '../src/contenido/esquema'
import type { IdDocumento } from '../src/contenido/esquema'
import { fichasBase } from '../src/fichas/base'
// Las fachadas: lo que de verdad importa index.astro. `marca` para el
// candado de las anclas del menú; `sabores`/`gotas` para injertar los
// derivados del documento del sitio exactamente como lo hace
// `src/copy/sitio-marca.ts`, sin repetir esa cuenta a mano acá.
import { marca } from '../src/copy/sitio-marca'
import { sabores, gotas } from '../src/copy/sabores'
import * as tokens from '../src/tokens/color'
import { TEXTOS_UI, textosUi } from '../src/contenido/textos-ui'
// La foto congelada, no el módulo: el fixture no se mueve cuando la Tarea 13
// reescriba la fachada, y estos tests validan CONTRA esa foto.
import fixture from './fixtures/contenido-2026-09-10.json'

/*
 * Cuatro formas de traer un módulo, todas miradas por igual: el estático
 * `from '...'` (cubre también el re-export, que conserva el `from`), el
 * dinámico `import('...')`, el bare `import '...'` por efecto secundario y
 * el `require('...')` de CommonJS. Un patrón que solo mirara `from` es un
 * recordatorio, no un guard.
 *
 * El orden de la alternancia importa: `import(` va ANTES que `import ` —si
 * no, `import('x')` se prueba primero contra la forma que exige un espacio
 * y no matchea.
 */
const FORMAS_DE_IMPORTAR =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

/** Todo lo que un archivo trae de afuera, sin los comentarios. */
const especificadoresDe = (fuente: string): string[] => {
  // Los comentarios quedan fuera: este mismo archivo los nombra.
  const codigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return [...codigo.matchAll(FORMAS_DE_IMPORTAR)].map((m) => m[1])
}

/**
 * `null` si ese especificador se puede traer; si no, POR QUÉ no.
 *
 * La regla es la del spec, en positivo: `zod` —la única dependencia
 * externa declarada— o una ruta relativa sin extensión, que es lo que
 * resuelven por igual el navegador, la función serverless y vitest. Los
 * `../tokens/color` y `../tokens/contrast` que el spec nombra entran por
 * ser relativos, no por estar en una lista aparte.
 *
 * La excepción del `.json` de `datos/` va declarada y acotada: el contenido
 * SÍ se importa con extensión porque es un JSON, y ningún otro archivo con
 * extensión tiene por qué entrar por esa puerta.
 */
const porQueNoSePuede = (especificador: string): string | null => {
  if (especificador === 'zod') return null
  if (!/^\.\.?\//.test(especificador)) {
    return 'no es «zod» ni una ruta relativa (./ o ../): en el navegador no lo resuelve nadie'
  }
  if (/\.json$/i.test(especificador)) {
    return /(^|\/)datos\/[^/]+\.json$/.test(especificador)
      ? null
      : 'el único .json que esta carpeta importa es uno de datos/'
  }
  if (/\.[a-z]+$/i.test(especificador)) {
    return 'las rutas relativas van sin extensión'
  }
  return null
}

describe('la capa de contenido', () => {
  it('src/contenido/ solo importa zod y rutas relativas sin extensión', () => {
    const infractores: string[] = []
    const archivos = readdirSync('src/contenido', { recursive: true, encoding: 'utf8' })

    for (const archivo of archivos) {
      if (!archivo.endsWith('.ts')) continue
      for (const especificador of especificadoresDe(readFileSync(`src/contenido/${archivo}`, 'utf8'))) {
        const motivo = porQueNoSePuede(especificador)
        if (motivo !== null) infractores.push(`${archivo} importa «${especificador}»: ${motivo}`)
      }
    }

    expect(infractores).toEqual([])
  })

  it('el guard es lista blanca: lo que la lista negra dejaba pasar ahora no pasa', () => {
    // Los tres que pasaban los tres prohibidos de la versión anterior. Cada
    // uno rompe el panel en el navegador igual que un `node:fs`, y ninguno
    // decía ni «node:», ni «astro», ni «@/».
    const traidos = (fuente: string) =>
      especificadoresDe(fuente).map((e) => [e, porQueNoSePuede(e)] as const)

    expect(traidos(`import { readFileSync } from 'fs'`)).toEqual([
      ['fs', 'no es «zod» ni una ruta relativa (./ o ../): en el navegador no lo resuelve nadie'],
    ])
    expect(traidos(`import path from 'path'`)).toEqual([
      ['path', 'no es «zod» ni una ruta relativa (./ o ../): en el navegador no lo resuelve nadie'],
    ])
    expect(traidos(`import x from 'lodash'`)).toEqual([
      ['lodash', 'no es «zod» ni una ruta relativa (./ o ../): en el navegador no lo resuelve nadie'],
    ])

    // Y lo legítimo sigue siendo legítimo: el import relativo de al lado,
    // la única dependencia externa declarada, los tokens que el spec
    // nombra, y el JSON de datos/ con su extensión.
    for (const bueno of [
      `import x from './carga'`,
      `import { z } from 'zod'`,
      `import { sabor } from '../tokens/color'`,
      `import { grupo } from '../../campos'`,
      `import datos from './datos/sitio.json'`,
      `export * from './conteos'`,
      `const x = await import('../color-sabor')`,
      `import './efecto-secundario'`,
    ]) {
      expect(traidos(bueno).map(([, motivo]) => motivo), bueno).toEqual([null])
    }

    // La extensión de más y el .json fuera de datos/ también caen.
    expect(traidos(`import x from './carga.ts'`)).toEqual([
      ['./carga.ts', 'las rutas relativas van sin extensión'],
    ])
    expect(traidos(`import x from '../paquete.json'`)).toEqual([
      ['../paquete.json', 'el único .json que esta carpeta importa es uno de datos/'],
    ])
  })

  it('palabraProhibida encuentra la palabra, incluidas las formas en plural', () => {
    expect(palabraProhibida('el mono de la envoltura')).toBe('mono')
    expect(palabraProhibida('dos monos')).toBe('mono')
    expect(palabraProhibida('chispas de chocolate')).toBe('chispa')
    expect(palabraProhibida('agregá al carrito')).toBe('carrito')
    expect(palabraProhibida('los carritos')).toBe('carrito')
    expect(palabraProhibida('con pistachos')).toBe('pistachos')
    expect(palabraProhibida('trae maní')).toBe('maní')
  })

  it('palabraProhibida no la encuentra donde no está, aunque la palabra esté contenida', () => {
    // Sin esto, el filtro le prohibiría a la clienta escribir «monocromo».
    // Va en un `it` separado del de los positivos para que, si algún caso
    // de estos falla, la corrida lo señale sin cortar antes por otro motivo.
    expect(palabraProhibida('impresión monocromo')).toBeNull()
    expect(palabraProhibida('un chispazo de sabor')).toBeNull()
    expect(palabraProhibida('la manía de revisar')).toBeNull()
    expect(palabraProhibida('Chocolate con pistaches')).toBeNull()
  })

  it('MAQUETA no contamina al panel: «Borrador» no está en MARCA', () => {
    // El panel necesita esa palabra para su concepto central. Si algún
    // día alguien funde las dos listas, este test lo frena.
    expect(MARCA).not.toContain('borrador')
    expect(MAQUETA).toContain('borrador')
    expect(palabraProhibida('Borrador sin publicar')).toBeNull()
  })

  it('todo campo anotado tiene etiqueta, ayuda y sección — el panel se pinta de ahí', () => {
    // El panel dibuja cada campo con su etiqueta en español y su oración
    // de «dónde vive». Un campo sin eso es un input mudo: la clienta lo ve
    // y no sabe qué está tocando. Por eso el metadato es obligatorio en el
    // tipo, y este test lo verifica también en runtime — TypeScript no
    // alcanza cuando el esquema se arma con un spread.
    const campo = texto({
      etiqueta: 'Renglón 2 del titular',
      seccion: 'portada',
      ayuda: 'La segunda línea del título grande, arriba de todo.',
      maxCaracteres: 40,
    })
    const meta = panel.get(campo)
    expect(meta?.etiqueta).toBe('Renglón 2 del titular')
    expect(meta?.ayuda).toBeTruthy()
    expect(meta?.seccion).toBe('portada')
    expect(meta?.control).toBe('texto')
  })

  it('el texto rechaza vacío, vocabulario de marca y precios pegados', () => {
    const campo = texto({
      etiqueta: 'Prueba', seccion: 'portada', ayuda: 'x', maxCaracteres: 60,
    })
    expect(campo.safeParse('Chocolate mexicano').success).toBe(true)

    // Vaciar un campo es el gesto más típico de un CMS, y hoy rompe el build.
    expect(campo.safeParse('   ').success).toBe(false)
    // La marca no dice «chispas»: dice gotas.
    expect(campo.safeParse('con chispas de chocolate').success).toBe(false)
    // Los precios los formatea precioMXN; escritos a mano se desincronizan.
    expect(campo.safeParse('desde $108 el paquete').success).toBe(false)
    // Y el techo de cordura corta.
    expect(campo.safeParse('x'.repeat(61)).success).toBe(false)
  })

  it('anotar no contamina: dos campos derivados de la misma base no comparten etiqueta', () => {
    // `registry.get()` sigue la cadena de padres. Si alguien anotara una
    // base compartida en vez del esquema terminado, TODOS los campos
    // derivados de ella heredarían esa etiqueta y el panel mostraría el
    // mismo nombre en veinte lugares. Verificado contra zod 4.4.3.
    const a = texto({ etiqueta: 'Uno', seccion: 'portada', ayuda: 'a', maxCaracteres: 10 })
    const b = texto({ etiqueta: 'Dos', seccion: 'pie', ayuda: 'b', maxCaracteres: 60 })
    expect(panel.get(a)?.etiqueta).toBe('Uno')
    expect(panel.get(b)?.etiqueta).toBe('Dos')
    expect(panel.get(a)?.maxCaracteres).toBe(10)
    expect(panel.get(b)?.maxCaracteres).toBe(60)
  })

  it('medida acepta el espacio duro y rechaza el normal — es su razón de existir', () => {
    // `\s` (la versión que traía el brief original) matchea también el
    // espacio duro: con esa regla, NINGÚN valor de `medida` podía pasar
    // nunca, ni siquiera el bien escrito. Este test ejercita el camino
    // feliz que faltaba y prueba las dos formas a la vez, porque el punto
    // entero de este campo es distinguirlas.
    const m = medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'x', maxCaracteres: 30 })
    // Con espacio duro: válido. Es la forma que el sitio usa hoy y la que
    // impide que la «g» quede sola en el renglón siguiente del celular.
    expect(m.safeParse('Barra de 70\u00a0g').success).toBe(true)
    // Con espacio normal: se marca, y con el arreglo a un toque.
    expect(m.safeParse('Barra de 70 g').success).toBe(false)
  })

  it('el metadato dice lo que significa: ningún nombre vale para dos cosas', () => {
    // `max` significaba CARACTERES en texto/parrafo/medida, VALOR numérico
    // en numero/precio/derivado y CANTIDAD DE ELEMENTOS en lista; y `de`
    // era un esquema en `lista` y una ruta en `derivado`. La fase 2 pinta
    // el panel leyendo este metadato: un widget que lea `meta.max` y
    // escriba «tope de seguridad de 2 caracteres» sobre una lista de 2
    // elementos es el bug garantizado, y el tipo no lo iba a atajar porque
    // los tres eran `number`.
    const item = texto({ etiqueta: 'Item', seccion: 'preguntas', ayuda: 'y', maxCaracteres: 90 })
    const l = lista({
      etiqueta: 'Lista', seccion: 'preguntas', ayuda: 'x',
      elemento: item, minItems: 1, maxItems: 2,
    })
    const n = numero({
      etiqueta: 'Orden', seccion: 'productos', ayuda: 'x', minValor: 1, maxValor: 10,
    })
    const d = derivado({
      etiqueta: 'Total', seccion: 'productos', ayuda: 'x', saleDe: 'gotas.items',
    })

    expect(panel.get(item)?.maxCaracteres).toBe(90)
    expect(panel.get(l)?.minItems).toBe(1)
    expect(panel.get(l)?.maxItems).toBe(2)
    expect(panel.get(n)?.minValor).toBe(1)
    expect(panel.get(n)?.maxValor).toBe(10)
    // Los dos `de`: uno era un esquema y el otro una ruta, con el mismo
    // nombre. Ahora un widget sabe cuál está leyendo.
    expect(panel.get(l)?.elemento).toBe(item)
    expect(panel.get(d)?.saleDe).toBe('gotas.items')

    // Y los nombres ambiguos no quedaron dando vueltas en el registro: si
    // vuelven, vuelve el bug.
    for (const campo of [item, l, n, d]) {
      const claves = Object.keys(panel.get(campo) as object)
      expect(claves).not.toContain('max')
      expect(claves).not.toContain('min')
      expect(claves).not.toContain('de')
    }
  })

  it('la regla del espacio duro es UNA: los dos lados reconocen cada unidad de la lista', () => {
    // `campos.ts` (que RECHAZA) y `validacion.ts` (que OFRECE el botón de
    // arreglo) escribían la misma regla dos veces. Estaban alineadas de
    // casualidad y nada las mantenía así: agregar `mm` a una y olvidarla
    // en la otra le deja a la clienta un campo que se rechaza y sin el
    // botón que lo arregla, y no caía ningún test. Este barre la lista
    // COMPARTIDA, así que una unidad nueva entra sola a las dos
    // afirmaciones — que es justo lo que no existía.
    const campo = medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'x', maxCaracteres: 40 })
    const esquema = z.object({ p: campo })
    expect(UNIDADES_DE_MEDIDA.length).toBeGreaterThan(0)

    for (const unidad of UNIDADES_DE_MEDIDA) {
      const malEscrito = `Barra de 70 ${unidad}`
      const bienEscrito = `Barra de 70\u00a0${unidad}`
      // Lado 1, el constructor: rechaza el espacio blando y acepta el duro.
      expect(campo.safeParse(malEscrito).success, `${unidad}: tiene que rechazar`).toBe(false)
      expect(campo.safeParse(bienEscrito).success, `${unidad}: tiene que aceptar`).toBe(true)
      // Lado 2, la validación: ofrece el arreglo, y el arreglo es
      // exactamente el valor que el constructor acepta.
      const problemas = validarContra(esquema, { p: malEscrito })
      expect(problemas[0]?.arreglo?.valor, `${unidad}: tiene que ofrecer el arreglo`)
        .toBe(bienEscrito)
    }
  })

  it('el precio es entero y acotado: ni string, ni decimal, ni cero, ni absurdo', () => {
    const p = precio({ etiqueta: 'Precio de la barra', seccion: 'sabores', ayuda: 'x' })
    expect(p.safeParse(108).success).toBe(true)
    // «$108» como string es el error que rompe tres tests del sitio.
    expect(p.safeParse('108').success).toBe(false)
    expect(p.safeParse(108.5).success).toBe(false)
    expect(p.safeParse(0).success).toBe(false)
    expect(p.safeParse(-1).success).toBe(false)
    expect(p.safeParse(100000).success).toBe(false)
  })

  it('la tupla es forma fija: no acepta ni uno de más ni uno de menos', () => {
    const t = tupla({
      etiqueta: 'Titular', seccion: 'portada', ayuda: 'Las tres líneas del título grande.',
      partes: [
        texto({ etiqueta: 'Renglón 1', seccion: 'portada', ayuda: 'a', maxCaracteres: 40 }),
        texto({ etiqueta: 'Renglón 2', seccion: 'portada', ayuda: 'b', maxCaracteres: 40 }),
        texto({ etiqueta: 'Renglón 3', seccion: 'portada', ayuda: 'c', maxCaracteres: 40 }),
      ],
    })
    expect(t.safeParse(['CHOCOLATE', 'MEXICANO,', '70% CACAO.']).success).toBe(true)
    expect(t.safeParse(['CHOCOLATE', 'MEXICANO,']).success).toBe(false)
    expect(t.safeParse(['A', 'B', 'C', 'D']).success).toBe(false)
  })

  it('la lista respeta su mínimo y su máximo — los conteos del sitio dependen de eso', () => {
    const l = lista({
      etiqueta: 'Preguntas frecuentes', seccion: 'preguntas', ayuda: 'x',
      elemento: texto({ etiqueta: 'Pregunta', seccion: 'preguntas', ayuda: 'y', maxCaracteres: 90 }),
      minItems: 4, maxItems: 12,
    })
    expect(l.safeParse(['a', 'b', 'c', 'd']).success).toBe(true)
    expect(l.safeParse(['a', 'b', 'c']).success).toBe(false)
    expect(l.safeParse(Array(13).fill('a')).success).toBe(false)
  })

  it('claveSabor solo acepta claves que existen en los tokens de color', () => {
    const c = claveSabor({ etiqueta: 'Sabor', seccion: 'sabores', ayuda: 'x' })
    expect(c.safeParse('canela').success).toBe(true)
    expect(c.safeParse('inventado').success).toBe(false)
  })

  it('claveSabor produce el tipo con el que index.astro indexa los tokens', () => {
    // index.astro hace colorSabor[s.clave] y tintaClara(r.clave), con
    // tintaClara tipada (clave: keyof typeof tintaSabor), en siete lugares.
    // Con `clave` tipada `string` a secas son siete errores de astro check —
    // y esta fase no puede tocar un solo .astro.
    const campo = claveSabor({ etiqueta: 'Sabor', seccion: 'sabores', ayuda: 'Qué sabor pinta este bloque.' })
    expectTypeOf<z.infer<typeof campo>>().toEqualTypeOf<keyof typeof tokens.sabor>()
  })

  it('las claves de sabor del esquema son exactamente las del token', () => {
    // El cast de Object.keys() es lo único que sostiene el tipo de arriba.
    // Si el token gana un sabor y esta lista no, el cast miente en silencio.
    expect([...CLAVES_DE_SABOR].sort()).toEqual(Object.keys(tokens.sabor).sort())
  })

  // Los diez constructores que siguen no tenían test propio: quedaban
  // cubiertos solo por el typecheck y por auditoría manual del revisor.
  // Eso no alcanza — que anden bien HOY y que la suite los agarre si se
  // rompen MAÑANA son cosas distintas, y es el mismo patrón estructural
  // que dejó pasar, en una tarea anterior, un constructor que no aceptaba
  // ningún valor. Cada uno va en un `it` por DIRECCIÓN (acepta / rechaza),
  // nunca los dos en el mismo `it`: si están juntos y falla el primer
  // `expect`, el segundo ni se corre y el fallo queda tapado — es
  // exactamente lo que pasó en el test de la tupla del Step 6.

  it('numero acepta un valor dentro de su rango', () => {
    const n = numero({ etiqueta: 'Orden', seccion: 'productos', ayuda: 'x', minValor: 1, maxValor: 10 })
    expect(n.safeParse(5).success).toBe(true)
  })

  it('numero rechaza un valor fuera de su rango', () => {
    const n = numero({ etiqueta: 'Orden', seccion: 'productos', ayuda: 'x', minValor: 1, maxValor: 10 })
    expect(n.safeParse(11).success).toBe(false)
  })

  it('la lista cerrada de valores se llama igual en los dos constructores que la tienen', () => {
    // `opcion` la llamaba `valores` y `tokenColor` la llamaba `validos`: un
    // concepto con dos nombres, sin nada que los mantenga alineados. El panel
    // lee este metadato para pintar el selector — con el nombre equivocado no
    // pinta nada, sin excepción y sin error de tipos.
    const base = { etiqueta: 'X', seccion: 'contacto', ayuda: 'Y' } as const
    const conListaCerrada = [
      opcion({ ...base, valores: ['personal', 'negocio'] }),
      tokenColor({ ...base, valores: ['rojoHondo'] }),
    ]
    for (const esquema of conListaCerrada) {
      const meta = panel.get(esquema) as MetaCampo
      expect(Object.keys(meta).filter((k) => /^val(ores|idos)$/.test(k))).toEqual(['valores'])
      expect(meta.valores).toBeDefined()
    }
  })

  it('tokenColor acepta un token declarado en `valores`', () => {
    const t = tokenColor({
      etiqueta: 'Color', seccion: 'sabores', ayuda: 'x', valores: ['rojo', 'azul'],
    })
    expect(t.safeParse('rojo').success).toBe(true)
  })

  it('tokenColor rechaza un token que no está en `valores`', () => {
    const t = tokenColor({
      etiqueta: 'Color', seccion: 'sabores', ayuda: 'x', valores: ['rojo', 'azul'],
    })
    expect(t.safeParse('verde').success).toBe(false)
  })

  it('cuenta lleva el sustantivo con el que ESE texto nombra la lista', () => {
    // Contra el copy real, la colección y la palabra NO coinciden:
    // negocios.tabs[2].cuerpo dice «Las 15 barras» y cuenta sabores;
    // gotas.sabores dice «6 sabores» y cuenta gotas. Con `cuenta` como un
    // string a secas, cruzaConteo() no sabe qué palabra buscar y el aviso
    // no se puede producir.
    const campo = texto({
      etiqueta: 'Cuerpo del panel de barras',
      seccion: 'negocios',
      ayuda: 'El párrafo del panel «Chocolate en barras».',
      maxCaracteres: 170,
      cuenta: { de: 'sabores', sustantivo: 'barras' },
    })
    const meta = panel.get(campo) as MetaCampo
    expect(meta.cuenta).toEqual({ de: 'sabores', sustantivo: 'barras' })
  })

  it('ruta acepta una ruta interna que empieza con «/»', () => {
    const r = ruta({ etiqueta: 'Ruta', seccion: 'buscadores', ayuda: 'x' })
    expect(r.safeParse('/fichas-tecnicas').success).toBe(true)
  })

  it('ruta rechaza una cadena sin la barra inicial', () => {
    const r = ruta({ etiqueta: 'Ruta', seccion: 'buscadores', ayuda: 'x' })
    expect(r.safeParse('fichas-tecnicas').success).toBe(false)
  })

  it('ancla acepta un salto interno y una ruta, y rechaza lo demás', () => {
    // nav.items[].ancla es '#sabores'; footer.productos[3].ancla es
    // '/fichas-tecnicas'. Los dos son «a dónde lleva este enlace» y viven en
    // la misma lista de campos, así que es un solo constructor. `ruta()` no
    // sirve: exige empezar con «/» y rechaza los saltos.
    const campo = ancla({ etiqueta: 'A dónde lleva', seccion: 'portada', ayuda: 'El destino del enlace.' })
    expect(campo.parse('#sabores')).toBe('#sabores')
    expect(campo.parse('/fichas-tecnicas')).toBe('/fichas-tecnicas')
    expect(() => campo.parse('https://ejemplo.com')).toThrow()
    expect(() => campo.parse('sabores')).toThrow()
  })

  it('url acepta una dirección web completa', () => {
    const u = url({ etiqueta: 'Sitio', seccion: 'buscadores', ayuda: 'x' })
    expect(u.safeParse('https://maracacao.mx').success).toBe(true)
  })

  it('url rechaza texto que no es una dirección web', () => {
    const u = url({ etiqueta: 'Sitio', seccion: 'buscadores', ayuda: 'x' })
    expect(u.safeParse('no es una url').success).toBe(false)
  })

  it('correo acepta un correo válido', () => {
    const c = correo({ etiqueta: 'Correo', seccion: 'contacto', ayuda: 'x' })
    expect(c.safeParse('hola@maracacao.mx').success).toBe(true)
  })

  it('correo rechaza texto que no es un correo', () => {
    const c = correo({ etiqueta: 'Correo', seccion: 'contacto', ayuda: 'x' })
    expect(c.safeParse('no-es-correo').success).toBe(false)
  })

  it('slug acepta minúsculas, números y guiones', () => {
    const s = slug({ etiqueta: 'Slug', seccion: 'sabores', ayuda: 'x' })
    expect(s.safeParse('canela').success).toBe(true)
  })

  it('slug rechaza mayúsculas y signos', () => {
    const s = slug({ etiqueta: 'Slug', seccion: 'sabores', ayuda: 'x' })
    expect(s.safeParse('Canela!').success).toBe(false)
  })

  it('archivo acepta minúsculas, números y guiones', () => {
    const a = archivo({ etiqueta: 'Archivo', seccion: 'fichas', ayuda: 'x' })
    expect(a.safeParse('ficha-canela').success).toBe(true)
  })

  it('archivo rechaza mayúsculas, espacios y la extensión', () => {
    const a = archivo({ etiqueta: 'Archivo', seccion: 'fichas', ayuda: 'x' })
    expect(a.safeParse('Ficha Canela.pdf').success).toBe(false)
  })

  it('derivado acepta un entero positivo dentro de su rango', () => {
    const d = derivado({
      etiqueta: 'Total', seccion: 'productos', ayuda: 'x', saleDe: 'la suma de los sabores activos',
    })
    expect(d.safeParse(42).success).toBe(true)
  })

  it('derivado rechaza cero', () => {
    const d = derivado({
      etiqueta: 'Total', seccion: 'productos', ayuda: 'x', saleDe: 'la suma de los sabores activos',
    })
    expect(d.safeParse(0).success).toBe(false)
  })

  it('grupo acepta un objeto cuyos campos cumplen su propio esquema', () => {
    const g = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x', campos: { a: z.string() },
    })
    expect(g.safeParse({ a: 'x' }).success).toBe(true)
  })

  it('grupo rechaza un objeto cuyo campo no cumple el tipo declarado', () => {
    const g = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x', campos: { a: z.string() },
    })
    expect(g.safeParse({ a: 5 }).success).toBe(false)
  })

  it('precioONada acepta null cuando el precio no existe todavía', () => {
    const p = precioONada({ etiqueta: 'Precio', seccion: 'sabores', ayuda: 'x' })
    expect(p.safeParse(null).success).toBe(true)
  })

  it('precioONada acepta un precio real, no solo null — es su razón de existir', () => {
    const p = precioONada({ etiqueta: 'Precio', seccion: 'sabores', ayuda: 'x' })
    expect(p.safeParse(108).success).toBe(true)
  })

  it('precioONada rechaza un decimal, igual que precio', () => {
    const p = precioONada({ etiqueta: 'Precio', seccion: 'sabores', ayuda: 'x' })
    expect(p.safeParse(108.5).success).toBe(false)
  })

  it('valorFijo anota el literal que discrimina una forma de bloque', () => {
    // Sin esto, el `tipo` de cada variante es un z.literal pelado: recorre()
    // lo emite como hoja SIN metadato, y el candado «todo campo tiene
    // etiqueta» de la Tarea 16 lo cuenta como un campo sin nombre.
    const campo = valorFijo({
      etiqueta: 'Forma del bloque',
      seccion: 'fichas',
      ayuda: 'Dice si este bloque es un párrafo, una lista o una tabla.',
      valores: ['parrafo'],
    })
    expect((panel.get(campo) as MetaCampo).etiqueta).toBe('Forma del bloque')
    expect(campo.parse('parrafo')).toBe('parrafo')
    expect(() => campo.parse('lista')).toThrow()
    expectTypeOf<z.infer<typeof campo>>().toEqualTypeOf<'parrafo'>()
  })

  it('canario: las formas internas de Zod son las que recorre() supone', () => {
    // recorre() es lo ÚNICO que toca interna de Zod. Si una versión nueva
    // mueve estas claves, el recorrido devolvería rutas vacías y el panel
    // se pintaría sin campos, sin un solo error. Este test es el lugar
    // donde eso tiene que doler, y el mensaje dice qué hacer.
    const def = (e: unknown) => Object.keys((e as { _zod: { def: object } })._zod.def)
    expect(def(z.object({ a: z.string() }))).toContain('shape')
    expect(def(z.array(z.string()))).toContain('element')
    expect(def(z.tuple([z.string(), z.string()]))).toContain('items')
    expect(def(z.string().optional())).toContain('innerType')
    const du = z.discriminatedUnion('t', [
      z.object({ t: z.literal('a') }),
      z.object({ t: z.literal('b') }),
    ])
    expect(def(du)).toEqual(expect.arrayContaining(['options', 'discriminator']))

    // El switch de recorre() no despacha por estas claves: despacha por
    // `def.type`. Si una versión futura de Zod renombrara el discriminante
    // (p. ej. `'object'` → `'obj'`) pero conservara `shape`, las
    // aserciones de arriba seguirían en VERDE mientras el switch caería en
    // `default` y emitiría cada contenedor como una sola hoja — el mismo
    // silencio que este canario existe para atajar. Por eso el tipo va
    // aparte, con el valor exacto — incluido que la unión discriminada
    // reporta `'union'`, no `'discriminatedUnion'`: es justo la clase de
    // sorpresa que esto tiene que congelar.
    const tipo = (e: unknown) => (e as { _zod: { def: { type: string } } })._zod.def.type
    expect(tipo(z.object({ a: z.string() }))).toBe('object')
    expect(tipo(z.array(z.string()))).toBe('array')
    expect(tipo(z.tuple([z.string(), z.string()]))).toBe('tuple')
    expect(tipo(z.string().optional())).toBe('optional')
    expect(tipo(z.string().nullable())).toBe('nullable')
    expect(tipo(du)).toBe('union')
  })

  it('discriminatedUnion reporta type «union» y guarda discriminator + options', () => {
    const u = z.discriminatedUnion('tipo', [
      z.object({ tipo: z.literal('parrafo'), texto: z.string() }),
      z.object({ tipo: z.literal('lista'), items: z.array(z.string()) }),
    ])
    const def = (u as unknown as { _zod: { def: Record<string, unknown> } })._zod.def
    expect(def.type).toBe('union')
    expect(Object.keys(def).sort()).toEqual(['discriminator', 'inclusive', 'options', 'type'])
    expect(def.discriminator).toBe('tipo')
    expect(Array.isArray(def.options)).toBe(true)
  })

  it('literal reporta type «literal» y guarda su valor en un ARRAY', () => {
    // Un array aunque el literal sea uno solo. varianteDe() lo desarma
    // asumiendo exactamente eso.
    const def = (z.literal('parrafo') as unknown as { _zod: { def: Record<string, unknown> } })._zod.def
    expect(def.type).toBe('literal')
    expect(Object.keys(def).sort()).toEqual(['type', 'values'])
    expect(def.values).toEqual(['parrafo'])
  })

  it('recorre() emite la ruta punteada de cada hoja, con su metadato', () => {
    const esquema = grupo({
      etiqueta: 'Portada', seccion: 'portada', ayuda: 'x',
      campos: {
        titular: tupla({
          etiqueta: 'Titular', seccion: 'portada', ayuda: 'y',
          partes: [
            texto({ etiqueta: 'Renglón 1', seccion: 'portada', ayuda: 'a', maxCaracteres: 40 }),
            texto({ etiqueta: 'Renglón 2', seccion: 'portada', ayuda: 'b', maxCaracteres: 40 }),
          ],
        }),
        sub: texto({ etiqueta: 'Bajada', seccion: 'portada', ayuda: 'c', maxCaracteres: 200 }),
      },
    })

    const hojas: string[] = []
    recorre(esquema, (ruta, meta) => hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`))

    expect(hojas).toEqual([
      'titular.0=Renglón 1',
      'titular.1=Renglón 2',
      'sub=Bajada',
    ])
  })

  it('recorre() no trata una unión SIN discriminante como hoja: truena y dice qué falta', () => {
    // Silencio es el peor resultado acá: una unión emitida como hoja deja
    // todos los campos de sus variantes invisibles para el panel, sin error.
    // Las discriminadas SÍ se recorren desde esta tarea (ver el describe de
    // 'recorre() y serializa() sobre una unión discriminada' más abajo); lo
    // que sigue sin soportarse es una unión a secas, que no dice cuál rama
    // mirar y no se puede recorrer sin adivinar.
    const sinDiscriminante = z.union([
      z.object({ tipo: z.literal('parrafo'), texto: z.string() }),
      z.object({ tipo: z.literal('lista'), items: z.array(z.string()) }),
    ])
    expect(() => recorre(sinDiscriminante, () => {})).toThrow(/unión/i)
  })

  it('un campo anotado y después envuelto en optional conserva su etiqueta', () => {
    // El caso que va a producir la parte B: `texto({...}).optional()`. La
    // base ya venía anotada ANTES de envolverla, así que el metadato queda
    // en el INTERIOR. Si el recorrido mirara solo el envoltorio (que no
    // tiene registro propio), el panel dibujaría el campo sin nombre.
    const esquema = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x',
      campos: {
        chip: texto({ etiqueta: 'Chip', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }).optional(),
      },
    })
    const hojas: string[] = []
    let hojaChip: z.ZodType | undefined
    recorre(esquema, (ruta, meta, hoja) => {
      hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`)
      if (ruta === 'chip') hojaChip = hoja
    })
    expect(hojas).toEqual(['chip=Chip'])
    // La hoja tiene que ser la envoltura COMPLETA, no el `texto` de adentro
    // sin envolver: ese rechazaría `undefined`, justo el valor que
    // `.optional()` existe para aceptar. Mirar solo la ruta y el metadato
    // (como hacía este test antes) no detecta esa pérdida.
    expect(hojaChip!.safeParse(undefined).success).toBe(true)
    expect(hojaChip!.safeParse('Bombón').success).toBe(true)
  })

  it('dos envolturas encadenadas no pierden el metadato (optional y después nullable)', () => {
    // La asimetría que este test fija: decidir «contenedor o hoja» pela
    // TODAS las envolturas, así que buscar el metadato tiene que pelar las
    // mismas. Con UNA envoltura —el único caso que hoy existe en
    // `campos.ts`— las dos coincidían igual; con DOS, el nivel del medio
    // es una envoltura sin registro propio y el metadato se perdía SIN UN
    // SOLO ERROR: el panel dibujaría este campo sin nombre.
    const esquema = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x',
      campos: {
        chip: texto({ etiqueta: 'Chip', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 })
          .optional()
          .nullable(),
      },
    })
    const hojas: string[] = []
    let hojaChip: z.ZodType | undefined
    recorre(esquema, (ruta, meta, hoja) => {
      hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`)
      if (ruta === 'chip') hojaChip = hoja
    })
    expect(hojas).toEqual(['chip=Chip'])
    // Y la hoja sigue siendo la cadena COMPLETA: acepta los dos vacíos que
    // las dos envolturas existen para aceptar, sin dejar de validar lo suyo.
    expect(hojaChip!.safeParse(null).success).toBe(true)
    expect(hojaChip!.safeParse(undefined).success).toBe(true)
    expect(hojaChip!.safeParse('Bombón').success).toBe(true)
    expect(hojaChip!.safeParse('x'.repeat(21)).success).toBe(false)
  })

  it('dos envolturas en el orden inverso tampoco pierden el metadato', () => {
    // El mismo campo escrito al revés (`.nullable().optional()`). Va
    // aparte porque un desenvolvimiento sensible al orden haría caer uno
    // de los dos y no el otro, y ninguna de las dos formas es más
    // «correcta» que la otra para quien escriba el esquema.
    const esquema = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x',
      campos: {
        chip: texto({ etiqueta: 'Chip', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 })
          .nullable()
          .optional(),
      },
    })
    const hojas: string[] = []
    let hojaChip: z.ZodType | undefined
    recorre(esquema, (ruta, meta, hoja) => {
      hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`)
      if (ruta === 'chip') hojaChip = hoja
    })
    expect(hojas).toEqual(['chip=Chip'])
    expect(hojaChip!.safeParse(null).success).toBe(true)
    expect(hojaChip!.safeParse(undefined).success).toBe(true)
    expect(hojaChip!.safeParse('Bombón').success).toBe(true)
    expect(hojaChip!.safeParse('x'.repeat(21)).success).toBe(false)
  })

  it('un campo anotado sobre la cadena entera (nullable adentro) conserva su etiqueta', () => {
    // El caso de `precioONada`: anota la cadena ENTERA, incluido el
    // `.nullable()` final, así que el metadato queda en el EXTERIOR y el
    // interior (el entero antes de envolverlo) no tiene registro propio.
    // Si el recorrido desenvolviera a ciegas hacia el interior, lo perdería.
    const esquema = grupo({
      etiqueta: 'Bloque', seccion: 'sabores', ayuda: 'x',
      campos: {
        precio: precioONada({ etiqueta: 'Precio', seccion: 'sabores', ayuda: 'y' }),
      },
    })
    const hojas: string[] = []
    let hojaPrecio: z.ZodType | undefined
    recorre(esquema, (ruta, meta, hoja) => {
      hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`)
      if (ruta === 'precio') hojaPrecio = hoja
    })
    expect(hojas).toEqual(['precio=Precio'])
    // La hoja tiene que ser la envoltura COMPLETA (con el `.nullable()`
    // puesto): es la que acepta `null`, el valor que precioONada existe
    // para permitir («Próximamente»). El entero de adentro, sin envolver,
    // lo rechazaría — y mirar solo ruta+metadato no lo detecta.
    expect(hojaPrecio!.safeParse(null).success).toBe(true)
    expect(hojaPrecio!.safeParse(108).success).toBe(true)
  })

  it('grupo(...).nullable() emite sus hijos, no una sola hoja', () => {
    // Mismo landmine que la unión: sin `case 'nullable'`, esto caía en
    // `default` y se emitía como una hoja única, con los dos campos de
    // adentro invisibles para el panel.
    const esquema = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x',
      campos: {
        a: texto({ etiqueta: 'A', seccion: 'productos', ayuda: 'y', maxCaracteres: 10 }),
        b: texto({ etiqueta: 'B', seccion: 'productos', ayuda: 'z', maxCaracteres: 10 }),
      },
    }).nullable()
    const hojas: string[] = []
    const hojaPorRuta: Record<string, z.ZodType> = {}
    recorre(esquema, (ruta, meta, hoja) => {
      hojas.push(`${ruta}=${meta?.etiqueta ?? '-'}`)
      hojaPorRuta[ruta] = hoja
    })
    expect(hojas).toEqual(['a=A', 'b=B'])
    // Cada hijo sigue siendo SU PROPIO esquema: valida como el `texto` que
    // es, no como un fragmento genérico del objeto que lo contiene.
    expect(hojaPorRuta.a.safeParse('Chocolate').success).toBe(true)
    expect(hojaPorRuta.b.safeParse('x'.repeat(11)).success).toBe(false)
  })

  it('cargar() tira con la ruta punteada y el mensaje en español', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { titulo: texto({ etiqueta: 'Título', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }) },
    })
    expect(() => cargar('datos/prueba.json', esquema, { titulo: '   ' })).toThrow(
      /datos\/prueba\.json.*titulo.*vacío/s,
    )
  })

  it('cargar() congela: el contenido no se muta por accidente en runtime', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { titulo: texto({ etiqueta: 'Título', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }) },
    })
    const doc = cargar('datos/prueba.json', esquema, { titulo: 'Hola' }) as { titulo: string }
    expect(Object.isFrozen(doc)).toBe(true)
    expect(() => { (doc as { titulo: string }).titulo = 'otro' }).toThrow()
  })

  it('cargar() congela HACIA ADENTRO: el bloque, la lista y cada elemento', () => {
    // El test de arriba usa un esquema PLANO, así que un `congela()`
    // superficial —un solo `Object.freeze()` en la raíz— lo pasaba igual:
    // mutarlo así sobrevivía la suite entera. La garantía existía y nada
    // la fijaba. Para verla hace falta anidar.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        bloque: grupo({
          etiqueta: 'Bloque', seccion: 'productos', ayuda: 'y',
          campos: {
            items: lista({
              etiqueta: 'Items', seccion: 'productos', ayuda: 'z',
              elemento: grupo({
                etiqueta: 'Item', seccion: 'productos', ayuda: 'w',
                campos: {
                  nombre: texto({
                    etiqueta: 'Nombre', seccion: 'productos', ayuda: 'v', maxCaracteres: 20,
                  }),
                },
              }),
              minItems: 1, maxItems: 3,
            }),
          },
        }),
      },
    })
    const doc = cargar('datos/prueba.json', esquema, {
      bloque: { items: [{ nombre: 'Gotas' }] },
    }) as { bloque: { items: { nombre: string }[] } }

    expect(Object.isFrozen(doc)).toBe(true)
    expect(Object.isFrozen(doc.bloque)).toBe(true)
    expect(Object.isFrozen(doc.bloque.items)).toBe(true)
    expect(Object.isFrozen(doc.bloque.items[0])).toBe(true)
    expect(() => { doc.bloque.items[0].nombre = 'otro' }).toThrow()
  })

  it('serializa() escribe bytes canónicos: orden del esquema e invisibles escapados', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        peso: medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }),
        nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'z', maxCaracteres: 20 }),
      },
    })
    // Se pasa con las claves al REVÉS del esquema a propósito. El espacio
    // duro va como escape (\u00a0), nunca pegado: pegado, un editor o un
    // copiar-y-pegar lo puede normalizar a uno común sin que nadie lo note.
    const bytes = serializa(esquema, { nombre: 'Gotas rellenas', peso: '250\u00a0g' })
    // El orden lo manda el esquema, no el objeto: si no, dos guardados
    // seguidos producen diffs distintos sin que cambie nada.
    expect(bytes.indexOf('"peso"')).toBeLessThan(bytes.indexOf('"nombre"'))
    // El espacio duro va escapado: en el fuente no hay ni uno literal, y
    // así se ve en el diff que está.
    expect(bytes).toContain('250\\u00a0g')
    expect(bytes).not.toContain('250\u00a0g')
    // Y un espacio NORMAL —el que sí puede aparecer en cualquier texto—
    // tiene que sobrevivir tal cual: si la clase de invisibles se pasa de
    // ancha, escapar el hard space de más no alcanza para notarlo, pero
    // escapar el espacio normal rompería CADA texto con más de una
    // palabra. «Gotas rellenas» trae un espacio normal adentro: tiene que
    // quedar EXACTAMENTE así, sin escapar.
    expect(bytes).toContain('Gotas rellenas')
  })

  it('serializa() tira si el esquema y el dato no dicen lo mismo', () => {
    // Es la prueba de completitud de la migración: si el esquema declara
    // una ruta que el objeto no tiene, o el objeto trae una que el
    // esquema no declara, no se escribe nada.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { a: texto({ etiqueta: 'A', seccion: 'portada', ayuda: 'y', maxCaracteres: 9 }) },
    })
    // «a» a secas matcheaba cualquier «a» suelta del mensaje en español
    // (por ejemplo la de «declara»), no el nombre de la clave — con
    // comillas angulares alrededor, igual que escribe el mensaje real,
    // afirma la clave de verdad.
    expect(() => serializa(esquema, {})).toThrow(/«a»/)
    expect(() => serializa(esquema, { a: 'ok', sobra: 1 })).toThrow(/sobra/)
  })

  it('serializa(cargar(bytes)) devuelve los mismos bytes', () => {
    // El ida y vuelta completo: escribir, leer, volver a escribir. Es lo
    // que hace CANÓNICO a canónico — si no coinciden, un guardado sin
    // cambios reales igual ensuciaría el diff.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        peso: medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }),
        nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'z', maxCaracteres: 20 }),
      },
    })
    const bytes = serializa(esquema, { peso: '250\u00a0g', nombre: 'Gotas' })
    const vuelta = serializa(esquema, cargar('x.json', esquema, JSON.parse(bytes)))
    expect(vuelta).toBe(bytes)
  })

  // ordenaSegun() decidía «¿esta clave se puede omitir?» mirando UN solo
  // nivel de envoltura (`definicion(hijo).type === 'optional'`). Es el
  // mismo patrón de bug que pagó `recorre()` en cuatro rondas: con UNA
  // envoltura no se nota, con DOS se desincroniza. `texto({...}).optional()`
  // reporta 'optional' en el nivel externo y pasaba; pero
  // `texto({...}).optional().nullable()` reporta 'nullable' en el externo
  // —el `.optional()` quedó adentro— y `serializa()` la exigía como si
  // fuera obligatoria, aunque Zod SÍ acepta `undefined` para ese campo
  // (ver el test de `recorre()` con las envolturas encadenadas, más
  // arriba). El arreglo usa el mismo `desenvuelve()` que ya pela TODOS
  // los niveles para `recorre()`, en vez de un criterio aparte.

  it('serializa() omite una clave con UN wrapper optional cuando falta', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        simple: texto({ etiqueta: 'Simple', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 })
          .optional(),
        obligatoria: texto({
          etiqueta: 'Obligatoria', seccion: 'productos', ayuda: 'z', maxCaracteres: 20,
        }),
      },
    })
    expect(() => serializa(esquema, { obligatoria: 'x' })).not.toThrow()
  })

  it('serializa() omite una clave con DOS wrappers (optional + nullable) cuando falta', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        doble: texto({ etiqueta: 'Doble', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 })
          .optional()
          .nullable(),
        obligatoria: texto({
          etiqueta: 'Obligatoria', seccion: 'productos', ayuda: 'z', maxCaracteres: 20,
        }),
      },
    })
    expect(() => serializa(esquema, { obligatoria: 'x' })).not.toThrow()
  })

  it('serializa() sigue exigiendo una clave obligatoria — no aflojamos de más', () => {
    // Va con 'simple' (UN wrapper), no con 'doble': si compartiera esquema
    // con 'doble', el iterador de Object.keys(shape) se topa con 'doble'
    // primero y ESE throw taparía a este test, sin que le toque el turno a
    // 'obligatoria'. Aislado así, la prueba roja/verde del
    // reporte no depende del orden de otro campo.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        simple: texto({ etiqueta: 'Simple', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 })
          .optional(),
        obligatoria: texto({
          etiqueta: 'Obligatoria', seccion: 'productos', ayuda: 'z', maxCaracteres: 20,
        }),
      },
    })
    expect(() => serializa(esquema, {})).toThrow(/obligatoria/)
  })

  // El switch de ordenaSegun() solo tenía `case 'optional'`: un
  // grupo(...).nullable() con la clave PRESENTE caía en `default` y se
  // saltaba las dos cosas que esta función existe para hacer —reordenar
  // según el esquema y chequear completitud— en el bloque de adentro. Es
  // un TERCER lugar del archivo decidiendo «¿esta envoltura es
  // transparente?» con su propio criterio, la misma familia de bug que
  // ya pagaron recorre() y la opcionalidad de acá arriba.

  it('serializa() tira si sobra una clave adentro de un grupo(...).nullable()', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        hijo: grupo({
          etiqueta: 'Hijo', seccion: 'productos', ayuda: 'y',
          campos: {
            nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'a', maxCaracteres: 20 }),
            precio: texto({ etiqueta: 'Precio', seccion: 'productos', ayuda: 'b', maxCaracteres: 20 }),
          },
        }).nullable(),
      },
    })
    expect(() => serializa(esquema, {
      hijo: { nombre: 'Gotas', precio: '108', sobra: 1 },
    })).toThrow(/sobra/)
  })

  it('serializa() tira si falta una clave adentro de un grupo(...).nullable()', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        hijo: grupo({
          etiqueta: 'Hijo', seccion: 'productos', ayuda: 'y',
          campos: {
            nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'a', maxCaracteres: 20 }),
            precio: texto({ etiqueta: 'Precio', seccion: 'productos', ayuda: 'b', maxCaracteres: 20 }),
          },
        }).nullable(),
      },
    })
    expect(() => serializa(esquema, { hijo: { nombre: 'Gotas' } })).toThrow(/«precio»/)
  })

  it('serializa() reordena según el esquema adentro de un grupo(...).nullable()', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        hijo: grupo({
          etiqueta: 'Hijo', seccion: 'productos', ayuda: 'y',
          campos: {
            nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'a', maxCaracteres: 20 }),
            precio: texto({ etiqueta: 'Precio', seccion: 'productos', ayuda: 'b', maxCaracteres: 20 }),
          },
        }).nullable(),
      },
    })
    // Se pasa con las claves al REVÉS del esquema, como en el test de
    // bytes canónicos: si el switch tratara este bloque como una hoja
    // opaca, esto ni siquiera reordenaría — devolvería el objeto tal
    // cual vino.
    const bytes = serializa(esquema, { hijo: { precio: '108', nombre: 'Gotas' } })
    expect(bytes.indexOf('"nombre"')).toBeLessThan(bytes.indexOf('"precio"'))
  })

  // recorre() y ordenaSegun() caminan el MISMO árbol y tienen que dar la
  // MISMA respuesta a la misma pregunta. Las uniones DISCRIMINADAS ya se
  // recorren de verdad (ver el describe de más abajo, y el caso 'union'
  // de los dos switches en carga.ts); lo que ninguna de las dos sabe
  // atravesar sigue siendo una unión SIN discriminante, que no dice cuál
  // rama mirar. Las dos siguen contestando lo mismo ante ese caso.

  it('serializa() tira con una unión sin discriminante, igual que recorre(): una sola respuesta', () => {
    const esquema = z.object({
      bloque: z.union([
        z.object({ t: z.literal('a'), uno: z.string() }),
        z.object({ t: z.literal('b'), dos: z.string() }),
      ]),
    })
    expect(() => recorre(esquema, () => {})).toThrow(/unión/i)
    expect(() => serializa(esquema, { bloque: { t: 'a', uno: 'hola' } })).toThrow(/unión/i)
  })

  it('una envoltura que no sabemos pelar es ruidosa en los DOS caminos, no una hoja permisiva', () => {
    // `esEnvoltura()` conoce `optional` y `nullable` nada más. Un
    // `grupo(...).default({...})` caía en el `default:` de los dos
    // switches: recorre() lo emitía como UNA hoja —los campos de adentro,
    // invisibles para el panel— y serializa() lo devolvía crudo, dejando
    // pasar claves que el esquema no declara.
    const conDefault = grupo({
      etiqueta: 'Bloque', seccion: 'productos', ayuda: 'x',
      campos: { a: texto({ etiqueta: 'A', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }) },
    }).default({ a: 'z' })
    const esquema = z.object({ b: conDefault })
    expect(() => recorre(esquema, () => {})).toThrow(/envoltura «default»/)
    expect(() => serializa(esquema, { b: { a: 'z', SOBRA: 1 } })).toThrow(/envoltura «default»/)
  })

  it('un texto con .default() tira por la envoltura, no con un falso «falta la clave»', () => {
    // El riesgo va en las DOS direcciones, y esta es la que no estaba
    // documentada: acá Zod ACEPTA `{}` —para eso existe el default— y
    // serializa() reclamaba «falta «x»». Un falso positivo que durante la
    // migración se lee como un bug DE LA MIGRACIÓN y se paga en horas de
    // depuración. El mensaje tiene que hablar de la envoltura que todavía
    // no sabemos pelar, no de una clave ausente.
    const esquema = z.object({
      x: texto({ etiqueta: 'X', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }).default('hola'),
    })
    expect(esquema.safeParse({}).success).toBe(true)
    expect(() => serializa(esquema, {})).toThrow(/envoltura «default»/)
    expect(() => serializa(esquema, {})).not.toThrow(/falta/)
  })

  it('la ruta de una tupla de raíz no empieza con punto', () => {
    // `ordenaSegun()` armaba «.0: …» en la tupla y en la lista de raíz,
    // con un punto colgando adelante, mientras el objeto sí lo resolvía:
    // el mismo helper en una sola de las tres ramas. Es lo que se lee en
    // un log de Vercel.
    const mensajeDe = (fn: () => unknown): string => {
      try { fn() } catch (e) { return (e as Error).message }
      return '(no tiró)'
    }
    const hijo = z.object({ a: z.string() })
    expect(mensajeDe(() => serializa(z.tuple([hijo]), [{ a: 'ok', SOBRA: 1 }]))).toMatch(/^0:/)
    expect(mensajeDe(() => serializa(z.array(hijo), [{ a: 'ok', SOBRA: 1 }]))).toMatch(/^0:/)
  })

  it('cruzaConteo detecta la cifra desactualizada, en número y en letras', () => {
    expect(cruzaConteo('LOS 15 SABORES', 15, 'sabores')).toBeNull()
    expect(cruzaConteo('LOS 15 SABORES', 16, 'sabores')).toMatch(/15.*16/)
    // «seis sabores» es tan probable como «6 sabores» y hoy nada lo mira.
    expect(cruzaConteo('Seis sabores de gotas', 6, 'sabores')).toBeNull()
    expect(cruzaConteo('Seis sabores de gotas', 7, 'sabores')).toMatch(/seis.*7/i)
    // Un número que no es el conteo no molesta.
    expect(cruzaConteo('70% cacao, 15 sabores', 15, 'sabores')).toBeNull()
  })

  it('cruzaConteo no marca un número que no está pegado al sustantivo', () => {
    // Contra copy REAL del sitio: sin la noción de sustantivo, cualquier
    // número entre 0 y 20 en TODO el texto disparaba el aviso, y esto dio
    // cuatro falsos positivos de seis casos reales. Un aviso falso es peor
    // que ninguno: la clienta lee dos veces «dice 16 pero hoy hay 15»
    // sobre una temperatura y deja de leer los avisos para siempre.
    expect(cruzaConteo('Temperatura recomendada: 16–20 °C.', 15, 'sabores')).toBeNull()
    expect(cruzaConteo('Barra 70 g · Gotas 250 g (±10 g)', 15, 'sabores')).toBeNull()
    expect(cruzaConteo('250 g · 1 kg', 15, 'sabores')).toBeNull()
    expect(cruzaConteo('entre 16 y 20 °C', 15, 'sabores')).toBeNull()
  })

  it('la regla de contraste hereda la excepción declarada en los tokens', () => {
    // Un par nuevo tiene que dar 4.5 o más.
    expect(contrasteSuficiente('#7D0303', '#FFFFFF', 'canela')).toBe(true)
    expect(contrasteSuficiente('#F8ECDE', '#FFFFFF', 'canela')).toBe(false)
    // Hierbabuena da 4.41 medido y está declarada soloDisplay en
    // src/tokens/color.ts:182. La regla NO la reinventa ni la borra:
    // la hereda por slug.
    const { sabor, tintaSabor } = tokens
    expect(contrasteSuficiente(sabor.hierbabuena, tintaSabor.hierbabuena, 'hierbabuena')).toBe(true)
    // Y el mismo par, con otro slug, sigue siendo insuficiente.
    expect(contrasteSuficiente(sabor.hierbabuena, tintaSabor.hierbabuena, 'canela')).toBe(false)
  })

  // enLetras, resuelveColor y mejorTinta no traían test propio: el mismo
  // hueco estructural que dejó pasar, en esta fase, un constructor
  // (medida) que rechazaba absolutamente todo, y que después obligó a una
  // ronda aparte para cubrir diez constructores sin test. «Anda hoy» no
  // es «está cubierto». Cada uno va en su propio `it` por dirección, como
  // el resto del archivo.

  it('enLetras devuelve la palabra dentro de la tabla', () => {
    expect(enLetras(15)).toBe('quince')
    expect(enLetras(6)).toBe('seis')
  })

  it('enLetras cae a la cifra como string fuera de la tabla', () => {
    // Este fallback tiene consecuencia real: si devolviera undefined,
    // cruzaConteo armaría un regex con la palabra "undefined" adentro y
    // dejaría de detectar cualquier desactualización.
    expect(enLetras(99)).toBe('99')
  })

  it('resuelveColor devuelve el hex de una clave que existe', () => {
    // Contra el token real, no un hex hardcodeado: si el diseño cambia
    // el color de canela, este test no se rompe por las razones equivocadas.
    expect(resuelveColor('canela')).toBe(tokens.sabor.canela)
  })

  it('resuelveColor devuelve undefined para una clave que no existe', () => {
    expect(resuelveColor('inventado')).toBeUndefined()
  })

  it('mejorTinta devuelve la tinta declarada para una clave que existe', () => {
    expect(mejorTinta('canela')).toBe(tokens.tintaSabor.canela)
  })

  it('mejorTinta devuelve undefined para una clave que no existe', () => {
    expect(mejorTinta('inventado')).toBeUndefined()
  })

  // El 108 está en las 14 barras Y en la pestaña de negocios; el 258 en
  // las gotas, en gotas.precioDesde Y en otra pestaña. precioDesde y
  // precioDe son los únicos lugares donde esos números se calculan —el
  // resto del contenido los va a LEER de acá, no a repetirlos.

  it('los precios repetidos se calculan, no se copian', () => {
    const barras = [{ precio: 130 }, { precio: 108 }, { precio: 122 }]
    expect(precioDesde(barras)).toBe(108)
    // Sube la más barata: el «desde» sube solo.
    expect(precioDesde([{ precio: 130 }, { precio: 122 }])).toBe(122)
  })

  it('precioDesde tira con una lista vacía, en vez de devolver Infinity', () => {
    // Math.min() sin argumentos da Infinity. Sin este chequeo, un array
    // vacío por un error de carga se renderiaría «desde $Infinity» en la
    // portada en vez de romper el build — mucho peor que el undefined que
    // ya motiva a precioDe.
    expect(() => precioDesde([])).toThrow(/vacía/)
  })

  it('precioDesde con un solo elemento devuelve ese precio', () => {
    expect(precioDesde([{ precio: 258 }])).toBe(258)
  })

  it('precioDesde con precios iguales devuelve ese precio', () => {
    // Sin ganador único no hay ambigüedad que resolver: cualquiera de los
    // tres es «el» mínimo.
    expect(precioDesde([{ precio: 108 }, { precio: 108 }, { precio: 108 }])).toBe(108)
  })

  it('precioDe encuentra el precio de un elemento por su clave', () => {
    const gotas = [
      { clave: 'jengibreYNaranja', precio: 340 },
      { clave: 'canela', precio: 258 },
    ]
    expect(precioDe(gotas, 'jengibreYNaranja')).toBe(340)
    expect(precioDe(gotas, 'canela')).toBe(258)
  })

  it('precioDe tira si la clave no existe, en vez de devolver undefined', () => {
    // Un undefined acá se renderiza como «$NaN» en la página. Mejor que
    // reviente el build.
    expect(() => precioDe([{ clave: 'canela', precio: 258 }], 'inventado')).toThrow(/inventado/)
  })

  it('precioDe con una lista vacía tira, igual que con una clave ausente', () => {
    expect(() => precioDe([], 'canela')).toThrow(/canela/)
  })

  // validarContra es el traductor: de un error de Zod a un problema que la
  // clienta entiende, con la ruta para que el panel la lleve al campo. Los
  // cuatro consumidores (navegador, api/panel.ts, vitest, astro build)
  // importan el MISMO archivo — si tuvieran criterios distintos, el panel
  // diría que sí y el build diría que no.

  it('traduce el error de Zod a algo que la clienta entiende, con la ruta para ir', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: {
        hero: grupo({
          etiqueta: 'Portada', seccion: 'portada', ayuda: 'y',
          campos: { sub: texto({ etiqueta: 'Bajada', seccion: 'portada', ayuda: 'z', maxCaracteres: 10 }) },
        }),
      },
    })
    const problemas = validarContra(esquema, { hero: { sub: 'x'.repeat(30) } })
    expect(problemas).toHaveLength(1)
    // La ruta punteada es lo que le permite al panel llevarla al campo.
    expect(problemas[0].campo).toBe('hero.sub')
    expect(problemas[0].gravedad).toBe('impide')
    // Y el título no tiene jerga: nada de «String must contain at most».
    expect(problemas[0].titulo).not.toMatch(/string|expected|invalid/i)
  })

  it('un contenido válido no genera ni un problema', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { t: texto({ etiqueta: 'T', seccion: 'portada', ayuda: 'y', maxCaracteres: 30 }) },
    })
    expect(validarContra(esquema, { t: 'Chocolate mexicano' })).toEqual([])
  })

  it('ofrece el arreglo de un toque cuando lo hay: el espacio que no parte', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: { p: medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'y', maxCaracteres: 30 }) },
    })
    const problemas = validarContra(esquema, { p: 'Gotas de 250 g' })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].arreglo?.valor).toBe('Gotas de 250\u00a0g')
    expect(problemas[0].arreglo?.etiqueta).toMatch(/espacio/i)
  })

  it('el arreglo propuesto pasa la validación que lo rechazó — si no, es peor que no ofrecer nada', () => {
    // Repite el caso de arriba pero cierra el círculo: no alcanza con que
    // el arreglo LUZCA bien, tiene que aprobar el mismo esquema que
    // rechazó el original. Si no, la clienta aprieta el botón, confía, y
    // publica un error igual de inválido.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: { p: medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'y', maxCaracteres: 30 }) },
    })
    const problemas = validarContra(esquema, { p: 'Gotas de 250 g' })
    const arreglo = problemas[0].arreglo
    expect(arreglo).toBeDefined()
    expect(esquema.safeParse({ p: arreglo!.valor }).success).toBe(true)
  })

  it('el arreglo del espacio no se ofrece cuando el espacio ya es el duro — la clase de caracteres, en aislado', () => {
    // Si CIFRA_UNIDAD usara `\s` (como el brief original), matchearía
    // TAMBIÉN el espacio duro U+00A0: un valor con el espacio YA correcto
    // pero inválido por otra razón (acá, el largo) recibiría igual un
    // "arreglo" que reescribe el mismo valor — sigue sin pasar el máximo,
    // exactamente el caso que el punto anterior prueba que no puede pasar.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: { p: medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'y', maxCaracteres: 5 }) },
    })
    const problemas = validarContra(esquema, { p: `70\u00a0g extra` })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].arreglo).toBeUndefined()
  })

  // `titulo: issue.message` no traduc\u00eda los errores de TIPO (`invalid_type`):
  // una clave que falta, un `null`, o un valor de otro tipo llegaban con el
  // mensaje default de Zod, en ingl\u00e9s. Es la mitad del cat\u00e1logo de errores
  // de Zod (la otra mitad son los `refine`/`.max()` con mensaje propio), y
  // la que m\u00e1s importa para `api/panel.ts`: un payload malformado \u2014una
  // clave que falta, un JSON post-migraci\u00f3n con una clave nueva sin
  // llenar\u2014 es EXACTAMENTE lo que produce un `invalid_type`.

  const JERGA_PROHIBIDA = /\b(string|expected|invalid|received|number|boolean|array)\b/i

  it('el t\u00edtulo no tiene jerga cuando la clave falta: es un campo que qued\u00f3 vac\u00edo, no "undefined"', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { t: texto({ etiqueta: 'T', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }) },
    })
    const problemas = validarContra(esquema, {})
    expect(problemas).toHaveLength(1)
    expect(problemas[0].titulo).not.toMatch(JERGA_PROHIBIDA)
    expect(problemas[0].titulo).toMatch(/vac[i\u00ed]o/i)
  })

  it('el t\u00edtulo no tiene jerga cuando llega null en un campo de texto', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { t: texto({ etiqueta: 'T', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }) },
    })
    const problemas = validarContra(esquema, { t: null })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].titulo).not.toMatch(JERGA_PROHIBIDA)
  })

  it('el t\u00edtulo no tiene jerga cuando llega un n\u00famero donde va texto', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'portada', ayuda: 'x',
      campos: { t: texto({ etiqueta: 'T', seccion: 'portada', ayuda: 'y', maxCaracteres: 20 }) },
    })
    const problemas = validarContra(esquema, { t: 5 })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].titulo).not.toMatch(JERGA_PROHIBIDA)
  })

  it('el t\u00edtulo no tiene jerga en un contenedor: un objeto donde va una lista', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'preguntas', ayuda: 'x',
      campos: {
        preguntas: lista({
          etiqueta: 'Preguntas', seccion: 'preguntas', ayuda: 'y',
          elemento: texto({ etiqueta: 'Pregunta', seccion: 'preguntas', ayuda: 'z', maxCaracteres: 90 }),
          minItems: 1, maxItems: 5,
        }),
      },
    })
    const problemas = validarContra(esquema, { preguntas: { no: 'es una lista' } })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].titulo).not.toMatch(JERGA_PROHIBIDA)
  })

  it('el t\u00edtulo no tiene jerga en un contenedor: un string donde va un grupo', () => {
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        hijo: grupo({
          etiqueta: 'Hijo', seccion: 'productos', ayuda: 'y',
          campos: {
            nombre: texto({ etiqueta: 'Nombre', seccion: 'productos', ayuda: 'z', maxCaracteres: 20 }),
          },
        }),
      },
    })
    const problemas = validarContra(esquema, { hijo: 'no es un objeto' })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].titulo).not.toMatch(JERGA_PROHIBIDA)
  })

  it('ning\u00fan problema devuelto trae jerga de Zod, para ning\u00fan c\u00f3digo de issue a la vez', () => {
    // La aserci\u00f3n que cierra la clase entera, no solo los casos de hoy:
    // en vez de mirar UN problema, barre TODOS los que devuelva esta
    // llamada \u2014 con varios c\u00f3digos de issue mezclados a prop\u00f3sito
    // (invalid_type por clave faltante, invalid_type por tipo, too_big
    // con mensaje propio, invalid_type de contenedor) \u2014 contra la lista
    // completa de palabras prohibidas. Un c\u00f3digo nuevo que se cuele
    // ma\u00f1ana con el default de Zod lo agarra AC\u00c1, sin que haga falta
    // acordarse de escribirle un test aparte.
    const esquema = grupo({
      etiqueta: 'x', seccion: 'productos', ayuda: 'x',
      campos: {
        falta: texto({ etiqueta: 'Falta', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }),
        tipoRaro: texto({ etiqueta: 'Tipo raro', seccion: 'productos', ayuda: 'y', maxCaracteres: 20 }),
        largo: texto({ etiqueta: 'Largo', seccion: 'productos', ayuda: 'y', maxCaracteres: 5 }),
        coleccion: lista({
          etiqueta: 'Colecci\u00f3n', seccion: 'productos', ayuda: 'y',
          elemento: texto({ etiqueta: 'Item', seccion: 'productos', ayuda: 'z', maxCaracteres: 10 }),
          minItems: 1, maxItems: 5,
        }),
      },
    })
    const problemas = validarContra(esquema, {
      // 'falta' se omite a prop\u00f3sito: dispara invalid_type con undefined.
      tipoRaro: 5,
      largo: 'x'.repeat(10),
      coleccion: 'no es una lista',
    })
    expect(problemas.length).toBeGreaterThanOrEqual(4)
    for (const p of problemas) {
      expect(p.titulo).not.toMatch(JERGA_PROHIBIDA)
    }
  })

  describe('validar() — los avisos de conteo', () => {
    const esquemaDePrueba = grupo({
      etiqueta: 'Prueba',
      seccion: 'sabores',
      ayuda: 'Un documento de prueba.',
      campos: {
        kicker: texto({
          etiqueta: 'Antetítulo del anaquel',
          seccion: 'sabores',
          ayuda: 'La línea chiquita arriba de «Elige tu barra».',
          maxCaracteres: 30,
          cuenta: { de: 'sabores', sustantivo: 'sabores' },
        }),
      },
    })

    it('avisa cuando el texto dice un número distinto del real', () => {
      const problemas = validar(esquemaDePrueba, { kicker: 'LOS 15 SABORES' }, { sabores: 16 })
      expect(problemas).toEqual([
        {
          campo: 'kicker',
          gravedad: 'avisa',
          titulo: 'Este texto dice «15» pero hoy hay 16.',
          detalle: 'Si agregaste o quitaste algo de la lista, este texto quedó viejo.',
        },
      ])
    })

    it('no avisa cuando el texto y la lista dicen lo mismo', () => {
      expect(validar(esquemaDePrueba, { kicker: 'LOS 16 SABORES' }, { sabores: 16 })).toEqual([])
    })

    it('truena si el esquema declara un conteo que el llamador no pasó', () => {
      // Es un error de cableado, no de contenido: las tres piezas del aviso
      // existían desde la Parte A y nadie las ensamblaba. Si el silencio
      // fuera aceptable acá, la feature podría volver a quedar muerta sin
      // que un solo test lo note.
      expect(() => validar(esquemaDePrueba, { kicker: 'LOS 15 SABORES' }, {})).toThrow(
        /kicker.*«sabores».*no vino en los conteos/,
      )
    })

    it('avisa dentro de una lista de listas: la ruta trae DOS corchetes seguidos (filas[][])', () => {
      // 'filas[][]' es la forma real de la ruta de una celda de tabla: dos
      // niveles de lista SIN una clave entre medio, porque recorre() arma
      // esa parte así (ver el caso 'array' de carga.ts, que agrega `[]`
      // sin punto). enRutas() tiene que poder instanciarla contra el dato,
      // no solo el caso de UN corchete que ya cubrían los otros tests.
      const esquemaTabla = grupo({
        etiqueta: 'Tabla', seccion: 'productos', ayuda: 'x',
        campos: {
          filas: lista({
            etiqueta: 'Filas', seccion: 'productos', ayuda: 'y',
            minItems: 1, maxItems: 3,
            elemento: lista({
              etiqueta: 'Fila', seccion: 'productos', ayuda: 'z',
              minItems: 1, maxItems: 3,
              elemento: texto({
                etiqueta: 'Celda', seccion: 'productos', ayuda: 'w', maxCaracteres: 30,
                cuenta: { de: 'sabores', sustantivo: 'sabores' },
              }),
            }),
          }),
        },
      })
      const problemas = validar(esquemaTabla, { filas: [['LOS 15 SABORES']] }, { sabores: 16 })
      expect(problemas).toEqual([
        {
          campo: 'filas.0.0',
          gravedad: 'avisa',
          titulo: 'Este texto dice «15» pero hoy hay 16.',
          detalle: 'Si agregaste o quitaste algo de la lista, este texto quedó viejo.',
        },
      ])
    })
  })

  describe('recorre() y serializa() sobre una unión discriminada', () => {
    const bloque = z.discriminatedUnion('tipo', [
      z.object({
        tipo: z.literal('parrafo'),
        texto: parrafo({ etiqueta: 'Párrafo', seccion: 'fichas', ayuda: 'Un párrafo de la ficha.', maxCaracteres: 600 }),
      }),
      z.object({
        tipo: z.literal('lista'),
        items: lista({
          etiqueta: 'Viñetas', seccion: 'fichas', ayuda: 'Las viñetas de la ficha.',
          minItems: 1, maxItems: 12,
          elemento: texto({ etiqueta: 'Viñeta', seccion: 'fichas', ayuda: 'Una viñeta.', maxCaracteres: 300 }),
        }),
      }),
    ])

    it('emite una rama por variante, con la variante en la ruta', () => {
      const rutas: string[] = []
      recorre(bloque, (ruta) => rutas.push(ruta))
      expect(rutas).toEqual([
        '<tipo=parrafo>.tipo',
        '<tipo=parrafo>.texto',
        '<tipo=lista>.tipo',
        '<tipo=lista>.items[]',
      ])
    })

    it('cada hoja de una variante conserva su etiqueta', () => {
      const etiquetas = new Map<string, string | undefined>()
      recorre(bloque, (ruta, meta) => etiquetas.set(ruta, meta?.etiqueta))
      expect(etiquetas.get('<tipo=parrafo>.texto')).toBe('Párrafo')
      expect(etiquetas.get('<tipo=lista>.items[]')).toBe('Viñeta')
    })

    it('serializa() elige la variante que dice el dato y reordena adentro', () => {
      const salida = serializa(bloque, { texto: 'Hola', tipo: 'parrafo' })
      expect(JSON.parse(salida)).toEqual({ tipo: 'parrafo', texto: 'Hola' })
      expect(Object.keys(JSON.parse(salida))).toEqual(['tipo', 'texto'])
    })

    it('serializa() truena si el discriminante no es ninguna variante', () => {
      expect(() => serializa(bloque, { tipo: 'tabla', filas: [] })).toThrow(
        /«tipo» dice «tabla», que no es ninguna de las variantes declaradas \(parrafo, lista\)/,
      )
    })

    it('serializa() reclama una clave que la variante elegida no declara', () => {
      // Este assert vivía en el caso de la unión SIN discriminante, donde
      // `serializa()` tira antes de mirar ni una clave —así que probaba lo
      // mismo que la línea de al lado y nada sobre claves sobrantes—,
      // mientras su comentario decía justamente eso. Acá sí: la variante
      // está elegida, se entra a mirar sus claves, y `BASURA` es una que el
      // esquema no declara.
      //
      // Antes de que las uniones se recorrieran de verdad, esto devolvía
      // {"tipo":"parrafo","texto":"Hola","BASURA":"…"}: la clave no
      // declarada viajaba al JSON publicado sin un solo error.
      expect(() => serializa(bloque, { tipo: 'parrafo', texto: 'Hola', BASURA: 'no declarada' }))
        .toThrow(/BASURA/)
    })
  })

  describe('los campos derivados no viajan al JSON', () => {
    const conDerivado = grupo({
      etiqueta: 'Gotas', seccion: 'productos', ayuda: 'El bloque de las gotas.',
      campos: {
        titulo: texto({ etiqueta: 'Título', seccion: 'productos', ayuda: 'El título del bloque.', maxCaracteres: 50 }),
        precioDesde: derivado({
          etiqueta: 'Precio desde', seccion: 'productos',
          ayuda: 'El precio más bajo de las bolsas de gotas.',
          saleDe: 'el precio más bajo de las bolsas de gotas',
        }),
      },
    })

    it('serializa() no escribe el derivado', () => {
      const salida = JSON.parse(serializa(conDerivado, { titulo: 'Gotas', precioDesde: 258 }))
      expect(salida).toEqual({ titulo: 'Gotas' })
    })

    it('cargar() SÍ lo exige: la fachada tiene que injertarlo antes', () => {
      // Es el contrato con la fachada. Si cargar() lo dejara pasar, el sitio
      // publicaría un `undefined` donde va un precio y nada avisaría.
      expect(() => cargar('prueba.json', conDerivado, { titulo: 'Gotas' })).toThrow(/precioDesde/)
    })
  })

  it('el fixture del árbol viejo está entero', async () => {
    // Si este archivo se trunca o se regenera contra el árbol NUEVO, el
    // certificado de la Tarea 14 se vuelve una comparación de algo contra sí
    // mismo: verde y sin valor. Esto no lo impide, pero lo hace ruidoso.
    const fixture = (await import('./fixtures/contenido-2026-09-10.json')).default
    expect(Object.keys(fixture).sort()).toEqual(
      ['fichas', 'gotas', 'marca', 'polvo', 'sabores', 'urlCatalogoBarras'],
    )
    expect(fixture.sabores).toHaveLength(15)
    expect(fixture.fichas).toHaveLength(4)
    expect(Object.keys(fixture.marca)).toHaveLength(21)
  })

  it('capturaFixture() se niega a correr si src/contenido/datos/ ya tiene un documento migrado', () => {
    // Después de esta tarea, src/contenido/datos/sabores.json existe de
    // verdad: si capturaFixture() corriera ahora, leería la FACHADA de
    // sabores —que ya lee su propio JSON con cargar()— en vez de los
    // módulos `as const` originales, y el fixture terminaría siendo una
    // foto del árbol NUEVO contra sí mismo. Se corre como proceso real,
    // igual que `pnpm migra fixture`, para probar el candado tal como se
    // va a disparar de verdad — no una versión mockeada de node:fs.
    let fallo = false
    let salida = ''
    try {
      execFileSync('pnpm', ['exec', 'tsx', 'scripts/migra-contenido.ts', 'fixture'], { stdio: 'pipe' })
    } catch (e) {
      fallo = true
      salida = String((e as { stderr: Buffer }).stderr)
    }
    expect(fallo).toBe(true)
    expect(salida).toContain('ya tiene al menos un documento migrado')
    // Y el mensaje explica el POR QUÉ, no solo que se niega: quien lo lea
    // dentro de seis meses tiene que entender qué está protegiendo.
    expect(salida).toMatch(/certificado de la Tarea 14/)
  })

  it('el documento de productos vuelve a salir idéntico', async () => {
    // Bytes canónicos: si esto no se cumple, dos guardados seguidos producen
    // diffs distintos sin que haya cambiado nada, y el historial del repo
    // se llena de ruido que esconde los cambios de verdad.
    const bytes = readFileSync('src/contenido/datos/sabores.json', 'utf8')
    const cargado = cargar('src/contenido/datos/sabores.json', esquemaSabores, JSON.parse(bytes))
    // [I-2] serializa() ya termina en '\n' — antes había que pegárselo acá
    // a mano porque nunca podía coincidir con un archivo real.
    expect(serializa(esquemaSabores, cargado)).toBe(bytes)
  })

  describe('el documento de fichas', () => {
    it('vuelve a salir idéntico', () => {
      const bytes = readFileSync('src/contenido/datos/fichas.json', 'utf8')
      const cargado = cargar('src/contenido/datos/fichas.json', esquemaFichas, JSON.parse(bytes))
      expect(serializa(esquemaFichas, cargado)).toBe(bytes)
    })

    it('toda fila trae una celda por encabezado', () => {
      // El esquema no puede expresar esto: `lista` no sabe cuánto mide su
      // hermana. Y una fila con una celda de menos renderiza una tabla
      // corrida — el modo de falla que el PDF le manda a las cafeterías.
      for (const ficha of fichasBase) {
        for (const seccion of ficha.secciones) {
          for (const bloque of seccion.bloques) {
            if (bloque.tipo !== 'tabla') continue
            for (const fila of bloque.filas) {
              expect(fila, `${ficha.archivo} · ${seccion.titulo}`).toHaveLength(bloque.encabezados.length)
            }
          }
        }
      }
    })

    it('el panel puede nombrar todas las hojas de las tres formas de bloque', () => {
      // Es la prueba de que las uniones se recorren de verdad: si recorre()
      // emitiera el bloque como hoja opaca, este test vería 1 ruta en vez de
      // las 8 de las tres variantes.
      const rutas: string[] = []
      recorre(esquemaFichas, (r, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${r}`).toBeTruthy()
        rutas.push(r)
      })
      const deBloques = rutas.filter((r) => r.includes('bloques[]'))
      expect(deBloques).toEqual([
        'fichas[].secciones[].bloques[]<tipo=parrafo>.tipo',
        'fichas[].secciones[].bloques[]<tipo=parrafo>.texto',
        'fichas[].secciones[].bloques[]<tipo=lista>.tipo',
        'fichas[].secciones[].bloques[]<tipo=lista>.items[]',
        'fichas[].secciones[].bloques[]<tipo=tabla>.tipo',
        'fichas[].secciones[].bloques[]<tipo=tabla>.encabezados[]',
        'fichas[].secciones[].bloques[]<tipo=tabla>.filas[][]',
      ])
    })
  })

  describe('el esquema de cabecera', () => {
    const cabecera = grupo({
      etiqueta: 'Cabecera', seccion: 'portada', ayuda: 'Prueba.',
      campos: camposDeCabecera,
    })

    // Una fábrica y no una constante: cada test que muta necesita su propia
    // copia. Compartir un objeto entre tests los acopla por orden de
    // ejecución, que es el bug de test más difícil de ver.
    const hoy = () => {
      const m = JSON.parse(JSON.stringify(fixture.marca))
      return {
        titulo: m.titulo, descripcion: m.descripcion, skipLink: m.skipLink,
        marca: m.marca, nav: m.nav, hero: m.hero,
      }
    }

    it('valida el contenido de hoy', () => {
      expect(validar(cabecera, hoy(), { sabores: 15 })).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(cabecera, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('el renglón 2 del titular exige una coma y solo una', () => {
      // La plantilla le SACA la coma final y pinta una roja en su lugar. Con
      // dos comas, la del medio se queda: «70% CACAO, DE VERDAD,,» en el h1.
      //
      // El valor de prueba tiene que caber en el tope de 20 caracteres, o el
      // problema sale por LARGO y no por la coma — y entonces el test pasa
      // igual con la regla de la coma rota. «70% CACAO, DE VERDAD,» mide 21 y
      // hacía exactamente eso: afirmaba la ruta, que las dos reglas comparten.
      const datos = hoy()
      datos.hero.titular = ['CHOCOLATE', 'MEXICANO, RICO,', 'CACAO.']
      const problemas = validar(cabecera, datos, { sabores: 15 })
      // Y se afirma el MENSAJE, no solo la ruta: `hero.titular.1` es la misma
      // para el tope de caracteres y para la coma, así que la ruta sola no
      // distingue cuál de las dos reglas se disparó.
      expect(problemas).toHaveLength(1)
      expect(problemas[0].campo).toBe('hero.titular.1')
      expect(problemas[0].titulo).toMatch(/coma/i)
    })
  })

  describe('el esquema de producto', () => {
    const producto = grupo({
      etiqueta: 'Producto', seccion: 'productos', ayuda: 'Prueba.',
      campos: camposDeProducto,
    })
    const hoy = () => {
      const m = JSON.parse(JSON.stringify(fixture.marca))
      // Los derivados NO están en el JSON, pero cargar() y validar() los
      // exigen: es el contrato con la fachada. El fixture los tiene porque
      // salió del módulo viejo, donde estaban escritos a mano.
      return { postura: m.postura, anaquel: m.anaquel, minis: m.minis, gotas: m.gotas, polvoCard: m.polvoCard, polvo: m.polvo }
    }
    const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, ingredientes: 5 }

    it('valida el contenido de hoy, avisos incluidos', () => {
      expect(validar(producto, hoy(), CONTEOS)).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(producto, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('avisa si el anaquel dice un número de sabores que ya no es', () => {
      const problemas = validar(producto, hoy(), { ...CONTEOS, sabores: 16 })
      expect(problemas).toContainEqual(
        expect.objectContaining({ campo: 'anaquel.kicker', gravedad: 'avisa' }),
      )
    })

    it('los tres espacios duros se exigen', () => {
      // El modo de falla es invisible en el escritorio y evidente en el
      // celular: la «g» sola en el renglón siguiente.
      const roto = hoy()
      roto.anaquel.pesoInsignia = '70 g' // espacio NORMAL, escrito a propósito
      const problemas = validar(producto, roto, CONTEOS)
      expect(problemas.map((p) => p.campo)).toContain('anaquel.pesoInsignia')
    })
  })

  describe('el esquema de experiencia', () => {
    const experiencia = grupo({
      etiqueta: 'Experiencia', seccion: 'catar', ayuda: 'Prueba.',
      campos: camposDeExperiencia,
    })
    const hoy = () => {
      const m = JSON.parse(JSON.stringify(fixture.marca))
      return { catar: m.catar, recetas: m.recetas, nosotros: m.nosotros }
    }
    const CONTEOS = { pasos: 6, recetas: 4 }

    it('valida el contenido de hoy, avisos incluidos', () => {
      expect(validar(experiencia, hoy(), CONTEOS)).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(experiencia, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('el chip de polvo puede faltar, y falta en tres de las cuatro recetas', () => {
      const datos = hoy()
      expect(datos.recetas.lista.filter((r: object) => 'chipPolvo' in r)).toHaveLength(1)
      expect(validar(experiencia, datos, CONTEOS)).toEqual([])
    })

    it('el chip opcional conserva su etiqueta a través del .optional()', () => {
      // `panel.get()` NO sigue la cadena de padres a través de .optional()
      // —crea un tipo nuevo, sin `parent`— aunque sí la siga a través de
      // .refine(). Si esto se rompe, el panel dibuja ese campo sin nombre y
      // no hay ningún error que lo diga.
      const etiquetas = new Map<string, string | undefined>()
      recorre(experiencia, (ruta, meta) => etiquetas.set(ruta, meta?.etiqueta))
      expect(etiquetas.get('recetas.lista[].chipPolvo')).toBe('Cápsula de polvo')
    })
  })

  describe('el esquema de negocio', () => {
    const negocio = grupo({
      etiqueta: 'Negocio', seccion: 'negocios', ayuda: 'Prueba.',
      campos: camposDeNegocio,
    })
    const hoy = () => {
      const m = JSON.parse(JSON.stringify(fixture.marca))
      return { negocios: m.negocios, preguntas: m.preguntas }
    }
    const CONTEOS = { sabores: 15, gotas: 6, polvo: 8, preguntas: 8 }

    it('valida el contenido de hoy, avisos incluidos', () => {
      expect(validar(negocio, hoy(), CONTEOS)).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(negocio, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('cada panel tiene su propia regla de conteo', () => {
      // Es lo que la `tupla` compra y la `lista` no podía: tres reglas
      // distintas sobre tres campos con la misma forma.
      const cuentas = new Map<string, string | undefined>()
      recorre(negocio, (ruta, meta) => cuentas.set(ruta, meta?.cuenta && `${meta.cuenta.de}/${meta.cuenta.sustantivo}`))
      expect(cuentas.get('negocios.tabs.0.cuerpo')).toBe('polvo/variedades')
      expect(cuentas.get('negocios.tabs.1.datos[]')).toBe('gotas/sabores')
      expect(cuentas.get('negocios.tabs.2.cuerpo')).toBe('sabores/barras')
    })

    it('avisa en el panel de barras si cambia la cantidad de sabores', () => {
      const problemas = validar(negocio, hoy(), { ...CONTEOS, sabores: 16 })
      expect(problemas).toContainEqual(
        expect.objectContaining({ campo: 'negocios.tabs.2.cuerpo', gravedad: 'avisa' }),
      )
    })
  })

  describe('el esquema de contacto', () => {
    const contacto = grupo({
      etiqueta: 'Contacto', seccion: 'contacto', ayuda: 'Prueba.',
      campos: camposDeContacto,
    })
    const hoy = () => ({ contacto: JSON.parse(JSON.stringify(fixture.marca.contacto)) })

    it('valida el contenido de hoy', () => {
      expect(validar(contacto, hoy(), {})).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(contacto, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('el correo declara sus tres hermanas y rechaza lo que no es un correo', () => {
      const metas = new Map<string, MetaCampo | undefined>()
      recorre(contacto, (ruta, meta) => metas.set(ruta, meta))
      expect(metas.get('contacto.correo')?.escribeTambien).toEqual(['nav.pie.1', 'negocios.correo'])

      const roto = hoy()
      roto.contacto.correo = 'maracacaomx arroba gmail punto com'
      expect(validar(contacto, roto, {}).map((p) => p.campo)).toContain('contacto.correo')
    })

    describe('la dirección postal para Google, cruzada contra el pie de página', () => {
      // `direccionPostal` (JSON-LD) y `direccion[1]` (el pie de página)
      // cuentan la MISMA dirección en dos formas. Si se desalinean, Google
      // y la página dicen cosas distintas y nadie se entera hasta que
      // alguien busca el puesto donde el sitio dice y no lo encuentra ahí.

      it('el contenido de hoy no dispara el candado', () => {
        expect(validar(contacto, hoy(), {})).toEqual([])
      })

      it('rechaza cuando la segunda línea de la dirección deja de traer el código postal', () => {
        const roto = hoy()
        roto.contacto.direccion[1] = 'Coyoacán, CDMX' // sin el «C.P. 04100»
        expect(validar(contacto, roto, {}).map((p) => p.campo))
          .toContain('contacto.direccionPostal.codigoPostal')
      })

      it('rechaza cuando la segunda línea de la dirección deja de traer la localidad', () => {
        const roto = hoy()
        roto.contacto.direccion[1] = 'C.P. 04100, CDMX' // sin «Coyoacán»
        expect(validar(contacto, roto, {}).map((p) => p.campo))
          .toContain('contacto.direccionPostal.localidad')
      })

      it('el código postal tiene que ser de 5 dígitos', () => {
        const roto = hoy()
        roto.contacto.direccionPostal.codigoPostal = '4100'
        expect(validar(contacto, roto, {}).map((p) => p.campo))
          .toContain('contacto.direccionPostal.codigoPostal')
      })
    })
  })

  describe('el esquema de páginas', () => {
    const paginas = grupo({
      etiqueta: 'Páginas', seccion: 'fichas', ayuda: 'Prueba.',
      campos: camposDePaginas,
    })
    const hoy = () => {
      const m = JSON.parse(JSON.stringify(fixture.marca))
      return { fichasTecnicas: m.fichasTecnicas, noEncontrada: m.noEncontrada, footer: m.footer }
    }

    it('valida el contenido de hoy', () => {
      expect(validar(paginas, hoy(), {})).toEqual([])
    })

    it('toda hoja tiene etiqueta, ayuda y sección', () => {
      recorre(paginas, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
      })
    })

    it('los dos espacios duros de footer.productos se exigen', () => {
      // El modo de falla es invisible en el escritorio y evidente en el
      // celular: la «g» sola en el renglón siguiente.
      const roto = hoy()
      roto.footer.productos[0].texto = 'Barras 70 g' // espacio NORMAL, a propósito
      const problemas = validar(paginas, roto, {})
      expect(problemas.map((p) => p.campo)).toContain('footer.productos.0.texto')
    })

    it('footer.productos nombra el elemento con su texto, no con «Enlace» a secas', () => {
      // Igual que el test de «el metadato dice lo que significa»: `elemento`
      // guarda el ESQUEMA del elemento, y su propio registro trae `nombra`.
      const metaLista = panel.get(camposDePaginas.footer.shape.productos) as MetaCampo
      const nombra = (panel.get(metaLista.elemento as z.ZodType) as MetaCampo).nombra
      expect(nombra?.({ texto: 'Fichas técnicas' })).toBe('Fichas técnicas')
      expect(nombra?.({})).toBe('Enlace')
    })
  })

  describe('el contraste de la banda de cada sabor', () => {
    const unSabor = {
      orden: 1, slug: 'canela', clave: 'canela', nombre: 'Canela', cacao: 'Cacao 70%',
      precio: 108, ingredientes: 'Licor de cacao, azúcar, manteca de cacao, lecitina de soya, esencia natural',
      catalogo: null,
    }
    const doc = (sabor: object) => ({
      urlCatalogoBarras: 'https://chocolateria.pulpos.shop',
      sabores: [sabor], gotas: [{ clave: 'canela', nombre: 'Canela', precio: 258 }],
      polvo: [{ archivo: 'etiqueta-canela', nombre: 'Canela' }],
    })

    it('los 15 sabores de hoy pasan la regla', () => {
      const bytes = readFileSync('src/contenido/datos/sabores.json', 'utf8')
      expect(validar(esquemaSabores, JSON.parse(bytes), {})).toEqual([])
    })

    it('hereda la excepción de los tokens en vez de reinventarla', () => {
      // La hierbabuena da 4.41 —abajo del 4.5— y está declarada
      // `saboresSoloDisplay` en src/tokens/color.ts a propósito. Si la regla
      // tuviera su propia lista de excepciones, esta se le escaparía y el
      // build no publicaría un contenido que hoy es correcto.
      expect(tokens.saboresSoloDisplay).toContain('hierbabuena')
      const hierbabuena = { ...unSabor, slug: 'hierbabuena', clave: 'hierbabuena', nombre: 'Hierbabuena' }
      expect(validar(esquemaSabores, doc(hierbabuena), {})).toEqual([])
    })
  })

  describe('el documento del sitio, entero', () => {
    // Derivado del fixture y no escrito a mano: es un documento COMPLETO,
    // así que el mapa se puede sacar del propio dato. Los mapas parciales
    // de los fragmentos de más arriba sí se escriben, porque lo que
    // documentan es qué colecciones necesita ESE fragmento.
    const CONTEOS = conteosDe({ sitio: fixture.marca, sabores: fixture })

    it('los 21 bloques están, en el orden de la página', () => {
      // El orden de las claves del esquema es el orden del JSON y el orden
      // en que el panel dibuja las secciones. Si alguien reordena los
      // spread de sitio.ts, el JSON entero se reescribe y el diff del
      // commit siguiente es de 900 líneas sin que haya cambiado nada.
      const bloques = Object.keys((esquemaSitio as unknown as { _zod: { def: { shape: object } } })._zod.def.shape)
      expect(bloques).toEqual([
        'titulo', 'descripcion', 'skipLink', 'marca', 'nav', 'hero',
        'postura', 'anaquel', 'minis', 'gotas', 'polvoCard', 'polvo',
        'catar', 'recetas', 'nosotros',
        'negocios', 'preguntas', 'contacto',
        'fichasTecnicas', 'noEncontrada', 'footer',
      ])
    })

    it('valida el contenido de hoy, entero y con avisos', () => {
      // La prueba de que el esquema describe EXACTAMENTE lo que hay. Si
      // sobra una clave o falta una, esto lo dice con la ruta.
      expect(validar(esquemaSitio, JSON.parse(JSON.stringify(fixture.marca)), CONTEOS)).toEqual([])
    })

    it('todas las hojas tienen etiqueta, ayuda y sección', () => {
      const rutas: string[] = []
      recorre(esquemaSitio, (ruta, meta) => {
        expect(meta?.etiqueta, `sin etiqueta: ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `sin ayuda: ${ruta}`).toBeTruthy()
        expect(meta?.seccion, `sin sección: ${ruta}`).toBeTruthy()
        rutas.push(ruta)
      })
      expect(new Set(rutas).size, 'hay rutas repetidas').toBe(rutas.length)
      expect(rutas.length).toBeGreaterThan(190)
    })

    it('ninguna etiqueta ni ayuda usa una palabra que la marca no usa', () => {
      // El filtro de MARCA vale también para lo que lee la clienta en el
      // panel. El de MAQUETA no: el panel necesita la palabra «Borrador».
      recorre(esquemaSitio, (ruta, meta) => {
        expect(palabraProhibida(meta?.etiqueta ?? ''), `en la etiqueta de ${ruta}`).toBeNull()
        expect(palabraProhibida(meta?.ayuda ?? ''), `en la ayuda de ${ruta}`).toBeNull()
      })
    })
  })

  describe('los derivados del sitio', () => {
    const FUENTES = {
      sabores: [{ precio: 122 }, { precio: 108 }],
      gotas: [{ clave: 'jengibreYNaranja', precio: 340 }, { clave: 'canela', precio: 258 }],
    }

    it('la tabla de derivados es exactamente la que el esquema declara', () => {
      // ES EL CANDADO DE LA TAREA. Sin él, un campo marcado `derivado` en el
      // esquema y ausente de esta tabla se queda sin valor: serializa() no
      // lo escribe, injerta() no lo calcula, y cargar() truena en el build
      // con «falta «precioDesde»» sin decir por qué. Y al revés —una entrada
      // de más— escribe un valor en una ruta que el esquema no marca como
      // derivada, y esa la clienta la puede editar creyendo que sirve.
      const delEsquema: string[] = []
      recorre(esquemaSitio, (ruta, meta) => {
        if (meta?.control === 'derivado') delEsquema.push(ruta)
      })
      expect(DERIVADOS_DEL_SITIO.map((d) => d.ruta).sort()).toEqual(delEsquema.sort())
    })

    it('injerta escribe los cinco valores en su ruta', () => {
      const crudo = { gotas: {}, negocios: { tabs: [{}, {}, {}] }, anaquel: {} }
      const con = injerta(crudo, FUENTES) as {
        gotas: { precioDesde: number; precioJengibre: number }
        negocios: { tabs: { precio?: number }[] }
        anaquel: { contadorDe: string }
      }
      expect(con.gotas.precioDesde).toBe(258)
      expect(con.gotas.precioJengibre).toBe(340)
      expect(con.negocios.tabs[1].precio).toBe(258)
      expect(con.negocios.tabs[2].precio).toBe(108)
      expect(con.negocios.tabs[0].precio).toBeUndefined()
      expect(con.anaquel.contadorDe).toBe('de 2')
    })

    it('injerta no toca el objeto que recibe', () => {
      // El crudo viene del import del JSON, que en un bundle es un módulo
      // COMPARTIDO: mutarlo le cambia el contenido a cualquier otro que lo
      // importe, y el orden de los imports decide qué ve cada uno.
      const crudo = { gotas: {}, negocios: { tabs: [{}, {}, {}] }, anaquel: {} }
      injerta(crudo, FUENTES)
      expect(crudo.gotas).toEqual({})
    })
  })
})

/*
 * Los candados de la §11: los que no se podían escribir antes de que
 * existiera un catálogo de campos que supiera nombrar TODO el contenido
 * del sitio. Antes de la Tarea 12 no había `DOCUMENTOS` para recorrer, ni
 * `recorre()` para caminarlo genéricamente sin saber de antemano la forma
 * de cada documento — así que estos diez tests son nuevos, no reescritos.
 */
/*
 * El caminante del candado 9. Vive afuera del `it` para que su mutación
 * (el 9b) corra EXACTAMENTE el mismo código que se aplica a los documentos
 * de verdad: un caminante de prueba aparte es un caminante que se
 * desincroniza del que importa, y este candado existe justamente porque
 * una norma que nadie puede ver se vuelve a romper.
 */
type DefDeZod = { type: string; [k: string]: unknown }
const defDe = (e: unknown) => (e as { _zod: { def: DefDeZod } })._zod.def
const metaDe = (e: unknown) => panel.get(e as z.ZodType) as MetaCampo | undefined

/** La marca de variante que arma `recorre()` para la ruta: `<tipo=parrafo>`. */
const marcaDeVariante = (opcion: z.ZodType, discriminante: string): string => {
  const shape = defDe(opcion).shape as Record<string, z.ZodType> | undefined
  const campo = shape?.[discriminante]
  const valores = campo && (defDe(campo).values as unknown[] | undefined)
  const valor = Array.isArray(valores) && typeof valores[0] === 'string' ? valores[0] : '?'
  return `<${discriminante}=${valor}>`
}

const revisaNombra = (esquema: z.ZodType, ruta: string, mal: string[]): void => {
  const d = defDe(esquema)
  switch (d.type) {
    case 'array': {
      const elemento = d.element as z.ZodType
      if (metaDe(esquema)?.nombra) {
        mal.push(`${ruta}: el «nombra» cuelga de la lista; va en el grupo del elemento`)
      }
      const dentro = defDe(elemento)
      if (dentro.type === 'object' && !metaDe(elemento)?.nombra) {
        mal.push(`${ruta}[]: el grupo del elemento no declara «nombra»`)
      }
      // Una unión NO reporta `type: 'object'`, así que la versión anterior
      // —que solo miraba el caso `object`— no veía las tres variantes de
      // bloque de una ficha: las tres estaban sin `nombra` y el candado no
      // decía nada. El reclamo va variante por variante porque lo que
      // distingue una fila de otra es distinto en cada forma: el texto del
      // párrafo, la primera viñeta de la lista, el primer encabezado de la
      // tabla.
      if (dentro.type === 'union') {
        const discriminante = typeof dentro.discriminator === 'string' ? dentro.discriminator : '?'
        for (const opcion of dentro.options as z.ZodType[]) {
          if (metaDe(opcion)?.nombra) continue
          mal.push(
            `${ruta}[]${marcaDeVariante(opcion, discriminante)}: la variante del elemento no declara «nombra»`,
          )
        }
      }
      return revisaNombra(elemento, `${ruta}[]`, mal)
    }
    case 'object':
      for (const [k, v] of Object.entries(d.shape as Record<string, z.ZodType>)) {
        revisaNombra(v, ruta ? `${ruta}.${k}` : k, mal)
      }
      return
    case 'tuple':
      return (d.items as z.ZodType[]).forEach((it, i) => revisaNombra(it, `${ruta}.${i}`, mal))
    case 'union':
      return (d.options as z.ZodType[]).forEach((o) => revisaNombra(o, ruta, mal))
    case 'optional':
    case 'nullable':
      return revisaNombra(d.innerType as z.ZodType, ruta, mal)
    default:
      return
  }
}

describe('los candados del sistema de contenido', () => {
  /** El dato crudo de cada documento, con los derivados ya injertados. */
  const CRUDO: Record<IdDocumento, unknown> = {
    sitio: injerta(JSON.parse(readFileSync('src/contenido/datos/sitio.json', 'utf8')), { sabores, gotas }),
    sabores: JSON.parse(readFileSync('src/contenido/datos/sabores.json', 'utf8')),
    fichas: JSON.parse(readFileSync('src/contenido/datos/fichas.json', 'utf8')),
  }

  // Los conteos salen del DATO, nunca de un mapa escrito acá. Escritos a
  // mano, este candado quedaba ciego justo al revés de lo que hace falta:
  // agregar una barra al JSON sin tocar los textos daba verde (el mapa
  // seguía diciendo 15, igual que el kicker) y agregar la barra Y corregir
  // el kicker a «16» daba rojo. Premiaba el error y castigaba el arreglo.
  const CONTEOS = conteosDe({ sitio: CRUDO.sitio, sabores: CRUDO.sabores })

  it('1 · los tres documentos están declarados', () => {
    expect(Object.keys(DOCUMENTOS).sort()).toEqual(['fichas', 'sabores', 'sitio'])
  })

  // [I-2, revisión final] El candado permanente: lee cada documento REAL
  // del repo tal cual está en disco —`JSON.parse` directo, sin pasar por
  // `cargar()`/`congela()`, que podría disimular una diferencia real
  // detrás de una transformación de Zod— y confirma que volver a
  // serializar ese JSON crudo da BYTE A BYTE el mismo archivo, `\n` final
  // incluido. Antes de este fix, esto no podía dar verdad NUNCA: todo
  // archivo bajo `src/contenido/datos/` termina en `\n` y `serializa()`
  // no lo agregaba, así que el último byte siempre difería. Es también la
  // prueba de que cada esquema describe exactamente el contenido de hoy:
  // el día que deje de ser así, este test —no un publish real de la
  // clienta— es el que se entera primero.
  it('0 · serializa() es la inversa exacta de cada archivo real bajo src/contenido/datos/', () => {
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      const ruta = `src/contenido/datos/${id}.json`
      const texto = readFileSync(ruta, 'utf8')
      expect(serializa(DOCUMENTOS[id], JSON.parse(texto)), id).toBe(texto)
    }
  })

  it('2 · toda ruta del esquema existe en el dato, y toda clave del dato está en el esquema', () => {
    // El candado anti-desincronización. `serializa()` ya lo verifica al
    // escribir, pero eso pasa UNA vez, cuando alguien corre el script.
    // Esto lo verifica en cada build, que es cuando importa: si alguien
    // edita un JSON a mano y le agrega una clave, o le saca una, el build
    // no publica.
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      expect(() => serializa(esquema, CRUDO[id as IdDocumento]), id).not.toThrow()
    }
  })

  it('3 · bytes canónicos: lo que se lee y se vuelve a escribir es idéntico', () => {
    // Si esto no se cumple, dos guardados seguidos producen diffs
    // distintos sin que haya cambiado nada, y el historial se llena de
    // ruido que esconde los cambios de verdad.
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      const ruta = `src/contenido/datos/${id}.json`
      const bytes = readFileSync(ruta, 'utf8')
      const cargado = cargar(ruta, DOCUMENTOS[id], CRUDO[id])
      // [I-2] serializa() ya termina en '\n'.
      expect(serializa(DOCUMENTOS[id], cargado), id).toBe(bytes)
    }
  })

  it('4 · el contenido publicado no tiene ni un problema, avisos incluidos', () => {
    // El candado de conteos (Ruling F). `cargar()` no cruza conteos porque
    // un aviso no impide publicar; acá sí se exige que no haya ninguno,
    // porque este test corre adentro de `pnpm build` y el contenido que se
    // publica no tiene por qué tener textos viejos.
    for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
      expect(validar(DOCUMENTOS[id], CRUDO[id], CONTEOS), id).toEqual([])
    }
  })

  it('5 · todo campo de todo documento tiene etiqueta, ayuda y una sección válida', () => {
    const SECCIONES = new Set<string>([
      'portada', 'productos', 'sabores', 'negocios', 'recetas', 'nosotros', 'catar',
      'preguntas', 'contacto', 'pie', 'fichas', 'buscadores', 'accesibilidad', 'no-encontrada',
    ])
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      recorre(esquema, (ruta, meta) => {
        expect(meta?.etiqueta, `${id} · ${ruta}`).toBeTruthy()
        expect(meta?.ayuda, `${id} · ${ruta}`).toBeTruthy()
        expect(SECCIONES.has(meta?.seccion ?? ''), `${id} · ${ruta}: sección «${meta?.seccion}»`).toBe(true)
      })
    }
  })

  it('6 · lo que la clienta lee en el panel pasa el filtro de la marca', () => {
    // El de MARCA, no el de MAQUETA: el panel necesita la palabra
    // «Borrador» para su concepto central.
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      recorre(esquema, (ruta, meta) => {
        expect(palabraProhibida(meta?.etiqueta ?? ''), `${id} · ${ruta} · etiqueta`).toBeNull()
        expect(palabraProhibida(meta?.ayuda ?? ''), `${id} · ${ruta} · ayuda`).toBeNull()
      })
    }
  })

  it('7 · lo que la clienta NO puede editar es exactamente lo declarado', () => {
    // El reparto de permisos, escrito una vez y verificado. Si mañana
    // alguien marca `quien: 'marcos'` en un campo de copy, la clienta se
    // queda sin poder editar su propio texto y nadie se entera hasta que
    // ella lo pide.
    const deMarcos: string[] = []
    recorre(DOCUMENTOS.sitio, (ruta, meta) => {
      if (meta?.quien === 'marcos') deMarcos.push(ruta)
    })
    // Rutas estructurales: anclas, identificadores internos, colores,
    // valores fijos, derivados y el honeypot. NINGUNA es copy.
    //
    // ANTES DE ACTUALIZAR ESTE SNAPSHOT CON `-u`, LEÉ LAS 26 RUTAS.
    // No es una foto de una pantalla: es la LISTA DE PERMISOS de la
    // clienta, y se lee al revés de como se lee un snapshot. Una ruta que
    // aparece de más acá es un campo que ella deja de poder editar —un
    // `quien: 'marcos'` puesto sin querer sobre un texto suyo la deja
    // mirando un campo en gris que no puede tocar, y nadie se entera hasta
    // que ella lo pide—. Una ruta que desaparece es al revés: un
    // identificador interno o un derivado que quedó editable, y ahí lo que
    // se rompe es la página.
    //
    // Un `-u` sin leer convierte las dos cosas en «el snapshot estaba
    // viejo». Si el diff agrega o saca una ruta, la pregunta no es si el
    // snapshot está actualizado: es si ESA ruta es copy o no lo es.
    expect(deMarcos.sort()).toMatchInlineSnapshot(`
      [
        "anaquel.contadorDe",
        "anaquel.saborInicial",
        "catar.pasos[].clave",
        "contacto.catalogoUrl",
        "contacto.formulario.tipoOpciones.0.valor",
        "contacto.formulario.tipoOpciones.1.valor",
        "contacto.formulario.trampa",
        "fichasTecnicas.ruta",
        "fichasTecnicas.rutaInicio",
        "fichasTecnicas.rutaPdf",
        "footer.productos[].ancla",
        "gotas.precioDesde",
        "gotas.precioJengibre",
        "nav.items[].ancla",
        "negocios.tabs.0.clave",
        "negocios.tabs.0.ficha",
        "negocios.tabs.0.id",
        "negocios.tabs.1.clave",
        "negocios.tabs.1.ficha",
        "negocios.tabs.1.id",
        "negocios.tabs.1.precio",
        "negocios.tabs.2.clave",
        "negocios.tabs.2.ficha",
        "negocios.tabs.2.id",
        "negocios.tabs.2.precio",
        "noEncontrada.rutaInicio",
        "recetas.lista[].clave",
      ]
    `)
  })

  // El mismo patrón que dejó la fase 0 en test/css-tokens.test.ts: se lee
  // del dist/ construido —nunca se construye desde acá, sería recursión—
  // y se saltea SOLO cuando no hay dist/ Y no estamos en CI. En Vercel
  // corre siempre, porque `pnpm build` construye antes de testear, así
  // que un dist/ ausente ahí es un fallo real y no una comodidad local.
  const hayDist = existsSync('dist/index.html')
  const automatizado = !!(process.env.CI || process.env.VERCEL)
  if (!hayDist && !automatizado) {
    // `build:sitio` y no el gate completo: es el mismo aviso que deja
    // css-tokens.test.ts, y el guard de test/meta.test.ts prohíbe que
    // cualquier test mencione el comando completo —ni siquiera en un
    // string— porque ESE es el que corre la suite adentro de sí misma.
    console.warn('\n[anclas] Falta dist/index.html: se salta el guard. Corré `pnpm build:sitio`.\n')
  }

  it.skipIf(!hayDist && !automatizado)(
    '8 · cada entrada del menú apunta a una sección que existe en la página',
    () => {
      // Hoy nada lo vigila, y es lo que rompe un cliente reordenando el
      // menú: el enlace queda y la sección no. Aserción dura, no
      // condición de salto: si el artefacto no está cuando el test SÍ
      // corre, es un fallo ruidoso.
      expect(existsSync('dist/index.html')).toBe(true)
      const html = readFileSync('dist/index.html', 'utf8')
      for (const item of marca.nav.items) {
        expect(html, `${item.texto} → ${item.ancla}`).toContain(`id="${item.ancla.slice(1)}"`)
      }
    },
  )

  it('9 · `nombra` vive en el grupo del elemento, nunca en la lista', () => {
    // Esta norma se rompió DOS veces mientras se escribía la fase, y la
    // segunda la rompió el mismo implementador que acababa de arreglar la
    // primera, en el mismo trabajo. No es descuido: `recorre()` no visita
    // los contenedores —salta del `array` directo al elemento— así que un
    // `nombra` colgado del `lista` es INVISIBLE para todos los demás
    // tests. Ningún rojo, ningún error de tipos, nada.
    //
    // Una convención que nadie puede ver es una convención que se vuelve a
    // romper. Este candado es lo que la hace visible.
    const mal: string[] = []
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) revisaNombra(esquema, id, mal)
    expect(mal).toEqual([])
  })

  it('9b · el candado 9 ve las uniones: reclama el «nombra» en cada variante', () => {
    // La versión anterior solo miraba el elemento cuando era `object`, y
    // los bloques de una sección de ficha son una UNIÓN: las tres variantes
    // estaban sin etiqueta, sin ayuda y sin `nombra` y el candado no decía
    // nada. Consecuencia concreta: la clienta veía cuatro filas idénticas.
    //
    // Con la mutación adentro, no confiando en el contenido real: acá las
    // dos variantes se fabrican, una con `nombra` y otra sin, y se exige
    // que salga la que falta —y solo esa—.
    const conNombre = grupo({
      etiqueta: 'Variante con nombre', seccion: 'fichas', ayuda: 'x',
      nombra: (v) => String((v as { a?: string }).a ?? ''),
      campos: { tipo: valorFijo({ etiqueta: 'T', seccion: 'fichas', ayuda: 'x', valores: ['a'] }) },
    })
    const sinNombre = grupo({
      etiqueta: 'Variante sin nombre', seccion: 'fichas', ayuda: 'x',
      campos: { tipo: valorFijo({ etiqueta: 'T', seccion: 'fichas', ayuda: 'x', valores: ['b'] }) },
    })
    const conUnion = grupo({
      etiqueta: 'Prueba', seccion: 'fichas', ayuda: 'x',
      campos: {
        bloques: lista({
          etiqueta: 'Bloques', seccion: 'fichas', ayuda: 'x',
          minItems: 1, maxItems: 9,
          elemento: z.discriminatedUnion('tipo', [conNombre, sinNombre]),
        }),
      },
    })

    const mal: string[] = []
    revisaNombra(conUnion, 'prueba', mal)
    expect(mal).toEqual([
      'prueba.bloques[]<tipo=b>: la variante del elemento no declara «nombra»',
    ])
  })

  it('10 · todo correo escrito en el sitio es el correo de la marca', () => {
    // El correo vive en CUATRO lugares y uno de ellos está en medio de la
    // respuesta de una pregunta frecuente, donde no puede ser una ruta
    // hermana de `escribeTambien`. Este candado lo cubre igual.
    const texto = JSON.stringify(CRUDO.sitio)
    const correos = new Set(texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])
    expect([...correos]).toEqual([marca.contacto.correo])
  })
})

describe('los textos que el script pinta en runtime', () => {
  it('arma el objeto con los siete textos, sacados del contenido', () => {
    const t = textosUi(fixture.marca as never)
    expect(Object.keys(t).sort()).toEqual([
      'copiado', 'enviando', 'envolturaAltPrefijo', 'ilustracionAltPrefijo', 'navAbrir', 'navCerrar', 'visorAlt',
    ])
    expect(t.copiado).toBe(fixture.marca.contacto.copiado)
    expect(t.navCerrar).toBe(fixture.marca.nav.cerrar)
    expect(t.visorAlt).toBe(fixture.marca.anaquel.visorAlt)
  })

  it('truena si una ruta declarada no da un texto', () => {
    // Un texto de UI vacío se ve como un botón sin palabras, y averiguar
    // por qué cuesta una tarde. Mejor que reviente el build.
    const roto = JSON.parse(JSON.stringify(fixture.marca))
    delete roto.contacto.copiado
    expect(() => textosUi(roto)).toThrow(/contacto\.copiado/)
  })

  it('ninguna ruta de TEXTOS_UI está inventada: todas existen en el esquema', () => {
    // El modo de falla que este test ataja: alguien renombra un campo del
    // esquema y esta lista queda apuntando a una ruta muerta. El build no
    // se entera hasta que el botón sale sin texto en producción.
    const delEsquema = new Set<string>()
    recorre(esquemaSitio, (ruta) => delEsquema.add(ruta))
    for (const ruta of Object.values(TEXTOS_UI)) {
      expect(delEsquema.has(ruta), `«${ruta}» no existe en el esquema del sitio`).toBe(true)
    }
  })
})
