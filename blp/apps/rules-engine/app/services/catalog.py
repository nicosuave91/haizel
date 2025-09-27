"""In-memory catalog responsible for managing rule definitions."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional

from app.models.schemas import (
    RegressionCase,
    RegressionUpsertRequest,
    RuleCreateRequest,
    RuleListResponse,
    RuleSummary,
    RuleVersion,
)


class RuleNotFoundError(Exception):
    """Raised when a rule with the provided identifier does not exist."""


class RuleVersionNotFoundError(Exception):
    """Raised when the requested rule version does not exist."""


class RuleCatalogService:
    """Simple in-memory rule catalog.

    The service keeps track of rule versions, publication metadata and associated
    regression fixtures. It is intentionally in-memory for the purposes of the
    kata but mirrors the behaviour of a persistent catalog.
    """

    def __init__(self) -> None:
        self._store: Dict[str, List[RuleVersion]] = {}

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------
    def create_rule_version(self, payload: RuleCreateRequest) -> RuleVersion:
        """Create a new rule version from the provided payload."""

        versions = self._store.setdefault(payload.stable_id, [])
        version_number = versions[-1].version + 1 if versions else 1
        timestamp = datetime.utcnow()
        version = RuleVersion(
            stable_id=payload.stable_id,
            version=version_number,
            name=payload.name,
            description=payload.description,
            labels=deepcopy(payload.labels),
            definition=deepcopy(payload.definition),
            status="draft",
            created_at=timestamp,
            updated_at=timestamp,
            revision_notes=payload.revision_notes,
            regression_tests=[RegressionCase.model_validate(case.model_dump()) for case in payload.regression_tests],
        )
        versions.append(version)
        return version

    def list_rules(self) -> RuleListResponse:
        """Return summaries for all rules stored in the catalog."""

        summaries: List[RuleSummary] = []
        for stable_id, versions in self._store.items():
            latest = versions[-1]
            published = next((v for v in reversed(versions) if v.status == "published"), None)
            summaries.append(
                RuleSummary(
                    stable_id=stable_id,
                    name=latest.name,
                    description=latest.description,
                    labels=deepcopy(latest.labels),
                    latest_version=latest.version,
                    published_version=published.version if published else None,
                    status=latest.status,
                )
            )
        summaries.sort(key=lambda summary: summary.stable_id)
        return RuleListResponse(total=len(summaries), rules=summaries)

    def publish_rule_version(self, stable_id: str, version: int, notes: Optional[str] = None) -> RuleVersion:
        """Publish a specific rule version."""

        versions = self._store.get(stable_id)
        if not versions:
            raise RuleNotFoundError(stable_id)

        target = next((v for v in versions if v.version == version), None)
        if not target:
            raise RuleVersionNotFoundError(f"{stable_id}:{version}")

        # Unpublish other versions
        for existing in versions:
            if existing.status == "published":
                existing.status = "draft"
                existing.published_at = None

        timestamp = datetime.utcnow()
        target.status = "published"
        target.updated_at = timestamp
        target.published_at = timestamp
        if notes:
            target.revision_notes = notes
        return target

    def get_rule_version(
        self,
        stable_id: str,
        version: Optional[int] = None,
        prefer_latest: bool = False,
    ) -> RuleVersion:
        """Return the requested rule version.

        When no version is provided the published version is returned. If there
        is no published version the latest draft is returned, unless
        ``prefer_latest`` is explicitly ``True``.
        """

        versions = self._store.get(stable_id)
        if not versions:
            raise RuleNotFoundError(stable_id)

        if version is not None:
            match = next((v for v in versions if v.version == version), None)
            if not match:
                raise RuleVersionNotFoundError(f"{stable_id}:{version}")
            return match

        if prefer_latest:
            return versions[-1]

        published = next((v for v in reversed(versions) if v.status == "published"), None)
        return published or versions[-1]

    def upsert_regression_cases(self, stable_id: str, request: RegressionUpsertRequest) -> RuleVersion:
        """Replace the stored regression cases for the provided rule version."""

        version = self.get_rule_version(stable_id, request.version, prefer_latest=True)
        version.regression_tests = [
            RegressionCase.model_validate(case.model_dump()) for case in request.cases
        ]
        version.updated_at = datetime.utcnow()
        return version

    def clear(self) -> None:
        """Utility used during testing to reset the catalog state."""

        self._store.clear()


catalog_service = RuleCatalogService()


def get_catalog_service() -> RuleCatalogService:
    """Return the singleton catalog service used by the API layer."""

    return catalog_service
