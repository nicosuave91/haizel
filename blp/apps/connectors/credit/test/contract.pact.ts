import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { createServer } from '../src/server';

const provider = new Pact({
  consumer: 'CoreAPI',
  provider: 'CreditConnector',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
});

describe('Credit connector Pact', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  it('produces a credit report', async () => {
    await provider.addInteraction({
      state: 'credit profile exists',
      uponReceiving: 'a request for a credit report',
      withRequest: {
        method: 'POST',
        path: '/api/v1/credit/report',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          borrowerId: 'abc',
          ssn: '123-45-6789',
          includeScore: true,
        },
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          borrowerId: 'abc',
          tradelines: Matchers.eachLike({
            creditor: Matchers.like('Sample Bank'),
            balance: Matchers.like(15000),
            status: Matchers.like('OPEN'),
          }),
          score: Matchers.like(720),
        },
      },
    });

    const response = await request(createServer())
      .post('/api/v1/credit/report')
      .send({ borrowerId: 'abc', ssn: '123-45-6789', includeScore: true });

    expect(response.status).toBe(200);
    expect(response.body.borrowerId).toBe('abc');
    expect(response.body.tradelines.length).toBeGreaterThan(0);
  });
});
