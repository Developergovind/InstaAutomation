export interface RelatedNewsItem {
  title: string;
  url: string;
  source: string;
}

export interface RawTrend {
  keyword: string;
  approxTraffic: number;
  relatedNews: RelatedNewsItem[];
  rawXml?: Record<string, unknown>;
}

export interface NewsContext {
  articleCount: number;
  recencyScore: number;
  topArticles: { title: string; source: string; pubDate: string }[];
}

export interface ScoredTrendInput {
  keyword: string;
  approxTraffic: number;
  articleCount: number;
  recencyScore: number;
  relatedNews: RelatedNewsItem[];
}
