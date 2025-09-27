"""Persistence layer for evaluation proof artefacts."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from app.models.schemas import TraceStep


@dataclass
class EvaluationProofArtifact:
    """Immutable record of a single evaluation run."""

    id: str
    stable_id: Optional[str]
    version: Optional[int]
    logic: Dict[str, Any]
    context: Dict[str, Any]
    result: Any
    trace: List[TraceStep]
    created_at: datetime


class EvaluationProofStore:
    """In-memory storage of evaluation runs for audit and debugging."""

    def __init__(self) -> None:
        self._artifacts: Dict[str, EvaluationProofArtifact] = {}

    def record(
        self,
        *,
        stable_id: Optional[str],
        version: Optional[int],
        logic: Dict[str, Any],
        context: Dict[str, Any],
        result: Any,
        trace: Iterable[TraceStep],
    ) -> EvaluationProofArtifact:
        """Persist a new evaluation artefact and return it."""

        artifact_id = str(uuid4())
        artifact = EvaluationProofArtifact(
            id=artifact_id,
            stable_id=stable_id,
            version=version,
            logic=deepcopy(logic),
            context=deepcopy(context),
            result=deepcopy(result),
            trace=[TraceStep.model_validate(step.model_dump()) for step in trace],
            created_at=datetime.utcnow(),
        )
        self._artifacts[artifact_id] = artifact
        return artifact

    def get(self, artifact_id: str) -> EvaluationProofArtifact:
        """Retrieve a previously recorded artefact."""

        if artifact_id not in self._artifacts:
            raise KeyError(f"Unknown artefact id '{artifact_id}'")
        return self._artifacts[artifact_id]

    def list_for_rule(self, stable_id: str) -> List[EvaluationProofArtifact]:
        """Return all artefacts recorded for a rule."""

        return [artifact for artifact in self._artifacts.values() if artifact.stable_id == stable_id]

    def clear(self) -> None:
        """Remove all stored artefacts."""

        self._artifacts.clear()


_proof_store = EvaluationProofStore()


def get_evaluation_proof_store() -> EvaluationProofStore:
    """Return the singleton proof store instance used by the API layer."""

    return _proof_store
