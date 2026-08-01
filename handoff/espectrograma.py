"""Espectrograma -> Gemma 4. Ruta validada para clasificar sonido.

Ver HALLAZGO-AUDIO.md: Gemma 4 no tiene encoder de audio, pero su visión sí
funciona. Esto convierte el clip a espectrograma PNG y lo manda como imagen.

Resultado de esta prueba contra gemma4:e2b-it-qat:
    pitido 3 kHz intermitente -> alarma     (correcto)
    ruido de banda ancha      -> ambiental  (correcto)

Correr con el tunel de Gemma arriba:  python3 espectrograma.py
Las dos piezas que importan para producción son espectrograma_png() y
PROMPT_VISUAL — lo demás es el arnés de prueba.
"""
import base64, io, json, math, random, urllib.request
import numpy as np
from PIL import Image

SR = 16000
DUR = 3
GEMMA = "http://127.0.0.1:11434/v1/chat/completions"


def espectrograma_png(muestras, sr=SR, n_fft=512, hop=160, bandas=128):
    """Audio -> PNG en escala de grises. Eje X tiempo, eje Y frecuencia (log)."""
    x = np.asarray(muestras, dtype=np.float32)
    x /= (np.abs(x).max() + 1e-9)

    ventana = np.hanning(n_fft)
    cuadros = []
    for i in range(0, len(x) - n_fft, hop):
        espectro = np.abs(np.fft.rfft(x[i:i + n_fft] * ventana))
        cuadros.append(espectro)
    S = np.array(cuadros).T  # (freq, tiempo)

    # dB, recortado a 80 dB de rango dinámico: sin esto todo se ve negro.
    S_db = 20 * np.log10(S + 1e-6)
    S_db = np.clip(S_db, S_db.max() - 80, S_db.max())

    # Remapeo a escala log en frecuencia: así los agudos de una alarma no
    # quedan aplastados en la orilla superior.
    freqs = np.linspace(0, sr / 2, S_db.shape[0])
    objetivo = np.logspace(np.log10(60), np.log10(sr / 2), bandas)
    S_log = np.array([S_db[np.argmin(np.abs(freqs - f))] for f in objetivo])

    norm = (S_log - S_log.min()) / (S_log.ptp() + 1e-9)
    img = (norm * 255).astype(np.uint8)[::-1]  # graves abajo
    return Image.fromarray(img).resize((512, 256), Image.BILINEAR)


# El prompt que sí funciona. Dos cosas lo hacen funcionar y no se pueden
# quitar: (1) obligarlo a describir lo visual ANTES de decidir, (2) la línea
# que le prohíbe elegir ambiental ante estructura repetitiva — el modelo tiene
# un sesgo fuerte hacia la categoría más segura y colapsa todo ahí.
PROMPT_VISUAL = """Estas viendo el ESPECTROGRAMA de un sonido (X=tiempo, Y=frecuencia, brillo=energia).

Paso 1. Describe la estructura visual en una frase.
Paso 2. Aplica ESTA tabla de decision, en orden. Para en la primera que aplique:
 - Lineas/bandas nitidas que se repiten prendiendo y apagando  -> alarma (urgencia alta)
 - Bandas horizontales que suben y bajan de forma irregular    -> social (urgencia media)
 - Pocos golpes aislados separados por silencio                -> atencion (urgencia media)
 - Textura granulada uniforme sin estructura repetitiva        -> ambiental (urgencia baja)

NO elijas ambiental si ves estructura repetitiva nitida.

Responde: {"visual":"...","categoria":"...","urgencia":"...","etiqueta":"..."}"""


def preguntar(png, etiqueta):
    buf = io.BytesIO()
    png.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = PROMPT_VISUAL

    payload = {
        "model": "gemma4:e2b-it-qat",
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + b64}},
        ]}],
    }
    req = urllib.request.Request(
        GEMMA, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer x"},
    )
    r = json.loads(urllib.request.urlopen(req, timeout=300).read())
    print(f"{etiqueta}:\n  {r['choices'][0]['message']['content'].strip()[:300]}\n")


n = SR * DUR
# A: alarma de humo — tono puro 3 kHz que prende y apaga
a = [20000 * math.sin(2 * math.pi * 3000 * i / SR) if (i // (SR // 5)) % 2 == 0 else 0
     for i in range(n)]
# B: ruido de fondo — gaussiano de banda ancha
b = [random.gauss(0, 1) * 600 for _ in range(n)]

for muestras, nombre in ((a, "A · pitido 3kHz intermitente"), (b, "B · ruido de banda ancha")):
    preguntar(espectrograma_png(muestras), nombre)
