import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';

export type OAuthClient = {
  id: string;
  client_id: string;
  client_name: string | null;
  client_uri: string | null;
  icon: string | null;
  redirect_uris: string[];
  scope: string | null;
  disabled: boolean | null;
  public: boolean | null;
  client_id_issued_at: Date;
  client_updated_at: Date;
};

export type OAuthConsent = {
  id: string;
  clientId: string;
  scopes: string;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    name: string | null;
    icon: string | null;
    uri: string | null;
  };
};

export function useOAuthClients() {
  return useQuery({
    queryKey: ['oauth-clients'],
    queryFn: async () => {
      const result = await authClient.oauth2.getClients({});
      if (result.error) throw result.error;
      return (result.data ?? []) as unknown as OAuthClient[];
    },
  });
}

export function useCreateOAuthClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name?: string;
      redirectUris: string[];
      uri?: string;
      icon?: string;
    }) => {
      const result = await authClient.oauth2.register({
        client_name: data.name,
        redirect_uris: data.redirectUris,
        client_uri: data.uri,
        logo_uri: data.icon,
      });
      if (result.error) throw result.error;
      return result.data as {
        client_id: string;
        client_secret?: string;
        client_name?: string;
        redirect_uris: string[];
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-clients'] });
    },
  });
}

export function useUpdateOAuthClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      update: {
        name?: string;
        redirect_uris?: string[];
        client_uri?: string;
        logo_uri?: string;
        disabled?: boolean;
      };
    }) => {
      const result = await authClient.oauth2.updateClient({
        client_id: data.clientId,
        update: {
          client_name: data.update.name,
          redirect_uris: data.update.redirect_uris,
          client_uri: data.update.client_uri,
          logo_uri: data.update.logo_uri,
        },
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-clients'] });
    },
  });
}

export function useDeleteOAuthClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { clientId: string }) => {
      const result = await authClient.oauth2.deleteClient({
        client_id: data.clientId,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-clients'] });
    },
  });
}

export function useRotateClientSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { clientId: string }) => {
      const result = await authClient.oauth2.client.rotateSecret({
        client_id: data.clientId,
      });
      if (result.error) throw result.error;
      return result.data as { client_secret: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-clients'] });
    },
  });
}

export function useOAuthConsents() {
  return useQuery({
    queryKey: ['oauth-consents'],
    queryFn: async () => {
      const result = await authClient.oauth2.getConsents({});
      if (result.error) throw result.error;
      return (result.data ?? []) as unknown as OAuthConsent[];
    },
  });
}

export function useDeleteOAuthConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string }) => {
      const result = await authClient.oauth2.deleteConsent({
        id: data.id,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-consents'] });
    },
  });
}
