import { Module } from '@nestjs/common';
import { ImageComposerService } from './image-composer.service';

@Module({
  providers: [ImageComposerService],
  exports: [ImageComposerService],
})
export class ImageComposerModule {}
