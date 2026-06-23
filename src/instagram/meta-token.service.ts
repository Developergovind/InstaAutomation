import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import { CronJob } from 'cron';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicConfigService } from '../settings/settings.service';
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
  private accessToken = '';
  private storedToken: StoredMetaToken | null = null;

  constructor(
    private readonly dynamicConfig: DynamicConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.tokenStorePath = path.join(process.cwd(), 'data', 'meta-token.json');
  }

  private async getAppId(): Promise<string> {
    return this.dynamicConfig.get('meta_app_id', 'META_APP_ID');
  }

  private async getAppSecret(): Promise<string> {
    return this.dynamicConfig.get('meta_app_secret', 'META_APP_SECRET');
  }

  private async getBusinessAccountId(): Promise<string> {
    return this.dynamicConfig.get(
      'instagram_business_account_id',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.initializeToken();
    await this.registerDailyRefreshCheck();
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

    if (
      !force &&
      this.storedToken?.pageAccessToken &&
      this.storedToken.tokenType === 'PAGE'
    ) {
      const pageValid = await this.isTokenValid(this.storedToken.pageAccessToken);
      if (pageValid) {
        this.accessToken = this.storedToken.pageAccessToken;
        return {
          refreshed: false,
          before,
          after: this.getTokenStatus(),
          message: 'Page token active — refresh not needed',
        };
      }
    }

    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();

    if (!appId || !appSecret) {
      const message =
        'META_APP_ID / META_APP_SECRET missing — auto token refresh disabled';
      this.logger.warn(message);
      return { refreshed: false, before, after: before, message };
    }

    const sourceToken =
      (await this.dynamicConfig.get(
        'instagram_access_token',
        'INSTAGRAM_ACCESS_TOKEN',
      )) ||
      this.storedToken?.userAccessToken ||
      this.accessToken;

    if (!sourceToken) {
      const message = 'No Meta token available to refresh';
      this.logger.warn(message);
      return { refreshed: false, before, after: before, message };
    }

    let debug: MetaDebugTokenResponse;
    try {
      debug = await this.debugToken(sourceToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Token debug failed: ${message}`);
      return { refreshed: false, before, after: before, message };
    }

    const isValid = debug.data?.is_valid ?? false;
    const expiresAt = debug.data?.expires_at ?? 0;
    const isNeverExpiring = expiresAt === 0 && isValid;

    if (!force && !isValid) {
      this.logger.warn('Stored/env token is invalid — attempting refresh');
      force = true;
    }

    if (!force && isNeverExpiring) {
      const message = 'Page token active — refresh not needed (never expires)';
      this.logger.debug(message);
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
    try {
      await this.bootstrapFromToken(sourceToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Token refresh failed: ${message}`);
      return {
        refreshed: false,
        before,
        after: this.getTokenStatus(),
        message: `${message}. Get a new short-lived token from Meta Developer Console and update INSTAGRAM_ACCESS_TOKEN in .env`,
      };
    }

    const after = this.getTokenStatus();
    return {
      refreshed: true,
      before,
      after,
      message: force
        ? 'Token refresh completed (forced refresh)'
        : 'Token refresh completed',
    };
  }

  private async initializeToken(): Promise<void> {
    const envToken = await this.dynamicConfig.get(
      'instagram_access_token',
      'INSTAGRAM_ACCESS_TOKEN',
    );
    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    const cached = this.loadStoredToken();

    if (cached?.pageAccessToken) {
      const cachedValid = await this.isTokenValid(cached.pageAccessToken);
      if (cachedValid) {
        this.accessToken = cached.pageAccessToken;
        this.storedToken = cached;
        this.logger.log(
          `Meta page token loaded from cache (updated ${cached.updatedAt})`,
        );
        await this.refreshTokenIfNeeded();
        return;
      }
      this.logger.warn('Cached Meta token expired — re-bootstrapping from .env');
      this.clearStoredToken();
    }

    if (!envToken) {
      this.logger.error('INSTAGRAM_ACCESS_TOKEN is not set in .env');
      return;
    }

    if (!appId || !appSecret) {
      this.accessToken = envToken;
      this.logger.warn(
        'Using .env token as-is. Set META_APP_ID + META_APP_SECRET for auto refresh.',
      );
      return;
    }

    this.logger.log('Converting .env token to long-lived page token...');
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
    if (!debug.data?.is_valid) {
      throw new Error(
        'Token exchange produced an invalid token — update INSTAGRAM_ACCESS_TOKEN with a fresh token from Meta Developer Console',
      );
    }

    const expiresAt = debug.data.expires_at ?? 0;

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
    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    const debug = await this.debugToken(token);
    if (!debug.data?.is_valid) {
      throw new Error(
        'INSTAGRAM_ACCESS_TOKEN is expired or invalid. Generate a new token at https://developers.facebook.com → your app → Use cases → Instagram → Generate token',
      );
    }

    const expiresAt = debug.data.expires_at ?? 0;
    if (expiresAt === 0) {
      return token;
    }

    const response = await axios.get<MetaTokenExchangeResponse>(
      `${META_GRAPH_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: token,
        },
        timeout: 30000,
      },
    );

    const longLived = response.data.access_token;
    if (!longLived) {
      throw new Error('Meta token exchange returned no access_token');
    }

    this.logger.log('Token exchanged for long-lived token (~60 days)');
    return longLived;
  }

  private async fetchPageAccessToken(
    userToken: string,
  ): Promise<string | null> {
    const businessAccountId = await this.getBusinessAccountId();
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
        page.instagram_business_account?.id === businessAccountId,
    );

    if (matched?.access_token) {
      this.logger.log(
        `Page token found for Instagram account ${businessAccountId}` +
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

  private async isTokenValid(token: string): Promise<boolean> {
    try {
      const debug = await this.debugToken(token);
      return debug.data?.is_valid === true;
    } catch {
      return false;
    }
  }

  private async debugToken(token: string): Promise<MetaDebugTokenResponse> {
    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    const response = await axios.get<MetaDebugTokenResponse>(
      `${META_GRAPH_BASE}/debug_token`,
      {
        params: {
          input_token: token,
          access_token: `${appId}|${appSecret}`,
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

  private clearStoredToken(): void {
    try {
      if (fs.existsSync(this.tokenStorePath)) {
        fs.unlinkSync(this.tokenStorePath);
      }
    } catch {
      // ignore
    }
    this.storedToken = null;
  }

  private async registerDailyRefreshCheck(): Promise<void> {
    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    if (!appId || !appSecret) {
      return;
    }

    const timezone = await this.dynamicConfig.get('timezone', 'TIMEZONE', 'Asia/Kolkata');
    const job = CronJob.from({
      cronTime: REFRESH_CHECK_CRON,
      timeZone: timezone,
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
