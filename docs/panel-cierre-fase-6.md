# Cierre de la fase 6 — el panel entregado

Esto es lo que quedó hecho, lo que quedó afuera a propósito, y lo que la fase 7
tiene que atacar primero. Para vos, no para ella; el documento de ella es
`panel-para-la-clienta.md`.

## Qué quedó funcionando

El panel completo, en `/panel`: entra con correo y contraseña (o con enlace por
mail), edita 198 campos repartidos en secciones, se le autoguarda solo,
resuelve el conflicto de dos aparatos, publica con una pantalla de revisión
antes, ve subir el cambio, lo deshace dentro de media hora, y ve el historial
de lo que publicó — con el resultado de su última publicación arriba de todo al
abrir, que era el pedido del spec §4.5.

1504 tests en 67 archivos. El `pnpm build` completo —que es el `buildCommand`
real de Vercel— pasa con 0 errores y 0 advertencias.

## Qué quedó afuera a propósito

**La vista previa.** Ella publica sin ver cómo va a quedar. Lo compensa la
pantalla de revisión (le dice qué campos cambió y cómo) más el deshacer de
media hora. No es lo mismo, y se nota más en los textos largos.

**El medidor.** No hay nada que le diga cuánto ocupa lo que subió ni cuánto
queda de los límites de la plataforma.

## Lo que la fase 7 tiene que hacer primero

**1. Montar entorno de DOM en los tests.** Es lo más importante de esta lista y
es la causa de casi todo lo demás. Hoy `vitest` corre con `environment: 'node'`,
sin jsdom, y el `include` ni siquiera toma `.tsx`. Por eso `Sesion.tsx` —505
líneas, el archivo que orquesta todo— llegó a la revisión con cobertura de
comportamiento **cero**: su test afirmaba sobre el texto del archivo fuente.
Por ahí entraron cinco defectos obligatorios, incluidos dos que le borraban
trabajo a ella sin avisarle. Los arreglamos, pero los encontró una lectura
humana, no la suite. La próxima vez podemos no tener esa suerte.

Quedaron sin cobertura automática, esperando esto: el guardado al cerrar la
pestaña (`pagehide`/`sendBeacon`) y las dos recargas (`window.location.reload()`).

**2. El sondeo resta dos relojes distintos.** Ella manda `publicadoEn` con el
`Date.now()` de su aparato y el servidor hace `contexto.ahora() - publicadoEn`.
Con su reloj atrasado más de cinco minutos, el primer sondeo ya le dice «está
tardando más de lo normal» sobre una publicación perfectamente sana; adelantado,
nunca cruza el corte y se rompe la garantía de que nunca gira infinito. El huso
horario no entra (es epoch), solo el reloj mal puesto.

**3. El 409 de pisada, bien resuelto.** Hoy tiene salida —el botón «Volver a
abrir el panel»— pero el mensaje que lo acompaña sigue diciéndole «vuelve a
intentar la publicación», que es justo lo que no va a funcionar. El texto vive
en `src/servidor/publicar.ts` y arreglarlo obliga a re-empaquetar `api/panel.js`;
no lo hicimos el día de la entrega. Lo correcto es que el mensaje distinga un
error transitorio de una pisada.

**4. Quién publicó cada cosa.** El historial *supone* que todo autor es ella.
Hoy es cierto —vos publicás con git y esos cambios ni entran a la lista, que
filtra por `Panel: sí`— pero el día que haya un segundo correo publicando desde
el panel, le va a decir «tú» sobre algo ajeno. El arreglo es chico: que
`historial` devuelva también quién está mirando.

**5. Residuos de pérdida de trabajo, ya acotados pero no cerrados.**
- «Volver a editar» tras deshacer reconstruye desde el paquete compilado: si
  publica A, publica B, deshace B y recarga antes de que aterrice la reversión,
  la publicación siguiente puede volver a aplicar B.
- Tras un conflicto de borrador sin resolver, el guardado de emergencia al
  cerrar la pestaña manda `pisar: false` y está condenado a ser rechazado —
  justo el estado donde más falta hace.
- Ese mismo guardado de emergencia no cubre lo que ya está en vuelo, y el
  `fetch` no es `keepalive`.

**6. Decirle en pantalla lo que hoy solo está en su documento.** Si el 409 se
repite, la salida es reabrir el panel; se lo dice el documento, no la pantalla.

## Una lección de proceso, para el próximo plan

Las tres violaciones de caracteres invisibles de esta rama —que costaron un
commit entero de limpieza— salieron de un solo lugar: la línea del plan que
enuncia la regla tenía un NBSP **pegado** justo donde debía ir el escape. La
regla se violaba a sí misma, y cada implementador que leyó las restricciones
globales copió ese ejemplo.

Los ejemplos de una regla sobre caracteres hay que verificarlos en binario, no
leerlos. Un `grep -P '\x00|\xc2\xa0'` sobre el plan, antes de despachar la
primera tarea, habría ahorrado todo eso.
