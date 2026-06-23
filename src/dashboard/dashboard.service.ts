import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import { Analytics } from '../analytics/entities/analytics.entity';
import { Post } from '../posts/entities/post.entity';
import { SchedulerService } from '../scheduler/scheduler.service';

export interface DashboardOverview {
  totalPosts: number;
  totalReach: number;
  avgEngagementRate: number;
  byType: Record<string, { count: number; avgEngagement: number }>;
  bestPerformingPost: {
    mediaId: string;
    caption: string;
    engagementRate: number;
    permalink: string | null;
  } | null;
  nextScheduledRuns: {
    trendFetch: string | null;
    postGeneration: string | null;
    analyticsFetch: string | null;
  };
  recentPosts: Post[];
  engagementTrend: { date: string; avgEngagement: number }[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Analytics)
    private readonly analyticsRepo: Repository<Analytics>,
    private readonly schedulerService: SchedulerService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const analyticsCount = await this.analyticsRepo.count();
    if (analyticsCount === 0) {
      await this.analyticsService.ensureMinimumAnalytics();
    }
    void this.analyticsService.fetchAndStoreAll();
    const overview: DashboardOverview = {
      totalPosts: 0,
      totalReach: 0,
      avgEngagementRate: 0,
      byType: {},
      bestPerformingPost: null,
      nextScheduledRuns: {
        trendFetch: null,
        postGeneration: null,
        analyticsFetch: null,
      },
      recentPosts: [],
      engagementTrend: [],
    };

    try {
      overview.totalPosts = await this.postRepo.count({
        where: { status: 'published' },
      });
    } catch (e) {
      this.logger.warn(`totalPosts failed: ${e}`);
    }

    try {
      const allAnalytics = await this.analyticsRepo.find();
      overview.totalReach = allAnalytics.reduce((s, a) => s + a.reach, 0);
      overview.avgEngagementRate =
        allAnalytics.length > 0
          ? Math.round(
              (allAnalytics.reduce((s, a) => s + a.engagementRate, 0) /
                allAnalytics.length) *
                100,
            ) / 100
          : 0;

      for (const type of ['post', 'reel', 'story', 'carousel']) {
        const items = allAnalytics.filter((a) => a.mediaType === type);
        overview.byType[type] = {
          count: items.length,
          avgEngagement:
            items.length > 0
              ? Math.round(
                  (items.reduce((s, a) => s + a.engagementRate, 0) /
                    items.length) *
                    100,
                ) / 100
              : 0,
        };
      }

      const best = [...allAnalytics].sort(
        (a, b) => b.engagementRate - a.engagementRate,
      )[0];
      if (best) {
        overview.bestPerformingPost = {
          mediaId: best.mediaId,
          caption: (best.caption ?? '').slice(0, 120),
          engagementRate: best.engagementRate,
          permalink: best.permalink,
        };
      }

      overview.engagementTrend = this.buildEngagementTrend(allAnalytics);
    } catch (e) {
      this.logger.warn(`analytics aggregation failed: ${e}`);
    }

    try {
      overview.nextScheduledRuns = this.schedulerService.getNextRunTimes();
    } catch (e) {
      this.logger.warn(`nextScheduledRuns failed: ${e}`);
    }

    try {
      overview.recentPosts = await this.postRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      });
    } catch (e) {
      this.logger.warn(`recentPosts failed: ${e}`);
    }

    return overview;
  }

  private buildEngagementTrend(
    items: Analytics[],
  ): { date: string; avgEngagement: number }[] {
    const byDay = new Map<string, number[]>();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const item of items) {
      const date = (item.postedAt ?? item.fetchedAt).toISOString().slice(0, 10);
      const ts = new Date(date).getTime();
      if (ts < cutoff) continue;
      const arr = byDay.get(date) ?? [];
      const metric =
        item.engagementRate > 0
          ? item.engagementRate
          : item.likes + item.comments;
      arr.push(metric);
      byDay.set(date, arr);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => ({
        date,
        avgEngagement:
          Math.round(
            (rates.reduce((s, r) => s + r, 0) / rates.length) * 100,
          ) / 100,
      }));
  }
}
