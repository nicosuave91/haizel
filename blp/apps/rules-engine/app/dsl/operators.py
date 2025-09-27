"""Extended JSON-Logic evaluator with custom operators."""

from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Optional


class EvaluationError(Exception):
    """Raised when an invalid expression is encountered during evaluation."""


ArgEvaluator = Callable[[Any, str, Optional[Dict[str, Any]]], Any]


class ExtendedJsonLogic:
    """Evaluate JSON-Logic expressions with additional domain specific operators."""

    def __init__(self) -> None:
        self._operators: Dict[str, Callable[[Any, Dict[str, Any], ArgEvaluator], tuple[Any, Any]]]
        self._operators = {}
        self._register_core_operators()
        self._register_custom_operators()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def evaluate(self, expression: Any, data: Dict[str, Any]) -> tuple[Any, List[Dict[str, Any]]]:
        """Evaluate an expression returning both the result and the explainability trace."""

        trace: List[Dict[str, Any]] = []
        result = self._eval(expression, data, trace, path="$")
        return result, trace

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _eval(self, expression: Any, data: Dict[str, Any], trace: List[Dict[str, Any]], path: str) -> Any:
        if isinstance(expression, dict):
            if len(expression) != 1:
                raise EvaluationError("Each JSON-Logic node must contain exactly one operator")

            operator, raw_args = next(iter(expression.items()))
            fn = self._operators.get(operator)
            if fn is None:
                raise EvaluationError(f"Unsupported operator '{operator}'")

            children: List[Dict[str, Any]] = []

            def eval_child(child_expr: Any, child_path: str, scope: Optional[Dict[str, Any]] = None) -> Any:
                return self._eval(
                    child_expr,
                    scope if scope is not None else data,
                    children,
                    f"{path}.{child_path}" if path else child_path,
                )

            result, argument_debug = fn(raw_args, data, eval_child)
            step: Dict[str, Any] = {"path": path, "operator": operator, "result": result}
            if argument_debug is not None:
                step["arguments"] = argument_debug
            if children:
                step["children"] = children
            trace.append(step)
            return result

        if isinstance(expression, list):
            return [self._eval(item, data, trace, f"{path}[{idx}]") for idx, item in enumerate(expression)]

        return expression

    def _register(self, name: str, func: Callable[[Any, Dict[str, Any], ArgEvaluator], tuple[Any, Any]]) -> None:
        self._operators[name] = func

    def _register_core_operators(self) -> None:
        self._register("var", self._op_var)
        self._register("and", self._op_and)
        self._register("or", self._op_or)
        self._register("!", self._op_not)
        self._register("if", self._op_if)
        self._register("in", self._op_in)
        self._register("missing", self._op_missing)
        self._register("missing_some", self._op_missing_some)
        self._register("==", self._op_equal)
        self._register("!=", self._op_not_equal)
        self._register(">", self._op_greater)
        self._register(">=", self._op_greater_equal)
        self._register("<", self._op_less)
        self._register("<=", self._op_less_equal)
        self._register("+", self._op_add)
        self._register("-", self._op_subtract)
        self._register("*", self._op_multiply)
        self._register("/", self._op_divide)
        self._register("max", self._op_max)
        self._register("min", self._op_min)

    def _register_custom_operators(self) -> None:
        self._register("bl_all", self._op_bl_all)
        self._register("bl_any", self._op_bl_any)
        self._register("bl_none", self._op_bl_none)

    # ------------------------------------------------------------------
    # Operator implementations
    # ------------------------------------------------------------------
    def _op_var(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        path: Optional[str]
        default_expr: Any = None
        has_default = False

        if isinstance(args, list):
            if not args:
                raise EvaluationError("'var' operator expects at least one argument")
            path = self._ensure_string(args[0], "var path must be a string")
            if len(args) > 1:
                default_expr = args[1]
                has_default = True
        else:
            path = self._ensure_string(args, "var path must be a string")

        found, value = self._resolve_var(data, path)
        if not found:
            if has_default:
                value = eval_child(default_expr, "default")
            else:
                value = None
        return value, {"path": path, "value": value, "default_used": not found and has_default}

    def _op_and(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values: List[Any] = []
        for idx, arg in enumerate(self._ensure_iterable(args, "and")):
            value = eval_child(arg, f"args[{idx}]")
            values.append(value)
            if not self._truthy(value):
                return value, values
        return (values[-1] if values else True), values

    def _op_or(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values: List[Any] = []
        for idx, arg in enumerate(self._ensure_iterable(args, "or")):
            value = eval_child(arg, f"args[{idx}]")
            values.append(value)
            if self._truthy(value):
                return value, values
        return (values[-1] if values else False), values

    def _op_not(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        if isinstance(args, list):
            if len(args) != 1:
                raise EvaluationError("'!' operator expects a single argument")
            value = eval_child(args[0], "args[0]")
        else:
            value = eval_child(args, "args[0]")
        return (not self._truthy(value)), [value]

    def _op_if(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        items = list(self._ensure_iterable(args, "if"))
        if not items:
            raise EvaluationError("'if' operator requires at least one condition")
        argument_history: List[Any] = []
        for idx in range(0, len(items) - 1, 2):
            condition = eval_child(items[idx], f"condition[{idx // 2}]")
            argument_history.append({"condition": condition})
            if self._truthy(condition):
                result = eval_child(items[idx + 1], f"result[{idx // 2}]")
                argument_history[-1]["branch"] = result
                return result, argument_history
        if len(items) % 2 == 1:
            fallback = eval_child(items[-1], "default")
            argument_history.append({"default": fallback})
            return fallback, argument_history
        argument_history.append({"default": None})
        return None, argument_history

    def _op_in(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        if not isinstance(args, list) or len(args) != 2:
            raise EvaluationError("'in' operator expects two arguments")
        needle = eval_child(args[0], "needle")
        haystack = eval_child(args[1], "haystack")
        if isinstance(haystack, str):
            result = str(needle) in haystack
        else:
            result = needle in haystack
        return result, {"needle": needle, "haystack": haystack}

    def _op_missing(self, args: Any, data: Dict[str, Any], _: ArgEvaluator) -> tuple[Any, Any]:
        keys = self._ensure_iterable(args, "missing")
        missing: List[str] = []
        for key in keys:
            key_str = self._ensure_string(key, "missing expects string keys")
            found, value = self._resolve_var(data, key_str)
            if not found or value is None:
                missing.append(key_str)
        return missing, {"keys": list(keys), "missing": missing}

    def _op_missing_some(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        if not isinstance(args, list) or len(args) != 2:
            raise EvaluationError("'missing_some' expects a threshold and list of keys")
        min_required = self._ensure_number(eval_child(args[0], "min"))
        keys = list(self._ensure_iterable(args[1], "missing_some"))
        missing: List[str] = []
        present = 0
        for key in keys:
            key_str = self._ensure_string(key, "missing_some expects string keys")
            found, value = self._resolve_var(data, key_str)
            if found and value is not None:
                present += 1
            else:
                missing.append(key_str)
        result = missing if present < min_required else []
        return result, {"min": min_required, "missing": result}

    def _op_equal(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [eval_child(arg, f"args[{idx}]") for idx, arg in enumerate(self._ensure_iterable(args, "=="))]
        if not values:
            raise EvaluationError("'==' requires at least one argument")
        first = values[0]
        result = all(first == value for value in values[1:])
        return result, values

    def _op_not_equal(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [eval_child(arg, f"args[{idx}]") for idx, arg in enumerate(self._ensure_iterable(args, "!="))]
        if len(values) < 2:
            raise EvaluationError("'!=' requires at least two arguments")
        first = values[0]
        result = any(first != value for value in values[1:])
        return result, values

    def _op_greater(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, ">"))]
        if len(values) < 2:
            raise EvaluationError("'>' requires at least two arguments")
        result = all(a > b for a, b in zip(values, values[1:]))
        return result, values

    def _op_greater_equal(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, ">="))]
        if len(values) < 2:
            raise EvaluationError("'>=' requires at least two arguments")
        result = all(a >= b for a, b in zip(values, values[1:]))
        return result, values

    def _op_less(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "<"))]
        if len(values) < 2:
            raise EvaluationError("'<' requires at least two arguments")
        result = all(a < b for a, b in zip(values, values[1:]))
        return result, values

    def _op_less_equal(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        values = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "<="))]
        if len(values) < 2:
            raise EvaluationError("'<=' requires at least two arguments")
        result = all(a <= b for a, b in zip(values, values[1:]))
        return result, values

    def _op_add(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "+"))]
        return sum(numbers), numbers

    def _op_subtract(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "-"))]
        if not numbers:
            raise EvaluationError("'-' requires at least one argument")
        if len(numbers) == 1:
            return -numbers[0], numbers
        result = numbers[0]
        for value in numbers[1:]:
            result -= value
        return result, numbers

    def _op_multiply(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "*"))]
        result = 1.0
        for value in numbers:
            result *= value
        return result, numbers

    def _op_divide(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "/"))]
        if len(numbers) < 2:
            raise EvaluationError("'/' requires at least two arguments")
        result = numbers[0]
        for value in numbers[1:]:
            if value == 0:
                raise EvaluationError("Division by zero is not allowed")
            result /= value
        return result, numbers

    def _op_max(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "max"))]
        if not numbers:
            raise EvaluationError("'max' requires at least one argument")
        return max(numbers), numbers

    def _op_min(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        numbers = [self._ensure_number(eval_child(arg, f"args[{idx}]")) for idx, arg in enumerate(self._ensure_iterable(args, "min"))]
        if not numbers:
            raise EvaluationError("'min' requires at least one argument")
        return min(numbers), numbers

    def _op_bl_all(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        sequence_expr, predicate_expr = self._ensure_predicate_args(args, "bl_all")
        sequence = eval_child(sequence_expr, "sequence")
        if isinstance(sequence, (str, bytes)) or not isinstance(sequence, Iterable):
            raise EvaluationError("'bl_all' expects an iterable sequence")
        all_results: List[Dict[str, Any]] = []
        for idx, item in enumerate(sequence):
            scope = self._merge_context(data, {"item": item, "index": idx})
            predicate_result = eval_child(predicate_expr, f"predicate[{idx}]", scope)
            all_results.append({"index": idx, "item": item, "result": predicate_result})
            if not self._truthy(predicate_result):
                return False, all_results
        return True, all_results

    def _op_bl_any(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        sequence_expr, predicate_expr = self._ensure_predicate_args(args, "bl_any")
        sequence = eval_child(sequence_expr, "sequence")
        if isinstance(sequence, (str, bytes)) or not isinstance(sequence, Iterable):
            raise EvaluationError("'bl_any' expects an iterable sequence")
        history: List[Dict[str, Any]] = []
        for idx, item in enumerate(sequence):
            scope = self._merge_context(data, {"item": item, "index": idx})
            predicate_result = eval_child(predicate_expr, f"predicate[{idx}]", scope)
            history.append({"index": idx, "item": item, "result": predicate_result})
            if self._truthy(predicate_result):
                return True, history
        return False, history

    def _op_bl_none(self, args: Any, data: Dict[str, Any], eval_child: ArgEvaluator) -> tuple[Any, Any]:
        sequence_expr, predicate_expr = self._ensure_predicate_args(args, "bl_none")
        sequence = eval_child(sequence_expr, "sequence")
        if isinstance(sequence, (str, bytes)) or not isinstance(sequence, Iterable):
            raise EvaluationError("'bl_none' expects an iterable sequence")
        history: List[Dict[str, Any]] = []
        for idx, item in enumerate(sequence):
            scope = self._merge_context(data, {"item": item, "index": idx})
            predicate_result = eval_child(predicate_expr, f"predicate[{idx}]", scope)
            history.append({"index": idx, "item": item, "result": predicate_result})
            if self._truthy(predicate_result):
                return False, history
        return True, history

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------
    def _ensure_iterable(self, value: Any, operator: str) -> Iterable[Any]:
        if isinstance(value, list):
            return value
        raise EvaluationError(f"Operator '{operator}' expects an array argument")

    def _ensure_string(self, value: Any, message: str) -> str:
        if not isinstance(value, str):
            raise EvaluationError(message)
        return value

    def _ensure_number(self, value: Any) -> float:
        if isinstance(value, bool):
            raise EvaluationError("Boolean values cannot be coerced into numbers")
        if isinstance(value, (int, float)):
            return float(value)
        raise EvaluationError(f"Value '{value}' is not numeric")

    def _truthy(self, value: Any) -> bool:
        return bool(value)

    def _resolve_var(self, data: Dict[str, Any], path: Optional[str]) -> tuple[bool, Any]:
        if path is None or path == "":
            return True, data
        parts = path.split(".")
        current: Any = data
        for part in parts:
            if isinstance(current, dict):
                if part in current:
                    current = current[part]
                else:
                    return False, None
            elif isinstance(current, list):
                if part.isdigit():
                    index = int(part)
                    if 0 <= index < len(current):
                        current = current[index]
                    else:
                        return False, None
                else:
                    return False, None
            else:
                return False, None
        return True, current

    def _ensure_predicate_args(self, args: Any, operator: str) -> tuple[Any, Any]:
        if not isinstance(args, list) or len(args) != 2:
            raise EvaluationError(f"'{operator}' expects a sequence expression and a predicate expression")
        return args[0], args[1]

    def _merge_context(self, base: Dict[str, Any], extra: Dict[str, Any]) -> Dict[str, Any]:
        merged: Dict[str, Any]
        if isinstance(base, dict):
            merged = dict(base)
            merged.update(extra)
            return merged
        merged = dict(extra)
        return merged
