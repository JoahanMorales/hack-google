"""End-to-end test of the classification pipeline using the mock client.

This validates that build_prompt → client.classify → parse_response
produce a contract-compliant dict — exactly what the Flask
endpoint will rely on.
"""
import json

import pytest

from gemma import GemmaClassifier
from gemma.prompt import build_prompt


def test_full_pipeline_with_mock(mock_client, sample_audio_b64):
    mock_client.queue(
        '{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo", "reasoning": "pitido intermitente classico"}'
    )

    classifier = GemmaClassifier(client=mock_client)
    result = classifier.classify(sample_audio_b64)

    # Must match the API contract exactly
    assert set(result.keys()) == {"categoria", "urgencia", "etiqueta", "reasoning"}
    assert result["categoria"] == "alarma"
    assert result["urgencia"] == "alta"
    assert result["etiqueta"] == "alarma de humo"
    assert result["reasoning"]


def test_pipeline_serialises_to_json(mock_client, sample_audio_b64):
    """The output must be JSON-serialisable for the Flask jsonify() call."""
    mock_client.queue(
        '{"categoria": "social", "urgencia": "baja", "etiqueta": "voz distante", "reasoning": "conversacion lejana"}'
    )
    classifier = GemmaClassifier(client=mock_client)
    result = classifier.classify(sample_audio_b64)
    # Should not raise
    json.dumps(result)


def test_prompt_is_compact_within_context_budget():
    """The prompt text should be well under 4096 tokens.

    Rule of thumb: 1 token ≈ 4 chars for Spanish text.  Our prompt
    should stay under ~3 000 chars to leave room for the audio tokens
    and Gemma's output.
    """
    prompt = build_prompt()
    char_count = len(prompt)
    # 4 chars/token heuristic → 3000 chars ≈ 750 tokens
    assert char_count < 3500, (
        f"Prompt is {char_count} chars — too large for 4096-token context"
    )


def test_pipeline_handles_markdown_fences(mock_client, sample_audio_b64):
    """Gemma often wraps JSON in markdown code fences."""
    mock_client.queue(
        '```json\n{"categoria": "atencion", "urgencia": "media", "etiqueta": "timbre de puerta"}\n```'
    )
    classifier = GemmaClassifier(client=mock_client)
    result = classifier.classify(sample_audio_b64)
    assert result["categoria"] == "atencion"
    assert result["etiqueta"] == "timbre de puerta"
    assert result["reasoning"] == ""


def test_pipeline_raises_on_bad_output(mock_client, sample_audio_b64):
    mock_client.queue("no json at all here")
    classifier = GemmaClassifier(client=mock_client)
    with pytest.raises(Exception):
        classifier.classify(sample_audio_b64)
