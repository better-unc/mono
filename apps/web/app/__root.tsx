import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router"
import { Toaster } from "@/components/ui/sonner"
import { Analytics } from "@vercel/analytics/react"
import { Button } from "@/components/ui/button"
import { GitBranch, Home } from "lucide-react"
import appCss from "./globals.css?url"

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent" />
      <div className="relative text-center">
        <GitBranch className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-7xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          The page you're looking for doesn't exist or you don't have permission
          to view it.
        </p>
        <Button asChild>
          <Link to="/" className="gap-2">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
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
})

function RootLayout() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        <Outlet />
        <Toaster richColors position="top-right" />
        <Analytics />
        <Scripts />
      </body>
    </html>
  )
}

