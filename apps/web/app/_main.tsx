import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { QueryProvider } from "@/lib/query-client";

export const Route = createFileRoute("/_main")({
  component: MainLayout,
});

function MainLayout() {
  return (
    <QueryProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </QueryProvider>
  );
}
