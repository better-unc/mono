import { AvatarUpload } from "@/components/settings/avatar-upload";
import { DeleteAccount } from "@/components/settings/delete-account";
import { EmailForm } from "@/components/settings/email-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { SocialLinksForm } from "@/components/settings/social-links-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/lib/hooks/use-api-keys";
import { useAddPasskey, useDeletePasskey, usePasskeys } from "@/lib/hooks/use-passkeys";
import { getApiUrl } from "@/lib/utils";
import { useCurrentUser, useUpdatePreferences, useUpdateProfile, useUpdateWordWrapPreference, useWordWrapPreference } from "@gitbruv/hooks";
import {
  Alert01Icon,
  CheckmarkCircleIcon,
  CopyIcon,
  DeleteIcon,
  FingerPrintIcon,
  KeyIcon,
  Loading02Icon,
  PlusSignIcon,
  ShieldIcon,
  UserIcon
} from "@hugeicons-pro/core-stroke-standard";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseAsStringLiteral, useQueryState } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/settings")({
  component: SettingsPage,
});

type ApiKey = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
};

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string;
  createdAt: string;
  backedUp: boolean;
};

function ProfileTab() {
  const { data, isLoading } = useCurrentUser();
  const user = data?.user;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a picture to personalize your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload currentAvatar={user.avatarUrl} name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your profile details visible to other users</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            user={{
              name: user.name,
              username: user.username,
              bio: user.bio,
              location: user.location,
              website: user.website,
              pronouns: user.pronouns,
              company: user.company,
              gitEmail: user.gitEmail,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Add links to your social profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialLinksForm socialLinks={user.socialLinks} />
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTab() {
  const { data, isLoading } = useCurrentUser();
  const user = data?.user;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Email Address</CardTitle>
          <CardDescription>Change the email associated with your account</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm currentEmail={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Git Settings</CardTitle>
          <CardDescription>Configure git-related preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <GitSettingsForm user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your application preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm user={user} />
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount username={user.username} />
        </CardContent>
      </Card>
    </div>
  );
}

function GitSettingsForm({ user }: { user: NonNullable<ReturnType<typeof useCurrentUser>["data"]>["user"] }) {
  const { mutate, isPending } = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gitEmail, setGitEmail] = useState(user.gitEmail || "");
  const [defaultVisibility, setDefaultVisibility] = useState<"public" | "private">(user.defaultRepositoryVisibility || "public");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    mutate(
      {
        gitEmail: gitEmail || undefined,
        defaultRepositoryVisibility: defaultVisibility,
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to update git settings");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="gitEmail">Git Email</Label>
        <Input id="gitEmail" type="email" value={gitEmail} onChange={(e) => setGitEmail(e.target.value)} placeholder="Email for git commits" />
        <p className="text-xs text-muted-foreground">Email address used for git commits. Defaults to your account email if not set.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultVisibility">Default Repository Visibility</Label>
        <Select value={defaultVisibility} onValueChange={(v: "public" | "private" | null) => setDefaultVisibility(v as "public" | "private")}>
          <SelectTrigger id="defaultVisibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Default visibility for new repositories</p>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-2">Settings updated successfully!</div>}

      <Button type="submit" disabled={isPending}>
        {isPending && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

function PreferencesForm({ user }: { user: NonNullable<ReturnType<typeof useCurrentUser>["data"]>["user"] }) {
  const { mutateAsync: updatePreferences, isPending: isUpdatingPreferences } = useUpdatePreferences();
  const { data: wordWrapData } = useWordWrapPreference();
  const { mutateAsync: updateWordWrap, isPending: isUpdatingWordWrap } = useUpdateWordWrapPreference();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const preferences = user.preferences || {};
  const [emailNotifications, setEmailNotifications] = useState(preferences.emailNotifications ?? true);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(preferences.theme || "system");
  const [language, setLanguage] = useState(preferences.language || "");
  const [showEmail, setShowEmail] = useState(preferences.showEmail ?? false);
  const [wordWrap, setWordWrap] = useState(wordWrapData?.wordWrap ?? false);

  useEffect(() => {
    if (wordWrapData?.wordWrap !== undefined) {
      setWordWrap(wordWrapData.wordWrap);
    }
  }, [wordWrapData?.wordWrap]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await Promise.all([
        updatePreferences({
          emailNotifications,
          theme,
          language: language || undefined,
          showEmail,
        }),
        updateWordWrap({ wordWrap }),
      ]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preferences");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailNotifications">Email Notifications</Label>
            <p className="text-xs text-muted-foreground">Receive email notifications for important updates</p>
          </div>
          <input
            id="emailNotifications"
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="h-4 w-4 border-gray-300"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select value={theme} onValueChange={(v: "light" | "dark" | "system" | null) => setTheme(v as "light" | "dark" | "system")}>
          <SelectTrigger id="theme" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">Language</Label>
        <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g., en, es, fr" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showEmail">Show Email</Label>
            <p className="text-xs text-muted-foreground">Display your email address on your public profile</p>
          </div>
          <input
            id="showEmail"
            type="checkbox"
            checked={showEmail}
            onChange={(e) => setShowEmail(e.target.checked)}
            className="h-4 w-4 border-gray-300"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="wordWrap">Word Wrap</Label>
            <p className="text-xs text-muted-foreground">Wrap long lines when viewing files</p>
          </div>
          <input id="wordWrap" type="checkbox" checked={wordWrap} onChange={(e) => setWordWrap(e.target.checked)} className="h-4 w-4 border-gray-300" />
        </div>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-2">Preferences updated successfully!</div>}

      <Button type="submit" disabled={isUpdatingPreferences || isUpdatingWordWrap}>
        {(isUpdatingPreferences || isUpdatingWordWrap) && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}

function SecurityTab() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const user = data?.user;
  const { data: passkeys, isLoading: passkeysLoading, refetch: refetchPasskeys } = usePasskeys();
  const { mutate: addPasskey, isPending: isAdding } = useAddPasskey();
  const { mutate: deletePasskey, isPending: isDeleting } = useDeletePasskey();

  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletePasskeyId, setDeletePasskeyId] = useState<string | null>(null);

  if (userLoading || passkeysLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function handleAddPasskey() {
    addPasskey(
      { name: newPasskeyName || undefined },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewPasskeyName("");
          refetchPasskeys();
          toast.success("Passkey added successfully");
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Failed to add passkey";
          toast.error(message);
        },
      }
    );
  }

  function handleDelete(passkeyId: string) {
    deletePasskey(
      { passkeyId },
      {
        onSuccess: () => {
          setDeletePasskeyId(null);
          refetchPasskeys();
          toast.success("Passkey deleted successfully");
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Failed to delete passkey";
          toast.error(message);
        },
      }
    );
  }

  function handleCloseCreate() {
    setIsCreateOpen(false);
    setNewPasskeyName("");
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>Use passkeys for secure, passwordless authentication. Sign in with biometrics, PINs, or security keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">What are passkeys?</p>
            <p className="text-sm text-muted-foreground">
              Passkeys are a secure alternative to passwords. They use cryptographic keys stored on your device, allowing you to sign in with biometrics, PINs,
              or security keys without entering a password.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Your Passkeys</h3>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4 mr-2" />
                  Add Passkey
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Passkey</DialogTitle>
                  <DialogDescription>Register a new passkey for your account. You'll be prompted to authenticate with your device.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passkey-name">Passkey Name (Optional)</Label>
                    <Input id="passkey-name" value={newPasskeyName} onChange={(e) => setNewPasskeyName(e.target.value)} placeholder="e.g., My Laptop, iPhone" />
                    <p className="text-xs text-muted-foreground">Give your passkey a name to remember what device it's for.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreate} disabled={isAdding}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPasskey} disabled={isAdding}>
                    {isAdding && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
                    Register Passkey
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {passkeys && passkeys.length > 0 ? (
            <div className="border divide-y">
              {passkeys.map((passkey: Passkey) => (
                <div key={passkey.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{passkey.name || "Unnamed Passkey"}</p>
                      <p className="text-xs text-muted-foreground">
                        {passkey.deviceType} · Created {new Date(passkey.createdAt).toLocaleDateString()}
                        {passkey.backedUp && " · Backed up"}
                      </p>
                    </div>
                  </div>
                  <Dialog open={deletePasskeyId === passkey.id} onOpenChange={(open) => setDeletePasskeyId(open ? passkey.id : null)}>
                    <DialogTrigger>
                      <Button variant="ghost" size="icon">
                        <HugeiconsIcon icon={DeleteIcon} strokeWidth={2} className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Passkey</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this passkey? You'll no longer be able to sign in with it.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletePasskeyId(null)} disabled={isDeleting}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => handleDelete(passkey.id)} disabled={isDeleting}>
                          {isDeleting && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
                          Delete Passkey
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed bg-muted/30">
              <HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No passkeys yet. Add one to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TokensTab() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const user = data?.user;
  const { data: apiKeys, isLoading: keysLoading, refetch: refetchKeys } = useApiKeys();
  const { mutate: createKey, isPending: isCreating } = useCreateApiKey();
  const { mutate: deleteKey, isPending: isDeleting } = useDeleteApiKey();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  if (userLoading || keysLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function handleCreate() {
    createKey(
      { name: newKeyName || "Personal Access Token" },
      {
        onSuccess: (result) => {
          if (result?.key) {
            setCreatedKey(result.key);
            setNewKeyName("");
            refetchKeys();
          }
        },
        onError: (err) => {
          console.error("Failed to create token:", err);
        },
      }
    );
  }

  function handleDelete(keyId: string) {
    deleteKey(
      { keyId },
      {
        onSuccess: () => {
          setDeleteKeyId(null);
          refetchKeys();
        },
        onError: (err) => {
          console.error("Failed to delete token:", err);
        },
      }
    );
  }

  function handleCopy() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCloseCreate() {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setNewKeyName("");
  }

  const gitUrl = getApiUrl();

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Personal Access Tokens</CardTitle>
          <CardDescription>Generate tokens to authenticate Git operations over HTTPS. Use your token as the password when pushing or pulling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">How to use</p>
            <p className="text-sm text-muted-foreground">
              When Git prompts for credentials, enter your username and use your Personal Access Token as the password:
            </p>
            <pre className="mt-2 p-3 bg-background border text-sm overflow-x-auto">
              <code>
                {`$ git clone ${gitUrl}/${user.username}/your-repo.git
Username: ${user.username}
Password: <your-token>`}
              </code>
            </pre>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Your Tokens</h3>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4 mr-2" />
                  Generate Token
                </Button>
              </DialogTrigger>
              <DialogContent>
                {createdKey ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Token Created</DialogTitle>
                      <DialogDescription>Copy your token now. You won't be able to see it again!</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20">
                        <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">Make sure to copy your token now. For security reasons, we won't show it again.</p>
                      </div>
                      <div className="flex gap-2">
                        <Input value={createdKey} readOnly className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={handleCopy}>
                          {copied ? (
                            <HugeiconsIcon icon={CheckmarkCircleIcon} strokeWidth={2} className="size-4 text-green-500" />
                          ) : (
                            <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCloseCreate}>Done</Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Generate New Token</DialogTitle>
                      <DialogDescription>Create a new Personal Access Token for Git authentication.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="token-name">Token Name</Label>
                        <Input id="token-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., My Laptop" />
                        <p className="text-xs text-muted-foreground">Give your token a name to remember what it's used for.</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
                        Generate
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {apiKeys && apiKeys.length > 0 ? (
            <div className="border divide-y">
              {apiKeys.map((key: ApiKey) => (
                <div key={key.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <HugeiconsIcon icon={KeyIcon} strokeWidth={2} className="size-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{key.name || "Personal Access Token"}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.start}•••••••• · Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.expiresAt && <> · Expires {new Date(key.expiresAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  <Dialog open={deleteKeyId === key.id} onOpenChange={(open) => setDeleteKeyId(open ? key.id : null)}>
                    <DialogTrigger>
                      <Button variant="ghost" size="icon">
                        <HugeiconsIcon icon={DeleteIcon} strokeWidth={2} className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Token</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this token? Any applications using this token will no longer be able to access your account.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteKeyId(null)} disabled={isDeleting}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => handleDelete(key.id)} disabled={isDeleting}>
                          {isDeleting && <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-4 mr-2 animate-spin" />}
                          Delete Token
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed bg-muted/30">
              <HugeiconsIcon icon={KeyIcon} strokeWidth={2} className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No tokens yet. Generate one to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(["profile", "account", "security", "tokens"]).withDefault("profile"));

  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <HugeiconsIcon icon={Loading02Icon} strokeWidth={2} className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4 sm:px-0!">
      <h1 className="text-2xl font-semibold mb-8">Settings</h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value === "profile" ? null : (value as "account" | "security" | "tokens"))}>
        <TabsList variant="default" className="w-full mb-6 h-12">
          <TabsTrigger value="profile">
            <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="account">
            <HugeiconsIcon icon={ShieldIcon} strokeWidth={2} className="size-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="security">
            <HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="size-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="tokens">
            <HugeiconsIcon icon={KeyIcon} strokeWidth={2} className="size-4" />
            Access Tokens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="account" className="mt-0">
          <AccountTab />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="tokens" className="mt-0">
          <TokensTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
