import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateDeliveryCostDto {
  @ApiProperty({ example: 3500, minimum: 0 })
  @IsNumber()
  @Min(0)
  actualDeliveryCost!: number;
}
