"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { deleteAvatar, updateAvatar } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { CameraIcon, DeleteIcon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  name: string;
}

export function AvatarUpload({ currentAvatar, name }: AvatarUploadProps) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);

    try {
      const result = await updateAvatar(file);
      if (result) {
        setPreview(result.avatarUrl);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
      setPreview(currentAvatar || null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteAvatar() {
    setIsDeleting(true);
    try {
      await deleteAvatar();
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("Avatar removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete avatar");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-start gap-6">
      <div className="relative">
        <Avatar className="w-24 h-24 rounded-none border-none after:border-none">
          <AvatarImage src={preview || undefined} alt={name} className="rounded-none border-none" />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-6 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isDeleting}>
            <HugeiconsIcon icon={CameraIcon} strokeWidth={2} className="size-4 mr-2" />
            Change Avatar
          </Button>
          {preview && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDeleteAvatar} disabled={isUploading || isDeleting}>
              {isDeleting ? (
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
              ) : (
                <HugeiconsIcon icon={DeleteIcon} strokeWidth={2} className="size-4 mr-2" />
              )}
              Delete Avatar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
      </div>
    </div>
  );
}
