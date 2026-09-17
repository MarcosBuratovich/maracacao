#!/usr/bin/env bash
#
# humo-panel.sh — la prueba de humo real del panel, contra producción.
#
# Esto es el ensayo del runbook (docs/panel-operacion.md), no un test de la
# suite: `pnpm test` corre contra código con datos de mentira, en la
# computadora, sin tocar nada de verdad. Esto pega contra
# https://www.maracacao.mx de verdad, con la contraseña de verdad, y
# publica un commit de verdad. El día que algo del panel deje de andar, este
# es el script al que hay que volver — por eso cada paso explica el PORQUÉ,
# no el QUÉ (el comando ya dice el qué).
#
# Lo corrés vos, a mano, desde tu máquina:
#   scripts/humo-panel.sh tu-correo@ejemplo.com
# o sin argumento, y te lo pide:
#   scripts/humo-panel.sh
#
# La contraseña NUNCA es un argumento: un argumento de shell queda en el
# historial (`history`) y en la lista de procesos (`ps aux`) mientras el
# comando corre, aunque sea por un instante. `read -rs` la lee del teclado
# sin mostrarla en pantalla y sin que bash la guarde en el historial de
# comandos (no es un comando, es una respuesta a un prompt).
#
# Nada de esto queda commiteado en el repo, y este archivo no tiene ninguna
# contraseña, cookie ni token adentro — ni de prueba: los junta en caliente,
# los usa, y los tira.

set -uo pipefail
# Sin `-e` a propósito: cada paso de este script tiene su propio chequeo de
# «¿esto salió como esperaba?» y decide por su cuenta si corta con `exit 1`.
# `curl` no falla (código de salida 0) ante un 401 o un 403 — esas son
# respuestas HTTP válidas, no errores de red — así que un `set -e` no nos
# protegería de nada acá; lo que nos protege es comparar el status a mano.

BASE='https://www.maracacao.mx'
ORIGEN='https://www.maracacao.mx'
# El endpoint rechaza con 403 cualquier POST sin un `Origin` de esta lista
# (src/servidor/origen.ts) — es la misma defensa que ya prueban
# `test/origen-servidor.test.ts` y `test/panel-entrada.test.ts`, y un curl
# pelado (sin `-H Origin`) la dispara. Por eso el Origin va en TODOS los
# POST de este script.

# ---------------------------------------------------------------------
# 0) Quién sos y con qué contraseña — nunca al repo, nunca al historial.
# ---------------------------------------------------------------------

CORREO="${1:-}"
if [ -z "$CORREO" ]; then
  read -rp 'Correo de la clienta (el que está en PANEL_CORREOS): ' CORREO
fi
if [ -z "$CORREO" ]; then
  echo 'Sin correo no hay nada que probar. Salgo.' >&2
  exit 1
fi

read -rsp 'Contraseña del panel (no se muestra, no queda en el historial): ' CLAVE
echo
if [ -z "$CLAVE" ]; then
  echo 'Sin contraseña no hay nada que probar. Salgo.' >&2
  exit 1
fi

for cmd in curl jq git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Falta «$cmd» en esta máquina — sin eso el script no puede seguir." >&2
    exit 1
  fi
done

# Un directorio temporal propio, que se borra solo al salir (falle o no
# falle el script) — ahí vive la cookie de sesión durante la corrida. La
# cookie ES la sesión (E3 del plan): tratarla como si fuera la contraseña
# misma es lo correcto, no una exageración.
TMPDIR_HUMO="$(mktemp -d)"
limpieza() {
  # `unset` no borra la memoria de un proceso que ya terminó, pero sí evita
  # que la variable siga viva el resto de la corrida si algo de acá abajo
  # falla a mitad de camino y el script sigue por otro lado.
  unset CLAVE
  rm -rf "$TMPDIR_HUMO"
}
trap limpieza EXIT

COOKIES="$TMPDIR_HUMO/cookies.txt"

PASO_ACTUAL=''
paso() {
  PASO_ACTUAL="$1"
  printf '\n=== %s ===\n' "$1"
}

# El corazón del script: compara lo que se esperaba contra lo que llegó, y
# si no matchea, corta ACÁ — nunca sigue con un supuesto que ya se probó
# falso. `$3` es una pista para quien lea el log, no el detalle técnico
# (ese va aparte, si hace falta).
espera_status() {
  local esperado="$1" obtenido="$2" pista="$3"
  if [ "$obtenido" = "$esperado" ]; then
    echo "  esperado: $esperado — obtuve: $obtenido — bien ($pista)"
    return 0
  fi
  echo "  esperado: $esperado — obtuve: $obtenido — MAL ($pista)" >&2
  echo "Corto en «$PASO_ACTUAL»: esto no dio lo que tenía que dar." >&2
  exit 1
}

# ---------------------------------------------------------------------
# 1) Salud — ¿están las seis variables, y responde GitHub?
# ---------------------------------------------------------------------
# Sin sesión (E8: `salud` es la única acción que no la pide), así que este
# paso no gasta ningún intento de login. OJO: si las variables están, este
# pedido SÍ gasta un lugar del freno de intentos de abajo (paso 3) — `salud`
# y `entrar` comparten el mismo contador por IP (src/servidor/sesion.ts,
# `intentoPermitido`). No es un bug de este script: es el sistema real, y
# por eso el freno se puede disparar un pedido antes de lo que uno cuenta a
# mano si alguien ya pegó contra `salud` en los últimos quince minutos.

paso '1) Salud'
salud_cuerpo="$(curl -s "$BASE/api/panel?accion=salud")"
echo "  respuesta: $salud_cuerpo"
if ! echo "$salud_cuerpo" | grep -q '"ok":true'; then
  echo 'salud no contestó ok:true — revisá qué variable falta en Vercel antes de seguir' \
    '(el nombre viene en "faltan"). No tiene sentido gastar los intentos del freno' \
    'en un login que va a fallar por otra razón.' >&2
  exit 1
fi
if ! echo "$salud_cuerpo" | grep -q '"github":true'; then
  echo 'Las variables están pero GitHub no contestó (o el freno ya estaba gastado). Mirá' \
    'la respuesta de arriba antes de seguir.' >&2
  exit 1
fi
echo '  variables completas, GitHub responde — sigo.'

# ---------------------------------------------------------------------
# 2) Entrar con la contraseña equivocada, una vez — tiene que dar 401.
# ---------------------------------------------------------------------
# Prueba que el rechazo funciona ANTES de probar que el freno funciona: si
# esto no da 401 (por ejemplo, porque el freno ya estaba gastado de una
# corrida anterior en los últimos quince minutos y da 429), es más honesto
# cortar acá y decirlo que seguir con un freno que ya estaba a mitad de
# camino antes de que este script empezara.

paso '2) Entrar con contraseña equivocada (una vez) — esperado: 401'
cuerpo_login() {
  # jq arma el JSON, no un printf a mano: si el correo o la clave traen
  # comillas o barras, escribir el JSON a mano manda un pedido roto sin que
  # se note por qué falló.
  jq -n --arg correo "$1" --arg clave "$2" --arg dispositivo "$3" \
    '{correo: $correo, clave: $clave, dispositivo: $dispositivo}'
}

status2="$(curl -s -o "$TMPDIR_HUMO/resp-2.json" -w '%{http_code}' -X POST "$BASE/api/panel?accion=entrar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -d "$(cuerpo_login "$CORREO" 'esta-no-es-la-clave-de-nadie' 'humo-panel.sh')")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-2.json")"
espera_status 401 "$status2" 'clave mal a propósito, una sola vez'

# ---------------------------------------------------------------------
# 3) Entrar con la contraseña equivocada, seis veces seguidas — el sexto
#    intento tiene que dar 429: es la prueba de que el freno de verdad
#    frena (E4).
# ---------------------------------------------------------------------
# El freno deja pasar 5 intentos por IP cada 15 minutos y frena del sexto
# en adelante (TOPE_INTENTOS = 5 en sesion.ts). Contando lo que ya gastaron
# los pasos 1 y 2 de este mismo script, es MUY probable que el freno salte
# antes del sexto intento de este bucle — y esta bien: lo único que este
# paso exige es que, para cuando termine el sexto, YA esté en 429. Si
# saltó antes, es el mismo freno funcionando más temprano, no una falla.

paso '3) Entrar con contraseña equivocada, seis veces seguidas — el sexto tiene que dar 429'
status_ultimo=''
for i in 1 2 3 4 5 6; do
  status_ultimo="$(curl -s -o "$TMPDIR_HUMO/resp-3-$i.json" -w '%{http_code}' -X POST "$BASE/api/panel?accion=entrar" \
    -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
    -d "$(cuerpo_login "$CORREO" "esta-tampoco-es-la-clave-$i" 'humo-panel.sh')")"
  echo "  intento $i: status $status_ultimo — $(cat "$TMPDIR_HUMO/resp-3-$i.json")"
done
espera_status 429 "$status_ultimo" 'sexto intento seguido con clave mal — el freno tiene que haber saltado'

# ---------------------------------------------------------------------
# 4) Esperar a que se vacíe la ventana del freno.
# ---------------------------------------------------------------------
# El freno cuenta por IP en los últimos 15 minutos (VENTANA_MS en
# sesion.ts). `entrar` lo chequea ANTES de mirar la contraseña — así que
# mientras la ventana no se vacíe, ni siquiera la contraseña CORRECTA del
# paso 5 va a pasar: va a chocar con el mismo 429. No hay forma de saltarse
# esta espera desde este script; 16 minutos (un minuto de margen sobre los
# 15 exactos) es la única salida honesta.

paso '4) Esperando que se vacíe la ventana de 15 minutos del freno'
echo '  esto es el freno funcionando, no un problema: mientras más espera, más' \
  'seguro es que la ventana está limpia para el login de verdad del paso 5.'
SEGUNDOS_ESPERA=$((16 * 60))
restantes=$SEGUNDOS_ESPERA
while [ "$restantes" -gt 0 ]; do
  printf '\r  faltan %d:%02d minutos ' $((restantes / 60)) $((restantes % 60))
  sleep 10
  restantes=$((restantes - 10))
done
printf '\r  listo, ya pasaron los 16 minutos.        \n'

# ---------------------------------------------------------------------
# 5) Entrar con la contraseña de verdad — 200 y un Set-Cookie con las
#    banderas correctas.
# ---------------------------------------------------------------------
# Nunca se imprime el valor de la cookie: eso ES la sesión (E3). Lo único
# que este paso verifica es que el header llegó y que trae las banderas que
# lo protegen — `-c "$COOKIES"` la guarda en el archivo temporal para los
# pasos siguientes, sin que este script la vea en texto en ningún momento.

paso '5) Entrar con la contraseña real — esperado: 200 y Set-Cookie'
status5="$(curl -s -D "$TMPDIR_HUMO/headers-5.txt" -o "$TMPDIR_HUMO/resp-5.json" -w '%{http_code}' \
  -X POST "$BASE/api/panel?accion=entrar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -c "$COOKIES" \
  -d "$(cuerpo_login "$CORREO" "$CLAVE" 'humo-panel.sh')")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-5.json")"
espera_status 200 "$status5" 'contraseña real'

if grep -qi '^set-cookie:.*panel_sesion=' "$TMPDIR_HUMO/headers-5.txt" \
  && grep -qi '^set-cookie:.*httponly' "$TMPDIR_HUMO/headers-5.txt" \
  && grep -qi '^set-cookie:.*secure' "$TMPDIR_HUMO/headers-5.txt" \
  && grep -qi '^set-cookie:.*samesite=lax' "$TMPDIR_HUMO/headers-5.txt"; then
  echo '  Set-Cookie: sí, con HttpOnly; Secure; SameSite=Lax (el valor no se imprime nunca)'
else
  echo '  Set-Cookie: faltó, o le faltó alguna bandera de protección — MAL' >&2
  echo "Corto en «$PASO_ACTUAL»: sin cookie completa no hay sesión para publicar." >&2
  exit 1
fi
if [ ! -s "$COOKIES" ]; then
  echo 'curl no guardó ninguna cookie en el archivo temporal — sin eso no puedo publicar.' >&2
  exit 1
fi

# ---------------------------------------------------------------------
# 6) Publicar UN cambio chico, visible y fácil de revertir.
# ---------------------------------------------------------------------
# `publicar` exige el documento COMPLETO, no un parche (acciones.ts,
# `validarContra(DOCUMENTOS[id], documentos[id])` corre el esquema entero
# contra lo que se manda — un objeto con un solo campo rebota con «el campo
# quedó vacío» en todos los demás). Por eso este paso trae el `sitio.json`
# VIVO de GitHub —vía `git fetch` + `git show origin/main:...`, el mismo
# contenido contra el que el servidor va a comparar— y le cambia un solo
# campo, en vez de mandar el archivo local (que podría estar desactualizado
# si alguien publicó algo después del último `git pull`).
#
# El campo es `footer.derechos`: texto libre, sin banda de espacio duro que
# cuidar, tope de 90 caracteres (src/contenido/esquema/sitio/paginas.ts), y
# se ve en la última línea del pie de página de TODO el sitio — visible,
# cosmético, y a nadie se le rompe nada si por un rato dice una palabra de
# más.

paso '6) Publicar el cambio de prueba en footer.derechos'
git fetch origin main --quiet
git show origin/main:src/contenido/datos/sitio.json > "$TMPDIR_HUMO/vivo.json"

DERECHOS_ORIGINAL="$(jq -r '.footer.derechos' "$TMPDIR_HUMO/vivo.json")"
if [ -z "$DERECHOS_ORIGINAL" ] || [ "$DERECHOS_ORIGINAL" = 'null' ]; then
  echo 'No encontré footer.derechos en el sitio.json vivo — el esquema cambió, hay que' \
    'elegir otro campo para esta prueba (ver docs/panel-operacion.md).' >&2
  exit 1
fi

MARCA_DE_HUMO=" · prueba de humo $(date -u +%H:%M) UTC"
DERECHOS_NUEVO="${DERECHOS_ORIGINAL}${MARCA_DE_HUMO}"
LARGO_NUEVO="$(jq -rn --arg s "$DERECHOS_NUEVO" '$s | length')"
# El largo se mide con jq, no con `${#var}` de bash: `${#var}` cuenta según
# la configuración regional de la terminal, que puede o no contar bien los
# caracteres de dos bytes (como la «·»); jq siempre cuenta puntos de código
# Unicode, sea cual sea el locale de quien corre esto.
if [ "$LARGO_NUEVO" -gt 90 ]; then
  echo "El texto original más la marca de prueba mide $LARGO_NUEVO caracteres — el esquema" \
    'permite hasta 90. Achicá MARCA_DE_HUMO en este script y volvé a correrlo.' >&2
  exit 1
fi

echo "  antes:  $DERECHOS_ORIGINAL"
echo "  nuevo:  $DERECHOS_NUEVO"

jq --arg v "$DERECHOS_NUEVO" '.footer.derechos = $v' "$TMPDIR_HUMO/vivo.json" > "$TMPDIR_HUMO/modificado.json"

cuerpo_publicar() {
  # $1 = ruta a un JSON con el documento «sitio» COMPLETO, ya modificado.
  jq -n --argjson sitio "$(cat "$1")" '{documentos: {sitio: $sitio}}'
}

status6="$(curl -s -b "$COOKIES" -o "$TMPDIR_HUMO/resp-6.json" -w '%{http_code}' \
  -X POST "$BASE/api/panel?accion=publicar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -d "$(cuerpo_publicar "$TMPDIR_HUMO/modificado.json")")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-6.json")"
espera_status 200 "$status6" 'publicar el cambio de prueba'

if ! grep -q '"ok":true' "$TMPDIR_HUMO/resp-6.json"; then
  echo "Corto en «$PASO_ACTUAL»: la respuesta fue 200 pero ok no es true." >&2
  exit 1
fi
SHA_PUBLICADO="$(jq -r '.sha' "$TMPDIR_HUMO/resp-6.json")"
if [ -z "$SHA_PUBLICADO" ] || [ "$SHA_PUBLICADO" = 'null' ]; then
  echo "Corto en «$PASO_ACTUAL»: publicó ok:true pero sha es null — según acciones.ts eso" \
    'significa «no había nada que publicar», y acá SÍ había un cambio. Algo no matchea' \
    '(¿el sitio.json vivo ya tenía la marca de una corrida anterior sin revertir?).' >&2
  exit 1
fi
echo "  sha del commit: $SHA_PUBLICADO"

# ---------------------------------------------------------------------
# 7) Mostrar el commit: el autor tiene que ser el panel, no vos.
# ---------------------------------------------------------------------
# Si esto dijera tu nombre de Git en vez de «Panel Maracacao», el commit no
# salió por la función serverless — salió de otro lado, y hay que
# desconfiar de todo lo demás que este script reportó como éxito.

paso '7) El commit que publicó el cambio — autor y trailers'
git fetch origin main --quiet
git log origin/main -1 --format='%an <%ae>%n%s%n%n%b'

AUTOR_COMMIT="$(git log origin/main -1 --format='%an <%ae>')"
if [ "$AUTOR_COMMIT" != 'Panel Maracacao <panel@maracacao.mx>' ]; then
  echo "Corto en «$PASO_ACTUAL»: el autor del último commit en origin/main es" \
    "«$AUTOR_COMMIT», no «Panel Maracacao <panel@maracacao.mx>». Este commit no lo hizo" \
    'el panel — no sigas con la verificación en vivo hasta entender qué pasó.' >&2
  exit 1
fi
if ! git log origin/main -1 --format='%b' | grep -q "Panel-Autor: $CORREO"; then
  echo "Corto en «$PASO_ACTUAL»: el commit no trae el trailer «Panel-Autor: $CORREO» (E5)." >&2
  exit 1
fi
echo '  autor y trailers correctos.'

# ---------------------------------------------------------------------
# 8) Esperar el deploy y comprobar que el sitio EN VIVO ya muestra el texto
#    nuevo — no alcanza con que GitHub tenga el commit.
# ---------------------------------------------------------------------
# El commit dispara un deploy en Vercel (integración de Git), pero el
# deploy tarda — no es instantáneo. Sondear la portada cada 10 segundos, en
# vez de dormir un tiempo fijo, es lo que hace que este paso ni se quede
# corto un día que Vercel tarda más, ni se quede esperando de más un día
# que anda rápido.

paso '8) Esperar el deploy y verificar que la portada muestra el texto nuevo'
DEPLOY_OK=0
for intento in $(seq 1 36); do  # 36 × 10s = 6 minutos de margen
  if curl -s "$BASE/" | grep -qF -- "$DERECHOS_NUEVO"; then
    echo "  apareció en vivo (intento $intento de 36, ~$((intento * 10))s)"
    DEPLOY_OK=1
    break
  fi
  sleep 10
done
if [ "$DEPLOY_OK" -ne 1 ]; then
  echo "Corto en «$PASO_ACTUAL»: pasaron 6 minutos y la portada todavía no muestra el texto" \
    'nuevo. Puede ser que el deploy esté tardando más de lo normal — revisá el panel de' \
    'Vercel (Deployments) a mano antes de asumir que algo se rompió. El commit YA está en' \
    'GitHub (paso 7), así que lo peor que pasó es que el deploy tarda, no que se perdió.' >&2
  exit 1
fi

# ---------------------------------------------------------------------
# 9) Dejar el sitio como estaba — publicando el valor ORIGINAL por el
#    MISMO canal. Nunca con `git revert` desde la computadora: la vuelta
#    tiene que probar el mismo camino que la clienta usa de verdad, si no
#    esta prueba no prueba nada sobre lo que le importa (que ELLA pueda
#    deshacer un cambio, no que vos puedas arreglarlo con Git).
# ---------------------------------------------------------------------

paso '9) Publicar el valor original (revertir por el mismo canal)'
git fetch origin main --quiet
git show origin/main:src/contenido/datos/sitio.json > "$TMPDIR_HUMO/vivo-2.json"
jq --arg v "$DERECHOS_ORIGINAL" '.footer.derechos = $v' "$TMPDIR_HUMO/vivo-2.json" > "$TMPDIR_HUMO/restaurado.json"

status9="$(curl -s -b "$COOKIES" -o "$TMPDIR_HUMO/resp-9.json" -w '%{http_code}' \
  -X POST "$BASE/api/panel?accion=publicar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -d "$(cuerpo_publicar "$TMPDIR_HUMO/restaurado.json")")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-9.json")"
espera_status 200 "$status9" 'restaurar el valor original'

if ! grep -q '"ok":true' "$TMPDIR_HUMO/resp-9.json"; then
  echo "Corto en «$PASO_ACTUAL»: la respuesta fue 200 pero ok no es true — EL SITIO QUEDÓ" \
    'CON EL TEXTO DE PRUEBA. Revisalo a mano en el panel o con otro publicar antes de' \
    'irte.' >&2
  exit 1
fi
SHA_RESTAURADO="$(jq -r '.sha' "$TMPDIR_HUMO/resp-9.json")"
if [ -z "$SHA_RESTAURADO" ] || [ "$SHA_RESTAURADO" = 'null' ]; then
  echo "Corto en «$PASO_ACTUAL»: sha vino null al restaurar — revisá a mano si el sitio ya" \
    'quedó como estaba o si sigue con el texto de prueba.' >&2
  exit 1
fi
echo "  sha del commit de reversión: $SHA_RESTAURADO"

paso '9b) El commit de la reversión'
git fetch origin main --quiet
git log origin/main -1 --format='%an <%ae>%n%s%n%n%b'

# ---------------------------------------------------------------------
# 10) Esperar el segundo deploy y confirmar que la portada volvió a la
#     normalidad — el script no termina «bien» hasta que esto pasa.
# ---------------------------------------------------------------------

paso '10) Esperar el segundo deploy y verificar que la portada volvió al texto original'
RESTAURADO_OK=0
for intento in $(seq 1 36); do
  cuerpo_home="$(curl -s "$BASE/")"
  if echo "$cuerpo_home" | grep -qF -- "$DERECHOS_ORIGINAL" && ! echo "$cuerpo_home" | grep -qF -- "$MARCA_DE_HUMO"; then
    echo "  la portada ya muestra el texto original de nuevo (intento $intento de 36)"
    RESTAURADO_OK=1
    break
  fi
  sleep 10
done
if [ "$RESTAURADO_OK" -ne 1 ]; then
  echo "Corto en «$PASO_ACTUAL»: pasaron 6 minutos y la portada TODAVÍA muestra el texto de" \
    'prueba (o algo raro). El commit de reversión ya está en GitHub (paso 9b) — andá al' \
    'panel de Vercel y mirá el deploy a mano; si tarda mucho más, revisá si hay algo' \
    'trabado ahí, no en el panel.' >&2
  exit 1
fi

echo
echo '=== Prueba de humo completa — los diez pasos dieron lo esperado ==='
echo '  el sitio quedó exactamente como estaba antes de empezar.'
