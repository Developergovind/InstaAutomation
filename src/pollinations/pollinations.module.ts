import { Module } from '@nestjs/common';
import { PollinationsService } from './pollinations.service';

@Module({
  providers: [PollinationsService],
  exports: [PollinationsService],
})
export class PollinationsModule {}
