import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import { CronJob } from 'cron';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicConfigService } from '../settings/settings.service';
import {
  assertUsableAccessToken,
  describeTokenFormat,
  expiresAtFromExpiresIn,
  extractMetaAxiosError,
  sanitizeAccessToken,
} from './meta-token.util';
import {
  MetaAccountsResponse,
  MetaDebugTokenResponse,
  MetaTokenExchangeResponse,
  MetaTokenRefreshResult,
  MetaTokenStatus,
  StoredMetaToken,
} from './interfaces/meta-token.interface';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const INSTAGRAM_GRAPH = 'https://graph.instagram.com';
const INSTAGRAM_GRAPH_V21 = `${INSTAGRAM_GRAPH}/v21.0`;
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

  /** Instagram Login (IG…) tokens must use graph.instagram.com; Facebook (EAA…) uses graph.facebook.com */
  getGraphApiBase(): string {
    if (this.isInstagramLoginApi()) {
      return INSTAGRAM_GRAPH_V21;
    }
    return META_GRAPH_BASE;
  }

  isInstagramLoginApi(): boolean {
    return (
      this.storedToken?.tokenType === 'INSTAGRAM_LOGIN' ||
      describeTokenFormat(this.accessToken) === 'INSTAGRAM_LOGIN'
    );
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
          ? 'Token loaded but not exchanged yet — call token refresh or paste a new token in Settings'
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

  async getTokenStatusDetailed(): Promise<MetaTokenStatus> {
    const base = this.getTokenStatus();
    const token = this.accessToken;
    if (!token) return { ...base, valid: false, message: 'No token configured' };

    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    if (!appId || !appSecret) {
      return {
        ...base,
        message:
          'META_APP_ID / META_APP_SECRET missing — set in Settings or .env for auto exchange',
      };
    }

    try {
      if (this.storedToken?.tokenType === 'INSTAGRAM_LOGIN') {
        const valid = await this.validateInstagramToken(token);
        const expiresAt = this.storedToken.expiresAt;
        const expiresInDays =
          expiresAt > 0
            ? Math.floor(
                (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
              )
            : null;

        return {
          valid,
          tokenType: 'INSTAGRAM_LOGIN',
          expiresAt: expiresAt || null,
          expiresInDays,
          neverExpires: false,
          updatedAt: this.storedToken.updatedAt,
          message: valid
            ? `Instagram Login token valid — expires in ~${expiresInDays ?? '?'} day(s)`
            : 'Instagram token expired — click Generate token in Meta Developer Console and save in Settings',
        };
      }

      const debug = await this.debugToken(token);
      const isValid = debug.data?.is_valid === true;
      const expiresAt = debug.data?.expires_at ?? 0;
      const neverExpires = isValid && expiresAt === 0;
      const expiresInDays =
        neverExpires || expiresAt <= 0
          ? null
          : Math.floor(
              (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
            );

      return {
        valid: isValid,
        tokenType: this.storedToken?.tokenType ?? debug.data?.type ?? 'UNKNOWN',
        expiresAt: neverExpires ? null : expiresAt || null,
        expiresInDays,
        neverExpires,
        updatedAt: this.storedToken?.updatedAt ?? null,
        message: isValid
          ? neverExpires
            ? 'Token valid — does not expire (page token)'
            : `Token valid — expires in ~${expiresInDays ?? 0} day(s)`
          : 'Token expired or invalid — generate a new token in Meta Developer Console and save in Settings',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...base, valid: false, message: `Token check failed: ${message}` };
    }
  }

  async applyAccessToken(inputToken: string): Promise<MetaTokenRefreshResult> {
    const before = await this.getTokenStatusDetailed();
    let trimmed: string;
    try {
      trimmed = sanitizeAccessToken(inputToken);
      assertUsableAccessToken(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.accessToken = '';
      return {
        refreshed: false,
        before,
        after: { ...before, valid: false, message },
        message,
        requiresNewToken: true,
      };
    }

    const appId = await this.getAppId();
    const appSecret = await this.getAppSecret();
    if (!appId || !appSecret) {
      this.accessToken = trimmed;
      return {
        refreshed: false,
        before,
        after: await this.getTokenStatusDetailed(),
        message:
          'Token saved in memory only — set META_APP_ID and META_APP_SECRET to exchange for a long-lived page token',
        requiresNewToken: false,
      };
    }

    this.clearStoredToken();
    this.logger.log('Bootstrapping Meta token from new access token…');
    try {
      await this.bootstrapFromToken(trimmed);
      await this.dynamicConfig.set('instagram_access_token', trimmed);
      const after = await this.getTokenStatusDetailed();
      return {
        refreshed: true,
        before,
        after,
        message: after.neverExpires
          ? 'Page token ready — does not expire'
          : after.tokenType === 'INSTAGRAM_LOGIN'
            ? 'Instagram long-lived token saved (~60 days)'
            : 'Long-lived token saved successfully',
      };
    } catch (error) {
      const message = extractMetaAxiosError(error);
      this.accessToken = '';
      return {
        refreshed: false,
        before,
        after: {
          ...(await this.getTokenStatusDetailed()),
          valid: false,
          message,
        },
        message,
        requiresNewToken: true,
      };
    }
  }

  async refreshTokenIfNeeded(force = false): Promise<MetaTokenRefreshResult> {
    const before = await this.getTokenStatusDetailed();

    if (
      !force &&
      this.storedToken?.tokenType === 'INSTAGRAM_LOGIN' &&
      this.storedToken.pageAccessToken
    ) {
      const valid = await this.validateInstagramToken(
        this.storedToken.pageAccessToken,
      );
      if (valid) {
        this.accessToken = this.storedToken.pageAccessToken;
        const expiresAt = this.storedToken.expiresAt;
        const daysLeft =
          expiresAt > 0
            ? (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
            : 999;
        if (daysLeft > REFRESH_IF_EXPIRES_WITHIN_DAYS) {
          return {
            refreshed: false,
            before,
            after: await this.getTokenStatusDetailed(),
            message: `Instagram token valid for ~${Math.floor(daysLeft)} more day(s)`,
          };
        }
        this.logger.log('Refreshing Instagram long-lived token…');
        try {
          const refreshed = await this.refreshInstagramLongLived(
            this.storedToken.pageAccessToken,
          );
          this.accessToken = refreshed;
          this.storedToken = {
            ...this.storedToken,
            pageAccessToken: refreshed,
            userAccessToken: refreshed,
            updatedAt: new Date().toISOString(),
          };
          this.saveStoredToken(this.storedToken);
          return {
            refreshed: true,
            before,
            after: await this.getTokenStatusDetailed(),
            message: 'Instagram long-lived token refreshed (+60 days)',
          };
        } catch (error) {
          this.logger.warn(
            `Instagram token refresh failed: ${extractMetaAxiosError(error)}`,
          );
        }
      }
    }

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
          after: await this.getTokenStatusDetailed(),
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

    const sourceToken = sanitizeAccessToken(
      (await this.dynamicConfig.get(
        'instagram_access_token',
        'INSTAGRAM_ACCESS_TOKEN',
      )) ||
        this.storedToken?.userAccessToken ||
        this.accessToken,
    );

    if (!sourceToken) {
      const message = 'No Meta token available to refresh';
      this.logger.warn(message);
      return { refreshed: false, before, after: before, message, requiresNewToken: true };
    }

    const tokenKind = describeTokenFormat(sourceToken);
    if (tokenKind === 'INSTAGRAM_LOGIN') {
      this.logger.log('Bootstrapping Instagram Login token…');
      if (force) this.clearStoredToken();
      try {
        await this.bootstrapFromInstagramToken(sourceToken);
        const after = await this.getTokenStatusDetailed();
        return {
          refreshed: true,
          before,
          after,
          message: 'Instagram long-lived token ready (~60 days)',
        };
      } catch (error) {
        const message = extractMetaAxiosError(error);
        return {
          refreshed: false,
          before,
          after: { ...before, valid: false, message },
          message,
          requiresNewToken: true,
        };
      }
    }

    let debug: MetaDebugTokenResponse;
    try {
      debug = await this.debugToken(sourceToken);
    } catch (error) {
      const message = extractMetaAxiosError(error);
      this.logger.error(`Token debug failed: ${message}`);
      return {
        refreshed: false,
        before,
        after: { ...before, valid: false, message },
        message,
        requiresNewToken: true,
      };
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
    if (force) {
      this.clearStoredToken();
    }
    try {
      await this.bootstrapFromToken(sourceToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Token refresh failed: ${message}`);
      const after = await this.getTokenStatusDetailed();
      return {
        refreshed: false,
        before,
        after: { ...after, valid: false },
        message: `${message}. Generate a new token at Meta Developer Console → your app → Instagram → Generate token, then save it in Settings.`,
        requiresNewToken: true,
      };
    }

    const after = await this.getTokenStatusDetailed();
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
    const rawToken = await this.dynamicConfig.get(
      'instagram_access_token',
      'INSTAGRAM_ACCESS_TOKEN',
    );
    const envToken = rawToken ? sanitizeAccessToken(rawToken) : '';
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
      this.logger.warn('Cached Meta token expired — re-bootstrapping from config');
      this.clearStoredToken();
    }

    if (!envToken) {
      this.logger.error('INSTAGRAM_ACCESS_TOKEN is not set in Settings or .env');
      return;
    }

    try {
      assertUsableAccessToken(envToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(message);
      this.accessToken = '';
      return;
    }

    if (!appId || !appSecret) {
      this.logger.error(
        'META_APP_ID and META_APP_SECRET required — cannot use Instagram token without app credentials',
      );
      this.accessToken = '';
      return;
    }

    this.logger.log('Converting access token to long-lived token…');
    try {
      await this.bootstrapFromToken(envToken);
    } catch (error) {
      const message = extractMetaAxiosError(error);
      this.accessToken = '';
      this.logger.error(
        `Token bootstrap failed: ${message}. Generate a new token in Meta → Instagram → Generate token, then save in Settings.`,
      );
    }
  }

  private async bootstrapFromToken(inputToken: string): Promise<void> {
    const token = sanitizeAccessToken(inputToken);
    const kind = assertUsableAccessToken(token);

    if (kind === 'INSTAGRAM_LOGIN') {
      await this.bootstrapFromInstagramToken(token);
      return;
    }

    const longLivedUserToken = await this.exchangeForLongLivedToken(token);
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

  private async bootstrapFromInstagramToken(inputToken: string): Promise<void> {
    const appSecret = await this.getAppSecret();
    if (!appSecret) {
      throw new Error('META_APP_SECRET missing — required for Instagram token exchange');
    }

    let longLived = inputToken;
    let expiresAt = 0;

    try {
      const exchanged = await this.exchangeInstagramLongLived(inputToken);
      if (exchanged.access_token) {
        longLived = exchanged.access_token;
        if (exchanged.expires_in) {
          expiresAt = expiresAtFromExpiresIn(exchanged.expires_in);
        }
        this.logger.log('Instagram short-lived token exchanged for long-lived (~60 days)');
      }
    } catch (error) {
      this.logger.warn(
        `Long-lived exchange failed (${extractMetaAxiosError(error)}) — validating token as-is`,
      );
    }

    const valid = await this.validateInstagramToken(longLived);
    if (!valid) {
      throw new Error(
        'Instagram token invalid or expired. In Meta Developer Console → Instagram → API setup with Instagram login → Generate token, then paste here.',
      );
    }

    if (expiresAt === 0) {
      expiresAt = expiresAtFromExpiresIn(60 * 24 * 60 * 60);
    }

    this.accessToken = longLived;
    this.storedToken = {
      pageAccessToken: longLived,
      userAccessToken: inputToken,
      expiresAt,
      tokenType: 'INSTAGRAM_LOGIN',
      updatedAt: new Date().toISOString(),
    };
    this.saveStoredToken(this.storedToken);
    this.logger.log(
      `Instagram Login token ready for account (expires ~${Math.floor((expiresAt * 1000 - Date.now()) / (86400000))} days)`,
    );
  }

  private async exchangeInstagramLongLived(
    shortToken: string,
  ): Promise<MetaTokenExchangeResponse> {
    const appSecret = await this.getAppSecret();
    const params = {
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken,
    };

    const urls = [
      `${INSTAGRAM_GRAPH_V21}/access_token`,
      `${INSTAGRAM_GRAPH}/access_token`,
    ];

    let lastError: unknown;
    for (const url of urls) {
      try {
        const response = await axios.get<MetaTokenExchangeResponse>(url, {
          params,
          timeout: 30000,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        try {
          const response = await axios.post<MetaTokenExchangeResponse>(
            url,
            new URLSearchParams(params).toString(),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 30000,
            },
          );
          return response.data;
        } catch (postError) {
          lastError = postError;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async refreshInstagramLongLived(
    longLivedToken: string,
  ): Promise<string> {
    const params = {
      grant_type: 'ig_refresh_token',
      access_token: longLivedToken,
    };

    const urls = [
      `${INSTAGRAM_GRAPH_V21}/refresh_access_token`,
      `${INSTAGRAM_GRAPH}/refresh_access_token`,
    ];

    let lastError: unknown;
    for (const url of urls) {
      try {
        const response = await axios.get<MetaTokenExchangeResponse>(url, {
          params,
          timeout: 30000,
        });
        if (response.data.access_token) {
          if (this.storedToken && response.data.expires_in) {
            this.storedToken.expiresAt = expiresAtFromExpiresIn(
              response.data.expires_in,
            );
          }
          return response.data.access_token;
        }
      } catch (error) {
        lastError = error;
        try {
          const response = await axios.post<MetaTokenExchangeResponse>(
            url,
            new URLSearchParams(params).toString(),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 30000,
            },
          );
          if (response.data.access_token) {
            if (this.storedToken && response.data.expires_in) {
              this.storedToken.expiresAt = expiresAtFromExpiresIn(
                response.data.expires_in,
              );
            }
            return response.data.access_token;
          }
        } catch (postError) {
          lastError = postError;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Instagram refresh returned no access_token');
  }

  private async validateInstagramToken(token: string): Promise<boolean> {
    const igUserId = await this.getBusinessAccountId();
    try {
      const response = await axios.get<{ id?: string }>(
        `${INSTAGRAM_GRAPH_V21}/${igUserId}`,
        {
          params: { fields: 'id,username', access_token: token },
          timeout: 30000,
        },
      );
      if (response.data?.id) return true;
    } catch {
      // try /me
    }

    try {
      const response = await axios.get<{ user_id?: string; id?: string }>(
        `${INSTAGRAM_GRAPH_V21}/me`,
        {
          params: { fields: 'user_id,username', access_token: token },
          timeout: 30000,
        },
      );
      return Boolean(response.data?.user_id ?? response.data?.id);
    } catch {
      return false;
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
    if (describeTokenFormat(token) === 'INSTAGRAM_LOGIN') {
      return this.validateInstagramToken(token);
    }
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
    if (!appId || !appSecret) {
      throw new Error('META_APP_ID / META_APP_SECRET missing');
    }
    try {
      const response = await axios.get<MetaDebugTokenResponse>(
        `${META_GRAPH_BASE}/debug_token`,
        {
          params: {
            input_token: sanitizeAccessToken(token),
            access_token: `${appId}|${appSecret}`,
          },
          timeout: 30000,
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(extractMetaAxiosError(error));
    }
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
