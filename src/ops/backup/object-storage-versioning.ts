import { GetBucketVersioningCommand, S3Client } from "@aws-sdk/client-s3";

export type ObjectStorageVersioningConfig = {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

export async function getObjectStorageVersioningEnabled(
  config: ObjectStorageVersioningConfig,
): Promise<boolean | null> {
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  try {
    const response = await client.send(
      new GetBucketVersioningCommand({
        Bucket: config.bucket,
      }),
    );
    return response.Status === "Enabled";
  } catch {
    return null;
  } finally {
    client.destroy();
  }
}
