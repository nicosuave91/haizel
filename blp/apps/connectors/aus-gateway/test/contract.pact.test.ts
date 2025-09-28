import path from 'node:path';
import { MatchersV3 as Matchers, PactV3 } from '@pact-foundation/pact';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('AUS Gateway Pact', () => {
  it('submits a case and retrieves a decision', async () => {
    const pact = new PactV3({
      consumer: 'CoreAPI',
      provider: 'AUSGateway',
      dir: path.resolve(__dirname, '../../pacts'),
      logLevel: 'warn',
    });

    pact
      .given('an AUS submission can be created')
      .uponReceiving('an AUS submission')
      .withRequest({
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
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          loanId: 'loan-1',
          borrowerId: 'borrower-1',
          result: Matchers.like('APPROVED'),
          reasons: Matchers.eachLike('Automated approval'),
          submittedAt: Matchers.like('2024-01-01T00:00:00.000Z'),
        },
      });

    pact
      .given('an AUS decision exists')
      .uponReceiving('a request for AUS results')
      .withRequest({
        method: 'GET',
        path: '/api/v1/aus/results/loan-1',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          loanId: 'loan-1',
          borrowerId: 'borrower-1',
          result: Matchers.like('APPROVED'),
          reasons: Matchers.eachLike('Automated approval'),
          submittedAt: Matchers.like('2024-01-01T00:00:00.000Z'),
        },
      });

    await pact.executeTest(async (mockServer) => {
      const submission = await request(mockServer.url)
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

      const result = await request(mockServer.url).get('/api/v1/aus/results/loan-1');
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        loanId: 'loan-1',
        borrowerId: 'borrower-1',
      });
    });
  });
});
