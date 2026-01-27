import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, Mail01Icon, CheckmarkCircle02Icon } from "@hugeicons-pro/core-stroke-standard";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to send reset email");
        return;
      }

      setSent(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Check your email</h1>
            <p className="text-muted-foreground text-sm mb-6">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a password reset link.
            </p>
            <p className="text-muted-foreground text-xs">
              Didn't receive the email? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-foreground hover:underline font-medium"
              >
                try again
              </button>
            </p>
          </div>
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

  return (
    <div className="w-full">
      <div className="border border-border bg-card/80 p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-muted">
              <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-6 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Reset your password</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="bg-input/50 h-11"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">
            {loading ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
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
