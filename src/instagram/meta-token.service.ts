import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import { CronJob } from 'cron';
import * as fs from 'fs';
import * as path from 'path';
import {
  MetaAccountsResponse,
  MetaDebugTokenResponse,
  MetaTokenExchangeResponse,
  MetaTokenRefreshResult,
  MetaTokenStatus,
  StoredMetaToken,
} from './interfaces/meta-token.interface';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const TOKEN_REFRESH_CRON_NAME = 'meta-token-refresh';
const REFRESH_CHECK_CRON = '0 3 * * *';
const REFRESH_IF_EXPIRES_WITHIN_DAYS = 14;

@Injectable()
export class MetaTokenService implements OnModuleInit {
  private readonly logger = new Logger(MetaTokenService.name);
  private readonly tokenStorePath: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly businessAccountId: string;
  private accessToken = '';
  private storedToken: StoredMetaToken | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.appId = this.configService.get<string>('instagram.appId') ?? '';
    this.appSecret = this.configService.get<string>('instagram.appSecret') ?? '';
    this.businessAccountId =
      this.configService.get<string>('instagram.businessAccountId') ?? '';
    this.tokenStorePath = path.join(process.cwd(), 'data', 'meta-token.json');
  }

  async onModuleInit(): Promise<void> {
    await this.initializeToken();
    this.registerDailyRefreshCheck();
  }

  getAccessToken(): string {
    return this.accessToken;
  }

  getTokenStatus(): MetaTokenStatus {
    if (!this.storedToken) {
      return {
        valid: Boolean(this.accessToken),
        tokenType: 'UNKNOWN',
        expiresAt: null,
        expiresInDays: null,
        neverExpires: false,
        updatedAt: null,
        message: this.accessToken
          ? 'Token loaded from env only (not yet persisted)'
          : 'No token configured',
      };
    }

    const neverExpires = this.storedToken.expiresAt === 0;
    const expiresInDays = neverExpires
      ? null
      : Math.floor(
          (this.storedToken.expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
        );

    return {
      valid: Boolean(this.accessToken),
      tokenType: this.storedToken.tokenType,
      expiresAt: neverExpires ? null : this.storedToken.expiresAt,
      expiresInDays,
      neverExpires,
      updatedAt: this.storedToken.updatedAt,
      message: neverExpires
        ? 'Page token active — does not expire'
        : `User token expires in ~${expiresInDays ?? 0} day(s)`,
    };
  }

  async refreshTokenIfNeeded(force = false): Promise<MetaTokenRefreshResult> {
    const before = this.getTokenStatus();

    if (!this.appId || !this.appSecret) {
      const message =
        'META_APP_ID / META_APP_SECRET missing — auto token refresh disabled';
      this.logger.warn(message);
      return { refreshed: false, before, after: before, message };
    }

    const sourceToken =
      this.storedToken?.userAccessToken ||
      this.configService.get<string>('instagram.accessToken') ||
      this.accessToken;

    if (!sourceToken) {
      const message = 'No Meta token available to refresh';
      this.logger.warn(message);
      return { refreshed: false, before, after: before, message };
    }

    const debug = await this.debugToken(sourceToken);
    const expiresAt = debug.data?.expires_at ?? 0;
    const isNeverExpiring = expiresAt === 0;

    if (!force && isNeverExpiring) {
      const message = 'Page token active — refresh not needed (never expires)';
      this.logger.debug('Meta token does not expire — refresh skipped');
      return { refreshed: false, before, after: before, message };
    }

    if (!force && expiresAt > 0) {
      const daysLeft = (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft > REFRESH_IF_EXPIRES_WITHIN_DAYS) {
        const message = `Token valid for ~${Math.floor(daysLeft)} more day(s) — refresh skipped`;
        this.logger.debug(message);
        return { refreshed: false, before, after: before, message };
      }
    }

    this.logger.log('Refreshing Meta access token...');
    await this.bootstrapFromToken(sourceToken);

    const after = this.getTokenStatus();
    return {
      refreshed: true,
      before,
      after,
      message: force
        ? 'Token refresh completed (forced test refresh)'
        : 'Token refresh completed',
    };
  }

  private async initializeToken(): Promise<void> {
    const envToken =
      this.configService.get<string>('instagram.accessToken') ?? '';
    const cached = this.loadStoredToken();

    if (cached?.pageAccessToken) {
      this.accessToken = cached.pageAccessToken;
      this.storedToken = cached;
      this.logger.log(
        `Meta page token loaded from cache (updated ${cached.updatedAt})`,
      );
      await this.refreshTokenIfNeeded();
      return;
    }

    if (!envToken) {
      this.logger.error('INSTAGRAM_ACCESS_TOKEN is not set in .env');
      return;
    }

    if (!this.appId || !this.appSecret) {
      this.accessToken = envToken;
      this.logger.warn(
        'Using .env token as-is. Set META_APP_ID + META_APP_SECRET for auto refresh.',
      );
      return;
    }

    this.logger.log('Converting .env token to long-lived page token (one-time)...');
    try {
      await this.bootstrapFromToken(envToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.accessToken = envToken;
      this.logger.error(
        `Token bootstrap failed: ${message}. Using .env token as fallback.`,
      );
    }
  }

  private async bootstrapFromToken(inputToken: string): Promise<void> {
    const longLivedUserToken = await this.exchangeForLongLivedToken(inputToken);
    const pageToken = await this.fetchPageAccessToken(longLivedUserToken);

    const tokenToUse = pageToken ?? longLivedUserToken;
    const debug = await this.debugToken(tokenToUse);
    const expiresAt = debug.data?.expires_at ?? 0;

    this.accessToken = tokenToUse;
    this.storedToken = {
      pageAccessToken: pageToken ?? tokenToUse,
      userAccessToken: longLivedUserToken,
      expiresAt,
      tokenType: pageToken ? 'PAGE' : 'USER',
      updatedAt: new Date().toISOString(),
    };
    this.saveStoredToken(this.storedToken);

    if (pageToken) {
      this.logger.log(
        'Meta page token ready — this token does not expire (no manual updates needed)',
      );
    } else {
      const days =
        expiresAt > 0
          ? Math.floor((expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
      this.logger.warn(
        `Could not fetch page token. Using user token (~${days ?? '?'} days). ` +
          'Ensure Instagram is linked to a Facebook Page.',
      );
    }
  }

  private async exchangeForLongLivedToken(token: string): Promise<string> {
    const debug = await this.debugToken(token);
    const expiresAt = debug.data?.expires_at ?? 0;

    if (expiresAt === 0) {
      return token;
    }

    const response = await axios.get<MetaTokenExchangeResponse>(
      `${META_GRAPH_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: token,
        },
        timeout: 30000,
      },
    );

    const longLived = response.data.access_token;
    if (!longLived) {
      throw new Error('Meta token exchange returned no access_token');
    }

    this.logger.log('Short-lived token exchanged for long-lived token (~60 days)');
    return longLived;
  }

  private async fetchPageAccessToken(
    userToken: string,
  ): Promise<string | null> {
    const response = await axios.get<MetaAccountsResponse>(
      `${META_GRAPH_BASE}/me/accounts`,
      {
        params: {
          fields: 'id,name,access_token,instagram_business_account',
          access_token: userToken,
        },
        timeout: 30000,
      },
    );

    const pages = response.data.data ?? [];
    const matched = pages.find(
      (page) =>
        page.instagram_business_account?.id === this.businessAccountId,
    );

    if (matched?.access_token) {
      this.logger.log(
        `Page token found for Instagram account ${this.businessAccountId}` +
          (matched.name ? ` (${matched.name})` : ''),
      );
      return matched.access_token;
    }

    if (pages.length === 1 && pages[0].access_token) {
      this.logger.warn(
        'Instagram business ID mismatch — using the only linked Facebook Page token',
      );
      return pages[0].access_token;
    }

    return null;
  }

  private async debugToken(token: string): Promise<MetaDebugTokenResponse> {
    const response = await axios.get<MetaDebugTokenResponse>(
      `${META_GRAPH_BASE}/debug_token`,
      {
        params: {
          input_token: token,
          access_token: `${this.appId}|${this.appSecret}`,
        },
        timeout: 30000,
      },
    );
    return response.data;
  }

  private loadStoredToken(): StoredMetaToken | null {
    try {
      if (!fs.existsSync(this.tokenStorePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.tokenStorePath, 'utf8');
      return JSON.parse(raw) as StoredMetaToken;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not read token cache: ${message}`);
      return null;
    }
  }

  private saveStoredToken(token: StoredMetaToken): void {
    const dir = path.dirname(this.tokenStorePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.tokenStorePath, JSON.stringify(token, null, 2), 'utf8');
    this.logger.log(`Token saved to ${this.tokenStorePath}`);
  }

  private registerDailyRefreshCheck(): void {
    if (!this.appId || !this.appSecret) {
      return;
    }

    const job = CronJob.from({
      cronTime: REFRESH_CHECK_CRON,
      timeZone:
        this.configService.get<string>('schedule.timezone') ?? 'Asia/Kolkata',
      onTick: () => {
        void this.refreshTokenIfNeeded();
      },
      start: true,
    });

    this.schedulerRegistry.addCronJob(TOKEN_REFRESH_CRON_NAME, job);
    this.logger.log(
      `Meta token auto-refresh check scheduled daily at ${REFRESH_CHECK_CRON}`,
    );
  }
}
