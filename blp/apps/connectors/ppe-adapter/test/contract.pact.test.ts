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

async function setupProvider() {
  const provider = new Pact(baseConfig);
  const mockService = await provider.setup();
  const baseUrl = mockService?.baseUrl ?? provider.mockService?.baseUrl;
  if (!baseUrl) {
    throw new Error('Failed to determine Pact mock service URL');
  }

  return { provider, baseUrl };
}

describe('PPE Adapter Pact', () => {
  it('creates purchase quotes with risk details', async () => {
    const { provider, baseUrl } = await setupProvider();

    try {
      await provider.addInteraction({
        state: 'pricing engine is online',
        uponReceiving: 'a quote request',
        withRequest: {
          method: 'POST',
          path: '/api/v1/ppe/quotes',
          headers: {
            'idempotency-key': 'quote-123',
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
            'content-type': 'application/json; charset=utf-8',
          },
          body: {
            quoteId: Matchers.like('loan-1-Q-30'),
            loanId: Matchers.like('loan-1'),
            rate: Matchers.like(6.0),
            price: Matchers.like(96.0),
            expiresAt: Matchers.like('2024-01-01T00:00:00.000Z'),
          },
        },
      });

      const quoteResponse = await request(baseUrl)
        .post('/api/v1/ppe/quotes')
        .set('Idempotency-Key', 'quote-123')
        .set('content-type', 'application/json')
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
      expect(quoteResponse.body.loanId).toBe('loan-1');
      expect(typeof quoteResponse.body.rate).toBe('number');
      expect(typeof quoteResponse.body.price).toBe('number');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });

  it('locks rates for approved quotes', async () => {
    const { provider, baseUrl } = await setupProvider();

    try {
      await provider.addInteraction({
        state: 'a quote exists',
        uponReceiving: 'a rate lock request',
        withRequest: {
          method: 'POST',
          path: '/api/v1/ppe/locks',
          headers: {
            'idempotency-key': 'lock-123',
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
            'content-type': 'application/json; charset=utf-8',
          },
          body: {
            lockId: Matchers.like('loan-1-L-30'),
            status: Matchers.like('LOCKED'),
            lockedRate: Matchers.like(6.0),
            lockExpiresAt: Matchers.like('2024-01-15T00:00:00.000Z'),
          },
        },
      });

      const lockResponse = await request(baseUrl)
        .post('/api/v1/ppe/locks')
        .set('Idempotency-Key', 'lock-123')
        .set('content-type', 'application/json')
        .send({
          quoteId: 'loan-1-Q-30',
          loanId: 'loan-1',
          borrowerId: 'borrower-1',
          lockPeriodDays: 30,
        });

      expect(lockResponse.status).toBe(200);
      expect(lockResponse.body.lockId).toContain('loan-1');
      expect(lockResponse.body.status).toBe('LOCKED');
      expect(typeof lockResponse.body.lockedRate).toBe('number');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });

  it('retrieves an existing lock', async () => {
    const { provider, baseUrl } = await setupProvider();

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
            'content-type': 'application/json; charset=utf-8',
          },
          body: {
            lockId: 'loan-1-L-30',
            status: Matchers.like('LOCKED'),
            lockedRate: Matchers.like(6.0),
            lockExpiresAt: Matchers.like('2024-01-15T00:00:00.000Z'),
          },
        },
      });

      const response = await request(baseUrl).get('/api/v1/ppe/locks/loan-1-L-30');
      expect(response.status).toBe(200);
      expect(response.body.lockId).toBe('loan-1-L-30');
      expect(response.body.status).toBe('LOCKED');

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });
});
