import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/api/auth/verify-credentials" as any)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiUrl = getApiUrl();
        if (!apiUrl) {
          return new Response(JSON.stringify({ error: "API URL not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const backendUrl = `${apiUrl}${url.pathname}`;

        const headers = new Headers();
        request.headers.forEach((value, key) => {
          const lowerKey = key.toLowerCase();
          if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
            headers.set(key, value);
          }
        });

        const body = await request.arrayBuffer();

        try {
          const response = await fetch(backendUrl, {
            method: "POST",
            headers,
            body,
            credentials: "include",
          });

          const responseHeaders = new Headers();
          const headersToSkip = ["content-encoding", "transfer-encoding", "content-length", "connection"];
          response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!headersToSkip.includes(lowerKey)) {
              responseHeaders.set(key, value);
            }
          });

          const responseBody = await response.arrayBuffer();

          return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
          });
        } catch (error) {
          console.error(`[Auth Proxy] Error proxying verify-credentials:`, error);
          return new Response(
            JSON.stringify({
              error: "Failed to proxy verify-credentials request",
              message: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
