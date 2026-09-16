# El panel — cómo opera

Notas de operación del panel para la clienta (fase 5). Se arma a medida que
cada tarea deja algo que vale la pena anotar para el Marcos de más adelante,
no de una sola vez.

## Cómo se escribe una función

La fuente de cada función serverless va en `src/servidor/entradas/<nombre>.ts`,
nunca directo en `api/`. Es así por una razón medida, no por gusto: el 16 de
septiembre de 2026, en producción, `api/contacto.ts` importando un archivo de
afuera de `api/` construyó sin quejarse y murió en cada invocación
(`FUNCTION_INVOCATION_FAILED`, 500 siempre). El tracer de Vercel no sigue ese
import al armar el paquete de la función. Como el panel entero depende de que
`api/panel.ts` pueda importar `src/servidor/**` (la sesión, el cliente de
GitHub, la validación), la única forma que funciona es que la función viva
afuera de `api/` y llegue ahí ya empaquetada.

El que la empaqueta es `pnpm bundle:api` (`scripts/bundle-api.ts`, con
esbuild): junta la fuente y todo lo que importa —`src/servidor/origen.ts`
incluido— en un solo archivo JavaScript autocontenido, sin más import que los
de Node (`node:crypto` y compañía, que sí existen en el runtime). Lo que se
commitea es la fuente en `src/servidor/entradas/` Y el artefacto en
`api/<nombre>.js`: los dos, no uno solo. Parece raro commitear algo generado,
pero es la forma más simple de las tres que se probaron (las otras dos
generan durante el build de Vercel o cambian cómo se sirve todo el sitio) y
no depende de en qué momento exacto Vercel mira la carpeta `api/`.

Que el artefacto se commitee abre una sola forma de romperlo: que alguien
edite la fuente y se olvide de correr `pnpm bundle:api`, y Vercel despliegue
tranquilamente la versión vieja sin que nada se queje. Para eso está
`test/bundle-api.test.ts`: reconstruye el bundle en memoria en cada corrida y
lo compara byte a byte contra lo que hay commiteado en `api/`. Si alguna vez
lo ves rojo, la solución es una línea: `pnpm bundle:api` y commiteás lo que
cambió. Y si a alguien —vos incluido, dentro de seis meses, apurado— se le
ocurre editar el `.js` de `api/` a mano para arreglar algo rápido: no. El
próximo `pnpm bundle:api` lo pisa sin avisar, y mientras tanto ese mismo test
se pone rojo porque el archivo dejó de matchear lo que la fuente produce. El
banner de la primera línea del artefacto (`GENERADO por scripts/bundle-api.ts
— no editar a mano`) está para recordarlo en el peor momento, con el archivo
ya abierto.
