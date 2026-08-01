from __future__ import annotations

from gemma._prompt import CLASSIFICATION_PROMPT, INSTRUCTIONS, CATEGORIES, URGENCY, FEW_SHOT_EXAMPLES


def build_prompt(
    *,
    include_few_shot: bool = True,
    include_reasoning: bool = True,
) -> str:
    """Build the text instruction sent to Gemma 4 alongside the audio.

    The prompt is intentionally compact — the 4096-token context budget
    must leave room for Gemma's own *reasoning* + *content* outputs plus
    the base64 payload overhead — so we keep instructions tight and rely
    on a single high-signal few-shot example rather than long chains.
    """
    parts: list[str] = [INSTRUCTIONS]

    if include_few_shot:
        parts.append(FEW_SHOT_EXAMPLES)

    parts.append(CLASSIFICATION_PROMPT)
    return "\n\n".join(parts)
