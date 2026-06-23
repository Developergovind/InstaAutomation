import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('fetch')
  async fetchAnalytics() {
    const result = await this.analyticsService.fetchAndStoreAll();
    return successResponse(result, 'Analytics fetch completed');
  }

  @Get()
  async listAnalytics(
    @Query('mediaType') mediaType?: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.analyticsService.findAll(
      mediaType,
      limit ? parseInt(limit, 10) : 50,
    );
    return successResponse(items, 'Analytics retrieved successfully');
  }

  @Get(':mediaId')
  async getByMediaId(@Param('mediaId') mediaId: string) {
    const item = await this.analyticsService.findByMediaId(mediaId);
    return successResponse(item, 'Analytics item retrieved');
  }
}
