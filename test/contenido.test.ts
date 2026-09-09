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
import { MARCA, MAQUETA, palabraProhibida } from '../src/contenido/vocabulario'
import { texto, panel } from '../src/contenido/campos'

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
})
