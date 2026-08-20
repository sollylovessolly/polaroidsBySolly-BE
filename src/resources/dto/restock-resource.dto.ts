import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RestockResourceDto {
  @ApiProperty({
    example: 20,
    description: 'Quantity added in the resource base unit',
  })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({
    example: 900,
    description: 'Cost of one resource unit',
  })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({
    example: 'Bought one pack of Instax film',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
