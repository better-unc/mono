import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCurrentUser } from "@/lib/hooks/use-settings"
import { ProfileForm } from "@/components/settings/profile-form"
import { AvatarUpload } from "@/components/settings/avatar-upload"
import { SocialLinksForm } from "@/components/settings/social-links-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"

export const Route = createFileRoute("/_main/settings/")({
  component: SettingsPage,
})

function SettingsPage() {
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
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload a picture to personalize your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload currentAvatar={user.avatarUrl} name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your profile details visible to other users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            user={{
              name: user.name,
              username: user.username,
              bio: user.bio,
              location: user.location,
              website: user.website,
              pronouns: user.pronouns,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Add links to your social profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialLinksForm socialLinks={user.socialLinks} />
        </CardContent>
      </Card>
    </div>
  )
}

