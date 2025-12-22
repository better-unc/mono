import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/settings";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { SocialLinksForm } from "@/components/settings/social-links-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a picture to personalize your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload currentAvatar={user.avatarUrl} name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details visible to other users</CardDescription>
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
  );
}
