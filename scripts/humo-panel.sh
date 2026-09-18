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
# El freno de intentos (paso 6) va AL FINAL, después de publicar y
# restaurar, no antes: el freno no depende de nada de lo que hace
# `publicar`, así que el orden es libre, y probarlo primero significaba
# dispararlo y quedarte mirando una terminal quince minutos antes de que
# pasara algo interesante. Un ensayo de veinticinco minutos con una espera
# muerta en el medio es un ensayo que nadie repite — y un ensayo que nadie
# repite deja de ser un ensayo (RULING T7-b).
#
# Lo corrés vos, a mano, desde tu máquina:
#   scripts/humo-panel.sh tu-correo@ejemplo.com
# o sin argumento, y te lo pide:
#   scripts/humo-panel.sh
#
# Si una corrida anterior se cortó a mitad de camino y el sitio quedó con
# el texto de prueba puesto, no hace falta leer el script para arreglarlo:
# el mensaje de error de esa corrida ya te da el comando exacto, con esta
# forma:
#   scripts/humo-panel.sh --restaurar 'el texto original de footer.derechos' [correo]
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

# Estas dos se inicializan ACÁ, antes de que pueda pasar cualquier cosa que
# corte el script (falta una herramienta, falta el correo, lo que sea): la
# trampa de salida (`limpieza`, más abajo) las lee siempre, y con `set -u`
# leer una variable que todavía no existe corta el script con un error feo
# en vez del aviso claro que se supone que tiene que dar.
SITIO_MODIFICADO=0
DERECHOS_ORIGINAL=''
MODO_RESTAURAR=0

# ---------------------------------------------------------------------
# Funciones compartidas — se definen todas ANTES de usarlas en ningún
# lado de abajo (paso normal o modo `--restaurar`), así los dos caminos
# arman el pedido exactamente igual y un bug de forma de JSON no puede
# arreglarse en un camino y quedar roto en el otro.
# ---------------------------------------------------------------------

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

cuerpo_login() {
  # jq arma el JSON, no un printf a mano: si el correo o la clave traen
  # comillas o barras, escribir el JSON a mano manda un pedido roto sin que
  # se note por qué falló.
  jq -n --arg correo "$1" --arg clave "$2" --arg dispositivo "$3" \
    '{correo: $correo, clave: $clave, dispositivo: $dispositivo}'
}

cuerpo_publicar() {
  # $1 = ruta a un JSON con el documento «sitio» COMPLETO, ya modificado.
  # `publicar` exige el documento ENTERO, no un parche (acciones.ts,
  # `validarContra(DOCUMENTOS[id], documentos[id])` corre el esquema
  # entero contra lo que se manda) — mandar solo
  # `{"footer":{"derechos":"…"}}` rebota con «el campo quedó vacío» en
  # todos los demás campos.
  # $2 = el sha contra el que se "editó" (la Tarea 2 de la Parte B): sin
  # esto el servidor rebota con 400 antes de mirar el documento siquiera —
  # es la declaración de contra qué versión del sitio se escribió.
  jq -n --argjson sitio "$(cat "$1")" --arg base "$2" '{base: $base, documentos: {sitio: $sitio}}'
}

# Login con la contraseña REAL (la de `$CLAVE`), usado tanto en el paso 3
# del flujo normal como en el modo `--restaurar`. Guarda la cookie en
# `$COOKIES` con `-c`. Nunca imprime el valor de la cookie: solo confirma
# que llegó con las banderas que la protegen (E3).
hacer_login_real() {
  local etiqueta="$1" status
  status="$(curl -s -D "$TMPDIR_HUMO/headers-login.txt" -o "$TMPDIR_HUMO/resp-login.json" -w '%{http_code}' \
    -X POST "$BASE/api/panel?accion=entrar" \
    -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
    -c "$COOKIES" \
    -d "$(cuerpo_login "$CORREO" "$CLAVE" "$etiqueta")")"
  echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-login.json")"
  if [ "$status" != '200' ]; then
    echo "  esperado: 200 — obtuve: $status — MAL (contraseña real)" >&2
    return 1
  fi
  echo '  esperado: 200 — obtuve: 200 — bien (contraseña real)'

  if grep -qi '^set-cookie:.*panel_sesion=' "$TMPDIR_HUMO/headers-login.txt" \
    && grep -qi '^set-cookie:.*httponly' "$TMPDIR_HUMO/headers-login.txt" \
    && grep -qi '^set-cookie:.*secure' "$TMPDIR_HUMO/headers-login.txt" \
    && grep -qi '^set-cookie:.*samesite=lax' "$TMPDIR_HUMO/headers-login.txt"; then
    echo '  Set-Cookie: sí, con HttpOnly; Secure; SameSite=Lax (el valor no se imprime nunca)'
  else
    echo '  Set-Cookie: faltó, o le faltó alguna bandera de protección — MAL' >&2
    return 1
  fi
  if [ ! -s "$COOKIES" ]; then
    echo '  curl no guardó ninguna cookie en el archivo temporal — sin eso no puedo publicar.' >&2
    return 1
  fi
  return 0
}

# Publica un valor nuevo de `footer.derechos`, trayendo primero el
# `sitio.json` VIVO de GitHub —nunca el archivo local, que podría estar
# desactualizado si alguien publicó algo después del último `git pull`— y
# cambiándole ese único campo. Deja `SHA_PUBLICADO` seteado si salió bien.
# La usan el paso 4 (publicar la prueba), el paso 5 (restaurar) y el modo
# `--restaurar`: un solo lugar que arma el pedido es un solo lugar donde
# puede haber un bug, no tres.
publica_derechos() {
  local valor="$1"
  git fetch origin main --quiet
  if ! git show origin/main:src/contenido/datos/sitio.json > "$TMPDIR_HUMO/vivo-pub.json" 2>/dev/null; then
    echo '  no pude leer src/contenido/datos/sitio.json de origin/main — revisá la conexión' \
      'o si el archivo sigue existiendo con ese nombre.' >&2
    return 1
  fi
  jq --arg v "$valor" '.footer.derechos = $v' "$TMPDIR_HUMO/vivo-pub.json" > "$TMPDIR_HUMO/doc-pub.json"

  # El sha contra el que se "editó": para el ensayo es, sencillamente, la
  # cabeza de main en este momento —la misma que se acaba de leer arriba con
  # `git show origin/main:...`—, así que el servidor no encuentra nada que
  # haya cambiado en el medio y deja pasar la publicación. El panel de la
  # fase 6 va a mandar el sha que leyó al ABRIR el editor, que es la misma
  # idea con más tiempo (y más chance de que algo haya cambiado) en el medio.
  # Nombrada `SHA_BASE_PUBLICACION` y no `BASE`: `$BASE` ya es la URL del
  # sitio (línea de arriba de todo el script) — una `local BASE` acá adentro
  # la taparía para el resto de esta función y rompería el `curl` de abajo.
  local SHA_BASE_PUBLICACION
  SHA_BASE_PUBLICACION="$(git rev-parse origin/main)"

  local status
  status="$(curl -s -b "$COOKIES" -o "$TMPDIR_HUMO/resp-pub.json" -w '%{http_code}' \
    -X POST "$BASE/api/panel?accion=publicar" \
    -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
    -d "$(cuerpo_publicar "$TMPDIR_HUMO/doc-pub.json" "$SHA_BASE_PUBLICACION")")"
  echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-pub.json")"
  if [ "$status" != '200' ]; then
    echo "  esperado: 200 — obtuve: $status — MAL" >&2
    return 1
  fi
  if ! grep -q '"ok":true' "$TMPDIR_HUMO/resp-pub.json"; then
    echo '  status 200 pero ok no es true.' >&2
    return 1
  fi
  SHA_PUBLICADO="$(jq -r '.sha' "$TMPDIR_HUMO/resp-pub.json")"
  if [ -z "$SHA_PUBLICADO" ] || [ "$SHA_PUBLICADO" = 'null' ]; then
    echo '  ok:true pero sha vino null — según acciones.ts eso significa «no había nada' \
      'que publicar», y acá se esperaba un cambio real.' >&2
    return 1
  fi
  echo "  sha del commit: $SHA_PUBLICADO"
  return 0
}

# Sondea la portada cada 10 segundos (hasta 6 minutos) en vez de dormir un
# tiempo fijo: así este chequeo ni se queda corto un día que Vercel tarda
# más, ni espera de más un día que anda rápido. `$1` = texto que tiene que
# aparecer; `$2` (opcional) = texto que YA NO tiene que estar (para
# confirmar que la marca de prueba se fue de verdad, no solo que el texto
# original volvió a aparecer en OTRO lado de la página).
espera_en_vivo() {
  local debe="$1" nodebe="${2:-}" intento cuerpo
  for intento in $(seq 1 36); do
    cuerpo="$(curl -s "$BASE/")"
    if printf '%s' "$cuerpo" | grep -qF -- "$debe"; then
      if [ -z "$nodebe" ] || ! printf '%s' "$cuerpo" | grep -qF -- "$nodebe"; then
        echo "  apareció en vivo (intento $intento de 36, ~$((intento * 10))s)"
        return 0
      fi
    fi
    sleep 10
  done
  return 1
}

# ---------------------------------------------------------------------
# Argumentos y credenciales.
# ---------------------------------------------------------------------

if [ "${1:-}" = '--restaurar' ]; then
  MODO_RESTAURAR=1
  VALOR_RESTAURAR="${2:-}"
  CORREO="${3:-}"
  if [ -z "$VALOR_RESTAURAR" ]; then
    echo "Uso: $0 --restaurar 'el texto original de footer.derechos' [correo]" >&2
    exit 1
  fi
else
  CORREO="${1:-}"
fi

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
COOKIES="$TMPDIR_HUMO/cookies.txt"

limpieza() {
  local salida=$?
  unset CLAVE
  # El caso peligroso no es que el script falle — es que falle DESPUÉS de
  # publicar el cambio de prueba y ANTES de restaurar el original: ahí el
  # sitio queda modificado de verdad y quien lo lea se encuentra con un
  # stack trace en vez de con el comando que lo arregla. `SITIO_MODIFICADO`
  # marca exactamente esa ventana (se prende después de publicar el
  # cambio, se apaga después de publicar la vuelta) — así que si seguía
  # prendida al salir, esto lo dice fuerte, con el comando exacto para
  # arreglarlo, en vez de dejarlo para que alguien lo adivine.
  if [ "$MODO_RESTAURAR" -eq 0 ] && [ "$SITIO_MODIFICADO" -eq 1 ]; then
    printf '\n'
    printf '#####################################################################\n'
    printf '###   OJO: EL SITIO QUEDO CON EL TEXTO DE PRUEBA, SIN RESTAURAR   ###\n'
    printf '#####################################################################\n'
    printf 'footer.derechos en vivo (o a punto de estarlo) tiene el texto de prueba\n'
    printf 'de esta corrida, no el original. Para dejarlo como estaba, corré:\n\n'
    # `%q` y no comillas a mano: el día que footer.derechos tenga un
    # apóstrofo —«Hecho a mano en México, como se hacía»— el comando que le
    # decimos que pegue se rompería justo cuando más lo necesita.
    printf '  %s --restaurar %s\n\n' "$(printf '%q' "$0")" "$(printf '%q' "$DERECHOS_ORIGINAL")"
    printf 'Eso entra con tu contraseña y publica el valor de arriba por el mismo\n'
    printf 'canal que usa la clienta — nunca hace falta `git revert` a mano.\n'
    printf '#####################################################################\n'
  fi
  rm -rf "$TMPDIR_HUMO"
  exit "$salida"
}
trap limpieza EXIT

# ---------------------------------------------------------------------
# Modo `--restaurar`: rescate directo, sin salud, sin logins de prueba,
# sin freno. Es lo que el mensaje de arriba te manda a correr si una
# corrida normal se cortó con el sitio a mitad de camino.
# ---------------------------------------------------------------------

if [ "$MODO_RESTAURAR" -eq 1 ]; then
  paso "Modo restaurar: publicando \"$VALOR_RESTAURAR\" en footer.derechos"
  if ! hacer_login_real 'humo-panel.sh --restaurar'; then
    echo "Corto en «$PASO_ACTUAL»: no pude entrar. Revisá la contraseña, o entrá al panel" \
      'a mano y publicá el valor ahí.' >&2
    exit 1
  fi
  if ! publica_derechos "$VALOR_RESTAURAR"; then
    echo "Corto en «$PASO_ACTUAL»: la publicación de rescate falló. El sitio puede seguir" \
      'con el texto de prueba — reintentá este mismo comando, o entrá al panel a mano.' >&2
    exit 1
  fi
  echo '  esperando el deploy...'
  if ! espera_en_vivo "$VALOR_RESTAURAR"; then
    echo "Corto en «$PASO_ACTUAL»: el commit de rescate ya está en GitHub (sha de arriba)," \
      'pero pasaron 6 minutos y todavía no se ve en vivo. Revisá Deployments en Vercel a' \
      'mano — el dato ya está bien, es el deploy que tarda.' >&2
    exit 1
  fi
  echo
  echo '=== Restaurado y confirmado en vivo. ==='
  exit 0
fi

# ---------------------------------------------------------------------
# Flujo normal (RULING T7-b: salud → login malo → login bueno → publicar
# y restaurar → freno AL FINAL, sin espera de 16 minutos en el medio).
# ---------------------------------------------------------------------

# 1) Salud — ¿están las seis variables, y responde GitHub?
# Sin sesión (E8: `salud` es la única acción que no la pide). Desde la
# Ronda 1 de la Tarea 12, cada acción tiene su PROPIO freno de intentos
# (src/servidor/sesion.ts, `intentoPermitido`, con clave `<acción>:<ip>`) —
# antes `salud` y `entrar` compartían un único contador por IP, y este
# pedido gastaba un lugar del presupuesto que el paso 6 iba a necesitar.
# Ya no: este pedido a `salud` no le toca nada al de `entrar`. El paso 6
# sigue sin asumir un número fijo de todos modos (prueba hasta ocho veces),
# por si una corrida anterior dejó algo pendiente en la misma ventana.

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

# 2) Entrar con la contraseña equivocada, una vez — tiene que dar 401.
# Prueba que el rechazo funciona ANTES de tocar nada más. Si esto no da
# 401 (por ejemplo 429, porque el freno ya venía gastado de una corrida en
# los últimos quince minutos), es más honesto cortar acá y decirlo que
# seguir adelante con un freno a mitad de camino.

paso '2) Entrar con contraseña equivocada (una vez) — esperado: 401'
status2="$(curl -s -o "$TMPDIR_HUMO/resp-2.json" -w '%{http_code}' -X POST "$BASE/api/panel?accion=entrar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -d "$(cuerpo_login "$CORREO" 'esta-no-es-la-clave-de-nadie' 'humo-panel.sh')")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-2.json")"
espera_status 401 "$status2" 'clave mal a propósito, una sola vez'

# 3) Entrar con la contraseña de verdad — 200 y un Set-Cookie con las
# banderas correctas. Nunca se imprime el valor de la cookie: eso ES la
# sesión (E3).

paso '3) Entrar con la contraseña real — esperado: 200 y Set-Cookie'
if ! hacer_login_real 'humo-panel.sh'; then
  echo "Corto en «$PASO_ACTUAL»: sin login real no hay sesión para publicar nada." >&2
  exit 1
fi

# 4) Publicar UN cambio chico, visible y fácil de revertir; mostrar el
# commit; esperar el deploy; confirmar que se ve en vivo.
#
# El campo es `footer.derechos`: texto libre, sin banda de espacio duro que
# cuidar, tope de 90 caracteres (src/contenido/esquema/sitio/paginas.ts), y
# se ve en la última línea del pie de página de TODO el sitio — visible,
# cosmético, y a nadie se le rompe nada si por un rato dice una palabra de
# más.
#
# Acá arranca la ventana peligrosa: desde que este `publicar` sale bien
# hasta que el del paso 5 también sale bien, el sitio en vivo (o a punto de
# estarlo) tiene el texto de prueba puesto. `SITIO_MODIFICADO=1` marca esa
# ventana para la trampa de salida de arriba.

paso '4a) Publicar el cambio de prueba en footer.derechos'
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

if ! publica_derechos "$DERECHOS_NUEVO"; then
  echo "Corto en «$PASO_ACTUAL»: no se pudo publicar el cambio de prueba." >&2
  exit 1
fi
SITIO_MODIFICADO=1  # a partir de acá, si algo corta, la trampa de salida avisa fuerte.

# 4c) El freno de mano de esta tarea (Tarea 2 de la Parte B — el sha base):
# si el sha contra el que se declara haber editado no es la cabeza de main
# de verdad —acá, a propósito, uno que nunca existió—, el servidor tiene
# que negarse a publicar, no pisar en silencio lo que haya cambiado en el
# medio. Reusa el mismo documento que acaba de publicarse en 4a: lo que se
# prueba acá es el chequeo de la base, no el contenido. Probado contra
# producción: si algún día alguien saca este chequeo, este paso lo delata.

paso '4c) Publicar con una base vieja tiene que rebotar con 409'
status4c="$(curl -s -b "$COOKIES" -o "$TMPDIR_HUMO/resp-base-vieja.json" -w '%{http_code}' \
  -X POST "$BASE/api/panel?accion=publicar" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
  -d "$(cuerpo_publicar "$TMPDIR_HUMO/doc-pub.json" '0000000000000000000000000000000000000000')")"
echo "  respuesta: $(cat "$TMPDIR_HUMO/resp-base-vieja.json")"
espera_status 409 "$status4c" 'base vieja: alguien "cambió el sitio en el medio", tiene que rebotar'

paso '4d) El commit que publicó el cambio — autor y trailers'
git fetch origin main --quiet
git log origin/main -1 --format='%an <%ae>%n%s%n%n%b'

AUTOR_COMMIT="$(git log origin/main -1 --format='%an <%ae>')"
if [ "$AUTOR_COMMIT" != 'Panel Maracacao <panel@maracacao.mx>' ]; then
  echo "Corto en «$PASO_ACTUAL»: el autor del último commit en origin/main es" \
    "«$AUTOR_COMMIT», no «Panel Maracacao <panel@maracacao.mx>». Este commit no lo hizo" \
    'el panel — no sigas hasta entender qué pasó.' >&2
  exit 1
fi
if ! git log origin/main -1 --format='%b' | grep -q "Panel-Autor: $CORREO"; then
  echo "Corto en «$PASO_ACTUAL»: el commit no trae el trailer «Panel-Autor: $CORREO» (E5)." >&2
  exit 1
fi
echo '  autor y trailers correctos.'

paso '4e) Esperar el deploy y verificar que la portada muestra el texto nuevo'
if ! espera_en_vivo "$DERECHOS_NUEVO"; then
  echo "Corto en «$PASO_ACTUAL»: pasaron 6 minutos y la portada todavía no muestra el texto" \
    'nuevo. El commit YA está en GitHub (paso 4d), así que lo peor que pasó es que el' \
    'deploy tarda — revisá Deployments en Vercel a mano antes de asumir algo peor.' >&2
  exit 1
fi

# 5) Dejar el sitio como estaba — publicando el valor ORIGINAL por el
# MISMO canal. Nunca con `git revert` desde la computadora: la vuelta
# tiene que probar el mismo camino que la clienta usa de verdad, si no
# esta prueba no prueba nada sobre lo que le importa (que ELLA pueda
# deshacer un cambio, no que vos puedas arreglarlo con Git).

paso '5a) Publicar el valor original (revertir por el mismo canal)'
if ! publica_derechos "$DERECHOS_ORIGINAL"; then
  echo "Corto en «$PASO_ACTUAL»: LA RESTAURACIÓN FALLÓ — el sitio sigue con el texto de" \
    'prueba. Reintentá este script (o entrá al panel a mano); el mensaje final de esta' \
    'corrida también te va a dejar el comando exacto para arreglarlo.' >&2
  exit 1
fi
SITIO_MODIFICADO=0  # la publicación de vuelta ya salió — se cierra la ventana peligrosa.

paso '5b) El commit de la reversión'
git fetch origin main --quiet
git log origin/main -1 --format='%an <%ae>%n%s%n%n%b'

paso '5c) Esperar el segundo deploy y verificar que la portada volvió al texto original'
if ! espera_en_vivo "$DERECHOS_ORIGINAL" "$MARCA_DE_HUMO"; then
  echo "Corto en «$PASO_ACTUAL»: pasaron 6 minutos y la portada TODAVÍA muestra el texto de" \
    'prueba (o algo raro). El commit de reversión ya está en GitHub (paso 5b) — el dato ya' \
    'está bien, andá a Deployments en Vercel y mirá el deploy a mano.' >&2
  exit 1
fi

# 6) El freno de intentos, al final — sin dependencia de lo de arriba, así
# que no hace falta probarlo antes de lo que sí importa mirar en vivo
# (RULING T7-b). Se manda contraseña mala hasta que UNA conteste 429, con
# margen (hasta 8 intentos) en vez de asumir que va a ser exactamente la
# sexta: los dos logins de los pasos 2 y 3 (acción `entrar`) ya gastaron
# dos de los 5 cada 15 minutos de SU PROPIO presupuesto — desde la Ronda 1
# de la Tarea 12 cada acción tiene el suyo (`<acción>:<ip>`,
# `intentoPermitido`, sesion.ts), así que `salud` (paso 1) ya no cuenta
# acá. El margen es por si una corrida anterior en la misma ventana de 15
# minutos dejó algo pendiente, no porque el número sea impredecible hoy.

paso '6) El freno de intentos: mandar contraseñas malas hasta que una dé 429'
TOPE_INTENTOS_FRENO=8
freno_saltado=0
intentos_hechos=0
for i in $(seq 1 "$TOPE_INTENTOS_FRENO"); do
  intentos_hechos=$i
  status_freno="$(curl -s -o "$TMPDIR_HUMO/resp-freno-$i.json" -w '%{http_code}' -X POST "$BASE/api/panel?accion=entrar" \
    -H 'Content-Type: application/json' -H "Origin: $ORIGEN" \
    -d "$(cuerpo_login "$CORREO" "esto-tampoco-es-la-clave-$i" 'humo-panel.sh')")"
  echo "  intento $i: status $status_freno"
  if [ "$status_freno" = '429' ]; then
    freno_saltado=1
    break
  fi
done

if [ "$freno_saltado" -ne 1 ]; then
  echo "Corto en «$PASO_ACTUAL»: mandé $intentos_hechos contraseñas malas seguidas y el freno" \
    'nunca contestó 429. Con TOPE_INTENTOS=5 en sesion.ts, y dos lugares ya gastados por los' \
    'logins de los pasos 2 y 3 (mismo presupuesto de `entrar`), tendría que haber saltado en' \
    'el intento 4 de esta tanda. O el freno no está funcionando, o cada pedido cayó en una' \
    'instancia serverless distinta con su propia memoria (E4: el freno vive en memoria de' \
    'proceso, no en un almacén compartido) — cualquiera de las dos vale la pena mirarla, no' \
    'es un simple «reintentá».' >&2
  exit 1
fi
echo "  el freno saltó en el intento $intentos_hechos de esta tanda: los dos logins de los" \
  'pasos 2 y 3 ya habían gastado dos de los 5 cada 15 minutos del presupuesto de `entrar`' \
  '(cada acción tiene el suyo desde la Ronda 1 de la Tarea 12), así que el margen es por si' \
  'una corrida anterior en la misma ventana dejó algo pendiente, no porque el número sea' \
  'impredecible hoy.'

echo
echo '=== Prueba de humo completa ==='
echo 'Un resultado en verde acá prueba cinco cosas, cada una por su cuenta:'
echo '  1. La puerta funciona: la contraseña equivocada no entra (paso 2), y la correcta sí (paso 3).'
echo '  2. Un cambio de la clienta llega de verdad al sitio en vivo, no solo a GitHub (paso 4).'
echo '  3. Publicar contra una base vieja se rechaza, sin pisar en silencio lo que cambió en el medio (paso 4c).'
echo '  4. Cada commit queda a nombre del panel («Panel Maracacao»), nunca al tuyo (paso 4d).'
echo '  5. Deshacer un cambio funciona por el mismo canal que publicarlo, sin Git ni computadora (paso 5).'
echo
echo 'IMPORTANTE: el freno de `entrar` (paso 6) quedó gastado para esta IP durante los' \
  'próximos 15 minutos — a propósito, es la prueba que hicimos recién. Si corrés' \
  '`entrar` de nuevo antes de que se vacíe la ventana, vas a ver 429: es exactamente lo' \
  'que tiene que pasar, no es que algo se rompió. `salud` tiene su PROPIO freno (cada' \
  'acción tiene el suyo desde la Ronda 1 de la Tarea 12) y sigue con margen — no hace' \
  'falta esperar para volver a correr este mismo script.'
