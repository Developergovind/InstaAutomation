import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { SchedulerService } from '../scheduler/scheduler.service';
import { ManualPostDto } from './dto/manual-post.dto';
import { InstagramService } from './instagram.service';

@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly schedulerService: SchedulerService,
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
}
