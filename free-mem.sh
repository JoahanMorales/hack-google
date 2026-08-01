#!/usr/bin/env bash
# Libera la RAM de la Jetson para correr Gemma 4 y deja los cambios
# persistentes a reboots. Uso:  sudo ./free-mem.sh
#
# Para revertir todo despues del hackathon:  sudo ./free-mem.sh --revert
set -uo pipefail

SERVICIOS="shanalotte-backend axolutions-backend cloudflared-axolutions anydesk rustdesk gdm"

if [ "${1:-}" = "--revert" ]; then
  echo "==> Restaurando estado normal ..."
  systemctl set-default graphical.target
  systemctl enable --now $SERVICIOS
  docker start shanalotte-qdrant-1 2>/dev/null || true
  echo "Listo. Reinicia para recuperar el escritorio."
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Corre esto con sudo: sudo $0" >&2
  exit 1
fi

echo "==> Deteniendo y deshabilitando servicios (sobrevive a reboots) ..."
# disable --now = stop + no arrancan al bootear. gdm es 'static', se maneja
# con el default target de abajo.
systemctl disable --now $SERVICIOS 2>&1 | grep -viE '^removed|^created' || true

echo "==> Arranque sin escritorio ..."
systemctl set-default multi-user.target

echo "==> Deteniendo Qdrant ..."
docker stop shanalotte-qdrant-1 2>/dev/null || true

echo "==> Maximo rendimiento ..."
nvpmodel -m 2 2>/dev/null || true   # MAXN_SUPER
jetson_clocks 2>/dev/null || true

# cudaMalloc en Jetson NO fuerza el reclaim del page cache: necesita memoria
# realmente libre, no solo "available". Por eso hay que tirar la cache justo
# antes de cargar el modelo.
echo "==> Limpiando page cache ..."
sync
sysctl -w vm.drop_caches=3 > /dev/null

echo
free -h
echo
echo "Ahora carga el modelo YA, antes de que la cache se vuelva a llenar:"
echo "  ./serve-gemma.sh"
