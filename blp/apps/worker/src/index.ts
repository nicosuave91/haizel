import { NativeConnection, Worker } from '@temporalio/worker';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
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

  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflows'),
    workflows,
    activities,
    taskQueue,
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
