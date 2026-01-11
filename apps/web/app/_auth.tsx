import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-accent/15 via-background to-background" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/5 blur-[100px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center w-full max-w-[400px]">
        <Link to="/" className="flex items-center gap-3 mb-10 group">
          <div className="relative">
            <GitBranch className="w-10 h-10 text-foreground transition-transform group-hover:scale-110" />
          </div>
          <span className="text-2xl font-bold tracking-tight">gitbruv</span>
        </Link>
        <Outlet />
      </div>
    </div>
  );
}
