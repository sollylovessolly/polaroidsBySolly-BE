import { PartialType } from '@nestjs/swagger';
import { CreateOwnerWithdrawalDto } from './create-owner-withdrawal.dto';
export class UpdateOwnerWithdrawalDto extends PartialType(
  CreateOwnerWithdrawalDto,
) {}
