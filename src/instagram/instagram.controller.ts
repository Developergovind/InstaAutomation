import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { SchedulerService } from '../scheduler/scheduler.service';
import { ManualPostDto } from './dto/manual-post.dto';
import { InstagramService } from './instagram.service';
import { MetaTokenService } from './meta-token.service';

@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly schedulerService: SchedulerService,
    private readonly metaTokenService: MetaTokenService,
  ) {}

  @Post('post')
  async triggerPost(@Body() body: ManualPostDto) {
    const result = await this.schedulerService.triggerManualPost(
      body.topic,
      body.niche,
    );

    return successResponse(
      {
        content: result.content,
        publishResult: result.publishResult,
      },
      result.publishResult.success
        ? 'Instagram post published successfully'
        : 'Instagram post pipeline completed with errors',
    );
  }

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
        : 'Meta token refresh skipped or not needed',
    );
  }
}
