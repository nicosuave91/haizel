import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces';

@Controller('auth')
export class AuthController {
  @Get('me')
  getCurrentUser(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('public-key')
  @Public()
  getPublicKey(): { algorithm: string } {
    return { algorithm: 'HS256' };
  }
}
