import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Trend } from './entities/trend.entity';

export interface CreateTrendInput {
  keyword: string;
  source: string;
  niche: string;
  approxTraffic: number;
  articleCount: number;
  recencyScore: number;
  finalScore: number;
  relatedNews: { title: string; source: string; url?: string }[];
}

@Injectable()
export class TrendsService {
  constructor(
    @InjectRepository(Trend)
    private readonly trendRepo: Repository<Trend>,
  ) {}

  async createTrend(data: CreateTrendInput): Promise<Trend> {
    const trend = this.trendRepo.create({
      keyword: data.keyword,
      source: data.source,
      niche: data.niche,
      approxTraffic: data.approxTraffic,
      articleCount: data.articleCount,
      recencyScore: data.recencyScore,
      finalScore: data.finalScore,
      relatedNews: data.relatedNews,
      processed: false,
    });
    return this.trendRepo.save(trend);
  }

  async existsRecently(keyword: string, hoursWindow = 12): Promise<boolean> {
    const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    const count = await this.trendRepo.count({
      where: { keyword, createdAt: MoreThan(since) },
    });
    return count > 0;
  }

  async getTopUnprocessed(niche?: string): Promise<Trend | null> {
    const where =
      niche && niche !== 'general'
        ? { processed: false, niche }
        : { processed: false };

    return this.trendRepo.findOne({
      where,
      order: { finalScore: 'DESC', createdAt: 'DESC' },
    });
  }

  async getById(id: string): Promise<Trend | null> {
    return this.trendRepo.findOne({ where: { id } });
  }

  async getAllRanked(limit = 50): Promise<Trend[]> {
    return this.trendRepo.find({
      order: { finalScore: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAllRankedPaginated(
    page = 1,
    limit = 15,
  ): Promise<{
    items: Trend[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const [items, total] = await this.trendRepo.findAndCount({
      order: { finalScore: 'DESC', createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async markProcessed(id: string): Promise<void> {
    await this.trendRepo.update(id, { processed: true });
  }
}
