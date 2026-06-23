import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { NICHE_LABELS } from '../niches/niche-topics';
import { DynamicConfigService } from '../settings/settings.service';
import {
  GroqContentResult,
  TrendContentInput,
} from './interfaces/groq.interfaces';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly dynamicConfig: DynamicConfigService) {}

  async generateContent(
    trend: TrendContentInput,
  ): Promise<GroqContentResult> {
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
    const newsTitles = trend.relatedNews
      .slice(0, 3)
      .map((n) => n.title)
      .join('; ');

    const configuredNiche = await this.dynamicConfig.get(
      'niche',
      'CONTENT_NICHE',
      'general',
    );
    const nicheKey = trend.niche ?? configuredNiche;
    const nicheLabel =
      nicheKey === 'general'
        ? 'General / broad audience'
        : (NICHE_LABELS[nicheKey] ?? nicheKey);

    const userMessage = `Real trending topic: '${trend.keyword}'. Content niche: ${nicheLabel}. Related news context: ${newsTitles || 'N/A'}. Generate Instagram content tailored to the ${nicheLabel} niche. Return ONLY valid JSON, no markdown: {"caption": "engaging caption with emojis, max 150 words", "hashtags": ["15 relevant hashtags without #"], "imagePrompt": "detailed vivid image generation prompt for an eye-catching square Instagram post about this topic in the ${nicheLabel} style, max 200 words, mention no real people's names, photorealistic or illustrative style"}`;

    try {
      return await this.requestContent(groq, model, userMessage, false);
    } catch {
      this.logger.warn('Groq JSON parse failed — retrying with stricter prompt');
      return this.requestContent(
        groq,
        model,
        `${userMessage}\n\nIMPORTANT: Return ONLY raw JSON. No markdown fences. No explanation.`,
        true,
      );
    }
  }

  private async requestContent(
    groq: Groq,
    model: string,
    userMessage: string,
    isRetry: boolean,
  ): Promise<GroqContentResult> {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a social media content writer. You only work with real trends provided to you — you never invent topics.',
        },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = this.parseContentJson(text);

    if (!parsed) {
      const message = 'Failed to parse Groq content JSON';
      if (isRetry) throw new Error(message);
      throw new Error(message);
    }

    this.logger.log('Content generated for trend via Groq');
    return parsed;
  }

  private parseContentJson(text: string): GroqContentResult | null {
    try {
      const cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed: unknown = JSON.parse(cleaned);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'caption' in parsed &&
        'hashtags' in parsed &&
        'imagePrompt' in parsed
      ) {
        const row = parsed as GroqContentResult;
        return {
          caption: String(row.caption),
          hashtags: Array.isArray(row.hashtags)
            ? row.hashtags.filter((h) => typeof h === 'string').slice(0, 15)
            : [],
          imagePrompt: String(row.imagePrompt),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Groq JSON parse error: ${message}`);
    }
    return null;
  }
}
