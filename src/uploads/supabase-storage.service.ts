import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileStorage } from './file-storage';

@Injectable()
export class SupabaseStorageService implements FileStorage {
  constructor(private readonly config: ConfigService) {}

  async upload(input: { key: string; contentType: string; body: Buffer }) {
    const { url, key, bucket } = this.configuration();
    let response: Response;
    try {
      response = await fetch(
        `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${this.encodeKey(input.key)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            'Content-Type': input.contentType,
            'x-upsert': 'false',
          },
          body: new Uint8Array(input.body),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'File storage is currently unavailable',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException('File storage upload failed');
    }

    return { key: input.key };
  }

  async download(objectKey: string) {
    const { url, key, bucket } = this.configuration();
    const response = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${this.encodeKey(objectKey)}`,
      { headers: { Authorization: `Bearer ${key}`, apikey: key } },
    );
    if (!response.ok)
      throw new BadGatewayException('File storage download failed');
    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async delete(objectKey: string) {
    const { url, key, bucket } = this.configuration();
    const response = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(bucket)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [objectKey] }),
      },
    );
    if (!response.ok)
      throw new BadGatewayException('File storage deletion failed');
  }

  private configuration() {
    const url = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>(
      'SUPABASE_STORAGE_BUCKET',
      'production-files',
    );
    if (!url || !key) {
      throw new ServiceUnavailableException('File storage is not configured');
    }
    return { url, key, bucket };
  }

  private encodeKey(key: string) {
    return key.split('/').map(encodeURIComponent).join('/');
  }
}
