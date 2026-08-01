"""Servidor falso, compatible con la API de OpenAI, para desarrollar y
probar el backend sin gastar cuota del tunel real de Gemma.

Uso:
    python mock_gemma.py
    # en otra terminal, .env con GEMMA_BASE_URL=http://localhost:8899/v1

Comportamiento controlable via query string en /v1/chat/completions:
    ?modo=lento     -> tarda mas que GEMMA_TIMEOUT_S, para probar el timeout
    ?modo=error     -> responde 500
    ?modo=basura    -> content que no es JSON valido
    ?modo=sin_audio -> rechaza cualquier request con content part input_audio
    (default)       -> responde una clasificacion valida segun el texto del prompt
"""
import json
import time

from flask import Flask, jsonify, request

app = Flask(__name__)


def _tiene_input_audio(mensajes) -> bool:
    for m in mensajes:
        contenido = m.get("content")
        if isinstance(contenido, list):
            for parte in contenido:
                if parte.get("type") == "input_audio":
                    return True
    return False


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    modo = request.args.get("modo", "ok")
    cuerpo = request.get_json(force=True, silent=True) or {}
    mensajes = cuerpo.get("messages", [])

    if modo == "lento":
        time.sleep(20)
    elif modo == "error":
        return jsonify({"error": {"message": "fallo simulado"}}), 500
    elif modo == "sin_audio" and _tiene_input_audio(mensajes):
        return jsonify({"error": {"message": "input_audio no soportado"}}), 400

    if modo == "basura":
        contenido = "esto no es json { roto"
    else:
        contenido = json.dumps({
            "categoria": "alarma",
            "urgencia": "alta",
            "etiqueta": "alarma de humo (mock)",
        })

    return jsonify({
        "id": "mock-1",
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": contenido,
                "reasoning": "clasificado por el mock de Gemma, no el modelo real",
            },
            "finish_reason": "stop",
        }],
    })


if __name__ == "__main__":
    app.run(port=8899, debug=True)
