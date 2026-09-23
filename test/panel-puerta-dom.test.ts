// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { contenidoPublicado, type Documentos } from '@/panel/campos'
import { ETIQUETA_DE_PUERTA, AVISO_DE_PUERTA } from '@/panel/puertas'
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

  it('en barras no hay botón de agregar, y dice por qué', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
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
