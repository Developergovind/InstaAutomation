import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  CaptionHashtagResult,
  GroqChatCompletionResponse,
  GroqChatMessage,
} from './interfaces/groq-api.interface';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const FALLBACK_TOPICS = [
  'AI breakthroughs',
  'Sustainable tech',
  'Cybersecurity trends',
  'Cloud computing',
  'Developer tools',
];

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly imageApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('groq.apiKey');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is not configured');
    }
    this.apiKey = apiKey ?? '';
    this.model =
      this.configService.get<string>('groq.model') ?? 'llama-3.3-70b-versatile';
    this.imageApiUrl =
      this.configService.get<string>('groq.imageApiUrl') ??
      'https://image.pollinations.ai/prompt';
  }

  async fetchTrendingTopics(niche: string): Promise<string[]> {
    try {
      const prompt = `You are a social media trend analyst. List the top 5 trending topics that are popular RIGHT NOW in the ${niche} niche and would work well for Instagram posts. Use current news, social media trends, and viral content patterns. Return ONLY a valid JSON array of strings, no explanation, no markdown. Example: ["topic1","topic2","topic3","topic4","topic5"]`;

      const text = await this.chat(
        [
          {
            role: 'system',
            content:
              'You respond only with valid JSON when asked. No markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7 },
      );

      const topics = this.parseJsonStringArray(text);

      if (topics.length > 0) {
        return topics;
      }

      this.logger.warn('Empty topics array from Groq, using fallback');
      return [...FALLBACK_TOPICS];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`fetchTrendingTopics failed: ${message}`);
      return [...FALLBACK_TOPICS];
    }
  }

  async generateImagePrompt(topic: string): Promise<string> {
    try {
      const prompt = `Create a detailed, vivid image generation prompt for an Instagram post about: ${topic}. The image should be eye-catching, suitable for Instagram, visually stunning, high quality. Return ONLY the prompt text, nothing else. Max 200 words.`;

      return await this.chat([{ role: 'user', content: prompt }], {
        temperature: 0.8,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`generateImagePrompt failed: ${message}`);
      throw error;
    }
  }

  async generateImage(imagePrompt: string): Promise<Buffer> {
    try {
      const truncated = imagePrompt.slice(0, 800);
      const encoded = encodeURIComponent(truncated);
      const url = `${this.imageApiUrl}/${encoded}?width=1080&height=1080&nologo=true&enhance=true`;

      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: { Accept: 'image/*' },
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length === 0) {
        throw new Error('Empty image response from image API');
      }

      this.logger.log(`Image generated (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`generateImage failed: ${message}`);
      throw error;
    }
  }

  async generateCaption(topic: string): Promise<CaptionHashtagResult> {
    try {
      const prompt = `Write an engaging Instagram caption for a post about: ${topic}. Then provide 20 relevant hashtags (without # symbol in the array). Return ONLY valid JSON in this exact format: {"caption": "your caption here", "hashtags": ["hashtag1", "hashtag2"]}. No markdown, no explanation.`;

      const text = await this.chat(
        [
          {
            role: 'system',
            content:
              'You respond only with valid JSON when asked. No markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7 },
      );

      const parsed = this.parseCaptionJson(text);
      if (parsed) {
        return parsed;
      }

      this.logger.warn('Caption JSON parse failed, using fallback caption');
      return {
        caption: `Exploring the latest in ${topic}. What do you think? Drop a comment below!`,
        hashtags: [
          topic.replace(/\s+/g, ''),
          'trending',
          'instagram',
          'viral',
          'explore',
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`generateCaption failed: ${message}`);
      return {
        caption: `Discover more about ${topic} today!`,
        hashtags: ['trending', 'instagram', 'explorepage', 'viral'],
      };
    }
  }

  private async chat(
    messages: GroqChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const response = await axios.post<GroqChatCompletionResponse>(
      GROQ_CHAT_URL,
      {
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.6,
        max_tokens: options?.maxTokens ?? 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    if (response.data.error?.message) {
      throw new Error(response.data.error.message);
    }

    const content = response.data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    return content;
  }

  private parseJsonStringArray(text: string): string[] {
    try {
      const cleaned = this.stripMarkdownJson(text);
      const parsed: unknown = JSON.parse(cleaned);

      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
      ) {
        return parsed as string[];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`JSON array parse error: ${message}`);
    }
    return [];
  }

  private parseCaptionJson(text: string): CaptionHashtagResult | null {
    try {
      const cleaned = this.stripMarkdownJson(text);
      const parsed: unknown = JSON.parse(cleaned);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'caption' in parsed &&
        'hashtags' in parsed &&
        typeof (parsed as CaptionHashtagResult).caption === 'string' &&
        Array.isArray((parsed as CaptionHashtagResult).hashtags)
      ) {
        const result = parsed as CaptionHashtagResult;
        return {
          caption: result.caption,
          hashtags: result.hashtags.filter((h) => typeof h === 'string'),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Caption JSON parse error: ${message}`);
    }
    return null;
  }

  private stripMarkdownJson(text: string): string {
    return text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  }
}
