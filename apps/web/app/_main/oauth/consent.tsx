import {
  CheckmarkCircleIcon,
  Loading02Icon,
  QuestionIcon,
} from '@hugeicons-pro/core-stroke-standard';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_main/oauth/consent')({
  component: ConsentPage,
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: (search.client_id as string) || '',
    scope: (search.scope as string) || '',
    state: (search.state as string) || '',
    redirect_uri: (search.redirect_uri as string) || '',
    response_type: (search.response_type as string) || '',
    code_challenge: (search.code_challenge as string) || '',
    code_challenge_method: (search.code_challenge_method as string) || '',
    exp: (search.exp as string) || '',
    sig: (search.sig as string) || '',
  }),
});

const SCOPE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  openid: {
    name: 'OpenID',
    description: 'Verify your identity',
  },
  profile: {
    name: 'Profile',
    description: 'Access your name and profile picture',
  },
  email: {
    name: 'Email',
    description: 'Access your email address',
  },
  offline_access: {
    name: 'Offline Access',
    description: 'Access your data while you are offline',
  },
};

function ConsentPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_main/oauth/consent' });
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  const clientId = search.client_id;
  const requestedScope = search.scope;
  const scopes = requestedScope.split(' ').filter(Boolean);

  const oauthQuery = new URLSearchParams({
    client_id: search.client_id,
    scope: search.scope,
    state: search.state,
    redirect_uri: search.redirect_uri,
    response_type: search.response_type,
    code_challenge: search.code_challenge,
    code_challenge_method: search.code_challenge_method,
    exp: search.exp,
    sig: search.sig,
  }).toString();

  useEffect(() => {
    console.group('[OAuth] Consent page loaded');
    console.log('client_id:    ', search.client_id);
    console.log('scope:        ', search.scope);
    console.log('redirect_uri: ', search.redirect_uri);
    console.log('state:        ', search.state);
    console.log('response_type:', search.response_type);
    console.log('code_challenge_method:', search.code_challenge_method);
    console.log('exp:          ', search.exp ? new Date(Number(search.exp) * 1000).toISOString() : '—');
    console.groupEnd();
  }, []);

  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ['oauth-public-client', clientId],
    queryFn: async () => {
      console.log('[OAuth] Fetching public client info for:', clientId);
      const result = await authClient.oauth2.publicClient({
        query: { client_id: clientId },
      });
      if (result.error) {
        console.error('[OAuth] Failed to fetch client:', result.error);
        throw result.error;
      }
      console.log('[OAuth] Client info:', result.data);
      return result.data;
    },
    enabled: !!clientId,
  });

  const consentMutation = useMutation({
    mutationFn: async (accept: boolean) => {
      console.group(`[OAuth] Submitting consent — accept: ${accept}`);
      console.log('oauth_query:', oauthQuery);
      const result = await authClient.oauth2.consent({
        accept,
        scope: accept ? requestedScope : undefined,
        oauth_query: oauthQuery,
      } as any);
      if (result.error) {
        console.error('[OAuth] Consent error:', result.error);
        console.groupEnd();
        throw result.error;
      }
      console.log('[OAuth] Consent response:', result.data);
      console.groupEnd();
      return result.data;
    },
  });

  async function handleAccept() {
    setIsAccepting(true);
    try {
      const data = await consentMutation.mutateAsync(true);
      if (data?.uri) {
        console.log('[OAuth] Redirecting to callback:', data.uri);
        window.location.href = data.uri;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to grant consent');
      setIsAccepting(false);
    }
  }

  async function handleDeny() {
    setIsDenying(true);
    try {
      const data = await consentMutation.mutateAsync(false);
      if (data?.uri) {
        console.log('[OAuth] Denied — redirecting to:', data.uri);
        window.location.href = data.uri;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deny consent');
      setIsDenying(false);
    }
  }

  useEffect(() => {
    if (!clientId) {
      console.warn('[OAuth] No client_id found, redirecting home');
      navigate({ to: '/' });
    }
  }, [clientId, navigate]);

  if (!clientId) {
    return null;
  }

  if (clientLoading) {
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

  if (clientError || !client) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-red-500">
            {clientError instanceof Error ? clientError.message : 'Application not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="bg-card border p-8">
        <div className="mb-8 text-center">
          <div className="bg-muted mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            {client.icon ? (
              <img src={client.logo_uri} alt="" className="size-10 rounded-full" />
            ) : (
              <HugeiconsIcon
                icon={QuestionIcon}
                strokeWidth={2}
                className="text-muted-foreground size-8"
              />
            )}
          </div>
          <h1 className="text-xl font-semibold">Authorize {client.client_name || 'Application'}</h1>
          {client.client_uri && (
            <p className="text-muted-foreground mt-1 text-sm">
              {new URL(client.client_uri).hostname}
            </p>
          )}
        </div>

        <div className="mb-6">
          <p className="text-muted-foreground mb-4 text-sm">
            This application is requesting access to:
          </p>
          <div className="space-y-3">
            {scopes.map((scope) => {
              const scopeInfo = SCOPE_DESCRIPTIONS[scope] || {
                name: scope,
                description: `Access to ${scope}`,
              };
              return (
                <div key={scope} className="bg-muted/50 flex items-start gap-3 border p-3">
                  <HugeiconsIcon
                    icon={CheckmarkCircleIcon}
                    strokeWidth={2}
                    className="mt-0.5 size-5 shrink-0 text-green-500"
                  />
                  <div>
                    <p className="text-sm font-medium">{scopeInfo.name}</p>
                    <p className="text-muted-foreground text-xs">{scopeInfo.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleAccept}
            disabled={isAccepting || isDenying}
            className="h-11 w-full"
          >
            {isAccepting ? (
              <>
                <HugeiconsIcon
                  icon={Loading02Icon}
                  strokeWidth={2}
                  className="mr-2 size-4 animate-spin"
                />
                Authorizing...
              </>
            ) : (
              'Authorize'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDeny}
            disabled={isAccepting || isDenying}
            className="h-11 w-full"
          >
            {isDenying ? (
              <>
                <HugeiconsIcon
                  icon={Loading02Icon}
                  strokeWidth={2}
                  className="mr-2 size-4 animate-spin"
                />
                Canceling...
              </>
            ) : (
              'Cancel'
            )}
          </Button>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          By authorizing, you allow this application to access your information as described above.
          You can revoke access at any time in your settings.
        </p>
      </div>
    </div>
  );
}
