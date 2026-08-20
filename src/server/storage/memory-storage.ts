import type {
  StorageObject,
  StorageObjectPutInput,
  StorageService,
} from "@/server/storage/storage-service";

/**
 * In-memory adapter for unit/integration tests. Not for production.
 */
export class MemoryStorageService implements StorageService {
  private readonly objects = new Map<string, StorageObject>();

  async putObject(input: StorageObjectPutInput): Promise<void> {
    this.objects.set(input.key, {
      key: input.key,
      body: Uint8Array.from(input.body),
      contentType: input.contentType,
    });
  }

  async getObject(key: string): Promise<StorageObject | null> {
    const found = this.objects.get(key);
    if (!found) {
      return null;
    }
    return {
      key: found.key,
      body: Uint8Array.from(found.body),
      contentType: found.contentType,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
