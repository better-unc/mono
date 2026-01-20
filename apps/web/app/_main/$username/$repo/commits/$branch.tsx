import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/$username/$repo/commits/$branch")({
  component: BranchLayout,
});

function BranchLayout() {
  return <Outlet />;
}
