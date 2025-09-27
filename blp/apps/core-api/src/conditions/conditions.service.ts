import { Injectable } from '@nestjs/common';

@Injectable()
export class ConditionsService {
  listForLoan(loanId: string): string[] {
    return [`Submit updated paystub for loan ${loanId}`, `Verify employment for loan ${loanId}`];
  }
}
