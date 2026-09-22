/*
 * `src/panel/campos.ts`: el catálogo de los 198 campos que son de ella,
 * agrupados por sección, con sus rutas instanciadas contra el contenido
 * real, y leer/escribir un valor por ruta.
 *
 * Lo que de verdad importa acá (spec de la Tarea 2):
 *   1. Que el catálogo cubra los 198 y no incluya nada que no sea de ella.
 *   2. Que las rutas con índices se instancien bien contra el contenido
 *      real: una lista, una lista de listas (`filas[][]`), una lista de
 *      tuplas, una tupla suelta.
 *   3. Que leer/escribir por ruta funcionen en los casos raros: una tupla,
 *      un elemento de lista, un campo opcional ausente, un campo nullable
 *      con `null` de verdad.
 *   4. Que la validación muestre EL MENSAJE DEL ESQUEMA, no uno inventado
 *      acá.
 *
 * Contra el contenido REAL (`contenidoPublicado()`), no contra fixtures de
 * mentira: es la única forma de que "cubre los 198" signifique algo — un
 * esquema de prueba armado a mano podría taparse a sí mismo.
 */
import { describe, it, expect } from 'vitest'
import {
  campos, camposDeSeccion, contenidoPublicado, escribir, escribirValor, leer,
  SECCIONES, ETIQUETA_DE_SECCION,
  type CampoEditable,
} from '@/panel/campos'
import { DOCUMENTOS } from '@/contenido/esquema'
import { recorre } from '@/contenido/carga'
import { jergaEn } from '@/servidor/estado'

const idDe = (c: CampoEditable) => `${c.documento}::${c.rutaEsquema}`

describe('el catálogo cubre exactamente lo que es de ella', () => {
  it('son 219 campos de esquema — ni uno de más ni uno de menos', () => {
    const total = new Set(campos(contenidoPublicado()).map(idDe))
    // [2026-09-22] Eran 198. Los tres nuevos son los de WhatsApp
    // (etiqueta, número y nota), que ella tiene que poder cambiar sola:
    // un teléfono de contacto es justo el dato que cambia sin avisar.
    // [2026-09-22] Eran 201. Los once nuevos son el bloque de cocoas del
    // catálogo: seis del bloque más cinco de cada ficha de cocoa.
    expect(total.size).toBe(219)
  })

  it('el tamaño de cada sección coincide con lo que declaró la fase 1', () => {
    const porSeccion = new Map<string, Set<string>>()
    for (const c of campos(contenidoPublicado())) {
      const s = porSeccion.get(c.meta.seccion) ?? new Set<string>()
      s.add(idDe(c))
      porSeccion.set(c.meta.seccion, s)
    }
    expect(porSeccion.get('contacto')?.size).toBe(44)
    expect(porSeccion.get('productos')?.size).toBe(40)
    expect(porSeccion.get('negocios')?.size).toBe(29)
    expect(porSeccion.get('fichas')?.size).toBe(17)
  })

  it('un candado INDEPENDIENTE: ningún campo de Marcos, oculto o derivado aparece en el catálogo', () => {
    // Camina el esquema por su cuenta, sin pasar por el filtro de
    // campos.ts — si ese filtro se rompiera, este test lo nota igual.
    const enElCatalogo = new Set(campos(contenidoPublicado()).map(idDe))
    for (const [id, esquema] of Object.entries(DOCUMENTOS)) {
      recorre(esquema, (ruta, meta) => {
        if (meta === undefined) return
        const noEsDeElla = meta.quien === 'marcos' || meta.control === 'oculto' || meta.control === 'derivado'
        if (noEsDeElla) expect(enElCatalogo.has(`${id}::${ruta}`), `${id}::${ruta}`).toBe(false)
      })
    }
  })

  it('cada campo del catálogo, mirado directo, es de ella (candado al revés del anterior)', () => {
    for (const c of campos(contenidoPublicado())) {
      expect(c.meta.quien, idDe(c)).not.toBe('marcos')
      expect(c.meta.control, idDe(c)).not.toBe('oculto')
      expect(c.meta.control, idDe(c)).not.toBe('derivado')
    }
  })

  it('excluye ejemplos concretos: el cacao (de Marcos), el slug (oculto), el precio "desde" (derivado)', () => {
    const rutas = new Set(campos(contenidoPublicado()).map((c) => `${c.documento}::${c.ruta}`))
    expect(rutas.has('sabores::sabores.0.cacao')).toBe(false)
    expect(rutas.has('sabores::sabores.0.ingredientes')).toBe(false)
    expect(rutas.has('sabores::sabores.0.slug')).toBe(false)
    expect(rutas.has('sabores::sabores.0.orden')).toBe(false)
    expect(rutas.has('sitio::gotas.precioDesde')).toBe(false)
    expect(rutas.has('sitio::negocios.tabs.1.precio')).toBe(false)
    // Y sí incluye lo que es de ella al lado de lo excluido, para que este
    // test no pase solo porque el catálogo salió vacío.
    expect(rutas.has('sabores::sabores.0.nombre')).toBe(true)
    expect(rutas.has('sabores::sabores.0.precio')).toBe(true)
  })

  it('las 14 secciones del catálogo son exactamente las que declara `SECCIONES`', () => {
    const vistas = new Set(campos(contenidoPublicado()).map((c) => c.meta.seccion))
    expect([...vistas].sort()).toEqual([...SECCIONES].sort())
    expect(SECCIONES.length).toBe(14)
  })
})

describe('instancia las rutas con índices concretos contra el contenido real', () => {
  it('una tupla suelta (hero.titular): 3 campos, con índice y valor reales', () => {
    const t = campos(contenidoPublicado()).filter((c) => c.rutaEsquema.startsWith('hero.titular.'))
    expect(t.map((c) => c.ruta)).toEqual(['hero.titular.0', 'hero.titular.1', 'hero.titular.2'])
    expect(t.map((c) => c.valor)).toEqual(['CHOCOLATE', 'MEXICANO,', '70% CACAO.'])
  })

  it('una lista (recetas.lista[].titulo): tantos campos como recetas hay hoy — cuatro, no un número inventado', () => {
    const t = campos(contenidoPublicado()).filter((c) => c.rutaEsquema === 'recetas.lista[].titulo')
    expect(t.map((c) => c.ruta)).toEqual([
      'recetas.lista.0.titulo', 'recetas.lista.1.titulo', 'recetas.lista.2.titulo', 'recetas.lista.3.titulo',
    ])
    expect(t[3].valor).toBe('Mousse rápida de chocolate con cardamomo')
  })

  it('cada instancia de la lista lleva su propio grupo, nombrado con `nombra` — no "Receta 3"', () => {
    const t = campos(contenidoPublicado()).filter((c) => c.rutaEsquema === 'recetas.lista[].titulo')
    expect(t.map((c) => c.grupo?.etiqueta)).toEqual([
      'Chocolate caliente de jengibre y naranja',
      'Chocolate frío de jengibre y naranja',
      'Peras con chocolate y canela',
      'Mousse rápida de chocolate con cardamomo',
    ])
    expect(t.every((c) => !/Receta \d/.test(c.grupo?.etiqueta ?? ''))).toBe(true)
  })

  it('una lista de TUPLAS (fichas[].meta[].0/.1): un campo por cada mitad de cada par, de cada ficha', () => {
    const c = campos(contenidoPublicado())
    const nombreDelDato = c.find((x) => x.ruta === 'fichas.0.meta.0.0')
    const valorDelDato = c.find((x) => x.ruta === 'fichas.0.meta.0.1')
    expect(nombreDelDato?.valor).toBe('Marca')
    expect(valorDelDato?.valor).toBe('Maracacao')
    // Y el mismo campo de esquema, para la SEGUNDA ficha, es OTRA ruta.
    const segundaFicha = c.find((x) => x.ruta === 'fichas.1.meta.0.0')
    expect(segundaFicha).toBeDefined()
    expect(segundaFicha?.ruta).not.toBe(nombreDelDato?.ruta)
  })

  it('una lista de LISTAS (la tabla nutrimental, filas[][]): una celda por fila y columna reales', () => {
    const celda = campos(contenidoPublicado()).find((c) => c.ruta === 'fichas.0.secciones.4.bloques.1.filas.0.0')
    expect(celda).toBeDefined()
    expect(celda?.rutaEsquema).toBe('fichas[].secciones[].bloques[]<tipo=tabla>.filas[][]')
    expect(celda?.valor).toBe('Contenido energético')
  })

  it('un campo opcional AUSENTE en la mayoría de las instancias: aparece igual, con valor `undefined`', () => {
    const t = campos(contenidoPublicado()).filter((c) => c.rutaEsquema === 'recetas.lista[].chipPolvo')
    expect(t).toHaveLength(4)
    expect(t.map((c) => c.valor)).toEqual([undefined, undefined, undefined, 'USA EL POLVO'])
  })

  it('un campo NULLABLE con `null` de verdad hoy (una condición de mayoreo que no es un monto): valor `null`, no `undefined` ni "0"', () => {
    // [2026-09-22] El ejemplo era el precio del polvo, que hoy ya tiene
    // precio ($58, del catálogo nuevo). El nullable que queda con `null`
    // de verdad es el monto de las condiciones que no hablan de plata.
    const c = campos(contenidoPublicado()).find((x) => x.ruta === 'negocios.condiciones.1.precio')
    expect(c?.valor).toBeNull()
    expect(c?.meta.control).toBe('precio')
  })
})

describe('leer y escribir un valor por ruta', () => {
  it('leer: una tupla por índice', () => {
    const documentos = contenidoPublicado()
    expect(leer(documentos.sitio, 'hero.titular.1')).toBe('MEXICANO,')
  })

  it('leer: un elemento de lista por índice', () => {
    const documentos = contenidoPublicado()
    expect(leer(documentos.sitio, 'recetas.lista.2.titulo')).toBe('Peras con chocolate y canela')
  })

  it('leer: un campo opcional ausente da `undefined`, no revienta', () => {
    const documentos = contenidoPublicado()
    expect(leer(documentos.sitio, 'recetas.lista.0.chipPolvo')).toBeUndefined()
  })

  it('leer: un campo nullable con `null` da `null`, no `undefined`', () => {
    const documentos = contenidoPublicado()
    expect(leer(documentos.sitio, 'negocios.condiciones.1.precio')).toBeNull()
  })

  it('escribir: una tupla por índice, sin mutar el documento que recibió', () => {
    const documentos = contenidoPublicado()
    const original = (documentos.sitio as { hero: { titular: string[] } }).hero.titular[1]
    const siguiente = escribir(documentos.sitio, 'hero.titular.1', 'NUEVO RENGLÓN,')
    expect((documentos.sitio as { hero: { titular: string[] } }).hero.titular[1]).toBe(original)
    expect((siguiente as { hero: { titular: string[] } }).hero.titular[1]).toBe('NUEVO RENGLÓN,')
    // Los renglones hermanos, no tocados, siguen siendo la MISMA referencia:
    // no se copió el documento entero, solo el camino hasta la clave.
    const antes = (documentos.sitio as { hero: { titular: string[] } }).hero.titular
    const despues = (siguiente as { hero: { titular: string[] } }).hero.titular
    expect(antes).not.toBe(despues)
  })

  it('escribir: un elemento de lista por índice, sin tocar los demás elementos', () => {
    const documentos = contenidoPublicado()
    const siguiente = escribir(documentos.sitio, 'recetas.lista.2.titulo', 'Otro título') as {
      recetas: { lista: { titulo: string }[] }
    }
    expect(siguiente.recetas.lista[2].titulo).toBe('Otro título')
    expect(siguiente.recetas.lista[0].titulo).toBe('Chocolate caliente de jengibre y naranja')
    expect(siguiente.recetas.lista[3].titulo).toBe('Mousse rápida de chocolate con cardamomo')
  })

  it('escribir: un campo opcional AUSENTE se puede llenar', () => {
    const documentos = contenidoPublicado()
    const siguiente = escribir(documentos.sitio, 'recetas.lista.0.chipPolvo', 'nuevo aviso')
    expect(leer(siguiente, 'recetas.lista.0.chipPolvo')).toBe('nuevo aviso')
  })

  it('escribir: un campo nullable se puede poner en `null`', () => {
    const documentos = contenidoPublicado()
    const siguiente = escribir(documentos.sitio, 'negocios.tabs.2.precio', null)
    expect(leer(siguiente, 'negocios.tabs.2.precio')).toBeNull()
  })

  it('escribirValor: propaga a las rutas hermanas de `escribeTambien` (el correo vive en tres rutas del mismo documento)', () => {
    const documentos = contenidoPublicado()
    const campo = campos(documentos).find((c) => c.ruta === 'contacto.correo')
    expect(campo?.meta.escribeTambien).toEqual(['nav.pie.1', 'negocios.correo'])
    const siguientes = escribirValor(documentos, campo as CampoEditable, 'nueva@maracacao.mx')
    expect(leer(siguientes.sitio, 'contacto.correo')).toBe('nueva@maracacao.mx')
    expect(leer(siguientes.sitio, 'nav.pie.1')).toBe('nueva@maracacao.mx')
    expect(leer(siguientes.sitio, 'negocios.correo')).toBe('nueva@maracacao.mx')
    // Y no mutó el documento original.
    expect(leer(documentos.sitio, 'contacto.correo')).not.toBe('nueva@maracacao.mx')
  })

  it('escribirValor: sin `escribeTambien`, solo cambia la ruta propia', () => {
    const documentos = contenidoPublicado()
    const campo = campos(documentos).find((c) => c.ruta === 'hero.sub')
    expect(campo?.meta.escribeTambien ?? []).toEqual([])
    const siguientes = escribirValor(documentos, campo as CampoEditable, 'otro párrafo')
    expect(leer(siguientes.sitio, 'hero.sub')).toBe('otro párrafo')
    expect(leer(siguientes.sabores, 'urlCatalogoBarras')).toBe(leer(documentos.sabores, 'urlCatalogoBarras'))
  })
})

describe('la validación muestra el mensaje del esquema, no uno inventado acá', () => {
  it('un renglón del titular vacío: el mensaje de `texto()`, tal cual', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.ruta === 'hero.titular.0')
    const problemas = campo?.validar('   ') ?? []
    expect(problemas.map((p) => p.titulo)).toContain('No puede quedar vacío.')
  })

  it('el renglón 2 del titular sin la coma final: el mensaje del `.refine()` propio de ESE campo', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.ruta === 'hero.titular.1')
    const problemas = campo?.validar('SIN COMA') ?? []
    expect(problemas.map((p) => p.titulo)).toEqual([
      'Este renglón tiene que terminar en «,» y no llevar ninguna otra coma.',
    ])
  })

  it('una medida con espacio normal: el mensaje de `medida()` y el botón de arreglo con el espacio duro de verdad', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.meta.control === 'medida')
    const problemas = campo?.validar('70 g') ?? []
    expect(problemas[0]?.titulo).toBe('Entre el número y la unidad va un espacio que no parte el renglón.')
    expect(problemas[0]?.arreglo?.etiqueta).toBe('Poner el espacio que no parte el renglón')
    expect(problemas[0]?.arreglo?.valor).toBe('70\u00a0g')
  })

  it('un precio en cero: el mensaje de `precio()`', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.ruta === 'minis.precio')
    const problemas = campo?.validar(0) ?? []
    expect(problemas.map((p) => p.titulo)).toContain('El precio tiene que ser mayor a cero.')
  })

  it('un correo sin arroba: el mensaje de `correo()`', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.ruta === 'contacto.correo')
    const problemas = campo?.validar('esto no es un correo') ?? []
    expect(problemas.map((p) => p.titulo)).toContain('No es un correo válido: le falta la @ o el dominio.')
  })

  it('un valor que sí pasa: ningún problema', () => {
    const campo = campos(contenidoPublicado()).find((c) => c.ruta === 'hero.sub')
    expect(campo?.validar('Un párrafo cualquiera, corto y sin nada raro.')).toEqual([])
  })
})

describe('las secciones del panel: navegación y etiquetas', () => {
  it('camposDeSeccion filtra por sección, ni de más ni de menos', () => {
    const todos = campos(contenidoPublicado())
    for (const s of SECCIONES) {
      const de = camposDeSeccion(todos, s)
      expect(de.every((c) => c.meta.seccion === s)).toBe(true)
      expect(de.length).toBe(todos.filter((c) => c.meta.seccion === s).length)
    }
  })

  it('cada sección tiene una etiqueta propia, sin jerga y distinta del nombre crudo del esquema', () => {
    for (const s of SECCIONES) {
      const etiqueta = ETIQUETA_DE_SECCION[s]
      expect(etiqueta, s).toBeTruthy()
      expect(jergaEn(etiqueta), etiqueta).toBeNull()
    }
  })
})
