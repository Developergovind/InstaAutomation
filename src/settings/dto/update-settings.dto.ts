import { IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() groq_api_key?: string;
  @IsOptional() @IsString() groq_model?: string;
  @IsOptional() @IsString() pollinations_base_url?: string;
  @IsOptional() @IsString() pollinations_model?: string;
  @IsOptional() @IsString() pollinations_width?: string;
  @IsOptional() @IsString() pollinations_height?: string;
  @IsOptional() @IsString() instagram_access_token?: string;
  @IsOptional() @IsString() instagram_business_account_id?: string;
  @IsOptional() @IsString() meta_app_id?: string;
  @IsOptional() @IsString() meta_app_secret?: string;
  @IsOptional() @IsString() trends_geo?: string;
  @IsOptional() @IsString() news_lang?: string;
  @IsOptional() @IsString() news_country?: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsString() cron_trend_fetch?: string;
  @IsOptional() @IsString() cron_post_generation?: string;
  @IsOptional() @IsString() cron_analytics_fetch?: string;
  @IsOptional() @IsString() timezone?: string;
}
