import { Outlet, createRootRoute, HeadContent, Scripts, Link } from '@tanstack/react-router';
import { HomeIcon, GitBranchIcon } from '@hugeicons-pro/core-stroke-standard';
import { ThemeProvider } from 'tanstack-theme-kit';
import { Toaster } from '@/components/ui/sonner';
import { Databuddy } from '@databuddy/sdk/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import appCss from './globals.css?url';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="from-destructive/10 absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] via-transparent to-transparent" />
      <div className="relative text-center">
        <HugeiconsIcon
          icon={GitBranchIcon}
          strokeWidth={2}
          className="text-muted-foreground mx-auto mb-6 size-16"
        />
        <h1 className="text-foreground mb-2 text-7xl font-bold">404</h1>
        <h2 className="mb-4 text-2xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to
          view it.
        </p>
        <Button
          render={() => (
            <Link to="/" className="gap-2">
              <HugeiconsIcon icon={HomeIcon} strokeWidth={2} className="size-4" />
              Go home
            </Link>
          )}
        />
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'gitbruv' },
      { name: 'description', content: 'Where code lives' },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
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
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
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
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
