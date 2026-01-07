import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizeUrl = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

export const getPublicServerUrl = () => {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  if (import.meta.env.VITE_RAILWAY_PUBLIC_DOMAIN) {
    return `https://${import.meta.env.VITE_RAILWAY_PUBLIC_DOMAIN}`;
  }
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
