import path from 'node:path';
import { Matchers, Pact } from '@pact-foundation/pact';
import request from 'supertest';
import { createServer } from '../src/server';

const provider = new Pact({
  consumer: 'CoreAPI',
  provider: 'ESignConnector',
  dir: path.resolve(__dirname, '../../pacts'),
  spec: 3,
  port: 0,
  logLevel: 'warn',
});

describe('E-Sign connector Pact', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    try {
      await provider.finalize();
    } finally {
      const pactInternals = provider as unknown as {
        pact?: { cleanupMockServer(port: number): boolean };
        opts?: { port?: number };
      };
      const port = pactInternals.opts?.port;
      if (pactInternals.pact && typeof port === 'number' && port > 0) {
        pactInternals.pact.cleanupMockServer(port);
      }
    }
  });

  afterEach(async () => {
    await provider.verify();
  });

  it('creates envelopes for signing', async () => {
    await provider.addInteraction({
      state: 'a borrower requests e-signature',
      uponReceiving: 'an envelope creation request',
      withRequest: {
        method: 'POST',
        path: '/api/v1/esign/envelopes',
        headers: {
          'Content-Type': 'application/json',
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
      },
      willRespondWith: {
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
      },
    });

    const response = await request(createServer())
      .post('/api/v1/esign/envelopes')
      .send({
        envelopeId: 'env-1',
        documentUrl: 'https://example.com/doc.pdf',
        callbackUrl: 'https://example.com/hook',
        participants: [{ name: 'Borrower', email: 'borrower@example.com', role: 'BORROWER' }],
      });

    expect(response.status).toBe(201);
    expect(response.body.envelopeId).toBe('env-1');
  });
});
