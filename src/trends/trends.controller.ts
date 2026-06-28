import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { TrendFetchService } from '../sources/trend-fetch.service';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(
    private readonly trendsService: TrendsService,
    private readonly trendFetchService: TrendFetchService,
  ) {}

  @Get()
  async listTrends(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 15;
    const result = await this.trendsService.getAllRankedPaginated(
      parsedPage,
      parsedLimit,
    );
    return successResponse(result, 'Trends retrieved successfully');
  }

  @Get('top')
  async getTopTrend() {
    const trend = await this.trendsService.getTopUnprocessed();
    return successResponse(trend, 'Top unprocessed trend retrieved');
  }

  @Post('fetch')
  async triggerFetch() {
    const result = await this.trendFetchService.fetchAndStoreAll();
    return successResponse(result, 'Trend fetch completed');
  }

  @Get(':id')
  async getTrend(@Param('id') id: string) {
    const trend = await this.trendsService.getById(id);
    return successResponse(trend, 'Trend retrieved successfully');
  }
}
