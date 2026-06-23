import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const adminEmail = this.configService.get<string>('auth.adminEmail');
    const adminPassword = this.configService.get<string>('auth.adminPassword');

    if (email !== adminEmail || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { sub: email, role: 'admin' },
      { expiresIn: '7d' },
    );
    return { accessToken };
  }

  async validatePayload(payload: JwtPayload): Promise<{ email: string; role: string }> {
    return { email: payload.sub, role: payload.role };
  }
}
