import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({ example: 'cm123orderid' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
