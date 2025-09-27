import { Injectable } from '@nestjs/common';
import { JwtPayload, verify } from 'jsonwebtoken';
import { ConfigService } from '../config';
import { AuthUser } from '../common/interfaces';

interface Auth0JwtPayload extends JwtPayload {
  sub: string;
  'https://blp.dev/tenant'?: string;
  permissions?: string[];
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  async verifyToken(token: string): Promise<AuthUser> {
    const { secret, audience, issuer } = this.config.auth0;
    const decoded = verify(token, secret, {
      audience,
      issuer,
    }) as Auth0JwtPayload;

    return {
      sub: decoded.sub,
      tenantId: decoded['https://blp.dev/tenant'] ?? decoded['tenantId'] ?? '',
      permissions: decoded.permissions ?? [],
    };
  }
}
