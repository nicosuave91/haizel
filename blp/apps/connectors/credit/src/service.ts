import {
  CreditAdapterPayload,
  CreditAdapterResponse,
  CreditReport,
  CreditReportRequest,
  mapFromAdapterResponse,
  mapToAdapterPayload,
} from './mappers';

export interface CreditBureauAdapter {
  pullReport(payload: CreditAdapterPayload): Promise<CreditAdapterResponse>;
}

class MockCreditBureauAdapter implements CreditBureauAdapter {
  async pullReport(payload: CreditAdapterPayload): Promise<CreditAdapterResponse> {
    const score = payload.includeScore
      ? 720 - (payload.social.endsWith('9') ? 80 : 0)
      : undefined;
    return {
      tradelines: [
        {
          creditor: 'Sample Bank',
          balance: 15000,
          status: 'OPEN',
        },
        {
          creditor: 'Contoso Auto',
          balance: 7000,
          status: 'OPEN',
        },
      ],
      score,
    };
  }
}

export class CreditService {
  constructor(private readonly adapter: CreditBureauAdapter = new MockCreditBureauAdapter()) {}

  async getReport(request: CreditReportRequest): Promise<CreditReport> {
    const payload = mapToAdapterPayload(request);
    const response = await this.adapter.pullReport(payload);
    return mapFromAdapterResponse(request, response);
  }
}
