import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { StorageError } from '../common/errors/domain-errors';
import { StorageProvider, StoredObject } from './storage.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { SupabaseStorageProvider } from './supabase-storage.provider';

@Injectable()
export class StorageService {
  private readonly provider: StorageProvider;

  constructor(private readonly config: AppConfig) {
    if (config.storage.provider === 'supabase') {
      if (!config.storage.supabaseUrl || !config.storage.supabaseServiceRoleKey) {
        throw new StorageError('Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      }
      this.provider = new SupabaseStorageProvider(
        config.storage.supabaseUrl,
        config.storage.supabaseServiceRoleKey,
        config.storage.supabaseBucket,
      );
    } else {
      this.provider = new LocalStorageProvider(config.storage.localDir);
    }
  }

  upload(content: Buffer, key: string, mimeType: string): Promise<StoredObject> {
    return this.provider.upload(content, key, mimeType);
  }

  getBytes(key: string): Promise<Buffer> {
    return this.provider.getBytes(key);
  }

  getProviderName(): string {
    return this.provider.name;
  }

  getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.provider.getSignedUrl(key, expiresInSeconds);
  }

  delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }
}