import { Injectable } from '@nestjs/common';

@Injectable()
export class DisclosuresService {
  listForLoan(): string[] {
    return ['LE', 'CD'];
  }
}
