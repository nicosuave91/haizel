import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { HttpSpanInterceptor, initMetrics, initTracing, shutdownTracing } from '@haizel/observability';
import { AppModule } from './app.module';

async function bootstrap() {
  await initTracing({
    serviceName: 'core-api',
    serviceVersion: process.env.npm_package_version,
    otlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      `${process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://otel-collector:4318'}/v1/traces`,
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    },
  });

  initMetrics({
    serviceName: 'core-api',
    serviceVersion: process.env.npm_package_version,
    otlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
      `${process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://otel-collector:4318'}/v1/metrics`,
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    },
  });

  const app = await NestFactory.create(AppModule, { logger: false });
  app.use((req, _res, next) => {
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = randomUUID();
    }
    req.contextId = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : (req.headers['x-request-id'] as string);
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new HttpSpanInterceptor());
  app.enableShutdownHooks();
  const shutdown = async () => {
    await app.close();
    await shutdownTracing();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  const port = Number.parseInt(process.env.PORT ?? '', 10) || 8080;
  await app.listen(port);
}

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap core-api', error);
  await shutdownTracing();
  process.exitCode = 1;
});
