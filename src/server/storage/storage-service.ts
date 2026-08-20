export type StorageObjectPutInput = {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
};

export type StorageObject = {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
};

/**
 * ADR-006 object storage boundary. Domain/branding code must not call
 * Cloudflare-specific APIs; adapters implement the provider details.
 */
export interface StorageService {
  putObject(input: StorageObjectPutInput): Promise<void>;
  getObject(key: string): Promise<StorageObject | null>;
  deleteObject(key: string): Promise<void>;
}
