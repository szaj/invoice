import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type {
  StorageObject,
  StorageObjectPutInput,
  StorageService,
} from "@/server/storage/storage-service";

export type S3CompatibleStorageConfig = {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

/**
 * S3-compatible adapter for Cloudflare R2 (ADR-006).
 * Domain code must depend on StorageService, not this client directly.
 */
export class S3CompatibleStorageService implements StorageService {
  private readonly client: S3Client;

  constructor(private readonly config: S3CompatibleStorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async putObject(input: StorageObjectPutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getObject(key: string): Promise<StorageObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const bytes = result.Body ? new Uint8Array(await result.Body.transformToByteArray()) : null;
      if (!bytes) {
        return null;
      }
      return {
        key,
        body: bytes,
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "NoSuchKey") {
        return null;
      }
      if (
        error &&
        typeof error === "object" &&
        "$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata &&
        "httpStatusCode" in error.$metadata &&
        error.$metadata.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }
}
