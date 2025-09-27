import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const baseConfig = {
  consumer: 'CoreAPI',
  provider: 'AUSGateway',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
};

describe('AUS Gateway Pact', () => {
  it('submits a case and retrieves a decision', async () => {
    const provider = new Pact(baseConfig);
    await provider.setup();

    try {
      await provider.addInteraction({
        state: 'an AUS submission can be created',
        uponReceiving: 'an AUS submission',
        withRequest: {
          method: 'POST',
          path: '/api/v1/aus/submit',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'aus-submit-1',
          },
          body: {
            loanId: 'loan-1',
            borrowerId: 'borrower-1',
            dti: 0.35,
            ltv: 0.8,
            creditScore: 720,
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            loanId: 'loan-1',
            borrowerId: 'borrower-1',
            result: Matchers.like('APPROVED'),
            reasons: Matchers.eachLike('Automated approval', { min: 0 }),
            submittedAt: Matchers.like('2024-01-01T00:00:00.000Z'),
          },
        },
      });

      await provider.addInteraction({
        state: 'an AUS decision exists',
        uponReceiving: 'a request for AUS results',
        withRequest: {
          method: 'GET',
          path: '/api/v1/aus/results/loan-1',
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            loanId: 'loan-1',
            borrowerId: 'borrower-1',
            result: Matchers.like('APPROVED'),
            reasons: Matchers.eachLike('Automated approval', { min: 0 }),
            submittedAt: Matchers.like('2024-01-01T00:00:00.000Z'),
          },
        },
      });

      const baseUrl = provider.mockService ? provider.mockService.baseUrl : '';
      const submission = await request(baseUrl)
        .post('/api/v1/aus/submit')
        .set('Idempotency-Key', 'aus-submit-1')
        .send({ loanId: 'loan-1', borrowerId: 'borrower-1', dti: 0.35, ltv: 0.8, creditScore: 720 });

      expect(submission.status).toBe(200);
      expect(submission.body).toMatchObject({
        loanId: 'loan-1',
        borrowerId: 'borrower-1',
      });
      expect(submission.body.result).toBeDefined();
      expect(Array.isArray(submission.body.reasons)).toBe(true);

      const result = await request(baseUrl).get('/api/v1/aus/results/loan-1');
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        loanId: 'loan-1',
        borrowerId: 'borrower-1',
      });

      await provider.verify();
    } finally {
      await provider.finalize();
    }
  });
});
