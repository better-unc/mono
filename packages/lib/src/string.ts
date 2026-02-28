import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function getCommitTitle(message: string): string {
  return message.split("\n")[0] || message;
}

export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export const normalizeUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  if (url.includes("localhost") || url.startsWith("127.0.0.1") || url.startsWith("::1")) {
    return `http://${url}`;
  }
  return `https://${url}`;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}