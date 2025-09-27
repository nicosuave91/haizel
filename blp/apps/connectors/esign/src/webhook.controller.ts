import { Request, Response } from 'express';
import { ESignService, WebhookEvent } from './service';

export function createWebhookHandler(service = new ESignService()) {
  return async (req: Request, res: Response) => {
    const event = req.body as WebhookEvent;
    await service.acknowledgeWebhook(event);
    res.status(202).json({ received: true });
  };
}
