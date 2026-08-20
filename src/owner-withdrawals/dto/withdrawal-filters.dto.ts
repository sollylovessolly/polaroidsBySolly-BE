import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
export class WithdrawalFiltersDto extends PaginationDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}
