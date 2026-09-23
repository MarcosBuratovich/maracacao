// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { contenidoPublicado, leer, type Documentos } from '@/panel/campos'
import { ETIQUETA_DE_PUERTA, AVISO_DE_PUERTA } from '@/panel/puertas'
import { quitarItem } from '@/panel/listas'
import { jergaEn } from '@/servidor/estado'
import Puerta from '@/panel/Puerta'

afterEach(cleanup)

/*
 * `onCambia`, no `onCambio`: es el nombre que ya usa `Editor` y que
 * `Sesion.tsx:381` ya escribe (`<Editor documentos={documentos}
 * onCambia={alCambiarDocumentos} />`). El brief de esta tarea traía
 * `onCambio` para esta pantalla — alinearse con lo que ya existe deja la
 * Tarea 8 (cambiar `<Editor>` por `<Puerta>` en `Sesion.tsx`) como el
 * cambio de una palabra, no como tocar también al llamador.
 */
const pintar = (onCambia: (documentos: Documentos) => void = () => {}) =>
  render(createElement(Puerta, { documentos: contenidoPublicado(), onCambia }))

describe('la pantalla de puertas', () => {
  it('ofrece las cinco puertas por su nombre', () => {
    pintar()
    for (const p of Object.values(ETIQUETA_DE_PUERTA)) expect(screen.getByText(p)).toBeTruthy()
  })

  it('nunca muestra los 692 campos juntos: al abrir Productos hay menos de veinte casillas', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    expect(screen.getAllByRole('textbox').length).toBeLessThan(20)
  })

  it('la puerta de fichas avisa que ahí adentro hay declaraciones', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.fichas))
    expect(screen.getByText(AVISO_DE_PUERTA.fichas!)).toBeTruthy()
  })

  it('las fichas se recorren en tres niveles, no en una lista de 341', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.fichas))
    // Nivel 1: las cuatro fichas. Todavía no hay campos de bloque a la vista.
    expect(screen.getAllByRole('textbox').length).toBeLessThan(20)
    fireEvent.click(screen.getByText(/Chocolate en polvo/))
    // Nivel 2: las secciones de esa ficha. Sigue sin haber 341 casillas.
    expect(screen.getAllByRole('textbox').length).toBeLessThan(20)
  })

  /*
   * El primer ítem "real" de Productos es una cocoa (Tarea 7 la abrió), así
   * que ESTE test —que existe para probar lo cerrado, no lo abierto— tiene
   * que elegir a propósito algo que sigue cerrado: un sabor del anaquel.
   * Antes de la Tarea 7 esto daba igual porque ningún ítem tenía botón.
   */
  it('en un sabor del anaquel no hay botón de agregar, y dice por qué', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Jengibre y naranja'))
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull()
    expect(screen.getByText(/los da de alta Marcos/i)).toBeTruthy()
  })
})

/*
 * ---------------------------------------------------------------------
 * Cobertura adicional de la Tarea 6 — el brief fija cinco casos; estos
 * cierran huecos que me pidió cuidar el despacho: que ningún texto propio
 * traiga jerga, que el tercer nivel de fichas llegue de verdad hasta un
 * campo editable y avise hacia afuera, y que los campos propios de una
 * ficha (nombre, denominación, datos de cabecera) — que no viven dentro de
 * NINGUNA sección — sigan siendo alcanzables y no un hueco silencioso.
 * ---------------------------------------------------------------------
 */
describe('la pantalla de puertas — cobertura adicional', () => {
  it('ningún texto propio de esta pantalla trae jerga técnica', () => {
    pintar()
    // Los cinco nombres de puerta, ya cubiertos por su propio candado en
    // panel-puertas.test.ts — acá se repite el chequeo sobre lo RENDERIZADO,
    // no sobre el archivo fuente.
    for (const p of Object.values(ETIQUETA_DE_PUERTA)) expect(jergaEn(p), p).toBeNull()
    expect(screen.getByText('¿Qué quieres editar?')).toBeTruthy()
    expect(jergaEn('¿Qué quieres editar?')).toBeNull()

    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    expect(screen.getByText('Volver a las cinco puertas')).toBeTruthy()
    expect(jergaEn('Volver a las cinco puertas')).toBeNull()
    // Mismo motivo que en 'en un sabor del anaquel...' de arriba: el
    // aviso ahora es por ÍTEM (Tarea 7), y el ítem que se elige solo al
    // entrar a Productos es una cocoa — abierta, sin aviso. Hay que
    // pararse a propósito sobre algo cerrado para verlo.
    fireEvent.click(screen.getByText('Jengibre y naranja'))
    const avisoAltaBaja = screen.getByText(/los da de alta Marcos/i)
    expect(avisoAltaBaja).toBeTruthy()
    expect(jergaEn(avisoAltaBaja.textContent ?? '')).toBeNull()
  })

  it('elegir un ítem de Productos escribe el cambio y lo avisa hacia afuera con la ruta correcta', () => {
    let ultimo: Documentos | null = null
    pintar((docs) => {
      ultimo = docs
    })
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    const campo = screen.getByLabelText(/nombre de la cocoa/i) as HTMLInputElement
    expect(campo.value).toBe('Cocoa natural')
    fireEvent.change(campo, { target: { value: 'Cocoa natural (sin azúcar)' } })
    expect(ultimo).not.toBeNull()
    const cocoas = (ultimo as unknown as { sitio: { cocoas: { lista: Array<{ nombre: string }> } } }).sitio.cocoas.lista
    expect(cocoas[0].nombre).toBe('Cocoa natural (sin azúcar)')
  })

  it('el tercer nivel de fichas llega a un campo real y lo escribe en el documento de fichas', () => {
    let ultimo: Documentos | null = null
    pintar((docs) => {
      ultimo = docs
    })
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.fichas))
    fireEvent.click(screen.getByText(/Chocolate en polvo/))
    fireEvent.click(screen.getByText('Descripción del producto'))
    // Ahora sí hay casillas de verdad: el tercer nivel muestra los campos.
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    const titulo = screen.getByLabelText(/título de la sección/i) as HTMLTextAreaElement | HTMLInputElement
    fireEvent.change(titulo, { target: { value: 'Descripción del producto (editado)' } })
    expect(ultimo).not.toBeNull()
    const fichas = (ultimo as unknown as { fichas: { fichas: Array<{ secciones: Array<{ titulo: string }> }> } }).fichas
    expect(fichas.fichas[1].secciones[0].titulo).toBe('Descripción del producto (editado)')
  })

  it('los datos propios de una ficha (fuera de toda sección) se alcanzan desde el nivel 2', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.fichas))
    fireEvent.click(screen.getByText(/Chocolate en polvo/))
    fireEvent.click(screen.getByText('Datos generales de la ficha'))
    const producto = screen.getByLabelText(/nombre del producto/i) as HTMLInputElement
    expect(producto.value).toBe('Chocolate en polvo')
  })

  it('los textos generales de la página de fichas (documento «sitio») se editan sin pasar por ninguna ficha', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.fichas))
    fireEvent.click(screen.getByText('Textos generales'))
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    expect(screen.queryByText('Datos generales de la ficha')).toBeNull()
  })
})

/*
 * ---------------------------------------------------------------------
 * Tarea 7 — agregar y borrar. Tres correcciones sobre los casos del
 * despacho, verificadas contra el contenido real antes de escribirlas:
 *
 * 1. `onCambia`, no `onCambio` — mismo motivo que en `pintar()`, arriba.
 * 2. El tercer caso (mínimo de preguntas) navegaba a
 *    `ETIQUETA_DE_PUERTA.negocio`, pero la sección `preguntas` vive en la
 *    puerta `textos` (`PUERTA_DE_SECCION` en `@/panel/puertas`): las
 *    condiciones de mayoreo y el semáforo son los que están en `negocio`,
 *    no las preguntas frecuentes. Y con solo TRES preguntas quedando
 *    (el mínimo), las tres empiezan con «¿» — `getByText(/¿/)` tira por
 *    encontrar tres, no una; hace falta `getAllByText(/¿/)[0]`.
 * 3. `getByText(/Cocoa natural/)` (regex, no texto exacto) tira IGUAL: el
 *    campo «Nombre de la cocoa» trae de ayuda «Cómo se llama: «Cocoa
 *    natural» o «Cocoa alcalina».», que TAMBIÉN matchea el regex. El
 *    botón del cajón, en cambio, dice exactamente «Cocoa natural» —nada
 *    más—, así que `getByText('Cocoa natural')` (texto exacto, como ya
 *    usaba el resto de este archivo) elige uno solo.
 * ---------------------------------------------------------------------
 */
describe('agregar y borrar', () => {
  it('en cocoas hay botón de agregar, y agrega de verdad', () => {
    let docs = contenidoPublicado()
    render(createElement(Puerta, { documentos: docs, onCambia: (d: typeof docs) => { docs = d } }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    const lista = (docs.sitio as { cocoas: { lista: unknown[] } }).cocoas.lista
    expect(lista).toHaveLength(3)
  })

  it('borrar pide escribir el nombre: con el nombre mal, no borra', () => {
    let docs = contenidoPublicado()
    render(createElement(Puerta, { documentos: docs, onCambia: (d: typeof docs) => { docs = d } }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /borrar/i }))
    fireEvent.change(screen.getByLabelText(/escribe el nombre/i), { target: { value: 'cualquier cosa' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect((docs.sitio as { cocoas: { lista: unknown[] } }).cocoas.lista).toHaveLength(2)
  })

  it('borrar con el nombre correcto sí borra, y no publica solo', () => {
    let docs = contenidoPublicado()
    render(createElement(Puerta, { documentos: docs, onCambia: (d: typeof docs) => { docs = d } }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /borrar/i }))
    fireEvent.change(screen.getByLabelText(/escribe el nombre/i), { target: { value: 'Cocoa natural' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    // Se borró de verdad — nada de "publica solo": `onCambia` es el mismo
    // camino que cualquier otro cambio de campo, así que queda en el
    // borrador con el deshacer de media hora intacto (eso lo prueba
    // `borrador.test.ts`; acá solo importa que ESTE cambio pase por ahí).
    expect((docs.sitio as { cocoas: { lista: Array<{ nombre: string }> } }).cocoas.lista).toHaveLength(1)
    expect((docs.sitio as { cocoas: { lista: Array<{ nombre: string }> } }).cocoas.lista[0].nombre).toBe('Cocoa alcalina')
  })

  it('cuando la lista está en su mínimo, el botón de borrar se deshabilita y dice por qué', () => {
    // Se baja a tres con la función pura, no a mano: el test fija el
    // COMPORTAMIENTO en el borde, no el estado de hoy (que son ocho).
    let docs = contenidoPublicado()
    while ((leer(docs.sitio, 'preguntas.items') as unknown[]).length > 3) {
      docs = quitarItem(docs, 'sitio', 'preguntas.items.0')
    }
    render(createElement(Puerta, { documentos: docs, onCambia: () => {} }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.textos))
    fireEvent.click(screen.getAllByText(/¿/)[0])
    const borrar = screen.getByRole('button', { name: /borrar/i }) as HTMLButtonElement
    expect(borrar.disabled).toBe(true)
    expect(screen.getByText(/necesita al menos tres/i)).toBeTruthy()
  })

  it('en un sabor del anaquel no hay botón de agregar ni de borrar', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Jengibre y naranja'))
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /borrar/i })).toBeNull()
  })

  it('un ítem recién agregado avisa cuántos datos le faltan para poder publicarse', () => {
    let docs = contenidoPublicado()
    render(createElement(Puerta, { documentos: docs, onCambia: (d: typeof docs) => { docs = d } }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    cleanup()
    // Se vuelve a pintar con el documento YA actualizado (la cocoa nueva
    // adentro) y se navega directo a ella — nombre vacío, así que
    // `itemsDe()` la etiqueta "(sin nombre)" (Tarea 5).
    render(createElement(Puerta, { documentos: docs, onCambia: () => {} }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('(sin nombre)'))
    // Sin tocar NINGÚN campo: el resumen ya está a la vista. Los cinco
    // campos de una cocoa arrancan vacíos (Tarea 3), así que faltan los 5.
    expect(screen.getByText(/Faltan 5 datos para poder publicar/)).toBeTruthy()
  })

  it('los textos nuevos de agregar/borrar no traen jerga técnica', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    const agregar = screen.getByRole('button', { name: /agregar/i })
    const borrar = screen.getByRole('button', { name: /borrar/i })
    expect(jergaEn(agregar.textContent ?? '')).toBeNull()
    expect(jergaEn(borrar.textContent ?? '')).toBeNull()
    fireEvent.click(borrar)
    const parrafoConfirma = screen.getByText(/escribe su nombre exactamente/i)
    expect(jergaEn(parrafoConfirma.textContent ?? '')).toBeNull()
  })
})
