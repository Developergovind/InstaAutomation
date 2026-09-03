import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { DynamicConfigService } from '../settings/settings.service';
import {
  GroqContentResult,
  TrendContentInput,
  LayoutType,
} from './interfaces/groq.interfaces';

export { GroqContentResult, LayoutType };

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly dynamicConfig: DynamicConfigService) {}

  async generateContent(trend: TrendContentInput): Promise<GroqContentResult> {
    const apiKey = await this.dynamicConfig.get('groq_api_key', 'GROQ_API_KEY');
    const model = await this.dynamicConfig.get(
      'groq_model',
      'GROQ_MODEL',
      'openai/gpt-oss-120b',
    );

    if (!apiKey) {
      throw new Error('Groq API key is not configured — set it in Settings');
    }

    const groq = new Groq({ apiKey });
    const newsContext = (trend.relatedNews ?? [])
      .slice(0, 3)
      .map((n) => n.title)
      .join(' | ');

    const niche = trend.niche || 'general';

    // Generate high-impact viral card copy, headline lines, AI image prompt & detailed caption
    const content = await this.generateViralCardContent(
      trend.keyword,
      newsContext,
      niche,
      groq,
      model,
    );

    const caption =
      content.caption ||
      `Breaking update on ${trend.keyword}.\n\nFollow for the latest daily insights and news breakdowns!`;

    let hashtagsVal = content.hashtags || [];
    if (typeof hashtagsVal === 'string') {
      hashtagsVal = hashtagsVal
        .split(',')
        .map((h: string) => h.trim().replace(/^#/, ''))
        .filter(Boolean);
    }
    const hashtags = Array.isArray(hashtagsVal)
      ? hashtagsVal
          .map((h: any) => String(h).trim().replace(/^#/, ''))
          .filter(Boolean)
      : ['trending', 'news', 'update', 'insights'];

    return {
      ...content,
      isCarousel: false,
      layout: 'VIRAL_NEWS_CARD',
      caption,
      hashtags,
    };
  }

  private extractJson(text: string): any | null {
    if (!text) return null;
    let clean = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      clean = clean.substring(start, end + 1);
    }

    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }

  private async generateViralCardContent(
    keyword: string,
    newsContext: string,
    niche: string,
    groq: Groq,
    model: string,
  ): Promise<any> {
    const colorMap: Record<string, string> = {
      crypto: '#00FF66',
      finance: '#00FF66',
      business: '#FFD700',
      technology: '#00E5FF',
      entertainment: '#FF007A',
      gaming: '#00E5FF',
      sports: '#FF6B00',
      health: '#00FF66',
      science: '#00E5FF',
      fashion: '#FF007A',
      general: '#00FF66',
    };

    const targetColor = colorMap[niche.toLowerCase()] || '#00FF66';

    const systemPrompt = `You are an elite visual journalist and creator for viral Instagram media pages (like @cryptodaily, @marketpulse, @financenews).
Your job is to generate:
1. An ultra-punchy 2-to-3 line high-contrast headline for a standalone viral news card.
2. A hyper-detailed AI image prompt for Flux/ClusterProtocol that creates a stunning 3D mascot, cinematic character, or dramatic studio scene.
3. A complete, captivating Instagram caption that delivers all the detailed breakdown, bullet points, statistics, and call-to-action in the caption text itself.`;

    const userPrompt = `Topic: "${keyword}"
Niche: "${niche}"
News Context: "${newsContext}"

Generate a JSON object with this EXACT structure:
{
  "headlineLine1": "FIRST LINE (1-4 words in ALL CAPS, e.g. 'TOP 10 CRYPTOS' or 'BITCOIN HAS JUST' or 'HERE ARE THE BIGGEST')",
  "headlineLine2": "SECOND LINE (1-4 words in ALL CAPS, e.g. 'DOMINATE AUGUST' or 'RECLAIMED THE' or 'FINANCE STORIES FROM')",
  "headlineLine3": "THIRD LINE (1-3 words in ALL CAPS, e.g. '$1.2T MARKET' or '$69,000' or 'THE LAST 24 HOURS' or '')",
  "highlightColor": "${targetColor}",
  "highlightLines": [1, 3],
  "imagePrompt": "Hyper-detailed AI image prompt describing a stunning 3D mascot character, dramatic cinematic portrait, or high-tech scene matching the topic (e.g. '3D glossy Bitcoin character pointing at a rising candlestick chart on a dark trading desk, studio lighting, 8k, photorealistic 3D render'). Absolutely NO text or words in the image.",
  "caption": "Punchy hook (e.g. 'Oh boy, it\\'s gonna be interesting. 👀' or 'We are BACK 🙌') followed by 3 concise informative paragraphs breaking down the news facts, bullet points, numbers, and a clear CTA like 'Follow for daily market updates! Which asset are you most bullish on? Drop a comment below 👇'",
  "hashtags": ["12 relevant hashtags without #"]
}

RULES:
- Total words in headline must be short and punchy (5-9 words total).
- highlightLines specifies which line numbers get the vibrant highlightColor (e.g. [1, 3] or [1, 2] or [2]).
- The caption must be comprehensive and provide all the news details so readers get immense value directly in the post caption.
- Output ONLY valid JSON starting with { and ending with }.`;

    // Attempt 1: Standard response_format: { type: 'json_object' }
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = this.extractJson(raw);
      if (parsed) return parsed;
    } catch (err: any) {
      this.logger.warn(`Attempt 1 failed: ${err.message}. Retrying plain-text JSON...`);
    }

    // Attempt 2: Plain-text JSON
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nOutput ONLY raw valid JSON starting with { and ending with }.`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      const parsed = this.extractJson(raw);
      if (parsed) return parsed;
    } catch (err: any) {
      this.logger.warn(`Attempt 2 failed: ${err.message}. Trying fallback model...`);
    }

    // Attempt 3: Fallback models
    const fallbackModels = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'groq/compound',
      'groq/compound-mini',
    ].filter((m) => m !== model);

    for (const fbModel of fallbackModels) {
      try {
        const completion = await groq.chat.completions.create({
          model: fbModel,
          messages: [
            {
              role: 'system',
              content: 'You are an Instagram news post creator. Output ONLY valid JSON.',
            },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        const raw = completion.choices[0]?.message?.content?.trim() || '';
        const parsed = this.extractJson(raw);
        if (parsed) return parsed;
      } catch {
        // continue
      }
    }

    // Fallback default
    return {
      headlineLine1: 'LATEST UPDATE ON',
      headlineLine2: keyword.toUpperCase().slice(0, 24),
      headlineLine3: 'DETAILS INSIDE',
      highlightColor: targetColor,
      highlightLines: [1, 2],
      imagePrompt: `Cinematic 3D render representing ${keyword}, dramatic studio lighting, 8k, dark aesthetic, clean composition`,
      caption: `Major updates regarding ${keyword}.\n\nFollow for more daily insights and market breakdowns!`,
      hashtags: [niche, 'news', 'update', 'trending'],
    };
  }
}
