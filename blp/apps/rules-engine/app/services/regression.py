"""Service responsible for running regression suites for rules."""

from __future__ import annotations

from typing import List

from app.models.schemas import (
    RegressionCase,
    RegressionCaseResult,
    RegressionRunRequest,
    RegressionRunResponse,
)
from app.services.catalog import RuleCatalogService, get_catalog_service
from app.services.evaluator import EvaluatorService, get_evaluator_service
from app.services.proofs import EvaluationProofStore, get_evaluation_proof_store


class RegressionService:
    """Execute stored or ad-hoc regression test cases for a rule."""

    def __init__(
        self,
        catalog: RuleCatalogService,
        evaluator: EvaluatorService,
        proof_store: EvaluationProofStore,
    ) -> None:
        self._catalog = catalog
        self._evaluator = evaluator
        self._proof_store = proof_store

    def run(self, request: RegressionRunRequest) -> RegressionRunResponse:
        rule = self._catalog.get_rule_version(
            request.stable_id,
            version=request.version,
            prefer_latest=request.prefer_latest,
        )

        cases: List[RegressionCase]
        if request.cases:
            cases = [RegressionCase.model_validate(case.model_dump()) for case in request.cases]
        else:
            cases = rule.regression_tests

        if not cases:
            raise ValueError("No regression cases were provided or stored for the rule")

        results: List[RegressionCaseResult] = []
        passed = 0
        for case in cases:
            evaluation = self._evaluator.evaluate(rule.definition, case.context)
            self._proof_store.record(
                stable_id=rule.stable_id,
                version=rule.version,
                logic=rule.definition,
                context=case.context,
                result=evaluation.result,
                trace=evaluation.trace,
            )
            success = evaluation.result == case.expected
            if success:
                passed += 1
            results.append(
                RegressionCaseResult(
                    name=case.name,
                    description=case.description,
                    success=success,
                    expected=case.expected,
                    actual=evaluation.result,
                    trace=evaluation.trace,
                )
            )

        failed = len(results) - passed
        return RegressionRunResponse(
            stable_id=rule.stable_id,
            version=rule.version,
            total=len(results),
            passed=passed,
            failed=failed,
            cases=results,
        )


_regression_service = RegressionService(
    get_catalog_service(), get_evaluator_service(), get_evaluation_proof_store()
)


def get_regression_service() -> RegressionService:
    """Return the singleton regression runner service."""

    return _regression_service
