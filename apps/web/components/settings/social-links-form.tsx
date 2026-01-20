"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateSocialLinks } from "@gitbruv/hooks";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, LinkIcon } from "@hugeicons-pro/core-stroke-standard";
import { GithubIcon, LinkedInIcon, XIcon } from "../icons";

interface SocialLinksFormProps {
  socialLinks?: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    custom?: string[];
  } | null;
}

export function SocialLinksForm({ socialLinks }: SocialLinksFormProps) {
  const { mutate, isPending } = useUpdateSocialLinks();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customLinks, setCustomLinks] = useState<string[]>([socialLinks?.custom?.[0] || "", socialLinks?.custom?.[1] || "", socialLinks?.custom?.[2] || ""]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);

    mutate(
      {
        github: formData.get("github") as string,
        twitter: formData.get("twitter") as string,
        linkedin: formData.get("linkedin") as string,
        custom: customLinks.filter(Boolean),
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to update social links");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="github" className="flex items-center gap-2">
          <GithubIcon className="w-4 h-4" />
          GitHub
        </Label>
        <Input id="github" name="github" defaultValue={socialLinks?.github || ""} placeholder="https://github.com/username" type="url" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="twitter" className="flex items-center gap-2">
          <XIcon className="w-4 h-4" />
          Twitter / X
        </Label>
        <Input id="twitter" name="twitter" defaultValue={socialLinks?.twitter || ""} placeholder="https://twitter.com/username" type="url" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin" className="flex items-center gap-2">
          <LinkedInIcon className="w-4 h-4" />
          LinkedIn
        </Label>
        <Input id="linkedin" name="linkedin" defaultValue={socialLinks?.linkedin || ""} placeholder="https://linkedin.com/in/username" type="url" />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4" />
          Custom Links
        </Label>
        {[0, 1, 2].map((i) => (
          <Input
            key={i}
            value={customLinks[i]}
            onChange={(e) => {
              const newLinks = [...customLinks];
              newLinks[i] = e.target.value;
              setCustomLinks(newLinks);
            }}
            placeholder={`Custom link ${i + 1}`}
            type="url"
          />
        ))}
        <p className="text-xs text-muted-foreground">Add up to 3 custom links to your profile</p>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</div>}

      {success && <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-2">Social links updated!</div>}

      <Button type="submit" disabled={isPending}>
        {isPending && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
        Save Social Links
      </Button>
    </form>
  );
}
