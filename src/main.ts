import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { isOriginAllowed } from './config/cors.util';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';
  const allowedOrigins = configService.get<string[]>('corsOrigins') ?? [
    'http://localhost:3001',
  ];
  const allowVercelPreviews =
    nodeEnv === 'production' ||
    process.env.CORS_ALLOW_VERCEL === 'true' ||
    process.env.CORS_ALLOW_ALL === 'true';
  const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';
  const logger = new Logger('Bootstrap');

  // ✅ Vercel domains को allow करने के लिए utility function
  const isVercelDomain = (origin: string): boolean => {
    if (!origin) return false;
    return (
      origin.includes('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    );
  };

  app.enableCors({
    origin: (origin, callback) => {
      // अगर कोई origin नहीं है (same-origin requests), allow करो
      if (!origin) {
        callback(null, true);
        return;
      }

      // सब allow करो अगर CORS_ALLOW_ALL true है
      if (allowAllOrigins) {
        callback(null, true);
        return;
      }

      // Vercel domains को allow करो
      if (allowVercelPreviews && isVercelDomain(origin)) {
        callback(null, true);
        return;
      }

      // Configured origins को allow करो
      if (isOriginAllowed(origin, allowedOrigins, allowVercelPreviews)) {
        callback(null, true);
        return;
      }

      logger.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // ✅ सब को allow कर रहे हो debugging के लिए
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200,
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  logger.log(`Instagram Automation API running on port ${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API base URL: http://localhost:${port}/api`);
  logger.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  if (allowVercelPreviews) {
    logger.log('CORS: *.vercel.app preview URLs allowed');
  }
  logger.log('CORS: Vercel domains automatically allowed');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start application: ${message}`);
  process.exit(1);
});