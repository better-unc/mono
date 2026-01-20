import { normalizeUrl } from "@gitbruv/lib";
export { cn } from "@gitbruv/lib";

export const getPublicServerUrl = () => {
  const isServer = typeof window === "undefined";

  if (isServer) {
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return normalizeUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
    }
    return undefined;
  }

  if (import.meta.env.VITE_RAILWAY_PUBLIC_DOMAIN) {
    return normalizeUrl(import.meta.env.VITE_RAILWAY_PUBLIC_DOMAIN);
  }

  if (!import.meta.env.PROD) {
    return "http://localhost:3000";
  }

  return undefined;
};

export const getApiUrl = () => {
  const isServer = typeof window === "undefined";

  if (isServer) {
    if (process.env.API_URL) {
      return normalizeUrl(process.env.API_URL);
    }
    if (process.env.NODE_ENV !== "production") {
      return "http://localhost:3001";
    }
    return undefined;
  }

  if (import.meta.env.VITE_API_URL) {
    return normalizeUrl(import.meta.env.VITE_API_URL);
  }

  if (!import.meta.env.PROD) {
    return "http://localhost:3001";
  }

  return undefined;
};