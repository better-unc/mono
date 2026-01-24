"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CameraIcon, DeleteIcon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";
import { toast } from "sonner";
import { useDeleteAvatar, useUpdateAvatar } from "@gitbruv/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AvatarUploadProps {
  currentAvatar?: string | null;
  name: string;
}

export function AvatarUpload({ currentAvatar, name }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateAvatarMutation = useUpdateAvatar();
  const deleteAvatarMutation = useDeleteAvatar();

  useEffect(() => {
    setPreview(currentAvatar || null);
  }, [currentAvatar]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    updateAvatarMutation.mutate(file, {
      onSuccess: (result) => {
        if (result?.avatarUrl) {
          setPreview(result.avatarUrl);
        }
        toast.success("Avatar updated successfully");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
        setPreview(currentAvatar || null);
      },
    });
  }

  function handleDeleteAvatar() {
    deleteAvatarMutation.mutate(undefined, {
      onSuccess: () => {
        setPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        toast.success("Avatar removed");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete avatar");
      },
    });
  }

  return (
    <div className="flex items-start gap-6">
      <div className="relative">
        <Avatar className="w-24 h-24 rounded-none border-none after:border-none">
          <AvatarImage src={preview || undefined} alt={name} className="rounded-none border-none" />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold rounded-none">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {updateAvatarMutation.isPending && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-6 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={updateAvatarMutation.isPending || deleteAvatarMutation.isPending}>
            <HugeiconsIcon icon={CameraIcon} strokeWidth={2} className="size-4 mr-2" />
            Change Avatar
          </Button>
          {preview && (
            <Button type="button" variant="destructive" size="sm" onClick={handleDeleteAvatar} disabled={updateAvatarMutation.isPending || deleteAvatarMutation.isPending}>
              {deleteAvatarMutation.isPending ? (
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
