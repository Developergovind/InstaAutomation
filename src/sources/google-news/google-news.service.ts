import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { NewsContext, RawTrend } from '../interfaces/source.interfaces';

const RSS_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

@Injectable()
export class GoogleNewsService {
  private readonly logger = new Logger(GoogleNewsService.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  async fetchByTopicSection(
    topicCode: string,
    lang: string,
    country: string,
  ): Promise<RawTrend[]> {
    const langCode = lang.split('-')[0] ?? 'en';
    const url = `https://news.google.com/rss/headlines/section/topic/${topicCode}?hl=${lang}&gl=${country}&ceid=${country}:${langCode}`;
    return this.fetchRssAsTrends(url, 10);
  }

  async fetchBySearchQuery(
    query: string,
    lang: string,
    country: string,
  ): Promise<RawTrend[]> {
    const langCode = lang.split('-')[0] ?? 'en';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' trending')}&hl=${lang}&gl=${country}&ceid=${country}:${langCode}`;
    return this.fetchRssAsTrends(url, 10);
  }

  private async fetchRssAsTrends(url: string, limit: number): Promise<RawTrend[]> {
    try {
      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: RSS_HEADERS,
      });
      const items = this.parseRssItems(response.data).slice(0, limit);
      return items.map((item) => ({
        keyword: item.title,
        approxTraffic: 50000,
        relatedNews: [
          {
            title: item.title,
            source: item.source,
            url: item.link,
          },
        ],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google News RSS failed: ${message}`);
      return [];
    }
  }

  private parseRssItems(xml: string): Array<{
    title: string;
    source: string;
    link: string;
    pubDate: string;
  }> {
    const parsed = this.parser.parse(xml) as Record<string, unknown>;
    const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
      | Record<string, unknown>
      | undefined;
    if (!channel) return [];

    const rawItems = channel.item;
    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    return items.map((entry) => {
      const row = entry as Record<string, unknown>;
      const sourceTag = row.source as Record<string, unknown> | string | undefined;
      const sourceName =
        typeof sourceTag === 'object' && sourceTag !== null
          ? String(sourceTag['#text'] ?? sourceTag['@_url'] ?? '')
          : String(sourceTag ?? '');
      return {
        title: String(row.title ?? '').trim(),
        source: sourceName,
        link: String(row.link ?? ''),
        pubDate: String(row.pubDate ?? ''),
      };
    });
  }

  async fetchContext(
    keyword: string,
    lang: string,
    country: string,
  ): Promise<NewsContext> {
    const langCode = lang.split('-')[0] ?? 'en';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${lang}&gl=${country}&ceid=${country}:${langCode}`;

    try {
      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: RSS_HEADERS,
      });

      const parsed = this.parser.parse(response.data) as Record<string, unknown>;
      const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
        | Record<string, unknown>
        | undefined;

      if (!channel) {
        return this.emptyContext();
      }

      const rawItems = channel.item;
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems
          ? [rawItems]
          : [];

      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      const articles = items.map((entry) => {
        const row = entry as Record<string, unknown>;
        const sourceTag = row.source as Record<string, unknown> | string | undefined;
        const sourceName =
          typeof sourceTag === 'object' && sourceTag !== null
            ? String(sourceTag['#text'] ?? sourceTag['@_url'] ?? '')
            : String(sourceTag ?? '');

        return {
          title: String(row.title ?? '').trim(),
          source: sourceName,
          pubDate: String(row.pubDate ?? ''),
        };
      });

      const recencyScore = articles.filter((a) => {
        const ts = Date.parse(a.pubDate);
        return Number.isFinite(ts) && now - ts <= oneDayMs;
      }).length;

      return {
        articleCount: items.length,
        recencyScore,
        topArticles: articles.slice(0, 5),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google News context failed for "${keyword}": ${message}`);
      return this.emptyContext();
    }
  }

  private emptyContext(): NewsContext {
    return { articleCount: 0, recencyScore: 0, topArticles: [] };
  }
}
