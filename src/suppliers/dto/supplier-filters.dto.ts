import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SupplierFiltersDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  inactive?: boolean;
}
