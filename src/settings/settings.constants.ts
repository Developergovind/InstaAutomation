export const SECRET_SETTING_KEYS = new Set([
  'groq_api_key',
  'instagram_access_token',
  'meta_app_secret',
  'pollinations_api_key',
]);

export const ENV_FALLBACK_MAP: Record<string, string> = {
  groq_api_key: 'GROQ_API_KEY',
  groq_model: 'GROQ_MODEL',
  pollinations_base_url: 'POLLINATIONS_BASE_URL',
  pollinations_model: 'POLLINATIONS_MODEL',
  pollinations_width: 'POLLINATIONS_WIDTH',
  pollinations_height: 'POLLINATIONS_HEIGHT',
  pollinations_api_key: 'POLLINATIONS_API_KEY',
  instagram_access_token: 'INSTAGRAM_ACCESS_TOKEN',
  instagram_business_account_id: 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  meta_app_id: 'META_APP_ID',
  meta_app_secret: 'META_APP_SECRET',
  trends_geo: 'TRENDS_GEO',
  news_lang: 'NEWS_LANG',
  news_country: 'NEWS_COUNTRY',
  niche: 'CONTENT_NICHE',
  cron_trend_fetch: 'CRON_TREND_FETCH',
  cron_post_generation: 'CRON_POST_GENERATION',
  cron_analytics_fetch: 'CRON_ANALYTICS_FETCH',
  timezone: 'TIMEZONE',
};

export const DEFAULT_VALUES: Record<string, string> = {
  groq_model: 'openai/gpt-oss-120b',
  pollinations_base_url: 'https://image.pollinations.ai/prompt',
  pollinations_model: 'flux',
  pollinations_width: '1080',
  pollinations_height: '1080',
  trends_geo: 'IN',
  news_lang: 'en-IN',
  news_country: 'IN',
  niche: 'general',
  cron_trend_fetch: '0 */3 * * *',
  cron_post_generation: '0 9,18 * * *',
  cron_analytics_fetch: '0 */6 * * *',
  timezone: 'Asia/Kolkata',
};

export const ALL_SETTING_KEYS = Object.keys(ENV_FALLBACK_MAP);
