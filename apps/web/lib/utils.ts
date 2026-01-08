import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizeUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  if (url.includes("localhost") || url.startsWith("127.0.0.1") || url.startsWith("::1")) {
    return `http://${url}`;
  }
  return `https://${url}`;
};

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

export const getGitUrl = () => {
  const workerUrl = getApiUrl();
  if (workerUrl) {
    return workerUrl;
  }
  const baseUrl = getPublicServerUrl();
  return `${baseUrl}/api/git`;
};
