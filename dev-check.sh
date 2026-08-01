#!/usr/bin/env bash
# Verificación del frontend: sirve la carpeta, comprueba que todos los assets
# respondan 200, y renderiza ambas páginas en Chromium headless capturando
# los errores de consola y un screenshot.
#
# Uso: ./dev-check.sh
set -uo pipefail

PUERTO=8842
RAIZ="$(cd "$(dirname "$0")" && pwd)/frontend"
# Chromium viene como snap y está confinado: no puede escribir en /tmp, solo
# dentro de $HOME. Por eso la salida no va al directorio temporal de siempre.
SALIDA="$HOME/.vibra-check"
mkdir -p "$SALIDA"

pkill -f "http.server $PUERTO" 2>/dev/null
sleep 1

cd "$RAIZ" || exit 1
setsid nohup python3 -m http.server "$PUERTO" --bind 127.0.0.1 \
  > "$SALIDA/servidor.log" 2>&1 < /dev/null &
sleep 2

echo "=== assets ==="
FALLOS=0
for ruta in / /app.html \
  /assets/css/tokens.css /assets/css/landing.css /assets/css/app.css \
  /assets/css/partitura.css \
  /assets/js/config.js /assets/js/patterns.js /assets/js/haptic-score.js \
  /assets/js/ascii-video.js /assets/js/api.js /assets/js/landing.js \
  /assets/js/app.js; do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PUERTO$ruta")
  printf "  %-34s %s\n" "$ruta" "$codigo"
  [ "$codigo" != "200" ] && FALLOS=$((FALLOS + 1))
done

echo
echo "=== render headless ==="
for pagina in index app; do
  # --screenshot y --dump-dom no conviven en la misma invocación: la segunda
  # gana y el PNG sale vacío. Van en dos pasadas.
  chromium --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --virtual-time-budget=6000 --window-size=1400,1000 \
    --screenshot="$SALIDA/$pagina.png" \
    "http://127.0.0.1:$PUERTO/$pagina.html" \
    > /dev/null 2> "$SALIDA/$pagina.stderr"

  chromium --headless --disable-gpu --no-sandbox \
    --virtual-time-budget=6000 --dump-dom \
    "http://127.0.0.1:$PUERTO/$pagina.html" \
    > "$SALIDA/$pagina.dom.html" 2>> "$SALIDA/$pagina.stderr"

  # Los errores de JS salen por stderr con nivel SEVERE/ERROR.
  errores=$(grep -icE 'SEVERE|Uncaught|ReferenceError|TypeError|SyntaxError' \
    "$SALIDA/$pagina.stderr" || true)
  peso=$(stat -c%s "$SALIDA/$pagina.png" 2>/dev/null || echo 0)
  printf "  %-12s errores_js=%s  screenshot=%s bytes\n" "$pagina" "$errores" "$peso"
  [ "$errores" -gt 0 ] && FALLOS=$((FALLOS + 1))
  [ "$peso" -lt 5000 ] && FALLOS=$((FALLOS + 1))
done

echo
echo "=== contenido renderizado ==="
# Comprobar que config.js realmente inyectó el nombre en el DOM.
for pagina in index app; do
  if grep -q "VibraContexto" "$SALIDA/$pagina.dom.html"; then
    echo "  $pagina: nombre inyectado OK"
  else
    echo "  $pagina: FALLA — el nombre no llegó al DOM"
    FALLOS=$((FALLOS + 1))
  fi
done
# La partitura y el hero se construyen por JS: si no están, algo reventó.
grep -q 'partitura__bloque' "$SALIDA/index.dom.html" \
  && echo "  index: partitura construida OK" \
  || { echo "  index: FALLA — no se construyó la partitura"; FALLOS=$((FALLOS + 1)); }

grep -q 'leyenda__item' "$SALIDA/app.dom.html" \
  && echo "  app: leyenda construida OK" \
  || { echo "  app: FALLA — no se construyó la leyenda"; FALLOS=$((FALLOS + 1)); }

echo
echo "=== flujo completo (app.html?demo=1) ==="
# El modo demo arranca solo y va disparando eventos simulados. Con tiempo
# virtual acelerado deberían acumularse varios en el historial.
chromium --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=20000 --dump-dom \
  "http://127.0.0.1:$PUERTO/app.html?demo=1" \
  > "$SALIDA/demo.dom.html" 2> "$SALIDA/demo.stderr"

EVENTOS=$(grep -oc 'class="fila"' "$SALIDA/demo.dom.html" || true)
echo "  eventos en el historial: $EVENTOS"
if [ "${EVENTOS:-0}" -lt 2 ]; then
  echo "  FALLA — el ciclo de clasificación no produjo eventos"
  FALLOS=$((FALLOS + 1))
fi

grep -q 'data-vacio="false"' "$SALIDA/demo.dom.html" \
  && echo "  tarjeta de evento activa OK" \
  || { echo "  FALLA — la tarjeta de evento nunca se llenó"; FALLOS=$((FALLOS + 1)); }

grep -q 'data-activo="true"' "$SALIDA/demo.dom.html" \
  && echo "  leyenda resalta la categoría OK" \
  || { echo "  FALLA — la leyenda no resaltó nada"; FALLOS=$((FALLOS + 1)); }

chromium --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --virtual-time-budget=9000 --window-size=1400,1000 \
  --screenshot="$SALIDA/demo.png" \
  "http://127.0.0.1:$PUERTO/app.html?demo=1" > /dev/null 2>&1

echo
if [ "$FALLOS" -eq 0 ]; then
  echo "TODO BIEN — screenshots en $SALIDA/"
else
  echo "$FALLOS PROBLEMA(S). Revisa $SALIDA/*.stderr"
fi
exit "$FALLOS"
