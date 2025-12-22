"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpWithUsername } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (formData.username.length < 3) {
      toast.error("Username must be at least 3 characters");
      setLoading(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      toast.error("Username can only contain letters, numbers, hyphens, and underscores");
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUpWithUsername({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        username: formData.username.toLowerCase(),
      });

      if (error) {
        toast.error(error.message || "Failed to create account");
        return;
      }

      toast.success("Account created successfully!");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold">Create your account</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              required
              className="bg-input/50 h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="johndoe"
              required
              className="bg-input/50 h-11"
            />
            <p className="text-xs text-muted-foreground">This will be your unique identifier on gitbruv</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@example.com"
              required
              className="bg-input/50 h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={8}
              className="bg-input/50 h-11"
            />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </div>
      <div className="mt-6 p-4 rounded-xl border border-border text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
