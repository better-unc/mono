import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { NewRepoForm } from "./form";

export default async function NewRepoPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const username = (session.user as { username?: string }).username || "";

  return <NewRepoForm username={username} />;
}
