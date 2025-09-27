"""API routes responsible for evaluating rules and running regressions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.dsl.operators import EvaluationError
from app.models.schemas import (
    EvaluationProof,
    EvaluationRequest,
    EvaluationResponse,
    RegressionRunRequest,
    RegressionRunResponse,
)
from app.services.catalog import (
    RuleCatalogService,
    RuleNotFoundError,
    RuleVersionNotFoundError,
    get_catalog_service,
)
from app.services.evaluator import EvaluatorService, get_evaluator_service
from app.services.proofs import EvaluationProofStore, get_evaluation_proof_store
from app.services.regression import RegressionService, get_regression_service

router = APIRouter(prefix="/eval", tags=["evaluation"])


@router.post("", response_model=EvaluationResponse)
def evaluate_rule(
    payload: EvaluationRequest,
    catalog: RuleCatalogService = Depends(get_catalog_service),
    evaluator: EvaluatorService = Depends(get_evaluator_service),
    proof_store: EvaluationProofStore = Depends(get_evaluation_proof_store),
) -> EvaluationResponse:
    if payload.logic is not None:
        logic = payload.logic
        stable_id = payload.stable_id
        version = payload.version
    else:
        try:
            rule = catalog.get_rule_version(
                payload.stable_id, version=payload.version, prefer_latest=payload.prefer_latest
            )
        except RuleNotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found") from None
        except RuleVersionNotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found") from None
        logic = rule.definition
        stable_id = rule.stable_id
        version = rule.version

    try:
        result = evaluator.evaluate(logic, payload.context)
    except EvaluationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    artifact = proof_store.record(
        stable_id=stable_id,
        version=version,
        logic=logic,
        context=payload.context,
        result=result.result,
        trace=result.trace,
    )

    proof = EvaluationProof(
        id=artifact.id,
        created_at=artifact.created_at,
        stable_id=artifact.stable_id,
        version=artifact.version,
    )

    return EvaluationResponse(
        stable_id=stable_id,
        version=version,
        result=result.result,
        trace=result.trace,
        proof=proof,
    )


@router.post("/regressions", response_model=RegressionRunResponse)
def run_regressions(
    payload: RegressionRunRequest,
    regression_service: RegressionService = Depends(get_regression_service),
) -> RegressionRunResponse:
    try:
        return regression_service.run(payload)
    except RuleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found") from None
    except RuleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found") from None
    except EvaluationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
