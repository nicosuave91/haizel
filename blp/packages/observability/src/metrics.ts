import { metrics, Meter } from '@opentelemetry/api';
import type { Histogram as OtelHistogram, Counter as OtelCounter, ObservableGauge } from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export interface Histogram {
  observe(labels: Record<string, string>, value: number): void;
}

export interface Counter {
  inc(labels: Record<string, string>, value?: number): void;
}

export interface Gauge {
  set(labels: Record<string, string>, value: number): void;
}

export interface MetricsRegistry {
  histogram(name: string, help: string, labels: string[]): Histogram;
  counter(name: string, help: string, labels: string[]): Counter;
  gauge(name: string, help: string, labels: string[]): Gauge;
}

export interface MetricsOptions {
  serviceName: string;
  serviceNamespace?: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  resourceAttributes?: Record<string, string>;
  meter?: Meter;
}

function buildResource(options: MetricsOptions): Resource {
  return Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: options.serviceNamespace,
      [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion,
      ...options.resourceAttributes,
    }),
  );
}

function createMeter(options: MetricsOptions): Meter {
  if (options.meter) {
    return options.meter;
  }

  const otlpEndpoint =
    options.otlpEndpoint ??
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
    `${process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://localhost:4318'}/v1/metrics`;

  const exporter = new OTLPMetricExporter({ url: otlpEndpoint });
  const reader = new PeriodicExportingMetricReader({ exporter });
  const provider = new MeterProvider({ resource: buildResource(options) });
  provider.addMetricReader(reader);
  metrics.setGlobalMeterProvider(provider);
  return provider.getMeter(options.serviceName);
}

class OtelHistogramWrapper implements Histogram {
  constructor(private readonly instrument: OtelHistogram) {}

  observe(labels: Record<string, string>, value: number): void {
    this.instrument.record(value, labels);
  }
}

class OtelCounterWrapper implements Counter {
  constructor(private readonly instrument: OtelCounter) {}

  inc(labels: Record<string, string>, value = 1): void {
    this.instrument.add(value, labels);
  }
}

class OtelGaugeWrapper implements Gauge {
  private readonly state = new Map<string, { labels: Record<string, string>; value: number }>();

  constructor(private readonly instrument: ObservableGauge) {
    this.instrument.addCallback((result) => {
      for (const entry of this.state.values()) {
        result.observe(entry.value, entry.labels);
      }
    });
  }

  set(labels: Record<string, string>, value: number): void {
    const key = JSON.stringify(labels);
    this.state.set(key, { labels, value });
  }
}

class OtelMetricsRegistry implements MetricsRegistry {
  constructor(private readonly meter: Meter) {}

  histogram(name: string, _help: string, _labels: string[]): Histogram {
    return new OtelHistogramWrapper(this.meter.createHistogram(name));
  }

  counter(name: string, _help: string, _labels: string[]): Counter {
    return new OtelCounterWrapper(this.meter.createCounter(name));
  }

  gauge(name: string, _help: string, _labels: string[]): Gauge {
    return new OtelGaugeWrapper(this.meter.createObservableGauge(name));
  }
}

let registry: MetricsRegistry | undefined;

export function initMetrics(options: MetricsOptions): void {
  registry = new OtelMetricsRegistry(createMeter(options));
}

function ensureRegistry(): MetricsRegistry {
  if (!registry) {
    initMetrics({ serviceName: process.env.OTEL_SERVICE_NAME ?? 'api' });
  }
  return registry!;
}

export function workflowLatencyHistogram(): Histogram {
  return ensureRegistry().histogram('workflow_step_latency_seconds', 'Latency for workflow steps', ['step', 'tenant']);
}

export function vendorErrorCounter(): Counter {
  return ensureRegistry().counter('vendor_call_errors_total', 'Total vendor call errors', ['vendor', 'code']);
}

export function webhookSuccessGauge(): Gauge {
  return ensureRegistry().gauge('webhook_success_ratio', 'Webhook success ratio', ['vendor']);
}

export function outboxBacklogGauge(): Gauge {
  return ensureRegistry().gauge('outbox_backlog', 'Outbox backlog gauge', ['topic']);
}
