import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImgbbUploadResponse } from './interfaces/imgbb-api.interface';
import {
  MetaContainerStatusResponse,
  MetaMediaContainerResponse,
  MetaPublishResponse,
  PublishPostResult,
} from './interfaces/meta-api.interface';
import { MetaTokenService } from './meta-token.service';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_MAX_ATTEMPTS = 10;
const IMGBB_MAX_RETRIES = 3;
const IMGBB_RETRY_DELAY_MS = 2000;

interface MetaApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly businessAccountId: string;
  private readonly imgbbApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly metaTokenService: MetaTokenService,
  ) {
    this.businessAccountId =
      this.configService.get<string>('instagram.businessAccountId') ?? '';
    this.imgbbApiKey = this.configService.get<string>('imgbb.apiKey') ?? '';
  }

  private get accessToken(): string {
    return this.metaTokenService.getAccessToken();
  }

  async uploadImageToImgbb(imageBuffer: Buffer): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= IMGBB_MAX_RETRIES; attempt++) {
      try {
        const base64Image = imageBuffer.toString('base64');
        const form = new FormData();
        form.append('image', base64Image);

        const response = await axios.post<ImgbbUploadResponse>(
          IMGBB_UPLOAD_URL,
          form,
          {
            params: { key: this.imgbbApiKey },
            headers: form.getHeaders(),
            timeout: 60000,
          },
        );

        const imageUrl = response.data.data?.url;
        if (!imageUrl) {
          throw new Error(
            response.data.error?.message ?? 'ImgBB upload returned no URL',
          );
        }

        this.logger.log(`Image uploaded to ImgBB (attempt ${attempt})`);
        return imageUrl;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `ImgBB upload attempt ${attempt}/${IMGBB_MAX_RETRIES} failed: ${lastError.message}`,
        );

        if (attempt < IMGBB_MAX_RETRIES) {
          await this.delay(IMGBB_RETRY_DELAY_MS);
        }
      }
    }

    throw lastError ?? new Error('ImgBB upload failed after retries');
  }

  async uploadImageContainer(
    imageBuffer: Buffer,
    caption: string,
  ): Promise<string> {
    try {
      const tempDir = os.tmpdir();
      const tempFile = path.join(
        tempDir,
        `instagram-${Date.now()}.png`,
      );

      try {
        fs.writeFileSync(tempFile, imageBuffer);
        this.logger.debug(`Temporary image saved: ${tempFile}`);
      } catch (writeError) {
        const message =
          writeError instanceof Error ? writeError.message : String(writeError);
        this.logger.warn(`Could not write temp file: ${message}`);
      }

      const publicUrl = await this.uploadImageToImgbb(imageBuffer);

      const response = await axios.post<MetaMediaContainerResponse>(
        `${META_GRAPH_BASE}/${this.businessAccountId}/media`,
        null,
        {
          params: {
            image_url: publicUrl,
            caption,
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
    } catch (error) {
      const message = this.logMetaApiError('uploadImageContainer', error);
      throw new Error(message);
    }
  }

  async publishContainer(containerId: string): Promise<string> {
    try {
      const response = await axios.post<MetaPublishResponse>(
        `${META_GRAPH_BASE}/${this.businessAccountId}/media_publish`,
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
    } catch (error) {
      const message = this.logMetaApiError('publishContainer', error);
      throw new Error(message);
    }
  }

  async checkContainerStatus(containerId: string): Promise<string> {
    try {
      const response = await axios.get<MetaContainerStatusResponse>(
        `${META_GRAPH_BASE}/${containerId}`,
        {
          params: {
            fields: 'status_code',
            access_token: this.accessToken,
          },
          timeout: 30000,
        },
      );

      return response.data.status_code ?? 'UNKNOWN';
    } catch (error) {
      const message = this.logMetaApiError('checkContainerStatus', error);
      throw new Error(message);
    }
  }

  async publishPost(
    imageBuffer: Buffer,
    caption: string,
    hashtags: string[],
  ): Promise<PublishPostResult> {
    try {
      const fullCaption = this.buildFullCaption(caption, hashtags);
      const containerId = await this.uploadImageContainer(
        imageBuffer,
        fullCaption,
      );

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
      return { success: true, postId };
    } catch (error) {
      const message = this.logMetaApiError('publishPost', error);
      return { success: false, error: message };
    }
  }

  /** Logs Meta Graph API error details to logger + console for easy copy/paste. */
  private logMetaApiError(context: string, error: unknown): string {
    const message = this.extractMetaApiErrorMessage(error);
    this.logger.error(`${context} failed: ${message}`);
    console.error(`\n--- Meta API Error [${context}] ---\n${message}\n---\n`);
    return message;
  }

  private extractMetaApiErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const body = error.response?.data as MetaApiErrorBody | undefined;
      const meta = body?.error;

      if (meta?.message) {
        const parts = [
          meta.message,
          meta.type ? `type=${meta.type}` : null,
          meta.code != null ? `code=${meta.code}` : null,
          meta.error_subcode != null ? `subcode=${meta.error_subcode}` : null,
          meta.fbtrace_id ? `fbtrace_id=${meta.fbtrace_id}` : null,
          status != null ? `http=${status}` : null,
        ].filter(Boolean);
        return parts.join(' | ');
      }

      if (body) {
        return `HTTP ${status ?? '?'}: ${JSON.stringify(body, null, 2)}`;
      }

      return error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }

  private buildFullCaption(caption: string, hashtags: string[]): string {
    const tagLine = hashtags
      .map((h) => `#${h.replace(/^#/, '')}`)
      .join(' ');
    return `${caption}\n\n${tagLine}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
