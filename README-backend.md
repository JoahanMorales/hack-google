# VibraContexto — Backend (Agente 2)

Implementa `POST /clasificar` según el contrato definido en el [README raíz](../hack-google/README.md). No toca UI, patrones de vibración ni el prompt de clasificación (dominio del Agente 3, ver [prompt.py](prompt.py)).

## Arrancar

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # llenar GEMMA_BASE_URL con tu URL de túnel — nunca commitear .env
python app.py                 # sirve en :5000 (o $PORT)
```

## Desarrollar sin el túnel (mock de Gemma)

```bash
python mock_gemma.py          # sirve en :8899
# en .env: GEMMA_BASE_URL=http://localhost:8899/v1
python app.py
```

El mock soporta `?modo=lento|error|basura|sin_audio` en `/v1/chat/completions` para simular los caminos de falla — ver [mock_gemma.py](mock_gemma.py).

## Endpoints

- `POST /clasificar` — `{ "audio_base64": "...", "mime_type": "audio/webm" }` → `{ categoria, urgencia, etiqueta, reasoning }` (contrato congelado). Siempre 200 salvo audio inválido (400) o payload muy grande (413) — nunca deja al frontend colgado. El header `X-Vibra-Estado: ok|degradado` indica si la clasificación es real o un fallback.
- `GET /salud` — hace un round-trip mínimo con Gemma: alcanzable, latencia, y si el endpoint aceptó audio (`audio_soportado`). Revisar esto primero si algo no cuadra — puede ser el túnel, no el código.

## Probar

```bash
pytest
```

Cubre: forma del contrato en éxito, audio faltante/inválido (400), timeout y caída de Gemma (degradado 200), salida no-JSON de Gemma, normalización de enums inválidos, y saturación del semáforo de concurrencia.

## Riesgo conocido: soporte de audio en Gemma

No está confirmado que el endpoint acepte `input_audio` (content part multimodal) ni el formato que produce `MediaRecorder` (`audio/webm;codecs=opus`). [gemma_client.py](gemma_client.py) lo intenta, y si el endpoint lo rechaza, marca un flag de proceso para no repetir el intento en cada request y degrada limpio. Correr `GET /salud` contra el túnel real apenas esté disponible para confirmar `audio_soportado` — si sale `false`, hace falta un paso de transcripción antes de Gemma, y eso hay que resolverlo con el Agente 3.

## Variables de entorno

Ver [.env.example](.env.example). La URL del túnel nunca va al repo, a issues, ni al chat — mientras esté corriendo, cualquiera con la URL tiene acceso sin auth.
