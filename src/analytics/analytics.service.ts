import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosError } from 'axios';
import { Repository } from 'typeorm';
import { MetaTokenService } from '../instagram/meta-token.service';
import { DynamicConfigService } from '../settings/settings.service';
import { Post } from '../posts/entities/post.entity';
import { Analytics } from './entities/analytics.entity';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface MetaMediaListResponse {
  data?: MetaMediaItem[];
}

interface MetaInsightsResponse {
  data?: Array<{ name: string; values: Array<{ value: number }> }>;
}

interface MetaApiErrorBody {
  error?: { message?: string; code?: number };
}

@Injectable()
export class AnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsService.name);
  private syncInProgress = false;

  constructor(
    @InjectRepository(Analytics)
    private readonly analyticsRepo: Repository<Analytics>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly dynamicConfig: DynamicConfigService,
    private readonly metaTokenService: MetaTokenService,
  ) {}

  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      void this.fetchIfEmpty();
    }, 5000);
  }

  async ensureMinimumAnalytics(): Promise<void> {
    const count = await this.analyticsRepo.count();
    if (count === 0) {
      await this.syncFromLocalPosts();
    }
  }

  async fetchIfEmpty(): Promise<void> {
    const count = await this.analyticsRepo.count();
    const published = await this.postRepo.count({ where: { status: 'published' } });
    if (count === 0 && published > 0) {
      this.logger.log('No analytics in DB — running initial sync…');
      await this.fetchAndStoreAll();
    }
  }

  async fetchAndStoreAll(): Promise<{ tracked: number }> {
    if (this.syncInProgress) {
      return { tracked: 0 };
    }
    this.syncInProgress = true;

    try {
      const businessAccountId = await this.dynamicConfig.get(
        'instagram_business_account_id',
        'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      );
      const accessToken = this.metaTokenService.getAccessToken();

      if (!businessAccountId || !accessToken) {
        this.logger.warn('Instagram credentials missing — syncing from local posts only');
        return { tracked: await this.syncFromLocalPosts() };
      }

      let tracked = 0;
      let permissionBlocked = false;

      try {
        const mediaRes = await axios.get<MetaMediaListResponse>(
          `${META_GRAPH_BASE}/${businessAccountId}/media`,
          {
            params: {
              fields:
                'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
              limit: 25,
              access_token: accessToken,
            },
            timeout: 60000,
          },
        );

        for (const media of mediaRes.data?.data ?? []) {
          try {
            if (permissionBlocked) {
              await this.processMediaItemWithoutInsights(media);
              tracked++;
            } else if (await this.processMediaItem(media, accessToken)) {
              tracked++;
              if (this.permissionWarned) permissionBlocked = true;
            }
          } catch (error) {
            this.logger.warn(
              `Failed to track media ${media.id}: ${this.formatError(error)}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Failed to fetch media list: ${this.formatError(error)}`);
      }

      try {
        const storiesRes = await axios.get<{ data?: MetaMediaItem[] }>(
          `${META_GRAPH_BASE}/${businessAccountId}/stories`,
          {
            params: {
              fields: 'id,media_type,timestamp',
              access_token: accessToken,
            },
            timeout: 30000,
          },
        );

        for (const story of storiesRes.data?.data ?? []) {
          try {
            if (await this.processStoryItem(story, accessToken)) tracked++;
          } catch (error) {
            this.logger.warn(
              `Failed to track story ${story.id}: ${this.formatError(error)}`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(`Stories fetch skipped: ${this.formatError(error)}`);
      }

      if (tracked === 0) {
        tracked = await this.syncFromLocalPosts();
      }

      this.logger.log(`Analytics fetch complete: tracked=${tracked}`);
      return { tracked };
    } finally {
      this.syncInProgress = false;
    }
  }

  async findAll(mediaType?: string, limit = 50): Promise<Analytics[]> {
    await this.ensureMinimumAnalytics();
    void this.fetchAndStoreAll();
    const where = mediaType && mediaType !== 'all' ? { mediaType } : {};
    return this.analyticsRepo.find({
      where,
      order: { engagementRate: 'DESC', fetchedAt: 'DESC' },
      take: limit,
    });
  }

  async findByMediaId(mediaId: string): Promise<Analytics | null> {
    return this.analyticsRepo.findOne({ where: { mediaId } });
  }

  /** Sync a single published post after pipeline completes. */
  async syncPostByInstagramId(instagramPostId: string): Promise<void> {
    const accessToken = this.metaTokenService.getAccessToken();
    if (!accessToken) return;

    try {
      const response = await axios.get<MetaMediaItem>(
        `${META_GRAPH_BASE}/${instagramPostId}`,
        {
          params: {
            fields:
              'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
            access_token: accessToken,
          },
          timeout: 30000,
        },
      );
      await this.processMediaItem(response.data, accessToken);
    } catch (error) {
      this.logger.warn(
        `Post-publish analytics sync failed for ${instagramPostId}: ${this.formatError(error)}`,
      );
      if (this.permissionWarned) {
        try {
          const response = await axios.get<MetaMediaItem>(
            `${META_GRAPH_BASE}/${instagramPostId}`,
            {
              params: {
                fields:
                  'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
                access_token: accessToken,
              },
              timeout: 30000,
            },
          );
          await this.processMediaItemWithoutInsights(response.data);
          return;
        } catch {
          // fall through
        }
      }
      await this.syncFromLocalPosts();
    }
  }

  private async syncFromLocalPosts(): Promise<number> {
    const published = await this.postRepo.find({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
    });

    let tracked = 0;
    for (const post of published) {
      if (!post.instagramPostId) continue;
      const existing = await this.analyticsRepo.findOne({
        where: { mediaId: post.instagramPostId },
      });
      if (existing && existing.reach > 0) continue;

      await this.upsertAnalytics({
        mediaId: post.instagramPostId,
        postId: post.id,
        mediaType: 'post',
        permalink: null,
        caption: post.caption,
        likes: existing?.likes ?? 0,
        comments: existing?.comments ?? 0,
        shares: existing?.shares ?? 0,
        saved: existing?.saved ?? 0,
        reach: existing?.reach ?? 0,
        impressions: existing?.impressions ?? 0,
        engagementRate: existing?.engagementRate ?? 0,
        postedAt: post.publishedAt,
      });
      tracked++;
    }
    return tracked;
  }

  private async processMediaItem(
    media: MetaMediaItem,
    accessToken: string,
  ): Promise<boolean> {
    if (this.permissionWarned) {
      await this.processMediaItemWithoutInsights(media);
      return true;
    }

    let mediaType = 'post';
    if (media.media_product_type === 'REELS') mediaType = 'reel';
    else if (media.media_type === 'CAROUSEL_ALBUM') mediaType = 'carousel';

    const metrics =
      mediaType === 'reel'
        ? [
            'reach',
            'likes',
            'comments',
            'shares',
            'saved',
            'plays',
            'total_interactions',
          ]
        : [
            'reach',
            'likes',
            'comments',
            'shares',
            'saved',
            'impressions',
            'total_interactions',
          ];

    const insights = await this.fetchInsights(media.id, metrics, accessToken);

    const likes =
      insights.likes ?? insights.plays ?? media.like_count ?? 0;
    const comments = insights.comments ?? media.comments_count ?? 0;
    const shares = insights.shares ?? 0;
    const saved = insights.saved ?? 0;
    const reach = insights.reach ?? 0;
    const impressions = insights.impressions ?? reach;
    const interactions =
      insights.total_interactions ?? likes + comments + shares + saved;
    const engagementRate =
      reach > 0 ? (interactions / reach) * 100 : interactions > 0 ? 100 : 0;

    const post = await this.postRepo.findOne({
      where: { instagramPostId: media.id },
    });

    await this.upsertAnalytics({
      mediaId: media.id,
      postId: post?.id ?? null,
      mediaType,
      permalink: media.permalink ?? null,
      caption: media.caption ?? post?.caption ?? null,
      likes,
      comments,
      shares,
      saved,
      reach,
      impressions,
      engagementRate: Math.round(engagementRate * 100) / 100,
      postedAt: media.timestamp ? new Date(media.timestamp) : post?.publishedAt ?? null,
    });

    return true;
  }

  private async processMediaItemWithoutInsights(
    media: MetaMediaItem,
  ): Promise<void> {
    let mediaType = 'post';
    if (media.media_product_type === 'REELS') mediaType = 'reel';
    else if (media.media_type === 'CAROUSEL_ALBUM') mediaType = 'carousel';

    const post = await this.postRepo.findOne({
      where: { instagramPostId: media.id },
    });

    const likes = media.like_count ?? 0;
    const comments = media.comments_count ?? 0;
    const interactions = likes + comments;
    const engagementRate = interactions > 0 ? 100 : 0;

    await this.upsertAnalytics({
      mediaId: media.id,
      postId: post?.id ?? null,
      mediaType,
      permalink: media.permalink ?? null,
      caption: media.caption ?? post?.caption ?? null,
      likes,
      comments,
      shares: 0,
      saved: 0,
      reach: 0,
      impressions: 0,
      engagementRate,
      postedAt: media.timestamp ? new Date(media.timestamp) : post?.publishedAt ?? null,
    });
  }

  private async processStoryItem(
    story: MetaMediaItem,
    accessToken: string,
  ): Promise<boolean> {
    const insights = await this.fetchInsights(
      story.id,
      ['reach', 'replies', 'exits', 'taps_forward', 'taps_back'],
      accessToken,
    );

    const reach = insights.reach ?? 0;
    const comments = insights.replies ?? 0;
    const engagementRate = reach > 0 ? (comments / reach) * 100 : 0;

    await this.upsertAnalytics({
      mediaId: story.id,
      postId: null,
      mediaType: 'story',
      permalink: null,
      caption: null,
      likes: 0,
      comments,
      shares: 0,
      saved: 0,
      reach,
      impressions: reach,
      engagementRate: Math.round(engagementRate * 100) / 100,
      postedAt: story.timestamp ? new Date(story.timestamp) : null,
    });

    return true;
  }

  private permissionWarned = false;

  private async fetchInsights(
    mediaId: string,
    metrics: string[],
    accessToken: string,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    try {
      const response = await axios.get<MetaInsightsResponse>(
        `${META_GRAPH_BASE}/${mediaId}/insights`,
        {
          params: {
            metric: metrics.join(','),
            period: 'lifetime',
            access_token: accessToken,
          },
          timeout: 30000,
        },
      );
      for (const row of response.data?.data ?? []) {
        result[row.name] = row.values?.[0]?.value ?? 0;
      }
      if (Object.keys(result).length > 0) return result;
    } catch (error) {
      if (this.isPermissionError(error)) {
        if (!this.permissionWarned) {
          this.permissionWarned = true;
          this.logger.warn(
            'Meta insights permission missing. Add instagram_manage_insights in Meta Developer Console for reach/likes data.',
          );
        }
        return result;
      }
      this.logger.debug(
        `Batch insights failed for ${mediaId}: ${this.formatError(error)}`,
      );
    }

    for (const metric of metrics.slice(0, 3)) {
      try {
        const response = await axios.get<MetaInsightsResponse>(
          `${META_GRAPH_BASE}/${mediaId}/insights`,
          {
            params: {
              metric,
              period: 'lifetime',
              access_token: accessToken,
            },
            timeout: 10000,
          },
        );
        const row = response.data?.data?.[0];
        if (row) result[row.name] = row.values?.[0]?.value ?? 0;
      } catch (error) {
        if (this.isPermissionError(error)) return result;
      }
    }

    return result;
  }

  private isPermissionError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as MetaApiErrorBody | undefined;
      return body?.error?.code === 10 || body?.error?.code === 200;
    }
    return false;
  }

  private async upsertAnalytics(
    data: Partial<Analytics> & { mediaId: string },
  ): Promise<void> {
    const existing = await this.analyticsRepo.findOne({
      where: { mediaId: data.mediaId },
    });
    if (existing) {
      await this.analyticsRepo.update(existing.id, data);
    } else {
      await this.analyticsRepo.save(this.analyticsRepo.create(data));
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const body = error.response?.data as MetaApiErrorBody | undefined;
      if (body?.error?.message) {
        return `${body.error.message} (code=${body.error.code ?? '?'})`;
      }
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
