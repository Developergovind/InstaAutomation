export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    imageApiUrl:
      process.env.IMAGE_API_URL || 'https://image.pollinations.ai/prompt',
  },
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
  },
  imgbb: {
    apiKey: process.env.IMGBB_API_KEY,
  },
  schedule: {
    cronTime: process.env.POST_CRON_TIME || '0 9 * * *',
    timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  },
  niche: process.env.CONTENT_NICHE || 'technology',
});
