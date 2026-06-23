import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Analytics } from '../analytics/entities/analytics.entity';
import { Post } from '../posts/entities/post.entity';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Analytics]),
    forwardRef(() => SchedulerModule),
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
