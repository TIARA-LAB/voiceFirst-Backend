import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { StorageError } from '../common/errors/domain-errors';
import { StorageProvider, StoredObject } from './storage.interface';

/**
 * Local filesystem storage for development. Configured via STORAGE_LOCAL_DIR.
 * Files live outside the web root and are only reachable via the backend.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const normalized = key.replace(/[\\/]/g, '/').replace(/^\/+/, '');
    return join(this.baseDir, normalized);
  }

  async upload(content: Buffer, key: string, mimeType: string): Promise<StoredObject> {
    const target = this.resolve(key);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    const sizeBytes = content.byteLength;
    return { key, bucket: null, mimeType, sizeBytes };
  }

  async getBytes(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      throw new StorageError('Audio object not found in local storage', { key });
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return join(this.baseDir, key);
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // best-effort cleanup
    }
  }
}