export interface Env {
  DATABASE_URL: string;
  AWS_ENDPOINT_URL: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_BUCKET_NAME: string;
  PORT?: string;
}

export function getEnv(): Env {
  const required = ["DATABASE_URL", "AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_BUCKET_NAME"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME!,
    PORT: process.env.PORT,
  };
}
