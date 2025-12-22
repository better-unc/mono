/// <reference types="@cloudflare/workers-types" />

export interface Env {
  REPO_BUCKET: R2Bucket;
  DB: Hyperdrive;
}
