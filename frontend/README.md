# Frontend — Agente 1

HTML, CSS y JS planos. Sin build, sin dependencias, sin `npm install`. Se abre
y funciona.

## Correrlo

```bash
cd frontend
python3 -m http.server 8842
```

Y abrir <http://localhost:8842>.

No sirve abrir el `index.html` con doble clic: `getUserMedia` exige un contexto
seguro y con `file://` ni siquiera existe el objeto.

## Cambiar el nombre del proyecto

Una sola línea, en `assets/js/config.js`:

```js
nombre: 'VibraContexto',
```

Se propaga solo al `<title>`, el header, el hero, el pie y la app. No hay
ningún nombre escrito a mano en el HTML — todo va por `data-cfg`. En el mismo
archivo están el tagline, la descripción y los créditos.

## Poner el video del hero

Dejen el archivo en `assets/media/hero.mp4` y ya. Se renderiza a ASCII en
tiempo real, sin tocar código. Si el archivo no existe corre una animación
generativa de ondas, así que el hero nunca se ve roto.

Que el video tenga **mucho contraste** — el ASCII aplasta los medios tonos y un
video plano se ve a puré. Corto (5-15s), sujeto claro sobre fondo oscuro.

## Verificarlo

```bash
./dev-check.sh
```

Levanta el servidor, comprueba que los 13 assets respondan 200, renderiza las
dos páginas en Chromium headless buscando errores de JS, y corre el flujo
completo en modo demo verificando que los eventos lleguen al historial.
Screenshots en `~/.vibra-check/`.

## Modo demo

<http://localhost:8842/app.html?demo=1>

Arranca solo, con eventos simulados y sin pedir micrófono. Recorre las cuatro
categorías en orden. Sirve para probar sin backend y como **plan B en el
escenario** si el micrófono falla o la sala está muy ruidosa.

---

## Para el agente 2 (backend)

El frontend ya habla tu contrato. No tienes que tocar nada de aquí.

```
POST /clasificar
→  { "audio_base64": "..." }          (webm/opus, sin el prefijo data:)
←  { "categoria": "alarma"|"atencion"|"social"|"ambiental",
     "urgencia":  "baja"|"media"|"alta",
     "etiqueta":  "alarma de humo",
     "reasoning": "..." }              (opcional)
```

Mientras no exista el endpoint, la UI corre con datos simulados. **En cuanto
respondas un 200 se cambia sola** — no hay que recargar ni cambiar un flag. El
indicador de la barra pasa de `simulado` a `real`.

Dónde apuntar el frontend, en `assets/js/config.js` → `api.endpoint`:

- Si tu backend sirve también esta carpeta como estáticos, déjalo en
  `/clasificar` y no hay CORS que resolver. **Es la opción recomendada para la
  demo final.**
- Si corres aparte durante el desarrollo, ponlo absoluto
  (`http://localhost:8100/clasificar`) y habilita CORS de tu lado.

Dos cosas que el frontend ya asume de ti:

- **Nunca dejes la petición colgada.** Hay un timeout de 20s; si lo pasas, la
  UI degrada a simulado y sigue viva, pero perdemos el evento.
- **Responde siempre el JSON completo**, aunque Gemma falle. Si mandas una
  categoría que no existe, se normaliza a `ambiental` en vez de romper.

## Para el agente 3 (Gemma)

Las cuatro categorías del contrato están en `assets/js/patterns.js`, cada una
con su patrón de vibración. Si cambias los nombres de las categorías, ese es el
único archivo del frontend que hay que tocar.

El campo `reasoning` ya se recibe y se guarda en el historial en memoria —
está listo para que lo saquen al writeup.

## Decisiones que vale la pena conocer

**Los patrones se distinguen por ritmo, no por duración.** Cuatro alertas que
solo varían en cuánto duran son indistinguibles en el bolsillo. Pulsos cortos
iguales para emergencia, dos golpes separados para "te hablan", tamborileo
parejo para avisos.

**La urgencia no cambia el patrón, lo repite.** Cambiar el ritmo según urgencia
rompería el reconocimiento: el usuario aprendió *un* patrón por categoría.

**Lo ambiental casi no vibra** (`[40]`). Saturar de vibraciones es la forma más
rápida de que alguien apague la app.

**El orbe y la partitura usan el mismo array que `navigator.vibrate()`**, así
que van en sync exacto y no "parecido". Eso es lo que permite que un juez con
un iPhone —donde la Vibration API no existe— igual entienda la propuesta: no lo
siente, pero lo ve.
