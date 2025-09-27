import express from 'express';
import helmet from 'helmet';
import { PPEService } from './service';
import { PPEQuoteRequest, PPERateLockRequest } from './mappers';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export function createServer(service = new PPEService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/ppe/quotes', async (req, res) => {
    try {
      const request = req.body as PPEQuoteRequest;
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? undefined;
      const quote = await service.requestQuote(request, idempotencyKey);
      res.status(200).json(quote);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/v1/ppe/locks', async (req, res) => {
    try {
      const request = req.body as PPERateLockRequest;
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? undefined;
      const lock = await service.lockRate(request, idempotencyKey);
      res.status(200).json(lock);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/v1/ppe/locks/:lockId', async (req, res) => {
    const lock = await service.getLock(req.params.lockId);
    if (!lock) {
      res.status(404).json({ error: 'Lock not found' });
      return;
    }
    res.status(200).json(lock);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`PPE adapter listening on ${port}`);
  });
}
