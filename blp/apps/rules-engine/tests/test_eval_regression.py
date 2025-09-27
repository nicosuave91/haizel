"""Integration tests covering the FastAPI application."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.catalog import get_catalog_service
from app.services.proofs import get_evaluation_proof_store


@pytest.fixture(autouse=True)
def reset_catalog_state() -> None:
    catalog = get_catalog_service()
    catalog.clear()
    yield
    catalog.clear()


@pytest.fixture(autouse=True)
def reset_proof_store() -> None:
    store = get_evaluation_proof_store()
    store.clear()
    yield
    store.clear()


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def _sample_rule_definition(threshold: int = 700) -> Dict:
    return {
        "if": [
            {">=": [{"var": "applicant.credit_score"}, threshold]},
            "approve",
            "manual-review",
        ]
    }


def test_rule_lifecycle_and_evaluation(client: TestClient) -> None:
    create_payload = {
        "stable_id": "loan-decision",
        "name": "Loan Decision",
        "description": "Base underwriting rule",
        "definition": _sample_rule_definition(690),
        "labels": {"product": "personal-loan"},
        "regression_tests": [
            {
                "name": "approve-high-score",
                "context": {"applicant": {"credit_score": 720}},
                "expected": "approve",
            },
            {
                "name": "flag-borderline",
                "context": {"applicant": {"credit_score": 680}},
                "expected": "manual-review",
            },
        ],
    }

    response = client.post("/rules", json=create_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["rule"]["version"] == 1
    assert body["rule"]["status"] == "draft"

    update_payload = {**create_payload, "regression_tests": list(create_payload["regression_tests"])}
    update_payload["definition"] = _sample_rule_definition(700)
    update_payload["regression_tests"].append(
        {
            "name": "approve-borderline",
            "context": {"applicant": {"credit_score": 700}},
            "expected": "approve",
        }
    )
    response = client.post("/rules", json=update_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["rule"]["version"] == 2

    response = client.post("/rules/loan-decision/publish", json={"version": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["rule"]["status"] == "published"
    assert body["rule"]["version"] == 2

    response = client.get("/rules")
    assert response.status_code == 200
    catalog_summary = response.json()
    assert catalog_summary["total"] == 1
    assert catalog_summary["rules"][0]["published_version"] == 2

    eval_payload = {
        "stable_id": "loan-decision",
        "context": {"applicant": {"credit_score": 715}},
    }
    response = client.post("/eval", json=eval_payload)
    assert response.status_code == 200
    evaluation = response.json()
    assert evaluation["result"] == "approve"
    assert evaluation["version"] == 2
    assert evaluation["trace"]
    assert evaluation["proof"]["id"]

    store = get_evaluation_proof_store()
    artifact = store.get(evaluation["proof"]["id"])
    assert artifact.result == "approve"
    assert artifact.stable_id == "loan-decision"
    assert artifact.version == 2

    inline_eval_payload = {"logic": {"+": [1, 2, 3]}, "context": {}}
    response = client.post("/eval", json=inline_eval_payload)
    assert response.status_code == 200
    inline_result = response.json()
    assert pytest.approx(inline_result["result"], rel=1e-6) == 6.0
    assert inline_result["proof"]["id"]

    regression_response = client.post(
        "/eval/regressions",
        json={"stable_id": "loan-decision"},
    )
    assert regression_response.status_code == 200
    regression_body = regression_response.json()
    assert regression_body["total"] == 3
    assert regression_body["failed"] == 0

    artifacts = store.list_for_rule("loan-decision")
    assert len(artifacts) == 4


def test_regression_runner_detects_failures(client: TestClient) -> None:
    create_payload = {
        "stable_id": "eligibility",
        "name": "Eligibility",
        "definition": {"bl_any": [{"var": "flags"}, {"==": [{"var": "item"}, "approved"]}]},
    }
    response = client.post("/rules", json=create_payload)
    assert response.status_code == 201
    client.post("/rules/eligibility/publish", json={"version": 1})

    regression_payload = {
        "stable_id": "eligibility",
        "cases": [
            {
                "name": "passes-when-flag-present",
                "context": {"flags": ["approved", "kyc"]},
                "expected": True,
            },
            {
                "name": "fails-when-flag-missing",
                "context": {"flags": ["kyc"]},
                "expected": True,
            },
        ],
    }

    response = client.post("/eval/regressions", json=regression_payload)
    assert response.status_code == 200
    result = response.json()
    assert result["passed"] == 1
    assert result["failed"] == 1
    failing_case = next(case for case in result["cases"] if not case["success"])
    assert failing_case["name"] == "fails-when-flag-missing"
    assert failing_case["actual"] is False


def test_invalid_rule_definition_returns_400(client: TestClient) -> None:
    response = client.post(
        "/rules",
        json={
            "stable_id": "invalid",
            "name": "Invalid",
            "definition": {"bad": [1, 2, 3]},
        },
    )
    assert response.status_code == 400
