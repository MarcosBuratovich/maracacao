/*
 * El documento del sitio: 21 bloques.
 *
 * Está partido en cinco archivos por tema —cabecera, producto,
 * experiencia, negocio, contacto y páginas— y este los junta. Los cinco
 * exportan CLAVES y no grupos: si cada uno devolviera un `grupo`, el
 * documento tendría cinco niveles de anidamiento que no existen en el
 * contenido y todas las rutas del sistema cambiarían.
 *
 * El orden de las claves acá adentro es el orden en que `serializa()`
 * escribe el JSON y el orden en que el panel dibuja las secciones. Es el
 * de la página, de arriba hacia abajo.
 */
import { grupo } from '../campos'
import { camposDeCabecera } from './sitio/cabecera'
import { camposDeProducto } from './sitio/producto'
import { camposDeExperiencia } from './sitio/experiencia'
import { camposDeNegocio } from './sitio/negocio'
import { camposDeContacto } from './sitio/contacto'
import { camposDePaginas } from './sitio/paginas'

export const esquemaSitio = grupo({
  etiqueta: 'El sitio',
  seccion: 'portada',
  ayuda: 'Todo el texto de la página: la portada, los productos, las recetas, el contacto y el pie.',
  campos: {
    ...camposDeCabecera,
    ...camposDeProducto,
    ...camposDeExperiencia,
    ...camposDeNegocio,
    ...camposDeContacto,
    ...camposDePaginas,
  },
})
