import { PartialType } from '@nestjs/swagger';

import { CreateResourceRuleDto } from './create-resource-rule.dto';

export class UpdateResourceRuleDto extends PartialType(CreateResourceRuleDto) {}
