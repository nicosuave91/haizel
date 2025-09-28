import { trace, context as otelContext, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Span as OtelSpan } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CompositePropagator } from '@opentelemetry/core';
import { W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

export interface Tracer {
  startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

export interface Span {
  setAttribute(key: string, value: unknown): void;
  recordException(error: Error): void;
  end(): void;
}

export interface TracingOptions {
  serviceName: string;
  serviceNamespace?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  instrumentations?: Instrumentation[];
  resourceAttributes?: Record<string, string>;
}

class OtelSpanWrapper implements Span {
  constructor(private readonly span: OtelSpan) {}

  setAttribute(key: string, value: unknown): void {
    this.span.setAttribute(key, value as never);
  }

  recordException(error: Error): void {
    this.span.recordException(error);
  }

  end(): void {
    this.span.end();
  }
}

class OtelTracerWrapper implements Tracer {
  constructor(private readonly tracer = trace.getTracer('default')) {}

  async startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.tracer.startSpan(name);
    const ctx = trace.setSpan(otelContext.active(), span);
    try {
      return await otelContext.with(ctx, async () => fn(new OtelSpanWrapper(span)));
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      throw error;
    } finally {
      span.end();
    }
  }
}

let tracer: Tracer = new OtelTracerWrapper();
let sdk: NodeSDK | undefined;

export async function initTracing(options: TracingOptions): Promise<void> {
  if (sdk) {
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: options.serviceNamespace,
      [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion,
      ...options.resourceAttributes,
    }),
  );

  const otlpEndpoint =
    options.otlpEndpoint ??
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    `${process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://localhost:4318'}/v1/traces`;

  const exporter = new OTLPTraceExporter({ url: otlpEndpoint });

  const instrumentations: Instrumentation[] =
    options.instrumentations ??
    [
      new HttpInstrumentation({
        requireParentforOutgoingSpans: false,
        ignoreIncomingRequestHook: () => true,
      }),
    ];

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    textMapPropagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator(), new B3Propagator()],
    }),
    contextManager: new AsyncLocalStorageContextManager(),
    instrumentations,
  });

  await sdk.start();
  tracer = new OtelTracerWrapper(trace.getTracer(options.serviceName));
}

export function getTracer(): Tracer {
  return tracer;
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = undefined;
  tracer = new OtelTracerWrapper();
}

@Injectable()
export class HttpSpanInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<
      Request & { headers: Record<string, string | string[]>; contextId?: string }
    >();
    const response = httpContext.getResponse();
    const otelTracer = trace.getTracer('nest-http');
    const spanName = `${request.method ?? 'UNKNOWN'} ${request.url ?? ''}`;
    let requestIdHeader = request.headers?.['x-request-id'];
    if (Array.isArray(requestIdHeader)) {
      requestIdHeader = requestIdHeader[0];
    }
    const requestId = requestIdHeader ?? request.contextId ?? randomUUID();
    (request as any).contextId = requestId;

    const span = otelTracer.startSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.route': (request as any).route?.path ?? request.url,
        'http.target': request.url,
        'http.host': request.headers?.host,
        'blp.request_id': requestId,
      },
    });

    const tenantId = request.headers?.['x-tenant-id'];
    if (tenantId) {
      span.setAttribute('tenant.id', Array.isArray(tenantId) ? tenantId[0] : tenantId);
    }
    const vendorId = request.headers?.['x-vendor-id'];
    if (vendorId) {
      span.setAttribute('vendor.id', Array.isArray(vendorId) ? vendorId[0] : vendorId);
    }

    const traceparent = request.headers?.traceparent;
    if (traceparent) {
      span.setAttribute('http.traceparent', Array.isArray(traceparent) ? traceparent[0] : traceparent);
    }

    const ctx = trace.setSpan(otelContext.active(), span);
    return otelContext.with(ctx, () =>
      next.handle().pipe(
        tap(() => {
          if (response?.statusCode) {
            span.setAttribute('http.status_code', response.statusCode);
          }
          span.setStatus({ code: SpanStatusCode.OK });
        }),
        catchError((error) => {
          if (error instanceof Error) {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          }
          return throwError(() => error);
        }),
        finalize(() => {
          span.end();
        }),
      ),
    );
  }
}
