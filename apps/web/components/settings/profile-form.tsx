"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProfile } from "@gitbruv/hooks";
import { Loader2 } from "lucide-react";

interface ProfileFormProps {
  user: {
    name: string;
    username: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    pronouns?: string | null;
    company?: string | null;
    gitEmail?: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const { mutate, isPending } = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);

    mutate(
      {
        name: formData.get("name") as string,
        username: formData.get("username") as string,
        bio: formData.get("bio") as string,
        location: formData.get("location") as string,
        website: formData.get("website") as string,
        pronouns: formData.get("pronouns") as string,
        company: formData.get("company") as string,
        gitEmail: formData.get("gitEmail") as string,
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to update profile");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Display Name</Label>
        <Input id="name" name="name" defaultValue={user.name} placeholder="Your display name" required />
        <p className="text-xs text-muted-foreground">Your name as it appears on your profile</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" defaultValue={user.username} placeholder="username" required pattern="[a-zA-Z0-9_-]+" minLength={3} />
        <p className="text-xs text-muted-foreground">Your unique handle. Letters, numbers, underscores, and hyphens only.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={user.bio || ""} placeholder="Tell us about yourself" maxLength={160} rows={3} />
        <p className="text-xs text-muted-foreground">Brief description for your profile. Max 160 characters.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pronouns">Pronouns</Label>
        <Input id="pronouns" name="pronouns" defaultValue={user.pronouns || ""} placeholder="e.g., they/them, she/her, he/him" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={user.location || ""} placeholder="City, Country" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" type="url" defaultValue={user.website || ""} placeholder="https://yourwebsite.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" defaultValue={user.company || ""} placeholder="Your company or organization" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gitEmail">Git Email</Label>
        <Input id="gitEmail" name="gitEmail" type="email" defaultValue={user.gitEmail || ""} placeholder="Email for git commits" />
        <p className="text-xs text-muted-foreground">Email address used for git commits. Defaults to your account email if not set.</p>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</div>}

      {success && <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-2">Profile updated successfully!</div>}

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}
