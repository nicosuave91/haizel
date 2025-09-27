import express from 'express';
import helmet from 'helmet';
import { CreditService } from './service';
import { CreditReportRequest } from './mappers';

export function createServer(service = new CreditService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/credit/report', async (req, res) => {
    try {
      const request = req.body as CreditReportRequest;
      const report = await service.getReport(request);
      res.json(report);
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
  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Credit connector listening on ${port}`);
  });
}
