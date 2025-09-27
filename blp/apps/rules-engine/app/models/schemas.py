"""Pydantic models shared between the API layer and services."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RegressionCase(BaseModel):
    """A single regression test case."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, description="Identifier for the regression test case")
    context: Dict[str, Any] = Field(default_factory=dict, description="Input payload provided to the evaluator")
    expected: Any = Field(..., description="Expected evaluation result")
    description: Optional[str] = Field(default=None, description="Optional human readable description")


class TraceStep(BaseModel):
    """Represents a single evaluation step within the explainability trace."""

    model_config = ConfigDict(extra="allow")

    path: str
    operator: str
    result: Any
    arguments: Optional[Any] = None
    children: List[TraceStep] = Field(default_factory=list)


TraceStep.model_rebuild()


class RuleVersion(BaseModel):
    """Represents a version of a rule stored in the catalog."""

    model_config = ConfigDict(extra="forbid")

    stable_id: str
    version: int
    name: str
    description: Optional[str] = None
    labels: Dict[str, str] = Field(default_factory=dict)
    definition: Dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    revision_notes: Optional[str] = None
    regression_tests: List[RegressionCase] = Field(default_factory=list)


class RuleSummary(BaseModel):
    """Summary view used when listing rules."""

    model_config = ConfigDict(extra="forbid")

    stable_id: str
    name: str
    description: Optional[str] = None
    labels: Dict[str, str] = Field(default_factory=dict)
    latest_version: int
    published_version: Optional[int] = None
    status: str


class RuleCreateRequest(BaseModel):
    """Payload for creating or updating a rule version."""

    model_config = ConfigDict(extra="forbid")

    stable_id: str = Field(..., min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]+$")
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(default=None)
    definition: Dict[str, Any]
    labels: Dict[str, str] = Field(default_factory=dict)
    revision_notes: Optional[str] = Field(default=None)
    regression_tests: List[RegressionCase] = Field(default_factory=list)

    @field_validator("labels")
    @classmethod
    def ensure_label_values(cls, value: Dict[str, str]) -> Dict[str, str]:
        for key, val in value.items():
            if not isinstance(val, str):
                raise ValueError(f"Label '{key}' must be a string value")
        return value

    @model_validator(mode="after")
    def ensure_definition_not_empty(self) -> "RuleCreateRequest":
        if not self.definition:
            raise ValueError("Rule definition cannot be empty")
        return self


class RulePublishRequest(BaseModel):
    """Request body for publishing a specific rule version."""

    model_config = ConfigDict(extra="forbid")

    version: int = Field(..., ge=1)
    notes: Optional[str] = Field(default=None)


class RegressionUpsertRequest(BaseModel):
    """Request body for updating the regression catalog for a rule version."""

    model_config = ConfigDict(extra="forbid")

    version: int = Field(..., ge=1)
    cases: List[RegressionCase] = Field(default_factory=list)

    @model_validator(mode="after")
    def ensure_cases_present(self) -> "RegressionUpsertRequest":
        if not self.cases:
            raise ValueError("At least one regression case is required")
        return self


class RuleListResponse(BaseModel):
    """Response schema when listing rule summaries."""

    model_config = ConfigDict(extra="forbid")

    total: int
    rules: List[RuleSummary]


class RuleVersionResponse(BaseModel):
    """Response schema returning a concrete rule version."""

    model_config = ConfigDict(extra="forbid")

    rule: RuleVersion


class EvaluationRequest(BaseModel):
    """Payload sent to the evaluator endpoint."""

    model_config = ConfigDict(extra="forbid")

    stable_id: Optional[str] = Field(default=None)
    version: Optional[int] = Field(default=None, ge=1)
    logic: Optional[Dict[str, Any]] = Field(default=None)
    context: Dict[str, Any] = Field(default_factory=dict)
    prefer_latest: bool = Field(default=False, description="When true prefer the latest draft instead of the published version")

    @model_validator(mode="after")
    def validate_target(self) -> "EvaluationRequest":
        if not self.logic and not self.stable_id:
            raise ValueError("Either 'logic' or 'stable_id' must be provided")
        return self


class EvaluationResponse(BaseModel):
    """Response returned after evaluating a rule."""

    model_config = ConfigDict(extra="forbid")

    stable_id: Optional[str]
    version: Optional[int]
    result: Any
    trace: List[TraceStep]
    proof: "EvaluationProof"


class EvaluationProof(BaseModel):
    """Summary metadata about a persisted evaluation artefact."""

    model_config = ConfigDict(extra="forbid")

    id: str
    created_at: datetime
    stable_id: Optional[str] = None
    version: Optional[int] = None


class RegressionCaseResult(BaseModel):
    """Detailed result for a regression case execution."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: Optional[str] = None
    success: bool
    expected: Any
    actual: Any
    trace: List[TraceStep]


class RegressionRunRequest(BaseModel):
    """Request payload for executing regression tests."""

    model_config = ConfigDict(extra="forbid")

    stable_id: str
    version: Optional[int] = Field(default=None, ge=1)
    cases: List[RegressionCase] = Field(default_factory=list)
    prefer_latest: bool = Field(
        default=False,
        description="When true run against the latest draft, otherwise prefer the published version",
    )


class RegressionRunResponse(BaseModel):
    """Response returned after running regression tests."""

    model_config = ConfigDict(extra="forbid")

    stable_id: str
    version: int
    total: int
    passed: int
    failed: int
    cases: List[RegressionCaseResult]


EvaluationResponse.model_rebuild()
