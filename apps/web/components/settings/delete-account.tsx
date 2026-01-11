import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAccount } from "@/lib/hooks/use-settings";
import { Loader2, AlertTriangle } from "lucide-react";

interface DeleteAccountProps {
  username: string;
}

export function DeleteAccount({ username }: DeleteAccountProps) {
  const { trigger, isMutating } = useDeleteAccount();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  async function handleDelete() {
    if (confirmation !== username) {
      setError("Please type your username to confirm");
      return;
    }

    setError(null);

    try {
      await trigger();
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  if (!showConfirm) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. All your repositories and data will be permanently deleted.
        </p>
        <Button variant="destructive" onClick={() => setShowConfirm(true)}>
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
          <p className="text-sm font-medium text-red-500">This action cannot be undone</p>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your account, all repositories, and remove all your data from our servers.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">
          Type <span className="font-mono font-semibold">{username}</span> to confirm
        </Label>
        <Input id="confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Enter your username" />
      </div>

      {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</div>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setShowConfirm(false);
            setConfirmation("");
            setError(null);
          }}
          disabled={isMutating}
        >
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={isMutating || confirmation !== username}>
          {isMutating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Delete My Account
        </Button>
      </div>
    </div>
  );
}
