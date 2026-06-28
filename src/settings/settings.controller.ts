import { Body, Controller, Get, Inject, Put, forwardRef } from '@nestjs/common';
import { NICHE_LABELS } from '../niches/niche-topics';
import { MetaTokenService } from '../instagram/meta-token.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { successResponse } from '../common/utils/api-response.util';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DynamicConfigService } from './settings.service';

const CRON_KEYS = new Set([
  'cron_trend_fetch',
  'cron_post_generation',
  'cron_analytics_fetch',
  'timezone',
]);

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly dynamicConfig: DynamicConfigService,
    @Inject(forwardRef(() => SchedulerService))
    private readonly schedulerService: SchedulerService,
    @Inject(forwardRef(() => MetaTokenService))
    private readonly metaTokenService: MetaTokenService,
  ) {}

  @Get()
  async getSettings() {
    const settings = await this.dynamicConfig.getAllMasked();
    return successResponse(settings, 'Settings retrieved successfully');
  }

  @Put()
  async updateSettings(@Body() body: UpdateSettingsDto) {
    let cronChanged = false;
    const entries = Object.entries(body).filter(
      ([, v]) => v !== undefined && v !== '',
    );

    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        await this.dynamicConfig.set(key, value);
        if (CRON_KEYS.has(key)) cronChanged = true;
        if (key === 'instagram_access_token') {
          await this.metaTokenService.applyAccessToken(value);
        }
      }
    }

    if (cronChanged) {
      await this.schedulerService.rescheduleJobs();
    }

    const settings = await this.dynamicConfig.getAllMasked();
    return successResponse(settings, 'Settings updated successfully');
  }

  @Get('niches')
  getNiches() {
    const niches = Object.entries(NICHE_LABELS).map(([id, label]) => ({
      id,
      label,
    }));
    return successResponse(niches, 'Niches retrieved successfully');
  }
}
