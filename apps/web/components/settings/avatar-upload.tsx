"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateAvatar } from "@/actions/settings";
import { Camera, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  name: string;
}

export function AvatarUpload({ currentAvatar, name }: AvatarUploadProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await updateAvatar(formData);
      setPreview(result.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
      setPreview(currentAvatar || null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-start gap-6">
      <div className="relative">
        <Avatar className="w-24 h-24">
          <AvatarImage src={preview || undefined} alt={name} />
          <AvatarFallback className="text-2xl bg-accent">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {loading && (
          <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          <Camera className="w-4 h-4 mr-2" />
          Change Avatar
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
