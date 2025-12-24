import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"

export const Route = createFileRoute("/api/auth/$")({
  // @ts-expect-error - server handlers are a TanStack Start feature
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
})

