from __future__ import annotations

import base64
import logging
import os
import time
from typing import Any, Optional

from openai import OpenAI

logger = logging.getLogger("vibra.gemma")


class GemmaClient:
    """Thin wrapper around the OpenAI-compatible Gemma 4 endpoint.

    The endpoint runs behind a Cloudflare tunnel — the base URL and
    (placeholder) API key are read from environment variables so they
    never end up in the repo.

    Env vars:
        GEMMA_BASE_URL  — full tunnel URL (e.g. https://abcd.myshopify.dev)
        GEMMA_API_KEY   — any string (the local endpoint doesn't validate)
        GEMMA_TIMEOUT   — request timeout in seconds (default 60)
    """

    def __init__(self) -> None:
        self.base_url = self._require("GEMMA_BASE_URL")
        # The key is not validated by the local endpoint, but the OpenAI
        # SDK requires *something* non-empty.
        self.api_key = os.environ.get("GEMMA_API_KEY", "x")
        self.timeout = float(os.environ.get("GEMMA_TIMEOUT", "60"))

        self.client = OpenAI(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self.timeout,
            max_retries=2,
        )

    @staticmethod
    def _require(name: str) -> str:
        val = os.environ.get(name)
        if not val:
            raise RuntimeError(
                f"{name} is not set — configure your .env file"
            )
        return val

    def classify(
        self,
        prompt_text: str,
        audio_base64: str,
        audio_format: str = "wav",
        model: str = "gemma4:e2b-it-qat",
    ) -> str:
        """Send audio + prompt to Gemma 4 and return the raw text response.

        ``audio_base64`` must be base64-encoded audio data (no data URI
        prefix).
        """
        t0 = time.time()
        logger.debug(
            "Sending request to Gemma (model=%s, audio_fmt=%s, audio_b64_len=%d)",
            model, audio_format, len(audio_base64),
        )

        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": audio_base64,
                                "format": audio_format,
                            },
                        },
                    ],
                }
            ],
        )

        elapsed = time.time() - t0

        content = response.choices[0].message.content
        reasoning = getattr(response.choices[0].message, "reasoning", None)

        if reasoning:
            logger.info(
                "Gemma responded in %.1fs with reasoning (%d chars)",
                elapsed, len(reasoning),
            )
        else:
            logger.info(
                "Gemma responded in %.1fs (reasoning field empty)", elapsed
            )

        if not content:
            raise RuntimeError("Gemma returned an empty content field")

        return content

    @staticmethod
    def encode_audio(raw_bytes: bytes) -> str:
        """Base64-encode raw audio bytes (no data-URI prefix)."""
        return base64.b64encode(raw_bytes).decode("ascii")

    @staticmethod
    def from_wav_file(path: str) -> str:
        """Convenience: read a WAV file and return base64 string."""
        with open(path, "rb") as f:
            return GemmaClient.encode_audio(f.read())
