/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly VITE_RAILWAY_PUBLIC_DOMAIN?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Server-side environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string;
      readonly CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB: string;
      readonly AWS_ACCESS_KEY_ID: string;
      readonly AWS_SECRET_ACCESS_KEY: string;
      readonly AWS_S3_BUCKET_NAME: string;
      readonly AWS_ENDPOINT_URL: string;
      readonly RAILWAY_PUBLIC_DOMAIN?: string;
      readonly API_URL?: string;
      readonly NODE_ENV: "development" | "production" | "test";
    }
  }
}

export {};
