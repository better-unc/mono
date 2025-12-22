import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GitBranch, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-destructive/10 via-transparent to-transparent" />
      <div className="relative text-center">
        <GitBranch className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-7xl font-bold text-foreground mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
        <Button asChild>
          <Link href="/" className="gap-2">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
