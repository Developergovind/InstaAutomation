import { Module } from '@nestjs/common';
import { TrendScoringService } from './trend-scoring.service';

@Module({
  providers: [TrendScoringService],
  exports: [TrendScoringService],
})
export class ScoringModule {}
