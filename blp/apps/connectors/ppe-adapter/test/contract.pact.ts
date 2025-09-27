import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { createServer } from '../src/server';

const provider = new Pact({
  consumer: 'CoreAPI',
  provider: 'PPEAdapter',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
});

describe('PPE Adapter Pact', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  it('returns an eligibility decision', async () => {
    await provider.addInteraction({
      state: 'borrower is active',
      uponReceiving: 'a PPE eligibility request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/ppe/eligibility',
        body: {
          borrowerId: '123',
          loanAmount: 500000,
          propertyState: 'WA',
          occupancy: 'PRIMARY',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          borrowerId: '123',
          eligible: true,
          maxLtv: Matchers.like(0.7),
        },
      },
    });

    const app = createServer();
    const response = await request(app)
      .post('/api/v1/ppe/eligibility')
      .send({
        borrowerId: '123',
        loanAmount: 500000,
        propertyState: 'WA',
        occupancy: 'PRIMARY',
      });

    expect(response.status).toBe(200);
    expect(response.body.borrowerId).toBe('123');
    expect(response.body.eligible).toBe(true);
  });
});
