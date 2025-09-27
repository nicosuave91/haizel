import express from 'express';
import helmet from 'helmet';
import { AUSGatewayService } from './service';
import { AUSSubmissionRequest } from './mappers';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export function createServer(service = new AUSGatewayService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/aus/submit', async (req, res) => {
    try {
      const request = req.body as AUSSubmissionRequest;
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? undefined;
      const decision = await service.submitCase(request, idempotencyKey);
      res.json(decision);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/v1/aus/results/:loanId', (req, res) => {
    const decision = service.getDecision(req.params.loanId);
    if (!decision) {
      res.status(404).json({ error: 'Decision not found' });
      return;
    }
    res.json(decision);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3003;
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`AUS gateway listening on ${port}`);
  });
}
