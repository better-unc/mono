import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPublicServerUrl = () => {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`;
  } else {
    return `http://localhost:3000`;
  }
};

export const getGitUrl = () => {
  if (process.env.NEXT_PUBLIC_GIT_URL) {
    return process.env.NEXT_PUBLIC_GIT_URL;
  }
  const baseUrl = getPublicServerUrl();
  return `${baseUrl}/api/git`;
};
