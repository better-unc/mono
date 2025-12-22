"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmail } from "@/actions/settings";
import { Loader2 } from "lucide-react";

interface EmailFormProps {
  currentEmail: string;
}

export function EmailForm({ currentEmail }: EmailFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    if (email === currentEmail) {
      setError("New email is the same as current email");
      setLoading(false);
      return;
    }

    try {
      await updateEmail({ email });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={currentEmail}
          required
        />
        <p className="text-xs text-muted-foreground">
          Your email is used for account notifications and git authentication
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
          Email updated successfully!
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Update Email
      </Button>
    </form>
  );
}

