"""Prompt de clasificacion por espectrograma.

El clip NO se manda como audio: Gemma 4 no tiene encoder de audio y lo ignora
en silencio devolviendo 200 OK, inventando la respuesta. Se manda su
espectrograma como imagen. Evidencia en handoff/HALLAZGO-AUDIO.md

ESTE PROMPT ES EL QUE MEJOR MIDIO. No lo "mejoren" sin volver a medir.
--------------------------------------------------------------------
Sobre el mismo set de 4 audios sinteticos (pitido 3 kHz, ruido de banda ancha,
voz con armonicos, tres golpes aislados):

  este prompt, tabla simple, alarma primero .............. 3/4
  tabla mas detallada, con reglas de desempate ........... 1/4
  igual pero moviendo "social" al inicio de la lista ..... 2/4
  pedir observaciones visuales y mapear en Python ........ 1/4

Dos aprendizajes que valen mas que el prompt en si:

 1. e2b tiene un sesgo fuerte hacia la PRIMERA opcion de la lista. Cambiar el
    orden cambia el resultado mas que cambiar las descripciones. Por eso
    "alarma" va primero: en esta app un falso negativo de emergencia cuesta
    mucho mas que un falso positivo.
 2. Alargar el prompt lo empeora. Cada regla extra le quita precision. Si algo
    no funciona, la respuesta casi nunca es agregar mas texto.

Semantica de las categorias: definida en gemma/_prompt.py. Ojo que 'atencion' y 'social' no son lo que suenan: atencion = algo
te reclama directamente, social = hay voces alrededor.

PENDIENTE: los 4 audios de prueba son sinteticos. El de "voz" es un zumbido
armonico muy regular que se parece de verdad a una alarma en el espectrograma,
y es justo el que falla. Hay que volver a medir con grabaciones reales antes
de dar por buena la calidad.
"""

PROMPT_CLASIFICACION = """Estas viendo el ESPECTROGRAMA de un clip de audio del entorno de una persona sorda.
Eje X = tiempo. Eje Y = frecuencia (graves abajo, agudos arriba). Brillo = energia.

Paso 1. Describe en una frase la estructura visual que ves.

Paso 2. Aplica esta tabla de decision EN ORDEN. Detente en la primera que aplique:

 - Lineas o bandas nitidas, siempre a la misma altura, que se repiten prendiendo y apagando
   -> categoria "alarma", urgencia "alta"
   (alarma de humo, sirena, claxon insistente)

 - Muchas bandas finas apiladas que suben y bajan de altura juntas
   -> categoria "social", urgencia "media"
   (voces, conversacion, risas, gritos)

 - Pocos golpes de energia aislados, separados por silencio
   -> categoria "atencion", urgencia "media"
   (timbre, tocan la puerta, telefono, alguien dice tu nombre)

 - Textura granulada uniforme, sin estructura repetitiva ni bandas definidas
   -> categoria "ambiental", urgencia "baja"
   (trafico, aire acondicionado, viento, ruido de fondo)

NO elijas "ambiental" si ves estructura repetitiva nitida.

Paso 3. Responde UNICAMENTE este JSON, sin markdown ni texto alrededor:

{"categoria": "alarma|atencion|social|ambiental", "urgencia": "baja|media|alta", "etiqueta": "maximo 3 palabras", "reasoning": "que viste y por que decidiste eso"}
"""

CATEGORIAS_VALIDAS = ("alarma", "atencion", "social", "ambiental")
URGENCIAS_VALIDAS = ("baja", "media", "alta")
