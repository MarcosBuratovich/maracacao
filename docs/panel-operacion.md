# El panel — cómo opera

Notas de operación del panel para la clienta (fase 5). Se arma a medida que
cada tarea deja algo que vale la pena anotar para el Marcos de más adelante,
no de una sola vez.

Si algo del panel deja de andar, `scripts/humo-panel.sh` es el ensayo de
este documento en forma de script: pega contra `www.maracacao.mx` de
verdad —salud, un login que falla a propósito, un login que funciona,
publicar sin declarar `base` (400) y con una `base` vieja (409), una
publicación real, `estado` sondeando la API de Vercel hasta «listo»,
`historial`, `deshacer` por el mismo canal que usa la clienta, `version.json`
confirmando el sha del deshacer, un documento fuera de la lista blanca
(422), y por último el freno de intentos de `entrar`— y en el camino
confirma o descarta la mayoría de las preguntas que este runbook contesta
por escrito. El freno va al final a propósito: no depende de nada de lo que
hace `publicar`/`estado`/`historial`/`deshacer`, así que probarlo antes solo
agregaría una espera de quince minutos en el medio de un ensayo que se
supone hay que poder repetir. Correrlo primero, antes de tocar nada a
mano, ahorra tiempo. Si una corrida se corta justo después de publicar el
cambio de prueba y antes de dejar el sitio como estaba, el propio script te
deja, en el mensaje de error, el comando exacto para arreglarlo
(`scripts/humo-panel.sh --restaurar '…'`) — no hace falta ni leer el
script ni tocar Git a mano.

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

## Las variables: qué es cada una y dónde vive

Todas viven en el mismo lugar: vercel.com → proyecto `maracacao` →
**Settings** → **Environment Variables**, marcadas para el entorno
**Production** nada más (nunca Preview ni Development — los previews de
cada rama y `pnpm dev` local no necesitan, y no deberían tener, ningún
secreto real). `salud` (`GET /api/panel?accion=salud`) es la forma de
confirmar desde afuera que las siete obligatorias están cargadas, sin
necesitar sesión:

```bash
curl -s https://www.maracacao.mx/api/panel?accion=salud
```

| Variable | Qué es | Si falta |
|---|---|---|
| `PANEL_CLAVE_HASH` | El hash de la contraseña de la clienta (formato `scrypt$…`, ver la sección de abajo). Sin esto, nadie entra. | `entrar` compara contra el hash señuelo igual, así que siempre da 401 — parece «contraseña incorrecta» aunque el problema sea otro. `salud` es la forma de distinguir los dos casos. |
| `PANEL_SECRETO` | La clave con la que se firma y se verifica la cookie de sesión (HMAC-SHA256). Tiene que medir 32 caracteres o más — con menos, `entrar` y `publicar` responden 503 a propósito, antes de intentar nada (ver C-1 en `src/servidor/acciones.ts`). | Nadie puede entrar ni publicar: 503, nunca un 401 que confunda. |
| `PANEL_CORREOS` | La lista de correos con acceso, separados por comas. Se vuelve a leer en CADA `entrar` y en CADA `publicar` (I-4) — nunca queda una cookie vieja publicando en nombre de alguien que ya no está en la lista. | Nadie entra: ningún correo matchea una lista vacía. |
| `PANEL_SESIONES_DESDE` | Opcional, ISO 8601. Toda sesión firmada ANTES de esta fecha deja de valer — el botón de pánico para cerrar sesión en todos lados sin rotar `PANEL_SECRETO`. Ver «Cómo cortar una sesión», abajo. | No es una de las siete obligatorias: `salud` no la pide. Ausente, no hay revocación por fecha (el estado normal). Si trae un valor que no se puede leer como fecha, el efecto es el contrario del de las otras filas: en vez de «no hay revocación», se rechaza TODA sesión hasta que se corrija — a propósito, ver la sección de abajo. |
| `PANEL_DISPOSITIVOS_REVOCADOS` | Opcional, ids de dispositivo separados por comas. La revocación quirúrgica de un aparato puntual — el celular perdido de alguien que sigue teniendo acceso. Ver «Cómo cortar una sesión», abajo. | No es una de las siete obligatorias: `salud` no la pide. Ausente, ningún dispositivo está revocado (el estado normal). |
| `PANEL_GITHUB_TOKEN` | El fine-grained PAT de GitHub, acotado al repo `maracacao`, con un solo permiso (`Contents: Read and write`, sin `Workflows`). Es lo que le permite al panel escribir commits. Vence solo — GitHub lo exige (ver «Renovar el token de GitHub», abajo) — y `salud` avisa a `PANEL_AVISOS_A` treinta días antes. | `publicar` no puede leer ni escribir nada: 502. `salud` contesta `"github":false`. |
| `PANEL_VERCEL_TOKEN` | Token de la API de la plataforma, con lectura de despliegues del proyecto. | El panel no puede decir si un cambio llegó al sitio ni revertir solo un deploy fallido — y la fase 6 apaga el botón Publicar. Es una de las obligatorias: sin ella, `salud` contesta 503. |
| `PANEL_VERCEL_PROYECTO` | El nombre del proyecto. Por defecto sale del repo (`maracacao`). | No es una de las obligatorias: `salud` no la pide. Solo hace falta cargarla si algún día el proyecto se llama distinto del repo. |
| `GITHUB_DUENIO` | El dueño del repo (`MarcosBuratovich`). Tiene default: si falta, se completa solo con `VERCEL_GIT_REPO_OWNER` (que Vercel ya inyecta en todo deploy conectado a Git) o, si ni eso está, con el literal `MarcosBuratovich` (`src/servidor/entradas/panel.ts`, función `entorno()`). | En la práctica, nunca falta — por eso no hace falta cargarla a mano en Vercel. |
| `GITHUB_REPO` | El nombre del repo (`maracacao`). Mismo default en cascada que `GITHUB_DUENIO`. | Igual que arriba: nunca falta en la práctica. |
| `RESEND_API_KEY` | La clave del proveedor de correo. | No es una de las obligatorias: el panel publica igual. Lo que se pierde son los avisos, y el enlace mágico deja de estar disponible. |
| `PANEL_REMITENTE` | La dirección desde la que salen los avisos: `Panel Maracacao <panel@maracacao.mx>`. Tiene que ser de un dominio verificado en el proveedor (SPF+DKIM en el DNS). | Igual que la anterior: sin avisos y sin enlace mágico. Y mientras `maracacao.mx` no esté verificado, los avisos solo llegan a la casilla del dueño de la cuenta del proveedor. |
| `PANEL_AVISOS_A` | A quién avisarle cuando algo sale mal: un despliegue que falló, el token por vencer. Es la dirección de Marcos; a la clienta se le avisa al correo con el que entró. | Los avisos para Marcos no salen. Los de la clienta sí. |

Las últimas dos están en la lista de `salud` porque el código las pide (E8:
siete variables obligatorias, siempre las mismas siete), pero en un deploy
conectado a GitHub —que es como está este proyecto— nunca vas a ver a
`GITHUB_DUENIO` ni a `GITHUB_REPO` en el `"faltan"` de una respuesta real: el
default las completa antes de que `salud` las mire. Si alguna vez hace falta
apuntar el panel a OTRO repo (un fork, una migración), ahí sí hay que
cargarlas a mano — mientras tanto, no.

### Cómo cortar una sesión (celular perdido, alguien que se va)

Tres botones, del más chico al más grande. **Ninguno de los tres pide rotar
`PANEL_SECRETO`** — rotarlo desloguea a todo el mundo y además mata los enlaces
mágicos que estén en vuelo.

1. **Un aparato:** agregá su id a `PANEL_DISPOSITIVOS_REVOCADOS` (lista separada
   por comas). El id sale del historial de la persona o del log de `entrar`.
2. **Todas las sesiones de todo el mundo:** poné en `PANEL_SESIONES_DESDE` la
   fecha y hora de ahora, en ISO 8601 (`2026-09-17T15:30:00Z`). Todos vuelven a
   entrar con su contraseña. **Ojo:** si la fecha no se puede leer, NADIE entra
   —está hecho así a propósito— así que revisá que quede bien escrita.
3. **Sacar a una persona para siempre:** quitá su dirección de `PANEL_CORREOS`.
   Se relee en cada pedido, así que corta enseguida.

## Cómo se cambia la contraseña del panel

No hay «recuperar contraseña» ni tabla de usuarios: la contraseña vive
hasheada en la variable de entorno `PANEL_CLAVE_HASH` de Vercel (entorno
Production, nada más), y `src/servidor/sesion.ts` es el único lugar que la
lee y la compara. En claro no está guardada en ningún lado más que en el
llavero del teléfono de la clienta — ni Marcos la sabe, y no hay forma de
recuperarla si se pierde: se elige una nueva y se repite este paso.

Para generar el hash que va a esa variable:

```bash
pnpm exec tsx -e "import {hashDeClave} from './src/servidor/sesion.ts'; console.log(hashDeClave(process.argv[1]))" 'la contraseña que eligió la clienta'
```

Esto imprime una sola línea con la forma
`scrypt$16384$8$5$<sal en base64>$<hash en base64>`. Esa línea completa —
tal cual, con los signos `$` incluidos— es el valor que va a
`PANEL_CLAVE_HASH` en Vercel, nunca la contraseña en claro que se le pasó
al comando.

Dos advertencias:

- **La contraseña en claro no se guarda en ningún lado.** Ni en este
  comando (no queda en el historial de shell más que como argumento
  efímero), ni en un archivo, ni en un chat. Se genera el hash, se pega en
  Vercel, y se descarta.
- **Cambiar la contraseña no cierra las sesiones que ya estén abiertas.**
  La cookie de sesión es un HMAC firmado con `PANEL_SECRETO`, una variable
  distinta — mientras `PANEL_SECRETO` no cambie, una cookie firmada antes
  sigue siendo válida hasta que venza sola. Si hace falta cortar sesiones
  activas —un aparato perdido, alguien que se va, o todas de una sola vez—,
  ver «Cómo cortar una sesión» más arriba: ninguno de esos tres botones pide
  tocar `PANEL_CLAVE_HASH` ni `PANEL_SECRETO`.

Los clics para dejar el hash nuevo funcionando, en Vercel:

1. vercel.com → el proyecto `maracacao` → **Settings** → **Environment
   Variables**.
2. Buscá `PANEL_CLAVE_HASH` en la lista, tocá los tres puntos de esa fila →
   **Edit**.
3. Pegá la línea completa que imprimió el comando de arriba (con los `$`) en
   el valor. Abajo, donde pregunta en qué entornos vale, tiene que quedar
   marcado **solo Production** — ni Preview ni Development: los tests y las
   ramas de trabajo no necesitan la contraseña real, y si algún día un
   Preview la tuviera cargada, cualquiera con el link de ese Preview podría
   probarla.
4. **Save.**
5. Un cambio de variable de entorno NO redespliega solo: las funciones ya
   desplegadas siguen corriendo con el valor viejo hasta el próximo deploy.
   Andá a **Deployments**, abrí el de arriba de todo (el de Production) →
   los tres puntos → **Redeploy** → confirmá sin tocar la opción de caché.
6. Esperá el redeploy (un par de minutos) y probá con
   `curl -s https://www.maracacao.mx/api/panel?accion=salud` — tiene que
   seguir diciendo `"ok":true`. Recién ahí la contraseña vieja dejó de
   servir y la nueva ya sirve.

## El enlace mágico de recuperación (Tarea 12)

La puerta de emergencia — no la principal, que es la contraseña larga
guardada en el llavero del teléfono (arriba). Esta es la que hay que poder
usar el día que ese teléfono se perdió: en `www.maracacao.mx/panel/entrar`,
sin sesión, sin candado, sin necesitar que exista ningún panel (la fase
siguiente).

**Cómo se pide:** `POST /api/panel?accion=enlace` con `{ "correo": "…" }`.
**Siempre** contesta 200 con la misma frase —«Si esa dirección tiene
acceso, te llegó un correo con el enlace.»—, exista o no esa dirección en
`PANEL_CORREOS`. Es a propósito (spec §4.1): este endpoint es público, sin
sesión, así que una respuesta distinta según exista o no la dirección
serviría para probar direcciones una por una hasta encontrar cuáles tienen
acceso al panel — el mismo criterio por el que `entrar` no dice si falló el
correo o la contraseña. **Y siempre tarda lo mismo** (`PISO_ENLACE_MS`,
`src/servidor/acciones.ts`: 400 ms, hoy) exista o no la dirección — si eso
no fuera cierto, cronometrar la respuesta sería otra forma de probar
direcciones una por una. Si algún día pedir el enlace empieza a contestar
sospechosamente rápido y alguien va a "optimizarlo" sacando la espera: no,
esos 400 ms no son una demora de más, son la mitad del mecanismo.

**Cómo se consume:** el correo trae un enlace a
`/panel/entrar?token=…`, una página sin JavaScript de más (sin React, sin
candado) que, con un clic, manda `POST /api/panel?accion=entrar-con-enlace`
con `{ "token": "…" }` y vuelve con la misma cookie de sesión que deja
`entrar`. **Nunca se consume con un `GET`**: Gmail, Outlook y los
antivirus abren los enlaces de un correo para escanearlos, y con un `GET`
el enlace se gastaría en ese escaneo antes de que ella lo toque —por eso el
correo apunta a una PÁGINA, que no hace nada sola, y no directo al
endpoint. La cabecera `Referrer-Policy: no-referrer` de `/panel/:camino*`
(`vercel.json`) es la otra mitad de esa misma protección: sin ella, el
token viajaría en la cabecera `Referer` de la primera navegación que
saliera de esa página.

**Cuánto vale:** quince minutos desde que se pide (`DURACION_ENLACE_MS`,
`src/servidor/enlace.ts`), sin excepción, y solo para el correo que lo
pidió — el propósito (`entrar`) va adentro de la firma HMAC, así que ni un
enlace sirve como cookie de sesión ni una cookie sirve como enlace, aunque
las firme el mismo `PANEL_SECRETO` (mismo mecanismo que la cookie, Tarea
3). **No es de un solo uso:** no hay ningún almacén de enlaces ya usados
—el panel no tiene base de datos, y un almacén así necesitaría uno
compartido entre instancias que hoy no existe (mismo límite que el freno
de intentos, más abajo)—, así que un enlace vale para CUALQUIER pedido
dentro de esos quince minutos, no solo el primero. Rotar `PANEL_SECRETO`
(más abajo) invalida cualquier enlace que esté en vuelo, además de cerrar
todas las sesiones.

**El correo ES el producto acá — a diferencia de todo el resto del panel,
esta acción NO degrada sin `RESEND_API_KEY`/`PANEL_REMITENTE`.** En
cualquier otra acción, si el correo no está configurado se pierde un
aviso y el panel sigue publicando igual; acá, sin esas dos variables no
hay NINGUNA forma de que el enlace llegue, así que pedirlo contesta 503
—«Ahora mismo no puedo mandarte el enlace. Escríbele a Marcos.»— en vez de
decir «te lo mandé» y no mandar nada. Es la misma fila de la tabla de
variables, arriba: mientras `maracacao.mx` no esté verificado en el
proveedor, el enlace mágico no está disponible para nadie.

**El freno de intentos (E4) se aplica en las DOS puertas de esta sección**
(pedir el enlace, y consumirlo) **y en `entrar`/`salud`, pero — desde la
Ronda 1 de revisión de esta tarea — cada acción tiene su PROPIO
presupuesto de cinco cada quince minutos**, no uno compartido por IP.
Antes lo compartían, y eso se volvía en contra el día que más importaba:
la clienta que pide el enlace cinco veces porque no le llega se quedaba,
de paso, sin poder usar su contraseña por quince minutos — justo el día de
la recuperación.

`enlace` suma un segundo freno, por DESTINATARIO: **diez pedidos cada
quince minutos para la MISMA dirección**, sin importar desde cuántas IPs
—sin él, veinte IPs distintas podrían mandarle a la MISMA dirección cien
correos desde nuestro remitente—. El número importa: empezó en tres
(Ronda 1) y subió a diez (Ronda 2) porque tres era, al revés, una forma de
dejarla afuera de su propia puerta de emergencia — un extraño pidiendo su
enlace tres veces desde tres IPs cualquiera, sin necesitar saber nada
(este chequeo corre ANTES de mirar si la dirección está en la lista), y
ella recibía 429 al pedirlo de verdad. **Diez es un residuo declarado, no
un número final que se pueda subir sin pensarlo:** es bajo para proteger
su bandeja (frente a los cien de antes) y alto para que dejarla afuera
exija hostigarla a propósito — y si eso pasa, un `console.error` con la
dirección se lo dice a Marcos. No lo bajes de diez sin devolverle a su
bandeja el problema que este freno existe para evitar.

**El piso de tiempo tiene su propio residuo, declarado igual que el del
tope:** protege MIENTRAS el proveedor de correo sea más rápido que él.
Medido en la Ronda 3 de revisión: con el proveedor a 800 ms contra el piso
de 400, las dos ramas —dirección listada y no listada— vuelven a diferir
400 ms, y el oráculo de tiempo se reabre. No se cierra ese residuo con un
timeout que corte el envío: en una función serverless, abandonar un pedido
a mitad de camino puede matarlo —la plataforma congela el proceso apenas
la función contesta—, y ésta es la puerta de RECUPERACIÓN: que el correo
no salga el día que ella perdió el teléfono es peor que una ventana de
oráculo intermitente, que además solo aparece mientras el proveedor está
lento de verdad y no es algo que quien ataca pueda provocar a voluntad. Lo
que sí existe es la alarma: si el envío tarda más que el piso,
`console.error` lo dice con el tiempo exacto (`enlace: el envío tardó …
ms, más que el piso de 400 ms`). Si eso aparece seguido en los logs, es la
señal de que hay que subir `PISO_ENLACE_MS` — el piso protege mientras el
proveedor sea más rápido que él, y la alarma es cómo se sabe que dejó de
serlo.

**Por qué la sesión que deja `entrar-con-enlace` dura solo UN DÍA, no
treinta:** como el enlace no es de un solo uso (arriba), nada impide
reusar uno válido más de una vez dentro de los quince minutos — el único
techo real es cuánto dura la sesión que deja. Dos cosas lo acotan, sin
ningún almacén nuevo: la sesión dura 24 horas (es una puerta de
RECUPERACIÓN, sirve para volver a entrar, no para quedarse — la fase 6 va
a poder ofrecer «recordar este aparato» desde adentro del panel), y **cada
vez que se consume un enlace, le llega un correo a ELLA** —nunca a
Marcos—, avisándole que alguien entró con su enlace de recuperación. Es la
única señal que puede tener de que no fue ella. Ese correo es mejor
esfuerzo (igual que los avisos de un deploy fallido): si el envío falla o
el correo no está configurado, se loguea y el login sigue — avisar que
alguien entró no puede ser motivo para que la persona correcta se quede
afuera.

## Cómo rotar el PAT de GitHub en cinco minutos

Esto es lo que hay que hacer el día que el token de GitHub (el que vive en
`PANEL_GITHUB_TOKEN`) se filtra, o simplemente por las dudas cada tanto. El
token es un **fine-grained personal access token**, acotado al repo
`maracacao` y con un solo permiso: `Contents: Read and write` — sin
`Workflows`, así que aunque alguien lo tuviera en la mano no podría tocar
`.github/workflows/**` ni con el token a la vista (y aunque el token tuviera
de más, la lista blanca de `src/servidor/rutas-permitidas.ts` tampoco deja
que el panel intente escribir ahí — es cinturón y tirantes, no uno solo).

**Revocar el que puede estar filtrado:**

1. github.com → tu foto de perfil (arriba a la derecha) → **Settings**.
2. En el menú de la izquierda, hasta abajo del todo → **Developer
   settings**.
3. **Personal access tokens** → **Fine-grained tokens**.
4. Buscá el que usa el panel (el nombre que le hayas puesto al crearlo, algo
   como «panel-maracacao») → entrá → **Delete token** → confirmá. Desde ese
   instante ese token ya no sirve para nada, aunque alguien lo tenga
   guardado.

**Generar uno nuevo, con los mismos permisos:**

5. En la misma pantalla de **Fine-grained tokens** → **Generate new token**.
6. **Token name**: algo que se reconozca de un vistazo, por ejemplo
   `panel-maracacao-2027`. **Expiration**: la más larga disponible (o «No
   expiration» si la organización lo permite) — un token que vence solo un
   día cualquiera y tira el panel abajo sin aviso es peor que uno que dura
   de más.
7. **Resource owner**: tu usuario (`MarcosBuratovich`).
8. **Repository access** → **Only select repositories** → elegí `maracacao`
   nada más. Nunca «All repositories»: un token que puede tocar CUALQUIER
   repo tuyo es un premio demasiado grande para quien lo consiga.
9. **Permissions** → **Repository permissions** → buscá **Contents** → poné
   **Read and write**. Dejá TODO lo demás en «No access», en particular
   **Actions** (que es donde vive el permiso de tocar workflows) — no hace
   falta ni un solo permiso más para que el panel funcione.
10. **Generate token**. GitHub lo muestra UNA sola vez: copialo ahí mismo,
    no cierres la pestaña sin copiarlo.

**Cargarlo en Vercel y redesplegar:**

11. vercel.com → proyecto `maracacao` → **Settings** → **Environment
    Variables** → `PANEL_GITHUB_TOKEN` → **Edit** → pegá el token nuevo →
    confirmá que sigue marcado solo **Production** → **Save**.
12. **Deployments** → el de arriba (Production) → los tres puntos →
    **Redeploy**. Igual que con la contraseña: sin este paso, las funciones
    ya desplegadas siguen usando el token viejo (que ya no existe) hasta
    que algo las redespliegue.
13. Confirmá con
    `curl -s https://www.maracacao.mx/api/panel?accion=salud` — tiene que
    volver a decir `"github":true`. Si dice `false`, o el token no se pegó
    bien, o el redeploy todavía no terminó — esperá un minuto y probá de
    nuevo antes de sospechar algo peor.

Cinco pasos que importan, cinco minutos reales si ya sabés dónde hacer clic:
revocar (paso 4), generar (pasos 5 a 10), pegar (paso 11), redeploy (paso
12), confirmar (paso 13).

## Renovar el token de GitHub (Tarea 13: el aviso de los treinta días)

Un fine-grained PAT tiene fecha de vencimiento OBLIGATORIA — GitHub no deja
crear uno sin ella (como mucho, «No expiration», si la organización lo
permite; ver el paso 6 de la sección de arriba). El día que vence, el panel
deja de poder escribir en GitHub sin que nada haya cambiado del lado del
código: `publicar` empieza a contestar 502 y `salud` dice `"github":false` —
el modo de falla que esta tarea existe para que Marcos nunca vea de
sorpresa (spec §4.1).

**Por eso `salud` avisa solo, con anticipación.** Cada vez que alguien la
llama —vos a mano, o `scripts/humo-panel.sh`— lee la fecha de vencimiento de
la MISMA respuesta que ya le pedía a GitHub para el chequeo de `"github"`
(no hace un pedido aparte: no le cuesta cuota al PAT). Si faltan **treinta
días o menos**, te manda un correo a `PANEL_AVISOS_A` con la fecha exacta y
cuántos días quedan. Ese correo es la señal de que hay que hacer lo de
abajo — no hace falta esperar a que el token venza solo ni a acordarse de
mirar el calendario.

Dos cosas a tener presentes sobre ese aviso, por si alguna vez hace falta
depurarlo:

- **Es «como mucho una vez cada 24 h», pero por INSTANCIA VIVA del panel,
  no una vez cada 24 h a secas.** El freno vive en la memoria de la función
  serverless (mismo límite, y misma razón, que el freno de intentos de
  `entrar` — ver «Lo que todavía NO está cubierto», más abajo): si Vercel
  tiene dos instancias corriendo a la vez, o recicla una, en teoría podrían
  llegar dos correos el mismo día. Inofensivo — el costo es un correo de
  más, no un agujero de seguridad — pero si alguna vez ves dos avisos el
  mismo día, es por eso, no por un bug.
- **Si la respuesta de GitHub no trae la cabecera de vencimiento —un token
  CLÁSICO en vez de fine-grained, por ejemplo—, `salud` nunca inventa una
  fecha.** `tokenVence` y `diasParaVencer` quedan en `null` y no sale ningún
  correo. Poner «vence en un año» a ojo sería peor que no saber: apagaría la
  vigilancia justo el día que más hace falta que esté prendida.

**Un fine-grained PAT no se «renueva» en el sentido de extenderle la fecha
al mismo token: GitHub no tiene ese botón.** Lo que hay que hacer es generar
uno NUEVO, con los mismos permisos, y reemplazar el viejo — los mismos pasos
5 a 13 de «Cómo rotar el PAT de GitHub en cinco minutos», arriba, con dos
diferencias respecto de un token filtrado:

1. **No hace falta revocar el viejo primero** (paso 4 de arriba): no está
   comprometido, solo está por vencer, así que podés generar el nuevo con
   calma, confirmarlo funcionando, y recién ahí borrar el viejo (o dejar que
   venza solo — cualquiera de las dos formas está bien).
2. **Los permisos, exactos:** `Contents` → **Read and write**, y `Metadata`
   → **Read-only** — GitHub marca `Metadata: Read-only` solo en cuanto
   elegís cualquier otro permiso del repositorio, así que no hay que
   buscarlo aparte, alcanza con confirmar que quedó tildado. Nunca
   `Workflows`: sin ese permiso, el token no puede tocar
   `.github/workflows/**` aunque el código del panel se lo pidiera (y la
   lista blanca de `src/servidor/rutas-permitidas.ts` tampoco lo dejaría
   intentarlo — cinturón y tirantes).

**La parte que no se puede saltear:** generar el token nuevo y pegarlo en
`PANEL_GITHUB_TOKEN` en Vercel NO alcanza por sí solo. Las variables de
entorno se leen al ARRANCAR la función — no en cada pedido — así que las
funciones ya desplegadas siguen usando el token viejo (el que está por
vencer, o el que ya venció) hasta que algo las redespliega. El paso 12 de
arriba (**Deployments** → Production → los tres puntos → **Redeploy**) es
tan parte de «renovar el token» como generarlo: sin ese clic, guardar la
variable nueva no cambió nada todavía. Confirmá con

```bash
curl -s https://www.maracacao.mx/api/panel?accion=salud
```

— tiene que volver a decir `"github":true`, y `"tokenVence"` con la fecha
del token NUEVO, bien lejos otra vez.

## Cómo rotar `PANEL_SECRETO` (último recurso: el secreto se filtró)

Esta sección se llamaba «Cómo cerrar TODAS las sesiones abiertas», y decía
que rotar `PANEL_SECRETO` era la ÚNICA forma de hacerlo. Eso dejó de ser
cierto: «Cómo cortar una sesión» (más arriba, en la sección de variables)
ya cubre un aparato puntual, todas las sesiones desde una fecha, o sacar a
una persona — y ninguno de los tres te desloguea a vos de paso, ni mata los
enlaces mágicos que estén en vuelo (algo que rotar el secreto sí hace,
desde la Tarea 12).

**Para un celular perdido, alguien que se va, o «por las dudas, que todos
vuelvan a entrar», no hace falta esto — usá los tres botones de arriba.**
Son más baratos y hacen exactamente lo que necesitás, sin de paso sacarte a
vos también.

Rotar `PANEL_SECRETO` es para un caso distinto y más grave: **el secreto en
sí se filtró** — apareció en un log, una captura de pantalla compartida, un
repo que no debía tenerlo. Ahí no alcanza con cortar una sesión puntual ni
con `PANEL_SESIONES_DESDE`: quien tiene el secreto puede FIRMAR cookies
nuevas, con la fecha de `emitida` que quiera, así que la única forma de que
dejen de servir es que el secreto con el que las firmó deje de ser el que
el servidor usa.

1. Generá un secreto nuevo, al azar, de más de 32 caracteres (el mínimo que
   exige `LARGO_MIN_SECRETO` en `src/servidor/sesion.ts` — con menos, un
   HMAC no protege nada):
   ```bash
   openssl rand -base64 48
   ```
2. vercel.com → proyecto `maracacao` → **Settings** → **Environment
   Variables** → `PANEL_SECRETO` → **Edit** → pegá el valor nuevo → solo
   **Production** → **Save**.
3. **Deployments** → Production → **Redeploy** (mismo motivo que siempre:
   sin esto, las funciones ya desplegadas siguen firmando y verificando con
   el secreto viejo).
4. Confirmá con `salud` como en los pasos anteriores, y después probá
   entrar de nuevo con la contraseña — tiene que pedir login otra vez, para
   vos también. Si te dejó pasar sin pedir nada, el redeploy todavía no
   terminó.

## Si `main` queda roto

**Si el commit que rompió `main` lleva el trailer `Panel: sí` (lo publicó
el panel, no vos a mano), probablemente ya no necesites esta sección: la
reversión automática (ver «Se cayó el sitio después de una publicación»,
más abajo) ya lo arregló solo, en la próxima acción autenticada. Esta
sección es para un commit TUYO, o para el residuo de casos en que esa
reversión no pudo (también explicados ahí abajo).**

No hay apuro. El sitio en producción sigue sirviendo el ÚLTIMO deploy
bueno — Vercel no tira abajo lo que ya está andando solo porque el commit
de arriba de `main` no compila o falla un check. `www.maracacao.mx` sigue
respondiendo exactamente igual que antes, con el contenido de antes,
mientras vos arreglás con calma.

Lo que rompió `main` casi siempre es un commit que vino DESDE el panel — un
documento que igual pasó la validación del navegador pero después falló
algo en `astro build` (un caso que la revalidación del servidor no cubre,
porque valida el esquema del contenido, no que el sitio entero compile) — o
un commit tuyo, normal, desde la computadora. La solución es la misma para
los dos casos: un commit nuevo, normal, desde tu computadora, que arregla lo
que sea que rompió, y lo empujás a `main` como cualquier otro día. Nunca
hace falta tocar el panel para esto — el panel no sabe nada de si el sitio
compila, y no tiene por qué saberlo.

Si el deploy roto ya se disparó y está corriendo, podés cancelarlo a mano
desde **Deployments** en Vercel (los tres puntos → **Cancel**) mientras
armás el arreglo, pero ni siquiera eso es urgente: el peor caso es que
Vercel termine de intentarlo, falle, y el sitio en vivo siga siendo el
mismo de antes.

## Se cayó el sitio después de una publicación

Esto es distinto de «`main` queda roto» de arriba: acá el commit SÍ era
válido y SÍ lo publicó el panel (`Panel: sí` en el trailer), pero el
despliegue de Vercel terminó en error o se canceló — un problema de
infraestructura, no de contenido. Desde la Tarea 8 de la fase 5 Parte B,
el panel intenta arreglar esto SOLO.

**Qué hace la reversión automática.** `revisaLaCabeza()`
(`src/servidor/acciones.ts`) corre como lo PRIMERO que hace cualquier
acción autenticada —`publicar`, `estado`, `deshacer`, `historial`—, apenas
después de sus propias validaciones baratas (secreto, sesión, forma del
sha) y antes de hacer lo que sea que esa acción vino a hacer. Pregunta: ¿la
cabeza de `main` es un commit del panel (trailer `Panel: sí`) que no es ya
una reversión, y cuyo despliegue en Vercel terminó en `ERROR` o
`CANCELED`? Si sí, lo revierte ahí mismo — un commit NUEVO con los blobs
VIEJOS (`src/servidor/revertir.ts`), **nunca** un `git reset`, **nunca**
`--force`: el historial tiene que poder contar que hubo un cambio y que se
deshizo.

**A quién avisa, y por qué puede ser distinto según quién dispara la
limpieza:**

- Si es ELLA quien está sondeando `estado` para ESE sha (el caso normal:
  publicó, y todavía tiene el panel abierto esperando el veredicto), le
  llega un correo a ELLA («No salió; lo dejé como estaba y ya le avisé a
  Marcos.», sin jerga) Y a vos (`PANEL_AVISOS_A`, con el sha, el autor real
  —leído del trailer `Panel-Autor:` del commit, nunca de quien dispara la
  limpieza— y el resultado técnico de la reversión).
- Si NADIE está mirando ese sha en particular en este instante —cerró el
  panel, o sos vos entrando a mirar `historial`, o ella publicando OTRA
  cosa y `revisaLaCabeza()` de paso encuentra la cabeza rota de una
  publicación anterior—, te avisa SOLO a vos. Ella se entera recién la
  PRÓXIMA vez que algo autenticado vuelva a pasar por `revisaLaCabeza()`
  con ese mismo sha: si reabre el panel más tarde y lo primero que dispara
  es justo esa acción, ahí recién le llega su correo — la pantalla que abre
  el panel tiene que estar preparada para encontrarse con que lo que
  publicó ya fue deshecho, no para asumir que sigue publicado hasta que
  algo le diga lo contrario.

**No hay ningún proceso sondeando en segundo plano.** Una función
serverless de Vercel no vive entre pedidos: la reversión automática SOLO
corre cuando alguien —ella, vos, o cualquier acción autenticada— hace un
pedido nuevo. Si ella publica y cierra el teléfono, y el deploy falla
después, `main` se queda con el commit roto hasta que ALGUIEN vuelva a
tocar el panel — el sitio en vivo no se cae mientras tanto (sigue sirviendo
el último deploy bueno, como en la sección de arriba), pero `main` no se
arregla solo por el paso del tiempo.

**Cuándo la reversión automática NO puede arreglarlo sola** —`main` se
queda con el commit roto, y el correo a vos nombra el motivo exacto
(`intentaRevertir()`, acciones.ts):

- **`no-valida`** — el contenido VIEJO (al que habría que volver) ya no
  pasa las reglas de HOY: el esquema cambió entre esa publicación y ahora.
- **`no-es-la-cabeza`** — una carrera: algo más movió `main` justo en el
  medio. La PRÓXIMA acción autenticada lo vuelve a intentar desde cero.
- **`nada-que-revertir`** — el commit roto no tocó ningún documento de
  contenido. Hoy no puede pasar (todo commit del panel toca al menos un
  `src/contenido/datos/*.json`), pero deja de ser imposible en cuanto la
  fase 7 publique fotos sueltas.
- **Un error duro de GitHub** (token vencido, red caída, `502`) — mismo
  diagnóstico que cualquier otro `502` del panel: revisá `PANEL_GITHUB_TOKEN`
  primero («Renovar el token de GitHub», abajo).

**El arreglo a mano, cuando la reversión automática no pudo:**

```bash
git fetch origin main
git revert --no-edit <sha-del-commit-roto>
git push origin main
```

`--no-edit` porque no hay nada que decidir en el mensaje: es un revert
simple, sin merges de por medio (nunca hace falta `-m 1` acá). **Nunca**
`git push --force`: un commit de reversión es un commit NUEVO que se suma
arriba, igual que hace el panel con los suyos — forzar reescribiría la
historia y podría llevarse puesto algo que alguien más haya empujado en el
medio, y acá no hay ninguna razón para necesitarlo. Un `git revert` hecho
así no lleva el trailer `Panel: sí` (lo escribís vos, no el panel), así que
`revisaLaCabeza()` lo deja tranquilo — nunca va a intentar «arreglar tu
arreglo».

Confirmá con `curl -s https://www.maracacao.mx/version.json` (o la sección
de abajo) que el deploy de tu revert salió bien antes de dar el problema
por cerrado.

## La clienta dice que publicó y no ve el cambio

Dos números, comparados:

```bash
curl -s https://www.maracacao.mx/version.json   # qué sha sirve el CDN AHORA MISMO
git fetch origin main --quiet && git rev-parse origin/main   # la cabeza de main
```

- **Coinciden** — el sitio ya sirve exactamente lo último que hay en
  `main`. Si ella jura que no ve el cambio, el problema está de SU lado:
  el navegador (o un proxy de su operador) tiene la página vieja en
  caché. Pedile que recargue forzado (Ctrl/Cmd+Shift+R) o que la abra en
  una ventana privada — no hay nada que arreglar del lado del panel.
- **`version.json` va ATRÁS de `origin/main`, y el deploy de ese commit en
  Vercel sigue "Building"/"Queued"** — normal, es la ventana de segundos
  (a veces minutos) entre que el commit existe y el CDN lo sirve (spec
  §4.5, decisión B2: las DOS fuentes tienen que coincidir). Esperá y
  volvé a mirar.
- **El deploy de `origin/main` en Vercel dice "Error" o "Canceled"** — ver
  «Se cayó el sitio después de una publicación», arriba: si el commit
  lleva `Panel: sí` (`git log origin/main -1 --format=%B`), dale un minuto
  a la reversión automática y volvé a mirar `origin/main`; si no lleva ese
  trailer, es un commit tuyo — andá a «Si `main` queda roto».
- **`version.json` no contesta, o el sha que trae no aparece en ningún
  lado de `git log origin/main`** — algo raro de verdad. Revisá
  **Deployments** en Vercel a mano antes de asumir nada: puede ser un
  deploy manual fuera del panel, un dominio mal apuntado, o una caché
  intermedia sirviendo otra cosa.

## No le llegan los correos

Los avisos por correo son SIEMPRE un acompañante, con una sola excepción
(el enlace mágico, más abajo). `manda()` (`src/servidor/correo.ts`) NUNCA
tira una excepción: si `RESEND_API_KEY`/`PANEL_REMITENTE` faltan, el
proveedor rechaza el envío, o la red falla, devuelve `{ok:false, motivo}`;
quien lo llamó (`mandaProtegido`, `revierteYAvisa*`, `salud`) lo anota con
`console.error` y sigue su camino igual (B3, spec §4.1). Esto es a
propósito, no un bug: publicar, deshacer y la reversión automática
funcionan aunque NINGÚN correo salga — verificar un dominio en el
proveedor es un trámite de días (SPF+DKIM en el DNS), y el panel no puede
quedar esperando eso para dejarla publicar.

**Todos los avisos pasan por acá** — el correo a ella cuando algo no salió,
los dos correos a vos de un deploy fallido, el aviso de que alguien entró
con el enlace mágico, y el aviso de que `PANEL_GITHUB_TOKEN` está por
vencer— así que si NINGUNO está llegando, sospechá primero la
configuración del proveedor antes de revisar acción por acción.

**La única excepción es `enlace` (el enlace mágico de recuperación).** Ahí
el correo ES el producto: sin `RESEND_API_KEY`/`PANEL_REMITENTE`, pedirlo
contesta 503 («Ahora mismo no puedo mandarte el enlace. Escríbele a
Marcos.») en vez de fingir que se mandó — ver «El enlace mágico de
recuperación», arriba.

**Cómo verificar el dominio en el proveedor (Resend):**

1. resend.com → **Domains** → buscá `maracacao.mx` (agregalo si no está).
2. Copiá los registros DNS que te da (típicamente SPF y DKIM, a veces
   DMARC) y cargalos donde esté delegado el DNS del dominio.
3. La propagación tarda —de minutos a un día, según el proveedor de DNS—;
   el estado en Resend pasa de «Pending» a «Verified» solo, sin que haya
   que tocar nada más del lado del panel ni de Vercel.

**Mientras `maracacao.mx` no esté verificado, los avisos solo llegan a la
casilla del dueño de la cuenta en Resend** —la que usaste para crear la
cuenta—, nunca a la clienta ni a `PANEL_AVISOS_A` si es otra dirección. Es
la misma advertencia que ya está en la fila de `PANEL_REMITENTE` de la
tabla de variables, arriba: hasta que el dominio esté verde en Resend,
tratá cualquier «no le llegó nada» como sospechoso de esto primero, antes
de revisar el código o los logs. El panel de Resend (pestaña **Emails**)
muestra cada intento de envío, se haya entregado o no — es la forma más
rápida de confirmar si el correo salió de acá y se perdió en el camino, o
si nunca llegó a intentarse.

## Qué NO puede hacer el panel, aunque quisiera

Todo esto está frenado por diseño, en capas — no es que «no se nos ocurrió»
pedirle al panel que lo haga, es que cada candado existe a propósito:

- **No puede tocar workflows.** El PAT no tiene el permiso de GitHub
  (`Actions`) que hace falta para escribir en `.github/workflows/**` — así
  que aunque el código del panel intentara, GitHub lo rechazaría antes de
  que el commit exista. Y antes de siquiera llegar a GitHub, la lista
  blanca de `src/servidor/rutas-permitidas.ts` ya rechazó esa ruta: dos
  frenos independientes, no uno.
- **No puede tocar código, ni configuración, ni nada fuera de tres patrones
  exactos.** La lista blanca solo deja pasar `src/contenido/datos/*.json`
  (los tres documentos de contenido) y las imágenes bajo
  `public/sitio/marca/`, `public/sitio/envoltura/` y
  `public/sitio/etiqueta-*.webp`. `package.json`, `vercel.json`, cualquier
  archivo de `src/servidor/**`, cualquier `.ts` o `.astro`: todo eso está
  afuera. La comparación es letra por letra contra el patrón exacto —no
  hay «se parece», no hay mayúsculas que se cuelen, no hay `../` que
  escape del directorio.
- **No puede publicar más de 40 archivos ni más de 3.5 MB por pedido**
  (`TOPE_ARCHIVOS`, `TOPE_CUERPO` en `rutas-permitidas.ts`) — un límite
  para que un error (o alguien probando los bordes) no mande un lote
  gigante de una sola vez.
- **No puede forzar un push.** Cada commit se arma con `force: false`
  contra el `main` que el panel acaba de leer — si `main` se movió en el
  medio, el commit falla en vez de pisar lo que sea que haya cambiado.
- **No puede publicar sin declarar contra qué versión del sitio editó.**
  `publicar` exige `base` (el sha que el panel leyó al abrir el editor):
  sin ese campo, 400 antes de mirar el documento; si `base` quedó vieja Y
  lo que cambió en el medio toca alguno de los documentos que este lote
  escribe, 409 en vez de pisarlo en silencio (Tarea 2 de la fase 5 Parte
  B — ver también «Lo que todavía NO está cubierto», abajo, sobre lo que
  esto SÍ y NO resuelve).
- **No puede hacerse pasar por vos.** Cada commit lleva el autor `Panel
  Maracacao <panel@maracacao.mx>`, nunca tu nombre — para que el historial
  de Git siempre diga «esto lo publicó el panel», no «esto lo publicó
  Marcos», ni siquiera cuando el correo en el trailer `Panel-Autor:` sea el
  tuyo.
- **No puede saltarse la validación.** El mismo `validar()` que corre en el
  navegador vuelve a correr entero en el servidor, sobre el documento
  completo, antes de tocar GitHub — un documento roto no se publica aunque
  el navegador de quien lo mandó estuviera mintiendo.

## Lo que todavía NO está cubierto

**[Actualizado, fase 5 Parte B, Tarea 15]** La primera versión de esta
sección tenía un ítem que dejó de ser cierto y no se había corregido: decía
que dos personas editando el mismo documento a la vez podían pisarse SIN
que nadie se entere, y eso ya no es así del lado del servidor —lo cerró la
Tarea 2 de esta misma fase (`base` obligatoria + 409 de pisada, ver la
tabla de arriba, «Qué NO puede hacer el panel»)—. Lo que queda pendiente es
más angosto que lo que decía antes:

- **El servidor detecta la pisada, pero la PANTALLA que le explica el
  conflicto a ella («celular, ayer 11:04, 3 cambios» / «esta compu, hace 6
  días, 1 cambio», spec §4.3) es de la fase 6, no de esta.** Hoy, si
  publica con una `base` vieja que de verdad se pisa con algo, recibe un
  409 — correcto, no le sobreescribe nada a nadie en silencio —, pero el
  mensaje («Marcos cambió algo del sitio mientras editabas: vuelve a
  intentar la publicación») no le ofrece ningún camino para RESOLVER el
  conflicto ahí mismo (ver dos ítems, arriba, en «Qué NO puede hacer el
  panel», y el cierre de la Parte B al final de
  `docs/superpowers/plans/2026-09-17-panel-fase-5-parte-b.md` para el
  contrato completo que la fase 6 tiene que construir sobre esto).
  `borrador.leer` tiene la misma limitación a propósito: devuelve el
  borrador del servidor tal cual, sin decidir nada — la pantalla es quien
  compara y pregunta.
- **El freno de los cinco intentos vive en la memoria de una sola función
  en ejecución (E4), no en una base de datos compartida.** Las funciones
  serverless de Vercel son efímeras y pueden correr varias a la vez: alguien
  que dispare intentos contra varias instancias en simultáneo, o que
  simplemente tenga paciencia y espere a que Vercel recicle una instancia,
  se salta el freno sin mucho esfuerzo. No es la defensa principal —esa es
  tener una contraseña larga (E2)— sino el freno al intento casual y al
  script tonto. **[Actualizado, Ronda 1 de la Tarea 12]** Cada acción tiene
  su PROPIO presupuesto de cinco cada quince minutos —antes `entrar`,
  `salud`, `enlace` y `entrar-con-enlace` compartían uno solo por IP, y eso
  dejaba a la clienta sin poder usar la contraseña si había pedido el
  enlace de recuperación varias veces seguidas—; `publicar`, `estado`,
  `historial`, `deshacer` y `borrador.*` no tienen NINGÚN freno de intentos
  propio, porque ya exigen una sesión válida (E3) y no tiene sentido
  frenar algo que ya pasó ese candado. `scripts/humo-panel.sh` (el último
  paso) hoy gasta el freno de `entrar` específicamente: los dos logins de
  los pasos 2 y 3 ya usan dos de los cinco, y el script sigue sin asumir un
  número fijo (prueba hasta ocho veces y para en el primer 429) por las
  dudas de que alguna corrida anterior haya dejado algo pendiente en la
  misma ventana de quince minutos. Si algún día hace falta un freno de
  verdad, contra un atacante de verdad, hace falta un almacén compartido
  entre instancias (Redis, o algo así) — hoy no existe.
