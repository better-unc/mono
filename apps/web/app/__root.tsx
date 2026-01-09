import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Databuddy } from "@databuddy/sdk/react";
import { Button } from "@/components/ui/button";
import { GitBranch, Home } from "lucide-react";
import appCss from "./globals.css?url";
import { getApiUrl } from "@/lib/utils";
import { ThemeProvider } from "tanstack-theme-kit";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";

async function handleGitRequest(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Check if this is a git operation (matches /:username/:repo.git/...)
  const gitPattern = /^\/[^/]+\/[^/]+\.git\//;
  if (!gitPattern.test(path)) {
    return undefined; // Let other routes handle it
  }

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return new Response(JSON.stringify({ error: "API URL not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Proxy git requests directly to backend
  const backendUrl = `${apiUrl}${path}${url.search}`;
  console.log(`[Git Proxy] ${request.method} ${path} -> ${backendUrl}`);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "host" && lowerKey !== "connection" && lowerKey !== "content-length") {
      headers.set(key, value);
    }
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const body = request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Preserve all headers for git operations
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    const responseBody = await response.arrayBuffer();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Git Proxy] Error for ${path}:`, error);
    return new Response(JSON.stringify({ error: "Failed to proxy git request", message: error instanceof Error ? error.message : "Unknown error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent" />
      <div className="relative text-center">
        <GitBranch className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-7xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
        <Button
          render={() => (
            <Link to="/" className="gap-2">
              <Home className="h-4 w-4" />
              Go home
            </Link>
          )}
        />
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handleGitRequest(request);
      },
      POST: async ({ request }) => {
        return handleGitRequest(request);
      },
      OPTIONS: async ({ request }) => {
        return handleGitRequest(request);
      },
    },
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "gitbruv" },
      { name: "description", content: "Where code lives" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <NuqsAdapter>
            <Outlet />
            <Toaster richColors position="top-right" />
            <Databuddy
              clientId="f2d7ca37-ab52-4782-be5a-f88b59c8bac2"
              trackErrors
              trackPerformance
              trackWebVitals
              trackAttributes
              trackHashChanges
              trackOutgoingLinks
            />
          </NuqsAdapter>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
