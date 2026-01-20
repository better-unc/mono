import { formatDistanceToNow as fnsFormatDistanceToNow, format as fnsFormat } from "date-fns";

export function timeAgo(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return fnsFormatDistanceToNow(d, { addSuffix: true });
}

export function formatDate(date: Date | string | number, formatStr: string = "MMMM yyyy"): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return fnsFormat(d, formatStr);
}
