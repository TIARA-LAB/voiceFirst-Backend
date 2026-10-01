import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { StorageError } from '../common/errors/domain-errors';
import { StorageProvider, StoredObject } from './storage.interface';

/**
 * Supabase (private) bucket storage. Uses the service-role key on the backend only —
 * it is never exposed to the browser. Objects are private; signed URLs are temporary.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';

  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  private assertBucket() {
    // Bucket is expected to be created in the Supabase dashboard as private.
  }

  async upload(content: Buffer, key: string, mimeType: string): Promise<StoredObject> {
    const { error } = await this.client.storage.from(this.bucket).upload(key, content, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      throw new StorageError(`Supabase upload failed: ${error.message}`, { key });
    }
    return { key, bucket: this.bucket, mimeType, sizeBytes: content.byteLength };
  }

  async getBytes(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) {
      throw new StorageError(`Supabase download failed: ${error?.message ?? 'empty'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, expiresInSeconds);
    if (error || !data) {
      throw new StorageError(`Supabase signed URL failed: ${error?.message ?? 'empty'}`);
    }
    return data.signedUrl;
  }

  async delete(key: string): Promise<void> {
    await this.client.storage.from(this.bucket).remove([key]);
  }

  static newObjectKey(fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  }
}