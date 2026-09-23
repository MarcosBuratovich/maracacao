/*
 * `ListaDeItems.tsx` (Tarea 5, fase 7): la pieza que vuelve navegables los
 * 692 campos instanciados de hoy. Sin esto, elegir una puerta (Tarea 6)
 * todavía deja a la clienta mirando, por ejemplo, los 105 campos de
 * Productos en una sola tirada — 15 sabores × 2 campos, 5 gotas × 2, 6
 * polvos, 2 cocoas × 5, más 49 campos sueltos, todos juntos. Esto los
 * agrupa por INSTANCIA («Canela», «Cocoa natural»…) y deja que ella elija
 * una a la vez: entrar a un ítem muestra solo SUS campos, no los de los
 * otros 27.
 *
 * `itemsDe()` es la mitad de este archivo que no toca el DOM: agrupa por
 * `campo.grupo` —la instancia que ya calculó `campos.ts` con `nombra()`,
 * el metadato escrito a mano en la fase 1— y no reinventa ese cálculo.
 * `ListaDeItems` es la otra mitad: la lista al costado (Marcos eligió esta
 * maqueta entre tres) y, en el celular, el cajón que se abre POR ENCIMA
 * del formulario en vez de empujarla a otra pantalla (la misma elección,
 * hecha sobre tres comportamientos distintos).
 *
 * El layout responsive en sí —cajón fijo en celular, lista fija al
 * costado en escritorio— es CSS que todavía no existe: esta tarea deja
 * la estructura y el estado (`abierta`/`onAbrir`) listos para que esa
 * hoja de estilos, cuando se escriba, solo tenga que mostrar/ocultar con
 * una media query. Ningún test de esta tarea depende de esa hoja.
 */
import type { CampoEditable } from './campos'

export interface ItemNavegable {
  clave: string
  etiqueta: string
  campos: CampoEditable[]
}

/*
 * ---------------------------------------------------------------------
 * itemsDe(): de 692 campos sueltos a un puñado de ítems con nombre
 * ---------------------------------------------------------------------
 */

// Ninguna instancia de lista real usa 'sitio'/'sabores'/'fichas' (los tres
// `IdDocumento`) como clave sin acompañarla de una ruta separada por un
// espacio — así arma sus claves `porInstancia()` en `campos.ts`, y acá se
// repite el mismo criterio a propósito, para no inventar un segundo
// esquema de claves. 'sueltos', sin espacio, no puede chocar con eso.
const CLAVE_SUELTOS = 'sueltos'

// No es "Otros" ni "Varios": esos campos SÍ tienen un lugar preciso —son
// los textos de una sección entera (el kicker, el título, el cuerpo…) que
// no viven dentro de ninguna lista repetible— y decirlo así, en vez de con
// una palabra que suena a cajón de sastre, es más fiel a lo que hay adentro.
const ETIQUETA_SUELTOS = 'Textos generales'

/*
 * `nombra()` (fase 1, escrito a mano por cada lista) siempre trae un
 * `?? 'Cocoa'`/`?? 'Receta'`/etc. de respaldo — pero ese respaldo solo
 * entra en juego cuando el campo que nombra vale `undefined`. Si ella
 * BORRA el nombre a mano (lo deja en `''`, no en `undefined`), `nombra()`
 * devuelve exactamente `''`, y sin este chequeo el renglón le llegaría en
 * blanco: una fila sin letra en el costado, que ni se puede tocar con el
 * dedo con confianza ni dice qué es. Un ítem sin nombre es peor que uno
 * con un nombre provisorio, así que acá se le pone uno: entre paréntesis,
 * para que se note que es un aviso del sistema y no un nombre que ella
 * escribió.
 */
const SIN_NOMBRE = '(sin nombre)'

/**
 * Agrupa por `campo.grupo` —la instancia de lista que ya resolvió
 * `campos.ts`— y junta los campos sueltos (sin `grupo`) en UN solo ítem,
 * al principio: no uno por campo suelto, que en Productos serían 49
 * renglones más y volvería a dejar la lista tan larga como los campos que
 * esto existe para esconder.
 *
 * El orden de salida es el de PRIMERA aparición de cada grupo —`Map`
 * conserva el orden de inserción de sus claves—, que ya viene ordenado
 * por instancia porque `campos()` (Tarea 2, fase 6) reordena "por
 * instancia" antes de entregar el catálogo.
 */
export function itemsDe(campos: readonly CampoEditable[]): ItemNavegable[] {
  const grupos = new Map<string, ItemNavegable>()
  const sueltos: CampoEditable[] = []

  for (const campo of campos) {
    if (!campo.grupo) {
      sueltos.push(campo)
      continue
    }
    // Mismo criterio de clave que `porInstancia()` en `campos.ts`: el
    // documento entra en la clave porque dos documentos distintos podrían,
    // en teoría, compartir la misma ruta de instancia.
    const clave = `${campo.documento} ${campo.grupo.ruta}`
    const item = grupos.get(clave)
    if (item) {
      item.campos.push(campo)
      continue
    }
    const etiqueta = campo.grupo.etiqueta.trim()
    grupos.set(clave, {
      clave,
      etiqueta: etiqueta.length > 0 ? etiqueta : SIN_NOMBRE,
      campos: [campo],
    })
  }

  const salida: ItemNavegable[] = []
  if (sueltos.length > 0) {
    salida.push({ clave: CLAVE_SUELTOS, etiqueta: ETIQUETA_SUELTOS, campos: sueltos })
  }
  salida.push(...grupos.values())
  return salida
}

/*
 * ---------------------------------------------------------------------
 * ListaDeItems: la lista al costado y, en el celular, el cajón
 * ---------------------------------------------------------------------
 */

export default function ListaDeItems({
  items,
  elegido,
  onElegir,
  abierta,
  onAbrir,
}: {
  items: ItemNavegable[]
  elegido: string
  onElegir: (clave: string) => void
  abierta: boolean
  onAbrir: (v: boolean) => void
}) {
  // Elegir un ítem la devuelve al formulario: en el celular no tendría
  // sentido dejar el cajón abierto tapando lo que acaba de pedir ver. En
  // escritorio esto no se nota —la lista queda fija al costado sin
  // importar `abierta`— así que un mismo click sirve para los dos casos.
  function elegir(clave: string) {
    onElegir(clave)
    onAbrir(false)
  }

  return (
    <div className="panel-lista">
      {/*
        El botón del cajón, rotulado con PALABRAS. No es un detalle de
        estilo: un ícono de hamburguesa (☰) suelto es justo lo que nadie
        toca la primera vez, porque no dice qué pasa al tocarlo. Vive
        siempre en el marcado —el CSS que todavía no existe es quien
        decide si se ve en escritorio, donde la lista ya está fija al
        costado y este botón no hace falta.
      */}
      <button
        type="button"
        className="panel-lista-boton-cajon"
        aria-expanded={abierta}
        onClick={() => onAbrir(!abierta)}
      >
        {abierta ? 'Cerrar la lista' : 'Elegir de la lista'}
      </button>

      <nav
        className={abierta ? 'panel-lista-items panel-lista-items-abierta' : 'panel-lista-items'}
        aria-label="Elementos de esta sección"
      >
        <ul className="panel-lista-ul">
          {items.map((item) => {
            const activo = item.clave === elegido
            return (
              <li key={item.clave}>
                <button
                  type="button"
                  className={activo ? 'panel-lista-fila panel-lista-fila-activa' : 'panel-lista-fila'}
                  aria-current={activo ? 'true' : undefined}
                  onClick={() => elegir(item.clave)}
                >
                  {item.etiqueta}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
