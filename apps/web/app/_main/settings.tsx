import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useSession } from "@/lib/auth-client"
import { SettingsNav } from "@/components/settings/settings-nav"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"

export const Route = createFileRoute("/_main/settings")({
  component: SettingsLayout,
})

function SettingsLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate({ to: "/login" })
    }
  }, [isPending, session, navigate])

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>
      <div className="flex gap-8">
        <aside className="w-48 shrink-0">
          <SettingsNav />
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

