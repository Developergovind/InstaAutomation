import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourcesModule } from '../sources/sources.module';
import { Trend } from './entities/trend.entity';
import { TrendsController } from './trends.controller';
import { TrendsService } from './trends.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trend]),
    forwardRef(() => SourcesModule),
  ],
  controllers: [TrendsController],
  providers: [TrendsService],
  exports: [TrendsService],
})
export class TrendsModule {}
