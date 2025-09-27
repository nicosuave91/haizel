"""API routes responsible for managing the rules catalog."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.schemas import (
    RegressionUpsertRequest,
    RuleCreateRequest,
    RuleListResponse,
    RulePublishRequest,
    RuleVersionResponse,
)
from app.services.catalog import (
    RuleCatalogService,
    RuleNotFoundError,
    RuleVersionNotFoundError,
    get_catalog_service,
)

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=RuleListResponse)
def list_rules(catalog: RuleCatalogService = Depends(get_catalog_service)) -> RuleListResponse:
    """Return a summary of rules currently stored in the catalog."""

    return catalog.list_rules()


@router.get("/{stable_id}", response_model=RuleVersionResponse)
def get_rule(
    stable_id: str,
    version: Optional[int] = Query(default=None, ge=1),
    prefer_latest: bool = Query(default=False),
    catalog: RuleCatalogService = Depends(get_catalog_service),
) -> RuleVersionResponse:
    try:
        rule = catalog.get_rule_version(stable_id, version=version, prefer_latest=prefer_latest)
    except RuleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found") from None
    except RuleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found") from None
    return RuleVersionResponse(rule=rule)


@router.post("", response_model=RuleVersionResponse, status_code=status.HTTP_201_CREATED)
def create_rule_version(
    payload: RuleCreateRequest,
    catalog: RuleCatalogService = Depends(get_catalog_service),
) -> RuleVersionResponse:
    rule = catalog.create_rule_version(payload)
    return RuleVersionResponse(rule=rule)


@router.post("/{stable_id}/publish", response_model=RuleVersionResponse)
def publish_rule_version(
    stable_id: str,
    payload: RulePublishRequest,
    catalog: RuleCatalogService = Depends(get_catalog_service),
) -> RuleVersionResponse:
    try:
        rule = catalog.publish_rule_version(stable_id, payload.version, payload.notes)
    except RuleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found") from None
    except RuleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found") from None
    return RuleVersionResponse(rule=rule)


@router.put("/{stable_id}/regressions", response_model=RuleVersionResponse)
def upsert_regressions(
    stable_id: str,
    payload: RegressionUpsertRequest,
    catalog: RuleCatalogService = Depends(get_catalog_service),
) -> RuleVersionResponse:
    try:
        rule = catalog.upsert_regression_cases(stable_id, payload)
    except RuleNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found") from None
    except RuleVersionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule version not found") from None
    return RuleVersionResponse(rule=rule)
