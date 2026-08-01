# Coralia 📳

**Siente tu espacio.**

Coralia traduce el sonido del entorno en vibraciones distintivas, para que las
personas sordas sepan qué está pasando a su alrededor en tiempo real. **Gemma 4**
escucha e interpreta el audio, y cada tipo de sonido dispara un patrón de
vibración diferente.

Con el mismo vocabulario de cuatro patrones ya cubre la **alerta sísmica** —de
las últimas cosas de las que se entera una persona sorda, y donde el margen es
de segundos—, el **llanto de un bebé** en otro cuarto, el **timbre** de la
puerta, y **que alguien te esté llamando por tu nombre**.

Y sirve igual si oyes perfectamente: con audífonos con cancelación de ruido,
durmiendo, en obra con protección auditiva, o con el teléfono en silencio.
Es una app web — se abre y funciona, sin instalar nada ni comprar hardware.

**Demo:** [Coralia](https://coralia-six.vercel.app) · **Pruebas y mediciones:** [PRUEBAS.md](PRUEBAS.md)

---

## El problema

Las alertas que existen hoy para personas sordas —luces estroboscópicas,
smartwatches genéricos— avisan que **hubo** un sonido, pero no **cuál**. Vibran
igual para un portazo que para una alarma de incendio.

Eso obliga a la persona a interrumpir lo que está haciendo y buscar con la vista
qué lo causó, cada vez. En la práctica mucha gente termina apagando las
notificaciones: una alerta que no distingue entre urgente y trivial cansa más de
lo que sirve.

El resultado es que la información sonora de seguridad y convivencia —una
alarma, alguien llamándote, el llanto de un bebé en el cuarto de al lado— se
pierde.

El caso extremo en México es la **alerta sísmica**: da entre segundos y poco más
de un minuto de margen, y se distribuye por altavoces, radio y televisión. Todos
canales sonoros. Una persona sorda suele enterarse cuando ve correr a los demás,
y para entonces ya se consumió la ventaja que el sistema existe para dar.

Ver [IMPACTO.md](IMPACTO.md) para el desarrollo completo.

## La propuesta

No es una alerta. Es un **vocabulario**.

Cuatro patrones de vibración que se distinguen **por ritmo, no por duración**,
que es lo que permite reconocerlos con el teléfono en el bolsillo, sin mirar la
pantalla:

| Categoría | Qué es | Patrón (ms) |
|---|---|---|
| **Alarma** | Humo, sirena, algo que exige moverse ya | `[100,50,100,50,100,50,400]` |
| **Te buscan** | Timbre, tocan la puerta, teléfono, tu nombre | `[150,100,150]` |
| **Voces** | Conversación, risas, gente cerca | `[80,80,80,80,80]` |
| **Ambiente** | Tráfico, viento, ruido de fondo | `[40]` |

Tres decisiones de diseño que sostienen esto:

**La urgencia no cambia el patrón, lo repite.** Cambiar el ritmo según la
urgencia rompería el reconocimiento: la persona aprendió *un* patrón por
categoría.

**Lo ambiental casi no vibra** (`[40]`). Saturar de vibraciones es la forma más
rápida de que alguien apague la app.

**Solo son cuatro.** Un código nuevo no sirve si nadie lo aprende. Cuatro
patrones se memorizan en un minuto, y la app los muestra siempre en pantalla.

> No es braille. El braille es lectura táctil para personas ciegas. Esto es un
> código de vibración pensado para personas sordas.

---

## Cómo funciona

```
[Micrófono]  clips de 3.5 s
     │
     ▼
[Navegador]  WAV PCM 16 bit mono 16 kHz
     │       (el navegador ya trae el decodificador: cero ffmpeg en el servidor)
     ▼
[Backend]    audio ──▶ ESPECTROGRAMA PNG
     │                 (STFT, escala log en frecuencia, 80 dB de rango)
     ▼
[Gemma 4]    lee la imagen ──▶ {categoria, urgencia, etiqueta, reasoning}
     │       corriendo local en una Jetson Orin Nano de 8 GB
     ▼
[Navegador]  navigator.vibrate(patrón) + orbe + partitura, con los mismos ms
```

En paralelo, la **Web Speech API** reconoce el nombre de la persona en el
navegador. Ese aviso no pasa por Gemma: reconocer una palabra no necesita un LLM
y la latencia importa — si alguien te llama y te enteras cuatro segundos
después, ya no sirve.

---

## Por qué es técnicamente interesante

### Gemma 4 no puede oír, y no lo dice

El hallazgo que definió la arquitectura. `gemma4:e2b-it-qat` **no tiene encoder
de audio**. Ollama acepta el content part `input_audio`, decodifica el WAV,
responde `200 OK` con JSON válido — y el modelo nunca recibe el sonido: inventa
la respuesta desde el prompt.

Es la peor clase de falla, porque **no falla**. Los tests pasan, el health check
reporta verde, y el sistema clasifica a ciegas con respuestas verosímiles. Se
detectó mandando dos audios acústicamente opuestos y notando que devolvían
exactamente lo mismo.

**La solución: darle el sonido como imagen.** El clip se convierte a
espectrograma y se manda por el canal de visión, que sí funciona. El
espectrograma no es un truco: es la representación estándar en clasificación de
audio, la misma sobre la que operan las redes convolucionales del área. Lo que
cambia es que aquí la lee un modelo de propósito general por su capacidad
multimodal, sin entrenar nada.

Detalles y evidencia en [`handoff/HALLAZGO-AUDIO.md`](handoff/HALLAZGO-AUDIO.md).

### El modelo entero cabe en 8 GB, y eso obligó a decidir

La Jetson Orin Nano Super tiene **8 GB de memoria unificada**: la GPU comparte
RAM con el sistema. `gemma4:e4b-it-qat` no carga —pide ~7 GB contra ~6.4 GB
reales disponibles— así que el proyecto corre sobre `e2b-it-qat`, que ocupa
1.6 GB cargado y da ~29 tok/s.

Ese techo cambió el diseño: el prompt tuvo que hacerse **más corto**, no más
largo (ver [PRUEBAS.md](PRUEBAS.md)), y la clasificación se apoya en una imagen
pequeña en vez de contexto extenso.

### Privacidad como condición, no como argumento

El audio del cuarto de alguien **nunca sale del dispositivo**. Eso no es una
casilla de cumplimiento: es la condición para que una persona deje esto
encendido todo el día en su casa. Un sistema de escucha ambiental permanente que
manda audio a la nube no se adopta, y con razón.

*(Excepción honesta: la detección de nombre usa el reconocimiento de voz de
Chrome, que procesa en servidores de Google. Es opcional y se puede apagar; la
clasificación del entorno, que es lo que corre siempre, es 100% local.)*

### La vibración no se puede verificar, así que no se depende de ella

`navigator.vibrate()` devuelve `true` en escritorio y no pasa nada. La API no
permite confirmar que el dispositivo se movió. Por eso el patrón se emite por
**tres canales** alimentados por el mismo array de milisegundos: vibración,
destello en pantalla y un zumbido de 90 Hz.

Eso convierte una limitación en una función de accesibilidad: el patrón se
percibe por tacto, vista u oído, según lo que la persona y el aparato permitan.

---

## Correrlo

```bash
cp .env.example .env     # GEMMA_BASE_URL=http://127.0.0.1:11434/v1
./arrancar-demo.sh
```

Levanta el backend, sirve el frontend en el mismo origen y publica el túnel.

Abrir en **Android**: iOS no expone la API de vibración. En cualquier otro
dispositivo el patrón se ve y se oye igual.

Modo demo sin micrófono: [`/app.html?demo=1`](https://api.axolutions.dev/app.html?demo=1)

### Verificar la instalación

```bash
./dev-check.sh     # assets, errores de JS en headless, flujo completo
pytest -q          # 28 tests
```

---

## Estructura

```
app.py               API Flask: POST /clasificar, GET /salud, sirve el frontend
espectrograma.py     WAV -> PNG (STFT, escala log). El puente al canal de visión
prompt.py            Prompt de clasificación, con las variantes medidas documentadas
gemma_client.py      Única capa que habla con Gemma
validacion.py        Blindaje del contrato: nunca se devuelve algo fuera de forma

frontend/
  index.html         Landing, con hero en ASCII generado en tiempo real
  app.html           La app
  assets/js/
    config.js        Identidad del proyecto en un solo lugar
    patterns.js      El vocabulario háptico
    haptic-score.js  La partitura: el patrón dibujado a escala real de ms
    presentacion.js  Destello y zumbido — el patrón sin depender de vibración
    deteccion-nombre.js  Reconocimiento del nombre en el navegador
```

## Configurar

El nombre del proyecto, el tagline y los textos viven en
`frontend/assets/js/config.js`. Cambiar una línea los propaga a todo el sitio:
no hay texto de identidad escrito a mano en el HTML.

Para el video del hero: dejar el archivo en `frontend/assets/media/hero.mp4` y
se renderiza a ASCII en tiempo real. Sin archivo, corre una animación
generativa de ondas.

---

## A dónde va

- **Onboarding que enseña el código.** Gemma genera un tutorial conversacional
  con repetición espaciada: un vocabulario nuevo no sirve si no se aprende.
- **Perfil de sonidos personales.** La persona graba "este es mi timbre" y el
  modelo usa esos ejemplos como referencia in-context, sin entrenar nada.
- **Tono de conversación.** Detectar cuándo una charla cercana se vuelve tensa,
  que es contexto social, no solo seguridad.
