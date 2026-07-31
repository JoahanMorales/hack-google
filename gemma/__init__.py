from .prompt import build_prompt
from .client import GemmaClient
from .parser import parse_response, ValidationError, Classification
from .classifier import GemmaClassifier

# Convenience: module-level singleton so Agent 2 can do
#   from gemma import classify; classify(audio_b64)
_default_classifier: "GemmaClassifier | None" = None


def classify(
    audio_base64: str,
    audio_format: str = "wav",
    *,
    include_few_shot: bool = True,
) -> dict:
    """Classify audio and return the contract JSON dict.

    Lazy-initializes a single GemmaClassifier/GemmaClient pair.
    For full control over the client, use ``GemmaClassifier`` directly.
    """
    global _default_classifier
    if _default_classifier is None:
        _default_classifier = GemmaClassifier()
    return _default_classifier.classify(
        audio_base64,
        audio_format=audio_format,
        include_few_shot=include_few_shot,
    )


__all__ = [
    "build_prompt",
    "GemmaClient",
    "parse_response",
    "ValidationError",
    "Classification",
    "GemmaClassifier",
    "classify",
]
