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
    process.env.CORS_ALLOW_VERCEL === 'true';
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins, allowVercelPreviews)) {
        callback(null, true);
        return;
      }
      logger.warn(`CORS blocked origin: ${origin ?? '(none)'}`);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to start application: ${message}`);
  process.exit(1);
});
