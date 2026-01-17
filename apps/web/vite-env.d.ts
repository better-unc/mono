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
      readonly RAILWAY_PUBLIC_DOMAIN?: string;
      readonly API_URL?: string;
      readonly NODE_ENV: "development" | "production" | "test";
    }
  }
}

export {};
