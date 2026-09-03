export type LayoutType =
  | 'VIRAL_NEWS_CARD'
  | 'NUMBERED_TABLE'
  | 'CARD_SECTIONS'
  | 'STORY_CHECKLIST'
  | 'GUIDE_MATRIX';

export interface CarouselSlidePoint {
  icon?: string;
  heading: string;
  text: string;
  metric?: string;
  color?: string;
}

export interface CarouselSlide {
  slideNumber: number;
  slideType: 'CONTENT' | 'CTA';
  badge?: string;
  title: string;
  subtitle?: string;
  points?: CarouselSlidePoint[];
  ctaText?: string;
  discussionQuestion?: string;
}

export interface GroqContentResult {
  isCarousel: boolean;
  layout: LayoutType;
  headline: string;
  headlineLine1?: string;
  headlineLine2?: string;
  headlineLine3?: string;
  highlightColor?: string;
  highlightLines?: number[];
  imagePrompt?: string;
  caption: string;
  hashtags: string[];
  slides?: CarouselSlide[];
}

export interface TrendContentInput {
  keyword: string;
  niche?: string;
  relatedNews: { title: string }[];
}
