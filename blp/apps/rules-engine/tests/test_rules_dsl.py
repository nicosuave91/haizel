"""Unit tests covering the custom JSON-Logic implementation."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.dsl.operators import EvaluationError, ExtendedJsonLogic


@pytest.fixture
def evaluator() -> ExtendedJsonLogic:
    return ExtendedJsonLogic()


def test_var_supports_nested_paths_and_defaults(evaluator: ExtendedJsonLogic) -> None:
    logic = {"var": "applicant.name"}
    result, trace = evaluator.evaluate(logic, {"applicant": {"name": "Ada"}})
    assert result == "Ada"
    assert trace[0]["operator"] == "var"
    assert trace[0]["arguments"]["value"] == "Ada"

    logic_with_default = {"var": ["applicant.credit_score", 640]}
    result, trace = evaluator.evaluate(logic_with_default, {"applicant": {"name": "Ada"}})
    assert result == 640
    assert trace[0]["arguments"]["default_used"] is True


def test_boolean_logic_short_circuits(evaluator: ExtendedJsonLogic) -> None:
    logic = {"and": [{">": [5, 4]}, {"==": ["yes", "yes"]}, {"var": ["missing", True]}]}
    result, trace = evaluator.evaluate(logic, {})
    assert result is True
    # Ensure the final branch evaluated to the default provided
    last_step = trace[0]["children"][-1]
    assert last_step["operator"] == "var"
    assert last_step["result"] is True

    logic = {"or": [{"==": [1, 2]}, {"==": [3, 3]}, {"var": "unreachable"}]}
    result, trace = evaluator.evaluate(logic, {})
    assert result is True
    # The third branch should not be evaluated due to short circuit
    assert len(trace[0]["children"]) == 2


def test_custom_collection_predicates(evaluator: ExtendedJsonLogic) -> None:
    context = {
        "applications": [
            {"debt_to_income": 0.32, "state": "CA"},
            {"debt_to_income": 0.45, "state": "WA"},
        ]
    }

    logic_all = {
        "bl_all": [
            {"var": "applications"},
            {"<": [{"var": "item.debt_to_income"}, 0.5]},
        ]
    }
    result, trace = evaluator.evaluate(logic_all, context)
    assert result is True
    assert trace[0]["operator"] == "bl_all"
    assert len(trace[0]["arguments"]) == 2

    logic_any = {
        "bl_any": [
            {"var": "applications"},
            {"==": [{"var": "item.state"}, "WA"]},
        ]
    }
    result, _ = evaluator.evaluate(logic_any, context)
    assert result is True

    logic_none = {
        "bl_none": [
            {"var": "applications"},
            {"<": [{"var": "item.debt_to_income"}, 0.3]},
        ]
    }
    result, _ = evaluator.evaluate(logic_none, context)
    assert result is True


def test_missing_operators_report_keys(evaluator: ExtendedJsonLogic) -> None:
    data = {"applicant": {"credit_score": 710}}
    logic_missing = {"missing": ["applicant.credit_score", "applicant.name"]}
    result, trace = evaluator.evaluate(logic_missing, data)
    assert result == ["applicant.name"]
    assert trace[0]["arguments"]["missing"] == ["applicant.name"]

    logic_missing_some = {"missing_some": [2, ["applicant.credit_score", "applicant.name", "applicant.email"]]}
    result, _ = evaluator.evaluate(logic_missing_some, data)
    assert sorted(result) == ["applicant.email", "applicant.name"]


def test_unknown_operator_raises_error(evaluator: ExtendedJsonLogic) -> None:
    with pytest.raises(EvaluationError):
        evaluator.evaluate({"unknown": []}, {})
