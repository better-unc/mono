import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_main/$username/$repo")({
  component: RepoLayout,
})

function RepoLayout() {
  return <Outlet />
}
