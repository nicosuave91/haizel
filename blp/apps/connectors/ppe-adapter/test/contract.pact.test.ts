import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const baseConfig = {
  consumer: 'CoreAPI',
  provider: 'PPEAdapter',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
};

describe('PPE Adapter Pact', () => {
  it('supports quoting and locking loans', async () => {
    const provider = new Pact(baseConfig);
    await provider.setup();

    try {
      await provider.addInteraction({
        state: 'pricing engine is online',
        uponReceiving: 'a quote request',
        withRequest: {
          method: 'POST',
          path: '/api/v1/ppe/quotes',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'quote-123',
          },
          body: {
            loanId: 'loan-1',
            loanAmount: 350000,
            productCode: '30FXD',
            propertyState: 'CA',
            lockPeriodDays: 30,
            ltv: 0.8,
            fico: 720,
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            quoteId: Matchers.like('loan-1-Q-30'),
            loanId: 'loan-1',
            rate: Matchers.like(6.0),
            price: Matchers.like(96.0),
            expiresAt: Matchers.like('2024-01-01T00:00:00.000Z'),
          },
        },
      });

      await provider.addInteraction({
        state: 'a quote exists',
        uponReceiving: 'a rate lock request',
        withRequest: {
          method: 'POST',
          path: '/api/v1/ppe/locks',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'lock-123',
          },
          body: {
            quoteId: 'loan-1-Q-30',
            loanId: 'loan-1',
            borrowerId: 'borrower-1',
            lockPeriodDays: 30,
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            lockId: Matchers.like('loan-1-L-30'),
            status: Matchers.like('LOCKED'),
            lockedRate: Matchers.like(6.0),
            lockExpiresAt: Matchers.like('2024-01-15T00:00:00.000Z'),
          },
        },
      });

      const baseUrl = provider.mockService ? provider.mockService.baseUrl : '';
      const quoteResponse = await request(baseUrl)
        .post('/api/v1/ppe/quotes')
        .set('Idempotency-Key', 'quote-123')
        .send({
          loanId: 'loan-1',
          loanAmount: 350000,
          productCode: '30FXD',
          propertyState: 'CA',
          lockPeriodDays: 30,
          ltv: 0.8,
          fico: 720,
        });

      expect(quoteResponse.status).toBe(200);

      const lockResponse = await request(baseUrl)
        .post('/api/v1/ppe/locks')
        .set('Idempotency-Key', 'lock-123')
        .send({
          quoteId: 'loan-1-Q-30',
          loanId: 'loan-1',
          borrowerId: 'borrower-1',
          lockPeriodDays: 30,
        });

      expect(lockResponse.status).toBe(200);
      expect(lockResponse.body.lockId).toContain('loan-1');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });

  it('retrieves an existing lock', async () => {
    const provider = new Pact(baseConfig);
    await provider.setup();

    try {
      await provider.addInteraction({
        state: 'a lock exists',
        uponReceiving: 'a lock status request',
        withRequest: {
          method: 'GET',
          path: '/api/v1/ppe/locks/loan-1-L-30',
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            lockId: 'loan-1-L-30',
            status: Matchers.like('LOCKED'),
            lockedRate: Matchers.like(6.0),
            lockExpiresAt: Matchers.like('2024-01-15T00:00:00.000Z'),
          },
        },
      });

      const baseUrl = provider.mockService ? provider.mockService.baseUrl : '';
      const response = await request(baseUrl).get('/api/v1/ppe/locks/loan-1-L-30');
      expect(response.status).toBe(200);
      expect(response.body.lockId).toBe('loan-1-L-30');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });
});
