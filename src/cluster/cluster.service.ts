import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import axios from 'axios';
import { DynamicConfigService } from '../settings/settings.service';

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);

  constructor(private readonly dynamicConfig: DynamicConfigService) {}

  async generateBackgroundImage(backgroundScene: string, niche = 'general'): Promise<Buffer> {
    const apiKey = await this.dynamicConfig.get('cluster_api_key', 'CLUSTER_API_KEY');
    const model = await this.dynamicConfig.get('cluster_model', 'CLUSTER_MODEL', 'flux-2-max');
    const size = (await this.dynamicConfig.get('cluster_size', 'CLUSTER_SIZE', '1024x1024')) as '1024x1024';

    const enhancedPrompt = `${backgroundScene}. \
High quality, 8k resolution, cinematic lighting, photorealistic or high-end 3D render. \
Dark dramatic studio aesthetic, clean background. \
Absolutely NO text, NO words, NO letters, NO numbers, NO signs, NO watermarks, NO overlays anywhere. \
1:1 square format.`;

    // Attempt 1: ClusterProtocol (Flux-2-max)
    if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_cluster_api_key_here') {
      try {
        this.logger.log('Generating image via ClusterProtocol (Flux)...');
        const client = new OpenAI({
          baseURL: 'https://api.clusterprotocol.ai/v1',
          apiKey,
        });

        const response = await client.images.generate({
          model,
          prompt: enhancedPrompt,
          n: 1,
          size,
        });

        const imageUrl = response.data?.[0]?.url;
        const b64 = response.data?.[0]?.b64_json;

        if (imageUrl) {
          this.logger.log(`ClusterProtocol image received (${imageUrl}). Downloading...`);
          const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
          return Buffer.from(imgResponse.data);
        }

        if (b64) {
          this.logger.log('ClusterProtocol image received as base64.');
          return Buffer.from(b64, 'base64');
        }
      } catch (error: any) {
        this.logger.warn(`ClusterProtocol generation failed: ${error?.message || error}. Falling back to Pollinations...`);
      }
    } else {
      this.logger.log('ClusterProtocol API key not set, using Pollinations AI generator...');
    }

    // Attempt 2: Pollinations AI Image Generation (Zero-config, fast, free fallback)
    try {
      this.logger.log('Generating visual via Pollinations AI generator...');
      const cleanPrompt = encodeURIComponent(
        `${backgroundScene}, cinematic studio lighting, 3D render, dark background, 8k, no text`,
      );
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&enhance=true`;
      const polResponse = await axios.get(pollinationsUrl, {
        responseType: 'arraybuffer',
        timeout: 25000,
      });

      if (polResponse.data && polResponse.data.length > 5000) {
        this.logger.log('Pollinations visual generated successfully.');
        return Buffer.from(polResponse.data);
      }
    } catch (polErr: any) {
      this.logger.warn(`Pollinations fallback failed: ${polErr?.message || polErr}. Using curated niche visual.`);
    }

    // Attempt 3: Curated high-res Unsplash niche background
    return this.getNicheFallbackBuffer(niche);
  }

  private async getNicheFallbackBuffer(niche: string): Promise<Buffer> {
    const NICHE_BG_MAP: Record<string, string> = {
      crypto: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?auto=format&fit=crop&w=1080&h=1080&q=80',
      technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&h=1080&q=80',
      business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&h=1080&q=80',
      finance: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&h=1080&q=80',
      entertainment: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&h=1080&q=80',
      sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&h=1080&q=80',
      health: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1080&h=1080&q=80',
      science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1080&h=1080&q=80',
      fashion: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1080&h=1080&q=80',
      general: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1080&h=1080&q=80',
    };

    const url = NICHE_BG_MAP[niche.toLowerCase()] || NICHE_BG_MAP.general;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
}
