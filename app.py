"""Backend VibraContexto - Agente 2.

Expone POST /clasificar (contrato congelado, ver README raiz) y GET /salud.
Toda respuesta de /clasificar tiene la forma del contrato, tanto en exito
como en fallo, para que el frontend nunca reciba algo inesperado ni se
quede colgado esperando.
"""
import logging
import os
import threading

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

import gemma_client  # noqa: E402  (import despues de load_dotenv a proposito)
from validacion import AudioInvalido, respuesta_contrato, validar_audio_base64  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vibra.app")

# El backend sirve tambien el frontend del Agente 1. Asi todo queda en un solo
# origen: no hay CORS que resolver, el frontend usa la ruta relativa
# /clasificar, y basta apuntar el tunel a este puerto para que la demo entera
# quede publica con una sola URL.
_DIR_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

app = Flask(__name__, static_folder=_DIR_FRONTEND, static_url_path="")
CORS(app)


@app.route("/", methods=["GET"])
def portada():
    return app.send_static_file("index.html")


MAX_CONTENT_LENGTH = 8 * 1024 * 1024 + 16 * 1024  # audio + margen para el JSON envolvente
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

_MAX_CONCURRENTES = int(os.environ.get("GEMMA_MAX_CONCURRENTES", "2"))
_semaforo_gemma = threading.Semaphore(_MAX_CONCURRENTES)


def _con_estado(payload: dict, estado: str, codigo: int = 200):
    resp = jsonify(payload)
    resp.headers["X-Vibra-Estado"] = estado
    return resp, codigo


@app.errorhandler(413)
def _payload_muy_grande(_exc):
    payload = respuesta_contrato("ambiental", "baja", "", reasoning="audio excede el limite permitido")
    return _con_estado(payload, "degradado", 413)


@app.route("/salud", methods=["GET"])
def salud():
    return jsonify(gemma_client.probar_salud())


@app.route("/clasificar", methods=["POST"])
def clasificar():
    cuerpo = request.get_json(silent=True)
    if cuerpo is None:
        payload = respuesta_contrato("ambiental", "baja", "", reasoning="request sin JSON valido")
        return _con_estado(payload, "degradado", 400)

    try:
        validar_audio_base64(cuerpo.get("audio_base64", ""))
    except AudioInvalido as exc:
        payload = respuesta_contrato("ambiental", "baja", "", reasoning=str(exc))
        return _con_estado(payload, "degradado", 400)

    mime = cuerpo.get("mime_type", "audio/webm")

    # Guard de concurrencia: el dispositivo de Gemma es unico y las requests
    # se encolan (~29 tok/s total). Si ya hay _MAX_CONCURRENTES en vuelo, se
    # degrada de inmediato en vez de acumular requests que llegarian tarde.
    if not _semaforo_gemma.acquire(blocking=False):
        payload = respuesta_contrato(
            "ambiental", "baja", "", reasoning="backend saturado, Gemma tiene requests en cola"
        )
        return _con_estado(payload, "degradado", 200)

    try:
        payload, degradado = gemma_client.clasificar_audio(cuerpo["audio_base64"], mime)
    finally:
        _semaforo_gemma.release()

    return _con_estado(payload, "degradado" if degradado else "ok", 200)


if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=puerto, debug=True)