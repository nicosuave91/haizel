import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { InMemoryWebhookNonceStore, StaticWebhookSecretProvider, WebhookVerifier } from '../../apps/api/src/webhooks/security';

const secretProvider = new StaticWebhookSecretProvider({ 'tenant:amc': 'secret' });
const nonceStore = new InMemoryWebhookNonceStore();
const verifier = new WebhookVerifier(secretProvider, nonceStore);

describe('WebhookVerifier', () => {
  it('accepts valid signature', async () => {
    const body = { loanId: 'abc' };
    const timestamp = Date.now();
    const bodyString = JSON.stringify(body);
    const digest = crypto.createHash('sha256').update(bodyString).digest('hex');
    const signature = crypto.createHmac('sha256', 'secret').update(`${timestamp}.${digest}`).digest('hex');
    const verified = await verifier.verify({
      headers: {
        'x-haizel-vendor': 'amc',
        'x-haizel-tenant': 'tenant',
        'x-signature': signature,
        'x-timestamp': String(timestamp),
        'x-nonce': 'nonce-1',
      },
      body,
      rawBody: bodyString,
    });
    assert.equal(verified.vendor, 'amc');
  });

  it('rejects replayed nonce', async () => {
    const body = { loanId: 'abc' };
    const timestamp = Date.now();
    const bodyString = JSON.stringify(body);
    const digest = crypto.createHash('sha256').update(bodyString).digest('hex');
    const signature = crypto.createHmac('sha256', 'secret').update(`${timestamp}.${digest}`).digest('hex');
    const request = {
      headers: {
        'x-haizel-vendor': 'amc',
        'x-haizel-tenant': 'tenant',
        'x-signature': signature,
        'x-timestamp': String(timestamp),
        'x-nonce': 'nonce-2',
      },
      body,
      rawBody: bodyString,
    } as const;
    await verifier.verify(request);
    await assert.rejects(() => verifier.verify(request));
  });
});
