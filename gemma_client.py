"""Unica capa que habla con Gemma 4 (via endpoint compatible con OpenAI).

Nadie mas en el backend debe importar `openai` directamente - todo pasa por
`clasificar_audio` para que la degradacion y el flag de soporte de audio
vivan en un solo lugar.
"""
import logging
import os
import time

from openai import APIError, APITimeoutError, OpenAI

from prompt import PROMPT_CLASIFICACION
from validacion import parsear_salida_gemma, respuesta_contrato

logger = logging.getLogger("vibra.gemma")

GEMMA_MODEL = os.environ.get("GEMMA_MODEL", "gemma4:e2b-it-qat")
GEMMA_TIMEOUT_S = float(os.environ.get("GEMMA_TIMEOUT_S", "12"))

# Mapeo simple del mime que reporta MediaRecorder al "format" que espera
# el content part input_audio. Si el mime no esta aqui, se manda tal cual
# y que el endpoint decida.
_MIME_A_FORMATO = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
}

# Se actualiza en caliente la primera vez que el endpoint acepta o rechaza
# un content part de audio, para no repetir un intento que ya sabemos que
# falla en cada request. Ver GET /salud en app.py.
estado_soporte_audio = {"soportado": None, "ultimo_error": None}


def _cliente():
    base_url = os.environ.get("GEMMA_BASE_URL")
    if not base_url:
        raise RuntimeError("GEMMA_BASE_URL no esta configurada (ver .env.example)")
    return OpenAI(
        base_url=base_url,
        api_key=os.environ.get("GEMMA_API_KEY", "x"),
        timeout=GEMMA_TIMEOUT_S,
    )


def _mensaje_multimodal(audio_b64: str, mime: str) -> list:
    formato = _MIME_A_FORMATO.get(mime, mime.split("/")[-1] if mime else "webm")
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT_CLASIFICACION},
                {
                    "type": "input_audio",
                    "input_audio": {"data": audio_b64, "format": formato},
                },
            ],
        }
    ]


def clasificar_audio(audio_b64: str, mime: str = "audio/webm") -> tuple[dict, bool]:
    """Devuelve (respuesta_contrato, degradado).

    degradado=True significa que no se pudo obtener una clasificacion real
    y la respuesta es un fallback seguro - el llamador decide como
    reportarlo (header X-Vibra-Estado en app.py).
    """
    try:
        cliente = _cliente()
    except RuntimeError as exc:
        logger.error("gemma no configurado: %s", exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning=str(exc)), True

    if estado_soporte_audio["soportado"] is False:
        motivo = estado_soporte_audio["ultimo_error"] or "audio no soportado por el endpoint"
        return respuesta_contrato("ambiental", "baja", "", reasoning=motivo), True

    inicio = time.monotonic()
    try:
        resp = cliente.chat.completions.create(
            model=GEMMA_MODEL,
            messages=_mensaje_multimodal(audio_b64, mime),
        )
        estado_soporte_audio["soportado"] = True
    except (APITimeoutError,) as exc:
        logger.warning("timeout de Gemma tras %.1fs: %s", time.monotonic() - inicio, exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning="timeout de Gemma"), True
    except APIError as exc:
        # Puede ser que el endpoint no soporte input_audio - lo marcamos para
        # no repetir el intento fallido en cada request subsecuente.
        estado_soporte_audio["soportado"] = False
        estado_soporte_audio["ultimo_error"] = str(exc)
        logger.error("Gemma rechazo la request (posible falta de soporte de audio): %s", exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning=f"error de Gemma: {exc}"), True
    except Exception as exc:  # red caida, DNS, etc - no debe tumbar el endpoint
        logger.error("fallo inesperado hablando con Gemma: %s", exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning="Gemma no disponible"), True

    contenido = resp.choices[0].message.content
    reasoning_nativo = getattr(resp.choices[0].message, "reasoning", None)

    try:
        salida = parsear_salida_gemma(contenido)
    except Exception as exc:  # incluye json.JSONDecodeError
        logger.warning("salida de Gemma no parseable como contrato: %s | contenido=%r", exc, contenido)
        return respuesta_contrato("ambiental", "baja", "", reasoning="respuesta de Gemma no parseable"), True

    if reasoning_nativo and not salida.get("reasoning"):
        salida["reasoning"] = str(reasoning_nativo)

    return salida, False


def probar_salud() -> dict:
    """Usado por GET /salud: intenta un round-trip minimo con Gemma."""
    try:
        cliente = _cliente()
    except RuntimeError as exc:
        return {"alcanzable": False, "error": str(exc)}

    inicio = time.monotonic()
    try:
        cliente.chat.completions.create(
            model=GEMMA_MODEL,
            messages=[{"role": "user", "content": "Responde solo con OK."}],
        )
        latencia_ms = round((time.monotonic() - inicio) * 1000, 1)
        return {
            "alcanzable": True,
            "modelo": GEMMA_MODEL,
            "latencia_ms": latencia_ms,
            "audio_soportado": estado_soporte_audio["soportado"],
        }
    except Exception as exc:
        return {"alcanzable": False, "error": str(exc)}