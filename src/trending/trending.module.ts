import { Module } from '@nestjs/common';
import { GroqModule } from '../groq/groq.module';
import { TrendingController } from './trending.controller';
import { TrendingService } from './trending.service';

@Module({
  imports: [GroqModule],
  controllers: [TrendingController],
  providers: [TrendingService],
  exports: [TrendingService],
})
export class TrendingModule {}
