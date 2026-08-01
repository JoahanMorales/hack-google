# Guion — Video demo de Coralia

**Duración objetivo:** 60–90 s
**Target:** jurado de hackathon
**Formato:** screen recording en Android + voz en off

---

## Escena 1 — Hook (0:00 – 0:05)

**Visual:**
- Pantalla negra. Un solo zumbido grave de 90 Hz comienza.
- Aparece texto blanco grande, centrado:

  > **¿Y si no tuvieras que oír la alarma de humo para saber que tu casa está en riesgo?**

- El zumbido se detiene abruptamente. Silencio.

**Voz en off (tono directo, sin rodeos):**
> "Las alarmas suenan. Pero si no puedes oír, el sonido no te salva. Coralia lo traduce a vibraciones que sí sientes."

---

## Escena 2 — Landing (0:05 – 0:15)

**Visual:**
- Navegador Android abriendo `https://api.axolutions.dev`
- Hero con animación ASCII del video institucional.
- Se desplaza hacia abajo con un *scroll suave*.

**On-screen text (en orden de aparición):**
1. `Coralia · Siente tu espacio.`
2. Sección "El vocabulario": 4 tarjetas con partituras hápticas animadas
   - 🚨 Alarma — pulsos cortos y repetidos
   - 👋 Te buscan — dos golpes medianos
   - 🗣️ Voces — tamborileo parejo
   - 🌫️ Ambiente — un solo pulso leve

**Voz en off:**
> "Coralia es una web app que convierte el sonido en código de vibración. Solo necesitas un Android y el micrófono."

---

## Escena 3 — La app en acción (0:15 – 0:35)

**Visual:**
- Click en "Abrir la app" → navega a `app.html`
- Orbe central en estado *dormido* (gris, tenue)
- Aparece el nombre: "Avísame si dicen mi nombre"
- El usuario escribe: "María"
- Click en "Empezar a escuchar"

**On-screen:**
- El orbe cambia a *escuchando* (latido suave)
- Indicador: `simulado` → cambia a `real` (cuando Gemma responde)

**Voz en off:**
> "La app graba clips de 3.5 segundos en loop, los envía a Gemma 4 corriendo local en una Jetson, y el resultado vuelve como vibración en menos de dos segundos."

**Demo visual (simulado):**
- Aparece la tarjeta: "🔥 Alarma de humo" → orbe rojo pulsando en sincronía
- Aparece: "👋 María te llamó" → orbe ámbar, patrón [150,100,150]
- El historial se llena en la parte inferior

---

## Escena 4 — Plan B de escenario (0:35 – 0:45)

**Visual:**
- Aparece texto: "¿Y si el teléfono no vibra?"
- Click en "Probar vibración"
- La app detecta que no hay vibración y muestra: "Este dispositivo no puede vibrar. Usa el destello y el sonido."
- El orbe emite un **destello blanco** con el patrón mismo
- Un **zumbido de 90 Hz** sigue el ritmo
- Todo desde el teclado del presentador (escritorio)

**Voz en off:**
> "La demo nunca falla: si el celular no vibra, el patrón se emite por destello de pantalla y zumbido. Tres canales, un solo ritmo."

---

## Escena 5 — El hallazgo técnico (0:45 – 1:00)

**Visual:**
- Split screen: izquierda el waveform del audio, derecha el espectrograma PNG
- Flecha: "Gemma 4 no tiene encoder de audio → convertimos a imagen"
- Aparece el código del prompt (tabla de decisión visual)

**On-screen text:**
> "Descubrimos que Gemma 4 (vía Ollama) acepta audio pero lo ignora. La solución: convertir el clip a espectrograma y mandarlo como imagen. La visión funciona."

**Voz en off:**
> "No mandamos audio. Gemma 4 no lo procesa — lo acepta pero lo ignora. Convertimos el clip a un espectrograma y se lo mandamos como imagen. Un puente visual que funciona."

---

## Escena 6 — Casos de uso (1:00 – 1:15)

**Visual:**
- Tres viñetas rápidas con animación:
  1. 👶 "El bebé llora" — madre dormida, teléfono vibra suavemente en mesita
  2. 🔔 "Te llaman por tu nombre" — nombre "María" aparece, detección instantánea
  3. 🚨 "Alarma de incendio" — orbe rojo, vibración urgente, patrón distintivo

**Voz en off:**
> "Bebé que llora, tu nombre entre el ruido, una alarma de incendios... Cada sonido suena distinto en tu piel. Eso no es un buzz — es una palabra háptica."

---

## Escena 7 — Cierre / Pitch (1:15 – 1:30)

**Visual:**
- Regreso al orbe, ahora en reposo
- Texto centrado grande:

  > **No es otro wearable que vibra.
  > Es un lenguaje nuevo para sentir el mundo.**

- Aparece el branding:
  > Coralia · Hackday Gemma 4 · GDG CDMX
  > Modelo: Gemma 4 · e2b-it-qat · on-device

**Voz en off (más pausado, enfático):**
> "La privacidad no es un detalle: Gemma corre en tu dispositivo. El audio del cuarto nunca sale a un servidor. Eso no es una característica... es la condición para que alguien lo deje encendido todo el día. Porque sentir tu espacio también te deja sentirlo todo el tiempo. Gracias."

---

## Notas de producción

- **Demo sin micrófono:** usar `/app.html?demo=1` — el mock simula los 4 patrones en secuencia
- **Orden de patrones en demo:** ambiental → social → atención → alarma (progresión narrativa)
- **Timing de vibración:** cada patrón dura ~500-750ms; el orbe pulsa en sincronía exacta
- **Background:** grabar en un cuarto real con sonidos ambientales suaves; cortar a Android para la app
- **Corte final:** logo de Coralia en dark mode con el eslogan
