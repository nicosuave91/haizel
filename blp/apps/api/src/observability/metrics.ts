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

class NoopHistogram implements Histogram {
  observe(): void {}
}

class NoopCounter implements Counter {
  inc(): void {}
}

class NoopGauge implements Gauge {
  set(): void {}
}

class NoopMetricsRegistry implements MetricsRegistry {
  histogram(): Histogram {
    return new NoopHistogram();
  }
  counter(): Counter {
    return new NoopCounter();
  }
  gauge(): Gauge {
    return new NoopGauge();
  }
}

let registry: MetricsRegistry = new NoopMetricsRegistry();

export function initMetrics(customRegistry: MetricsRegistry): void {
  registry = customRegistry;
}

export function workflowLatencyHistogram(): Histogram {
  return registry.histogram('workflow_step_latency_seconds', 'Latency for workflow steps', ['step', 'tenant']);
}

export function vendorErrorCounter(): Counter {
  return registry.counter('vendor_call_errors_total', 'Total vendor call errors', ['vendor', 'code']);
}

export function webhookSuccessGauge(): Gauge {
  return registry.gauge('webhook_success_ratio', 'Webhook success ratio', ['vendor']);
}

export function outboxBacklogGauge(): Gauge {
  return registry.gauge('outbox_backlog', 'Outbox backlog gauge', ['topic']);
}
