import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileStorage } from './file-storage';
import { UploadPurpose } from './upload-purpose';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const upload = jest.fn().mockResolvedValue({
    key: 'production/file.png',
  });
  const storage = {
    upload,
    download: jest.fn(),
    delete: jest.fn(),
  } as unknown as FileStorage;
  const config = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  } as unknown as ConfigService;
  const service = new UploadsService(storage, config);

  beforeEach(() => jest.clearAllMocks());

  it('uploads valid PNG, preview JPEG/WEBP, and PDF files', async () => {
    const files = [
      {
        purpose: UploadPurpose.POLAROID_FINAL,
        mimetype: 'image/png',
        buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
      },
      {
        purpose: UploadPurpose.POLAROID_PREVIEW,
        mimetype: 'image/jpeg',
        buffer: Buffer.from('ffd8ff', 'hex'),
      },
      {
        purpose: UploadPurpose.POLAROID_PREVIEW,
        mimetype: 'image/webp',
        buffer: Buffer.concat([Buffer.from('RIFF0000WEBP'), Buffer.alloc(2)]),
      },
      {
        purpose: UploadPurpose.VINTAGE_LETTER_FINAL,
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
      },
    ];

    for (const file of files) {
      await service.upload(
        {
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.buffer.length,
        },
        file.purpose,
      );
    }
    expect(upload).toHaveBeenCalledTimes(4);
  });

  it('rejects invalid MIME/signatures and oversized files', async () => {
    await expect(
      service.upload(
        { buffer: Buffer.from('hello'), mimetype: 'text/plain', size: 5 },
        UploadPurpose.POLAROID_FINAL,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upload(
        {
          buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
          mimetype: 'image/png',
          size: 16_000_000,
        },
        UploadPurpose.POLAROID_FINAL,
      ),
    ).rejects.toThrow('File exceeds');
  });

  it('propagates provider failure without returning a fake URL', async () => {
    upload.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(
      service.upload(
        {
          buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
          mimetype: 'image/png',
          size: 8,
        },
        UploadPurpose.PHOTOSTRIP_FINAL,
      ),
    ).rejects.toThrow('provider unavailable');
  });
});
