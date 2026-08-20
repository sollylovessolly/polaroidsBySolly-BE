import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'pbs_test_reference' })
  @IsString()
  @IsNotEmpty()
  reference!: string;
}
