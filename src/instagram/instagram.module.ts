import { Module, forwardRef } from '@nestjs/common';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { MetaTokenService } from './meta-token.service';

@Module({
  imports: [forwardRef(() => SchedulerModule)],
  controllers: [InstagramController],
  providers: [MetaTokenService, InstagramService],
  exports: [InstagramService, MetaTokenService],
})
export class InstagramModule {}
