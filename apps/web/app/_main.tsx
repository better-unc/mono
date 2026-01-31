import { createFileRoute, Outlet } from '@tanstack/react-router';
import { QueryProvider } from '@/lib/query-client';
import { Header } from '@/components/header';

export const Route = createFileRoute('/_main')({
  component: MainLayout,
});

function MainLayout() {
  return (
    <QueryProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-14">
          <Outlet />
        </main>
      </div>
    </QueryProvider>
  );
}
