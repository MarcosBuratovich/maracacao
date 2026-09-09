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
  panel,
} from '../src/contenido/campos'

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
      max: 40,
    })
    const meta = panel.get(campo)
    expect(meta?.etiqueta).toBe('Renglón 2 del titular')
    expect(meta?.ayuda).toBeTruthy()
    expect(meta?.seccion).toBe('portada')
    expect(meta?.control).toBe('texto')
  })

  it('el texto rechaza vacío, vocabulario de marca y precios pegados', () => {
    const campo = texto({
      etiqueta: 'Prueba', seccion: 'portada', ayuda: 'x', max: 60,
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
    const a = texto({ etiqueta: 'Uno', seccion: 'portada', ayuda: 'a', max: 10 })
    const b = texto({ etiqueta: 'Dos', seccion: 'pie', ayuda: 'b', max: 60 })
    expect(panel.get(a)?.etiqueta).toBe('Uno')
    expect(panel.get(b)?.etiqueta).toBe('Dos')
    expect(panel.get(a)?.max).toBe(10)
    expect(panel.get(b)?.max).toBe(60)
  })

  it('medida acepta el espacio duro y rechaza el normal — es su razón de existir', () => {
    // `\s` (la versión que traía el brief original) matchea también el
    // espacio duro: con esa regla, NINGÚN valor de `medida` podía pasar
    // nunca, ni siquiera el bien escrito. Este test ejercita el camino
    // feliz que faltaba y prueba las dos formas a la vez, porque el punto
    // entero de este campo es distinguirlas.
    const m = medida({ etiqueta: 'Peso', seccion: 'productos', ayuda: 'x', max: 30 })
    // Con espacio duro: válido. Es la forma que el sitio usa hoy y la que
    // impide que la «g» quede sola en el renglón siguiente del celular.
    expect(m.safeParse('Barra de 70\u00a0g').success).toBe(true)
    // Con espacio normal: se marca, y con el arreglo a un toque.
    expect(m.safeParse('Barra de 70 g').success).toBe(false)
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
        texto({ etiqueta: 'Renglón 1', seccion: 'portada', ayuda: 'a', max: 40 }),
        texto({ etiqueta: 'Renglón 2', seccion: 'portada', ayuda: 'b', max: 40 }),
        texto({ etiqueta: 'Renglón 3', seccion: 'portada', ayuda: 'c', max: 40 }),
      ],
    })
    expect(t.safeParse(['CHOCOLATE', 'MEXICANO,', '70% CACAO.']).success).toBe(true)
    expect(t.safeParse(['CHOCOLATE', 'MEXICANO,']).success).toBe(false)
    expect(t.safeParse(['A', 'B', 'C', 'D']).success).toBe(false)
  })

  it('la lista respeta su mínimo y su máximo — los conteos del sitio dependen de eso', () => {
    const l = lista({
      etiqueta: 'Preguntas frecuentes', seccion: 'preguntas', ayuda: 'x',
      de: texto({ etiqueta: 'Pregunta', seccion: 'preguntas', ayuda: 'y', max: 90 }),
      min: 4, max: 12,
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
    const n = numero({ etiqueta: 'Orden', seccion: 'productos', ayuda: 'x', min: 1, max: 10 })
    expect(n.safeParse(5).success).toBe(true)
  })

  it('numero rechaza un valor fuera de su rango', () => {
    const n = numero({ etiqueta: 'Orden', seccion: 'productos', ayuda: 'x', min: 1, max: 10 })
    expect(n.safeParse(11).success).toBe(false)
  })

  it('tokenColor acepta un token declarado en `validos`', () => {
    const t = tokenColor({
      etiqueta: 'Color', seccion: 'sabores', ayuda: 'x', validos: ['rojo', 'azul'],
    })
    expect(t.safeParse('rojo').success).toBe(true)
  })

  it('tokenColor rechaza un token que no está en `validos`', () => {
    const t = tokenColor({
      etiqueta: 'Color', seccion: 'sabores', ayuda: 'x', validos: ['rojo', 'azul'],
    })
    expect(t.safeParse('verde').success).toBe(false)
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
      etiqueta: 'Total', seccion: 'productos', ayuda: 'x', de: 'la suma de los sabores activos',
    })
    expect(d.safeParse(42).success).toBe(true)
  })

  it('derivado rechaza cero', () => {
    const d = derivado({
      etiqueta: 'Total', seccion: 'productos', ayuda: 'x', de: 'la suma de los sabores activos',
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
})
