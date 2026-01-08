import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/hooks/use-settings";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/lib/hooks/use-api-keys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Copy, Check, Key, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { getGitUrl } from "@/lib/utils";

export const Route = createFileRoute("/_main/settings/tokens")({
  component: TokensSettingsPage,
});

type ApiKey = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
};

function TokensSettingsPage() {
  const navigate = useNavigate();
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const { data: apiKeys, isLoading: keysLoading, mutate: mutateKeys } = useApiKeys();
  const { trigger: createKey, isMutating: isCreating } = useCreateApiKey();
  const { trigger: deleteKey, isMutating: isDeleting } = useDeleteApiKey();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && (userError || !user)) {
      navigate({ to: "/login" });
    }
  }, [userLoading, userError, user, navigate]);

  if (userLoading || keysLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  async function handleCreate() {
    try {
      const result = await createKey({ name: newKeyName || "Personal Access Token" });
      if (result?.key) {
        setCreatedKey(result.key);
        setNewKeyName("");
        mutateKeys();
      }
    } catch (err) {
      console.error("Failed to create token:", err);
    }
  }

  async function handleDelete(keyId: string) {
    try {
      await deleteKey({ keyId });
      setDeleteKeyId(null);
      mutateKeys();
    } catch (err) {
      console.error("Failed to delete token:", err);
    }
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

  const gitUrl = getGitUrl();

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Personal Access Tokens</CardTitle>
          <CardDescription>Generate tokens to authenticate Git operations over HTTPS. Use your token as the password when pushing or pulling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">How to use</p>
            <p className="text-sm text-muted-foreground">
              When Git prompts for credentials, enter your username and use your Personal Access Token as the password:
            </p>
            <pre className="mt-2 p-3 bg-background rounded border text-sm overflow-x-auto">
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
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
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
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">Make sure to copy your token now. For security reasons, we won't show it again.</p>
                      </div>
                      <div className="flex gap-2">
                        <Input value={createdKey} readOnly className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={handleCopy}>
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
                        {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {apiKeys && apiKeys.length > 0 ? (
            <div className="border border-dashed rounded-lg divide-y">
              {apiKeys.map((key: ApiKey) => (
                <div key={key.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{key.name || "Personal Access Token"}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.start}•••••••• · Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.expiresAt && <> · Expires {new Date(key.expiresAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  <Dialog open={deleteKeyId === key.id} onOpenChange={(open) => setDeleteKeyId(open ? key.id : null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
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
                          {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Delete Token
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg bg-muted/30">
              <Key className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No tokens yet. Generate one to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
