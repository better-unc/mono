import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { authClient } from "@/lib/auth-client";

type ApiKey = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export function useApiKeys() {
  return useSWR<ApiKey[]>("api-keys", async () => {
    const result = await authClient.apiKey.list();
    if (result.error) throw result.error;
    return (result.data ?? []) as unknown as ApiKey[];
  });
}

export function useCreateApiKey() {
  return useSWRMutation("api-keys", async (_, { arg }: { arg: { name?: string } }) => {
    const result = await authClient.apiKey.create({
      name: arg.name,
    });
    if (result.error) throw result.error;
    return result.data as { key: string; id: string };
  });
}

export function useDeleteApiKey() {
  return useSWRMutation("api-keys", async (_, { arg }: { arg: { keyId: string } }) => {
    const result = await authClient.apiKey.delete({
      keyId: arg.keyId,
    });
    if (result.error) throw result.error;
    return result.data;
  });
}
