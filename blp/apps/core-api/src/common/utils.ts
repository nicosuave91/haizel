import { Request } from 'express';
import { trace } from '@opentelemetry/api';
import { AuthUser, RequestContext } from './interfaces';

export function getRequestContext(req: Request): RequestContext {
  const { tenantId, user, contextId } = req as Request & { tenantId: string; user: AuthUser; contextId?: string };
  const activeSpan = trace.getActiveSpan();
  return {
    tenantId,
    user,
    requestId: contextId ?? req.header('x-request-id') ?? undefined,
    traceId: activeSpan?.spanContext().traceId,
  };
}
