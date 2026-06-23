import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramModule } from '../instagram/instagram.module';
import { Post } from '../posts/entities/post.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Analytics } from './entities/analytics.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Analytics, Post]),
    forwardRef(() => InstagramModule),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
