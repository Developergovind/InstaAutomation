import { Module, forwardRef } from '@nestjs/common';
import { GroqModule } from '../groq/groq.module';
import { InstagramModule } from '../instagram/instagram.module';
import { TrendingModule } from '../trending/trending.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    TrendingModule,
    GroqModule,
    forwardRef(() => InstagramModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
