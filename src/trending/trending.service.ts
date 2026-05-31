import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../groq/groq.service';

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);

  constructor(private readonly groqService: GroqService) {}

  async getTopTrend(niche: string): Promise<string> {
    try {
      const topics = await this.groqService.fetchTrendingTopics(niche);
      this.logger.log(`Fetched trending topics: ${topics.join(', ')}`);
      return topics[0] ?? 'General trending topic';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`getTopTrend failed: ${message}`);
      throw error;
    }
  }

  async getAllTrends(niche: string): Promise<string[]> {
    try {
      const topics = await this.groqService.fetchTrendingTopics(niche);
      this.logger.log(`Fetched ${topics.length} trending topics`);
      return topics;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`getAllTrends failed: ${message}`);
      throw error;
    }
  }
}
