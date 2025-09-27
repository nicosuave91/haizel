import { Module } from '@nestjs/common';
import { OpaService } from './opa.service';

@Module({
  providers: [OpaService],
  exports: [OpaService],
})
export class OpaModule {}
