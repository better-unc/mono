import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, LockPasswordIcon, CheckmarkCircle02Icon, AlertCircleIcon } from "@hugeicons-pro/core-stroke-standard";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-destructive/10">
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Invalid reset link</h1>
            <p className="text-muted-foreground text-sm mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-500/10">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Password reset complete</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-destructive/10">
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Reset failed</h1>
            <p className="text-muted-foreground text-sm mb-6">{error}</p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="border border-border bg-card/80 p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted">
              <HugeiconsIcon icon={LockPasswordIcon} strokeWidth={2} className="size-6 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Create new password</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Enter your new password below.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              className="bg-input/50 h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              className="bg-input/50 h-11"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">
            {loading ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </form>
      </div>
      <div className="mt-6 p-4 border border-border text-center">
        <p className="text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link to="/login" className="text-foreground hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
