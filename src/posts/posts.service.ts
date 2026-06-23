import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analytics } from '../analytics/entities/analytics.entity';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Analytics)
    private readonly analyticsRepo: Repository<Analytics>,
  ) {}

  async createDraft(data: {
    trendId: string;
    keyword: string;
    caption: string;
    hashtags: string[];
    imagePrompt: string;
  }): Promise<Post> {
    const post = this.postRepo.create({
      ...data,
      status: 'draft',
    });
    return this.postRepo.save(post);
  }

  async updatePost(
    id: string,
    updates: Partial<Post>,
  ): Promise<void> {
    await this.postRepo.update(id, updates);
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) return null;
    const analytics = post.instagramPostId
      ? await this.analyticsRepo.findOne({
          where: { mediaId: post.instagramPostId },
        })
      : null;
    return { ...post, analytics };
  }

  async findAll(page = 1, limit = 20): Promise<Post[]> {
    return this.postRepo.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
