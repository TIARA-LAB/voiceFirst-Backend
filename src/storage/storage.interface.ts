export interface StoredObject {
  key: string;
  bucket: string | null;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageProvider {
  readonly name: string;
  upload(content: Buffer, key: string, mimeType: string): Promise<StoredObject>;
  getBytes(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}