import { Injectable } from '@nestjs/common';

export interface ScoreInput {
  approxTraffic: number;
  articleCount: number;
  recencyScore: number;
}

@Injectable()
export class TrendScoringService {
  /**
   * Weighted scoring formula:
   *   trafficScore = min(100, log10(traffic + 1) * 14)     → 60% weight
   *   newsScore    = min(100, articles*8 + recency*12)     → 40% weight
   *   finalScore   = trafficScore * 0.6 + newsScore * 0.4
   */
  calculateScore(trend: ScoreInput): number {
    const trafficScore = Math.min(
      100,
      Math.log10(trend.approxTraffic + 1) * 14,
    );

    const newsScore = Math.min(
      100,
      trend.articleCount * 8 + trend.recencyScore * 12,
    );

    const finalScore = trafficScore * 0.6 + newsScore * 0.4;
    return Math.round(finalScore * 100) / 100;
  }
}
