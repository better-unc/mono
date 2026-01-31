import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_main/$username')({
  component: UsernameLayout,
});

function UsernameLayout() {
  return <Outlet />;
}
