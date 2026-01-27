import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, CheckmarkCircle02Icon, AlertCircleIcon, Mail01Icon } from "@hugeicons-pro/core-stroke-standard";
import { Link, createFileRoute } from "@tanstack/react-router";
import { getApiUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_auth/verify-email")({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    async function verifyEmail() {
      try {
        const res = await fetch(`${getApiUrl()}/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error || "Failed to verify email");
          return;
        }

        setStatus("success");
      } catch {
        setStatus("error");
        setErrorMessage("Something went wrong");
      }
    }

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 text-muted-foreground animate-spin" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Verifying your email</h1>
            <p className="text-muted-foreground text-sm">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "no-token") {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-muted">
                <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-8 text-muted-foreground" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Verify your email</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Check your inbox for a verification link to complete your registration.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full">
        <div className="border border-border bg-card/80 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-xl font-semibold mb-2">Email verified</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Your email has been verified successfully. You can now access all features.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="border border-border bg-card/80 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-semibold mb-2">Verification failed</h1>
          <p className="text-muted-foreground text-sm mb-6">{errorMessage}</p>
          <Button asChild className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
