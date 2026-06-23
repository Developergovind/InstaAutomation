import { Module, forwardRef } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { TrendsModule } from '../trends/trends.module';
import { GoogleNewsService } from './google-news/google-news.service';
import { GoogleTrendsService } from './google-trends/google-trends.service';
import { TrendFetchService } from './trend-fetch.service';

@Module({
  imports: [ScoringModule, forwardRef(() => TrendsModule)],
  providers: [GoogleTrendsService, GoogleNewsService, TrendFetchService],
  exports: [TrendFetchService],
})
export class SourcesModule {}
