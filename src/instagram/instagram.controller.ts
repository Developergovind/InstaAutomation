import { Controller, Get, Param, Post } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { InstagramService } from './instagram.service';
import { MetaTokenService } from './meta-token.service';

@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly metaTokenService: MetaTokenService,
  ) {}

  @Get('status/:containerId')
  async getContainerStatus(@Param('containerId') containerId: string) {
    const status = await this.instagramService.checkContainerStatus(containerId);
    return successResponse(
      { containerId, status },
      'Container status retrieved successfully',
    );
  }

  @Get('token-status')
  getTokenStatus() {
    return successResponse(
      this.metaTokenService.getTokenStatus(),
      'Meta token status retrieved successfully',
    );
  }

  @Post('token-refresh')
  async refreshToken() {
    const result = await this.metaTokenService.refreshTokenIfNeeded(true);
    return successResponse(
      result,
      result.refreshed
        ? 'Meta token refreshed successfully'
        : 'Meta token refresh skipped or failed',
    );
  }
}
