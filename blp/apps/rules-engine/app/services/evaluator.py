"""Service responsible for evaluating JSON-Logic expressions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from app.dsl.operators import ExtendedJsonLogic
from app.models.schemas import TraceStep


@dataclass
class EvaluationResult:
    """Container for evaluation results and explainability metadata."""

    result: Any
    trace: List[TraceStep]


class EvaluatorService:
    """Wrapper around :class:`ExtendedJsonLogic` providing structured results."""

    def __init__(self, evaluator: ExtendedJsonLogic | None = None) -> None:
        self._dsl = evaluator or ExtendedJsonLogic()

    def evaluate(self, logic: Dict[str, Any], context: Dict[str, Any]) -> EvaluationResult:
        """Evaluate the expression and convert traces into Pydantic models."""

        value, raw_trace = self._dsl.evaluate(logic, context)
        trace = self._convert_trace(raw_trace)
        return EvaluationResult(result=value, trace=trace)

    def _convert_trace(self, steps: List[Dict[str, Any]]) -> List[TraceStep]:
        converted: List[TraceStep] = []
        for step in steps:
            children = self._convert_trace(step.get("children", [])) if step.get("children") else []
            payload = dict(step)
            payload["children"] = children
            converted.append(TraceStep.model_validate(payload))
        return converted


_evaluator_service = EvaluatorService()


def get_evaluator_service() -> EvaluatorService:
    """Return the singleton evaluator service."""

    return _evaluator_service
