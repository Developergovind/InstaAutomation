import { Injectable, Logger } from '@nestjs/common';
import { NICHE_LABELS, NICHE_TOPIC_MAP } from '../niches/niche-topics';
import { TrendScoringService } from '../scoring/trend-scoring.service';
import { DynamicConfigService } from '../settings/settings.service';
import { TrendsService } from '../trends/trends.service';
import { RawTrend } from './interfaces/source.interfaces';
import { GoogleNewsService } from './google-news/google-news.service';
import { GoogleTrendsService } from './google-trends/google-trends.service';

interface TrendCandidate {
  raw: RawTrend;
  niche: string;
  source: string;
}

@Injectable()
export class TrendFetchService {
  private readonly logger = new Logger(TrendFetchService.name);

  constructor(
    private readonly dynamicConfig: DynamicConfigService,
    private readonly googleTrendsService: GoogleTrendsService,
    private readonly googleNewsService: GoogleNewsService,
    private readonly trendScoringService: TrendScoringService,
    private readonly trendsService: TrendsService,
  ) {}

  async fetchAndStoreAll(): Promise<{ stored: number; skipped: number }> {
    const geo = await this.dynamicConfig.get('trends_geo', 'TRENDS_GEO', 'IN');
    const lang = await this.dynamicConfig.get('news_lang', 'NEWS_LANG', 'en-IN');
    const country = await this.dynamicConfig.get(
      'news_country',
      'NEWS_COUNTRY',
      'IN',
    );
    const selectedNiche = await this.dynamicConfig.get(
      'niche',
      'CONTENT_NICHE',
      'general',
    );

    this.logger.log(
      `Starting trend fetch (geo=${geo}, lang=${lang}, niche=${selectedNiche})`,
    );

    const generalCandidates: TrendCandidate[] = [];
    const nicheCandidates: TrendCandidate[] = [];

    const generalTrends = await this.googleTrendsService.fetchTrending(geo);
    for (const raw of generalTrends) {
      generalCandidates.push({ raw, niche: 'general', source: 'google_trends' });
    }

    if (selectedNiche !== 'general') {
      const topicCode = NICHE_TOPIC_MAP[selectedNiche];
      const searchLabel = NICHE_LABELS[selectedNiche] ?? selectedNiche;
      let nicheTrends: RawTrend[] = [];
      if (topicCode) {
        nicheTrends = await this.googleNewsService.fetchByTopicSection(
          topicCode,
          lang,
          country,
        );
      } else {
        nicheTrends = await this.googleNewsService.fetchBySearchQuery(
          searchLabel,
          lang,
          country,
        );
      }
      for (const raw of nicheTrends) {
        nicheCandidates.push({
          raw,
          niche: selectedNiche,
          source: 'google_news_niche',
        });
      }
    }

    const candidates =
      selectedNiche !== 'general'
        ? [
            ...nicheCandidates.slice(0, 12),
            ...generalCandidates.slice(0, 8),
          ]
        : generalCandidates.slice(0, 20);

    if (candidates.length === 0) {
      this.logger.warn('No trends fetched — RSS sources returned empty');
      return { stored: 0, skipped: 0 };
    }

    let stored = 0;
    let skipped = 0;
    const limit = Math.min(candidates.length, 20);

    for (let i = 0; i < limit; i++) {
      const { raw, niche, source } = candidates[i];

      const exists = await this.trendsService.existsRecently(raw.keyword, 12);
      if (exists) {
        this.logger.debug(`Skipping duplicate: "${raw.keyword}"`);
        skipped++;
        continue;
      }

      let news = {
        articleCount: raw.relatedNews.length,
        recencyScore: 0,
        topArticles: raw.relatedNews.map((n) => ({
          title: n.title,
          source: n.source,
          pubDate: '',
        })),
      };

      if (source === 'google_trends') {
        news = await this.googleNewsService.fetchContext(
          raw.keyword,
          lang,
          country,
        );
        if (i < limit - 1) await this.delay(300);
      }

      const finalScore = this.trendScoringService.calculateScore({
        approxTraffic: raw.approxTraffic,
        articleCount: news.articleCount,
        recencyScore: news.recencyScore,
      });

      const mergedNews = [
        ...raw.relatedNews.map((n) => ({
          title: n.title,
          source: n.source,
          url: n.url,
        })),
        ...news.topArticles.map((a) => ({
          title: a.title,
          source: a.source,
        })),
      ].slice(0, 10);

      await this.trendsService.createTrend({
        keyword: raw.keyword,
        source,
        niche,
        approxTraffic: raw.approxTraffic,
        articleCount: news.articleCount,
        recencyScore: news.recencyScore,
        finalScore,
        relatedNews: mergedNews,
      });

      stored++;
      this.logger.log(
        `Stored "${raw.keyword}" niche=${niche} score=${finalScore}`,
      );
    }

    this.logger.log(`Trend fetch complete: stored=${stored}, skipped=${skipped}`);
    return { stored, skipped };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
