#!/usr/bin/env python3
"""Manual testing for Agent 3.

Tests the full classify→parse pipeline with mock Gemma responses,
simulating the variety of real-world audio clips (alarm, voice, ambient).

Run:  python test_prompt.py
"""
import sys

# Windows console doesn't default to UTF-8 — enable emoji support
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import base64

from gemma import GemmaClassifier, build_prompt
from gemma.parser import ValidationError
from tests.conftest import MockGemmaClient

# Simulated Gemma outputs for different audio types (what Gemma *should*
# return when it hears the corresponding sound).  In real use, Gemma
# generates these dynamically.
MOCK_SCENARIOS = {
    "🔥 alarma de humo": {
        "prompt": "alarma intermitente, frecuencia alta y repetitiva",
        "response": '{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo", "reasoning": "Sonido intermitente de alarma de humo, pitido alto y repetitivo. Emergencia de seguridad"}',
    },
    "👋 alguien llama tu nombre": {
        "prompt": "voz humana diciendo tu nombre",
        "response": '{"categoria": "atencion", "urgencia": "media", "etiqueta": "llamando tu nombre", "reasoning": "Voz humana clara pronunciando un nombre propio, tono de llamada a la atencion"}',
    },
    "🔔 timbre de puerta": {
        "prompt": "doorbell sonando",
        "response": '{"categoria": "atencion", "urgencia": "baja", "etiqueta": "timbre de puerta", "reasoning": "Sonido de timbre domestico, evento social rutinario"}',
    },
    "🌫️ tráfico de fondo": {
        "prompt": "ruido continuo de trafico",
        "response": '{"categoria": "ambiental", "urgencia": "baja", "etiqueta": "ruido de trafico", "reasoning": "Sonido continuo de fondo, vehiculos pasando. No requiere accion"}',
    },
    "🗣️ conversación grupal": {
        "prompt": "dos o mas voces hablando",
        "response": '{"categoria": "social", "urgencia": "baja", "etiqueta": "conversacion grupal", "reasoning": "Voces humanas multiples intercambiando palabras, tono social normal"}',
    },
    "🚨 sirena de ambulancia": {
        "prompt": "sirena de emergencia",
        "response": '{"categoria": "alarma", "urgencia": "alta", "etiqueta": "sirena de ambulancia", "reasoning": "Sirena de emergencia con tono modulado ascendente, requiere paso inmediato"}',
    },
}


def _fake_audio(n: int = 50) -> str:
    """Generate a dummy base64 audio blob of roughly *n* bytes."""
    return base64.b64encode(b"\0" * n).decode("ascii")


def main() -> int:
    print("=" * 64)
    print("Agent 3 — Gemma 4 classification pipeline (mocked)")
    print("=" * 64)

    # 1. Show the prompt that gets sent to Gemma
    prompt = build_prompt()
    print(f"\n📝 Prompt ({len(prompt)} chars, {len(prompt) // 4} tokens est.):\n")
    print(prompt)
    print("\n" + "-" * 64)

    # 2. Run each scenario through the full pipeline
    client = MockGemmaClient()
    classifier = GemmaClassifier(client=client)
    audio = _fake_audio()

    all_pass = True
    for label, scenario in MOCK_SCENARIOS.items():
        print(f"\n📋 {label}")
        print(f"   Sonido: {scenario['prompt']}")
        client.queue(scenario["response"])
        try:
            result = classifier.classify(audio)
            print(f"   ✓ categoria : {result['categoria']}")
            print(f"   ✓ urgencia  : {result['urgencia']}")
            print(f"   ✓ etiqueta  : {result['etiqueta']}")
            print(f"   ✓ reasoning : {result['reasoning']}")
        except ValidationError as e:
            print(f"   ✗ ValidationError: {e}")
            all_pass = False

    print("\n" + "-" * 64)
    if all_pass:
        print("✅ Todos los escenarios pasaron")
        return 0
    else:
        print("❌ Algunos escenarios fallaron")
        return 1


if __name__ == "__main__":
    sys.exit(main())
