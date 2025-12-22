import { Header } from "@/components/header";
import { QueryProvider } from "@/lib/query-client";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </QueryProvider>
  );
}
