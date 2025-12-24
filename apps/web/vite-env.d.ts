/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VERCEL_ENV?: string
  readonly VITE_VERCEL_PROJECT_PRODUCTION_URL?: string
  readonly VITE_VERCEL_BRANCH_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

