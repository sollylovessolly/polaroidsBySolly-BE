import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class CreateDeliveryRateDto {
  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @Matches(/\S/, { message: 'state must not be empty' })
  state!: string;

  @ApiProperty({ example: 3800, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  fee!: number;
}
