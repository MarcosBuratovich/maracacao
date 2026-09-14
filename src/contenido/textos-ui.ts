/*
 * Los textos que el script pinta en runtime, y que por eso no pueden salir
 * del HTML renderizado.
 *
 * El problema que resuelve: `marca.ts` los tenía escritos adentro. La
 * clienta los edita en el panel, guarda, publica — y no cambia nada,
 * porque el string vive en el JavaScript. Es la peor clase de edición
 * fallida, la que parece que funcionó.
 *
 * Esta lista es la única declaración de qué textos cruzan esa frontera.
 * Un campo que el script pinte y no esté acá vuelve a ser un literal
 * escondido, así que agregar uno es agregarlo ACÁ primero.
 *
 * Vive en src/contenido/ y respeta la regla de la carpeta: sin node:*, sin
 * Astro, solo rutas relativas. Lo van a importar `index.astro` para
 * publicarlo y el panel de la fase 6 para saber qué previsualizar.
 */

/** Las claves que el script busca, con la ruta del campo de la que salen. */
export const TEXTOS_UI = {
  navAbrir: 'nav.abrir',
  navCerrar: 'nav.cerrar',
  copiado: 'contacto.copiado',
  enviando: 'contacto.formulario.enviando',
  envolturaAltPrefijo: 'anaquel.envolturaAltPrefijo',
  ilustracionAltPrefijo: 'anaquel.ilustracionAltPrefijo',
} as const

export type ClaveTextoUi = keyof typeof TEXTOS_UI

/**
 * Arma el objeto que viaja al HTML. Recibe el contenido ya cargado en vez
 * de importarlo: así este módulo no depende de la fachada y el panel puede
 * llamarlo sobre un borrador sin publicar.
 */
export function textosUi(marca: Record<string, unknown>): Record<ClaveTextoUi, string> {
  const enRuta = (ruta: string): string => {
    let v: unknown = marca
    for (const parte of ruta.split('.')) v = (v as Record<string, unknown>)?.[parte]
    if (typeof v !== 'string') {
      // Tirar y no devolver '' : un texto de UI vacío se ve como un botón
      // sin palabras, y averiguar por qué cuesta una tarde.
      throw new Error(`textosUi(): la ruta «${ruta}» no da un texto.`)
    }
    return v
  }
  const salida = {} as Record<ClaveTextoUi, string>
  for (const [clave, ruta] of Object.entries(TEXTOS_UI)) {
    salida[clave as ClaveTextoUi] = enRuta(ruta)
  }
  return salida
}
