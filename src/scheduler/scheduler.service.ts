import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AnalyticsService } from '../analytics/analytics.service';
import { PostPipelineService } from '../posts/post-pipeline.service';
import { DynamicConfigService } from '../settings/settings.service';
import { TrendFetchService } from '../sources/trend-fetch.service';

const CRON_TREND_FETCH = 'trend-fetch';
const CRON_POST_GENERATION = 'post-generation';
const CRON_ANALYTICS_FETCH = 'analytics-fetch';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly dynamicConfig: DynamicConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly trendFetchService: TrendFetchService,
    private readonly postPipelineService: PostPipelineService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerAllJobs();
  }

  async rescheduleJobs(): Promise<void> {
    for (const name of [
      CRON_TREND_FETCH,
      CRON_POST_GENERATION,
      CRON_ANALYTICS_FETCH,
    ]) {
      if (this.schedulerRegistry.doesExist('cron', name)) {
        this.schedulerRegistry.deleteCronJob(name);
      }
    }
    this.dynamicConfig.invalidateCache();
    await this.registerAllJobs();
    this.logger.log('Cron jobs rescheduled from updated settings');
  }

  getNextRunTimes(): {
    trendFetch: string | null;
    postGeneration: string | null;
    analyticsFetch: string | null;
  } {
    const getNext = (name: string): string | null => {
      if (!this.schedulerRegistry.doesExist('cron', name)) return null;
      const job = this.schedulerRegistry.getCronJob(name);
      return job.nextDate()?.toISO() ?? null;
    };
    return {
      trendFetch: getNext(CRON_TREND_FETCH),
      postGeneration: getNext(CRON_POST_GENERATION),
      analyticsFetch: getNext(CRON_ANALYTICS_FETCH),
    };
  }

  private async registerAllJobs(): Promise<void> {
    const timezone = await this.dynamicConfig.get('timezone', 'TIMEZONE', 'Asia/Kolkata');
    const trendCron = await this.dynamicConfig.get(
      'cron_trend_fetch',
      'CRON_TREND_FETCH',
      '0 */3 * * *',
    );
    const postCron = await this.dynamicConfig.get(
      'cron_post_generation',
      'CRON_POST_GENERATION',
      '0 9,18 * * *',
    );
    const analyticsCron = await this.dynamicConfig.get(
      'cron_analytics_fetch',
      'CRON_ANALYTICS_FETCH',
      '0 */6 * * *',
    );

    this.registerCron(CRON_TREND_FETCH, trendCron, timezone, () =>
      this.handleTrendFetch(),
    );
    this.registerCron(CRON_POST_GENERATION, postCron, timezone, () =>
      this.handlePostGeneration(),
    );
    this.registerCron(CRON_ANALYTICS_FETCH, analyticsCron, timezone, () =>
      this.handleAnalyticsFetch(),
    );
  }

  private registerCron(
    name: string,
    cronTime: string,
    timeZone: string,
    onTick: () => Promise<void>,
  ): void {
    const job = CronJob.from({
      cronTime,
      timeZone,
      onTick: () => {
        void onTick();
      },
      start: true,
    });
    this.schedulerRegistry.addCronJob(name, job);
    const nextRun = job.nextDate()?.toISO() ?? 'unknown';
    this.logger.log(
      `Cron "${name}" registered: "${cronTime}" (${timeZone}). Next: ${nextRun}`,
    );
  }

  async handleTrendFetch(): Promise<void> {
    this.logger.log('Cron: trend fetch triggered');
    try {
      const result = await this.trendFetchService.fetchAndStoreAll();
      this.logger.log(
        `Trend fetch done: stored=${result.stored}, skipped=${result.skipped}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Trend fetch cron failed: ${message}`);
    }
  }

  async handlePostGeneration(): Promise<void> {
    this.logger.log('Cron: post generation triggered');
    try {
      const niche = await this.dynamicConfig.get('niche', 'CONTENT_NICHE', 'general');
      this.logger.log(`Post generation using niche=${niche}`);
      const result = await this.postPipelineService.runForTopTrend();
      this.logger.log(`Post generation done: ${JSON.stringify(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Post generation cron failed: ${message}`);
    }
  }

  async handleAnalyticsFetch(): Promise<void> {
    this.logger.log('Cron: analytics fetch triggered');
    try {
      const result = await this.analyticsService.fetchAndStoreAll();
      this.logger.log(`Analytics fetch done: tracked=${result.tracked}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Analytics cron failed: ${message}`);
    }
  }
}
