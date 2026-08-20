import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateAdminNoteDto {
  @ApiProperty({ example: 'Customer requested Friday delivery' })
  @IsString()
  adminNote!: string;
}
