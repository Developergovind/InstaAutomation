import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { successResponse } from '../common/utils/api-response.util';
import { AuthService, JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.email, body.password);
    return successResponse(result, 'Login successful');
  }

  @Get('me')
  async me(@Req() req: Request & { user: JwtPayload }) {
    const user = await this.authService.validatePayload(req.user);
    return successResponse(user, 'Session valid');
  }
}
