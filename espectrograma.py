"""Audio WAV -> espectrograma PNG, para poder clasificar sonido con Gemma 4.

¿Por qué existe este módulo? Porque Gemma 4 no tiene encoder de audio. Ollama
acepta el content part `input_audio`, decodifica el WAV, devuelve 200 OK... y
el modelo nunca recibe el sonido: inventa la respuesta desde el prompt. Falla
en silencio, que es la peor forma de fallar.

Su visión sí funciona, así que le damos el sonido como imagen. El espectrograma
es además la representación estándar en clasificación de audio, así que no es
un truco: es como se hace.

Detalles completos y evidencia en handoff/HALLAZGO-AUDIO.md
"""
from __future__ import annotations

import base64
import io
import logging
import wave

import numpy as np
from PIL import Image

logger = logging.getLogger("vibra.espectrograma")

# Tamaño de la imagen que se le manda al modelo. Más grande no mejora la
# clasificación y sí encarece el prefill en una Orin Nano.
ANCHO_PX = 512
ALTO_PX = 256

N_FFT = 512
HOP = 160          # 10 ms a 16 kHz
BANDAS = 128
RANGO_DB = 80.0    # sin recortar el rango dinámico, la imagen sale casi negra


class AudioNoDecodificable(ValueError):
    """El audio no es un WAV PCM legible."""


def _leer_wav(datos: bytes) -> tuple[np.ndarray, int]:
    """Devuelve (muestras mono float32 en [-1,1], sample_rate)."""
    try:
        with wave.open(io.BytesIO(datos), "rb") as w:
            canales = w.getnchannels()
            ancho = w.getsampwidth()
            sr = w.getframerate()
            crudo = w.readframes(w.getnframes())
    except (wave.Error, EOFError) as exc:
        raise AudioNoDecodificable(
            f"no es un WAV PCM legible ({exc}). El frontend manda WAV 16 bit "
            f"mono 16 kHz; si llega webm hay que transcodificar antes."
        ) from exc

    if ancho != 2:
        raise AudioNoDecodificable(f"se esperaba PCM de 16 bit, llegó de {ancho * 8}")

    x = np.frombuffer(crudo, dtype=np.int16).astype(np.float32) / 32768.0
    if canales > 1:
        x = x.reshape(-1, canales).mean(axis=1)
    if x.size == 0:
        raise AudioNoDecodificable("el WAV no trae muestras")
    return x, sr


def generar_png(muestras: np.ndarray, sr: int) -> bytes:
    """Espectrograma en escala log de frecuencia. X=tiempo, Y=frecuencia."""
    x = muestras / (np.abs(muestras).max() + 1e-9)

    ventana = np.hanning(N_FFT)
    cuadros = [
        np.abs(np.fft.rfft(x[i:i + N_FFT] * ventana))
        for i in range(0, max(len(x) - N_FFT, 1), HOP)
    ]
    if not cuadros:
        raise AudioNoDecodificable("clip demasiado corto para un espectrograma")

    S = np.array(cuadros).T
    S_db = 20 * np.log10(S + 1e-6)
    S_db = np.clip(S_db, S_db.max() - RANGO_DB, S_db.max())

    # Escala logarítmica en frecuencia: en escala lineal los agudos de una
    # alarma quedan aplastados contra la orilla superior y el modelo no los ve.
    freqs = np.linspace(0, sr / 2, S_db.shape[0])
    objetivo = np.logspace(np.log10(60), np.log10(sr / 2), BANDAS)
    S_log = np.array([S_db[np.argmin(np.abs(freqs - f))] for f in objetivo])

    rango = np.ptp(S_log)
    norm = (S_log - S_log.min()) / (rango + 1e-9)
    img = (norm * 255).astype(np.uint8)[::-1]  # graves abajo, como se espera

    buf = io.BytesIO()
    Image.fromarray(img).resize((ANCHO_PX, ALTO_PX), Image.BILINEAR).save(buf, format="PNG")
    return buf.getvalue()


def wav_base64_a_png_base64(audio_b64: str) -> str:
    """Punto de entrada: base64 de un WAV -> base64 de un PNG."""
    muestras, sr = _leer_wav(base64.b64decode(audio_b64))
    png = generar_png(muestras, sr)
    logger.debug("espectrograma generado: %d muestras a %d Hz -> %d bytes",
                 muestras.size, sr, len(png))
    return base64.b64encode(png).decode()
