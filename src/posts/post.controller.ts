import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { TriggerPostDto } from './dto/trigger-post.dto';
import { PostPipelineService } from './post-pipeline.service';
import { PostsService } from './posts.service';

@Controller()
export class PostController {
  constructor(
    private readonly postPipelineService: PostPipelineService,
    private readonly postsService: PostsService,
  ) {}

  @Post('instagram/post')
  async triggerPost(@Body() body: TriggerPostDto) {
    const result = body.trendId
      ? await this.postPipelineService.runForSpecificTrend(body.trendId)
      : await this.postPipelineService.runForTopTrend();

    return successResponse(
      result,
      result.success
        ? 'Instagram post published successfully'
        : 'Instagram post pipeline completed with errors',
    );
  }

  @Get('posts')
  async listPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const posts = await this.postsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return successResponse(posts, 'Posts retrieved successfully');
  }

  @Get('posts/:id')
  async getPost(@Param('id') id: string) {
    const post = await this.postsService.findById(id);
    return successResponse(post, 'Post retrieved successfully');
  }
}
