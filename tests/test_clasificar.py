"""Tests del contrato de /clasificar - caminos de exito y de error.

No requieren el tunel real: parchan gemma_client.clasificar_audio.
"""
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import app as app_module
import gemma_client
from validacion import respuesta_contrato

AUDIO_B64_VALIDO = base64.b64encode(b"clip de audio de prueba").decode()

CAMPOS_CONTRATO = {"categoria", "urgencia", "etiqueta", "reasoning"}


@pytest.fixture
def cliente():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_respuesta_valida_cumple_contrato(cliente, monkeypatch):
    esperado = respuesta_contrato("alarma", "alta", "alarma de humo", reasoning="huele a humo")
    monkeypatch.setattr(gemma_client, "clasificar_audio", lambda audio_b64, mime: (esperado, False))

    resp = cliente.post("/clasificar", json={"audio_base64": AUDIO_B64_VALIDO})

    assert resp.status_code == 200
    assert resp.headers["X-Vibra-Estado"] == "ok"
    cuerpo = resp.get_json()
    assert set(cuerpo.keys()) == CAMPOS_CONTRATO
    assert cuerpo["categoria"] == "alarma"
    assert cuerpo["urgencia"] == "alta"


def test_audio_faltante_da_400_con_forma_de_contrato(cliente):
    resp = cliente.post("/clasificar", json={})

    assert resp.status_code == 400
    assert resp.headers["X-Vibra-Estado"] == "degradado"
    cuerpo = resp.get_json()
    assert set(cuerpo.keys()) == CAMPOS_CONTRATO
    assert cuerpo["categoria"] == "ambiental"


def test_audio_base64_invalido_da_400(cliente):
    resp = cliente.post("/clasificar", json={"audio_base64": "no-es-base64!!"})

    assert resp.status_code == 400
    cuerpo = resp.get_json()
    assert set(cuerpo.keys()) == CAMPOS_CONTRATO


def test_sin_json_da_400(cliente):
    resp = cliente.post("/clasificar", data="no soy json", content_type="text/plain")

    assert resp.status_code == 400
    assert set(resp.get_json().keys()) == CAMPOS_CONTRATO


def test_timeout_de_gemma_degrada_pero_responde_200(cliente, monkeypatch):
    degradado = respuesta_contrato("ambiental", "baja", "", reasoning="timeout de Gemma")
    monkeypatch.setattr(gemma_client, "clasificar_audio", lambda audio_b64, mime: (degradado, True))

    resp = cliente.post("/clasificar", json={"audio_base64": AUDIO_B64_VALIDO})

    assert resp.status_code == 200
    assert resp.headers["X-Vibra-Estado"] == "degradado"
    assert set(resp.get_json().keys()) == CAMPOS_CONTRATO


def test_gemma_caida_degrada_pero_responde_200(cliente, monkeypatch):
    degradado = respuesta_contrato("ambiental", "baja", "", reasoning="Gemma no disponible")
    monkeypatch.setattr(gemma_client, "clasificar_audio", lambda audio_b64, mime: (degradado, True))

    resp = cliente.post("/clasificar", json={"audio_base64": AUDIO_B64_VALIDO})

    assert resp.status_code == 200
    assert resp.headers["X-Vibra-Estado"] == "degradado"


def test_enum_invalido_de_gemma_se_normaliza():
    # respuesta_contrato es lo que usa gemma_client para normalizar - se
    # prueba directo, sin pasar por HTTP.
    normalizado = respuesta_contrato("categoria-inventada", "urgencia-rara", "algo")
    assert normalizado["categoria"] == "ambiental"
    assert normalizado["urgencia"] == "baja"


def test_backend_saturado_degrada_sin_llamar_a_gemma(cliente, monkeypatch):
    import threading

    llamado = {"veces": 0}

    def fake_clasificar(audio_b64, mime):
        llamado["veces"] += 1
        return respuesta_contrato("alarma", "alta", "x"), False

    monkeypatch.setattr(gemma_client, "clasificar_audio", fake_clasificar)
    # Semaforo sin permisos disponibles, para forzar la saturacion sin
    # depender del valor configurado de GEMMA_MAX_CONCURRENTES.
    monkeypatch.setattr(app_module, "_semaforo_gemma", threading.Semaphore(0))

    resp = cliente.post("/clasificar", json={"audio_base64": AUDIO_B64_VALIDO})
    assert resp.status_code == 200
    assert resp.headers["X-Vibra-Estado"] == "degradado"
    assert llamado["veces"] == 0