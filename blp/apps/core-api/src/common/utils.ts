import { Request } from 'express';
import { AuthUser, RequestContext } from './interfaces';

export function getRequestContext(req: Request): RequestContext {
  const { tenantId, user } = req as Request & { tenantId: string; user: AuthUser };
  return { tenantId, user };
}
