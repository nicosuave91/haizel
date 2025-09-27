import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { TenantInterceptor } from './tenant.interceptor';

@Module({
  providers: [
    Reflector,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class TenancyModule {}
