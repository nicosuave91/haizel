import { Worker } from '@temporalio/worker';
import * as activities from './activities';
import * as workflows from './workflows';

export async function runWorker() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'blp.default',
  });

  await worker.run();
}

if (require.main === module) {
  runWorker().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Temporal worker failed to start', error);
    process.exitCode = 1;
  });
}
