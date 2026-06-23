import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { MetaTokenService } from './meta-token.service';

@Module({
  controllers: [InstagramController],
  providers: [MetaTokenService, InstagramService],
  exports: [InstagramService, MetaTokenService],
})
export class InstagramModule {}
