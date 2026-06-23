import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { RawTrend, RelatedNewsItem } from '../interfaces/source.interfaces';

const RSS_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

@Injectable()
export class GoogleTrendsService {
  private readonly logger = new Logger(GoogleTrendsService.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  async fetchTrending(geo: string): Promise<RawTrend[]> {
    const urls = [
      `https://trends.google.com/trending/rss?geo=${geo}`,
      `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`,
      'https://trends.google.com/trending/rss?geo=US',
    ];

    for (const url of urls) {
      try {
        const response = await axios.get<string>(url, {
          timeout: 30000,
          headers: RSS_HEADERS,
          maxRedirects: 5,
        });

        const trends = this.parseFeed(response.data);
        if (trends.length > 0) {
          this.logger.log(
            `Google Trends: ${trends.length} items from ${url} (geo=${geo})`,
          );
          return trends;
        }
        this.logger.warn(`Google Trends RSS empty: ${url}`);
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        this.logger.warn(`Google Trends failed (${url}): HTTP ${status ?? 'error'}`);
      }
    }

    this.logger.error('Google Trends: all RSS endpoints failed');
    return [];
  }

  private parseFeed(xml: string): RawTrend[] {
    const parsed = this.parser.parse(xml) as Record<string, unknown>;
    const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
      | Record<string, unknown>
      | undefined;
    if (!channel) {
      return [];
    }

    const rawItems = channel.item;
    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems
        ? [rawItems]
        : [];

    return items
      .map((item) => this.parseItem(item as Record<string, unknown>))
      .filter((t): t is RawTrend => Boolean(t?.keyword));
  }

  private parseItem(item: Record<string, unknown>): RawTrend | null {
    const title = String(item.title ?? '').trim();
    if (!title) {
      return null;
    }

    const trafficRaw =
      item['ht:approx_traffic'] ??
      item['ht:approxTraffic'] ??
      item.approx_traffic ??
      '';

    return {
      keyword: title,
      approxTraffic: this.parseTraffic(String(trafficRaw)),
      relatedNews: this.parseRelatedNews(item),
      rawXml: item,
    };
  }

  private parseRelatedNews(item: Record<string, unknown>): RelatedNewsItem[] {
    const newsItems = item['ht:news_item'];
    const list = Array.isArray(newsItems)
      ? newsItems
      : newsItems
        ? [newsItems]
        : [];

    return list
      .map((entry) => {
        const row = entry as Record<string, unknown>;
        const title = String(row['ht:news_item_title'] ?? row.title ?? '').trim();
        if (!title) {
          return null;
        }
        return {
          title,
          url: String(row['ht:news_item_url'] ?? row.link ?? ''),
          source: String(row['ht:news_item_source'] ?? row.source ?? ''),
        };
      })
      .filter((n): n is RelatedNewsItem => n !== null);
  }

  private parseTraffic(raw: string): number {
    if (!raw) {
      return 0;
    }
    const cleaned = raw.replace(/,/g, '').replace(/\+/g, '').replace(/searches/gi, '').trim();
    const num = parseInt(cleaned, 10);
    return Number.isFinite(num) ? num : 0;
  }
}
