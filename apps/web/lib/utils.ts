import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getPublicServerUrl = () => {
  if (import.meta.env.VITE_VERCEL_ENV === "production") {
    return `https://${import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL}`
  } else if (import.meta.env.VITE_VERCEL_ENV === "preview") {
    return `https://${import.meta.env.VITE_VERCEL_BRANCH_URL}`
  } else {
    return `http://localhost:3000`
  }
}

export const getWorkerUrl = () => {
  if (import.meta.env.VITE_VERCEL_ENV === "production") {
    return `https://${import.meta.env.VITE_API_URL}`
  } else if (import.meta.env.VITE_VERCEL_ENV === "preview") {
    return `https://${import.meta.env.VITE_API_URL}`
  } else {
    return `http://localhost:8787`
  }
}

export const getGitUrl = () => {
  const workerUrl = getWorkerUrl()
  if (workerUrl) {
    return workerUrl
  }
  const baseUrl = getPublicServerUrl()
  return `${baseUrl}/api/git`
}
