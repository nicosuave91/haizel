import express from 'express';
import helmet from 'helmet';
import { ESignService } from './service';

export function createServer(service = new ESignService()) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.post('/api/v1/esign/envelopes', async (req, res) => {
    try {
      const summary = await service.createEnvelope(req.body);
      res.status(201).json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/v1/esign/envelopes/:envelopeId', async (req, res) => {
    const envelope = await service.getEnvelope(req.params.envelopeId);
    if (!envelope) {
      res.status(404).json({ error: 'Envelope not found' });
      return;
    }
    res.json(envelope);
  });

  app.post('/api/v1/esign/webhooks', async (req, res) => {
    await service.acknowledgeWebhook(req.body);
    res.status(202).json({ received: true });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3004;
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`E-Sign connector listening on ${port}`);
  });
}
