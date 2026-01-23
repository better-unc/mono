import { createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";

export const Route = createFileRoute("/api/avatar/$" as any)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return redirectAvatarRequest(request);
      },
      HEAD: async ({ request }) => {
        return redirectAvatarRequest(request);
      },
      OPTIONS: async ({ request }) => {
        return redirectAvatarRequest(request);
      },
    },
  },
});

async function redirectAvatarRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    const errorMsg = `API URL not configured. process.env.API_URL: ${process.env.API_URL}, NODE_ENV: ${process.env.NODE_ENV}`;
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

  const backendUrl = `${apiUrl}${path}`;

  return Response.redirect(backendUrl, 307);
}
