import {
  Alert01Icon,
  CheckmarkCircleIcon,
  CodeIcon,
  CopyIcon,
  DeleteIcon,
  Edit02Icon,
  FingerPrintIcon,
  Loading02Icon,
  PlusSignIcon,
  RefreshIcon,
  ShieldIcon,
  UserIcon,
} from '@hugeicons-pro/core-stroke-standard';
import {
  useCurrentUser,
  useUpdatePreferences,
  useUpdateProfile,
  useUpdateWordWrapPreference,
  useWordWrapPreference,
} from '@gitbruv/hooks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  useCreateOAuthClient,
  useDeleteOAuthClient,
  useDeleteOAuthConsent,
  useOAuthClients,
  useOAuthConsents,
  useRotateClientSecret,
  useUpdateOAuthClient,
} from '@/lib/hooks/use-oauth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAddPasskey, useDeletePasskey, usePasskeys } from '@/lib/hooks/use-passkeys';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SocialLinksForm } from '@/components/settings/social-links-form';
import type { OAuthClient, OAuthConsent } from '@/lib/hooks/use-oauth';
import { DeleteAccount } from '@/components/settings/delete-account';
import { PasswordForm } from '@/components/settings/password-form';
import { AvatarUpload } from '@/components/settings/avatar-upload';
import { parseAsStringLiteral, useQueryState } from '@/lib/hooks';
import { ProfileForm } from '@/components/settings/profile-form';
import { EmailForm } from '@/components/settings/email-form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_main/settings')({
  component: SettingsPage,
});

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
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
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
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
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
          <EmailForm currentEmail={user.email ?? ''} />
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

function GitSettingsForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUser>['data']>['user'];
}) {
  const { mutate, isPending } = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gitEmail, setGitEmail] = useState(user.gitEmail || '');
  const [defaultVisibility, setDefaultVisibility] = useState<'public' | 'private'>(
    user.defaultRepositoryVisibility || 'public',
  );

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
          setError(err instanceof Error ? err.message : 'Failed to update git settings');
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="gitEmail">Git Email</Label>
        <Input
          id="gitEmail"
          type="email"
          value={gitEmail}
          onChange={(e) => setGitEmail(e.target.value)}
          placeholder="Email for git commits"
        />
        <p className="text-muted-foreground text-xs">
          Email address used for git commits. Defaults to your account email if not set.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultVisibility">Default Repository Visibility</Label>
        <Select
          value={defaultVisibility}
          onValueChange={(v: 'public' | 'private' | null) =>
            setDefaultVisibility(v as 'public' | 'private')
          }
        >
          <SelectTrigger id="defaultVisibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">Default visibility for new repositories</p>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-500">
          Settings updated successfully!
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending && (
          <HugeiconsIcon
            icon={Loading02Icon}
            strokeWidth={2}
            className="mr-2 size-4 animate-spin"
          />
        )}
        Save Changes
      </Button>
    </form>
  );
}

function PreferencesForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof useCurrentUser>['data']>['user'];
}) {
  const { mutateAsync: updatePreferences, isPending: isUpdatingPreferences } =
    useUpdatePreferences();
  const { data: wordWrapData } = useWordWrapPreference();
  const { mutateAsync: updateWordWrap, isPending: isUpdatingWordWrap } =
    useUpdateWordWrapPreference();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const preferences = user.preferences || {};
  const [emailNotifications, setEmailNotifications] = useState(
    preferences.emailNotifications ?? true,
  );
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(preferences.theme || 'system');
  const [language, setLanguage] = useState(preferences.language || '');
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
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailNotifications">Email Notifications</Label>
            <p className="text-muted-foreground text-xs">
              Receive email notifications for important updates
            </p>
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
        <Select
          value={theme}
          onValueChange={(v: 'light' | 'dark' | 'system' | null) =>
            setTheme(v as 'light' | 'dark' | 'system')
          }
        >
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
        <Input
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="e.g., en, es, fr"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showEmail">Show Email</Label>
            <p className="text-muted-foreground text-xs">
              Display your email address on your public profile
            </p>
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
            <p className="text-muted-foreground text-xs">Wrap long lines when viewing files</p>
          </div>
          <input
            id="wordWrap"
            type="checkbox"
            checked={wordWrap}
            onChange={(e) => setWordWrap(e.target.checked)}
            className="h-4 w-4 border-gray-300"
          />
        </div>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-500">
          Preferences updated successfully!
        </div>
      )}

      <Button type="submit" disabled={isUpdatingPreferences || isUpdatingWordWrap}>
        {(isUpdatingPreferences || isUpdatingWordWrap) && (
          <HugeiconsIcon
            icon={Loading02Icon}
            strokeWidth={2}
            className="mr-2 size-4 animate-spin"
          />
        )}
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

  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletePasskeyId, setDeletePasskeyId] = useState<string | null>(null);

  if (userLoading || passkeysLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
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
          setNewPasskeyName('');
          refetchPasskeys();
          toast.success('Passkey added successfully');
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to add passkey';
          toast.error(message);
        },
      },
    );
  }

  function handleDelete(passkeyId: string) {
    deletePasskey(
      { passkeyId },
      {
        onSuccess: () => {
          setDeletePasskeyId(null);
          refetchPasskeys();
          toast.success('Passkey deleted successfully');
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to delete passkey';
          toast.error(message);
        },
      },
    );
  }

  function handleCloseCreate() {
    setIsCreateOpen(false);
    setNewPasskeyName('');
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Use passkeys for secure, passwordless authentication. Sign in with biometrics, PINs, or
            security keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 space-y-2 p-4">
            <p className="text-sm font-medium">What are passkeys?</p>
            <p className="text-muted-foreground text-sm">
              Passkeys are a secure alternative to passwords. They use cryptographic keys stored on
              your device, allowing you to sign in with biometrics, PINs, or security keys without
              entering a password.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Your Passkeys</h3>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-2 size-4" />
                  Add Passkey
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Passkey</DialogTitle>
                  <DialogDescription>
                    Register a new passkey for your account. You'll be prompted to authenticate with
                    your device.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passkey-name">Passkey Name (Optional)</Label>
                    <Input
                      id="passkey-name"
                      value={newPasskeyName}
                      onChange={(e) => setNewPasskeyName(e.target.value)}
                      placeholder="e.g., My Laptop, iPhone"
                    />
                    <p className="text-muted-foreground text-xs">
                      Give your passkey a name to remember what device it's for.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreate} disabled={isAdding}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPasskey} disabled={isAdding}>
                    {isAdding && (
                      <HugeiconsIcon
                        icon={Loading02Icon}
                        strokeWidth={2}
                        className="mr-2 size-4 animate-spin"
                      />
                    )}
                    Register Passkey
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {passkeys && passkeys.length > 0 ? (
            <div className="divide-y border">
              {passkeys.map((passkey: Passkey) => (
                <div key={passkey.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <HugeiconsIcon
                      icon={FingerPrintIcon}
                      strokeWidth={2}
                      className="text-muted-foreground size-4"
                    />
                    <div>
                      <p className="text-sm font-medium">{passkey.name || 'Unnamed Passkey'}</p>
                      <p className="text-muted-foreground text-xs">
                        {passkey.deviceType} · Created{' '}
                        {new Date(passkey.createdAt).toLocaleDateString()}
                        {passkey.backedUp && ' · Backed up'}
                      </p>
                    </div>
                  </div>
                  <Dialog
                    open={deletePasskeyId === passkey.id}
                    onOpenChange={(open) => setDeletePasskeyId(open ? passkey.id : null)}
                  >
                    <DialogTrigger>
                      <Button variant="ghost" size="icon">
                        <HugeiconsIcon
                          icon={DeleteIcon}
                          strokeWidth={2}
                          className="text-muted-foreground hover:text-destructive size-4"
                        />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Passkey</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this passkey? You'll no longer be able to
                          sign in with it.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setDeletePasskeyId(null)}
                          disabled={isDeleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(passkey.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting && (
                            <HugeiconsIcon
                              icon={Loading02Icon}
                              strokeWidth={2}
                              className="mr-2 size-4 animate-spin"
                            />
                          )}
                          Delete Passkey
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted/30 border border-dashed py-8 text-center">
              <HugeiconsIcon
                icon={FingerPrintIcon}
                strokeWidth={2}
                className="text-muted-foreground mx-auto mb-2 size-8"
              />
              <p className="text-muted-foreground text-sm">
                No passkeys yet. Add one to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OAuthTab() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const user = data?.user;
  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = useOAuthClients();
  const {
    data: consents,
    isLoading: consentsLoading,
    refetch: refetchConsents,
  } = useOAuthConsents();
  const { mutate: createClient, isPending: isCreating } = useCreateOAuthClient();
  const { mutate: updateClient, isPending: isUpdating } = useUpdateOAuthClient();
  const { mutate: deleteClient, isPending: isDeletingClient } = useDeleteOAuthClient();
  const { mutate: rotateSecret, isPending: isRotating } = useRotateClientSecret();
  const { mutate: deleteConsent, isPending: isDeletingConsent } = useDeleteOAuthConsent();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppRedirectUris, setNewAppRedirectUris] = useState('');
  const [newAppUri, setNewAppUri] = useState('');
  const [createdApp, setCreatedApp] = useState<{ clientId: string; clientSecret?: string } | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);
  const [editName, setEditName] = useState('');
  const [editRedirectUris, setEditRedirectUris] = useState('');
  const [editUri, setEditUri] = useState('');

  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [rotateClientId, setRotateClientId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedNewSecret, setCopiedNewSecret] = useState(false);

  const [deleteConsentId, setDeleteConsentId] = useState<string | null>(null);

  if (userLoading || clientsLoading || consentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function handleCreate() {
    const redirectUris = newAppRedirectUris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean);

    if (redirectUris.length === 0) {
      toast.error('At least one redirect URI is required');
      return;
    }

    createClient(
      {
        name: newAppName || 'My Application',
        redirectUris,
        uri: newAppUri || undefined,
      },
      {
        onSuccess: (result) => {
          setCreatedApp({
            clientId: result.client_id,
            clientSecret: result.client_secret,
          });
          setNewAppName('');
          setNewAppRedirectUris('');
          setNewAppUri('');
          refetchClients();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create application');
        },
      },
    );
  }

  function handleCloseCreate() {
    setIsCreateOpen(false);
    setCreatedApp(null);
    setNewAppName('');
    setNewAppRedirectUris('');
    setNewAppUri('');
    setCopiedId(false);
    setCopiedSecret(false);
  }

  function handleCopyId() {
    if (createdApp?.clientId) {
      navigator.clipboard.writeText(createdApp.clientId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  function handleCopySecret() {
    if (createdApp?.clientSecret) {
      navigator.clipboard.writeText(createdApp.clientSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  }

  function handleEditOpen(client: OAuthClient) {
    setEditingClient(client);
    setEditName(client.client_name || '');
    setEditRedirectUris(client.redirect_uris.join('\n'));
    setEditUri(client.client_uri || '');
  }

  function handleEditClose() {
    setEditingClient(null);
    setEditName('');
    setEditRedirectUris('');
    setEditUri('');
  }

  function handleUpdate() {
    if (!editingClient) return;

    const redirectUris = editRedirectUris
      .split('\n')
      .map((uri) => uri.trim())
      .filter(Boolean);

    if (redirectUris.length === 0) {
      toast.error('At least one redirect URI is required');
      return;
    }

    updateClient(
      {
        clientId: editingClient.client_id,
        update: {
          name: editName || undefined,
          redirect_uris: redirectUris,
          client_uri: editUri || undefined,
        },
      },
      {
        onSuccess: () => {
          handleEditClose();
          refetchClients();
          toast.success('Application updated');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update application');
        },
      },
    );
  }

  function handleDeleteClient(clientId: string) {
    deleteClient(
      { clientId },
      {
        onSuccess: () => {
          setDeleteClientId(null);
          refetchClients();
          toast.success('Application deleted');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to delete application');
        },
      },
    );
  }

  function handleRotateSecret(clientId: string) {
    rotateSecret(
      { clientId },
      {
        onSuccess: (result) => {
          setNewSecret(result.client_secret);
          refetchClients();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to rotate secret');
        },
      },
    );
  }

  function handleCloseRotate() {
    setRotateClientId(null);
    setNewSecret(null);
    setCopiedNewSecret(false);
  }

  function handleCopyNewSecret() {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopiedNewSecret(true);
      setTimeout(() => setCopiedNewSecret(false), 2000);
    }
  }

  function handleDeleteConsent(id: string) {
    deleteConsent(
      { id },
      {
        onSuccess: () => {
          setDeleteConsentId(null);
          refetchConsents();
          toast.success('Access revoked');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to revoke access');
        },
      },
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>OAuth Applications</CardTitle>
          <CardDescription>
            Create OAuth applications to allow third-party services to authenticate with your
            account or on behalf of your users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Your Applications</h3>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger>
                <Button size="sm">
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-2 size-4" />
                  New Application
                </Button>
              </DialogTrigger>
              <DialogContent>
                {createdApp ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Application Created</DialogTitle>
                      <DialogDescription>
                        Save your client credentials now. The client secret will only be shown once.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/10 p-4">
                        <HugeiconsIcon
                          icon={Alert01Icon}
                          strokeWidth={2}
                          className="mt-0.5 size-5 shrink-0 text-amber-500"
                        />
                        <p className="text-muted-foreground text-sm">
                          Make sure to copy your client secret now. For security reasons, we won't
                          show it again.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <div className="flex gap-2">
                          <Input
                            value={createdApp.clientId}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button variant="outline" size="icon" onClick={handleCopyId}>
                            {copiedId ? (
                              <HugeiconsIcon
                                icon={CheckmarkCircleIcon}
                                strokeWidth={2}
                                className="size-4 text-green-500"
                              />
                            ) : (
                              <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      {createdApp.clientSecret && (
                        <div className="space-y-2">
                          <Label>Client Secret</Label>
                          <div className="flex gap-2">
                            <Input
                              value={createdApp.clientSecret}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button variant="outline" size="icon" onClick={handleCopySecret}>
                              {copiedSecret ? (
                                <HugeiconsIcon
                                  icon={CheckmarkCircleIcon}
                                  strokeWidth={2}
                                  className="size-4 text-green-500"
                                />
                              ) : (
                                <HugeiconsIcon icon={CopyIcon} strokeWidth={2} className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCloseCreate}>Done</Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Register New Application</DialogTitle>
                      <DialogDescription>
                        Create a new OAuth application to integrate with gitbruv.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="app-name">Application Name</Label>
                        <Input
                          id="app-name"
                          value={newAppName}
                          onChange={(e) => setNewAppName(e.target.value)}
                          placeholder="My Application"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-uri">Homepage URL (Optional)</Label>
                        <Input
                          id="app-uri"
                          value={newAppUri}
                          onChange={(e) => setNewAppUri(e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-redirect-uris">Authorization Callback URLs</Label>
                        <Textarea
                          id="app-redirect-uris"
                          value={newAppRedirectUris}
                          onChange={(e) => setNewAppRedirectUris(e.target.value)}
                          placeholder="https://example.com/callback&#10;https://example.com/auth/callback"
                          rows={3}
                        />
                        <p className="text-muted-foreground text-xs">
                          Enter one URL per line. These are the URLs where users will be redirected
                          after authorization.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={handleCloseCreate} disabled={isCreating}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating && (
                          <HugeiconsIcon
                            icon={Loading02Icon}
                            strokeWidth={2}
                            className="mr-2 size-4 animate-spin"
                          />
                        )}
                        Register Application
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {clients && clients.length > 0 ? (
            <div className="divide-y border">
              {clients.map((client: OAuthClient) => (
                <div key={client.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-8 items-center justify-center rounded">
                      {client.icon ? (
                        <img src={client.icon} alt="" className="size-6 rounded" />
                      ) : (
                        <HugeiconsIcon
                          icon={CodeIcon}
                          strokeWidth={2}
                          className="text-muted-foreground size-4"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {client.client_name || 'Unnamed Application'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {/* {client.clientId.slice(0, 8)}... · Created{' '} */}
                        {new Date(client.client_id_issued_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditOpen(client)}>
                      <HugeiconsIcon
                        icon={Edit02Icon}
                        strokeWidth={2}
                        className="text-muted-foreground size-4"
                      />
                    </Button>
                    <Dialog
                      open={rotateClientId === client.client_id}
                      onOpenChange={(open) => {
                        if (open) {
                          setRotateClientId(client.client_id);
                        } else {
                          handleCloseRotate();
                        }
                      }}
                    >
                      <DialogTrigger>
                        <Button variant="ghost" size="icon">
                          <HugeiconsIcon
                            icon={RefreshIcon}
                            strokeWidth={2}
                            className="text-muted-foreground size-4"
                          />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        {newSecret ? (
                          <>
                            <DialogHeader>
                              <DialogTitle>New Client Secret</DialogTitle>
                              <DialogDescription>
                                Your new client secret has been generated. Copy it now.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/10 p-4">
                                <HugeiconsIcon
                                  icon={Alert01Icon}
                                  strokeWidth={2}
                                  className="mt-0.5 size-5 shrink-0 text-amber-500"
                                />
                                <p className="text-muted-foreground text-sm">
                                  The previous secret has been invalidated. Update your application
                                  with this new secret.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Input value={newSecret} readOnly className="font-mono text-sm" />
                                <Button variant="outline" size="icon" onClick={handleCopyNewSecret}>
                                  {copiedNewSecret ? (
                                    <HugeiconsIcon
                                      icon={CheckmarkCircleIcon}
                                      strokeWidth={2}
                                      className="size-4 text-green-500"
                                    />
                                  ) : (
                                    <HugeiconsIcon
                                      icon={CopyIcon}
                                      strokeWidth={2}
                                      className="size-4"
                                    />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleCloseRotate}>Done</Button>
                            </DialogFooter>
                          </>
                        ) : (
                          <>
                            <DialogHeader>
                              <DialogTitle>Rotate Client Secret</DialogTitle>
                              <DialogDescription>
                                This will generate a new client secret and invalidate the current
                                one. Any applications using the old secret will stop working.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={handleCloseRotate}>
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleRotateSecret(client.client_id)}
                                disabled={isRotating}
                              >
                                {isRotating && (
                                  <HugeiconsIcon
                                    icon={Loading02Icon}
                                    strokeWidth={2}
                                    className="mr-2 size-4 animate-spin"
                                  />
                                )}
                                Rotate Secret
                              </Button>
                            </DialogFooter>
                          </>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Dialog
                      open={deleteClientId === client.client_id}
                      onOpenChange={(open) => setDeleteClientId(open ? client.client_id : null)}
                    >
                      <DialogTrigger>
                        <Button variant="ghost" size="icon">
                          <HugeiconsIcon
                            icon={DeleteIcon}
                            strokeWidth={2}
                            className="text-muted-foreground hover:text-destructive size-4"
                          />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Application</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete this application? All users who have
                            authorized this application will lose access.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteClientId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDeleteClient(client.client_id)}
                            disabled={isDeletingClient}
                          >
                            {isDeletingClient && (
                              <HugeiconsIcon
                                icon={Loading02Icon}
                                strokeWidth={2}
                                className="mr-2 size-4 animate-spin"
                              />
                            )}
                            Delete Application
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted/30 border border-dashed py-8 text-center">
              <HugeiconsIcon
                icon={CodeIcon}
                strokeWidth={2}
                className="text-muted-foreground mx-auto mb-2 size-8"
              />
              <p className="text-muted-foreground text-sm">
                No OAuth applications yet. Create one to get started.
              </p>
            </div>
          )}

          <Dialog open={!!editingClient} onOpenChange={(open) => !open && handleEditClose()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Application</DialogTitle>
                <DialogDescription>Update your OAuth application settings.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Application Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="My Application"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-uri">Homepage URL (Optional)</Label>
                  <Input
                    id="edit-uri"
                    value={editUri}
                    onChange={(e) => setEditUri(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-redirect-uris">Authorization Callback URLs</Label>
                  <Textarea
                    id="edit-redirect-uris"
                    value={editRedirectUris}
                    onChange={(e) => setEditRedirectUris(e.target.value)}
                    placeholder="https://example.com/callback"
                    rows={3}
                  />
                  <p className="text-muted-foreground text-xs">Enter one URL per line.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleEditClose} disabled={isUpdating}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating}>
                  {isUpdating && (
                    <HugeiconsIcon
                      icon={Loading02Icon}
                      strokeWidth={2}
                      className="mr-2 size-4 animate-spin"
                    />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authorized Applications</CardTitle>
          <CardDescription>
            These are applications you have authorized to access your account. You can revoke access
            at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consents && consents.length > 0 ? (
            <div className="divide-y border">
              {consents.map((consent: OAuthConsent) => (
                <div key={consent.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-8 items-center justify-center rounded">
                      {consent.client?.icon ? (
                        <img src={consent.client.icon} alt="" className="size-6 rounded" />
                      ) : (
                        <HugeiconsIcon
                          icon={CodeIcon}
                          strokeWidth={2}
                          className="text-muted-foreground size-4"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {consent.client?.name || 'Unknown Application'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Scopes: {consent.scopes.split(' ').join(', ')} · Authorized{' '}
                        {new Date(consent.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Dialog
                    open={deleteConsentId === consent.id}
                    onOpenChange={(open) => setDeleteConsentId(open ? consent.id : null)}
                  >
                    <DialogTrigger>
                      <Button variant="outline" size="sm">
                        Revoke
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Revoke Access</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to revoke access for{' '}
                          {consent.client?.name || 'this application'}? It will no longer be able to
                          access your account.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConsentId(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteConsent(consent.id)}
                          disabled={isDeletingConsent}
                        >
                          {isDeletingConsent && (
                            <HugeiconsIcon
                              icon={Loading02Icon}
                              strokeWidth={2}
                              className="mr-2 size-4 animate-spin"
                            />
                          )}
                          Revoke Access
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-muted/30 border border-dashed py-8 text-center">
              <HugeiconsIcon
                icon={CheckmarkCircleIcon}
                strokeWidth={2}
                className="text-muted-foreground mx-auto mb-2 size-8"
              />
              <p className="text-muted-foreground text-sm">
                No authorized applications. When you authorize an application, it will appear here.
              </p>
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
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(['profile', 'account', 'security', 'oauth']).withDefault('profile'),
  );

  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate({ to: '/login' });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <HugeiconsIcon
          icon={Loading02Icon}
          strokeWidth={2}
          className="text-muted-foreground size-8 animate-spin"
        />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-0!">
      <h1 className="mb-8 text-2xl font-semibold">Settings</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value === 'profile' ? null : (value as 'account' | 'security' | 'oauth'))
        }
      >
        <TabsList variant="default" className="mb-6 h-12 w-full">
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
          <TabsTrigger value="oauth">
            <HugeiconsIcon icon={CodeIcon} strokeWidth={2} className="size-4" />
            OAuth
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

        <TabsContent value="oauth" className="mt-0">
          <OAuthTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
