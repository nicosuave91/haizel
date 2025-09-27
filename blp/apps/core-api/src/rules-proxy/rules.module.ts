import { Module } from '@nestjs/common';
import { RulesController } from './rules.controller';
import { RulesProxyService } from './rules.service';
import { OpaModule } from '../opa/opa.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [OpaModule, CommonModule],
  controllers: [RulesController],
  providers: [RulesProxyService],
  exports: [RulesProxyService],
})
export class RulesModule {}
