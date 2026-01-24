import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { config } from "./config";

const s3Configured = Boolean(
  config.s3.endpoint && config.s3.region && config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey
);

export const s3Client = s3Configured
  ? new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true,
  })
  : null;

export const bucket = config.s3.bucket;

export const getRepoPrefix = (owner: string, repo: string): string => {
  return `repos/${owner}/${repo}`;
};

export const getObject = async (key: string): Promise<Buffer | null> => {
  if (!s3Client) {
    return null;
  }
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      return null;
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const putObject = async (key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void> => {
  if (!s3Client) {
    throw new Error("S3 is not configured");
  }
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  if (!s3Client) {
    throw new Error("S3 is not configured");
  }
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
};

export const listObjects = async (prefix: string): Promise<string[]> => {
  if (!s3Client) {
    return [];
  }
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
};

export const objectExists = async (key: string): Promise<boolean> => {
  if (!s3Client) {
    return false;
  }
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

export const deletePrefix = async (prefix: string): Promise<void> => {
  if (!s3Client) {
    throw new Error("S3 is not configured");
  }
  const keys = await listObjects(prefix);
  for (const key of keys) {
    await deleteObject(key);
  }
};

export const uploadMultipart = async (
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType?: string
): Promise<void> => {
  if (!s3Client) {
    throw new Error("S3 is not configured");
  }
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });

  await upload.done();
};

export const getObjectStream = async (key: string): Promise<ReadableStream | null> => {
  if (!s3Client) {
    return null;
  }
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      return null;
    }

    return response.Body.transformToWebStream();
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const copyPrefix = async (sourcePrefix: string, targetPrefix: string): Promise<void> => {
  const keys = await listObjects(sourcePrefix);
  const normalizedSource = sourcePrefix.replace(/\/$/, "");
  const normalizedTarget = targetPrefix.replace(/\/$/, "");

  for (const key of keys) {
    const data = await getObject(key);
    if (!data) {
      continue;
    }
    const suffix = key.slice(normalizedSource.length);
    const targetKey = `${normalizedTarget}${suffix}`;
    await putObject(targetKey, data);
  }
};
