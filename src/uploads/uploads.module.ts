import { Module } from '@nestjs/common';

import { FILE_STORAGE } from './file-storage';
import { SupabaseStorageService } from './supabase-storage.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    SupabaseStorageService,
    { provide: FILE_STORAGE, useExisting: SupabaseStorageService },
  ],
})
export class UploadsModule {}
