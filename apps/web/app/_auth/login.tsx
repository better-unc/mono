import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { signIn, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { FingerPrintIcon, Loading02Icon } from "@hugeicons-pro/core-stroke-standard";

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && PublicKeyCredential.isConditionalMediationAvailable && PublicKeyCredential.isConditionalMediationAvailable()) {
      void authClient.signIn.passkey({ autoFill: true });
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn.email({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || "Failed to sign in");
        return;
      }

      toast.success("Welcome back!");
      navigate({ to: "/" });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeySignIn() {
    setPasskeyLoading(true);

    try {
      const { error } = await authClient.signIn.passkey();

      if (error) {
        toast.error(error.message || "Failed to sign in with passkey");
        return;
      }

      toast.success("Welcome back!");
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        toast.error("Something went wrong");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="border border-border bg-card/80 p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold">Sign in to gitbruv</h1>
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
              required
              autoComplete="username webauthn"
              className="bg-input/50 h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password webauthn"
              className="bg-input/50 h-11"
            />
          </div>
          <Button type="submit" disabled={loading || passkeyLoading} className="w-full h-11">
            {loading ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={handlePasskeySignIn} disabled={loading || passkeyLoading} className="w-full h-11">
          {passkeyLoading ? (
            <>
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="size-4 mr-2" />
              Sign in with Passkey
            </>
          )}
        </Button>
      </div>
      <div className="mt-6 p-4 border border-border text-center">
        <p className="text-sm text-muted-foreground">
          New to gitbruv?{" "}
          <Link to="/register" className="text-foreground hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
