import express from 'express';
import helmet from 'helmet';
import { CreditService } from './service';
import { CreditPullRequest } from './mappers';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export function createServer(service = new CreditService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/credit/pulls', async (req, res) => {
    try {
      const request = req.body as CreditPullRequest;
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? undefined;
      const acknowledgement = await service.pullCredit(request, idempotencyKey);
      res.status(202).json(acknowledgement);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/v1/credit/pulls/:requestId', async (req, res) => {
    const result = await service.getResult(req.params.requestId);
    if (!result) {
      res.status(404).json({ error: 'Credit pull not found' });
      return;
    }
    res.json(result);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Credit connector listening on ${port}`);
  });
}
