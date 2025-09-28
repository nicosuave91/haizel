export interface Tracer {
  startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

export interface Span {
  setAttribute(key: string, value: unknown): void;
  recordException(error: Error): void;
  end(): void;
}

class NoopSpan implements Span {
  setAttribute(): void {}
  recordException(): void {}
  end(): void {}
}

class SimpleTracer implements Tracer {
  async startSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = new NoopSpan();
    try {
      return await fn(span);
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  }
}

let tracer: Tracer = new SimpleTracer();

export function initTracing(customTracer: Tracer): void {
  tracer = customTracer;
}

export function getTracer(): Tracer {
  return tracer;
}
