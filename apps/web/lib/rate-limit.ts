import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60000);

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 60,
  windowMs: 60 * 1000,
};

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

export function rateLimit(
  request: NextRequest,
  identifier?: string,
  config: Partial<RateLimitConfig> = {}
): { success: boolean; remaining: number; resetAt: number } {
  const { limit, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const ip = getClientIp(request);
  const key = identifier ? `${ip}:${identifier}` : ip;
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function withRateLimit(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  config: Partial<RateLimitConfig> & { identifier?: string } = {}
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    const { identifier, ...rateLimitConfig } = config;
    const result = rateLimit(request, identifier, rateLimitConfig);

    if (!result.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
          "X-RateLimit-Limit": (rateLimitConfig.limit || DEFAULT_CONFIG.limit).toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetAt.toString(),
        },
      });
    }

    const response = await handler(request, context);

    response.headers.set("X-RateLimit-Limit", (rateLimitConfig.limit || DEFAULT_CONFIG.limit).toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.resetAt.toString());

    return response;
  };
}

