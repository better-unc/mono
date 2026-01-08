import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/api/$" as any)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        if (params._splat?.startsWith("avatar/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
      POST: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
      PUT: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
      PATCH: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
      DELETE: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
      OPTIONS: async ({ request, params }) => {
        if (params._splat?.startsWith("auth/")) {
          return new Response("Not Found", { status: 404 });
        }
        return proxyRequest(request);
      },
    },
  },
});

async function proxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith("/api/auth")) {
    return new Response("Not Found", { status: 404 });
  }

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    const errorMsg = `API URL not configured. process.env.API_URL: ${process.env.API_URL}, NODE_ENV: ${process.env.NODE_ENV}`;
    console.error(`[Proxy] ${errorMsg}`);
    return new Response(
      JSON.stringify({
        error: "API URL not configured",
        message: "API_URL environment variable is not set in production",
        details: errorMsg,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const routesWithoutApiPrefix = ["/health", "/avatar/", "/file/"];
  const shouldRemoveApiPrefix = routesWithoutApiPrefix.some((route) => path.startsWith(`/api${route}`));

  const backendPath = shouldRemoveApiPrefix ? path.replace(/^\/api/, "") : path;
  const backendUrl = `${apiUrl}${backendPath}${url.search}`;
  console.log(`[Proxy] ${request.method} ${path} -> ${backendUrl}`);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
      headers.set(key, value);
    }
  });

  const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[Proxy] ${request.method} ${path} -> ${response.status} ${response.statusText} (from ${backendUrl})`);

    const responseHeaders = new Headers();
    const headersToSkip = ["content-encoding", "transfer-encoding", "content-length", "connection"];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!headersToSkip.includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await response.arrayBuffer();

    if (responseBody.byteLength > 0) {
      responseHeaders.set("Content-Length", responseBody.byteLength.toString());
    } else if (response.status === 200 && responseBody.byteLength === 0) {
      console.warn(`[Proxy] Empty response body for ${path} from ${backendUrl}`);
    }

    if (!response.ok) {
      const errorText = new TextDecoder().decode(responseBody);
      console.error(`[Proxy] Backend returned error for ${path}:`, response.status, errorText.substring(0, 200));
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Proxy] Fetch error for ${request.method} ${path} -> ${backendUrl}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            cause: error.cause,
            stack: error.stack?.split("\n").slice(0, 3).join("\n"),
          }
        : {};

    return new Response(
      JSON.stringify({
        error: "Failed to proxy request",
        message: errorMessage,
        backendUrl,
        path,
        details: errorDetails,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
