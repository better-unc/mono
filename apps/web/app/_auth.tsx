import { createFileRoute, Outlet, Link } from '@tanstack/react-router';
import { GitBranchIcon } from '@hugeicons-pro/core-stroke-standard';
import { HugeiconsIcon } from '@hugeicons/react';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">
        <Link to="/" className="group mb-10 flex items-center gap-3">
          <div className="relative">
            <HugeiconsIcon
              icon={GitBranchIcon}
              strokeWidth={2}
              className="text-foreground size-10 transition-transform group-hover:scale-110"
            />
          </div>
          <span className="text-2xl font-bold tracking-tight">gitbruv</span>
        </Link>
        <Outlet />
      </div>
    </div>
  );
}
