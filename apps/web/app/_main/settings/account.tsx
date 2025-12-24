import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCurrentUser } from "@/lib/hooks/use-settings"
import { EmailForm } from "@/components/settings/email-form"
import { PasswordForm } from "@/components/settings/password-form"
import { DeleteAccount } from "@/components/settings/delete-account"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"

export const Route = createFileRoute("/_main/settings/account")({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const navigate = useNavigate()
  const { data: user, isLoading, error } = useCurrentUser()

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      navigate({ to: "/login" })
    }
  }, [isLoading, error, user, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>
            Change the email associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm currentEmail={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount username={user.username} />
        </CardContent>
      </Card>
    </div>
  )
}

