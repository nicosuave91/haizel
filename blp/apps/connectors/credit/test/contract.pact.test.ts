import path from 'node:path';
import { MatchersV3 as Matchers, PactV3 } from '@pact-foundation/pact';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const baseConfig = {
  consumer: 'CoreAPI',
  provider: 'CreditConnector',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
};

describe('Credit connector Pact', () => {
  it('creates and retrieves a credit pull', async () => {
    const provider = new PactV3(baseConfig);

    provider
      .given('credit bureau accepts a pull')
      .uponReceiving('a credit pull request')
      .withRequest({
        method: 'POST',
        path: '/api/v1/credit/pulls',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'credit-pull-1',
        },
        body: {
          borrowerId: 'borrower-1',
          ssn: '123-45-6789',
          includeScore: true,
        },
      })
      .willRespondWith({
        status: 202,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          requestId: Matchers.like('borrower-1-PULL'),
          status: Matchers.like('COMPLETED'),
        },
      });

    provider
      .given('a credit pull result exists')
      .uponReceiving('a credit pull result request')
      .withRequest({
        method: 'GET',
        path: '/api/v1/credit/pulls/borrower-1-PULL',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          requestId: 'borrower-1-PULL',
          status: Matchers.like('COMPLETED'),
          borrowerId: 'borrower-1',
          tradelines: Matchers.eachLike({
            creditor: Matchers.like('Sample Bank'),
            balance: Matchers.like(15000),
            status: Matchers.like('OPEN'),
          }),
          score: Matchers.like(720),
          refreshedAt: Matchers.like('2024-01-01T00:00:00.000Z'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const acknowledgement = await request(mockServer.url)
        .post('/api/v1/credit/pulls')
        .set('Idempotency-Key', 'credit-pull-1')
        .send({ borrowerId: 'borrower-1', ssn: '123-45-6789', includeScore: true });

      expect(acknowledgement.status).toBe(202);
      expect(acknowledgement.body.requestId).toBe('borrower-1-PULL');

      const result = await request(mockServer.url).get('/api/v1/credit/pulls/borrower-1-PULL');
      expect(result.status).toBe(200);
      expect(result.body.borrowerId).toBe('borrower-1');
      expect(result.body.tradelines.length).toBeGreaterThan(0);
    });
  });
});
