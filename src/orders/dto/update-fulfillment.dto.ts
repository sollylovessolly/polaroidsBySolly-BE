import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateFulfillmentDto {
  @ApiProperty({
    example: {
      finalPngUrl: 'https://storage.example/final.png',
      previewUrl: 'https://storage.example/preview.png',
    },
  })
  @IsObject()
  customization!: Record<string, unknown>;
}
