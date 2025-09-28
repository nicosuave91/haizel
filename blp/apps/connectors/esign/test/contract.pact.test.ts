import crypto from 'node:crypto';
import path from 'node:path';
import { MatchersV3 as Matchers, PactV3 } from '@pact-foundation/pact';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const baseConfig = {
  consumer: 'CoreAPI',
  provider: 'ESignConnector',
  dir: path.resolve(__dirname, '../../pacts'),
  logLevel: 'warn',
};

describe('E-Sign connector Pact', () => {
  it('creates envelopes and validates webhook signatures', async () => {
    const webhookEvent = {
      envelopeId: 'env-1',
      status: 'COMPLETED',
    };
    const signature = crypto
      .createHmac('sha256', 'development-secret')
      .update(JSON.stringify(webhookEvent))
      .digest('hex');

    const pact = new PactV3(baseConfig);

    pact
      .given('an envelope can be created')
      .uponReceiving('an envelope creation request')
      .withRequest({
        method: 'POST',
        path: '/api/v1/esign/envelopes',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'esign-1',
        },
        body: {
          envelopeId: 'env-1',
          documentUrl: 'https://example.com/doc.pdf',
          callbackUrl: 'https://example.com/hook',
          participants: Matchers.eachLike({
            name: 'Borrower',
            email: 'borrower@example.com',
            role: 'BORROWER',
          }),
        },
      })
      .willRespondWith({
        status: 201,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          envelopeId: 'env-1',
          status: Matchers.like('SENT'),
          participants: Matchers.eachLike({
            name: Matchers.like('Borrower'),
            email: Matchers.like('borrower@example.com'),
            role: Matchers.like('BORROWER'),
            status: Matchers.like('PENDING'),
          }),
        },
      });

    pact
      .given('an envelope exists')
      .uponReceiving('an envelope fetch request')
      .withRequest({
        method: 'GET',
        path: '/api/v1/esign/envelopes/env-1',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          envelopeId: 'env-1',
          status: Matchers.like('SENT'),
          participants: Matchers.eachLike({
            name: Matchers.like('Borrower'),
            email: Matchers.like('borrower@example.com'),
            role: Matchers.like('BORROWER'),
            status: Matchers.like('PENDING'),
          }),
        },
      });

    pact
      .given('the webhook signature is valid')
      .uponReceiving('a webhook callback')
      .withRequest({
        method: 'POST',
        path: '/api/v1/esign/webhooks',
        headers: {
          'Content-Type': 'application/json',
          'X-BLP-Signature': signature,
        },
        body: webhookEvent,
      })
      .willRespondWith({
        status: 202,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: { received: true },
      });

    await pact.executeTest(async (mockServer) => {
      const creation = await request(mockServer.url)
        .post('/api/v1/esign/envelopes')
        .set('Idempotency-Key', 'esign-1')
        .send({
          envelopeId: 'env-1',
          documentUrl: 'https://example.com/doc.pdf',
          callbackUrl: 'https://example.com/hook',
          participants: [{ name: 'Borrower', email: 'borrower@example.com', role: 'BORROWER' }],
        });
      expect(creation.status).toBe(201);

      const fetched = await request(mockServer.url).get('/api/v1/esign/envelopes/env-1');
      expect(fetched.status).toBe(200);

      const webhook = await request(mockServer.url)
        .post('/api/v1/esign/webhooks')
        .set('X-BLP-Signature', signature)
        .send(webhookEvent);
      expect(webhook.status).toBe(202);
    });
  });
});
