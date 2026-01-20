import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@gitbruv/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
      PUT: ({ request }: { request: Request }) => auth.handler(request),
      PATCH: ({ request }: { request: Request }) => auth.handler(request),
      DELETE: ({ request }: { request: Request }) => auth.handler(request),
      OPTIONS: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
});
