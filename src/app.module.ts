import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { Analytics } from './analytics/entities/analytics.entity';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { DashboardModule } from './dashboard/dashboard.module';
import { GroqModule } from './groq/groq.module';
import { InstagramModule } from './instagram/instagram.module';
import { ClusterModule } from './cluster/cluster.module';
import { Post } from './posts/entities/post.entity';
import { PostsModule } from './posts/posts.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ScoringModule } from './scoring/scoring.module';
import { SettingsModule } from './settings/settings.module';
import { Setting } from './settings/entities/setting.entity';
import { SourcesModule } from './sources/sources.module';
import { Trend } from './trends/entities/trend.entity';
import { TrendsModule } from './trends/trends.module';
import { ImageComposerModule } from './image-composer/image-composer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqljs',
        location: config.get<string>('dbPath'),
        autoSave: true,
        entities: [Trend, Post, Setting, Analytics],
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    SettingsModule,
    ScoringModule,
    SourcesModule,
    TrendsModule,
    GroqModule,
    ClusterModule,
    InstagramModule,
    PostsModule,
    AnalyticsModule,
    DashboardModule,
    SchedulerModule,
    ImageComposerModule,
  ],
})
export class AppModule {}