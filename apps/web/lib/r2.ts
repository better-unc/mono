import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "gitbruv-repos";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function r2Get(key: string): Promise<Buffer | null> {
  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === "NoSuchKey") return null;
    throw err;
  }
}

const BATCH_CONCURRENCY = 20;

export async function r2GetBatch(keys: string[]): Promise<Map<string, Buffer | null>> {
  const results = new Map<string, Buffer | null>();

  for (let i = 0; i < keys.length; i += BATCH_CONCURRENCY) {
    const batch = keys.slice(i, i + BATCH_CONCURRENCY);
    const promises = batch.map(async (key) => {
      const data = await r2Get(key);
      return { key, data };
    });

    const batchResults = await Promise.all(promises);
    for (const { key, data } of batchResults) {
      results.set(key, data);
    }
  }

  return results;
}

export async function r2Put(key: string, data: Buffer | Uint8Array | string): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: data instanceof Buffer ? data : Buffer.from(data),
    })
  );
}

export async function r2PutBatch(items: Array<{ key: string; data: Buffer | Uint8Array | string }>): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_CONCURRENCY) {
    const batch = items.slice(i, i + BATCH_CONCURRENCY);
    await Promise.all(batch.map(({ key, data }) => r2Put(key, data)));
  }
}

export async function r2Delete(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export async function r2Head(key: string): Promise<{ exists: boolean; size?: number }> {
  try {
    const response = await r2Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return { exists: true, size: response.ContentLength };
  } catch {
    return { exists: false };
  }
}

export async function r2Exists(key: string): Promise<boolean> {
  const result = await r2Head(key);
  return result.exists;
}

export async function r2List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

export async function r2DeletePrefix(prefix: string): Promise<void> {
  const keys = await r2List(prefix);

  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    if (batch.length === 0) continue;

    await r2Client.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }
}
