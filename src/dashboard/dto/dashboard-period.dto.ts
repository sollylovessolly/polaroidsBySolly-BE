import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';
export class DashboardPeriodDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}
export class DashboardYearDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
}
