"""Prompt de clasificacion de audio.

OJO: este archivo es un placeholder funcional. El diseno y afinado del prompt
(few-shot, deteccion de nombre propio, reduccion de falsos positivos) es
dominio del Agente 3 (Integracion Gemma & Prompt Engineering) segun el README
raiz - cualquier cambio a los campos del contrato pasa por ahi.
"""

PROMPT_CLASIFICACION = """Escuchas un clip corto de audio del entorno para una persona sorda.
Clasifica el sonido y responde UNICAMENTE con un objeto JSON, sin texto adicional
ni bloques de codigo, con esta forma exacta:

{
  "categoria": "alarma" | "atencion" | "social" | "ambiental",
  "urgencia": "baja" | "media" | "alta",
  "etiqueta": "string corto describiendo el sonido, ej. 'alarma de humo'",
  "reasoning": "breve explicacion de por que elegiste esa categoria"
}

Guia de categorias:
- alarma: alarmas, sirenas, humo, situaciones de emergencia -> urgencia alta
- atencion: alguien llamando o hablandole directamente a la persona -> urgencia media
- social: timbre, tocan la puerta, telefono sonando -> urgencia media o baja
- ambiental: trafico, ruido de fondo, sonidos neutros sin relevancia -> urgencia baja

Responde solo el JSON.
"""