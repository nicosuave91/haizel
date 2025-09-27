import express from 'express';
import helmet from 'helmet';
import { ESignService } from './service';
import { verifyHmacSignature } from '@haizel/connectors-shared';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const SIGNATURE_HEADER = 'x-blp-signature';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

export function createServer(service = new ESignService()) {
  const app = express();
  app.use(helmet());
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  app.post('/api/v1/esign/envelopes', async (req, res) => {
    try {
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER) ?? undefined;
      const summary = await service.createEnvelope(req.body, idempotencyKey);
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
    const signature = req.header(SIGNATURE_HEADER) ?? '';
    const payload = (req.rawBody ?? Buffer.from(JSON.stringify(req.body))).toString('utf8');
    const secret = service.getWebhookSecret();
    const valid = verifyHmacSignature({ payload, signature, secret });
    if (!valid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

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
