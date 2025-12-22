import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>
      <div className="flex gap-8">
        <aside className="w-48 shrink-0">
          <SettingsNav />
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

