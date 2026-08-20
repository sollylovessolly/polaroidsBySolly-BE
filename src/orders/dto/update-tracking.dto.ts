import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class UpdateTrackingDto {
  @ApiProperty({ example: 'https://tracking.example/PBS-123' })
  @IsUrl({ require_protocol: true })
  trackingLink!: string;
}
