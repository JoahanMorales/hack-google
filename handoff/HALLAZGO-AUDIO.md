# 🔴 Gemma 4 no puede oír — y el sistema no se da cuenta

**Para los agentes 2 y 3.** Esto no es código del frontend; es un hallazgo que
bloquea el proyecto entero y viene con la solución ya probada.

## El problema

`gemma4:e2b-it-qat` en Ollama **no tiene encoder de audio**. Los tags de la
librería dicen `Text, Image` — audio no aparece por ningún lado.

Lo grave no es que falle. Es que **no falla**: Ollama acepta el content part
`input_audio`, decodifica el WAV sin quejarse, y devuelve **200 OK** con JSON
perfectamente parseable. El audio simplemente nunca llega al modelo, que
inventa una respuesta verosímil desde el prompt.

### Evidencia

Dos audios acústicamente opuestos, por el pipeline completo
(`POST /clasificar` → `gemma_client` → Ollama):

| Audio enviado | Respuesta | `X-Vibra-Estado` |
|---|---|---|
| Pitido 3 kHz intermitente (alarma de humo de manual) | `ambiental` / `baja` / "ruido de fondo urbano" | `ok` |
| Ruido gaussiano de banda ancha | `ambiental` / `baja` / "ruido de tráfico tranquilo" | `ok` |

Misma categoría, misma urgencia, etiquetas inventadas y creíbles.

### Por qué la detección actual no lo agarra

`gemma_client.estado_soporte_audio` solo se marca `False` cuando salta un
`APIError`. Como Ollama responde 200, el flag se queda en `True` y
`GET /salud` reporta `audio_soportado: true`. Todo verde, todo inventado.

Nota: con un WAV corrupto Ollama **sí** devuelve 400 *"Failed to load image or
audio file"*. O sea que intenta decodificar el audio — el problema es que
después no hay encoder que lo convierta en tokens.

## La solución, ya probada

Convertir el clip a **espectrograma PNG** y mandarlo como `image_url`. La
visión de Gemma 4 sí funciona por Ollama.

Primero verificamos que percibe la diferencia. Pidiéndole solo describir:

- Espectrograma del pitido → *"líneas verticales paralelas, patrón repetitivo y uniforme"*
- Espectrograma del ruido → *"textura granulada, ruido uniforme"*

Pero al pedirle clasificar directo en las 4 categorías, **contestaba
`ambiental` para todo**. La percepción no era el problema: era el salto de lo
visual a la categoría.

Se arregla con una **tabla de decisión explícita** en el prompt:

| Audio | Resultado |
|---|---|
| Pitido 3 kHz intermitente | `alarma` ✅ |
| Ruido de banda ancha | `ambiental` ✅ |

El prompt que funciona y el generador de espectrogramas están en
[`espectrograma.py`](espectrograma.py), listo para correr.

## Qué hay que cambiar

**Agente 3** (`gemma/client.py`) y **agente 2** (`gemma_client.py`): cambiar el
content part `input_audio` por `image_url` con el espectrograma, y meter la
tabla de decisión al prompt.

**Dos detalles que importan del prompt:**

1. Que describa la estructura visual **antes** de decidir. Sin ese paso vuelve
   a colapsar todo a `ambiental`.
2. La línea `"NO elijas ambiental si ves estructura repetitiva nítida"`. El
   modelo tiene un sesgo fuerte hacia la categoría más segura.

**Del frontend ya no necesitan nada más:** manda WAV PCM 16 bit mono 16 kHz en
`audio_base64` más `mime_type: "audio/wav"`, así que pueden generar el
espectrograma directo sin ffmpeg.

## Para el writeup

Esto es material bueno, no una excusa. "Descubrimos que el modelo era ciego al
audio y le construimos un puente visual" es una decisión de ingeniería que se
defiende sola ante un jurado — mucho mejor que "le mandamos audio y ya".
Aprovecha que Gemma 4 es multimodal de verdad, y el espectrograma es
representación estándar en clasificación de sonido.
