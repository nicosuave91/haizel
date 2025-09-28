"""FastAPI application entry point for the rules engine."""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.semconv.resource import ResourceAttributes

from app.api.routes_eval import router as eval_router
from app.api.routes_rules import router as rules_router
from app.core.config import settings
from app.core.logging import configure_logging


def configure_observability(app: FastAPI) -> None:
    """Configure OpenTelemetry tracing for the FastAPI app."""

    collector = os.getenv("OTEL_COLLECTOR_ENDPOINT", "http://otel-collector:4318")
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", f"{collector}/v1/traces")
    resource = Resource.create(
        {
            ResourceAttributes.SERVICE_NAME: "rules-engine",
            ResourceAttributes.SERVICE_NAMESPACE: "blp",
            ResourceAttributes.SERVICE_VERSION: settings.version,
            "deployment.environment": os.getenv("ENVIRONMENT", "development"),
        }
    )

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    app.add_middleware(OpenTelemetryMiddleware, tracer_provider=provider)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""

    configure_logging()
    app = FastAPI(title=settings.app_name, version=settings.version)
    configure_observability(app)

    @app.middleware("http")
    async def enrich_span(request: Request, call_next):
        response = await call_next(request)
        span = trace.get_current_span()
        tenant_id = request.headers.get("x-tenant-id")
        vendor_id = request.headers.get("x-vendor-id")
        if span is not None:
            if tenant_id:
                span.set_attribute("tenant.id", tenant_id)
            if vendor_id:
                span.set_attribute("vendor.id", vendor_id)
        return response

    app.include_router(rules_router)
    app.include_router(eval_router)
    return app


app = create_app()
