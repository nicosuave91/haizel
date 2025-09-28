import { StorageAdapter } from '../storage';
import { DocumentManifestService } from '../manifest';

export interface LoanEstimateContext {
  loanId: string;
  tenantId: string;
  borrowerName: string;
  propertyAddress: string;
  loanAmountCents: number;
  aprBps: number;
  issuedAt: string;
}

export interface LoanEstimateTemplateResult {
  url: string;
  checksum: string;
  versionId: string;
}

export class LoanEstimateTemplate {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly manifests: DocumentManifestService,
  ) {}

  async render(context: LoanEstimateContext): Promise<LoanEstimateTemplateResult> {
    const body = this.compile(context);
    const key = `${context.tenantId}/${context.loanId}/documents/LE-${Date.now()}.html`;
    const stored = await this.storage.putObject(key, body, { contentType: 'text/html' });
    await this.manifests.attachDocument(context.loanId, {
      code: 'LE',
      checksum: stored.checksum,
    });
    return stored;
  }

  private compile(context: LoanEstimateContext): string {
    const loanAmount = (context.loanAmountCents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const apr = (context.aprBps / 100).toFixed(3);
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Loan Estimate</title>
    <style>
      body { font-family: Inter, Helvetica, Arial, sans-serif; margin: 2rem; }
      header { margin-bottom: 1.5rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      td { border: 1px solid #d1d5db; padding: 0.75rem; }
      h1 { font-size: 1.5rem; margin: 0; }
      .muted { color: #6b7280; }
    </style>
  </head>
  <body>
    <header>
      <h1>Loan Estimate</h1>
      <div class="muted">Issued ${context.issuedAt}</div>
    </header>
    <section>
      <p><strong>Borrower:</strong> ${context.borrowerName}</p>
      <p><strong>Property:</strong> ${context.propertyAddress}</p>
      <table>
        <tbody>
          <tr>
            <td><strong>Loan Amount</strong></td>
            <td>${loanAmount}</td>
          </tr>
          <tr>
            <td><strong>Annual Percentage Rate</strong></td>
            <td>${apr}%</td>
          </tr>
        </tbody>
      </table>
    </section>
  </body>
</html>`;
  }
}
