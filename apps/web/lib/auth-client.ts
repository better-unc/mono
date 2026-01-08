import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "better-auth/client/plugins";
import { getPublicServerUrl } from "./utils";

export const authClient = createAuthClient({
  baseURL: getPublicServerUrl(),
  plugins: [apiKeyClient()],
});

export const { signIn, signOut, useSession } = authClient;

export async function signUpWithUsername(data: { email: string; password: string; name: string; username: string }) {
  return authClient.signUp.email(data as Parameters<typeof authClient.signUp.email>[0]);
}
