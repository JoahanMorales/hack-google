# Pruebas y mediciones

Dos niveles de prueba: **sonidos reales** en el entorno donde se usaría, y un
**banco sintético** de señales generadas para forzar los casos difíciles.

---

## 1. Pruebas de campo, con sonidos reales

Es la prueba que importa: la app corriendo en un teléfono, con el micrófono
abierto, contra los sonidos que de verdad ocurren en un cuarto.

**El resultado fue bueno.** Las categorías se dispararon donde debían y los
patrones de vibración se sintieron claramente distintos entre sí — que es la
tesis del proyecto. La reacción de quienes lo probaron fue justamente la que
buscábamos: se entiende sin explicación, porque la diferencia entre "alarma" y
"ambiente" se siente, no se lee.

Lo que se observó:

- **Los sonidos con estructura clara se clasifican bien.** Una alarma real, un
  timbre, voces cercanas: cada uno cayó en su categoría de forma consistente.
- **El ruido de fondo se queda en `ambiental`** y casi no vibra (`[40]`), que es
  el comportamiento correcto. Un sistema que vibra con el aire acondicionado se
  apaga el primer día.
- **La latencia es usable.** El ciclo completo —grabar, generar el espectrograma,
  Gemma, vibrar— se siente inmediato en el uso real.

**Cómo reproducirlo:** abrir la app en un Android, dar permiso de micrófono, y
producir los sonidos. El historial en pantalla registra cada evento con su
categoría, su etiqueta y la hora.

> Los sonidos reales dieron mejores resultados que el banco sintético del punto
> 3. Es coherente: las señales generadas son deliberadamente ambiguas —un tono
> puro modulado se parece mucho a una alarma en el espectrograma— y sirven para
> encontrar los límites, no para medir el uso normal.

### Detección del nombre

Se probó en uso real: la persona configura su nombre y el sistema avisa cuando
alguien lo dice en voz alta, **al instante**, sin esperar el ciclo del clip.

La comparación se validó además con casos concretos:

| Caso | Nombre configurado | Entrada | Resultado |
|---|---|---|---|
| Normalización de acentos | `joahan` | "¡Joahán!" | detecta ✅ |
| Coincidencia dentro de una frase | `joahan` | "oye Joahan ven" | detecta ✅ |
| Falso positivo por subcadena | `ana` | "hasta mañana" | **no** detecta ✅ |

El tercero es el que evita el problema real: sin comparar por palabra completa,
el nombre "Ana" haría vibrar cada vez que alguien dice "mañana".

---

## 2. El hallazgo que definió la arquitectura

**Gemma 4 no tiene encoder de audio, y no lo dice.**

Ollama acepta el content part `input_audio`, decodifica el WAV, responde
`200 OK` con JSON válido — y el modelo nunca recibe el sonido. Inventa la
respuesta desde el prompt.

Se detectó mandando dos audios acústicamente opuestos por el pipeline completo
y comparando:

| Audio enviado | Respuesta | `X-Vibra-Estado` |
|---|---|---|
| Pitido 3 kHz intermitente (alarma de humo de manual) | `ambiental` / `baja` / "ruido de fondo urbano" | `ok` |
| Ruido gaussiano de banda ancha | `ambiental` / `baja` / "ruido de tráfico tranquilo" | `ok` |

Misma categoría, misma urgencia, etiquetas inventadas y verosímiles. El sistema
se reportaba sano mientras clasificaba a ciegas.

Detalle que confirma el mecanismo: con un WAV corrupto Ollama **sí** devuelve
`400 Failed to load image or audio file`. Intenta decodificar el audio; lo que
no existe es el encoder que lo convierta en tokens.

### La solución: espectrograma

Se verificó primero que la visión del modelo sí funciona, pidiéndole solo
describir la imagen sin clasificar nada:

| Espectrograma de | Descripción de Gemma |
|---|---|
| Pitido 3 kHz intermitente | *"líneas verticales paralelas de color claro... el patrón es repetitivo y uniforme"* |
| Ruido de banda ancha | *"textura granulada... ruido uniforme"* |

Percibe la diferencia sin ambigüedad. El problema no era la percepción, sino el
salto de lo visual a la categoría.

**Reproducir:** `python3 handoff/espectrograma.py` con el modelo arriba.

---

## 3. Banco sintético: buscando los límites

Cuatro señales generadas, diseñadas para ser difíciles a propósito. No
representan el uso normal — representan el peor caso.

Se usaron para comparar variantes de prompt sobre el pipeline completo, mismo
modelo (`gemma4:e2b-it-qat`):

| Variante del prompt | Aciertos |
|---|---|
| Tabla simple, "alarma" primero, `temperature=0.1` | **3/4** ← la que quedó |
| Tabla simple, "alarma" primero, temperatura por defecto | 3/4 |
| Tabla detallada, con reglas de desempate explícitas | 1/4 |
| Igual, moviendo "social" al inicio de la lista | 2/4 |
| Pedir observaciones visuales y mapear la categoría en Python | 1/4 |

### Tres hallazgos que valen más que el prompt

**El modelo tiene un sesgo fuerte hacia la primera opción de la lista.** Mover
el orden cambió el resultado más que reescribir las descripciones. Por eso
"alarma" quedó primero: en esta app un falso negativo de emergencia cuesta mucho
más que un falso positivo.

**Alargar el prompt lo empeora.** Cada regla extra le quitó precisión — de 3/4 a
1/4 al añadir reglas de desempate. Con un modelo de este tamaño, agregar texto
casi nunca es la respuesta. Es contraintuitivo y va contra el instinto de
"explicarle mejor".

**La temperatura importa más de lo que parece.** El cliente no la fijaba, así que
corría con el default de Ollama (0.8) y el mismo espectrograma caía en
categorías distintas entre corridas. Fijada en `0.1`.

### Dónde están los límites

El caso que más falla en el banco sintético es la "voz" generada: un zumbido
armónico muy regular que en espectrograma se parece de verdad a una alarma. Con
voz humana real, que es irregular y no estacionaria, ese problema no se presentó
igual.

Las categorías más robustas en todas las corridas fueron **`alarma`** y
**`ambiental`**, que son también las dos que más importan para seguridad.

---

## 4. Integración de punta a punta

Verificado con el sistema completo corriendo contra Gemma local:

- `OPTIONS /clasificar` → 200 (el sondeo del frontend funciona)
- `POST /clasificar` con la forma exacta que manda el frontend → 200, contrato completo
- Cabecera `X-Vibra-Estado` propagándose a la UI (`ok` / `degradado`)
- Frontend servido por el backend en el mismo origen: 13 assets en 200
- Ambas páginas renderizadas en Chromium headless: **0 errores de JS**
- Flujo completo en modo demo: 8-11 eventos llegando al historial
- **28 tests unitarios pasan** tras la migración a espectrograma

**Reproducir:** `./dev-check.sh` y `pytest -q`

Detalle operativo: Cloudflare devuelve 403 en POSTs grandes con User-Agent de
script. Los navegadores reales no se ven afectados; solo hay que tenerlo en
cuenta al probar con `curl` o Python.

---

## 5. Salida por tres canales

La API de vibración **no permite confirmar que el dispositivo se movió**:
`navigator.vibrate()` devuelve `true` en escritorio y no pasa nada. Por eso el
patrón se emite por tres canales alimentados por el mismo array de ms:

| Canal | Dónde funciona |
|---|---|
| Vibración | Chrome/Firefox en Android, si el sistema lo permite |
| Destello en pantalla | Cualquier dispositivo, incluso proyectado |
| Zumbido de 90 Hz | Cualquier dispositivo con audio |

Verificado que el diagnóstico reporta el entorno con precisión: en escritorio
dice *"la API existe pero no hay hardware que vibre"* en vez de prometer algo
que no va a pasar.

---

## 6. Restricciones de la plataforma

Medido en la Jetson Orin Nano Super (8 GB unificados):

| Modelo | Resultado |
|---|---|
| `gemma4:e4b-it-qat` (6.1 GB) | **No carga.** `cudaMalloc failed` incluso con 6.0 Gi libres |
| `gemma4:e2b-it-qat` (4.3 GB) | Carga en 1.6 GB, 100% GPU, **~29 tok/s** |

El e4b necesita ~7 GB entre pesos, contexto CUDA y KV cache, contra ~6.4 GB
reales disponibles. El offload parcial a CPU no ayuda porque en Jetson es la
misma memoria física.

Hallazgo útil para cualquiera que trabaje en Jetson: **`cudaMalloc` no fuerza el
reclaim del page cache**. Necesita memoria realmente `free`, no `available`, así
que hay que tirar la caché justo antes de cargar el modelo (`free-mem.sh` lo
hace).

---

## Siguientes mediciones

- [ ] Cuantificar la tasa de acierto en campo con N repeticiones por tipo de
      sonido, para tener un número y no solo la observación cualitativa.
- [ ] Medir la tasa de falsos positivos de `alarma`, que es el error que más
      molestaría a un usuario real.
- [ ] Probar en un cuarto con varias fuentes simultáneas, que es la condición
      normal de una casa y el banco actual no cubre.
