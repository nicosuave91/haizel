import { Module } from '@nestjs/common';
import { DisclosuresService } from './disclosures.service';

@Module({
  providers: [DisclosuresService],
  exports: [DisclosuresService],
})
export class DisclosuresModule {}
