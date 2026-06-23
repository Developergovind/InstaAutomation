import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PostsModule } from '../posts/posts.module';
import { SourcesModule } from '../sources/sources.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    SourcesModule,
    PostsModule,
    forwardRef(() => AnalyticsModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
