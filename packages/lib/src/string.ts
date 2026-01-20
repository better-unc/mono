export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function getCommitTitle(message: string): string {
  return message.split("\n")[0] || message;
}

export function truncate(str: string, maxLength: number, suffix: string = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
