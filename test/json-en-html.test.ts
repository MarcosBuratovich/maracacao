/*
 * El JSON del anaquel viaja dentro de un <script type="application/json">
 * inyectado con `set:html`, que NO escapa nada. Un «</script» adentro de
 * cualquier campo de sabor cierra el script antes de tiempo, el
 * JSON.parse del otro lado tira, y muere src/scripts/marca.ts entero:
 * con él se van el copiar-correo, el envío del formulario y —peor— los
 * seis pasos de «Cómo catar», que marca.css deja en opacity 0 esperando
 * un observador que ya no llega.
 */
import { describe, it, expect } from 'vitest'
import { jsonParaHtml } from '@/lib/json-en-html'

describe('jsonParaHtml()', () => {
  it('no deja ningún «<» que pueda cerrar el <script>', () => {
    const salida = jsonParaHtml({ nombre: 'Lima </script><script>alert(1)</script>' })
    expect(salida).not.toContain('<')
  })

  it('lo que sale vuelve a ser exactamente lo que entró', () => {
    const datos = { nombre: 'Lima </script> y chile', precio: 108, activo: true }
    expect(JSON.parse(jsonParaHtml(datos))).toEqual(datos)
  })

  it('no toca el contenido que no tiene «<»', () => {
    expect(jsonParaHtml({ a: 'Jengibre y naranja' })).toBe('{"a":"Jengibre y naranja"}')
  })
})
