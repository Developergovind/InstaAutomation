import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DynamicConfigService } from '../settings/settings.service';
import {
  MetaContainerStatusResponse,
  MetaMediaContainerResponse,
  MetaPublishResponse,
  PublishPostResult,
} from './interfaces/meta-api.interface';
import { MetaTokenService } from './meta-token.service';

const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_MAX_ATTEMPTS = 10;

interface MetaApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    fbtrace_id?: string;
  };
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly dynamicConfig: DynamicConfigService,
    private readonly metaTokenService: MetaTokenService,
  ) {}

  private get accessToken(): string {
    return this.metaTokenService.getAccessToken();
  }

  private graphBase(): string {
    return this.metaTokenService.getGraphApiBase();
  }

  private async getBusinessAccountId(): Promise<string> {
    return this.dynamicConfig.get(
      'instagram_business_account_id',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    );
  }

  async uploadImageContainer(
    imageUrl: string,
    fullCaption: string,
  ): Promise<string> {
    const businessAccountId = await this.getBusinessAccountId();
    const graph = this.graphBase();
    this.logger.debug(`Creating media container via ${graph}`);

    const response = await axios.post<MetaMediaContainerResponse>(
      `${graph}/${businessAccountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: fullCaption,
          access_token: this.accessToken,
        },
        timeout: 60000,
      },
    );

    if (!response.data.id) {
      throw new Error('Meta API did not return a container ID');
    }

    this.logger.log(`Media container created: ${response.data.id}`);
    return response.data.id;
  }

  async checkContainerStatus(containerId: string): Promise<string> {
    const response = await axios.get<MetaContainerStatusResponse>(
      `${this.graphBase()}/${containerId}`,
      {
        params: { fields: 'status_code', access_token: this.accessToken },
        timeout: 30000,
      },
    );
    return response.data.status_code ?? 'UNKNOWN';
  }

  async publishContainer(containerId: string): Promise<string> {
    const businessAccountId = await this.getBusinessAccountId();
    const response = await axios.post<MetaPublishResponse>(
      `${this.graphBase()}/${businessAccountId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: this.accessToken,
        },
        timeout: 60000,
      },
    );

    if (!response.data.id) {
      throw new Error('Meta API did not return a published post ID');
    }

    this.logger.log(`Post published: ${response.data.id}`);
    return response.data.id;
  }

  async publishPost(
    imageUrl: string,
    caption: string,
    hashtags: string[],
  ): Promise<PublishPostResult> {
    if (!this.metaTokenService.getAccessToken()) {
      return {
        success: false,
        error:
          'No valid Meta access token. Save your IG… token from Meta → Instagram → Generate token in Settings.',
      };
    }

    const result = await this.runPublish(imageUrl, caption, hashtags);
    if (result.success) {
      return result;
    }

    if (this.isTokenExpiredError(result.error)) {
      this.logger.warn('Meta token issue (190) — refreshing and retrying...');
      const refresh = await this.metaTokenService.refreshTokenIfNeeded(true);
      if (refresh.refreshed) {
        return this.runPublish(imageUrl, caption, hashtags);
      }
      return {
        success: false,
        error:
          refresh.message ||
          'Token refresh failed. Generate a fresh token in Meta Developer Console and save in Settings.',
      };
    }

    return result;
  }

  private async runPublish(
    imageUrl: string,
    caption: string,
    hashtags: string[],
  ): Promise<PublishPostResult> {
    try {
      const fullCaption = this.buildFullCaption(caption, hashtags);
      const containerId = await this.uploadImageContainer(imageUrl, fullCaption);

      let status = await this.checkContainerStatus(containerId);
      let attempts = 0;

      while (status !== 'FINISHED' && attempts < CONTAINER_MAX_ATTEMPTS) {
        if (status === 'ERROR') {
          return {
            success: false,
            error: 'Media container processing failed with ERROR status',
          };
        }
        attempts++;
        this.logger.log(
          `Container ${containerId} status: ${status} (poll ${attempts}/${CONTAINER_MAX_ATTEMPTS})`,
        );
        await this.delay(CONTAINER_POLL_INTERVAL_MS);
        status = await this.checkContainerStatus(containerId);
      }

      if (status !== 'FINISHED') {
        return {
          success: false,
          error: `Container not ready after ${CONTAINER_MAX_ATTEMPTS} polls. Last status: ${status}`,
        };
      }

      const postId = await this.publishContainer(containerId);
      return { success: true, postId, imageUrl };
    } catch (error) {
      const message = this.extractMetaError(error);
      this.logger.error(`publishPost failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private isTokenExpiredError(error?: string): boolean {
    if (!error) return false;
    if (/cannot parse access token/i.test(error)) return false;
    return error.includes('code=190') || /session has expired/i.test(error);
  }

  private buildFullCaption(caption: string, hashtags: string[]): string {
    const tagLine = hashtags
      .map((h) => `#${h.replace(/^#/, '')}`)
      .join(' ');
    return `${caption}\n\n${tagLine}`;
  }

  private extractMetaError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const meta = (error.response?.data as MetaApiErrorBody | undefined)?.error;
      if (meta?.message) {
        return `${meta.message} | code=${meta.code ?? '?'} | type=${meta.type ?? '?'}`;
      }
    }
    return error instanceof Error ? error.message : String(error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
