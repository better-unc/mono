"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/actions/settings";
import { Loader2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteAccountProps {
  username: string;
}

export function DeleteAccount({ username }: DeleteAccountProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (confirmation !== username) {
      setError("Please type your username to confirm");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteAccount();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setLoading(false);
    }
  }

  if (!showConfirm) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. All your repositories and data will be permanently deleted.
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowConfirm(true)}
        >
          Delete Account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-md">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-500">
            This action cannot be undone
          </p>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account, all repositories, and remove all your data from our servers.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">
          Type <span className="font-mono font-semibold">{username}</span> to confirm
        </Label>
        <Input
          id="confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Enter your username"
        />
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setShowConfirm(false);
            setConfirmation("");
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading || confirmation !== username}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Delete My Account
        </Button>
      </div>
    </div>
  );
}

