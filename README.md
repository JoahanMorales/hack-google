# VibraContexto 📳

App web que traduce el sonido del entorno en vibraciones distintivas y personalizables, para que personas sordas se enteren de lo que pasa a su alrededor en tiempo real. Corre 100% en el navegador (Web Vibration API) y usa **Gemma 4** local para interpretar el audio.

> Cambia el nombre si ya tienen uno para el equipo — este es solo un placeholder para el repo.

---

## El problema

Las personas sordas pierden constantemente contexto sonoro de seguridad y convivencia: alarmas, alguien llamándolas por su nombre, un claxon, el tono urgente de una conversación cerca. Las soluciones actuales (luces, smartwatches genéricos) solo avisan "pasó algo" — vibran igual para un portazo que para una alarma de incendio.

## La solución

Gemma 4 escucha clips cortos de audio del entorno, los clasifica (qué es + qué tan urgente) y la app dispara un **patrón de vibración distinto según la categoría**, para que la persona sepa qué pasó sin tener que mirar la pantalla.

---

## Arquitectura (versión de 3 horas)

```
[Micrófono navegador] 
       │  MediaRecorder, clips de ~3-4s
       ▼
[Frontend web] ──fetch(audio)──▶ [Backend ligero (Node/Express o Flask)]
                                          │
                                          │ POST audio + prompt
                                          ▼
                              [Gemma 4 local] ──▶ (vía túnel Cloudflare)
                                          │
                                          │ JSON: {categoria, urgencia, etiqueta}
                                          ▼
[Frontend recibe JSON] ──▶ navigator.vibrate(patrón según categoría/urgencia)
                       └─▶ tarjeta visual en pantalla con el evento
```

Nada de streaming continuo verdadero ni pipeline de dos etapas (VAD + modelo) — para 3 horas, capturar clips cortos en loop y mandarlos directo a Gemma es lo más rápido de tener funcionando y se ve bien en demo.

---

## Stack recomendado (rápido de armar)

- **Frontend**: HTML + JS plano (o React si el equipo ya lo domina de memoria — no aprendan algo nuevo hoy). `MediaRecorder` API para el audio, `navigator.vibrate()` para las vibraciones.
- **Backend**: Node + Express (o Flask si prefieren Python) — solo un endpoint `POST /clasificar` que reciba el audio en base64/blob, arme el prompt, le pegue a tu túnel de Cloudflare, y regrese JSON.
- **Gemma 4**: ya la tienen local con el túnel armado — perfecto, eso ya no es riesgo.

---

## Configuración del endpoint de Gemma 4

El endpoint es **compatible con la API de OpenAI**, así que en el backend se usa el SDK de siempre solo cambiando el `base_url`:

```python
from openai import OpenAI

client = OpenAI(
    base_url=os.environ["GEMMA_BASE_URL"],  # NO hardcodear la URL — va por variable de entorno
    api_key=os.environ.get("GEMMA_API_KEY", "x"),  # cualquier string, no valida nada
)

response = client.chat.completions.create(
    model="gemma4:e2b-it-qat",
    messages=[
        {"role": "user", "content": prompt}
    ],
)

content = response.choices[0].message.content
reasoning = response.choices[0].message.reasoning  # Gemma 4 trae razonamiento integrado, aparte del content — vale la pena loguearlo/mostrarlo en el writeup
```

> ⚠️ **La URL del túnel NO va en el repo, ni en issues, ni en ningún canal público** — mientras esté corriendo, cualquiera con la URL tiene acceso sin auth. Pásenla por variable de entorno (`.env`, que sí debe estar en `.gitignore`) o directo por chat entre el equipo.

**Límites a tener en cuenta mientras se desarrolla:**
- Es un solo dispositivo de 8GB corriendo el modelo — las requests en paralelo se encolan (~29 tok/s **total**, no por persona). Para pruebas individuales está bien; si el equipo va a probar carga o varios agentes a la vez, hay que coordinar.
- Contexto de 4096 tokens (se está subiendo a 32K — confirmar antes de armar prompts largos con few-shot o mucho historial, porque con tool calling se llena rápido).
- Si el endpoint se cae o va muy lento, avisar para reiniciarlo — no asumir que es un bug del código propio.

---

## Trabajo en paralelo con 3 agentes (git worktree)

Con 3 agentes generando código a la vez, la clave es que **cada uno trabaje en su propio worktree y su propia rama**, para que nadie pise el trabajo de otro ni tengan que esperarse entre sí.

```bash
# Desde la carpeta del repo ya clonado, en la rama base (main)
git checkout -b main   # si no existe todavía

git worktree add ../vibra-frontend feature/frontend
git worktree add ../vibra-backend  feature/backend
git worktree add ../vibra-gemma    feature/gemma-integration
```

Esto crea 3 carpetas hermanas al repo original, cada una con su propia rama ya cambiada — cada agente trabaja dentro de la suya (`cd ../vibra-frontend`, etc.) sin tocar los archivos de las otras dos, aunque las tres compartan el mismo historial de git.

**Reglas para que no interfieran entre sí:**
- Cada agente **solo toca archivos de su carpeta/dominio** (frontend agent no toca `/backend`, etc.) — el contrato de interfaz de abajo es lo único que los conecta.
- Nadie hace `git push --force` ni reescribe historial compartido.
- Los merges a `main` pasan por los checkpoints de integración del plan (abajo) — no se mergea nada a media tarea sin avisar al resto.
- Si un agente necesita algo del dominio de otro (ej. frontend necesita que el backend regrese un campo nuevo), lo pide como cambio al contrato — no lo edita directamente.

## Contrato de interfaz (API contract)

Definan esto en el minuto 0 y **no lo cambien a medio sprint** — es lo que permite que los 3 agentes avancen en paralelo sin bloquearse esperando a los demás:

```
POST /clasificar
Request:  { "audio_base64": "..." }
Response: {
  "categoria": "alarma" | "atencion" | "social" | "ambiental",
  "urgencia": "baja" | "media" | "alta",
  "etiqueta": "string corta, ej. 'alarma de humo'",
  "reasoning": "string opcional, el razonamiento de Gemma"
}
```

Con esto fijo, **el agente de frontend puede mockear esta respuesta y construir toda la UI y las vibraciones sin esperar a que el backend o Gemma estén listos** — conecta el mock al final en el checkpoint de integración.

## Roles y tareas por agente

### 🎨 Agente 1 — Frontend & Experiencia de Vibración
*Este es el rol con más peso — es lo que el jurado ve y siente, aquí es donde el proyecto debe deslumbrar.*

- Construir la UI completa contra el contrato mockeado (no esperar al backend real).
- Implementar `navigator.vibrate()` con los patrones definidos en la sección de Features.
- Diseño visual con identidad fuerte: fondo oscuro, acentos de color por categoría (rojo/naranja para urgente, azul/verde para neutro), tipografía grande y con peso.
- Un elemento central "vivo" en pantalla (ej. un círculo/orbe) que **pulsa visualmente al mismo tiempo que vibra el celular** — la vibración se "ve" y se siente a la vez, eso es lo que sorprende en vivo.
- Micro-animaciones al recibir cada evento (la tarjeta nueva entra con transición, no aparece seca).
- Historial de eventos recientes, con ícono + color por categoría.
- (Si da tiempo) pantalla de personalización de patrones por categoría.

### ⚙️ Agente 2 — Backend & Pipeline de audio
- `MediaRecorder` en el frontend → esto lo coordina con el agente 1, pero la implementación del envío/recepción es suya.
- Endpoint `POST /clasificar` que cumple el contrato de arriba.
- Manejo de errores: qué regresa el endpoint si Gemma tarda, se cae, o el audio viene corrupto (nunca dejar al frontend colgado esperando).
- `.env` con la URL del túnel y la API key — nunca hardcodeada, y `.env` en `.gitignore` desde el commit inicial.

### 🧠 Agente 3 — Integración Gemma & Prompt Engineering
- Diseñar y afinar el prompt de clasificación (el que le pega a Gemma con el audio).
- Parsear la respuesta de Gemma al JSON exacto del contrato — este agente es el dueño del contrato, cualquier cambio a los campos pasa por aquí.
- Capturar el campo `reasoning` aparte del `content` para el writeup.
- Prompt few-shot para detección de nombre propio (si da tiempo).
- Cuidar el límite de contexto (4096 tokens) al armar los prompts — no meter historiales largos de más.
- Probar con variedad real de audios (alarma, voz, ruido ambiental) antes de dárselo al agente de backend para integrar.

---

## Plan de desarrollo — sprint de 3 horas, en paralelo

| Tiempo | Todos juntos | 🎨 Agente 1 (Frontend) | ⚙️ Agente 2 (Backend) | 🧠 Agente 3 (Gemma) |
|---|---|---|---|---|
| **0:00 – 0:15** | Fijar el contrato de interfaz, crear los worktrees, repartir roles. Nadie escribe código todavía. | — | — | — |
| **0:15 – 1:00** | *(trabajo en paralelo, sin bloquearse)* | UI base + botón "escuchar" + `navigator.vibrate` de prueba, construyendo contra el mock del contrato | `MediaRecorder` + endpoint `/clasificar` recibiendo audio (aunque adentro solo regrese datos falsos por ahora) | Prompt de clasificación, probado a mano con 2-3 audios grabados (sin conectar nada todavía) |
| **1:00 – 1:45** | | Patrones de vibración reales + el orbe/elemento visual que pulsa en sync | Conectar el endpoint real a Gemma (vía el SDK de OpenAI), manejo de errores/timeouts | Afinar el prompt con los audios de prueba del agente 2, ajustar el JSON de salida |
| **1:45 – 2:00** | **🔗 Checkpoint de integración #1** — mergear las 3 ramas a `main`, probar el flujo completo de punta a punta. Arreglar lo que truene aquí, no antes. | | | |
| **2:00 – 2:30** | *(trabajo en paralelo otra vez, ya sobre la integración real)* | Micro-animaciones, historial de eventos, pulido visual | Detección de nombre (few-shot) integrada al endpoint si da tiempo | Ajustar prompt para pocos falsos positivos, cuidar el límite de 4096 tokens |
| **2:30 – 2:45** | **🔗 Checkpoint de integración #2** — merge final, prueba completa, congelar el código. | | | |
| **2:45 – 3:00** | Ensayo de pitch todos juntos. Grabar un audio de respaldo por si falla el mic en vivo. | | | |

**Regla de oro con solo 3 horas:** los checkpoints de integración a las 2:00 y a las 2:45 no son opcionales — sin ellos, cada agente puede tener su parte "lista" y aun así no funcionar nada junto. Nadie sigue agregando features nuevas después de las 2:30.

---

## Features

### Imprescindibles para el MVP (bloques 1-4 del plan)
- [ ] Botón de encender/apagar "modo escucha"
- [ ] Captura de audio en clips cortos y envío al backend
- [ ] Clasificación por Gemma: categoría + nivel de urgencia (baja/media/alta)
- [ ] Al menos 4 patrones de vibración bien distintos, cada uno con su color e ícono asociado en pantalla:
  - **🚨 Alarma/emergencia** (humo, sirena) — rojo — pulsos cortos y repetidos, urgente: `[100,50,100,50,100,50,400]`
  - **👋 Alguien te llama / te habla** — ámbar — patrón suave de 2 pulsos medianos: `[150,100,150]`
  - **🌫️ Sonido ambiental neutro** (tráfico, ruido de fondo) — gris/azul — sin vibración, o un pulso único muy leve, para no saturar
  - **🔔 Sonido social/atención** (timbre, tocan la puerta, teléfono sonando) — verde — patrón rítmico distinto: `[80,80,80,80,80]`
- [ ] Tarjeta visual en pantalla mostrando qué se detectó (para quien quiera confirmar viendo, no solo sintiendo)
- [ ] **El "orbe" central**: un elemento visual (círculo/blob con glow) que pulsa *exactamente* al mismo tiempo que vibra el celular, con el color de la categoría — esto es lo que hace que en la demo la gente "vea" la vibración, no solo se les diga que existe. Usa `Array.from` sobre el patrón de vibración para animar el orbe con los mismos tiempos que se le pasan a `navigator.vibrate()`, así van perfectamente sincronizados.
- [ ] Transición de entrada suave para cada evento nuevo en el historial (nunca que aparezca "seco" — un fade + slide de 200-300ms ya se siente pulido)
- [ ] Fondo oscuro con acentos de color vivos por categoría — contraste alto, tipografía grande y con peso, para que se lea bien en una demo mostrada desde lejos (proyector, mesa de jueces)

### Si sobra tiempo
- [ ] Detección de que llaman tu nombre específico (few-shot en el prompt)
- [ ] Pantalla de personalización: el usuario reasigna qué patrón quiere para cada categoría
- [ ] Historial de eventos del día (lista simple, sin base de datos — guardarlo en memoria del frontend basta para la demo)
- [ ] Indicador de urgencia también por color/ícono en pantalla, no solo vibración

### Ideas para mejorar la propuesta (más allá del MVP, para mencionar en el pitch como visión a futuro — no las construyan hoy)
- **Onboarding que enseña el código de vibraciones**: en vez de asumir que el usuario reconoce los patrones de inmediato, Gemma genera un mini-tutorial conversacional que le enseña sus propios patrones con repetición espaciada — esto resuelve el problema de que un código nuevo no sirve si nadie lo aprende.
- **Perfil de sonidos personales**: el usuario graba 2-3 ejemplos de "este es mi timbre" o "esta es mi alarma" y Gemma los usa como referencia (in-context, sin fine-tuning) para reconocer variantes parecidas — aprovecha el contexto largo de Gemma 4.
- **Modo "conversación en grupo"**: detecta cuándo el tono de una conversación cercana se vuelve tenso/urgente (útil en contextos sociales, no solo de seguridad).
- **Todo on-device**: como Gemma 4 corre local, se puede argumentar fuerte el punto de privacidad — nada del audio del entorno de la persona sale a un servidor externo. Esto es un diferenciador real frente a soluciones que dependen de la nube.

---

## 📊 Estado del sprint (Agent 3 feed)

> Este apartado se actualiza en tiempo real para que todo el equipo vea el avance de cada agente sin tener que hacer *fetch* manual.

| Hora | 🎨 Frontend | ⚙️ Backend | 🧠 Gemma (este agente) |
|------|-------------|------------|------------------------|
| 0:15–1:00 | — | — | ✅ **Prompt de clasificación** diseñado (`gemma/prompt.py`) ✅ Tests unitarios del parser (`tests/test_parser.py`, 15 tests) ✅ Tests de pipeline E2E con mock (`tests/test_pipeline.py`, 5 tests) ✅ Script manual `test_prompt.py` validado con 6 escenarios simulados |
| 1:00–1:45 | — | — | ⏳ Afinar prompt con feedback de Gemma real (pendiente del tunnel) |
| 1:45 | 🔗 Checkpoint integración #1 | 🔗 Checkpoint integración #1 | 🔗 Checkpoint integración #1 |

**Entregables de hoy (Agent 3):**
- `gemma/prompt.py` — prompt compacto (<1400 chars / ~350 tokens, deja margen en el límite de 4096)
- `gemma/parser.py` — parser robusto: maneja markdown fences, JSON con comas finales, texto circundante, valida contra el contrato
- `gemma/client.py` — wrapper OpenAI SDK con env vars (`GEMMA_BASE_URL`, `GEMMA_API_KEY`)
- `gemma/classifier.py` — orquestador `GemmaClassifier.classify(audio_base64) → dict` + función `gemma.classify()` de conveniencia
- `tests/` — 20 tests unitarios, todos verdes

**Próximos pasos:** ajustar el prompt con outputs reales de Gemma una vez el tunnel esté disponible; validar con audios grabados del micrófono.

---

## Notas para el pitch

- El argumento más fuerte que tienen: **no es solo "otro wearable que vibra"**, es un sistema que **interpreta contexto y es personalizable**, corriendo local por privacidad.
- Dejen claro desde el inicio que **no es braille** — el braille es para personas ciegas, esto es un código háptico propio pensado para personas sordas.
- Si el mic falla en vivo, tengan un clip de audio de respaldo pre-grabado para no perder la demo.