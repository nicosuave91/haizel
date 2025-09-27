import express from 'express';
import helmet from 'helmet';
import { PPEService } from './service';
import { PPEEligibilityRequest } from './mappers';

export function createServer(service = new PPEService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/ppe/eligibility', async (req, res) => {
    try {
      const payload = req.body as PPEEligibilityRequest;
      const decision = await service.determineEligibility(payload);
      res.json(decision);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
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
