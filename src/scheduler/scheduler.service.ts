import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { GroqService } from '../groq/groq.service';
import { InstagramService } from '../instagram/instagram.service';
import { TrendingService } from '../trending/trending.service';
import { ManualPostPipelineResult } from './interfaces/pipeline-result.interface';

const AUTO_POST_CRON_NAME = 'auto-instagram-post';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly trendingService: TrendingService,
    private readonly groqService: GroqService,
    private readonly instagramService: InstagramService,
  ) {}

  onModuleInit(): void {
    const cronTime =
      this.configService.get<string>('schedule.cronTime') ?? '0 9 * * *';
    const timeZone =
      this.configService.get<string>('schedule.timezone') ?? 'Asia/Kolkata';

    const job = CronJob.from({
      cronTime,
      timeZone,
      onTick: () => {
        void this.handleAutoPost();
      },
      start: true,
    });

    this.schedulerRegistry.addCronJob(AUTO_POST_CRON_NAME, job);

    const nextRun = job.nextDate()?.toISO() ?? 'unknown';
    this.logger.log(
      `Auto-post cron registered: "${cronTime}" (${timeZone}). Next run: ${nextRun}`,
    );
  }

  async handleAutoPost(): Promise<void> {
    this.logger.log('Cron job auto-instagram-post triggered');

    try {
      const result = await this.triggerManualPost();
      if (result.publishResult.success) {
        this.logger.log(
          `Auto post published successfully. Instagram ID: ${result.publishResult.postId}`,
        );
      } else {
        this.logger.error(
          `Auto post failed: ${result.publishResult.error ?? 'Unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`handleAutoPost unhandled error: ${message}`);
    }
  }

  async triggerManualPost(
    topic?: string,
    niche?: string,
  ): Promise<ManualPostPipelineResult> {
    const contentNiche =
      niche ?? this.configService.get<string>('niche') ?? 'technology';

    let resolvedTopic = topic;

    try {
      if (!resolvedTopic) {
        resolvedTopic = await this.trendingService.getTopTrend(contentNiche);
        this.logger.log(`Using trending topic: ${resolvedTopic}`);
      } else {
        this.logger.log(`Using provided topic: ${resolvedTopic}`);
      }

      const imagePrompt = await this.groqService.generateImagePrompt(
        resolvedTopic,
      );
      this.logger.log('Image prompt generated');

      const imageBuffer = await this.groqService.generateImage(imagePrompt);
      this.logger.log(`Image ready (${imageBuffer.length} bytes)`);

      const { caption, hashtags } =
        await this.groqService.generateCaption(resolvedTopic);
      this.logger.log('Caption and hashtags generated');

      const publishResult = await this.instagramService.publishPost(
        imageBuffer,
        caption,
        hashtags,
      );

      return {
        content: { topic: resolvedTopic, caption, hashtags },
        publishResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`triggerManualPost pipeline failed: ${message}`);
      throw error;
    }
  }
}
