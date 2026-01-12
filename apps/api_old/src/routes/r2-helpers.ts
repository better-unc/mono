import { s3DeletePrefix, type S3Config } from "../r2-fs";

export async function r2DeletePrefix(s3: S3Config, prefix: string): Promise<void> {
  return s3DeletePrefix(s3, prefix);
}
