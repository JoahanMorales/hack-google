from __future__ import annotations

import json
import re
from dataclasses import dataclass

# — Valid categories / urgency levels (the API contract) -------------------
VALID_CATEGORIES = ("alarma", "atencion", "social", "ambiental")
VALID_URGENCY = ("baja", "media", "alta")


class ValidationError(ValueError):
    """Raised when Gemma's output doesn't match the contract."""


@dataclass(frozen=True)
class Classification:
    categoria: str
    urgencia: str
    etiqueta: str
    reasoning: str

    def to_dict(self) -> dict:
        return {
            "categoria": self.categoria,
            "urgencia": self.urgencia,
            "etiqueta": self.etiqueta,
            "reasoning": self.reasoning,
        }


def _strip_markdown(text: str) -> str:
    """Remove `````json ... ````` fences if present."""
    text = text.strip()
    m = re.search(r"```(?:json|)\n(.*)\n```", text, re.DOTALL)
    if m:
        return m.group(1)
    return text


def parse_response(raw: str) -> Classification:
    """Parse Gemma's raw text output into a validated ``Classification``.

    Handles common LLM quirks:
      - Markdown fences around JSON
      - Surrounding prose / whitespace
      - Trailing commas
    """
    if not raw or not raw.strip():
        raise ValidationError("Empty response from model")

    text = _strip_markdown(raw)

    # Try a direct JSON parse first
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Fall back: extract the first `{...}` block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            raise ValidationError(f"No JSON object found in response:\n{raw}")
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            # Last resort: strip trailing commas and retry
            cleaned = re.sub(r",\s*([}\]])", r"\1", m.group(0))
            data = json.loads(cleaned)

    if not isinstance(data, dict):
        raise ValidationError("Parsed JSON is not an object")

    # Required fields
    categoria = data.get("categoria")
    urgencia = data.get("urgencia")
    etiqueta = data.get("etiqueta")

    if categoria not in VALID_CATEGORIES:
        raise ValidationError(
            f"categoria '{categoria}' not in {VALID_CATEGORIES}"
        )
    if urgencia not in VALID_URGENCY:
        raise ValidationError(
            f"urgencia '{urgencia}' not in {VALID_URGENCY}"
        )
    if not etiqueta or not isinstance(etiqueta, str):
        raise ValidationError("etiqueta is required and must be a non-empty string")

    # reasoning is optional in the contract but we capture it when present
    reasoning = data.get("reasoning", "")
    if reasoning is None:
        reasoning = ""

    return Classification(
        categoria=categoria,
        urgencia=urgencia,
        etiqueta=etiqueta.strip(),
        reasoning=str(reasoning).strip(),
    )
