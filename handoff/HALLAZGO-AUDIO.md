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

## Estado: ya implementado en main

`gemma_client._mensaje_multimodal()` genera el espectrograma con
`espectrograma.py` y lo manda como `image_url`. El prompt está en `prompt.py`.
`GET /salud` ahora reporta `modo_entrada: "espectrograma_png"` en vez de mentir
con `audio_soportado: true`.

Lo de abajo es el registro de cómo se llegó ahí: sirve para el writeup y para
que nadie repita los callejones sin salida.

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

### Lo que se midió

Cuatro audios sintéticos (pitido 3 kHz intermitente, ruido de banda ancha, voz
con armónicos, tres golpes aislados), por el pipeline completo:

| Configuración del prompt | Aciertos |
|---|---|
| Tabla simple, "alarma" primero, `temperature=0.1` | **3/4** ← la que quedó |
| Tabla simple, "alarma" primero, temperatura default | 3/4 |
| Tabla detallada con reglas de desempate | 1/4 |
| Igual, pero moviendo "social" al inicio de la lista | 2/4 |
| Pedir observaciones visuales y mapear la categoría en Python | 1/4 |

Dos aprendizajes que valen más que el prompt en sí:

1. **e2b tiene un sesgo fuerte hacia la primera opción de la lista.** Cambiar el
   orden mueve más el resultado que cambiar las descripciones. Por eso "alarma"
   va primero: un falso negativo de emergencia cuesta mucho más que un falso
   positivo.
2. **Alargar el prompt lo empeora.** Cada regla extra le quitó precisión. Con un
   modelo de este tamaño, agregar texto casi nunca es la respuesta.

También se fijó `temperature=0.1`. Sin eso corría con el default de Ollama
(0.8) y el mismo espectrograma caía en categorías distintas entre corridas.

### Lo que falta medir

**Los cuatro audios de prueba son sintéticos** y eso limita lo que se puede
concluir. El de "voz" es un zumbido armónico muy regular que en espectrograma
se parece de verdad a una alarma. Antes de dar la calidad por buena hay que
volver a medir con grabaciones reales: alarma de humo de verdad, gente hablando
de verdad, el timbre de una puerta de verdad. El arnés está en
`handoff/espectrograma.py`, solo hay que cambiarle las fuentes.

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
