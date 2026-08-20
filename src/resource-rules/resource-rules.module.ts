import { Module } from '@nestjs/common';
import { ResourceRulesService } from './resource-rules.service';
import { ResourceRulesController } from './resource-rules.controller';

@Module({
  controllers: [ResourceRulesController],
  providers: [ResourceRulesService],
})
export class ResourceRulesModule {}
