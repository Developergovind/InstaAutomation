import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { BootstrapTokenDto } from './dto/bootstrap-token.dto';
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
  async getTokenStatus() {
    return successResponse(
      await this.metaTokenService.getTokenStatusDetailed(),
      'Meta token status retrieved successfully',
    );
  }

  @Post('token-bootstrap')
  async bootstrapToken(@Body() body: BootstrapTokenDto) {
    const result = await this.metaTokenService.applyAccessToken(body.accessToken);
    return successResponse(
      result,
      result.refreshed
        ? 'Meta token bootstrapped successfully'
        : 'Meta token bootstrap failed',
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
