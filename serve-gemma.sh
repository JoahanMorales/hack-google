#!/usr/bin/env bash
# Expone el Ollama local (Gemma 4) al equipo en https://api.axolutions.dev
# reusando el tunel nombrado 'axolutions' y su registro DNS ya existente.
#
# Uso: ./serve-gemma.sh [modelo]   — por defecto gemma4:e2b-it-qat
#
# Para devolver api.axolutions.dev a produccion:
#   pkill -f 'config-gemma.yml'
#   sudo systemctl enable --now cloudflared-axolutions axolutions-backend
set -uo pipefail

MODEL="${1:-gemma4:e2b-it-qat}"
CONFIG=/home/joahan/.cloudflared/config-gemma.yml
LOG=/tmp/gemma-tunnel.log
HOSTNAME_PUB=https://api.axolutions.dev

# Precarga el modelo y lo deja fijo en memoria (keep_alive -1) para que el
# primer request del equipo no pague los ~30s de carga desde disco.
echo "==> Precargando $MODEL ..."
RESP=$(curl -s -m 300 http://127.0.0.1:11434/api/generate \
  -d "{\"model\":\"$MODEL\",\"keep_alive\":-1}")

if echo "$RESP" | grep -q '"error"'; then
  echo "!! No cargo el modelo:" >&2
  echo "$RESP" >&2
  if echo "$RESP" | grep -qi 'out of memory'; then
    echo >&2
    echo "   Se quedo sin RAM. Corre 'sudo ./free-mem.sh' y reintenta de inmediato." >&2
    echo "   Recuerda: gemma4:e4b-it-qat NO cabe en 8 GB unificados, usa e2b-it-qat." >&2
  fi
  exit 1
fi
ollama ps

# Los quick tunnels (trycloudflare.com) no enrutan desde esta red: registran un
# solo conector y el edge responde 404. Por eso usamos el tunel nombrado.
echo "==> Levantando túnel ..."
pkill -f 'cloudflared tunnel --url' 2>/dev/null
pkill -f 'config-gemma.yml' 2>/dev/null
sleep 3

setsid nohup cloudflared --config "$CONFIG" tunnel run \
  > "$LOG" 2>&1 < /dev/null &

# Esperar a los conectores, no solo a que el proceso arranque: el edge responde
# 404 hasta que el tunel termina de registrarse.
for _ in $(seq 1 40); do
  CONNS=$(grep -ac 'Registered tunnel connection' "$LOG" 2>/dev/null)
  [ "${CONNS:-0}" -ge 2 ] && break
  sleep 2
done
echo "    conectores registrados: ${CONNS:-0}"

echo "==> Verificando de punta a punta ..."
sleep 3
CODE=$(curl -s -m 120 -o /tmp/gemma-check.json -w '%{http_code}' \
  "$HOSTNAME_PUB/api/generate" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"Responde solo: OK\",\"stream\":false}")

if [ "$CODE" != "200" ]; then
  echo "!! El tunel respondio HTTP $CODE. Revisa $LOG" >&2
  tail -5 "$LOG" >&2
  exit 1
fi

cat <<EOF

  ✓ Verificado (HTTP 200, respuesta real del modelo)

  URL para el equipo:  $HOSTNAME_PUB
  Modelo:              $MODEL

  Base URL OpenAI:     $HOSTNAME_PUB/v1
  API key:             cualquier string (ollama la ignora)

  Prueba:
    curl $HOSTNAME_PUB/api/generate -d '{"model":"$MODEL","prompt":"hola","stream":false}'

EOF
