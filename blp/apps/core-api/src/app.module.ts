import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { LoansModule } from './loans/loans.module';
import { PricingModule } from './pricing/pricing.module';
import { DocumentsModule } from './documents/documents.module';
import { AusModule } from './aus/aus.module';
import { CreditModule } from './credit/credit.module';
import { RulesModule } from './rules-proxy/rules.module';
import { EventsModule } from './events/events.module';
import { TemporalModule } from './temporal/temporal.module';
import { OpaModule } from './opa/opa.module';
import { ConditionsModule } from './conditions/conditions.module';
import { DisclosuresModule } from './disclosures/disclosures.module';
import { HealthController } from './health/health.controller';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    EventsModule,
    TemporalModule,
    OpaModule,
    AuthModule,
    TenancyModule,
    LoansModule,
    PricingModule,
    DocumentsModule,
    AusModule,
    CreditModule,
    RulesModule,
    ConditionsModule,
    DisclosuresModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
