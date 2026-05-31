import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { GroqModule } from './groq/groq.module';
import { InstagramModule } from './instagram/instagram.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TrendingModule } from './trending/trending.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    GroqModule,
    TrendingModule,
    InstagramModule,
    SchedulerModule,
  ],
})
export class AppModule {}
