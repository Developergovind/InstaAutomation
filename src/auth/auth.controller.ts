import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from './public.decorator';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { successResponse } from '../common/utils/api-response.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return successResponse(
      await this.authService.login(body.email, body.password),
      'Login successful',
    );
  }

  @Get('me')
  async me(@Req() request: Request & { user: JwtPayload }) {
    return successResponse(
      { email: request.user.sub, role: request.user.role },
      'Session valid',
    );
  }
}
