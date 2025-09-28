import { NativeConnection, Worker } from '@temporalio/worker';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  OpenTelemetryActivityInboundInterceptor,
  makeWorkflowExporter,
} from '@temporalio/interceptors-opentelemetry';
import { initTracing } from '@haizel/api/observability';
import * as activities from './activities';
import * as workflows from './workflows';

const require = createRequire(import.meta.url);

export interface WorkerBootstrapOptions {
  taskQueue?: string;
  address?: string;
}

export async function runWorker(options: WorkerBootstrapOptions = {}): Promise<void> {
  const taskQueue = options.taskQueue ?? process.env.TEMPORAL_TASK_QUEUE ?? 'blp.default';
  const address = options.address ?? process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'worker',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'blp',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
  );

  await initTracing({
    serviceName: 'worker',
    serviceVersion: process.env.npm_package_version,
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    },
  });

  const otlpUrl =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    `${process.env.OTEL_COLLECTOR_ENDPOINT ?? 'http://otel-collector:4318'}/v1/traces`;
  const workflowExporter = makeWorkflowExporter(new OTLPTraceExporter({ url: otlpUrl }), resource);

  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    workflows,
    activities,
    taskQueue,
    sinks: {
      opentelemetry: workflowExporter,
    },
    interceptors: {
      activity: [
        (ctx) => ({
          inbound: new OpenTelemetryActivityInboundInterceptor(ctx),
        }),
      ],
      workflowModules: [require.resolve('./telemetry/workflow-interceptors')],
    },
  });

  try {
    await worker.run();
  } finally {
    await connection.close();
  }
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: worker [options]

Options:
  -q, --task-queue <queue>   Temporal task queue to poll (default: blp.default)
  -a, --address <address>    Temporal server address (default: localhost:7233)
  -h, --help                 Show this help message
`);
}

function parseCliArgs(argv: string[]): WorkerBootstrapOptions | 'help' {
  const options: WorkerBootstrapOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '-q':
      case '--task-queue':
        options.taskQueue = argv[index + 1];
        index += 1;
        break;
      case '-a':
      case '--address':
        options.address = argv[index + 1];
        index += 1;
        break;
      case '-h':
      case '--help':
        return 'help';
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  (async () => {
    try {
      const parsed = parseCliArgs(process.argv.slice(2));
      if (parsed === 'help') {
        printUsage();
        return;
      }
      await runWorker(parsed);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Temporal worker failed to start', error);
      process.exitCode = 1;
    }
  })();
}
