import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
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
    const provider = new Pact(baseConfig);
    await provider.setup();

    try {
      await provider.addInteraction({
        state: 'credit bureau accepts a pull',
        uponReceiving: 'a credit pull request',
        withRequest: {
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
        },
        willRespondWith: {
          status: 202,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            requestId: Matchers.like('borrower-1-PULL'),
            status: Matchers.like('COMPLETED'),
          },
        },
      });

      await provider.addInteraction({
        state: 'a credit pull result exists',
        uponReceiving: 'a credit pull result request',
        withRequest: {
          method: 'GET',
          path: '/api/v1/credit/pulls/borrower-1-PULL',
        },
        willRespondWith: {
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
        },
      });

      const baseUrl = provider.mockService ? provider.mockService.baseUrl : '';
      const acknowledgement = await request(baseUrl)
        .post('/api/v1/credit/pulls')
        .set('Idempotency-Key', 'credit-pull-1')
        .send({ borrowerId: 'borrower-1', ssn: '123-45-6789', includeScore: true });

      expect(acknowledgement.status).toBe(202);

      const result = await request(baseUrl).get('/api/v1/credit/pulls/borrower-1-PULL');
      expect(result.status).toBe(200);
      expect(result.body.borrowerId).toBe('borrower-1');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });
});
