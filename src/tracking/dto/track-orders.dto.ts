import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class TrackOrdersDto {
  @ApiProperty({ example: '08012345678' })
  @IsString()
  @Matches(/[0-9]{10,}/, { message: 'phone must be a valid phone number' })
  phone!: string;
}
