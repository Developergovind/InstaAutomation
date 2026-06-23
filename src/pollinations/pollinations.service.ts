import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DynamicConfigService } from '../settings/settings.service';
import { PollinationsImageResult } from './interfaces/pollinations.interfaces';

const LEGACY_BASE_URL = 'https://image.pollinations.ai/prompt';
const GEN_BASE_URL = 'https://gen.pollinations.ai/image';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const REQUEST_TIMEOUT_MS = 45000;

interface EndpointCandidate {
  publicUrl: string;
  headers: Record<string, string>;
}

@Injectable()
export class PollinationsService {
  private readonly logger = new Logger(PollinationsService.name);

  constructor(private readonly dynamicConfig: DynamicConfigService) {}

  async generateImage(imagePrompt: string): Promise<PollinationsImageResult> {
    const baseUrl = await this.dynamicConfig.get(
      'pollinations_base_url',
      'POLLINATIONS_BASE_URL',
      LEGACY_BASE_URL,
    );
    const apiKey = await this.dynamicConfig.get(
      'pollinations_api_key',
      'POLLINATIONS_API_KEY',
    );
    const model = await this.dynamicConfig.get(
      'pollinations_model',
      'POLLINATIONS_MODEL',
      'flux',
    );
    const width = await this.dynamicConfig.getNumber('pollinations_width', 1080);
    const height = await this.dynamicConfig.getNumber('pollinations_height', 1080);

    const candidates = this.buildEndpointCandidates(
      imagePrompt,
      baseUrl,
      apiKey,
      model,
      width,
      height,
    );
    let lastError: Error | null = null;

    for (const candidate of candidates) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const buffer = await this.fetchImage(
            candidate.publicUrl,
            candidate.headers,
          );
          this.logger.log(
            `Pollinations image generated (${buffer.length} bytes) via ${this.describeEndpoint(candidate.publicUrl)}`,
          );
          return { buffer, publicUrl: candidate.publicUrl };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const status = this.getHttpStatus(error);
          if (status === 401) break;
          this.logger.warn(
            `Pollinations attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
          );
          if (attempt < MAX_RETRIES) await this.delay(RETRY_DELAY_MS);
        }
      }
    }

    throw (
      lastError ??
      new Error('Pollinations image generation failed after all endpoints')
    );
  }

  private buildEndpointCandidates(
    prompt: string,
    baseUrl: string,
    apiKey: string,
    model: string,
    width: number,
    height: number,
  ): EndpointCandidate[] {
    const seed = Math.floor(Math.random() * 1_000_000);
    const encodedPrompt = encodeURIComponent(prompt.slice(0, 2000));
    const query = `width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;
    const candidates: EndpointCandidate[] = [];
    const seen = new Set<string>();

    const add = (base: string, useAuth: boolean) => {
      let url = `${base}/${encodedPrompt}?${query}`;
      if (useAuth && apiKey) url += `&key=${encodeURIComponent(apiKey)}`;
      if (seen.has(url)) return;
      seen.add(url);
      const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
      if (useAuth && apiKey) headers.Authorization = `Bearer ${apiKey}`;
      candidates.push({ publicUrl: url, headers });
    };

    add(baseUrl, baseUrl.includes('gen.pollinations.ai'));
    if (!baseUrl.includes('image.pollinations.ai')) add(LEGACY_BASE_URL, false);
    if (apiKey && !baseUrl.includes('gen.pollinations.ai')) add(GEN_BASE_URL, true);

    return candidates;
  }

  private async fetchImage(
    url: string,
    headers: Record<string, string>,
  ): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT_MS,
      headers,
      validateStatus: (status) => status < 500,
    });
    const contentType = String(response.headers['content-type'] ?? '');
    if (response.status !== 200 || !contentType.startsWith('image/')) {
      const err = new Error(
        `Pollinations non-image response (status=${response.status})`,
      );
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }
    return Buffer.from(response.data);
  }

  private getHttpStatus(error: unknown): number | undefined {
    if (axios.isAxiosError(error)) return error.response?.status;
    if (error instanceof Error && 'status' in error) {
      return (error as Error & { status?: number }).status;
    }
    return undefined;
  }

  private describeEndpoint(url: string): string {
    if (url.includes('image.pollinations.ai')) return 'legacy';
    if (url.includes('gen.pollinations.ai')) return 'gen';
    return 'custom';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
