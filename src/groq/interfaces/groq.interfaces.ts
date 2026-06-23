export interface GroqContentResult {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
}

export interface TrendContentInput {
  keyword: string;
  niche?: string;
  relatedNews: { title: string }[];
}
