#!/usr/bin/env bash
# Genera frontend/env.js en tiempo de build a partir de las variables de
# entorno del despliegue.
#
# Coralia clasifica con Gemma 4 corriendo LOCAL, en una Jetson. Un despliegue
# estático no lo alcanza salvo que se le pase la URL del túnel. Ese es el
# propósito de CORALIA_ENDPOINT.
#
#   En Vercel:  Project Settings -> Environment Variables
#               CORALIA_ENDPOINT = https://tu-tunel/clasificar
#
# Si la variable NO está definida, env.js deja el endpoint vacío a propósito y
# la app entra en modo vitrina, diciendo en pantalla que el modelo es local y
# que lo mostrado es una previsualización. Nunca se finge que hay un modelo.
set -euo pipefail

SALIDA="$(dirname "$0")/../frontend/env.js"

if [ -n "${CORALIA_ENDPOINT:-}" ]; then
  echo "==> CORALIA_ENDPOINT definida: la app usará el modelo remoto"
  cat > "$SALIDA" <<EOF
// Generado en el build. No editar a mano.
window.CORALIA_CONFIG = {
  endpoint: "${CORALIA_ENDPOINT}",
};
EOF
else
  echo "==> CORALIA_ENDPOINT no definida: la app arrancará en modo vitrina"
  cat > "$SALIDA" <<'EOF'
// Generado en el build. No editar a mano.
// Sin CORALIA_ENDPOINT: el endpoint queda vacío a propósito y la app entra en
// modo vitrina, explicando que el modelo corre local y esto es una vista previa.
window.CORALIA_CONFIG = {
  endpoint: "",
};
EOF
fi

cat "$SALIDA"
