// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { createElement, useState } from 'react'
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

/*
 * Un componente CONTROLADO de verdad, con `useState` propio y `onCambia`
 * actualizándolo — el mismo camino que va a recorrer `Sesion.tsx` en la
 * Tarea 8, y el que un test con `cleanup()` + `render()` de nuevo + un
 * `onCambia` que solo reasigna una variable de afuera NUNCA ejercita: ese
 * patrón arma su propio mundo, donde la pantalla se vuelve a montar desde
 * cero con el documento que YA trae el cambio, en vez de dejar que
 * `Puerta` reaccione sola a un `documentos` que cambia debajo suyo. Ronda
 * de arreglo del revisor sobre la Tarea 7: así fue como el bug real
 * ("agregar no mueve la selección") se le escapó a mi primer test, que sí
 * pasaba porque nunca recorría el camino real.
 */
function PuertaControlada({ inicial, espia }: { inicial: Documentos; espia?: (d: Documentos) => void }) {
  const [documentos, setDocumentos] = useState(inicial)
  return createElement(Puerta, {
    documentos,
    onCambia: (d: Documentos) => {
      setDocumentos(d)
      espia?.(d)
    },
  })
}

/*
 * El espía es OPCIONAL y NUNCA reemplaza la realimentación: `setDocumentos`
 * corre siempre, así que la pantalla se vuelve a dibujar con el documento
 * nuevo igual que en la aplicación real. Mirar de paso lo que salió hacia
 * afuera es legítimo; lo que estaba mal en los tres tests de más abajo
 * antes de esta ronda era CAPTURAR SIN REALIMENTAR: sin `setDocumentos`,
 * la prop `documentos` queda congelada, la pantalla no se redibuja nunca y
 * el test termina afirmando sobre una variable de su propio andamio.
 */
const pintarControlada = (espia?: (d: Documentos) => void) =>
  render(createElement(PuertaControlada, { inicial: contenidoPublicado(), ...(espia ? { espia } : {}) }))

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
  /*
   * [Ronda de arreglo final] Los tres primeros tests de este bloque usaban
   * `onCambia: (d) => { docs = d }`: capturaban el documento nuevo y NUNCA
   * lo devolvían como prop, así que la pantalla no se redibujaba jamás y
   * lo único que quedaba probado era la función pura de abajo —que ya
   * tiene sus propios tests en `panel-listas.test.ts`. Pasan a
   * `PuertaControlada`, que es el camino que recorre `Sesion.tsx`, y
   * afirman sobre lo que MUESTRA la pantalla.
   */
  it('en cocoas hay botón de agregar, y agrega de verdad', () => {
    let ultimo: Documentos | null = null
    pintarControlada((d) => {
      ultimo = d
    })
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    // Antes de tocar nada, en el cajón hay dos cocoas y ninguna fila nueva.
    expect(screen.queryByText('(sin nombre)')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    // La pantalla lo muestra: una fila más en el cajón...
    expect(screen.getByText('(sin nombre)')).toBeTruthy()
    // ...y el documento que salió hacia afuera tiene las tres.
    expect((ultimo!.sitio as { cocoas: { lista: unknown[] } }).cocoas.lista).toHaveLength(3)
  })

  it('borrar pide escribir el nombre: con el nombre mal, no borra', () => {
    let salidas = 0
    pintarControlada(() => {
      salidas += 1
    })
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /borrar/i }))
    fireEvent.change(screen.getByLabelText(/escribe el nombre/i), { target: { value: 'cualquier cosa' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    // Lo que se ve: el aviso de que no coincide, la fila intacta en el
    // cajón y el formulario todavía parado en «Cocoa natural».
    expect(screen.getByText(/no coincide con el nombre/i)).toBeTruthy()
    expect(screen.getByText('Cocoa natural')).toBeTruthy()
    expect((screen.getByLabelText(/nombre de la cocoa/i) as HTMLInputElement).value).toBe('Cocoa natural')
    // Y no salió ni un cambio hacia afuera: no se borró nada.
    expect(salidas).toBe(0)
  })

  /*
   * El caso que esta ronda vino a destapar: se borra el ítem que NO es el
   * último (índice 0 de 2), así que la clave del sobreviviente —que lleva
   * el índice— no desaparece, el efecto de reselección no se dispara y
   * React recicla los cinco `Campo` ya montados. Si esos componentes no
   * resincronizan su valor con la prop, el documento queda bien y la
   * pantalla sigue mostrando los datos de la cocoa BORRADA: tocar una
   * letra del nombre arma un ítem Frankenstein (el nombre de una, el
   * perfil y los precios de la otra) sin que nada lo avise.
   *
   * Por eso se afirma sobre las CINCO cajas de la pantalla, no sobre el
   * documento: el documento ya estaba bien antes del arreglo.
   */
  it('borrar un ítem que no es el último deja en pantalla los datos del que quedó', () => {
    let ultimo: Documentos | null = null
    pintarControlada((d) => {
      ultimo = d
    })
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /borrar/i }))
    fireEvent.change(screen.getByLabelText(/escribe el nombre/i), { target: { value: 'Cocoa natural' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    // El cajón ya no la tiene, y marca la que quedó.
    expect(screen.queryByText('Cocoa natural')).toBeNull()
    expect(screen.getByText('Cocoa alcalina').closest('button')?.getAttribute('aria-current')).toBe('true')

    // Las cinco cajas, una por una: son las de «Cocoa alcalina».
    expect((screen.getByLabelText(/nombre de la cocoa/i) as HTMLInputElement).value).toBe('Cocoa alcalina')
    expect((screen.getByLabelText(/perfil de la cocoa/i) as HTMLTextAreaElement).value).toContain('alcalinizados')
    expect((screen.getByLabelText(/usos de la cocoa/i) as HTMLInputElement).value).toBe(
      'Repostería, chocolatería, confitería y bebidas',
    )
    expect((screen.getByLabelText(/precio de la bolsa chica/i) as HTMLInputElement).value).toBe('102')
    expect((screen.getByLabelText(/precio de la bolsa grande/i) as HTMLInputElement).value).toBe('399')

    // Y recién ahora, el documento — nada de "publica solo": `onCambia` es
    // el mismo camino que cualquier otro cambio de campo, así que queda en
    // el borrador con el deshacer de media hora intacto (eso lo prueba
    // `borrador.test.ts`; acá solo importa que ESTE cambio pase por ahí).
    const lista = (ultimo!.sitio as { cocoas: { lista: Array<{ nombre: string }> } }).cocoas.lista
    expect(lista).toHaveLength(1)
    expect(lista[0].nombre).toBe('Cocoa alcalina')
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

  /*
   * Ronda de arreglo del revisor: «necesita al menos UNO elemento» está
   * mal —corresponde el apócope «un», delante de un sustantivo masculino
   * («un elemento», nunca «uno elemento», igual que «un año»)—. Afecta a
   * las cuatro listas de mínimo 1 (todas menos preguntas, que tiene
   * mínimo 3 y ya está cubierta arriba); cocoas alcanza para probarlo.
   */
  it('en el mínimo de una lista de mínimo uno, dice "un elemento", con apócope', () => {
    let docs = contenidoPublicado()
    docs = quitarItem(docs, 'sitio', 'cocoas.lista.0')
    render(createElement(Puerta, { documentos: docs, onCambia: () => {} }))
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa alcalina'))
    expect(screen.getByText(/necesita al menos un elemento/i)).toBeTruthy()
    expect(screen.queryByText(/uno elemento/i)).toBeNull()
  })

  it('en un sabor del anaquel no hay botón de agregar ni de borrar', () => {
    pintar()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Jengibre y naranja'))
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /borrar/i })).toBeNull()
  })

  /*
   * Ronda de arreglo del revisor: agregar dejaba la pantalla parada en el
   * ítem VIEJO — el nuevo entraba calladito al fondo del cajón, sin
   * resaltar y sin seleccionarse. Mi primer test de esta tarea no lo
   * agarró porque usaba `cleanup()` + `render()` de nuevo + navegación a
   * mano hasta "(sin nombre)": un mundo donde la función YA andaba, no el
   * mundo real, donde `Puerta` reacciona sola al `documentos` que le
   * llega. Este test usa `pintarControlada()` — sin `cleanup()`, sin
   * segundo `render()`, sin click extra para "encontrar" el ítem nuevo —
   * y por eso prueba algo.
   */
  it('después de agregar, la pantalla queda parada en el ítem nuevo', () => {
    pintarControlada()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa natural'))
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    // Sin ningún click de más: la fila "(sin nombre)" ya está marcada
    // como la elegida en el cajón...
    const filaNueva = screen.getByText('(sin nombre)').closest('button')
    expect(filaNueva?.getAttribute('aria-current')).toBe('true')
    // ...la fila de "Cocoa natural" sigue en el cajón (no se borró nada),
    // pero YA NO es la elegida...
    const filaVieja = screen.getByText('Cocoa natural').closest('button')
    expect(filaVieja?.getAttribute('aria-current')).toBeNull()
    // ...y el formulario que se ve es el de la cocoa NUEVA (vacía), no el
    // de "Cocoa natural": solo se dibuja UN ítem a la vez, y el campo
    // "Nombre de la cocoa" en pantalla está vacío.
    const nombre = screen.getByLabelText(/nombre de la cocoa/i) as HTMLInputElement
    expect(nombre.value).toBe('')
    // Y el resumen de faltantes (Tarea 7) ya está a la vista, sin tocar
    // ningún campo: los cinco de una cocoa arrancan vacíos.
    expect(screen.getByText(/Faltan 5 datos para poder publicar/)).toBeTruthy()
  })

  /*
   * El revisor pidió que este caso también quedara cubierto con el mismo
   * andamio, aunque ya lo había verificado a mano: borrar el ÚLTIMO ítem
   * de una lista deja `elegido1` apuntando a una clave que ya no existe, y
   * el `useEffect` de reselección (`Puerta.tsx`) tiene que sacarla de ahí.
   */
  it('después de borrar el último ítem de la lista, la pantalla no se queda en blanco', () => {
    pintarControlada()
    fireEvent.click(screen.getByText(ETIQUETA_DE_PUERTA.productos))
    fireEvent.click(screen.getByText('Cocoa alcalina'))
    fireEvent.click(screen.getByRole('button', { name: /borrar/i }))
    fireEvent.change(screen.getByLabelText(/escribe el nombre/i), { target: { value: 'Cocoa alcalina' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    // Sin "Cocoa alcalina" (ya borrada), lo único que puede quedar
    // elegido es "Cocoa natural" — y el formulario lo confirma.
    expect(screen.queryByText('Cocoa alcalina')).toBeNull()
    const nombre = screen.getByLabelText(/nombre de la cocoa/i) as HTMLInputElement
    expect(nombre.value).toBe('Cocoa natural')
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
