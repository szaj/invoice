import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  StorageObject,
  StorageObjectPutInput,
  StorageService,
} from "@/server/storage/storage-service";

function assertSafeKey(key: string): void {
  if (
    key.length === 0 ||
    key.includes("\0") ||
    key.includes("..") ||
    path.isAbsolute(key) ||
    key.startsWith("/") ||
    key.startsWith("\\")
  ) {
    throw new Error("Invalid storage object key");
  }
}

/**
 * Local filesystem adapter for APP_ENV=local when R2 is not configured.
 * Production/staging must use the S3-compatible adapter (Cloudflare R2).
 */
export class LocalDiskStorageService implements StorageService {
  constructor(private readonly rootDirectory: string) {}

  private resolvePath(key: string): string {
    assertSafeKey(key);
    const resolvedRoot = path.resolve(this.rootDirectory);
    const fullPath = path.resolve(resolvedRoot, key);
    if (fullPath !== resolvedRoot && !fullPath.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error("Invalid storage object key");
    }
    return fullPath;
  }

  async putObject(input: StorageObjectPutInput): Promise<void> {
    const fullPath = this.resolvePath(input.key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    await writeFile(`${fullPath}.meta.json`, JSON.stringify({ contentType: input.contentType }));
  }

  async getObject(key: string): Promise<StorageObject | null> {
    const fullPath = this.resolvePath(key);
    try {
      const body = await readFile(fullPath);
      const metaRaw = await readFile(`${fullPath}.meta.json`, "utf8");
      const meta = JSON.parse(metaRaw) as { contentType?: string };
      return {
        key,
        body: new Uint8Array(body),
        contentType: meta.contentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.resolvePath(key);
    try {
      await unlink(fullPath);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
    try {
      await unlink(`${fullPath}.meta.json`);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
}
