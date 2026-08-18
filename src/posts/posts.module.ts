import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Analytics } from '../analytics/entities/analytics.entity';
import { GroqModule } from '../groq/groq.module';
import { InstagramModule } from '../instagram/instagram.module';
import { ClusterModule } from '../cluster/cluster.module';
import { SourcesModule } from '../sources/sources.module';
import { TrendsModule } from '../trends/trends.module';
import { Post } from './entities/post.entity';
import { PostController } from './post.controller';
import { PostPipelineService } from './post-pipeline.service';
import { PostsService } from './posts.service';
import { ImageComposerModule } from '../image-composer/image-composer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Analytics]),
    TrendsModule,
    SourcesModule,
    GroqModule,
    ClusterModule,
    InstagramModule,
    ImageComposerModule,
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [PostController],
  providers: [PostsService, PostPipelineService],
  exports: [PostPipelineService],
})
export class PostsModule {}
