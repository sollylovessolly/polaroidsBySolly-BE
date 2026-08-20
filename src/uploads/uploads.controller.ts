import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UploadFileDto } from './dto/upload-file.dto';
import { UploadedFileData, UploadsService } from './uploads.service';
import { Public } from '../auth/public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

@Public()
@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @RateLimit('UPLOAD_RATE_LIMIT_PER_MINUTE', 10)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20_000_000 } }),
  )
  @ApiOperation({ summary: 'Upload a validated production file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: {
          type: 'string',
          enum: [
            'POLAROID_FINAL',
            'POLAROID_PREVIEW',
            'PHOTOSTRIP_FINAL',
            'VINTAGE_LETTER_FINAL',
          ],
        },
      },
    },
  })
  upload(
    @UploadedFile() file: UploadedFileData | undefined,
    @Body() dto: UploadFileDto,
  ) {
    return this.uploads.upload(file, dto.purpose);
  }

  @Get('files/:token')
  @ApiOperation({
    summary: 'Download a production file by unguessable file token',
  })
  async download(@Param('token') token: string) {
    const file = await this.uploads.download(token);
    return new StreamableFile(file.body, { type: file.contentType });
  }
}
