import { AuthUser } from '../common/interfaces';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string;
    user?: AuthUser;
  }
}
