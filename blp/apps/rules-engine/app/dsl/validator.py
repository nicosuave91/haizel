"""Schema validation for JSON-Logic expressions used by the rules engine."""

from __future__ import annotations

from typing import Any, Iterable

from app.dsl.operators import EvaluationError, ExtendedJsonLogic


class LogicValidator:
    """Validate JSON-Logic expressions before persisting them in the catalog."""

    def __init__(self, evaluator: ExtendedJsonLogic | None = None) -> None:
        self._evaluator = evaluator or ExtendedJsonLogic()
        self._operators = self._evaluator.supported_operators()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def validate(self, expression: Any) -> None:
        """Validate the provided JSON-Logic expression.

        Parameters
        ----------
        expression:
            Arbitrary JSON compatible data representing a JSON-Logic expression.

        Raises
        ------
        EvaluationError
            If the expression contains structural mistakes or unsupported operators.
        """

        self._validate_node(expression, path="$")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _validate_node(self, expression: Any, path: str) -> None:
        if isinstance(expression, dict):
            if len(expression) != 1:
                raise EvaluationError(
                    "Each JSON-Logic node must contain exactly one operator"
                )

            operator, args = next(iter(expression.items()))
            if operator not in self._operators:
                raise EvaluationError(f"Unsupported operator '{operator}'")

            self._validate_arguments(args, f"{path}.{operator}")
            return

        if isinstance(expression, list):
            for idx, item in enumerate(expression):
                self._validate_node(item, f"{path}[{idx}]")
            return

        if self._is_scalar(expression):
            return

        raise EvaluationError(f"Unsupported value type at {path}: {type(expression)!r}")

    def _validate_arguments(self, args: Any, path: str) -> None:
        if isinstance(args, list):
            for idx, item in enumerate(args):
                self._validate_node(item, f"{path}[{idx}]")
            return

        if isinstance(args, dict):
            for key, value in args.items():
                self._validate_node(value, f"{path}.{key}")
            return

        if self._is_scalar(args):
            return

        raise EvaluationError(f"Unsupported argument type at {path}: {type(args)!r}")

    def _is_scalar(self, value: Any) -> bool:
        scalar_types: Iterable[type[Any]] = (str, int, float, bool, type(None))
        return isinstance(value, scalar_types)


validator = LogicValidator()


def get_logic_validator() -> LogicValidator:
    """Return the singleton validator instance used by services."""

    return validator
