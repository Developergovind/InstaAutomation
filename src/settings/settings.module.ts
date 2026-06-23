import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { Setting } from './entities/setting.entity';
import { SettingsController } from './settings.controller';
import { DynamicConfigService } from './settings.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    forwardRef(() => SchedulerModule),
  ],
  controllers: [SettingsController],
  providers: [DynamicConfigService],
  exports: [DynamicConfigService],
})
export class SettingsModule {}
