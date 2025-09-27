import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.headers['x-tenant-id'] ?? request.user?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant header is required');
    }

    if (request.user?.tenantId && request.user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant header does not match token');
    }

    request.tenantId = tenantId;
    return next.handle();
  }
}
