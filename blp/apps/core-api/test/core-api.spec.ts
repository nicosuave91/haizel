import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { sign } from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { WorkflowsClient } from '../src/temporal/workflows.client';
import { EventsProducerService } from '../src/events/producer.service';

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';

function buildToken(config: ConfigService, tenantId: string, permissions: string[] = []) {
  return sign(
    {
      sub: `user|${tenantId}`,
      'https://blp.dev/tenant': tenantId,
      permissions,
    },
    config.auth0.secret,
    {
      issuer: config.auth0.issuer,
      audience: config.auth0.audience,
    },
  );
}

describe('Core API integration', () => {
  let app: INestApplication;
  let config: ConfigService;
  let workflows: WorkflowsClient;
  let events: EventsProducerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    config = app.get(ConfigService);
    workflows = app.get(WorkflowsClient);
    events = app.get(EventsProducerService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes public health endpoint', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('enforces tenant binding on headers', async () => {
    const token = buildToken(config, tenantA, ['loan:create']);
    await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantB)
      .send({ borrowerName: 'Jane', amount: 350000 })
      .expect(403);
  });

  it('creates, retrieves, and lists loans with RLS enforcement', async () => {
    const token = buildToken(config, tenantA, ['loan:create', 'loan:list', 'loan:read']);

    const createResponse = await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ borrowerName: 'John Doe', amount: 450000 })
      .expect(201);

    const loanId = createResponse.body.id;

    await request(app.getHttpServer())
      .get(`/loans/${loanId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .expect(200)
      .expect((res: Response) => {
        expect(res.body.borrowerName).toBe('John Doe');
      });

    await request(app.getHttpServer())
      .get('/loans')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .expect(200)
      .expect((res: Response) => {
        expect(res.body).toHaveLength(1);
      });

    const tokenB = buildToken(config, tenantB, ['loan:read']);
    await request(app.getHttpServer())
      .get(`/loans/${loanId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-tenant-id', tenantB)
      .expect(404);
  });

  it('handles document upload and listing with versioning', async () => {
    const token = buildToken(config, tenantA, ['loan:create', 'loan:read', 'loan:list']);
    const loanRes = await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ borrowerName: 'Doc Borrower', amount: 250000 })
      .expect(201);

    const loanId = loanRes.body.id;

    const docToken = buildToken(config, tenantA, ['loan:read', 'document:upload', 'document:list']);
    await request(app.getHttpServer())
      .post(`/loans/${loanId}/documents`)
      .set('Authorization', `Bearer ${docToken}`)
      .set('x-tenant-id', tenantA)
      .send({ name: 'W2.pdf', contentType: 'application/pdf', content: Buffer.from('file').toString('base64') })
      .expect(201)
      .expect((res: Response) => {
        expect(res.body.version).toBe(1);
      });

    const listResponse = await request(app.getHttpServer())
      .get(`/loans/${loanId}/documents`)
      .set('Authorization', `Bearer ${docToken}`)
      .set('x-tenant-id', tenantA)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
  });

  it('coordinates pricing locks, AUS runs, credit pulls, and rules evaluation', async () => {
    const token = buildToken(config, tenantA, [
      'loan:create',
      'loan:read',
      'pricing:lock',
      'aus:run',
      'credit:pull',
      'rules:evaluate',
    ]);

    const loanRes = await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ borrowerName: 'Workflow Borrower', amount: 650000 })
      .expect(201);

    const loanId = loanRes.body.id;

    const lockRes = await request(app.getHttpServer())
      .post(`/loans/${loanId}/pricing/lock`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ rate: 6.25, durationMinutes: 30 })
      .expect(201);

    expect(lockRes.body.rate).toBeCloseTo(6.25);

    await request(app.getHttpServer())
      .post(`/loans/${loanId}/aus/run`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ engine: 'DU' })
      .expect(201)
      .expect((res: Response) => {
        expect(res.body.decision).toBe('Refer');
      });

    await request(app.getHttpServer())
      .post(`/loans/${loanId}/credit/pull`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ bureau: 'Experian' })
      .expect(201)
      .expect((res: Response) => {
        expect(res.body.score).toBeGreaterThan(600);
      });

    await request(app.getHttpServer())
      .post(`/loans/${loanId}/rules/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ trigger: 'submission' })
      .expect(200)
      .expect((res: Response) => {
        expect(res.body.passed).toBe(false);
        expect(res.body.findings).toContain('Loan amount exceeds auto-approval threshold.');
      });

    const scheduled = workflows.getScheduled();
    expect(scheduled.some((wf) => wf.workflow === 'pricing.lock.expiration')).toBe(true);

    const emittedEvents = events.getEmittedEvents();
    const eventTypes = emittedEvents.map((event) => event.type);
    expect(eventTypes).toEqual(expect.arrayContaining(['pricing.locked', 'aus.completed', 'credit.pulled']));
  });
});
