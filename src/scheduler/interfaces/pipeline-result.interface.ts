import { PublishPostResult } from '../../instagram/interfaces/meta-api.interface';

export interface PipelineContent {
  topic: string;
  caption: string;
  hashtags: string[];
}

export interface ManualPostPipelineResult {
  content: PipelineContent;
  publishResult: PublishPostResult;
}
