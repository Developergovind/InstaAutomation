export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  dbPath: process.env.DB_PATH || './data/instagram-automation.sqlite',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@automation.local',
    adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  },
  // Legacy env fallbacks — DynamicConfigService reads these when DB has no value
  groq: { apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL },
  pollinations: {
    baseUrl: process.env.POLLINATIONS_BASE_URL || process.env.IMAGE_API_URL,
    apiKey: process.env.POLLINATIONS_API_KEY,
    model: process.env.POLLINATIONS_MODEL,
    width: process.env.POLLINATIONS_WIDTH,
    height: process.env.POLLINATIONS_HEIGHT,
  },
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
  },
  trends: {
    geo: process.env.TRENDS_GEO,
    newsLang: process.env.NEWS_LANG,
    newsCountry: process.env.NEWS_COUNTRY,
  },
  schedule: {
    trendFetchCron: process.env.CRON_TREND_FETCH,
    postGenerationCron: process.env.CRON_POST_GENERATION,
    analyticsFetchCron: process.env.CRON_ANALYTICS_FETCH,
    timezone: process.env.TIMEZONE,
  },
});
