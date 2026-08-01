#!/usr/bin/env bash
# Levanta la demo completa: backend + frontend + tunel publico.
#
#   ./arrancar-demo.sh
#
# Deja todo en https://api.axolutions.dev
#   /            la app (frontend + POST /clasificar)
#   /v1/...      Gemma crudo, compatible con OpenAI, para el resto del equipo
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
VENV="$RAIZ/.venv"
PUERTO=5000
HOSTNAME_PUB=https://api.axolutions.dev
CONFIG_TUNEL=/home/joahan/.cloudflared/config-gemma.yml

# ── Dependencias ─────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "==> Creando entorno virtual ..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$RAIZ/requirements.txt"
fi

if [ ! -f "$RAIZ/.env" ]; then
  echo "==> Falta .env. Créalo con:"
  echo "      cp .env.example .env"
  echo "    y pon GEMMA_BASE_URL=http://127.0.0.1:11434/v1"
  exit 1
fi

# ── Modelo cargado y fijo en memoria ─────────────────────────────────────────
MODELO=$(grep -E '^GEMMA_MODEL=' "$RAIZ/.env" | cut -d= -f2)
MODELO=${MODELO:-gemma4:e2b-it-qat}
echo "==> Precargando $MODELO ..."
curl -s http://127.0.0.1:11434/api/generate \
  -d "{\"model\":\"$MODELO\",\"keep_alive\":-1}" > /dev/null
ollama ps

# ── Backend ──────────────────────────────────────────────────────────────────
echo "==> Backend en :$PUERTO ..."
# Flask en modo debug levanta dos procesos (reloader + worker), por eso se
# matan por puerto y no por nombre.
fuser -k "$PUERTO/tcp" 2>/dev/null
sleep 2
cd "$RAIZ" || exit 1
setsid nohup "$VENV/bin/python" "$RAIZ/app.py" > /tmp/vibra-backend.log 2>&1 < /dev/null &

for _ in $(seq 1 20); do
  curl -s -o /dev/null "http://127.0.0.1:$PUERTO/" && break
  sleep 1
done

# ── Tunel ────────────────────────────────────────────────────────────────────
echo "==> Túnel ..."
pkill -f 'config-gemma.yml' 2>/dev/null
sleep 3
setsid nohup cloudflared --config "$CONFIG_TUNEL" tunnel run \
  > /tmp/vibra-tunel.log 2>&1 < /dev/null &

for _ in $(seq 1 40); do
  CONNS=$(grep -ac 'Registered tunnel connection' /tmp/vibra-tunel.log 2>/dev/null)
  [ "${CONNS:-0}" -ge 2 ] && break
  sleep 2
done
echo "    conectores: ${CONNS:-0}"
sleep 3

# ── Verificación ─────────────────────────────────────────────────────────────
echo "==> Verificando ..."
APP=$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$HOSTNAME_PUB/")
GEM=$(curl -s -o /dev/null -m 60 -w '%{http_code}' "$HOSTNAME_PUB/v1/models")
SALUD=$(curl -s -m 60 "$HOSTNAME_PUB/salud")

cat <<EOF

  app       $HOSTNAME_PUB/         HTTP $APP
  gemma     $HOSTNAME_PUB/v1/      HTTP $GEM
  salud     $SALUD

  Para la demo: abran la app en un ANDROID (iOS no expone la API de vibración).
  Si el micrófono falla en el escenario: $HOSTNAME_PUB/app.html?demo=1

EOF
