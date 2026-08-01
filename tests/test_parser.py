import pytest

from gemma.parser import (
    VALID_CATEGORIES,
    VALID_URGENCY,
    ValidationError,
    parse_response,
)


# — Valid responses ---------------------------------------------------------

@pytest.mark.parametrize("raw", [
    '{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo", "reasoning": "Sonido intermitente"}',
    '```json\n{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo", "reasoning": "Sonido intermitente"}\n```',
    'Aquí va mi análisis:\n{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo"}\n',
    '{"categoria": "alarma", "urgencia": "alta", "etiqueta": "alarma de humo",}',
])
def test_parse_valid_response(raw):
    result = parse_response(raw)
    assert result.categoria == "alarma"
    assert result.urgencia == "alta"
    assert result.etiqueta == "alarma de humo"
    # reasoning is present only in the first two cases
    if "reasoning" in raw:
        assert result.reasoning == "Sonido intermitente"
    else:
        assert result.reasoning == ""


def test_parse_without_reasoning():
    """reasoning is optional in the contract."""
    result = parse_response(
        '{"categoria": "social", "urgencia": "media", "etiqueta": "hablar"}'
    )
    assert result.reasoning == ""
    assert result.categoria == "social"


# — Invalid responses -------------------------------------------------------

@pytest.mark.parametrize("bad", [
    "",                           # empty
    "no json here at all",        # no JSON
    '{"categoria": "invalid"}',   # missing fields
    '{"categoria": "foo", "urgencia": "alta", "etiqueta": "x"}',  # bad category
    '{"categoria": "alarma", "urgencia": "critica", "etiqueta": "x"}',  # bad urgency
    '{"categoria": "alarma", "urgencia": "alta"}',  # missing etiqueta
    '{"categoria": "alarma", "urgencia": "alta", "etiqueta": ""}',  # empty etiqueta
])
def test_parse_invalid_response(bad):
    with pytest.raises(ValidationError):
        parse_response(bad)


def test_all_categories_accepted():
    for cat in VALID_CATEGORIES:
        result = parse_response(
            f'{{"categoria": "{cat}", "urgencia": "baja", "etiqueta": "test"}}'
        )
        assert result.categoria == cat


def test_all_urgency_levels_accepted():
    for urg in VALID_URGENCY:
        result = parse_response(
            f'{{"categoria": "alarma", "urgencia": "{urg}", "etiqueta": "test"}}'
        )
        assert result.urgencia == urg


def test_to_dict_matches_contract():
    result = parse_response(
        '{"categoria": "atencion", "urgencia": "media", "etiqueta": "timbre", "reasoning": "..."}'
    )
    d = result.to_dict()
    assert set(d.keys()) == {"categoria", "urgencia", "etiqueta", "reasoning"}
    assert d["categoria"] == "atencion"
    assert d["urgencia"] == "media"
