import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { createServer } from '../src/server';

const provider = new Pact({
  consumer: 'CoreAPI',
  provider: 'AUSGateway',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
});

describe('AUS Gateway Pact', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  it('returns an automated decision', async () => {
    await provider.addInteraction({
      state: 'loan submission exists',
      uponReceiving: 'an AUS submission',
      withRequest: {
        method: 'POST',
        path: '/api/v1/aus/submit',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          loanId: 'loan-1',
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
          result: Matchers.like('APPROVED'),
          reasons: Matchers.eachLike('Automated approval', { min: 0 }),
        },
      },
    });

    const res = await request(createServer())
      .post('/api/v1/aus/submit')
      .send({ loanId: 'loan-1', dti: 0.35, ltv: 0.8, creditScore: 720 });

    expect(res.status).toBe(200);
    expect(res.body.loanId).toBe('loan-1');
  });
});
