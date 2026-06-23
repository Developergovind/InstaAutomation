import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DEFAULT_VALUES,
  ENV_FALLBACK_MAP,
  SECRET_SETTING_KEYS,
} from './settings.constants';
import { Setting } from './entities/setting.entity';

export type MaskedSettingValue =
  | string
  | { masked: string; isSet: boolean };

@Injectable()
export class DynamicConfigService {
  private cache = new Map<string, string>();
  private cacheLoaded = false;
  private dbHasRows = false;

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
    private readonly envConfig: ConfigService,
  ) {}

  async get(
    key: string,
    envFallbackKey?: string,
    defaultValue?: string,
  ): Promise<string> {
    await this.ensureCacheLoaded();
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? '';
    }
    const envKey = envFallbackKey ?? ENV_FALLBACK_MAP[key];
    if (envKey && !this.hasDbSettings()) {
      const envVal = this.envConfig.get<string>(envKey);
      if (envVal) return envVal;
    }
    return defaultValue ?? DEFAULT_VALUES[key] ?? '';
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const val = await this.get(key, ENV_FALLBACK_MAP[key], String(defaultValue));
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    await this.settingsRepo.upsert({ key, value }, ['key']);
    this.cache.set(key, value);
    this.dbHasRows = true;
  }

  async getAll(): Promise<Record<string, string>> {
    await this.ensureCacheLoaded();
    const result: Record<string, string> = {};
    for (const key of Object.keys(ENV_FALLBACK_MAP)) {
      result[key] = await this.get(key);
    }
    return result;
  }

  async getAllMasked(): Promise<Record<string, MaskedSettingValue>> {
    await this.ensureCacheLoaded();
    const result: Record<string, MaskedSettingValue> = {};
    for (const key of Object.keys(ENV_FALLBACK_MAP)) {
      const value = await this.get(key);
      if (SECRET_SETTING_KEYS.has(key)) {
        result[key] = {
          masked: value ? `••••••••${value.slice(-4)}` : '',
          isSet: Boolean(value),
        };
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  invalidateCache(): void {
    this.cacheLoaded = false;
    this.dbHasRows = false;
    this.cache.clear();
  }

  private hasDbSettings(): boolean {
    return this.dbHasRows;
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return;
    const rows = await this.settingsRepo.find();
    this.dbHasRows = rows.length > 0;
    rows.forEach((r) => {
      if (r.value != null) this.cache.set(r.key, r.value);
    });
    this.cacheLoaded = true;
  }
}
