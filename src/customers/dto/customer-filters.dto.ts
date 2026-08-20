import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
export class CustomerFiltersDto extends PaginationDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  archived?: boolean;
}
