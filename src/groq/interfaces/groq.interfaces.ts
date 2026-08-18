export type LayoutType = 'NUMBERED_TABLE' | 'CARD_SECTIONS' | 'STORY_CHECKLIST' | 'GUIDE_MATRIX';

export interface GroqContentResult {
  layout: LayoutType;
  headline: string;
  caption: string;
  hashtags: string[];
  // Layout-specific fields (present based on layout type):
  subheadline?: string;
  tableHeaders?: string[];
  rows?: any[];
  sections?: any[];
  steps?: any[];
  matrixRows?: any[];
  rules?: any[];
  lessonTitle?: string;
  lessonPoints?: string[];
  ctaText?: string;
  footerNote?: string;
  totalLine?: string;
  sourceNote?: string;
  keyTakeaway?: string;
}

export interface TrendContentInput {
  keyword: string;
  niche?: string;
  relatedNews: { title: string }[];
}
