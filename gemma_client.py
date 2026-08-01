"""Unica capa que habla con Gemma 4 (via endpoint compatible con OpenAI).

Nadie mas en el backend debe importar `openai` directamente - todo pasa por
`clasificar_audio` para que la degradacion y el flag de soporte de audio
vivan en un solo lugar.
"""
import json
import logging
import os
import re
import time

from openai import APIError, APITimeoutError, OpenAI

from espectrograma import AudioNoDecodificable, wav_base64_a_png_base64
from prompt import CATEGORIAS_VALIDAS, PROMPT_CLASIFICACION, URGENCIAS_VALIDAS
from validacion import respuesta_contrato


def _extraer_json(texto: str) -> dict:
    """Saca el objeto JSON de la respuesta, tolerando fences y prosa alrededor."""
    if not texto or not texto.strip():
        raise ValueError("respuesta vacia")
    limpio = re.sub(r"^```(?:json)?|```$", "", texto.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(limpio)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", limpio, re.DOTALL)
        if not m:
            raise ValueError("no hay objeto JSON en la respuesta")
        return json.loads(m.group(0))

logger = logging.getLogger("vibra.gemma")

GEMMA_MODEL = os.environ.get("GEMMA_MODEL", "gemma4:e2b-it-qat")
# Un espectrograma tarda mas en prefill que puro texto: ~6-12s en la Orin Nano.
GEMMA_TIMEOUT_S = float(os.environ.get("GEMMA_TIMEOUT_S", "30"))

# El clip se manda como IMAGEN (espectrograma), no como audio. El flag de
# soporte de audio que habia aqui no servia: Ollama nunca devuelve error por
# el content part input_audio, responde 200 y descarta el sonido, asi que el
# flag se quedaba en True para siempre y /salud reportaba que todo bien.
estado_soporte_audio = {
    "soportado": False,
    "ultimo_error": "gemma4 no tiene encoder de audio; se clasifica por espectrograma",
}


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
    """Arma el mensaje con el ESPECTROGRAMA del clip, no con el audio.

    Gemma 4 no tiene encoder de audio: Ollama acepta el content part
    `input_audio`, decodifica el WAV y responde 200 OK, pero el modelo nunca
    recibe el sonido y se inventa la clasificacion. Comprobado mandando un
    pitido de 3 kHz y ruido blanco: identica respuesta "ambiental / baja".

    Su vision si funciona. Ver handoff/HALLAZGO-AUDIO.md
    """
    png_b64 = wav_base64_a_png_base64(audio_b64)
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT_CLASIFICACION},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{png_b64}"},
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

    # El espectrograma se genera antes de cronometrar: si el audio no es un WAV
    # legible es culpa del cliente, no de Gemma, y hay que decirlo distinto.
    try:
        mensajes = _mensaje_multimodal(audio_b64, mime)
    except AudioNoDecodificable as exc:
        logger.warning("audio no decodificable (mime=%s): %s", mime, exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning=str(exc)), True

    inicio = time.monotonic()
    try:
        # Sin fijar temperatura, Ollama corre con su default (0.8) y el mismo
        # espectrograma cae en categorias distintas entre corridas. Esto es
        # clasificacion, no escritura creativa: queremos determinismo.
        resp = cliente.chat.completions.create(
            model=GEMMA_MODEL, messages=mensajes, temperature=0.1
        )
    except (APITimeoutError,) as exc:
        logger.warning("timeout de Gemma tras %.1fs: %s", time.monotonic() - inicio, exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning="timeout de Gemma"), True
    except APIError as exc:
        logger.error("Gemma rechazo la request: %s", exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning=f"error de Gemma: {exc}"), True
    except Exception as exc:  # red caida, DNS, etc - no debe tumbar el endpoint
        logger.error("fallo inesperado hablando con Gemma: %s", exc)
        return respuesta_contrato("ambiental", "baja", "", reasoning="Gemma no disponible"), True

    contenido = resp.choices[0].message.content
    reasoning_nativo = getattr(resp.choices[0].message, "reasoning", None)

    try:
        cruda = _extraer_json(contenido)
    except ValueError as exc:
        logger.warning("salida no parseable: %s | contenido=%r", exc, contenido)
        return respuesta_contrato("ambiental", "baja", "", reasoning="respuesta de Gemma no parseable"), True

    # Blindaje: si el modelo inventa una categoria fuera del contrato, se cae a
    # 'ambiental' en vez de romper al frontend. Es la opcion que menos molesta.
    categoria = cruda.get("categoria") if cruda.get("categoria") in CATEGORIAS_VALIDAS else "ambiental"
    urgencia = cruda.get("urgencia") if cruda.get("urgencia") in URGENCIAS_VALIDAS else "media"
    etiqueta = str(cruda.get("etiqueta") or "").strip()[:60] or "sonido detectado"
    razon = str(cruda.get("reasoning") or reasoning_nativo or "").strip()

    salida = respuesta_contrato(categoria, urgencia, etiqueta, reasoning=razon)
    logger.info("clasificado en %.1fs: %s/%s (%s)",
                time.monotonic() - inicio, categoria, urgencia, etiqueta)

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
            # Se reporta explicitamente para que nadie vuelva a asumir que el
            # audio llega al modelo: no llega, se manda su espectrograma.
            "modo_entrada": "espectrograma_png",
            "audio_nativo_soportado": False,
        }
    except Exception as exc:
        return {"alcanzable": False, "error": str(exc)}