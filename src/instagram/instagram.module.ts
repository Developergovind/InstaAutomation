import { Module, forwardRef } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';

@Module({
  imports: [forwardRef(() => SchedulerModule)],
  controllers: [InstagramController],
  providers: [InstagramService],
  exports: [InstagramService],
})
export class InstagramModule {}
