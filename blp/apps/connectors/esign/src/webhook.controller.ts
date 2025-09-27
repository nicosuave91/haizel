import { Request, Response } from 'express';
import { verifyHmacSignature } from '@haizel/connectors-shared';
import { ESignService, WebhookEvent } from './service';

const SIGNATURE_HEADER = 'x-blp-signature';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

export function createWebhookHandler(service = new ESignService()) {
  return async (req: Request, res: Response) => {
    const signature = req.header(SIGNATURE_HEADER) ?? '';
    const payload = (req.rawBody ?? Buffer.from(JSON.stringify(req.body))).toString('utf8');
    const secret = service.getWebhookSecret();
    const valid = verifyHmacSignature({ payload, signature, secret });
    if (!valid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.body as WebhookEvent;
    await service.acknowledgeWebhook(event);
    res.status(202).json({ received: true });
  };
}
