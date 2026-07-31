"""Shared test fixtures for the Gemma integration test-suite."""
import pytest

from gemma.client import GemmaClient


class MockGemmaClient(GemmaClient):
    """A stub GemmaClient that returns canned responses instead of
    hitting the real endpoint.  Lets us test the full classify→parse
    pipeline without network access or the Cloudflare tunnel."""

    def __init__(self) -> None:
        # Bypass the env-var check — we don't need real credentials in tests.
        self.base_url = "https://mock.local"
        self.api_key = "x"
        self.timeout = 1.0
        self.client = None
        self._responses: list[str] = []

    def queue(self, response_text: str) -> None:
        """Queue a canned response (FIFO)."""
        self._responses.append(response_text)

    def classify(
        self,
        prompt_text: str,
        audio_base64: str,
        audio_format: str = "wav",
        model: str = "gemma4:e2b-it-qat",
    ) -> str:
        if not self._responses:
            raise RuntimeError("No mock responses queued — did you forget client.queue()?")
        return self._responses.pop(0)


@pytest.fixture
def mock_client() -> MockGemmaClient:
    return MockGemmaClient()


@pytest.fixture
def sample_audio_b64() -> str:
    """A tiny dummy base64 blob representing ~3s of audio."""
    return "UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVgAAAAA//8AAP//AAD//wAA"
