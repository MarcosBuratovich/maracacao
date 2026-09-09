/**
 * Serializa datos para un `<script type="application/json">` inyectado con
 * `set:html`, que no escapa nada.
 *
 * `<` solo puede aparecer dentro de un string de JSON (los caracteres
 * estructurales son `{}[]",:` y los literales), así que reemplazarlo en
 * toda la cadena es seguro. `<` es un escape válido de JSON y vuelve
 * a ser `<` al parsear: el consumidor no se entera.
 *
 * Sin esto, un «</script» adentro de un campo de contenido cierra el
 * script antes de tiempo y el `JSON.parse` del otro lado tira.
 */
export const jsonParaHtml = (datos: unknown) =>
  JSON.stringify(datos).replace(/</g, '\\u003c')
