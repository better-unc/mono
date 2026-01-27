import { normalizeUrl } from '@gitbruv/lib';

const baseOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://10.0.2.2:3001',
  'exp://localhost:8081',
  'exp://192.168.*.*:8081',
];

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL,
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'https://storage.railway.app',
    region: process.env.S3_REGION || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    bucket: process.env.S3_BUCKET!,
  },
  betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
  nodeEnv: process.env.RAILWAY_ENVIRONMENT_NAME || 'development',
  apiUrl: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3001',
  webUrl: process.env.WEB_URL || 'localhost:3000',
  expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL!,
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromAddress: process.env.EMAIL_FROM || 'GitBruv <noreply@gitbruv.dev>',
  },
};

export const getApiUrl = (): string => {
  if (config.apiUrl) {
    return normalizeUrl(config.apiUrl);
  }

  if (config.nodeEnv === 'production') {
    throw new Error('API_URL must be set in production');
  }

  return `http://localhost:${config.port}`;
};

export const getWebUrl = (): string => {
  if (config.webUrl) {
    return normalizeUrl(config.webUrl);
  }

  if (config.nodeEnv === 'production') {
    throw new Error('WEB_URL must be set in production');
  }

  return 'http://localhost:3000';
};

export const getTrustedOrigins = (): string[] => {
  const origins: string[] = [...baseOrigins, 'exp://*'];

  if (config.apiUrl) {
    origins.push(normalizeUrl(config.apiUrl));
  }

  if (config.webUrl) {
    origins.push(normalizeUrl(config.webUrl));
  }

  if (config.expoPublicApiUrl) {
    origins.push(normalizeUrl(config.expoPublicApiUrl));
  }

  return origins;
};

export const getAllowedOrigins = (): string[] => {
  const allowedOrigins = [...baseOrigins];

  if (config.apiUrl) {
    allowedOrigins.push(normalizeUrl(config.apiUrl));
  }

  if (config.webUrl) {
    allowedOrigins.push(normalizeUrl(config.webUrl));
  }

  if (config.expoPublicApiUrl) {
    allowedOrigins.push(normalizeUrl(config.expoPublicApiUrl));
  }

  return allowedOrigins;
};
