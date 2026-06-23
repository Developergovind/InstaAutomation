import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { DynamicConfigService } from '../settings/settings.service';
import { TrendFetchService } from '../sources/trend-fetch.service';
import { GroqService } from '../groq/groq.service';
import { InstagramService } from '../instagram/instagram.service';
import { PollinationsService } from '../pollinations/pollinations.service';
import { TrendsService } from '../trends/trends.service';
import { Trend } from '../trends/entities/trend.entity';
import { PostsService } from './posts.service';

export interface PipelineResult {
  success: boolean;
  postId?: string;
  error?: string;
}

@Injectable()
export class PostPipelineService {
  private readonly logger = new Logger(PostPipelineService.name);

  constructor(
    private readonly trendsService: TrendsService,
    private readonly trendFetchService: TrendFetchService,
    private readonly postsService: PostsService,
    private readonly dynamicConfig: DynamicConfigService,
    private readonly groqService: GroqService,
    private readonly pollinationsService: PollinationsService,
    private readonly instagramService: InstagramService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async runForTopTrend(): Promise<PipelineResult> {
    try {
      const niche = await this.dynamicConfig.get('niche', 'CONTENT_NICHE', 'general');
      let trend = await this.trendsService.getTopUnprocessed(niche);

      if (!trend) {
        this.logger.log(
          `No unprocessed ${niche} trends — fetching with current settings…`,
        );
        await this.trendFetchService.fetchAndStoreAll();
        trend = await this.trendsService.getTopUnprocessed(niche);
      }

      if (!trend) {
        const label = niche === 'general' ? 'any' : `"${niche}"`;
        this.logger.warn(`No unprocessed trend available for niche ${label}`);
        return {
          success: false,
          error:
            niche === 'general'
              ? 'No unprocessed trend available — fetch trends first'
              : `No unprocessed trends for niche "${niche}". Save settings and fetch trends, or wait for the next trend-fetch cron.`,
        };
      }

      this.logger.log(
        `Selected trend "${trend.keyword}" (niche=${trend.niche}, score=${trend.finalScore})`,
      );
      return this.runPipeline(trend);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`runForTopTrend failed: ${message}`);
      return { success: false, error: message };
    }
  }

  async runForSpecificTrend(trendId: string): Promise<PipelineResult> {
    try {
      const trend = await this.trendsService.getById(trendId);
      if (!trend) {
        return { success: false, error: `Trend not found: ${trendId}` };
      }
      if (trend.processed) {
        return { success: false, error: 'Trend already processed' };
      }
      return this.runPipeline(trend);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`runForSpecificTrend failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private async runPipeline(trend: Trend): Promise<PipelineResult> {
    this.logger.log(
      `Pipeline started: "${trend.keyword}" (score=${trend.finalScore})`,
    );

    const post = await this.postsService.createDraft({
      trendId: trend.id,
      keyword: trend.keyword,
      caption: '',
      hashtags: [],
      imagePrompt: '',
    });

    try {
      const content = await this.groqService.generateContent({
        keyword: trend.keyword,
        niche: trend.niche,
        relatedNews: (trend.relatedNews ?? []).map((n) => ({ title: n.title })),
      });

      await this.postsService.updatePost(post.id, {
        caption: content.caption,
        hashtags: content.hashtags,
        imagePrompt: content.imagePrompt,
        status: 'generating',
      });

      const { publicUrl } = await this.pollinationsService.generateImage(
        content.imagePrompt,
      );

      const publishResult = await this.instagramService.publishPost(
        publicUrl,
        content.caption,
        content.hashtags,
      );

      if (publishResult.success && publishResult.postId) {
        await this.postsService.updatePost(post.id, {
          imageUrl: publicUrl,
          instagramPostId: publishResult.postId,
          status: 'published',
          publishedAt: new Date(),
        });
        await this.trendsService.markProcessed(trend.id);
        this.logger.log(`Pipeline complete. Instagram ID: ${publishResult.postId}`);
        setTimeout(() => {
          void this.analyticsService.syncPostByInstagramId(publishResult.postId!);
        }, 15000);
        return { success: true, postId: publishResult.postId };
      }

      await this.postsService.updatePost(post.id, {
        status: 'failed',
        errorMessage: publishResult.error ?? 'Unknown publish error',
      });
      return {
        success: false,
        error: publishResult.error ?? 'Publish failed',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.postsService.updatePost(post.id, {
        status: 'failed',
        errorMessage: message,
      });
      this.logger.error(`Pipeline failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
