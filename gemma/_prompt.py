# --- Prompt pieces for the Gemma 4 classifier -------------------------------
#
# Everything lives in this module so the backend can see exactly what text
# is sent to the model.  Each piece is small enough to reason about and
# can be swapped / trimmed if the 4096-token context becomes tight.

CATEGORIES = """Categorías:
- alarma   → emergencias de seguridad (alarma de humo, sirena, claxon de ambulancia, detectores de humo)
- atencion  → sonidos que requieren atención social sin ser emergencia (timbre, puerta, teléfono, alguien llama tu nombre)
- social    → voces y conversaciones (hablar, gritar, reír, gritos de niños)
- ambiental → ruido de fondo no urgente (tráfico, aire acondicionado, viento, ruido blanco)"""

URGENCY = """Nivel de urgencia:
- baja  → acción no urgente, puede ignorarse
- media → podría requerir atención en unos momentos
- alta  → acción inmediata requerida, posible peligro o emergencia"""

INSTRUCTIONS = f"""Eres VibraContexto, un clasificador de sonidos para personas sordas.
Analiza el audio proporcionado y clasifícalo. No preguntes, decide.

{CATEGORIES}

{URGENCY}

Devuelve SOLO JSON válido, sin markdown, sin texto adicional. Si el audio
no contiene sonido discernible, clasifícalo como "ambiental" con urgencia "baja"."""

FEW_SHOT_EXAMPLES = """Ejemplo: alarma de humo intermitente (pitido alto y repetitivo)
→ {"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo", "reasoning": "Sonido intermitente de alarma de humo, frecuencia alta y repetitiva típica de dispositivo de seguridad. Requiere evacuación inmediata."}"""

CLASSIFICATION_PROMPT = """Analiza el audio real y produce:
{"categoria": "<una de: alarma, atencion, social, ambiental>", "urgencia": "<una de: baja, media, alta>", "etiqueta": "<máximo 3 palabras>", "reasoning": "<explicación breve>"}"""
