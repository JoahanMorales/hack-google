"""Contrato congelado de /clasificar (ver README raiz, seccion 'Contrato de interfaz').
No cambiar esta forma sin coordinar con el agente de Gemma/prompt.
"""
import base64
import binascii
import json
import re

CATEGORIAS_VALIDAS = {"alarma", "atencion", "social", "ambiental"}
URGENCIAS_VALIDAS = {"baja", "media", "alta"}

MAX_AUDIO_BYTES = 8 * 1024 * 1024  # 8 MB, coincide con el limite de request en app.py

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class AudioInvalido(Exception):
    """El audio_base64 del request no es usable."""


def validar_audio_base64(audio_b64: str) -> bytes:
    if not audio_b64 or not isinstance(audio_b64, str):
        raise AudioInvalido("falta audio_base64")
    # tolera un data URL tipo "data:audio/webm;base64,AAAA..."
    if audio_b64.startswith("data:"):
        _, _, audio_b64 = audio_b64.partition(",")
    try:
        crudo = base64.b64decode(audio_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AudioInvalido("audio_base64 no es base64 valido") from exc
    if not crudo:
        raise AudioInvalido("audio_base64 decodifica a vacio")
    if len(crudo) > MAX_AUDIO_BYTES:
        raise AudioInvalido(f"audio supera el limite de {MAX_AUDIO_BYTES} bytes")
    return crudo


def respuesta_contrato(categoria: str, urgencia: str, etiqueta: str, reasoning: str = "") -> dict:
    """Fuerza cualquier salida (de Gemma o degradada) a la forma exacta del contrato."""
    if categoria not in CATEGORIAS_VALIDAS:
        categoria = "ambiental"
    if urgencia not in URGENCIAS_VALIDAS:
        urgencia = "baja"
    return {
        "categoria": categoria,
        "urgencia": urgencia,
        "etiqueta": str(etiqueta)[:120] if etiqueta else "",
        "reasoning": str(reasoning) if reasoning else "",
    }


def parsear_salida_gemma(contenido: str) -> dict:
    """Convierte el content de Gemma (se espera JSON) a la forma del contrato.

    Lanza ValueError si no se puede parsear - quien llama decide como degradar.
    """
    if not contenido:
        raise ValueError("contenido vacio de Gemma")
    limpio = _FENCE_RE.sub("", contenido.strip())
    datos = json.loads(limpio)  # puede lanzar json.JSONDecodeError (subclase de ValueError)
    if not isinstance(datos, dict):
        raise ValueError("la salida de Gemma no es un objeto JSON")
    return respuesta_contrato(
        categoria=datos.get("categoria", ""),
        urgencia=datos.get("urgencia", ""),
        etiqueta=datos.get("etiqueta", ""),
        reasoning=datos.get("reasoning", ""),
    )
