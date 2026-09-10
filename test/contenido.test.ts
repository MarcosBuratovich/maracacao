/*
 * Guards de la capa de contenido.
 *
 * El primero es la constitución de la carpeta: `src/contenido/**` tiene que
 * poder correr en TRES lugares —el navegador de la clienta, la función
 * serverless y vitest— así que no puede tocar `node:*`, ni Astro, ni el
 * alias `@/` (que solo resuelven el bundler y vitest, no el navegador).
 * Sin este guard, la primera vez que alguien importe `node:fs` para una
 * comodidad, el panel deja de compilar en el navegador y nadie sabe por qué.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { z } from 'zod'
import { MARCA, MAQUETA, palabraProhibida } from '../src/contenido/vocabulario'
import {
  texto, medida, precio, tupla, lista, claveSabor,
  numero, tokenColor, ruta, url, correo, slug, archivo, derivado, grupo, precioONada,
  panel, UNIDADES_DE_MEDIDA, opcion,
} from '../src/contenido/campos'
import type { MetaCampo } from '../src/contenido/campos'
import { recorre, cargar, serializa } from '../src/contenido/carga'
import { cruzaConteo, enLetras } from '../src/contenido/conteos'
import { contrasteSuficiente, resuelveColor, mejorTinta } from '../src/contenido/color-sabor'
import { precioDesde, precioDe } from '../src/contenido/derivados'
import { validarContra } from '../src/contenido/validacion'
import * as tokens from '../src/tokens/color'

describe('la capa de contenido', () => {
  it('src/contenido/ no importa node:, ni Astro, ni el alias @/', () => {
    const infractores: string[] = []
    const archivos = readdirSync('src/contenido', { recursive: true, encoding: 'utf8' })

    for (const archivo of archivos) {
      if (!archivo.endsWith('.ts')) continue
      const fuente = readFileSync(`src/contenido/${archivo}`, 'utf8')
      // Los comentarios quedan fuera: este mismo archivo los nombra.
      const codigo = fuente
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')

      // Cuatro formas de traer un módulo, todas prohibidas por igual: el
      // estático `from '...'` (cubre también el re-export, que conserva
      // el `from`), el dinámico `import('...')`, el bare `import '...'`
      // por efecto secundario, y el `require('...')` de CommonJS. Un
      // patrón que solo mirara `from` es un recordatorio, no un guard.
      const formasDeImportar = (prefijo: string) =>
        new RegExp(
          `(?:\\bfrom\\s+|\\bimport\\s*\\(\\s*|\\bimport\\s+|\\brequire\\s*\\(\\s*)['"]${prefijo}`,
        )

      const prohibidos = [
        [formasDeImportar('node:'), 'node:'],
        [formasDeImportar('astro'), 'astro'],
        [formasDeImportar('@/'), 'el alias @/'],
      ] as const

      for (const [patron, motivo] of prohibidos) {
        if (patron.test(codigo)) infractores.push(`${archivo} importa ${motivo}`)
      }
    }

    expect(infractores).toEqual([])
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

  it('recorre() no trata una unión como hoja: truena y dice qué falta', () => {
    // Silencio es el peor resultado acá: una unión emitida como hoja deja
    // todos los campos de sus variantes invisibles para el panel, sin error.
    const conUnion = z.discriminatedUnion('tipo', [
      z.object({ tipo: z.literal('parrafo'), texto: z.string() }),
      z.object({ tipo: z.literal('lista'), items: z.array(z.string()) }),
    ])
    expect(() => recorre(conUnion, () => {})).toThrow(/unión/i)
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

  // recorre() y ordenaSegun() caminan el MISMO árbol y hasta acá daban
  // respuestas OPUESTAS a la misma pregunta: con una unión, recorre()
  // tiraba y serializa() devolvía el bloque tal cual —con las claves que
  // el esquema no declara adentro—. Era el cuarto mecanismo divergente del
  // archivo, y el primero que la Parte B iba a pisar: los bloques de ficha
  // se declaran como `discriminatedUnion`.

  it('serializa() tira con una unión, igual que recorre(): una sola respuesta', () => {
    const esquema = z.object({
      bloque: z.discriminatedUnion('t', [
        z.object({ t: z.literal('a'), uno: z.string() }),
        z.object({ t: z.literal('b'), dos: z.string() }),
      ]),
    })
    expect(() => recorre(esquema, () => {})).toThrow(/unión/i)
    // Antes esto devolvía {"bloque":{"t":"a","uno":"hola","BASURA":"…"}}:
    // la clave no declarada viajaba al JSON sin un solo error.
    expect(() => serializa(esquema, { bloque: { t: 'a', uno: 'hola', BASURA: 'no declarada' } }))
      .toThrow(/unión/i)
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
})
