export const SECRET_SETTING_KEYS = new Set([
  'groq_api_key',
  'instagram_access_token',
  'meta_app_secret',
  'cluster_api_key',
  'imgbb_api_key',
]);

export const ENV_FALLBACK_MAP: Record<string, string> = {
  groq_api_key: 'GROQ_API_KEY',
  groq_model: 'GROQ_MODEL',
  cluster_api_key: 'CLUSTER_API_KEY',
  cluster_model: 'CLUSTER_MODEL',
  cluster_size: 'CLUSTER_SIZE',
  imgbb_api_key: 'IMGBB_API_KEY',
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
  cluster_model: 'flux-2-max',
  cluster_size: '1024x1024',
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
