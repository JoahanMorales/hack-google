from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Optional

from gemma.prompt import build_prompt as _build_prompt
from gemma.client import GemmaClient
from gemma.parser import Classification, ValidationError, parse_response

logger = logging.getLogger("vibra.gemma")

# Re-export the public function name Agent 2 expects
build_prompt = _build_prompt


class GemmaClassifier:
    """High-level facade: audio base64 → contract JSON dict.

    Usage (from Agent 2's Flask/Node route):

        classifier = GemmaClassifier()
        result = classifier.classify(audio_base64)
        return jsonify(result)
    """

    def __init__(self, client: Optional[GemmaClient] = None) -> None:
        self.client = client or GemmaClient()

    def classify(
        self,
        audio_base64: str,
        audio_format: str = "wav",
        *,
        include_few_shot: bool = True,
        temperature: float = 0.1,
    ) -> dict:
        """Classify an audio clip and return the contract JSON dict.

        Returns:
            {
                "categoria": "alarma" | "atencion" | "social" | "ambiental",
                "urgencia": "baja" | "media" | "alta",
                "etiqueta": "string",
                "reasoning": "string"
            }

        Raises:
            ValidationError: if the model output can't be parsed / validated
            RuntimeError:    if the Gemma endpoint is unreachable
        """
        prompt = build_prompt(include_few_shot=include_few_shot)

        try:
            raw = self.client.classify(
                prompt_text=prompt,
                audio_base64=audio_base64,
                audio_format=audio_format,
            )
        except Exception as exc:
            logger.error("Gemma call failed: %s", exc)
            raise

        parsed: Classification = parse_response(raw)
        logger.info(
            "Classified: categoria=%s, urgencia=%s, etiqueta=%s",
            parsed.categoria, parsed.urgencia, parsed.etiqueta,
        )
        return asdict(parsed)
