import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/interfaces';

export interface PolicyInput {
  action: string;
  resourceTenant: string;
}

@Injectable()
export class OpaService {
  async authorize(user: AuthUser, input: PolicyInput): Promise<void> {
    if (user.tenantId !== input.resourceTenant) {
      throw new ForbiddenException('Tenant access denied');
    }

    const namespace = input.action.split(':')[0];
    if (!user.permissions.includes(input.action) && !user.permissions.includes(`${namespace}:*`)) {
      throw new ForbiddenException(`Missing permission for ${input.action}`);
    }
  }
}
