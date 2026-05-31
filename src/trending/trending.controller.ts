import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { successResponse } from '../common/utils/api-response.util';
import { TrendingService } from './trending.service';

@Controller('trending')
export class TrendingController {
  constructor(
    private readonly trendingService: TrendingService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getAllTrends() {
    const niche = this.configService.get<string>('niche') ?? 'technology';
    const topics = await this.trendingService.getAllTrends(niche);
    return successResponse(topics, 'Trending topics fetched successfully');
  }

  @Get('top')
  async getTopTrend() {
    const niche = this.configService.get<string>('niche') ?? 'technology';
    const topic = await this.trendingService.getTopTrend(niche);
    return successResponse({ topic }, 'Top trending topic fetched successfully');
  }
}
